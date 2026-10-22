import type { SiteContent } from "../lib/content.ts";
import type { FormDef } from "../forms/definitions.ts";
import type { SiteMode } from "../lib/facts.ts";
import type { SafeHtml } from "../lib/html.ts";

export interface Ctx {
  mode: SiteMode;
  siteUrl: string;
  fontSource: "self" | "google";
  content: SiteContent;
  forms: Record<string, FormDef>;
  /** Build date, used for "last updated" and to decide which activities are past. */
  builtAt: Date;
}

export interface Page {
  /** URL path, always starting and ending with "/" (or "/404.html"). */
  path: string;
  title: string;
  description: string;
  body: SafeHtml;
  /** Which top-level nav item to mark as current. */
  section?: string;
  jsonLd?: object;
  noindex?: boolean;
  scripts?: string[];
  ogType?: "website" | "article";
}
