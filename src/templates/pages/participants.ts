import { html, raw, type SafeHtml } from "../../lib/html.ts";
import { fact, editorNote } from "../../lib/facts.ts";
import { markdown } from "../../lib/content.ts";
import type { Activity } from "../../lib/content.ts";
import { ACCESS_TAGS, formatWhen } from "../../../public/js/activity-filter.js";
import type { Ctx, Page } from "../context.ts";
import { pageHeader, activityCard, emptyActivities, ctaBand, costLabel, prose } from "../components.ts";
import { tableIllustration } from "../table.ts";
import { renderForm } from "../forms.ts";

function categoryName(ctx: Ctx, id: string): string {
  return ctx.content.categories.find((c) => c.id === id)?.name ?? id;
}

/** Activities visible on the public site: published or full, not drafts or cancelled, and not finished. */
export function upcomingActivities(ctx: Ctx): Activity[] {
  const now = ctx.builtAt.toISOString().slice(0, 16);
  return ctx.content.activities.filter((a) => (a.status === "published" || a.status === "full") && (a.ends ?? a.starts) >= now);
}

export const HOW_STEPS = [
  { title: "Look around", text: "Browse what's on, or tell us what you'd enjoy and where you live." },
  { title: "Pick something that feels right", text: "Each activity says what happens, who it's for, what it costs and what we know about access." },
  { title: "Let us know you're coming", text: "Some activities you can just turn up to. Others ask you to register so the host can expect you." },
  { title: "Come along", text: "A host will say hello and introduce you. There's always something to do, so you don't have to make small talk." },
  { title: "Come back, or help shape what's next", text: "Return as often as you like. Suggest new ideas, share a skill or help host." },
];

// ---------------------------------------------------------------- Home

export function homePage(ctx: Ctx): Page {
  const org = ctx.content.organisation;
  const upcoming = upcomingActivities(ctx).slice(0, 3);
  const cats = ctx.content.categories.filter((c) => c.id !== "other");

  const body = html`
<section class="hero">
  <div class="wrap hero__inner">
    <div class="hero__text">
      <h1>Meet people by doing something together.</h1>
      <p class="lede">Seek My Tribe creates welcoming, real-world activities — shared meals, walks, making things, learning from each other — where it's easy to turn up on your own.</p>
      <ul class="action-list">
        <li><a class="button" href="/activities/">Find an activity</a></li>
        <li><a class="button button--quiet" href="/activities/register/">Tell me when something starts</a></li>
      </ul>
    </div>
    <figure class="hero__art">
      ${tableIllustration({ seats: 8, emptySeat: 2, label: "A round table seen from above, with seven people around it and one marigold chair pulled out and empty." })}
      <figcaption>There's a seat for you.</figcaption>
    </figure>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div>
      <h2>For anyone who'd like more people in their life</h2>
      <p>You don't need to be outgoing, sporty, young or already know anyone. Most people come on their own. Our activities are especially for people who are:</p>
    </div>
    <ul class="soft-list">
      <li>new to the area</li>
      <li>living alone, or spending a lot of time alone</li>
      <li>going through a change — retirement, bereavement, a move, a break from work or caring</li>
      <li>a bit shy, or out of practice at meeting people</li>
      <li>simply curious to try something new with others</li>
    </ul>
  </div>
</section>

<section class="section section--tinted">
  <div class="wrap">
    <h2>What we're planning</h2>
    <p class="section__intro">We're starting small and growing with the people who join in. These are the kinds of activity we plan to run. Each one appears on the activities page only once it's confirmed.</p>
    <ul class="category-grid">
      ${cats.map((c) => html`<li><h3>${c.name}</h3><p>${c.description}</p></li>`)}
    </ul>
  </div>
</section>

${upcoming.length
    ? html`<section class="section">
  <div class="wrap">
    <h2>Coming up</h2>
    <div class="activity-list">${upcoming.map((a) => activityCard(a, categoryName(ctx, a.category)))}</div>
    <p><a href="/activities/">See all activities</a></p>
  </div>
</section>`
    : raw("")}

<section class="section">
  <div class="wrap">
    <h2>How it works</h2>
    <ol class="steps">
      ${HOW_STEPS.map((s) => html`<li><h3>${s.title}</h3><p>${s.text}</p></li>`)}
    </ol>
    <p><a href="/how-it-works/">More about taking part</a></p>
  </div>
</section>

<section class="section section--ink">
  <div class="wrap split">
    <div>
      <h2>Why we do this</h2>
      <p>Loneliness isn't a personal failing. It often follows ordinary life changes, and it's harder to fix when the places people used to meet have disappeared.</p>
      <p>We believe connection comes more easily with a reason to be in the same room: a meal to share, a path to walk, a skill to swap. As a community interest company, any money we make goes back into that work.</p>
      ${editorNote("Add one or two sourced statistics here, such as the latest ONS figure for adults who feel lonely often or always, with the date and a link.", ctx)}
    </div>
    <div class="ink-panel">
      <h3>For funders and partners</h3>
      <p>We're building programmes with venues, local organisations and funders. See what we're planning, how we'll measure it, and how we're governed.</p>
      <a class="button button--marigold" href="/partners/">Partners and funders</a>
    </div>
  </div>
</section>

${ctaBand("Know a space, have a skill, or want to help?", "Activities depend on people who host, share what they know and spread the word.", [
    { href: "/get-involved/", label: "Ways to get involved" },
    { href: "/suggest/", label: "Suggest an activity", quiet: true },
  ])}
`;

  return {
    path: "/",
    title: "Meet people by doing something together",
    description: `${org.name.value} creates welcoming real-world activities — shared meals, walks, making and learning — where it's easy to turn up on your own.`,
    body,
    jsonLd: ctx.content.organisation.legal_name.verified
      ? {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: org.legal_name.value,
        alternateName: org.name.value,
        url: ctx.siteUrl,
        ...(org.email.verified ? { email: org.email.value } : {}),
        ...(org.company_number.verified ? { identifier: org.company_number.value } : {}),
      }
      : undefined,
  };
}

// ---------------------------------------------------------------- Activities

export function activitiesPage(ctx: Ctx): Page {
  const list = upcomingActivities(ctx);
  const areas = [...new Set(list.map((a) => a.area))].sort();
  const usedCats = ctx.content.categories.filter((c) => list.some((a) => a.category === c.id));
  const usedTags = Object.entries(ACCESS_TAGS).filter(([t]) => list.some((a) => a.access_tags.includes(t)));

  const body = list.length === 0
    ? html`${pageHeader("Find an activity", "Small, welcoming group activities where you can meet people by doing something together.")}
      <div class="wrap section">${emptyActivities()}</div>`
    : html`${pageHeader("Find an activity", "Small, welcoming group activities where you can meet people by doing something together.")}
      <div class="wrap section activities-layout">
        <form class="filters" role="search" aria-label="Filter activities" data-filters>
          <div class="field">
            <label class="field__label" for="f-q">Search</label>
            <input type="search" id="f-q" name="q" autocomplete="off">
          </div>
          ${usedCats.length > 1 ? html`<div class="field"><label class="field__label" for="f-category">Kind of activity</label>
            <select id="f-category" name="category"><option value="">All kinds</option>${usedCats.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></div>` : raw("")}
          ${areas.length > 1 ? html`<div class="field"><label class="field__label" for="f-area">Area</label>
            <select id="f-area" name="area"><option value="">All areas</option>${areas.map((a) => html`<option value="${a}">${a}</option>`)}</select></div>` : raw("")}
          <div class="field"><label class="field__label" for="f-when">When</label>
            <select id="f-when" name="when"><option value="">Any time</option><option value="week">Next 7 days</option><option value="month">Next month</option></select></div>
          <div class="field field--consent"><div class="choice"><input type="checkbox" id="f-cost" name="cost" value="free"><label for="f-cost">Free or pay what you can</label></div></div>
          ${usedTags.length ? html`<fieldset class="field field--choices"><legend class="field__label">Access</legend><div class="choices">
            ${usedTags.map(([t, label], i) => html`<div class="choice"><input type="checkbox" id="f-access-${i}" name="access" value="${t}"><label for="f-access-${i}">${label}</label></div>`)}
          </div></fieldset>` : raw("")}
          <button class="button button--quiet" type="submit">Show activities</button>
        </form>
        <div>
          <p class="results-count" role="status" aria-live="polite" data-results-count>${list.length} ${list.length === 1 ? "activity" : "activities"}</p>
          <div class="activity-list" data-results>
            ${list.map((a) => activityCard(a, categoryName(ctx, a.category)))}
          </div>
          <div class="no-results" data-no-results hidden>
            <h2>Nothing matches those choices</h2>
            <p>Try removing a filter, or <a href="/activities/register/">tell us what you're looking for</a> and we'll let you know when something starts.</p>
          </div>
        </div>
      </div>`;

  return {
    path: "/activities/",
    title: "Find an activity",
    description: "Browse welcoming group activities from Seek My Tribe, or register your interest to hear when something starts near you.",
    body,
    section: "activities",
    scripts: list.length ? ["/js/activities.js"] : [],
  };
}

export function activityPage(ctx: Ctx, a: Activity): Page {
  const org = ctx.content.organisation;
  const contact = a.contact_email || (org.email.verified || ctx.mode === "preview" ? org.email.value : "");
  const join = {
    "just-turn-up": html`<p>No need to book — just come along. If you'd like the host to look out for you, <a href="/contact/?about=${a.slug}">send us a message</a>.</p>`,
    "register-interest": html`<p>Please let us know you're coming, so the host can expect you.</p>${renderForm(ctx, "join", { hidden: { activity: a.slug } })}`,
    "external-booking": html`<p><a class="button" href="${a.booking_url ?? "#"}" rel="noopener">Book a place</a></p><p class="small">Booking is handled on another website.</p>`,
  }[a.how_to_join];

  const body = html`
<article class="activity">
  <header class="page-header">
    <div class="wrap">
      <p class="breadcrumb"><a href="/activities/">All activities</a></p>
      <h1>${a.title}</h1>
      <p class="lede">${a.summary}</p>
      ${a.status === "full" ? html`<p class="status status--full"><strong>This activity is full.</strong> <a href="/activities/register/">Register your interest</a> to hear about the next one.</p>` : raw("")}
    </div>
  </header>
  <div class="wrap section activity__grid">
    <div class="activity__main">
      ${prose(a.descriptionHtml)}
      <h2>Getting there</h2>
      <p><strong>${a.venue.name}</strong>${a.venue.address ? html`<br>${a.venue.address}` : raw("")}</p>
      ${a.venue.directions ? html`<p>${a.venue.directions}</p>` : raw("")}
      <h2>Access</h2>
      <ul>${a.accessibility.map((x) => html`<li>${x}</li>`)}</ul>
      <p class="small">Need something else? <a href="/contact/?about=${a.slug}">Ask us before you come</a>. Carers and support workers come free.</p>
      ${a.what_to_bring ? html`<h2>What to bring</h2><p>${a.what_to_bring}</p>` : raw("")}
      ${a.guidance ? html`<h2>Good to know</h2><p>${a.guidance}</p>` : raw("")}
      <h2>How to join</h2>
      ${a.status === "full" ? html`<p>This activity is currently full.</p>` : join}
    </div>
    <aside class="activity__facts" aria-label="Key details">
      <dl>
        <dt>When</dt><dd><time datetime="${a.starts}">${formatWhen(a.starts)}</time>${a.ends ? html` to ${a.ends.slice(11)}` : raw("")}${a.repeats ? html`<br>${a.repeats}` : raw("")}</dd>
        <dt>Where</dt><dd>${a.area}</dd>
        <dt>Cost</dt><dd>${costLabel(a.cost.type)}${a.cost.details ? html`<br><span class="small">${a.cost.details}</span>` : raw("")}</dd>
        ${a.age ? html`<dt>Who it's for</dt><dd>${a.age}</dd>` : raw("")}
        ${a.capacity !== undefined ? html`<dt>Group size</dt><dd>Up to ${a.capacity}${a.places_left !== undefined ? html`, ${a.places_left} places left` : raw("")}</dd>` : raw("")}
        <dt>Kind</dt><dd>${categoryName(ctx, a.category)}</dd>
        <dt>Hosted by</dt><dd>${a.organiser}</dd>
        ${contact ? html`<dt>Questions</dt><dd><a href="mailto:${contact}">${contact}</a></dd>` : raw("")}
        ${a.cancellation ? html`<dt>If it's cancelled</dt><dd>${a.cancellation}</dd>` : raw("")}
      </dl>
      <p class="small">Everyone taking part agrees to our <a href="/participation-guidelines/">participation guidelines</a>.</p>
    </aside>
  </div>
</article>`;

  return {
    path: `/activities/${a.slug}/`,
    title: a.title,
    description: a.summary,
    body,
    section: "activities",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Event",
      name: a.title,
      description: a.summary,
      startDate: a.starts,
      ...(a.ends ? { endDate: a.ends } : {}),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: a.venue.name, address: a.venue.address ?? a.area },
      isAccessibleForFree: a.cost.type === "free",
      organizer: { "@type": "Organization", name: org.name.value, url: ctx.siteUrl },
    },
  };
}

export function registerInterestPage(ctx: Ctx): Page {
  return {
    path: "/activities/register/",
    title: "Tell me when something starts",
    description: "Register your interest and we'll email you when an activity that suits you starts nearby.",
    section: "activities",
    body: html`${pageHeader("Tell me when something starts", "Let us know where you are and what you'd enjoy. We'll email you when there's something that fits — and we'll use what you tell us to decide what to run first.")}
      <div class="wrap section narrow">${renderForm(ctx, "interest")}</div>`,
  };
}

// ---------------------------------------------------------------- How it works

export function howItWorksPage(ctx: Ctx): Page {
  const body = html`${pageHeader("How it works", "Taking part should be simple, whether you're online or not.")}
<div class="wrap section">
  <ol class="steps steps--large">
    ${HOW_STEPS.map((s) => html`<li><h2>${s.title}</h2><p>${s.text}</p></li>`)}
  </ol>
</div>
<div class="wrap section split">
  <div>
    <h2>What it costs</h2>
    <p>Each activity says clearly what it costs. We aim to keep as many activities as possible free or pay-what-you-can, and we don't want cost to stop anyone. If it would, <a href="/contact/">tell us in confidence</a>.</p>
    ${editorNote("Confirm the pricing approach (free, subsidised, pay-what-you-can) once the first programme is costed.", ctx)}
    <h2>Questions before you come</h2>
    <p>Ask us anything — access, what to expect, whether you can bring someone. Use the <a href="/contact/">contact form</a>${ctx.content.organisation.email.verified || ctx.mode === "preview" ? html` or email ${fact(ctx.content.organisation.email, ctx)}` : raw("")}.</p>
    <h2>No internet? No problem.</h2>
    <p>You don't need a smartphone or an account to take part. Ask a friend, family member or library to contact us for you, and we'll share details in whatever way suits you.</p>
  </div>
  <div class="tinted-panel">
    <h2>What we ask of everyone</h2>
    <p>Be welcoming, respect people's differences and boundaries, and look out for each other. Read our <a href="/participation-guidelines/">participation guidelines</a>.</p>
    <h2>This is community, not therapy</h2>
    <p>Our activities can be good for wellbeing, but they aren't a health service. If you're struggling, your GP is a good first step. Samaritans are there any time on 116 123.</p>
  </div>
</div>
${ctaBand("Ready to look?", "See what's on, or tell us what you'd enjoy.", [
    { href: "/activities/", label: "Find an activity" },
    { href: "/activities/register/", label: "Tell me when something starts", quiet: true },
  ])}`;
  return {
    path: "/how-it-works/",
    title: "How it works",
    description: "How to find a Seek My Tribe activity, what it costs, how to ask questions before you come and what to expect on the day.",
    body,
    section: "how",
  };
}

// ---------------------------------------------------------------- Get involved

export function getInvolvedPage(ctx: Ctx): Page {
  const ways = [
    { t: "Help at activities", d: "Set up, welcome people, make the tea, notice who's on their own." },
    { t: "Host a group", d: "Lead a regular activity, with support and training from us." },
    { t: "Share a skill", d: "Teach something you know — cooking, repairs, a language, a craft." },
    { t: "Offer a space", d: "A hall, café, garden or room that could host a small group." },
    { t: "Spread the word", d: "Put up a poster, tell a neighbour, talk to your GP surgery or library." },
    { t: "Behind the scenes", d: "Admin, design, finance, evaluation or helping with funding bids." },
  ];
  const body = html`${pageHeader("Get involved", "Every activity depends on people giving a bit of time, space or know-how. Here's how you could help.")}
<div class="wrap section">
  <ul class="ways-grid">${ways.map((w) => html`<li><h2>${w.t}</h2><p>${w.d}</p></li>`)}</ul>
  <p class="section__intro">The roles we can offer depend on the activities we're running at the time, so we may not have something for everyone straight away. We'll always reply and tell you honestly.</p>
</div>
<div class="wrap section split">
  <div>
    <h2>Offer to help</h2>
    ${renderForm(ctx, "volunteer")}
  </div>
  <div class="tinted-panel">
    <h2>Keeping everyone safe</h2>
    <p>We'll talk with you about any role before you start. Some roles need references or a DBS check, and every volunteer is briefed on our <a href="/safeguarding/">safeguarding</a> and <a href="/participation-guidelines/">participation guidelines</a>.</p>
    <p>We won't ask you to work with children or adults at risk unless the right checks, training and supervision are in place.</p>
    <h2>Got an idea rather than time?</h2>
    <p><a href="/suggest/">Suggest an activity</a>. Many of the best ones start that way.</p>
    <h2>Representing an organisation?</h2>
    <p>See <a href="/partners/">partners and funders</a>.</p>
  </div>
</div>`;
  return {
    path: "/get-involved/",
    title: "Get involved",
    description: "Volunteer, host a group, share a skill or offer a space to help Seek My Tribe bring people together.",
    body,
    section: "involved",
  };
}

export function suggestPage(ctx: Ctx): Page {
  const body = html`${pageHeader("Suggest an activity", "What would you go to if it existed? Tell us. We use every suggestion to decide what to run and where.")}
<div class="wrap section split split--form">
  <div>${renderForm(ctx, "suggest")}</div>
  <div class="tinted-panel">
    <h2>What happens to your idea</h2>
    <ol class="mini-steps">
      <li>We read every suggestion and group similar ones by area and kind.</li>
      <li>Ideas that come up often, or that someone offers to help run, move up the list.</li>
      <li>If you've asked us to, we'll let you know when something comes of it.</li>
    </ol>
    <p>We can't promise to run every idea, but none of them are ignored.</p>
  </div>
</div>`;
  return {
    path: "/suggest/",
    title: "Suggest an activity",
    description: "Suggest a community activity you'd like to see. Seek My Tribe uses every suggestion to plan what to run and where.",
    body,
    section: "involved",
  };
}

// ---------------------------------------------------------------- Resources

export function resourcesPage(ctx: Ctx): Page {
  const audience: Record<string, string> = { participants: "For anyone taking part", hosts: "For hosts and organisers" };
  const body = html`${pageHeader("Guides and resources", "Practical, plain-English guides on meeting people, welcoming newcomers and starting something local.")}
<div class="wrap section">
  <ul class="article-list">
    ${ctx.content.articles.map((a) => html`<li>
      <p class="article-list__meta">${audience[a.audience] ?? ""}</p>
      <h2><a href="/resources/${a.slug}/">${a.title}</a></h2>
      <p>${a.summary}</p>
    </li>`)}
  </ul>
  ${editorNote("Participant stories can be added here as articles, but only with written consent and the person's choice of name (or none). Never publish illustrative stories as if they were real people.", ctx)}
</div>`;
  return { path: "/resources/", title: "Guides and resources", description: "Practical guides from Seek My Tribe on going to a group for the first time, welcoming newcomers and starting a local activity.", body, section: "involved" };
}

export function articlePage(ctx: Ctx, slug: string): Page {
  const a = ctx.content.articles.find((x) => x.slug === slug)!;
  const body = html`<article>
  <header class="page-header"><div class="wrap">
    <p class="breadcrumb"><a href="/resources/">Guides and resources</a></p>
    <h1>${a.title}</h1>
    <p class="lede">${a.summary}</p>
  </div></header>
  <div class="wrap section">${prose(a.bodyHtml)}</div>
</article>
${ctaBand("Want to try it?", "Find an activity, or tell us what you'd like to see.", [
    { href: "/activities/", label: "Find an activity" },
    { href: "/suggest/", label: "Suggest an activity", quiet: true },
  ])}`;
  return { path: `/resources/${a.slug}/`, title: a.title, description: a.summary, body, section: "involved", ogType: "article" };
}

// ---------------------------------------------------------------- FAQs & contact

export function faqsPage(ctx: Ctx): Page {
  const body = html`${pageHeader("Questions and answers", "If your question isn't here, just ask.")}
<div class="wrap section narrow">
  ${ctx.content.faqs.map((g) => html`<section class="faq-group">
    <h2>${g.group}</h2>
    ${g.items.map((i) => html`<details class="faq"><summary>${i.q}</summary><div class="prose"><p>${raw(i.aHtml)}</p></div></details>`)}
  </section>`)}
  <p><a class="button" href="/contact/">Ask a question</a></p>
</div>`;
  return {
    path: "/faqs/",
    title: "Questions and answers",
    description: "Answers to common questions about taking part in Seek My Tribe activities, cost, accessibility and who we are.",
    body,
    section: "contact",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ctx.content.faqs.flatMap((g) => g.items.map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: i.aHtml.replace(/<[^>]+>/g, "") },
      }))),
    },
  };
}

export function contactPage(ctx: Ctx): Page {
  const org = ctx.content.organisation;
  const body = html`${pageHeader("Contact us", "Questions about an activity, access needs, offers of help or partnership ideas — we'd like to hear from you.")}
<div class="wrap section split split--form">
  <div>${renderForm(ctx, "contact")}</div>
  <aside class="tinted-panel">
    <h2>Other ways to reach us</h2>
    ${org.email.verified || ctx.mode === "preview" ? html`<p><strong>Email</strong><br><a href="mailto:${org.email.value}">${fact(org.email, ctx)}</a></p>` : raw("")}
    ${org.phone.value && (org.phone.verified || ctx.mode === "preview") ? html`<p><strong>Phone</strong><br>${fact(org.phone, ctx)}</p>` : raw("")}
    ${org.postal_address.value && (org.postal_address.verified || ctx.mode === "preview") ? html`<p><strong>Post</strong><br>${fact(org.postal_address, ctx)}</p>` : raw("")}
    ${editorNote("Add a phone number and postal address in content/organisation.yml if someone can respond to them. Not everyone can use email.", ctx)}
    <p>We usually reply within a few working days.</p>
    <h2>Quick links</h2>
    <ul>
      <li><a href="/faqs/">Questions and answers</a></li>
      <li><a href="/partners/#enquiry">Partnership and funding enquiries</a></li>
      <li><a href="/safeguarding/">Raise a safeguarding concern</a></li>
      <li><a href="/complaints/">Feedback and complaints</a></li>
    </ul>
    <p class="small">If someone is in immediate danger, call 999. For emotional support any time, call Samaritans free on 116 123.</p>
  </aside>
</div>`;
  return { path: "/contact/", title: "Contact us", description: "Contact Seek My Tribe about an activity, access needs, volunteering or partnerships.", body, section: "contact" };
}

// ---------------------------------------------------------------- Policies, thanks, 404

export function policyPage(ctx: Ctx, slug: string): Page {
  const p = ctx.content.policies.find((x) => x.slug === slug)!;
  const org = ctx.content.organisation;
  const services = ctx.content.settings.services;
  const tokens: Record<string, string> = {
    legal_name: fact(org.legal_name, ctx).value || org.name.value,
    email: org.email.verified || ctx.mode === "preview" ? `[${org.email.value}](mailto:${org.email.value})` : "the contact form",
    safeguarding_lead: fact(org.safeguarding_lead, ctx).value || "our safeguarding lead (via the email below)",
    email_provider: fact(services.email_provider, ctx).value || "our email delivery provider",
    hosting_provider: fact(services.hosting_provider, ctx).value || "our website host",
    phone_sentence: org.phone.value && (org.phone.verified || ctx.mode === "preview") ? ` or call ${org.phone.value}` : "",
  };
  // Tokens may contain flagged HTML in preview; markdown passes inline HTML through.
  const md = p.body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => tokens[k] ?? `{{${k}}}`);
  const body = html`${pageHeader(p.title, p.summary)}
<div class="wrap section">
  ${editorNote(p.review_note, ctx)}
  ${prose(markdown(md))}
  <p class="small">Last updated ${new Date(p.updated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
</div>`;
  return { path: `/${p.slug}/`, title: p.title, description: p.summary, body };
}

export function thanksPage(ctx: Ctx, formId: string): Page {
  const def = ctx.forms[formId]!;
  const next: Record<string, SafeHtml> = {
    interest: html`<a class="button" href="/resources/going-to-a-group-for-the-first-time/">Read: going to a group for the first time</a>`,
    suggest: html`<a class="button" href="/activities/register/">Hear when something starts</a>`,
    volunteer: html`<a class="button" href="/resources/welcoming-newcomers/">Read: making a group welcoming</a>`,
    partner: html`<a class="button" href="/impact/">See how we'll measure impact</a>`,
    updates: html`<a class="button" href="/activities/">Find an activity</a>`,
    contact: html`<a class="button" href="/">Back to the home page</a>`,
    join: html`<a class="button" href="/resources/going-to-a-group-for-the-first-time/">Read: going to a group for the first time</a>`,
  };
  return {
    path: `/thanks/${formId}/`,
    title: def.successTitle,
    description: def.successMessage,
    noindex: true,
    body: html`<div class="wrap section narrow confirmation">
      ${tableIllustration({ seats: 6, emptySeat: 1, label: "", className: "confirmation__art" })}
      <h1>${def.successTitle}</h1>
      <p class="lede">${def.successMessage}</p>
      <p>${next[formId] ?? raw("")}</p>
    </div>`,
  };
}

export function notFoundPage(_ctx: Ctx): Page {
  return {
    path: "/404.html",
    title: "Page not found",
    description: "We couldn't find that page.",
    noindex: true,
    body: html`<div class="wrap section narrow">
      <h1>We couldn't find that page</h1>
      <p class="lede">It may have moved, or the address may have a typo.</p>
      <ul class="action-list">
        <li><a class="button" href="/">Go to the home page</a></li>
        <li><a class="button button--quiet" href="/activities/">Find an activity</a></li>
      </ul>
    </div>`,
  };
}
