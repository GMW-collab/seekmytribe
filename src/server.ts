// Production server: serves /dist and handles form submissions.
// No framework, no database. Run with: npm start  (after npm run build:*)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { loadContent } from "./lib/content.ts";
import { buildForms } from "./forms/definitions.ts";
import { handleSubmission, type HandlerDeps } from "./forms/handler.ts";
import { makeToken, RateLimiter } from "./forms/spam.ts";
import { createResendSender, mailConfigFromEnv, isMailConfigured, type Sender } from "./forms/mailer.ts";
import { TOKEN_PLACEHOLDER } from "./templates/forms.ts";
import { escapeHtml } from "./lib/html.ts";
import type { RawFields } from "./forms/validate.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
};

export function securityHeaders(fontSource: "self" | "google", path = "/"): Record<string, string> {
  const fontCss = fontSource === "google" ? " https://fonts.googleapis.com" : "";
  const fontSrc = fontSource === "google" ? " https://fonts.gstatic.com" : "";
  // The CMS at /admin/ loads its editor from unpkg and talks to GitHub, so it gets its own policy.
  const csp = path.startsWith("/admin/")
    ? "default-src 'self'; script-src 'self' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https:; connect-src 'self' https://api.github.com https://unpkg.com; frame-ancestors 'none'"
    : `default-src 'self'; script-src 'self'; style-src 'self'${fontCss}; font-src 'self'${fontSrc}; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'`;
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

/** Resolve a URL path to a file inside dist, or null if it would escape it. */
export function resolveStaticPath(distDir: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = normalize(join(distDir, decoded));
  if (target !== distDir && !target.startsWith(distDir + sep)) return null;
  return target;
}

async function readBody(req: IncomingMessage, limit = 32 * 1024): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("too-large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseForm(body: string): RawFields {
  const out: RawFields = {};
  for (const [k, v] of new URLSearchParams(body)) {
    const existing = out[k];
    if (existing === undefined) out[k] = v;
    else out[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
  }
  return out;
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers["x-forwarded-for"];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

function noScriptResult(title: string, message: string, errors: Record<string, string> | undefined, backHref: string): string {
  const list = errors ? `<ul>${Object.values(errors).map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : "";
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | Seek My Tribe</title><link rel="stylesheet" href="/css/fonts.css"><link rel="stylesheet" href="/css/site.css"></head><body><main id="main" class="wrap section narrow"><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(message)}</p>${list}<p><a class="button" href="${escapeHtml(backHref)}">Go back to the form</a></p><p>If you use your browser's back button instead, your answers should still be there.</p></main></body></html>`;
}

/** Path of the page the form was posted from, if it was this site; otherwise the home page. */
function sameSiteBack(req: IncomingMessage): string {
  const ref = req.headers.referer;
  if (!ref) return "/";
  try {
    const u = new URL(ref);
    return u.host === req.headers.host ? u.pathname : "/";
  } catch {
    return "/";
  }
}

export interface ServerOptions {
  distDir?: string;
  contentDir?: string;
  secret?: string;
  send?: Sender;
  fontSource?: "self" | "google";
  trustProxy?: boolean;
  log?: (msg: string) => void;
}

export function createSiteServer(opts: ServerOptions = {}) {
  const distDir = resolve(opts.distDir ?? join(ROOT, "dist"));
  const content = loadContent(opts.contentDir ?? join(ROOT, "content"));
  const forms = buildForms(content.categories);
  const secret = opts.secret ?? randomBytes(32).toString("hex");
  const log = opts.log ?? ((m: string) => console.log(`[${new Date().toISOString()}] ${m}`));
  const fontSource = opts.fontSource ?? "self";
  const contactEmail = content.organisation.email.value;

  const deps: HandlerDeps = {
    forms,
    secret,
    limiter: new RateLimiter(),
    send: opts.send ?? createResendSender(mailConfigFromEnv(process.env)),
    contactEmail,
    log,
  };

  async function serveStatic(req: IncomingMessage, res: ServerResponse, urlPath: string) {
    let file = resolveStaticPath(distDir, urlPath);
    if (!file) return notFound(res);
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!urlPath.endsWith("/")) {
        res.writeHead(301, { Location: `${urlPath}/` });
        return res.end();
      }
      file = join(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) return notFound(res);

    const ext = extname(file);
    const headers: Record<string, string> = {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      ...securityHeaders(fontSource, urlPath),
    };
    let body: Buffer | string = await readFile(file);
    if (ext === ".html") {
      body = body.toString("utf8").replaceAll(TOKEN_PLACEHOLDER, makeToken(secret));
      headers["Cache-Control"] = "no-store";
    } else if ([".woff2", ".png", ".jpg", ".webp", ".avif", ".svg"].includes(ext)) {
      headers["Cache-Control"] = "public, max-age=604800";
    } else {
      headers["Cache-Control"] = "public, max-age=300";
    }
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  }

  async function notFound(res: ServerResponse) {
    const page = await readFile(join(distDir, "404.html"), "utf8").catch(() => "Not found");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", ...securityHeaders(fontSource) });
    res.end(page.replaceAll(TOKEN_PLACEHOLDER, makeToken(secret)));
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, email: isMailConfigured(mailConfigFromEnv(process.env)) ? "configured" : "not-configured" }));
      }

      const formMatch = /^\/api\/forms\/([a-z-]+)\/?$/.exec(url.pathname);
      if (formMatch) {
        if (req.method !== "POST") {
          res.writeHead(405, { Allow: "POST" });
          return res.end();
        }
        const wantsJson = (req.headers.accept ?? "").includes("application/json");
        let fields: RawFields;
        try {
          fields = parseForm(await readBody(req));
        } catch {
          res.writeHead(413, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, message: "That's too much text to send in one go. Please shorten it." }));
        }
        const result = await handleSubmission(formMatch[1]!, fields, clientIp(req, Boolean(opts.trustProxy)), deps);
        if (wantsJson) {
          res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          return res.end(JSON.stringify(result.body));
        }
        if (result.body.ok && result.body.redirect) {
          res.writeHead(303, { Location: result.body.redirect });
          return res.end();
        }
        res.writeHead(result.status, { "Content-Type": "text/html; charset=utf-8", ...securityHeaders(fontSource) });
        return res.end(noScriptResult(result.body.errors ? "Some answers need checking" : "Your form wasn't sent", result.body.message, result.body.errors, sameSiteBack(req)));
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" });
        return res.end();
      }
      return await serveStatic(req, res, url.pathname);
    } catch (err) {
      log(`error: ${(err as Error).stack ?? err}`);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Sorry, something went wrong on our side.");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const production = process.env.SITE_MODE === "production";
  if (production && !process.env.FORM_SECRET) {
    console.error("FORM_SECRET must be set in production (see .env.example).");
    process.exit(1);
  }
  if (!process.env.FORM_SECRET) console.warn("FORM_SECRET not set: using a temporary one. Forms opened before a restart will need reloading.");
  if (!isMailConfigured(mailConfigFromEnv(process.env))) {
    console.warn("Email delivery not configured: forms will tell visitors to email instead (see .env.example).");
  }
  const port = Number(process.env.PORT) || 8080;
  createSiteServer({
    secret: process.env.FORM_SECRET || undefined,
    fontSource: process.env.FONT_SOURCE === "google" ? "google" : "self",
    trustProxy: process.env.TRUST_PROXY === "true",
  }).listen(port, () => console.log(`Seek My Tribe running at http://localhost:${port}`));
}
