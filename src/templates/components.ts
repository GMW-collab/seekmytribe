import { html, raw, type SafeHtml } from "../lib/html.ts";
import type { Activity, Programme, ProgrammeStatus } from "../lib/content.ts";
import { formatWhen, COST_LABELS } from "../../public/js/activity-filter.js";
import { tableIllustration } from "./table.ts";

export function pageHeader(title: string, intro?: string | SafeHtml, extra?: SafeHtml): SafeHtml {
  return html`<header class="page-header">
    <div class="wrap">
      <h1>${title}</h1>
      ${intro ? html`<p class="lede">${intro}</p>` : raw("")}
      ${extra ?? raw("")}
    </div>
  </header>`;
}

export function costLabel(type: string): string {
  return (COST_LABELS as Record<string, string>)[type] ?? type;
}

export function whenLabel(a: Pick<Activity, "starts" | "repeats">): string {
  return formatWhen(a.starts) + (a.repeats ? ` (${a.repeats.toLowerCase()})` : "");
}

export function activityCard(a: Activity, categoryName: string): SafeHtml {
  return html`<article class="activity-card">
    <p class="activity-card__when"><time datetime="${a.starts}">${formatWhen(a.starts)}</time>${a.repeats ? html`<span>${a.repeats}</span>` : raw("")}</p>
    <h3 class="activity-card__title"><a href="/activities/${a.slug}/">${a.title}</a></h3>
    <p>${a.summary}</p>
    <ul class="tags" aria-label="Details">
      <li>${categoryName}</li>
      <li>${a.area}</li>
      <li>${costLabel(a.cost.type)}</li>
      ${a.status === "full" ? html`<li class="tag--alert">Full</li>` : raw("")}
    </ul>
  </article>`;
}

const STATUS_TEXT: Record<ProgrammeStatus, { label: string; note: string }> = {
  draft: { label: "Draft", note: "An internal working draft. Not visible on the public site." },
  proposed: { label: "Proposed", note: "An idea we are seeking funding and partners for. It is not yet running." },
  funded: { label: "Funded", note: "Funding confirmed. Delivery is being planned." },
  running: { label: "Running now", note: "This programme is taking place." },
  complete: { label: "Completed", note: "This programme has finished." },
};

export function programmeStatus(p: Programme): SafeHtml {
  const s = STATUS_TEXT[p.status];
  return html`<p class="status status--${p.status}"><strong>${s.label}.</strong> ${s.note}</p>`;
}

export function emptyActivities(): SafeHtml {
  return html`<div class="empty-state">
    ${tableIllustration({ seats: 8, emptySeat: -1, variant: "waiting", label: "A table laid for eight, with nobody seated yet.", className: "empty-state__art" })}
    <div class="empty-state__text">
      <h2>The table is laid. Activities start soon.</h2>
      <p>We haven't announced our first activities yet. Rather than fill this page with examples, we'd like to hear from you.</p>
      <ul class="action-list">
        <li><a class="button" href="/activities/register/">Tell me when something starts</a></li>
        <li><a class="button button--quiet" href="/suggest/">Suggest an activity</a></li>
      </ul>
    </div>
  </div>`;
}

export function ctaBand(title: string, text: string, links: Array<{ href: string; label: string; quiet?: boolean }>): SafeHtml {
  return html`<section class="cta-band">
    <div class="wrap cta-band__inner">
      <div>
        <h2>${title}</h2>
        <p>${text}</p>
      </div>
      <ul class="action-list">
        ${links.map((l) => html`<li><a class="button${l.quiet ? " button--quiet" : ""}" href="${l.href}">${l.label}</a></li>`)}
      </ul>
    </div>
  </section>`;
}

export function prose(content: string | SafeHtml): SafeHtml {
  return html`<div class="prose">${typeof content === "string" ? raw(content) : content}</div>`;
}
