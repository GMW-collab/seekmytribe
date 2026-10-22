import { html, raw, cx, type SafeHtml } from "../lib/html.ts";
import { fact } from "../lib/facts.ts";
import type { Ctx, Page } from "./context.ts";
import { renderForm } from "./forms.ts";

export const NAV = [
  { href: "/activities/", label: "Find an activity", section: "activities" },
  { href: "/how-it-works/", label: "How it works", section: "how" },
  { href: "/get-involved/", label: "Get involved", section: "involved" },
  { href: "/about/", label: "About us", section: "about" },
  { href: "/partners/", label: "Partners and funders", section: "partners" },
];

function logo(): SafeHtml {
  // A small open table: a circle with one marigold seat pulled out.
  return raw(
    `<svg class="logo__mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">` +
      `<circle cx="24" cy="24" r="11" fill="var(--c-green)"/>` +
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const open = i === 1;
        const r = open ? 21 : 18;
        const x = 24 + Math.cos(a) * r;
        const y = 24 + Math.sin(a) * r;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${open ? 4.6 : 3.6}" fill="${open ? "var(--c-marigold)" : "var(--c-ink)"}"/>`;
      }).join("") +
    `</svg>`,
  );
}

function fontTags(ctx: Ctx): SafeHtml {
  if (ctx.fontSource === "google") {
    return raw(
      `<link rel="preconnect" href="https://fonts.googleapis.com">` +
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap">`,
    );
  }
  return raw(`<link rel="stylesheet" href="/css/fonts.css">`);
}

function previewBanner(ctx: Ctx): SafeHtml {
  if (ctx.mode !== "preview") return raw("");
  return html`<div class="preview-banner" role="note">
    <p><strong>Review copy.</strong> Highlighted text marked “To confirm” still needs checking before launch. Forms only send once email is set up.</p>
  </div>`;
}

export function layout(ctx: Ctx, page: Page): string {
  const org = ctx.content.organisation;
  const canonical = `${ctx.siteUrl}${page.path === "/404.html" ? "/" : page.path}`;
  const fullTitle = page.path === "/" ? `${org.name.value} — meet people by doing things together` : `${page.title} | ${org.name.value}`;
  const social = ctx.content.settings.social.filter((s) => s.url);
  const scripts = ["/js/site.js", ...(page.scripts ?? [])];

  const doc = html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${page.description}">
${page.noindex || ctx.mode === "preview" ? raw(`<meta name="robots" content="noindex">`) : raw("")}
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${page.ogType ?? "website"}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${org.name.value}">
<meta property="og:locale" content="en_GB">
<meta property="og:image" content="${ctx.siteUrl}/images/social-card.png">
<meta property="og:image:alt" content="A round table seen from above, with people around it and one empty chair pulled out.">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5F6F0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${fontTags(ctx)}
<link rel="stylesheet" href="/css/site.css">
${page.jsonLd ? raw(`<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, "\\u003c")}</script>`) : raw("")}
${scripts.map((s) => raw(`<script type="module" src="${s}"></script>`))}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
${previewBanner(ctx)}
<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="logo" href="/" aria-label="${org.name.value} home">${logo()}<span class="logo__word">Seek My Tribe</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" hidden>
      <span class="nav-toggle__bars" aria-hidden="true"></span>Menu
    </button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>
        ${NAV.map((n) => html`<li><a href="${n.href}" class="${cx(page.section === n.section && "is-current")}"${page.section === n.section ? raw(' aria-current="page"') : raw("")}>${n.label}</a></li>`)}
        <li><a class="site-nav__contact${page.section === "contact" ? " is-current" : ""}" href="/contact/"${page.section === "contact" ? raw(' aria-current="page"') : raw("")}>Contact</a></li>
      </ul>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
${page.body}
</main>
<footer class="site-footer">
  <div class="wrap site-footer__grid">
    <section class="site-footer__updates" aria-labelledby="footer-updates">
      <h2 id="footer-updates">Hear when something starts near you</h2>
      <p>An occasional email when there's real news. No spam, and you can stop any time.</p>
      ${renderForm(ctx, "updates", { compact: true, idPrefix: "footer-" })}
    </section>
    <nav class="site-footer__links" aria-label="Footer">
      <h2>Take part</h2>
      <ul>
        <li><a href="/activities/">Find an activity</a></li>
        <li><a href="/suggest/">Suggest an activity</a></li>
        <li><a href="/get-involved/">Volunteer and contribute</a></li>
        <li><a href="/resources/">Guides and resources</a></li>
        <li><a href="/faqs/">Questions and answers</a></li>
      </ul>
      <h2>Organisation</h2>
      <ul>
        <li><a href="/about/">About us</a></li>
        <li><a href="/impact/">Our impact</a></li>
        <li><a href="/partners/">Partners and funders</a></li>
        <li><a href="/contact/">Contact</a></li>
      </ul>
      <h2>Policies</h2>
      <ul>
        <li><a href="/safeguarding/">Safeguarding</a></li>
        <li><a href="/participation-guidelines/">Participation guidelines</a></li>
        <li><a href="/accessibility/">Accessibility</a></li>
        <li><a href="/privacy/">Privacy</a></li>
        <li><a href="/complaints/">Feedback and complaints</a></li>
      </ul>
    </nav>
  </div>
  <div class="wrap site-footer__legal">
    <p>${fact(org.legal_name, ctx)}${org.company_number.verified || ctx.mode === "preview" ? html` is ${fact(org.legal_form, ctx)}, registered in ${fact(org.jurisdiction, ctx)}, company number ${fact(org.company_number, ctx)}. Registered office: ${fact(org.registered_office, ctx)}.` : raw("")}</p>
    <p>We are not a registered charity. Our activities are community activities, not health or therapy services.</p>
    ${social.length ? html`<ul class="site-footer__social">${social.map((s) => html`<li><a href="${s.url}" rel="me">${s.name}</a></li>`)}</ul>` : raw("")}
  </div>
</footer>
</body>
</html>
`;
  return doc.value;
}
