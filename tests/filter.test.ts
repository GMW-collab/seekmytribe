import { test } from "node:test";
import assert from "node:assert/strict";
import { filterActivities, criteriaFromParams, toWallClockMs, isPast, formatWhen } from "../public/js/activity-filter.js";

const base = { summary: "", categoryName: "", repeats: undefined, ends: undefined, status: "published", accessTags: [] as string[] };
const list = [
  { ...base, slug: "a", url: "/a/", title: "River walk", category: "walking-outdoors", categoryName: "Walking", area: "Hackney", starts: "2030-06-02T10:00", costType: "free", accessTags: ["step-free"] },
  { ...base, slug: "b", url: "/b/", title: "Supper club", category: "shared-meals", categoryName: "Meals", area: "Islington", starts: "2030-06-20T18:30", costType: "paid" },
  { ...base, slug: "c", url: "/c/", title: "Old walk", category: "walking-outdoors", area: "Hackney", starts: "2030-05-01T10:00", costType: "free" },
  { ...base, slug: "d", url: "/d/", title: "Called off", category: "games", area: "Hackney", starts: "2030-06-03T10:00", costType: "free", status: "cancelled" },
  { ...base, slug: "e", url: "/e/", title: "Craft table", category: "creative-making", area: "Hackney", starts: "2030-06-01T14:00", costType: "pay-what-you-can" },
];
const now = toWallClockMs("2030-06-01T09:00");

test("past and cancelled activities are hidden, the rest sorted by date", () => {
  assert.deepEqual(filterActivities(list, {}, now).map((a) => a.slug), ["e", "a", "b"]);
});

test("filters combine", () => {
  assert.deepEqual(filterActivities(list, { area: "Hackney", cost: "free" }, now).map((a) => a.slug), ["e", "a"]);
  assert.deepEqual(filterActivities(list, { category: "shared-meals" }, now).map((a) => a.slug), ["b"]);
  assert.deepEqual(filterActivities(list, { access: ["step-free"] }, now).map((a) => a.slug), ["a"]);
  assert.deepEqual(filterActivities(list, { when: "week" }, now).map((a) => a.slug), ["e", "a"]);
});

test("text search matches every word, case-insensitively", () => {
  assert.deepEqual(filterActivities(list, { q: "WALK hackney" }, now).map((a) => a.slug), ["a"]);
  assert.deepEqual(filterActivities(list, { q: "walk islington" }, now), []);
});

test("criteria survive a round trip through the URL and ignore unknown access tags", () => {
  const c = criteriaFromParams(new URLSearchParams("q=walk&access=step-free&access=bogus&cost=free"));
  assert.deepEqual(c.access, ["step-free"]);
  assert.equal(c.q, "walk");
});

test("an activity without an end time counts as running for three hours", () => {
  const a = { ...list[0]!, starts: "2030-06-01T08:00" };
  assert.equal(isPast(a, toWallClockMs("2030-06-01T10:59")), false);
  assert.equal(isPast(a, toWallClockMs("2030-06-01T11:01")), true);
});

test("dates are shown in plain UK format", () => {
  assert.equal(formatWhen("2030-06-02T10:00"), "Sun 2 Jun, 10:00");
});
