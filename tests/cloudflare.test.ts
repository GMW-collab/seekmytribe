// Tests the Cloudflare Pages adapter with standard Request/Response objects.
// (Cloudflare itself can't run here; see docs/HANDOVER.md for the first-deploy checks.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { onFormPost, injectFormTokens, type SiteData } from "../src/cloudflare/pages.ts";
import { buildForms } from "../src/forms/definitions.ts";
import { makeToken } from "../src/forms/spam.ts";
import type { OutgoingEmail } from "../src/forms/mailer.ts";
import { resolveMode } from "../src/build.ts";
import { cloudflareHeadersFile } from "../src/lib/headers.ts";

const site: SiteData = { forms: buildForms([]), contactEmail: "hello@example.org" };
const env = { FORM_SECRET: "cf-secret" };

async function post(fields: Record<string, string>, accept = "application/json", sent: OutgoingEmail[] = [], e: Record<string, string> = env) {
  const req = new Request("https://seekmytribe.com/api/forms/updates", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { Accept: accept, "CF-Connecting-IP": `10.0.0.${Math.floor(Math.random() * 250)}`, Referer: "https://seekmytribe.com/contact/" },
  });
  return onFormPost(req, e, "updates", site, { send: async (m) => { sent.push(m); return { ok: true }; }, log: () => {} });
}

test("cloudflare: a valid JSON submission is sent", async () => {
  const sent: OutgoingEmail[] = [];
  const res = await post({ email: "a@b.co", consent: "yes", _t: await makeToken("cf-secret", Date.now() - 5000) }, "application/json", sent);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).redirect, "/thanks/updates/");
  assert.equal(sent.length, 1);
});

test("cloudflare: without JavaScript, success redirects and errors render a page linking back", async () => {
  const ok = await post({ email: "a@b.co", consent: "yes", _t: await makeToken("cf-secret", Date.now() - 5000) }, "text/html");
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("Location"), "/thanks/updates/");
  const bad = await post({ email: "nope", _t: await makeToken("cf-secret", Date.now() - 5000) }, "text/html");
  assert.equal(bad.status, 422);
  const html = await bad.text();
  assert.match(html, /Some answers need checking/);
  assert.match(html, /href="\/contact\/"/);
});

test("cloudflare: forms refuse politely when FORM_SECRET is missing", async () => {
  const res = await post({ email: "a@b.co" }, "application/json", [], {});
  assert.equal(res.status, 503);
  assert.match((await res.json()).message, /hello@example\.org/);
});

test("cloudflare: middleware injects a token into HTML only", async () => {
  const page = new Response('<input name="_t" value="__FORM_TOKEN__">', { headers: { "Content-Type": "text/html; charset=utf-8" } });
  const out = await (await injectFormTokens(page, env)).text();
  assert.match(out, /value="\d+\.[\w-]+"/);
  const css = new Response("__FORM_TOKEN__", { headers: { "Content-Type": "text/css" } });
  assert.equal(await (await injectFormTokens(css, env)).text(), "__FORM_TOKEN__");
});

test("cloudflare: main builds production, other branches build review copies", () => {
  assert.equal(resolveMode({ CF_PAGES: "1", CF_PAGES_BRANCH: "main" }), "production");
  assert.equal(resolveMode({ CF_PAGES: "1", CF_PAGES_BRANCH: "redesign" }), "preview");
  assert.equal(resolveMode({ CF_PAGES: "1", CF_PAGES_BRANCH: "main", SITE_MODE: "preview" }), "preview");
  assert.equal(resolveMode({}), "preview");
});

test("cloudflare: _headers file gives /admin/ its own CSP instead of two", () => {
  const file = cloudflareHeadersFile("self");
  assert.match(file, /\/admin\/\*\n {2}! Content-Security-Policy\n {2}Content-Security-Policy: .*unpkg/);
});
