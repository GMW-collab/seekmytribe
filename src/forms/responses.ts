// Responses shared by every host (the Node server and Cloudflare Pages Functions).

import { escapeHtml } from "../lib/html.ts";

/** A readable page for visitors whose browser didn't run JavaScript. */
export function noScriptResult(title: string, message: string, errors: Record<string, string> | undefined, backHref: string): string {
  const list = errors ? `<ul>${Object.values(errors).map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : "";
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | Seek My Tribe</title><link rel="stylesheet" href="/css/fonts.css"><link rel="stylesheet" href="/css/site.css"></head><body><main id="main" class="wrap section narrow"><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(message)}</p>${list}<p><a class="button" href="${escapeHtml(backHref)}">Go back to the form</a></p><p>If you use your browser's back button instead, your answers should still be there.</p></main></body></html>`;
}

/** Path of the page the form was posted from, if it was this site; otherwise the home page. */
export function sameSiteBack(referer: string | null | undefined, host: string | null | undefined): string {
  if (!referer) return "/";
  try {
    const u = new URL(referer);
    return u.host === host ? u.pathname : "/";
  } catch {
    return "/";
  }
}

export function noScriptTitle(hasErrors: boolean): string {
  return hasErrors ? "Some answers need checking" : "Your form wasn't sent";
}
