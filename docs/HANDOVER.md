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

**Public records.** The company was incorporated on 22 October 2026 and its
record was confirmed later that day (see section 6).

**Useful assets carried over:** the name and the tagline. Nothing else existed.

**Key decisions made**

| Decision | Why |
| --- | --- |
| Cloudflare Pages for hosting (Node server kept as a fallback) | Free, fast, no server to maintain; the CIC already uses Cloudflare. |
| No framework; a small TypeScript build script | The package registry was unavailable during the build. On reflection this suits a small CIC: two runtime dependencies, nothing to upgrade, runs on any Node host. Astro was the original plan and remains a reasonable migration later. |
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
/donate/                        Support our work (Stripe Payment Links)
/donate/thank-you/              Where Stripe returns donors (not indexed)
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

Company details were confirmed against [Companies House](https://find-and-update.company-information.service.gov.uk/company/17534966) on 22 October 2026: **SEEK MY TRIBE CIC**, company number **17534966**, private company limited by guarantee without share capital, incorporated **22 October 2026**, registered office **128 City Road, London, EC1V 2NX**, director **Dr Ravjot Kaur Bajwa**. These are now marked verified.

The production build still refuses to run until the items marked **launch** are confirmed.

| Item | Status | What to do |
| --- | --- | --- |
| Community interest statement | Paraphrased from brief | Replace with the CIC 36 wording from the incorporation documents **(launch)** |
| Contact email | `hello@seekmytribe.com` assumed | Create the mailbox or forwarding (see section 7) **(launch)** |
| Safeguarding lead | Not appointed | Appoint before any activity **(launch)** |
| Email provider, host | Chosen (Resend, Cloudflare Pages) but not set up | Mark verified once accounts exist **(launch)** |
| Asset lock wording | Standard CIC wording | Check against the articles |
| Area, phone, postal address, insurance | Not supplied | Add when known |
| "We haven't yet run activities or received grant funding" (Partners page, overview) | True as of incorporation today | Update as soon as it changes |
| Pricing approach (free / pay-what-you-can) | Stated as an aim | Confirm once costed |
| Response times in complaints policy (5 and 20 working days) | Drafted | Confirm the director can meet them |
| Donation refund window | Not set | Decide (e.g. 30 days) and state it on the Donate page |
| Every policy page | Drafts | Director to review and adopt; see section 8 |

The registered office (128 City Road) is a widely used registered-address service. That's fine for legal notices, but it's not where activities happen or where post for participants should go, so the site doesn't present it as a contact address.

Editor notes (dashed purple boxes in the review copy) also mark where the founder's story, sourced statistics and costed donation examples should go. They never appear in production.

## 7. Hosting on Cloudflare Pages, and moving the domain from GoDaddy

**Recommendation: Cloudflare Pages, free plan.** The site's pages are static files, which Pages serves from Cloudflare's network at no cost, and the form handling runs as Pages Functions (small pieces of server code that run on Cloudflare). There is no server to maintain. The free plan includes a daily allowance of Function requests that is far above what this site will need; check Cloudflare's current limits when you sign up. Only page loads and form posts use Functions; CSS, images and scripts don't (see `public/_routes.json`).

The Node server (`npm start`) is still included, so the site can move to any other host later without changes.

### Accounts the director needs to create

Claude can't create accounts or enter passwords, so these need doing by a person:

| Account | Why | Cost |
| --- | --- | --- |
| GitHub (already exists: GMW-collab) | Holds the code; Cloudflare deploys from it | Free |
| Cloudflare | Hosting, DNS, optional email forwarding | Free plan |
| Resend | Sends form submissions to your inbox | Has a free tier; check current limits |
| Stripe | Donations (section 7b) | No monthly fee; a fee per donation |

### Step by step

1. **Put the code on GitHub.** Push the delivered code to `GMW-collab/seekmytribe`, or install the Claude GitHub App on that repository so Claude can push.
2. **Create the Pages project.** In Cloudflare: Workers & Pages → Create → Pages → Connect to Git → choose the repository.
   - Framework preset: *None*
   - Build command: `npm run build:cloudflare`
   - Build output directory: `dist`
   - Node version comes from `.node-version` (22.22.0).
3. **Add settings.** Pages project → Settings → Variables and secrets:
   - `FORM_SECRET` (type: secret) — a long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `RESEND_API_KEY` (secret) — from Resend.
   - `FORM_TO_EMAIL` — the inbox that receives submissions.
   - `SITE_URL` and `FORM_FROM_EMAIL` are already in `wrangler.toml`.
4. **Deploy a review copy first.** The `main` branch builds the public site, which is deliberately blocked until the launch facts in section 6 are verified. Push a branch called `preview` to get a review copy at a `*.pages.dev` address. Every non-`main` branch builds as a review copy, hidden from search engines.
5. **Check the review copy** (this couldn't be tested from here): load a few pages; view source and confirm forms contain a long `_t` value, not `__FORM_TOKEN__`; send one test from the contact form; open `/donate/`.
6. **Verify the launch facts**, merge to `main`, and Cloudflare publishes the public site.
7. **Optional hardening.** In Cloudflare → Security → WAF, add a rate-limiting rule for `/api/forms/*` if your plan includes one. The site's built-in limit is a soft one on Cloudflare.

### Moving the domain from GoDaddy

The domain can stay **registered** at GoDaddy. What changes is who answers for it (DNS).

**Recommended: switch the nameservers to Cloudflare.** Needed for the bare `seekmytribe.com` (without `www`) to point at Pages.

1. In Cloudflare: Add a domain → `seekmytribe.com` → Free plan. Cloudflare copies the existing DNS records.
2. **Before switching, check the email records.** If anyone has email at `@seekmytribe.com` (GoDaddy email or Microsoft 365, for example), confirm the `MX`, `TXT` (SPF) and any `CNAME` records were copied exactly. Missing these stops email working. If unsure, compare against GoDaddy's DNS page first.
3. In GoDaddy: My Products → the domain → DNS → Nameservers → Change → enter the two nameservers Cloudflare gives you. It can take from minutes to a day.
4. In the Pages project: Custom domains → add `seekmytribe.com` and `www.seekmytribe.com`. Cloudflare sets up the records and HTTPS certificates.
5. Once the new site is live, cancel the GoDaddy Website Builder plan (keep the domain registration, and keep auto-renew on).

**Alternative, if you'd rather leave DNS at GoDaddy:** point `www` at the Pages address with a `CNAME` in GoDaddy, and use GoDaddy's domain forwarding to send `seekmytribe.com` to `https://www.seekmytribe.com`. This works but is less tidy, and forwarding can be unreliable over HTTPS.

**Do not change nameservers or DNS without the director's go-ahead.** Nothing has been changed so far.

### Email

- **Receiving at hello@seekmytribe.com:** if there's no mailbox yet, Cloudflare Email Routing (free) can forward it to an existing inbox. Don't use it if the domain already has mailboxes elsewhere; it replaces the `MX` records.
- **Sending form submissions:** in Resend, add `seekmytribe.com` as a sending domain and add the records it gives you in Cloudflare DNS.

### Content editor (/admin/)

Decap CMS needs a small sign-in helper for GitHub. On Cloudflare, this can be a free Worker (several open-source "Decap OAuth" Workers exist) plus a GitHub OAuth app. This hasn't been set up. Until it is, edit files in `content/` on GitHub directly.

## 7b. Donations

**Approach: Stripe Payment Links.** The Donate page links to a payment page hosted by Stripe. Why this rather than an embedded widget:

- No third-party script on the site, so pages stay fast, cookie-free and covered by the strict security policy.
- Card details never touch the site, so there's no card-security compliance burden for the CIC.
- Receipts, Apple Pay and Google Pay come built in.
- No monthly fee.

**What the site does now:** `/donate/` explains what gifts pay for and what you promise in return, states clearly that donations aren't eligible for Gift Aid, and offers other ways to help. Until a Stripe link is added it says "Online giving opens soon", and the header Donate button stays hidden. Once a link is added, the Give buttons and the header button appear.

**To switch it on (director):**

1. Create a Stripe account for **Seek My Tribe CIC** (company 17534966). Stripe will verify the business and the director's identity, and may ask about donations specifically.
2. Stripe dashboard → Payment Links → New:
   - One-off: a product called "Donation to Seek My Tribe CIC", priced with **"Customers choose what to pay"**. Set a sensible suggested amount.
   - Monthly (optional): a recurring price. Monthly links use set amounts, so create one per amount you want to offer, or start with a single amount.
   - After payment: redirect to `https://seekmytribe.com/donate/thank-you/`.
3. Paste the link(s) into `content/site.yml` under `donations` and push. The build only accepts `https://donate.stripe.com/` or `https://buy.stripe.com/` links, so a typo can't send donors somewhere unsafe.
4. Mark the donation refund window on the Donate page (editor note).

**Rules to keep to**

- Never describe donations as tax-deductible or Gift Aid-eligible. CICs can't register as charities.
- Report what donations paid for on the Impact page and in the annual CIC 34 report, as the Donate page promises.
- Consider registering voluntarily with the Fundraising Regulator and following the Code of Fundraising Practice. It's optional for a CIC but reassures donors.
- Keep donation records for six years (as the privacy notice says).

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

**Deploy (Cloudflare Pages)**

Push to `main`. Cloudflare runs `npm run build:cloudflare` and publishes. Any other branch gets its own review address. Run `npm run check` locally before pushing if you can.

**Deploy (any other Node host)**

```sh
npm ci
npm run check
SITE_MODE=production SITE_URL=https://seekmytribe.com npm run build:production
npm start
```

**Roll back**

In Cloudflare Pages → Deployments, choose an earlier deployment → "Rollback to this deployment". It takes effect in seconds.

Every deploy is also a commit. To undo the last change: `git revert <commit>` and push,
or redeploy the previous commit from the host's dashboard. Content edits made in
the CMS are commits too, so they roll back the same way. There's no database to
restore.

**Do not** switch DNS, deploy to production or sign up for paid services
without the directors' approval.

---

## 12. Quality checks performed

- `npm run typecheck`: no errors.
- `npm test`: 57 tests pass, covering content validation, the production guard, form validation, spam protection, email sending (with a fake), the server's headers, redirects, path-traversal protection, no-JavaScript form fallbacks, and the build output (one h1 per page, labelled controls, no broken internal links, no leaked placeholders).
- `npm run test:browser` (Playwright/Chromium): every page at 320px and 1280px with no sideways scrolling; WCAG AA text contrast for all visible text (the check was confirmed to catch a deliberate failure); skip link and visible focus; mobile menu including Escape; contact form error summary, focus and `aria-invalid`; the honest "not switched on yet" message when email isn't configured; activity filters, URL state and no-results message (using test fixtures).
- Manual review of screenshots for the home page, activities (empty and with fixtures), activity detail, partners, impact and about pages, at desktop and mobile widths.

- Cloudflare Functions: the form handler and middleware are tested with standard Request/Response objects, bundled with esbuild for a Workers runtime (no Node-only imports), and the bundle was run once successfully.

**Not yet tested**

- A real deploy on Cloudflare Pages (follow the checks in section 7, step 5).
- Real email delivery (needs a Resend key).
- Live Stripe links.
- Self-hosted fonts (CDN blocked during build).
- The Decap CMS editor (needs sign-in setup).
- Screen readers (NVDA, VoiceOver) and testing with disabled users. Recommended before launch.
- Hosting-specific behaviour (proxy headers, HTTPS).

**Known limitations**

- The built-in rate limiter is in memory: per process on Node, per isolate on Cloudflare. Add a Cloudflare rate-limiting rule for a hard limit.
- Past activities drop off listings at build time, so schedule a daily rebuild.
- Dark mode isn't provided; the light theme was chosen for contrast and warmth.
