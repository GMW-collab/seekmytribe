import { html, raw, type SafeHtml } from "../../lib/html.ts";
import { fact, editorNote, showable } from "../../lib/facts.ts";
import type { ImpactMeasure, Programme } from "../../lib/content.ts";
import type { Ctx, Page } from "../context.ts";
import { pageHeader, programmeStatus, ctaBand } from "../components.ts";
import { renderForm } from "../forms.ts";

/** Programmes the public may see in this mode. Drafts appear only in preview. */
export function visibleProgrammes(ctx: Ctx): Programme[] {
  return ctx.content.programmes.filter((p) => p.status !== "draft" || ctx.mode === "preview");
}

function directorsList(ctx: Ctx): SafeHtml {
  const d = ctx.content.organisation.directors;
  if (!showable(d, ctx)) return raw("");
  return html`<ul class="people">${d.value.map((p) => html`<li>${d.verified ? html`<strong>${p.name}</strong>` : fact({ ...d, value: p.name }, ctx)}<br><span class="small">${p.role}</span></li>`)}</ul>`;
}

function companyDetails(ctx: Ctx): SafeHtml {
  const o = ctx.content.organisation;
  const row = (label: string, f: typeof o.legal_name) => (showable(f, ctx) ? html`<dt>${label}</dt><dd>${fact(f, ctx)}</dd>` : raw(""));
  return html`<dl class="facts-list">
    ${row("Registered name", o.legal_name)}
    ${row("Legal form", o.legal_form)}
    ${row("Company number", o.company_number)}
    ${row("Registered in", o.jurisdiction)}
    ${row("Registered office", o.registered_office)}
    ${row("Incorporated", o.incorporated)}
    ${row("Where we work", o.area)}
  </dl>`;
}

// ---------------------------------------------------------------- About

export function aboutPage(ctx: Ctx): Page {
  const o = ctx.content.organisation;
  const body = html`${pageHeader("About Seek My Tribe", "We're a community interest company creating real-world opportunities for people to meet, do things together and learn from one another.")}
<div class="wrap section split">
  <div class="prose">
    <h2>What we're trying to change</h2>
    <p>Plenty of people would like more contact with others but find it hard to come by. Moving somewhere new, retiring, losing a partner, becoming a carer or working from home can all shrink the number of people we see. And many of the places where people used to meet without trying have become fewer.</p>
    <p>Feeling lonely is common and it isn't anyone's fault. It's also not something you can fix by being told to "get out more". What helps is having somewhere to go, a reason to be there, and someone who's glad you came.</p>
    <h2>Our approach</h2>
    <p>We organise small, regular activities built around something to do together. A shared task gives people something to talk about, or a reason to be comfortable not talking. Every activity has a host whose job is to welcome newcomers.</p>
    <p>Real-world contact matters to us. Online groups have their place, but we focus on bringing people into the same room, park or kitchen, because that's where many lasting friendships start.</p>
    ${editorNote("Add the founders' own account of why Seek My Tribe was started, in their words. Don't invent one.", ctx)}
  </div>
  <div>
    <h2>What we believe</h2>
    <ul class="principles">
      <li><h3>Everyone is welcome</h3><p>You don't need confidence, experience, money or a smartphone to take part.</p></li>
      <li><h3>Communities know best</h3><p>Participants suggest, shape and lead activities. We follow demand rather than guess at it.</p></li>
      <li><h3>Do, then talk</h3><p>Shared activities come first; conversation follows naturally.</p></li>
      <li><h3>Learn honestly</h3><p>We measure what we do, publish what we find — including what didn't work — and change accordingly.</p></li>
      <li><h3>Spend carefully</h3><p>Every pound we receive should reach the community as directly as possible.</p></li>
    </ul>
  </div>
</div>
<section class="section section--tinted">
  <div class="wrap split">
    <div>
      <h2>Governance and accountability</h2>
      <p>Seek My Tribe is ${showable(o.legal_form, ctx) ? fact(o.legal_form, ctx) : raw("a community interest company")}. CICs are regulated by the Office of the Regulator of Community Interest Companies and must report each year on how they've benefited the community.</p>
      ${showable(o.asset_lock, ctx) ? html`<p>${fact(o.asset_lock, ctx)}</p>` : raw("")}
      <p>${fact(o.charity_status, ctx)}</p>
      ${showable(o.community_interest_statement, ctx) ? html`<h3>Our community interest statement</h3><blockquote class="statement">${fact(o.community_interest_statement, ctx)}</blockquote>` : raw("")}
    </div>
    <div>
      <h2>Directors</h2>
      ${directorsList(ctx)}
      <h2>Company details</h2>
      ${companyDetails(ctx)}
    </div>
  </div>
</section>
${ctaBand("Work with us", "We're looking for venues, partners and funders who share our aims.", [
    { href: "/partners/", label: "Partners and funders" },
    { href: "/impact/", label: "How we measure impact", quiet: true },
  ])}`;
  return {
    path: "/about/",
    title: "About us",
    description: "Seek My Tribe is a community interest company creating welcoming real-world activities to reduce loneliness and isolation.",
    body,
    section: "about",
  };
}

// ---------------------------------------------------------------- Impact

const KIND_TEXT = {
  output: { title: "What we do", text: "Things we count directly: sessions run, people taking part, volunteers involved." },
  outcome: { title: "What changes for people", text: "What participants tell us, anonymously and only if they choose to." },
  impact: { title: "Longer-term change", text: "Lasting effects in the community. We'll only claim these with strong evidence." },
} as const;

function measureRow(m: ImpactMeasure): SafeHtml {
  return html`<li class="measure">
    <div class="measure__head">
      <h4>${m.name}</h4>
      ${m.results.length
        ? html`<p class="measure__value">${m.results[m.results.length - 1]!.value}<span class="small"> ${m.results[m.results.length - 1]!.period}</span></p>`
        : html`<p class="measure__value measure__value--none">No results yet</p>`}
    </div>
    <p><strong>What it means:</strong> ${m.definition}</p>
    <p class="small"><strong>How we collect it:</strong> ${m.method}</p>
    ${m.results.length > 1 ? html`<details><summary>Earlier results</summary><ul>${m.results.slice(0, -1).map((r) => html`<li>${r.period}: ${r.value}${r.note ? ` (${r.note})` : ""}</li>`)}</ul></details>` : raw("")}
  </li>`;
}

export function impactPage(ctx: Ctx): Page {
  const { impact } = ctx.content;
  const any = impact.measures.some((m) => m.results.length);
  const body = html`${pageHeader("Our impact", "What we'll measure, how we'll measure it, and — once we have them — the results.")}
<div class="wrap section">
  ${!any ? html`<div class="notice"><p><strong>No results yet.</strong> ${impact.reporting_period_note}</p></div>` : raw("")}
  <p class="section__intro">We keep three kinds of evidence separate, so it's always clear what we know and how we know it. Attending an activity won't automatically make anyone less lonely, and we won't pretend it does.</p>
  ${(["output", "outcome", "impact"] as const).map((k) => html`<section class="measure-group">
    <div class="measure-group__intro">
      <h2>${KIND_TEXT[k].title}</h2>
      <p>${KIND_TEXT[k].text}</p>
    </div>
    <ul class="measures">${impact.measures.filter((m) => m.kind === k).map(measureRow)}</ul>
  </section>`)}
</div>
<section class="section section--tinted">
  <div class="wrap split">
    <div>
      <h2>How we handle the information</h2>
      <p>Feedback is optional and anonymous. We only publish figures for groups large enough that no individual can be identified, and we never publish anyone's story without their written consent.</p>
    </div>
    <div>
      <h2>Learning, not just reporting</h2>
      <p>After each pilot we'll hold a review with participants about what worked and what didn't, and publish a short summary here.</p>
    </div>
  </div>
</section>`;
  return {
    path: "/impact/",
    title: "Our impact",
    description: "How Seek My Tribe measures its activities and their effect on participants, with definitions, methods and published results.",
    body,
    section: "about",
  };
}

// ---------------------------------------------------------------- Partners & funders

export function partnersPage(ctx: Ctx): Page {
  const progs = visibleProgrammes(ctx);
  const body = html`${pageHeader("Partners and funders", "We're building a community organisation that does a few things well and can show what difference they make. Here's what we're aiming for and how you could help.")}
<nav class="wrap jump-links" aria-label="On this page">
  <ul>
    <li><a href="#mission">Mission and need</a></li>
    <li><a href="#programmes">Programmes</a></li>
    <li><a href="#evaluation">Evaluation</a></li>
    <li><a href="#governance">Governance</a></li>
    <li><a href="#ways">Ways to support</a></li>
    <li><a href="#enquiry">Get in touch</a></li>
  </ul>
</nav>

<section class="section" id="mission">
  <div class="wrap split">
    <div>
      <h2>Our mission and the need</h2>
      <p>We help reduce loneliness and social isolation by creating welcoming opportunities for people to meet, take part in shared activities and learn from one another in person.</p>
      ${editorNote("Add local evidence of need here: sourced figures for the area you'll work in (e.g. ONS loneliness data, local authority JSNA findings) and what residents have told you through the suggestion form.", ctx)}
      <h3>Who we aim to serve</h3>
      <p>Adults who want more social contact, with particular attention to people new to an area, living alone, going through life transitions, or out of practice at meeting others. Activities are open to all, with no referral needed, and designed to be accessible and low-cost.</p>
    </div>
    <div class="tinted-panel">
      <h3>Where we are now</h3>
      <p>We're at an early stage. We haven't yet run activities or received grant funding, and we say so plainly. What we can offer partners is a clear focus, a measurement framework designed from the start, and a willingness to build programmes with the communities and organisations we work with.</p>
      <p><a href="/partners/overview/">Organisational overview (printable)</a></p>
    </div>
  </div>
</section>

<section class="section section--tinted" id="programmes">
  <div class="wrap">
    <h2>Programmes</h2>
    <p class="section__intro">Each programme sets out the problem, who it's for, what we'll do, what we expect to change and how we'll know.</p>
    ${progs.length
      ? html`<ul class="programme-list">${progs.map((p) => html`<li>
          <h3><a href="/partners/programmes/${p.slug}/">${p.title}</a></h3>
          ${programmeStatus(p)}
          <p>${p.summary}</p>
        </li>`)}</ul>`
      : html`<p>We'll publish programme outlines here as they're developed with partners. <a href="#enquiry">Talk to us</a> if you'd like to shape one.</p>`}
    <h3>How we co-design</h3>
    <p>Programmes start from what people tell us they want, through our <a href="/suggest/">suggestion form</a> and conversations with local groups. We pilot small, review with participants, then grow what works.</p>
  </div>
</section>

<section class="section" id="evaluation">
  <div class="wrap split">
    <div>
      <h2>Outputs, outcomes and evaluation</h2>
      <p>We separate what we deliver (outputs), what participants report (outcomes) and longer-term change (impact), and we define each measure before we start. Our measures include sessions delivered, unique and returning participants, reported sense of belonging, new connections, and change in reported loneliness using the ONS-recommended question.</p>
      <p><a href="/impact/">See the full measurement framework</a></p>
    </div>
    <div>
      <h2>Funding principles</h2>
      <ul>
        <li>We only accept funding that fits our mission and that we can deliver well.</li>
        <li>We cost programmes honestly, including the time it takes to evaluate and manage them.</li>
        <li>We report back to funders on what we said we'd do, including what didn't go to plan.</li>
        <li>We never describe a funder as endorsing us, or a project as funded, until it's confirmed in writing.</li>
      </ul>
    </div>
  </div>
</section>

<section class="section section--tinted" id="governance">
  <div class="wrap split">
    <div>
      <h2>Governance and accountability</h2>
      <p>We're a community interest company, regulated by the CIC Regulator, with an asset lock that keeps our assets working for the community. We file annual accounts and a community interest report.</p>
      <p>${fact(ctx.content.organisation.charity_status, ctx)}</p>
      <p><a href="/about/#main">Directors and company details</a></p>
    </div>
    <div>
      <h2>Policies</h2>
      <ul>
        <li><a href="/safeguarding/">Safeguarding</a></li>
        <li><a href="/privacy/">Privacy and data protection</a></li>
        <li><a href="/accessibility/">Accessibility</a></li>
        <li><a href="/participation-guidelines/">Participation guidelines</a></li>
        <li><a href="/complaints/">Feedback and complaints</a></li>
      </ul>
      ${editorNote("Add equality, diversity and inclusion, health and safety, and financial controls policies once adopted. Funders commonly ask for these.", ctx)}
    </div>
  </div>
</section>

<section class="section" id="ways">
  <div class="wrap">
    <h2>Ways to support</h2>
    <ul class="ways-grid">
      <li><h3>Core funding</h3><p>Helps us cover the essentials — coordination, insurance, safeguarding, evaluation — that every activity depends on.</p></li>
      <li><h3>Programme funding</h3><p>Funds a specific programme, with agreed outputs, outcomes and reporting.</p></li>
      <li><h3>Venues</h3><p>A room, hall, garden or café space for a regular small group.</p></li>
      <li><h3>Delivery partnerships</h3><p>Running activities together, or bringing our approach to your members or residents.</p></li>
      <li><h3>Referral partnerships</h3><p>Pointing people towards activities: GP surgeries, social prescribers, housing providers, libraries.</p></li>
      <li><h3>In-kind and sponsorship</h3><p>Materials, food, printing, professional skills or employee volunteering.</p></li>
    </ul>
    <p class="small">CICs can't register as charities, so donations to us aren't eligible for Gift Aid. Some grant programmes are open only to charities; we'll always check eligibility before applying.</p>
  </div>
</section>

<section class="section section--tinted" id="enquiry">
  <div class="wrap split split--form">
    <div>
      <h2>Get in touch</h2>
      <p>Tell us a little about your organisation and what you have in mind. A director will reply within five working days.</p>
      ${renderForm(ctx, "partner")}
    </div>
  </div>
</section>`;
  return {
    path: "/partners/",
    title: "Partners and funders",
    description: "For funders, venues, local authorities and delivery partners: Seek My Tribe's mission, programmes, evaluation approach and governance.",
    body,
    section: "partners",
  };
}

function listOrNote(items: string[], empty: string): SafeHtml {
  return items.length ? html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>` : html`<p>${empty}</p>`;
}

export function programmePage(ctx: Ctx, p: Programme): Page {
  const body = html`<article>
  <header class="page-header"><div class="wrap">
    <p class="breadcrumb"><a href="/partners/#programmes">Partners and funders</a></p>
    <h1>${p.title}</h1>
    <p class="lede">${p.summary}</p>
    ${programmeStatus(p)}
  </div></header>
  <div class="wrap section programme">
    ${p.status === "draft" ? editorNote("Draft programmes are hidden from the public site. Change status to \"proposed\" when it's ready to share.", ctx) : raw("")}
    <dl class="programme__grid">
      <div><dt>The problem</dt><dd>${p.problem}</dd></div>
      <div><dt>Who it's for</dt><dd>${p.participants}</dd></div>
      <div><dt>What we'll do</dt><dd>${listOrNote(p.activities, "To be developed.")}</dd></div>
      <div><dt>What we'll count (outputs)</dt><dd>${listOrNote(p.outputs, "To be defined.")}</dd></div>
      <div><dt>What we hope will change (outcomes)</dt><dd>${listOrNote(p.outcomes, "To be defined.")}</dd></div>
      <div><dt>Delivery plan</dt><dd>${p.delivery || "To be developed."}</dd></div>
      <div><dt>How we'll evaluate it</dt><dd>${p.evaluation || "To be developed."}</dd></div>
      <div><dt>Indicative budget</dt><dd>${p.budget || "Not yet costed."}</dd></div>
      <div><dt>Funding sought</dt><dd>${p.funding_sought || "To be confirmed."}</dd></div>
      <div><dt>Area</dt><dd>${p.area || "To be confirmed."}</dd></div>
      <div><dt>Partners</dt><dd>${listOrNote(p.partners, "None confirmed yet.")}</dd></div>
      ${p.funders.length ? html`<div><dt>Funded by</dt><dd>${listOrNote(p.funders, "")}</dd></div>` : raw("")}
    </dl>
    ${p.bodyHtml.trim() ? html`<div class="prose">${raw(p.bodyHtml)}</div>` : raw("")}
    <p><a class="button" href="/partners/#enquiry">Talk to us about this programme</a></p>
  </div>
</article>`;
  return {
    path: `/partners/programmes/${p.slug}/`,
    title: p.title,
    description: p.summary,
    body,
    section: "partners",
    noindex: p.status === "draft",
  };
}

export function overviewPage(ctx: Ctx): Page {
  const o = ctx.content.organisation;
  const progs = visibleProgrammes(ctx).filter((p) => p.status !== "draft" || ctx.mode === "preview");
  const outputs = ctx.content.impact.measures.filter((m) => m.kind !== "impact");
  const body = html`<div class="wrap section overview">
  <ul class="no-print action-list">
    <li><button class="button" type="button" data-print hidden>Print or save as PDF</button></li>
    <li><a class="button button--quiet" href="/partners/">Back to partners and funders</a></li>
  </ul>
  <h1>${o.name.value}: organisational overview</h1>
  <p class="small">Prepared ${ctx.builtAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Facts on this page come from our maintained records.</p>
  <h2>Who we are</h2>
  ${companyDetails(ctx)}
  <h2>Purpose</h2>
  <p>${showable(o.community_interest_statement, ctx) ? fact(o.community_interest_statement, ctx) : raw("We help reduce loneliness and isolation through welcoming real-world activities.")}</p>
  <h2>Current status</h2>
  <p>Early-stage. No activities delivered and no grant funding received to date.</p>
  ${editorNote("Update this line as soon as anything changes.", ctx)}
  <h2>Approach</h2>
  <p>Small, regular, hosted group activities built around shared tasks — meals, walks, making, learning — open to all adults, designed for accessibility and low cost, and shaped by participants' suggestions.</p>
  <h2>Programmes</h2>
  ${progs.length ? html`<ul>${progs.map((p) => html`<li><strong>${p.title}</strong> (${p.status}): ${p.summary}</li>`)}</ul>` : html`<p>In development.</p>`}
  <h2>How we'll measure success</h2>
  <ul>${outputs.map((m) => html`<li><strong>${m.name}:</strong> ${m.definition}</li>`)}</ul>
  <h2>Governance</h2>
  ${directorsList(ctx)}
  <p>${fact(o.charity_status, ctx)}</p>
  <h2>Contact</h2>
  <p>${showable(o.email, ctx) ? html`Email: ${fact(o.email, ctx)}<br>` : raw("")}Website: ${ctx.siteUrl.replace(/^https?:\/\//, "")}</p>
</div>`;
  return {
    path: "/partners/overview/",
    title: "Organisational overview",
    description: "A one-page printable overview of Seek My Tribe for funders and partners.",
    body,
    section: "partners",
  };
}
