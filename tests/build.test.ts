// Builds the site (with fixture activities in a temporary copy of the content)
// and checks the output, then runs the real server against it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { build } from "../src/build.ts";
import { createSiteServer, resolveStaticPath, parseForm } from "../src/server.ts";
import { makeToken } from "../src/forms/spam.ts";
import type { OutgoingEmail } from "../src/forms/mailer.ts";
import { contentWithFixtures, tempDir, ROOT } from "./helpers.ts";

const BUILT_AT = new Date("2030-06-01T08:00:00Z");
let previewDir = "";
let emptyDir = "";
let pages: { path: string; noindex?: boolean }[] = [];

before(() => {
  const content = contentWithFixtures();
  previewDir = tempDir("smt-dist-");
  pages = build({ mode: "preview", siteUrl: "https://example.org", fontSource: "self", contentDir: content, outDir: previewDir, builtAt: BUILT_AT, quiet: true }).pages;
  emptyDir = tempDir("smt-empty-");
  build({ mode: "preview", siteUrl: "https://example.org", fontSource: "self", outDir: emptyDir, builtAt: BUILT_AT, quiet: true });
});

const read = (dir: string, path: string) => readFileSync(path.endsWith(".html") ? join(dir, path) : join(dir, path, "index.html"), "utf8");

test("every page has one h1, a title, a description, a canonical URL and a main landmark", () => {
  for (const p of pages) {
    const html = read(previewDir, p.path);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${p.path} should have exactly one h1`);
    assert.match(html, /<title>[^<]{5,}<\/title>/, p.path);
    assert.match(html, /<meta name="description" content="[^"]{20,}"/, p.path);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.org\//, p.path);
    assert.match(html, /<main id="main"/, p.path);
    assert.match(html, /<html lang="en-GB">/, p.path);
  }
});

test("no unresolved template tokens or placeholder text leak into pages", () => {
  for (const p of pages) {
    const html = read(previewDir, p.path);
    assert.doesNotMatch(html, /\{\{\w+\}\}/, `${p.path} has an unreplaced {{token}}`);
    assert.doesNotMatch(html, /undefined|\[object Object\]|NaN/, `${p.path} shows a code value`);
  }
});

test("every form control has a label", () => {
  for (const p of pages) {
    const html = read(previewDir, p.path);
    for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
      const attrs = m[2]!;
      if (/type="(hidden|submit)"/.test(attrs)) continue;
      const id = /id="([^"]+)"/.exec(attrs)?.[1];
      assert.ok(id, `${p.path}: control without id: ${m[0]}`);
      assert.ok(html.includes(`for="${id}"`), `${p.path}: no label for #${id}`);
    }
  }
});

test("internal links all point at pages that exist", () => {
  const known = new Set(pages.map((p) => p.path));
  for (const p of pages) {
    const html = read(previewDir, p.path);
    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const href = m[1]!;
      if (/\.(css|js|svg|png|xml|txt|json)$/.test(href) || href.startsWith("/admin")) {
        assert.ok(existsSync(join(previewDir, href)), `${p.path} links to missing file ${href}`);
        continue;
      }
      assert.ok(known.has(href), `${p.path} links to missing page ${href}`);
    }
  }
});

test("with no activities, the activities page shows the honest empty state", () => {
  const html = read(emptyDir, "/activities/");
  assert.match(html, /Activities start soon/);
  assert.doesNotMatch(html, /activity-card/);
  assert.equal(readFileSync(join(emptyDir, "activities.json"), "utf8"), "[]");
});

test("with real activities, cards, detail pages and event data are produced", () => {
  const html = read(previewDir, "/activities/");
  assert.equal((html.match(/class="activity-card"/g) ?? []).length, 2);
  const detail = read(previewDir, "/activities/sunday-walk/");
  assert.match(detail, /"@type":"Event"/);
  assert.match(detail, /Test park gate/);
  assert.equal(JSON.parse(readFileSync(join(previewDir, "activities.json"), "utf8")).length, 2);
});

test("draft programmes appear in preview only", () => {
  assert.ok(existsSync(join(previewDir, "partners/programmes/the-open-table/index.html")));
  assert.match(read(previewDir, "/partners/programmes/the-open-table/"), /noindex/);
});

test("preview builds are hidden from search engines; sitemap excludes thank-you pages", () => {
  assert.match(readFileSync(join(previewDir, "robots.txt"), "utf8"), /Disallow: \//);
  const sitemap = readFileSync(join(previewDir, "sitemap.xml"), "utf8");
  assert.match(sitemap, /https:\/\/example\.org\/about\//);
  assert.doesNotMatch(sitemap, /thanks|404/);
});

test("a production build with fully verified facts hides drafts and flags", async () => {
  const { mkdtempSync, cpSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "smt-prod-content-"));
  cpSync(join(ROOT, "content"), dir, { recursive: true });
  const verify = (file: string) => writeFileSync(join(dir, file), readFileSync(join(dir, file), "utf8").replace(/verified: false/g, "verified: true"));
  verify("organisation.yml");
  verify("site.yml");
  const out = tempDir("smt-prod-");
  build({ mode: "production", siteUrl: "https://example.org", fontSource: "self", contentDir: dir, outDir: out, builtAt: BUILT_AT, quiet: true });
  const home = read(out, "/");
  assert.doesNotMatch(home, /To confirm|Note for editors|Review copy|noindex/);
  assert.ok(!existsSync(join(out, "partners/programmes/the-open-table/index.html")));
  assert.match(readFileSync(join(out, "robots.txt"), "utf8"), /Sitemap: https:\/\/example\.org\/sitemap\.xml/);
});

// ---------------------------------------------------------------- server

let server: Server;
let base = "";
const sent: OutgoingEmail[] = [];

before(async () => {
  server = createSiteServer({ distDir: previewDir, secret: "s3cret", send: async (e) => { sent.push(e); return { ok: true }; }, log: () => {} });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());

test("server: pages get security headers and a fresh form token", async () => {
  const res = await fetch(`${base}/contact/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  const html = await res.text();
  assert.doesNotMatch(html, /__FORM_TOKEN__/);
  assert.match(html, /name="_t" value="\d+\.[\w-]+"/);
});

test("server: directory URLs redirect to the trailing slash, unknown pages 404", async () => {
  const r = await fetch(`${base}/about`, { redirect: "manual" });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "/about/");
  assert.equal((await fetch(`${base}/nope/`)).status, 404);
});

test("server: path traversal is refused", () => {
  assert.equal(resolveStaticPath("/srv/dist", "/../etc/passwd"), null);
  assert.equal(resolveStaticPath("/srv/dist", "/%2e%2e/etc/passwd"), null);
  assert.equal(resolveStaticPath("/srv/dist", "/ok/"), "/srv/dist/ok/");
});

test("server: repeated fields become arrays", () => {
  assert.deepEqual(parseForm("a=1&b=2&a=3"), { a: ["1", "3"], b: "2" });
});

test("server: JSON form submission succeeds end to end", async () => {
  const body = new URLSearchParams({ name: "Sam", email: "sam@example.org", topic: "general", message: "Hello", _t: makeToken("s3cret", Date.now() - 5000) });
  const res = await fetch(`${base}/api/forms/contact`, { method: "POST", body, headers: { Accept: "application/json" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, message: (await import("../src/forms/definitions.ts")).buildForms([]).contact!.successMessage, redirect: "/thanks/contact/" });
  assert.equal(sent.length, 1);
});

test("server: without JavaScript, success redirects and errors render a readable page", async () => {
  const ok = new URLSearchParams({ email: "a@b.co", consent: "yes", _t: makeToken("s3cret", Date.now() - 5000) });
  const r1 = await fetch(`${base}/api/forms/updates`, { method: "POST", body: ok, redirect: "manual" });
  assert.equal(r1.status, 303);
  assert.equal(r1.headers.get("location"), "/thanks/updates/");
  const bad = new URLSearchParams({ email: "nope", _t: makeToken("s3cret", Date.now() - 5000) });
  const r2 = await fetch(`${base}/api/forms/updates`, { method: "POST", body: bad });
  assert.equal(r2.status, 422);
  const html = await r2.text();
  assert.match(html, /Some answers need checking/);
  assert.match(html, /name@example\.com/);
});

test("server: oversized submissions are refused", async () => {
  const res = await fetch(`${base}/api/forms/contact`, { method: "POST", body: "message=" + "x".repeat(40_000), headers: { Accept: "application/json" } });
  assert.equal(res.status, 413);
});
