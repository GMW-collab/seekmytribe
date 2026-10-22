# Seek My Tribe website: handover

Prepared 22 October 2026. This covers the audit, what was built, how to run and
update it, what must be confirmed before launch, and what comes next.

---

## 1. Audit: where things started

**Live site (seekmytribe.com).** A GoDaddy Website Builder holding page: the name,
the tagline "Connect. Belong. Thrive.", an email sign-up box, "© 2024" in the
footer and a GoDaddy cookie banner. No other pages or content. Automated tools
are blocked by the site's robots rules, so it was read through a browser.

**Repository (GMW-collab/seekmytribe).** Empty: no commits, code or assets.

**Public records.** No company called Seek My Tribe CIC was found on Companies
House on 22 October 2026. The company may be registered under a different
name, very recently registered, or not yet registered. **Every legal fact on the
site is therefore marked "to confirm"** (see section 6).

**Useful assets carried over:** the name and the tagline. Nothing else existed.

**Key decisions made**

| Decision | Why |
| --- | --- |
| No framework; a small TypeScript build script and Node server | The package registry was unavailable during the build. On reflection this suits a small CIC: two runtime dependencies, nothing to upgrade, runs on any Node host. Astro was the original plan and remains a reasonable migration later. |
| Content in YAML/Markdown files, edited through Decap CMS | Free, no database, every change is a reviewable commit, staff don't need to touch code. |
| No database; form submissions are emailed | Data minimisation. Nothing personal is stored on the web server. |
| No cookies, analytics or third-party scripts on public pages | Removes the need for a cookie banner and simplifies the privacy notice. Add privacy-friendly analytics later only if it will be used. |
| No CAPTCHA | CAPTCHAs exclude some disabled people. Honeypot + signed time token + rate limit instead. |
| Facts carry a "verified" flag; production build blocks on unverified launch facts | Makes it structurally hard to publish an invented or unchecked claim. |
| No example activities | The brief forbids fabricating events. The activities page has a designed empty state instead. |

---

## 2. What was built

**Brand and design.** A round table seen from above, with one marigold chair
pulled out and empty: "There's a seat for you." It appears in the hero, the
empty activities state, confirmation pages, the logo and the social preview.
Palette: park-paper `#F5F6F0`, hedge ink `#1C2B25`, marigold `#F3B53F`,
hedgerow green `#2E6A4E`, lilac `#D9CCF0`, brick `#B4452F` (errors only).
Type: Bricolage Grotesque for headings; Atkinson Hyperlegible for body text,
chosen because it was designed for readers with low vision. No stock
photography: when real activities run, add real photos taken with consent.

**Pages and features**

- Home: mission, who it's for, planned activity types (labelled as plans), how it works, social mission, funder pathway, get-involved band.
- Activity directory with filters (kind, area, date, cost, checked access features, text search), shareable filtered URLs, and an honest empty state when nothing is listed.
- Activity detail pages with every field the brief lists, event structured data, and a short "let the host know I'm coming" form.
- How it works, About (principles, governance, directors, company details), Impact framework (13 defined measures across outputs, outcomes and impact; "No results yet" until real data exists).
- Partners and funders hub: mission and need, programmes, evaluation, funding principles, governance, ways to support, enquiry form. A reusable programme template (problem, participants, activities, outputs, outcomes, delivery, evaluation, budget, funding sought, partners, funders) with status labels. A printable organisational overview.
- Get involved, Suggest an activity, Guides and resources (three original practical guides), Questions and answers, Contact.
- Policies: privacy, safeguarding, accessibility, participation guidelines, feedback and complaints. All drafted for review, not adopted.
- Seven forms: contact, coming to an activity, register interest, suggest, volunteer, partner enquiry, updates. All validated on the server, labelled accessibly, working without JavaScript, with consent where needed.
- Footer updates sign-up on every page, replacing the old one.
- SEO: titles, descriptions, canonical URLs, Open Graph image, sitemap, robots.txt, Organization/Event/FAQ structured data (Organization only once facts are verified).
- Security: strict Content-Security-Policy, HSTS, no-sniff, path-traversal protection, body size limit, rate limiting.

---

## 3. Sitemap

```
/                               Home
/activities/                    Find an activity (directory or empty state)
/activities/<slug>/             One page per real activity
/activities/register/           Tell me when something starts
/how-it-works/
/get-involved/                  Volunteer and contribute
/suggest/                       Suggest an activity
/resources/                     Guides and resources
/resources/<slug>/              Individual guides
/faqs/                          Questions and answers
/contact/
/about/
/impact/
/partners/                      Partners and funders hub
/partners/programmes/<slug>/    Programme pages ("proposed" and later; drafts in review copy only)
/partners/overview/             Printable organisational overview
/privacy/  /safeguarding/  /accessibility/  /participation-guidelines/  /complaints/
/thanks/<form>/                 Confirmation pages (not indexed)
/admin/                         Content editor (not indexed)
/api/forms/<form>               Form handler (POST only)
/healthz                        Health check for the host
```

---

## 4. Technical architecture

```
content/*.yml, *.md ──► src/build.ts ──► dist/ (static HTML, CSS, JS, JSON)
                         │                    │
                         └ src/templates/*     └► src/server.ts ──► visitors
                                                     │
                                  POST /api/forms ───┘──► Resend API ──► team inbox
```

- **Build.** `src/lib/content.ts` loads and validates content and stops with plain-English errors naming the file. `src/templates/` renders pages using an escaping HTML helper, so content can't inject markup by accident.
- **Server.** Serves `dist/`, inserts a freshly signed token into each form at request time, and handles form posts. JSON responses for JavaScript, a readable HTML page or redirect without it.
- **Forms.** One definition per form (`src/forms/definitions.ts`) drives both the HTML and the server validation, so they can't drift apart.
- **Browser JavaScript.** Optional enhancement: mobile menu, inline form errors with an error summary, live activity filtering. The filter logic (`public/js/activity-filter.js`) is shared with the tests.
- **Runtime dependencies.** `marked` (Markdown) and `js-yaml` (YAML). Nothing else.

---

## 5. How staff update the site

### Using the editor (recommended)

Go to `/admin/`, sign in with GitHub, and edit **Activities**, **Programmes**,
**Guides**, **Policies** or **Organisation and settings**. Changes go through an
"editorial workflow": save a draft, then publish. Publishing commits to the
repository and the host rebuilds the site.

*Setup needed first (see section 7):* Decap's GitHub sign-in needs an OAuth
helper. This hasn't been configured.

### Directly on GitHub

Edit the files in `content/` in the GitHub web editor. Each folder has notes.

### Common tasks

| Task | Where |
| --- | --- |
| Add an activity | `content/activities/`: copy `_template.yml.example`, rename it (e.g. `riverside-walk-nov.yml`), set `status: published` |
| Cancel or mark full | change `status` to `cancelled` or `full` |
| Confirm a company fact | `content/organisation.yml`: correct the value, set `verified: true`, and write where you checked it in `source` |
| Publish an impact result | `content/impact.yml`: add a `results` entry with period, value and note. Real records only. |
| Share a programme with funders | `content/programmes/`: change `status` from `draft` to `proposed` |
| Add a guide | new Markdown file in `content/articles/` |

Past activities disappear from listings automatically at the next build. Set up
a daily rebuild on the host so this happens without anyone remembering.

---

## 6. Content that must be verified before launch

The production build refuses to run until items marked **launch** are confirmed.

| Item | Status | What to do |
| --- | --- | --- |
| Registered name | Assumed "Seek My Tribe CIC" | Check certificate of incorporation **(launch)** |
| Legal form | Assumed CIC limited by guarantee | Check articles **(launch)** |
| Jurisdiction | Assumed England and Wales | Check certificate **(launch)** |
| Company number | Placeholder | Companies House **(launch)** |
| Registered office | Placeholder | Companies House **(launch)** |
| Community interest statement | Paraphrased from brief | Use the CIC 36 wording **(launch)** |
| Directors | Placeholder | Companies House officer list **(launch)** |
| Contact email | `hello@seekmytribe.com` assumed | Confirm the mailbox exists and is monitored **(launch)** |
| Safeguarding lead | Not appointed | Appoint before any activity **(launch)** |
| Email provider, host | Not chosen | Set up; confirm data processing terms **(launch)** |
| Incorporation date, area, phone, postal address, insurance | Not supplied | Add when known |
| "We haven't yet run activities or received grant funding" (Partners page, overview) | Inferred from the holding page and brief | Confirm, and update as soon as it changes |
| Pricing approach (free / pay-what-you-can) | Stated as an aim | Confirm once costed |
| Response times in complaints policy (5 and 20 working days) | Drafted | Confirm directors can meet them |
| Every policy page | Drafts | Directors to review and adopt; see section 8 |

Editor notes (dashed purple boxes in the review copy) also mark where founders'
story and sourced statistics should go. They never appear in production.

---

## 7. Accounts, integrations and configuration needed

| What | Why | Notes |
| --- | --- | --- |
| A Node 22 host | Runs `npm start` | Any Node host works (e.g. Render, Railway, Fly.io, a small VPS). Compare current pricing; a free tier that sleeps will make the first page load slow. Set `SITE_MODE=production`, `FORM_SECRET`, email settings and `TRUST_PROXY=true` if behind a proxy. Health check: `/healthz`. |
| Resend account (or swap the sender) | Delivers form emails | Verify the `seekmytribe.com` sending domain (DNS records). Only `src/forms/mailer.ts` needs changing to use another provider. Not configured or tested with a live key. |
| A monitored inbox | Receives submissions | Set as `FORM_TO_EMAIL`. Agree who reads it and how often. |
| Decap CMS sign-in | Lets staff use `/admin/` | Needs an OAuth helper for GitHub (several free options, or use Netlify/DecapBridge). Not configured. |
| Claude GitHub access | So changes can be pushed from Claude | Pushing was refused in this session. Install the Claude GitHub App on the repository, or push the code yourself. |
| Fonts | Self-hosted typefaces | Run `npm run fonts` once and commit `public/fonts/`. The font CDN was blocked during the build, so this is untested. |
| Domain (GoDaddy) | Point at the new host | **Not changed.** Only switch DNS once the production build passes and someone has approved it. |
| ICO data protection fee | Legal requirement for most organisations processing personal data | Check whether an exemption applies; most small organisations pay a modest annual fee. |

---

## 8. Governance and safeguarding still outstanding

These need decisions by directors, and some need professional advice. The
website describes them but can't put them in place.

- **Safeguarding policy and procedures**, a named and trained safeguarding lead, and a decision on which roles need DBS checks. Take specialist advice before any activity involves children or adults at risk.
- **Public liability insurance** (and employer's liability if anyone is employed) before activities run. Consider volunteer cover.
- **Data protection**: ICO fee, a record of processing, retention schedule matching the privacy notice, and a data processing agreement with the email provider and host.
- **Health and safety**: venue checks and risk assessments for each activity type, first aid arrangements.
- **Equality, diversity and inclusion policy**, and **financial controls** (two signatories, expense policy). Funders commonly ask for these.
- **Annual CIC 34 community interest report** and accounts to Companies House.
- Have a solicitor or an organisation such as your local council for voluntary service review the privacy notice and policies before launch.

---

## 9. Funding-readiness recommendations

In rough order:

1. Confirm the company details and open a business bank account in the CIC's name. Almost every funder checks both.
2. Adopt the core policies in section 8 and keep dated copies.
3. Gather local evidence of need: official figures for your area, plus what people say through the suggestion and register-interest forms (which double as demand evidence).
4. Turn "The Open Table" into a costed pilot of about three months. Add a simple theory of change: activities → outputs → outcomes.
5. Run the pilot with the measurement framework already on the site, so the first application can show real results.
6. Collect letters of support from venues and local organisations.
7. Join your local council for voluntary service or community foundation network for funding alerts and support.
8. When researching funders, check each one's current eligibility rules: some programmes accept CICs, many are for registered charities only, and some require an asset-locked CIC limited by guarantee. Never assume.

---

## 10. Next-stage roadmap

**Phase 1: launch (now).** Verify facts, configure email, fonts and hosting, adopt policies, set up the CMS sign-in, remove the GoDaddy page.

**Phase 2: community participation (once activities run).**
- Hand bookings to an event platform if capacity management becomes a burden (`how_to_join: external-booking` is already supported).
- Confirmation and reminder emails for "coming to an activity".
- A short post-activity feedback form feeding the impact measures.
- A simple private spreadsheet or Airtable for tracking suggestions by area.
- Real, consented photography.

**Phase 3: only if justified.** Member accounts, personalised discovery, moderated member-submitted activities, partner dashboards. Avoid private messaging or public member directories unless there's a strong case and a proper moderation and safeguarding model.

---

## 11. Deploying and rolling back

**Deploy**

```sh
git pull
npm ci
npm run check
SITE_MODE=production SITE_URL=https://seekmytribe.com npm run build:production
npm start            # or let the host run this
```

Most hosts can run the build on every push to `main` and restart the server.

**Roll back**

Every deploy is a commit. To undo the last change: `git revert <commit>` and push,
or redeploy the previous commit from the host's dashboard. Content edits made in
the CMS are commits too, so they roll back the same way. There's no database to
restore.

**Do not** switch DNS, deploy to production or sign up for paid services
without the directors' approval.

---

## 12. Quality checks performed

- `npm run typecheck`: no errors.
- `npm test`: 48 tests pass, covering content validation, the production guard, form validation, spam protection, email sending (with a fake), the server's headers, redirects, path-traversal protection, no-JavaScript form fallbacks, and the build output (one h1 per page, labelled controls, no broken internal links, no leaked placeholders).
- `npm run test:browser` (Playwright/Chromium): every page at 320px and 1280px with no sideways scrolling; WCAG AA text contrast for all visible text (the check was confirmed to catch a deliberate failure); skip link and visible focus; mobile menu including Escape; contact form error summary, focus and `aria-invalid`; the honest "not switched on yet" message when email isn't configured; activity filters, URL state and no-results message (using test fixtures).
- Manual review of screenshots for the home page, activities (empty and with fixtures), activity detail, partners, impact and about pages, at desktop and mobile widths.

**Not yet tested**

- Real email delivery (needs a Resend key).
- Self-hosted fonts (CDN blocked during build).
- The Decap CMS editor (needs sign-in setup).
- Screen readers (NVDA, VoiceOver) and testing with disabled users. Recommended before launch.
- Hosting-specific behaviour (proxy headers, HTTPS).

**Known limitations**

- The rate limiter is in memory and resets when the server restarts. Fine at this scale.
- Past activities drop off listings at build time, so schedule a daily rebuild.
- Dark mode isn't provided; the light theme was chosen for contrast and warmth.
