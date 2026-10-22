// Live filtering for /activities/. Without JavaScript, every activity is listed.
import { filterActivities, criteriaFromParams, ukNowMs } from "./activity-filter.js";

const form = document.querySelector("[data-filters]");
const results = document.querySelector("[data-results]");
const count = document.querySelector("[data-results-count]");
const none = document.querySelector("[data-no-results]");

if (form && results) {
  const cards = new Map(
    [...results.querySelectorAll(".activity-card")].map((card) => [card.querySelector("a").getAttribute("href"), card]),
  );
  const all = await fetch("/activities.json").then((r) => r.json()).catch(() => null);

  function apply(push) {
    if (!all) return;
    const params = new URLSearchParams(new FormData(form));
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    const matches = filterActivities(all, criteriaFromParams(params), ukNowMs());
    const keep = new Set(matches.map((a) => a.url));
    for (const [url, card] of cards) card.hidden = !keep.has(url);
    // Keep DOM order matching sort order.
    matches.forEach((a) => { const c = cards.get(a.url); if (c) results.append(c); });
    count.textContent = `${matches.length} ${matches.length === 1 ? "activity" : "activities"}`;
    none.hidden = matches.length > 0;
    if (push) history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
  }

  // Restore filters from the URL so filtered views can be shared.
  const initial = new URLSearchParams(location.search);
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") el.checked = initial.getAll(el.name).includes(el.value);
    else if (initial.has(el.name)) el.value = initial.get(el.name);
  }

  form.addEventListener("input", () => apply(true));
  form.addEventListener("change", () => apply(true));
  form.addEventListener("submit", (e) => { e.preventDefault(); apply(true); results.querySelector(".activity-card:not([hidden]) a")?.focus(); });
  form.querySelector('button[type="submit"]').textContent = "Show matching activities";
  apply(false);
}
