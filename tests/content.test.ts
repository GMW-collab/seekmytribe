import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadContent, validateActivity, validateProgramme, splitFrontmatter } from "../src/lib/content.ts";
import { assertLaunchReady, listUnverified, fact } from "../src/lib/facts.ts";
import { ROOT } from "./helpers.ts";

const content = loadContent(join(ROOT, "content"));

test("real content loads and contains no invented activities", () => {
  assert.equal(content.activities.length, 0, "content/activities should be empty until real activities exist");
  assert.ok(content.categories.length >= 5);
  assert.ok(content.articles.length >= 1);
});

test("no impact results are recorded without real data", () => {
  for (const m of content.impact.measures) assert.deepEqual(m.results, [], `${m.id} has results`);
});

test("no programme claims funding or partners that aren't recorded", () => {
  for (const p of content.programmes) {
    if (p.status === "draft" || p.status === "proposed") assert.deepEqual(p.funders, []);
  }
});

const cats = [{ id: "walking-outdoors", name: "Walking", description: "" }];
const good = {
  title: "Walk", summary: "s", description: "d", category: "walking-outdoors", status: "published",
  starts: "2030-01-05T10:00", area: "A", venue: { name: "Gate" }, cost: { type: "free" },
  accessibility: ["Not yet checked"], how_to_join: "just-turn-up", organiser: "O",
};

test("a valid activity passes", () => {
  const { activity, errors } = validateActivity("a-walk", good, cats);
  assert.deepEqual(errors, []);
  assert.equal(activity?.starts, "2030-01-05T10:00");
});

test("YAML dates are normalised to wall-clock strings", () => {
  const { activity } = validateActivity("a-walk", { ...good, starts: new Date("2030-01-05T10:00:00Z") }, cats);
  assert.equal(activity?.starts, "2030-01-05T10:00");
});

test("activity validation explains each problem in plain English", () => {
  const { errors } = validateActivity("Bad Name", {
    ...good, category: "nope", cost: { type: "cheap" }, accessibility: [], how_to_join: "external-booking",
    ends: "2030-01-05T09:00", capacity: 5, places_left: 9, access_tags: ["wheelchair"],
  }, cats);
  const joined = errors.join("\n");
  for (const fragment of ["file name", "category", "cost.type", "accessibility", "booking_url", "ends", "places_left", "access_tags"]) {
    assert.match(joined, new RegExp(fragment.replace(".", "\\.")), `expected an error about ${fragment}`);
  }
});

test("programmes can't be marked funded without a named funder", () => {
  const { errors } = validateProgramme("p", { title: "T", status: "funded", summary: "s", problem: "p", participants: "x", funders: [] }, "");
  assert.match(errors.join(), /funder/);
});

test("front matter must be present", () => {
  assert.throws(() => splitFrontmatter("no front matter", "x.md"), /front matter/);
});

test("production builds are blocked while launch-critical facts are unverified", () => {
  assert.throws(() => assertLaunchReady(content.organisation, content.settings), /company_number/);
  const verified = structuredClone(content.organisation);
  for (const f of Object.values(verified)) (f as { verified: boolean }).verified = true;
  const settings = structuredClone(content.settings);
  settings.services.email_provider.verified = true;
  settings.services.hosting_provider.verified = true;
  assert.doesNotThrow(() => assertLaunchReady(verified, settings));
  assert.equal(listUnverified(verified, settings).length, 0);
});

test("unverified facts are flagged in preview and hidden in production", () => {
  const f = { value: "123", verified: false, source: "s", launch: true };
  assert.match(fact(f, { mode: "preview" }).value, /To confirm/);
  assert.equal(fact(f, { mode: "production" }).value, "");
  assert.equal(fact({ ...f, verified: true }, { mode: "production" }).value, "123");
});
