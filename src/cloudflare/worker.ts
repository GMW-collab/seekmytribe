// The Cloudflare Worker that serves the site.
//
// Static pages, CSS, scripts and images are uploaded as Worker static assets
// (the dist/ folder). This Worker runs in front of them to:
//   - handle form posts at /api/forms/:form
//   - put a fresh spam-protection token into each page's forms
//   - add security headers to every response
//
// Configuration lives in wrangler.toml; secrets are set in the Cloudflare dashboard.

import { onFormPost, injectFormTokens, type PagesEnv, type SiteData } from "./forms.ts";
import { securityHeaders } from "../lib/headers.ts";
// Written by the build (npm run build:cloudflare). Not committed.
import site from "./_generated/site.json" with { type: "json" };

export interface Env extends PagesEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const FORM_PATH = /^\/api\/forms\/([a-z-]+)\/?$/;

/** Copy a response so its headers can be changed, then add security and cache headers. */
export function withHeaders(response: Response, pathname: string): Response {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(securityHeaders("self", pathname))) out.headers.set(k, v);
  if (pathname.startsWith("/admin/")) out.headers.set("X-Robots-Tag", "noindex");
  if (pathname.startsWith("/fonts/")) out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return out;
}

export async function handleRequest(request: Request, env: Env, data: SiteData = site as SiteData): Promise<Response> {
  const url = new URL(request.url);
  const form = FORM_PATH.exec(url.pathname);

  let response: Response;
  if (form) {
    response = request.method === "POST"
      ? await onFormPost(request, env, form[1]!, data)
      : new Response(null, { status: 405, headers: { Allow: "POST" } });
  } else if (url.pathname === "/healthz") {
    const email = env.RESEND_API_KEY && env.FORM_TO_EMAIL && env.FORM_FROM_EMAIL ? "configured" : "not-configured";
    response = Response.json({ ok: true, forms: env.FORM_SECRET ? "on" : "off", email });
  } else {
    response = await injectFormTokens(await env.ASSETS.fetch(request), env);
  }
  return withHeaders(response, url.pathname);
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
