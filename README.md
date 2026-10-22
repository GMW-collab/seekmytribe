# Seek My Tribe website

The website for Seek My Tribe, a community interest company creating welcoming,
real-world activities where people can meet by doing something together.

It is a small static site with one lightweight Node server for forms. There is
no framework, no database and almost nothing to keep updated.

- Content lives in plain files in [`content/`](content/) and can be edited on GitHub or through the editor at `/admin/`.
- Every form is validated on the server, protected from spam without a CAPTCHA, and emailed to the team.
- Unconfirmed facts are highlighted in review copies, and a production build refuses to run until they're checked.

See **[docs/HANDOVER.md](docs/HANDOVER.md)** for the full handover: sitemap, how
staff update content, what still needs verifying, deployment and the roadmap.

## Quick start

Requires Node.js 22.18 or newer (it runs TypeScript directly; there is no compile step).

```sh
npm install            # two small runtime dependencies: marked and js-yaml
npm run fonts          # once: downloads the two open-licence fonts into public/fonts
npm run dev            # review copy at http://localhost:8080, rebuilds on change
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Build the review copy and serve it, restarting on changes |
| `npm run build:preview` | Build the review copy into `dist/` (flags unconfirmed facts, shows drafts, hidden from search engines) |
| `npm run build:production` | Build the public site. Stops with a list if launch-critical facts are unverified |
| `npm start` | Serve `dist/` and handle forms |
| `npm test` | Unit and integration tests (Node's built-in test runner) |
| `npm run typecheck` | TypeScript type check |
| `npm run test:browser` | Browser checks with Playwright: layout at 320px, contrast, keyboard, forms, filters |
| `npm run check` | Type check, tests and a preview build |

## Configuration

Copy `.env.example` to `.env` and fill it in. Never commit `.env`. The forms need
`FORM_SECRET`, `RESEND_API_KEY`, `FORM_FROM_EMAIL` and `FORM_TO_EMAIL`; until
they're set, forms tell visitors plainly to email instead.

## Project layout

```
content/          everything staff edit: activities, programmes, guides, policies, facts
public/           static files copied as-is: CSS, browser JS, images, the /admin editor
src/build.ts      turns content + templates into dist/
src/server.ts     serves dist/, adds security headers, handles /api/forms/*
src/forms/        form definitions, validation, spam protection, email delivery
src/templates/    page templates (plain TypeScript functions returning escaped HTML)
tests/            node:test suites and fixtures
scripts/          font download, browser checks
```
