// Loads and validates everything in /content. Validation errors stop the build
// with a plain-English message naming the file, so staff can fix mistakes
// before they reach the public site.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { createRequire } from "node:module";
import { marked } from "marked";
import { ACCESS_TAGS } from "../../public/js/activity-filter.js";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as {
  load: (s: string, o?: unknown) => unknown;
  safeLoad?: (s: string) => unknown;
};

export function parseYaml(text: string): unknown {
  // js-yaml 3 exposes safeLoad; js-yaml 4 made load() safe by default.
  return yaml.safeLoad ? yaml.safeLoad(text) : yaml.load(text);
}

export class ContentError extends Error {}

// ---------- Types ----------

export interface Fact<T = string> {
  value: T;
  verified: boolean;
  source: string;
  launch: boolean;
}

export interface Director {
  name: string;
  role: string;
}

export interface Organisation {
  name: Fact;
  tagline: Fact;
  legal_name: Fact;
  legal_form: Fact;
  jurisdiction: Fact;
  company_number: Fact;
  registered_office: Fact;
  incorporated: Fact;
  community_interest_statement: Fact;
  asset_lock: Fact;
  directors: Fact<Director[]>;
  area: Fact;
  email: Fact;
  phone: Fact;
  postal_address: Fact;
  safeguarding_lead: Fact;
  insurance: Fact;
  charity_status: Fact;
}

export interface SiteSettings {
  services: { email_provider: Fact; hosting_provider: Fact };
  social: Array<{ name: string; url: string }>;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export type CostType = "free" | "pay-what-you-can" | "subsidised" | "paid";
export type JoinMethod = "just-turn-up" | "register-interest" | "external-booking";
export type ActivityStatus = "draft" | "published" | "cancelled" | "full";

export interface Activity {
  slug: string;
  title: string;
  summary: string;
  descriptionHtml: string;
  category: string;
  status: ActivityStatus;
  starts: string; // ISO local date-time
  ends?: string;
  repeats?: string;
  area: string;
  venue: { name: string; address?: string; directions?: string };
  cost: { type: CostType; details?: string };
  capacity?: number;
  places_left?: number;
  accessibility: string[];
  access_tags: string[];
  age?: string;
  what_to_bring?: string;
  how_to_join: JoinMethod;
  booking_url?: string;
  organiser: string;
  contact_email?: string;
  cancellation?: string;
  guidance?: string;
}

export type ProgrammeStatus = "draft" | "proposed" | "funded" | "running" | "complete";

export interface Programme {
  slug: string;
  title: string;
  status: ProgrammeStatus;
  summary: string;
  problem: string;
  participants: string;
  activities: string[];
  outputs: string[];
  outcomes: string[];
  delivery: string;
  evaluation: string;
  budget: string;
  funding_sought: string;
  area: string;
  partners: string[];
  funders: string[];
  bodyHtml: string;
}

export interface Article {
  slug: string;
  title: string;
  summary: string;
  audience: string;
  published: string;
  bodyHtml: string;
}

export interface Policy {
  slug: string;
  title: string;
  summary: string;
  review_note: string;
  updated: string;
  body: string; // markdown with {{tokens}} still in place
}

export interface ImpactResult {
  period: string;
  value: string;
  note?: string;
}

export interface ImpactMeasure {
  id: string;
  name: string;
  kind: "output" | "outcome" | "impact";
  definition: string;
  method: string;
  results: ImpactResult[];
}

export interface Impact {
  reporting_period_note: string;
  measures: ImpactMeasure[];
}

export interface FaqGroup {
  group: string;
  items: Array<{ q: string; aHtml: string }>;
}

export interface SiteContent {
  organisation: Organisation;
  settings: SiteSettings;
  categories: Category[];
  activities: Activity[];
  programmes: Programme[];
  articles: Article[];
  policies: Policy[];
  impact: Impact;
  faqs: FaqGroup[];
}

// ---------- Helpers ----------

function readYamlFile(path: string): unknown {
  try {
    return parseYaml(readFileSync(path, "utf8"));
  } catch (err) {
    throw new ContentError(`Could not read ${path}: ${(err as Error).message}`);
  }
}

export function splitFrontmatter(text: string, file = "file"): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new ContentError(`${file} needs a front matter block between --- lines at the top.`);
  const data = parseYaml(match[1] ?? "");
  if (!data || typeof data !== "object") throw new ContentError(`${file}: front matter is empty or invalid.`);
  return { data: data as Record<string, unknown>, body: match[2] ?? "" };
}

export function markdown(text: string): string {
  return marked.parse(text, { async: false, gfm: true }) as string;
}

/** Inline markdown (no wrapping <p>), for short answers and summaries. */
export function markdownInline(text: string): string {
  return marked.parseInline(text, { async: false, gfm: true }) as string;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean);
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => extname(f) === ext && !f.startsWith("_"))
    .sort();
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** YAML may turn an unquoted date-time into a Date (UTC). Normalise to "YYYY-MM-DDTHH:MM". */
export function normaliseDateTime(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 16);
  return str(v).replace(" ", "T").slice(0, 16);
}

// ---------- Activities ----------

const COST_TYPES: CostType[] = ["free", "pay-what-you-can", "subsidised", "paid"];
const JOIN_METHODS: JoinMethod[] = ["just-turn-up", "register-interest", "external-booking"];
const ACTIVITY_STATUSES: ActivityStatus[] = ["draft", "published", "cancelled", "full"];

export function validateActivity(slug: string, d: Record<string, unknown>, categories: Category[]): { activity?: Activity; errors: string[] } {
  const errors: string[] = [];
  const need = (key: string) => {
    if (!str(d[key])) errors.push(`"${key}" is missing`);
  };
  ["title", "summary", "description", "category", "status", "starts", "area", "how_to_join", "organiser"].forEach(need);

  if (!SLUG_RE.test(slug)) errors.push(`file name "${slug}" should be lower-case words joined by hyphens`);

  const status = str(d.status) as ActivityStatus;
  if (d.status && !ACTIVITY_STATUSES.includes(status)) errors.push(`"status" must be one of ${ACTIVITY_STATUSES.join(", ")}`);

  const category = str(d.category);
  if (category && !categories.some((c) => c.id === category)) {
    errors.push(`"category" "${category}" is not in content/categories.yml`);
  }

  const starts = normaliseDateTime(d.starts);
  if (d.starts && !DATETIME_RE.test(starts)) errors.push(`"starts" should look like 2026-11-15T10:00`);
  const ends = d.ends ? normaliseDateTime(d.ends) : undefined;
  if (ends && !DATETIME_RE.test(ends)) errors.push(`"ends" should look like 2026-11-15T11:30`);
  if (ends && starts && ends < starts) errors.push(`"ends" is before "starts"`);

  const venue = (d.venue ?? {}) as Record<string, unknown>;
  if (!str(venue.name)) errors.push(`"venue.name" is missing`);

  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const costType = str(cost.type) as CostType;
  if (!COST_TYPES.includes(costType)) errors.push(`"cost.type" must be one of ${COST_TYPES.join(", ")}`);

  const join = str(d.how_to_join) as JoinMethod;
  if (d.how_to_join && !JOIN_METHODS.includes(join)) errors.push(`"how_to_join" must be one of ${JOIN_METHODS.join(", ")}`);
  const bookingUrl = str(d.booking_url);
  if (join === "external-booking" && !/^https:\/\//.test(bookingUrl)) {
    errors.push(`"booking_url" must be an https:// address when how_to_join is external-booking`);
  }

  const accessibility = strList(d.accessibility);
  if (accessibility.length === 0) {
    errors.push(`"accessibility" needs at least one line. If nothing is known yet, write "Not yet checked".`);
  }

  const accessTags = strList(d.access_tags);
  const unknownTags = accessTags.filter((t) => !(t in ACCESS_TAGS));
  if (unknownTags.length) {
    errors.push(`"access_tags" can only use: ${Object.keys(ACCESS_TAGS).join(", ")} (found ${unknownTags.join(", ")})`);
  }

  const num = (v: unknown, key: string): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      errors.push(`"${key}" must be a whole number`);
      return undefined;
    }
    return n;
  };
  const capacity = num(d.capacity, "capacity");
  const placesLeft = num(d.places_left, "places_left");
  if (capacity !== undefined && placesLeft !== undefined && placesLeft > capacity) {
    errors.push(`"places_left" is more than "capacity"`);
  }

  if (errors.length) return { errors };

  return {
    errors,
    activity: {
      slug,
      title: str(d.title),
      summary: str(d.summary),
      descriptionHtml: markdown(str(d.description)),
      category,
      status,
      starts,
      ends,
      repeats: str(d.repeats) || undefined,
      area: str(d.area),
      venue: {
        name: str(venue.name),
        address: str(venue.address) || undefined,
        directions: str(venue.directions) || undefined,
      },
      cost: { type: costType, details: str(cost.details) || undefined },
      capacity,
      places_left: placesLeft,
      accessibility,
      access_tags: accessTags,
      age: str(d.age) || undefined,
      what_to_bring: str(d.what_to_bring) || undefined,
      how_to_join: join,
      booking_url: bookingUrl || undefined,
      organiser: str(d.organiser),
      contact_email: str(d.contact_email) || undefined,
      cancellation: str(d.cancellation) || undefined,
      guidance: str(d.guidance) || undefined,
    },
  };
}

// ---------- Programmes ----------

const PROGRAMME_STATUSES: ProgrammeStatus[] = ["draft", "proposed", "funded", "running", "complete"];

export function validateProgramme(slug: string, d: Record<string, unknown>, body: string): { programme?: Programme; errors: string[] } {
  const errors: string[] = [];
  ["title", "status", "summary", "problem", "participants"].forEach((k) => {
    if (!str(d[k])) errors.push(`"${k}" is missing`);
  });
  const status = str(d.status) as ProgrammeStatus;
  if (d.status && !PROGRAMME_STATUSES.includes(status)) errors.push(`"status" must be one of ${PROGRAMME_STATUSES.join(", ")}`);
  const funders = strList(d.funders);
  if ((status === "funded" || status === "running") && funders.length === 0) {
    errors.push(`status "${status}" needs at least one confirmed funder listed under "funders"`);
  }
  if (errors.length) return { errors };
  return {
    errors,
    programme: {
      slug,
      title: str(d.title),
      status,
      summary: str(d.summary),
      problem: str(d.problem),
      participants: str(d.participants),
      activities: strList(d.activities),
      outputs: strList(d.outputs),
      outcomes: strList(d.outcomes),
      delivery: str(d.delivery),
      evaluation: str(d.evaluation),
      budget: str(d.budget),
      funding_sought: str(d.funding_sought),
      area: str(d.area),
      partners: strList(d.partners),
      funders,
      bodyHtml: markdown(body),
    },
  };
}

// ---------- Loader ----------

export function loadContent(root: string): SiteContent {
  const problems: string[] = [];

  const organisation = readYamlFile(join(root, "organisation.yml")) as Organisation;
  const settings = readYamlFile(join(root, "site.yml")) as SiteSettings;
  const categories = readYamlFile(join(root, "categories.yml")) as Category[];

  const activities: Activity[] = [];
  for (const file of listFiles(join(root, "activities"), ".yml")) {
    const slug = basename(file, ".yml");
    const data = readYamlFile(join(root, "activities", file));
    const { activity, errors } = validateActivity(slug, (data ?? {}) as Record<string, unknown>, categories);
    if (errors.length) problems.push(`content/activities/${file}: ${errors.join("; ")}`);
    else if (activity) activities.push(activity);
  }

  const programmes: Programme[] = [];
  for (const file of listFiles(join(root, "programmes"), ".md")) {
    const slug = basename(file, ".md");
    const { data, body } = splitFrontmatter(readFileSync(join(root, "programmes", file), "utf8"), file);
    const { programme, errors } = validateProgramme(slug, data, body);
    if (errors.length) problems.push(`content/programmes/${file}: ${errors.join("; ")}`);
    else if (programme) programmes.push(programme);
  }

  const articles: Article[] = listFiles(join(root, "articles"), ".md").map((file) => {
    const { data, body } = splitFrontmatter(readFileSync(join(root, "articles", file), "utf8"), file);
    return {
      slug: basename(file, ".md"),
      title: str(data.title),
      summary: str(data.summary),
      audience: str(data.audience),
      published: str(data.published).slice(0, 10),
      bodyHtml: markdown(body),
    };
  });

  const policies: Policy[] = listFiles(join(root, "policies"), ".md").map((file) => {
    const { data, body } = splitFrontmatter(readFileSync(join(root, "policies", file), "utf8"), file);
    return {
      slug: basename(file, ".md"),
      title: str(data.title),
      summary: str(data.summary),
      review_note: str(data.review_note),
      updated: str(data.updated).slice(0, 10),
      body,
    };
  });

  const impact = readYamlFile(join(root, "impact.yml")) as Impact;
  impact.measures.forEach((m) => {
    if (!["output", "outcome", "impact"].includes(m.kind)) problems.push(`content/impact.yml: measure "${m.id}" has unknown kind "${m.kind}"`);
    m.results = Array.isArray(m.results) ? m.results : [];
    m.results.forEach((r) => {
      if (!r.period || !r.value) problems.push(`content/impact.yml: a result for "${m.id}" needs both a period and a value`);
    });
  });

  const rawFaqs = readYamlFile(join(root, "faqs.yml")) as Array<{ group: string; items: Array<{ q: string; a: string }> }>;
  const faqs: FaqGroup[] = rawFaqs.map((g) => ({
    group: g.group,
    items: g.items.map((i) => ({ q: i.q, aHtml: markdownInline(str(i.a)) })),
  }));

  if (problems.length) {
    throw new ContentError(`Some content needs fixing before the site can be built:\n  - ${problems.join("\n  - ")}`);
  }

  activities.sort((a, b) => a.starts.localeCompare(b.starts));

  return { organisation, settings, categories, activities, programmes, articles, policies, impact, faqs };
}
