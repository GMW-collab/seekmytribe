// Mode-aware display of organisational facts.
//
// preview:    unverified facts are shown with a visible "To confirm" flag.
// production: unverified facts are left out entirely, and the build refuses to
//             run while any launch-critical fact is unverified.

import { html, raw, type SafeHtml } from "./html.ts";
import type { Fact, Organisation, SiteSettings } from "./content.ts";

export type SiteMode = "preview" | "production";

export interface FactContext {
  mode: SiteMode;
}

export function isFact(v: unknown): v is Fact<unknown> {
  return !!v && typeof v === "object" && "value" in v && "verified" in v;
}

/** Is this fact safe to show to the public in this mode? */
export function showable(f: Fact<unknown>, ctx: FactContext): boolean {
  return f.verified || ctx.mode === "preview";
}

/** Render a text fact, flagging it in preview if unverified. Returns empty in production if unverified. */
export function fact(f: Fact, ctx: FactContext): SafeHtml {
  if (!f.value) return raw("");
  if (f.verified) return html`${f.value}`;
  if (ctx.mode === "production") return raw("");
  return flagged(f.value, f.source);
}

export function flagged(text: string, why: string): SafeHtml {
  return html`<mark class="verify" title="${why}"><span class="verify__label">To confirm:</span> ${text}</mark>`;
}

/** A block-level editorial note, only rendered in preview. */
export function editorNote(text: string, ctx: FactContext): SafeHtml {
  if (ctx.mode !== "preview") return raw("");
  return html`<aside class="editor-note" role="note"><strong>Note for editors:</strong> ${text}</aside>`;
}

export interface UnverifiedFact {
  key: string;
  value: string;
  source: string;
  launch: boolean;
}

export function listUnverified(org: Organisation, settings: SiteSettings): UnverifiedFact[] {
  const out: UnverifiedFact[] = [];
  const add = (key: string, f: unknown) => {
    if (isFact(f) && !f.verified) {
      out.push({
        key,
        value: typeof f.value === "string" ? f.value : JSON.stringify(f.value),
        source: f.source,
        launch: f.launch,
      });
    }
  };
  Object.entries(org).forEach(([k, f]) => add(k, f));
  Object.entries(settings.services).forEach(([k, f]) => add(`services.${k}`, f));
  return out;
}

/** Throws if a production build is attempted with launch-critical facts unverified. */
export function assertLaunchReady(org: Organisation, settings: SiteSettings): void {
  const blocking = listUnverified(org, settings).filter((f) => f.launch);
  if (blocking.length) {
    const lines = blocking.map((f) => `  - ${f.key}: ${f.source}`).join("\n");
    throw new Error(
      `Production build stopped: these facts must be checked and marked "verified: true" first ` +
        `(content/organisation.yml and content/site.yml):\n${lines}\n\n` +
        `Use "npm run build:preview" to build a review copy in the meantime.`,
    );
  }
}
