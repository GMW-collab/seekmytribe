// Builds the static site into /dist.
//
//   npm run build:preview     review copy: shows "To confirm" flags and drafts, not indexed by search engines
//   npm run build:production  public site: refuses to build while launch-critical facts are unverified

import { mkdirSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, ContentError } from "./lib/content.ts";
import { assertLaunchReady, listUnverified, type SiteMode } from "./lib/facts.ts";
import { buildForms } from "./forms/definitions.ts";
import type { Ctx, Page } from "./templates/context.ts";
import { layout } from "./templates/layout.ts";
import { cloudflareHeadersFile } from "./lib/headers.ts";
import * as P from "./templates/pages/participants.ts";
import * as O from "./templates/pages/organisation.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface BuildOptions {
  mode: SiteMode;
  siteUrl: string;
  fontSource: "self" | "google";
  contentDir?: string;
  outDir?: string;
  /** Where to write the data the Cloudflare Worker imports. Set to null to skip. */
  functionsDataDir?: string | null;
  builtAt?: Date;
  quiet?: boolean;
}

export function collectPages(ctx: Ctx): Page[] {
  const pages: Page[] = [
    P.homePage(ctx),
    P.activitiesPage(ctx),
    P.registerInterestPage(ctx),
    ...P.upcomingActivities(ctx).map((a) => P.activityPage(ctx, a)),
    P.howItWorksPage(ctx),
    P.getInvolvedPage(ctx),
    P.suggestPage(ctx),
    P.resourcesPage(ctx),
    ...ctx.content.articles.map((a) => P.articlePage(ctx, a.slug)),
    P.faqsPage(ctx),
    P.contactPage(ctx),
    O.aboutPage(ctx),
    O.impactPage(ctx),
    O.partnersPage(ctx),
    ...O.visibleProgrammes(ctx).map((p) => O.programmePage(ctx, p)),
    O.overviewPage(ctx),
    O.donatePage(ctx),
    O.donateThanksPage(ctx),
    ...ctx.content.policies.map((p) => P.policyPage(ctx, p.slug)),
    ...Object.keys(ctx.forms).map((id) => P.thanksPage(ctx, id)),
    P.notFoundPage(ctx),
  ];
  const seen = new Set<string>();
  for (const p of pages) {
    if (seen.has(p.path)) throw new Error(`Two pages share the address ${p.path}`);
    seen.add(p.path);
  }
  return pages;
}

function outputPath(outDir: string, path: string): string {
  if (path.endsWith(".html")) return join(outDir, path);
  return join(outDir, path, "index.html");
}

function sitemap(ctx: Ctx, pages: Page[]): string {
  const urls = pages
    .filter((p) => !p.noindex && !p.path.startsWith("/thanks/") && p.path !== "/404.html")
    .map((p) => `  <url><loc>${ctx.siteUrl}${p.path}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robots(ctx: Ctx): string {
  if (ctx.mode === "preview") return "# Review copy: not for search engines.\nUser-agent: *\nDisallow: /\n";
  return `User-agent: *\nDisallow: /api/\nDisallow: /thanks/\nDisallow: /admin/\n\nSitemap: ${ctx.siteUrl}/sitemap.xml\n`;
}

export function build(opts: BuildOptions): { pages: Page[]; outDir: string } {
  const contentDir = opts.contentDir ?? join(ROOT, "content");
  const outDir = opts.outDir ?? join(ROOT, "dist");
  const content = loadContent(contentDir);

  if (opts.mode === "production") assertLaunchReady(content.organisation, content.settings);

  const ctx: Ctx = {
    mode: opts.mode,
    siteUrl: opts.siteUrl.replace(/\/$/, ""),
    fontSource: opts.fontSource,
    content,
    forms: buildForms(content.categories),
    builtAt: opts.builtAt ?? new Date(),
  };

  const pages = collectPages(ctx);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(ROOT, "public"), outDir, { recursive: true, filter: (src) => !src.endsWith(".gitkeep") });

  for (const page of pages) {
    const file = outputPath(outDir, page.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, layout(ctx, page));
  }

  // Data for the activity filters.
  const activities = P.upcomingActivities(ctx).map((a) => ({
    slug: a.slug,
    url: `/activities/${a.slug}/`,
    title: a.title,
    summary: a.summary,
    category: a.category,
    categoryName: content.categories.find((c) => c.id === a.category)?.name ?? a.category,
    area: a.area,
    starts: a.starts,
    ends: a.ends,
    repeats: a.repeats,
    costType: a.cost.type,
    status: a.status,
    accessTags: a.access_tags,
  }));
  writeFileSync(join(outDir, "activities.json"), JSON.stringify(activities));
  writeFileSync(join(outDir, "sitemap.xml"), sitemap(ctx, pages));
  writeFileSync(join(outDir, "robots.txt"), robots(ctx));
  writeFileSync(join(outDir, "_headers"), cloudflareHeadersFile(ctx.fontSource));

  // Data for the Cloudflare Worker (src/cloudflare/worker.ts).
  const functionsDataDir = opts.functionsDataDir === undefined ? join(ROOT, "src", "cloudflare", "_generated") : opts.functionsDataDir;
  if (functionsDataDir) {
    mkdirSync(functionsDataDir, { recursive: true });
    writeFileSync(join(functionsDataDir, "site.json"), JSON.stringify({ forms: ctx.forms, contactEmail: content.organisation.email.value }, null, 1));
  }

  if (!opts.quiet) {
    console.log(`Built ${pages.length} pages in ${opts.mode} mode → ${outDir}`);
    const unverified = listUnverified(content.organisation, content.settings);
    if (unverified.length && opts.mode === "preview") {
      console.log(`\n${unverified.length} facts still to confirm (shown highlighted in the review copy):`);
      unverified.forEach((f) => console.log(`  ${f.launch ? "[launch]" : "        "} ${f.key}: ${f.source}`));
    }
  }
  return { pages, outDir };
}

// Run when called directly: node src/build.ts
/**
 * Decide the mode. SITE_MODE wins if set. On Cloudflare Workers Builds, the site
 * builds as a review copy until SITE_MODE=production is added as a build
 * variable (do that once the launch facts are verified). On Cloudflare Pages,
 * the "main" branch builds the public site and other branches build review copies.
 */
export function resolveMode(env: NodeJS.ProcessEnv): SiteMode {
  if (env.SITE_MODE === "production" || env.SITE_MODE === "preview") return env.SITE_MODE;
  if (env.CF_PAGES === "1") return env.CF_PAGES_BRANCH === "main" ? "production" : "preview";
  return "preview";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = resolveMode(process.env);
  const cfPreviewUrl = process.env.CF_PAGES === "1" && mode === "preview" ? process.env.CF_PAGES_URL : undefined;
  try {
    build({
      mode,
      siteUrl: cfPreviewUrl || process.env.SITE_URL || "https://seekmytribe.com",
      fontSource: process.env.FONT_SOURCE === "google" ? "google" : "self",
    });
  } catch (err) {
    if (err instanceof ContentError || (err as Error).message.startsWith("Production build stopped")) {
      console.error(`\n${(err as Error).message}\n`);
      process.exit(1);
    }
    throw err;
  }
}
