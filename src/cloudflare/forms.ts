// Cloudflare adapter used by the Worker in src/cloudflare/worker.ts.
// Everything here uses standard Request/Response so it can be tested in Node.

import type { FormDef } from "../forms/definitions.ts";
import { handleSubmission } from "../forms/handler.ts";
import { makeToken, RateLimiter } from "../forms/spam.ts";
import { createResendSender, type Sender } from "../forms/mailer.ts";
import { noScriptResult, noScriptTitle, sameSiteBack } from "../forms/responses.ts";
import { TOKEN_PLACEHOLDER } from "../templates/forms.ts";
import type { RawFields } from "../forms/validate.ts";

/** Written by the build into src/cloudflare/_generated/site.json. */
export interface SiteData {
  forms: Record<string, FormDef>;
  contactEmail: string;
}

/** Variables and secrets set in the Cloudflare dashboard (Settings > Variables & Secrets). */
export interface PagesEnv {
  FORM_SECRET?: string;
  RESEND_API_KEY?: string;
  FORM_FROM_EMAIL?: string;
  FORM_TO_EMAIL?: string;
}

const MAX_BODY = 32 * 1024;
// One limiter per Cloudflare isolate: a soft limit. Add a Cloudflare rate-limiting
// rule on /api/forms/* for a hard one (see docs/HANDOVER.md).
const limiter = new RateLimiter();

function parseForm(body: string): RawFields {
  const out: RawFields = {};
  for (const [k, v] of new URLSearchParams(body)) {
    const existing = out[k];
    if (existing === undefined) out[k] = v;
    else out[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
  }
  return out;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export interface FormPostOptions {
  send?: Sender;
  log?: (msg: string) => void;
}

/** Handles POST /api/forms/:form. */
export async function onFormPost(request: Request, env: PagesEnv, formId: string, site: SiteData, opts: FormPostOptions = {}): Promise<Response> {
  const log = opts.log ?? ((m: string) => console.log(m));
  if (!env.FORM_SECRET) {
    log("FORM_SECRET is not set; refusing form submissions.");
    return json(503, { ok: false, message: `Sorry, this form isn't switched on yet. Please email ${site.contactEmail} instead.` });
  }

  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > MAX_BODY) return json(413, { ok: false, message: "That's too much text to send in one go. Please shorten it." });
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { ok: false, message: "That's too much text to send in one go. Please shorten it." });

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const result = await handleSubmission(formId, parseForm(text), ip, {
    forms: site.forms,
    secret: env.FORM_SECRET,
    limiter,
    send: opts.send ?? createResendSender({ apiKey: env.RESEND_API_KEY, from: env.FORM_FROM_EMAIL, to: env.FORM_TO_EMAIL }),
    contactEmail: site.contactEmail,
    log,
  });

  const wantsJson = (request.headers.get("Accept") ?? "").includes("application/json");
  if (wantsJson) return json(result.status, result.body);

  if (result.body.ok && result.body.redirect) {
    return new Response(null, { status: 303, headers: { Location: result.body.redirect } });
  }
  const back = sameSiteBack(request.headers.get("Referer"), new URL(request.url).host);
  return new Response(noScriptResult(noScriptTitle(Boolean(result.body.errors)), result.body.message, result.body.errors, back), {
    status: result.status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Middleware: put a freshly signed token into every HTML page's forms. */
export async function injectFormTokens(response: Response, env: PagesEnv): Promise<Response> {
  const type = response.headers.get("Content-Type") ?? "";
  if (!type.includes("text/html")) return response;
  const html = await response.text();
  if (!html.includes(TOKEN_PLACEHOLDER)) {
    return new Response(html, response);
  }
  // Without a secret the page still renders; the form handler explains that forms are off.
  const token = env.FORM_SECRET ? await makeToken(env.FORM_SECRET) : "";
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.delete("Content-Length");
  headers.delete("ETag");
  return new Response(html.replaceAll(TOKEN_PLACEHOLDER, token), { status: response.status, statusText: response.statusText, headers });
}
