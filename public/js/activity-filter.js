// Shared by the activities page (in the browser) and the test suite (in Node).
// Plain JavaScript on purpose: no build step, works on older browsers that
// support ES modules.

/**
 * @typedef {Object} ActivitySummary
 * @property {string} slug
 * @property {string} url
 * @property {string} title
 * @property {string} summary
 * @property {string} category
 * @property {string} categoryName
 * @property {string} area
 * @property {string} starts     "YYYY-MM-DDTHH:MM", UK local time
 * @property {string} [ends]
 * @property {string} [repeats]
 * @property {string} costType   free | pay-what-you-can | subsidised | paid
 * @property {string} status     published | full | cancelled
 * @property {string[]} accessTags
 */

/**
 * @typedef {Object} Criteria
 * @property {string} [q]         free text
 * @property {string} [category]  category id, or "" for all
 * @property {string} [area]      area name, or "" for all
 * @property {string} [cost]      "" | "free" (free or pay-what-you-can) | "any"
 * @property {string} [when]      "" | "week" | "month"
 * @property {string[]} [access]  all listed tags must be present
 */

export const ACCESS_TAGS = {
  "step-free": "Step-free access",
  "accessible-toilet": "Accessible toilet",
  "seating": "Seating available",
  "quiet": "Quieter setting",
  "hearing-loop": "Hearing loop",
  "bsl": "BSL interpretation",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse "YYYY-MM-DDTHH:MM" as a wall-clock time. Comparisons use the same convention for "now". */
export function toWallClockMs(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** Current UK wall-clock time as comparable milliseconds. */
export function ukNowMs(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  return toWallClockMs(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`);
}

/** Has this activity finished? An activity with no end is treated as finished 3 hours after it starts. */
export function isPast(activity, nowMs) {
  const end = activity.ends ? toWallClockMs(activity.ends) : toWallClockMs(activity.starts) + 3 * 60 * 60 * 1000;
  return end < nowMs;
}

/**
 * Filter and sort activities. Past and cancelled activities are dropped.
 * @param {ActivitySummary[]} list
 * @param {Criteria} criteria
 * @param {number} nowMs  from ukNowMs()
 * @returns {ActivitySummary[]}
 */
export function filterActivities(list, criteria, nowMs) {
  const q = (criteria.q || "").trim().toLowerCase();
  const words = q ? q.split(/\s+/) : [];
  const access = criteria.access || [];

  return list
    .filter((a) => a.status !== "cancelled")
    .filter((a) => !isPast(a, nowMs))
    .filter((a) => !criteria.category || a.category === criteria.category)
    .filter((a) => !criteria.area || a.area === criteria.area)
    .filter((a) => criteria.cost !== "free" || a.costType === "free" || a.costType === "pay-what-you-can")
    .filter((a) => {
      if (!criteria.when) return true;
      const start = toWallClockMs(a.starts);
      const limit = nowMs + (criteria.when === "week" ? 7 : 31) * DAY_MS;
      return start <= limit;
    })
    .filter((a) => access.every((tag) => a.accessTags.includes(tag)))
    .filter((a) => {
      if (!words.length) return true;
      const haystack = `${a.title} ${a.summary} ${a.categoryName} ${a.area}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => a.starts.localeCompare(b.starts));
}

/** Read criteria from a URLSearchParams, so filtered views can be bookmarked and shared. */
export function criteriaFromParams(params) {
  return {
    q: params.get("q") || "",
    category: params.get("category") || "",
    area: params.get("area") || "",
    cost: params.get("cost") || "",
    when: params.get("when") || "",
    access: params.getAll("access").filter((t) => t in ACCESS_TAGS),
  };
}

/** Friendly date like "Sat 14 Nov, 10:00". */
export function formatWhen(starts) {
  const ms = toWallClockMs(starts);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${date}, ${time}`;
}

export const COST_LABELS = {
  "free": "Free",
  "pay-what-you-can": "Pay what you can",
  "subsidised": "Low cost",
  "paid": "Paid",
};
