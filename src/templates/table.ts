// The signature illustration: a round table seen from above, with people in
// different colours around it and one marigold chair pulled out, waiting.
// Generated as inline SVG so it is crisp, tiny and themeable.

import { raw, type SafeHtml } from "../lib/html.ts";

interface TableOptions {
  seats?: number;
  /** Which seat (0 = top, clockwise) is the empty, pulled-out marigold chair. -1 for none. */
  emptySeat?: number;
  /** "people": everyone seated. "waiting": table laid, nobody there yet. */
  variant?: "people" | "waiting";
  label: string;
  className?: string;
}

const PERSON_COLOURS = ["var(--c-green)", "var(--c-lilac-deep)", "var(--c-sky)", "var(--c-brick)", "var(--c-ink-soft)", "var(--c-moss)"];

export function tableIllustration(opts: TableOptions): SafeHtml {
  const seats = opts.seats ?? 8;
  const empty = opts.emptySeat ?? 2;
  const variant = opts.variant ?? "people";
  const cx = 200;
  const cy = 200;
  const tableR = 92;
  const chairR = 138;
  const parts: string[] = [];

  for (let i = 0; i < seats; i++) {
    const angle = (i / seats) * Math.PI * 2 - Math.PI / 2;
    const isEmpty = i === empty;
    const dist = isEmpty ? chairR + 26 : chairR;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const deg = (angle * 180) / Math.PI + 90;
    const tilt = isEmpty ? 14 : 0;

    // In each seat's local coordinates, +y points towards the table centre.
    // Chair: a rounded seat with a back rest on the outer side.
    const chairFill = isEmpty ? "var(--c-marigold)" : "var(--c-chair)";
    const person = PERSON_COLOURS[i % PERSON_COLOURS.length];
    parts.push(
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(deg + tilt).toFixed(1)})" class="${isEmpty ? "seat seat--open" : "seat"}"><g class="seat__body">` +
        `<rect x="-24" y="-18" width="48" height="40" rx="12" fill="${chairFill}"/>` +
        `<rect x="-27" y="-30" width="54" height="12" rx="6" fill="${chairFill}"/>` +
        (variant === "people" && !isEmpty
          ? // shoulders, arms resting towards the table, then head
            `<ellipse cx="0" cy="-4" rx="25" ry="13" fill="${person}"/>` +
            `<rect x="-24" y="-4" width="10" height="26" rx="5" fill="${person}"/>` +
            `<rect x="14" y="-4" width="10" height="26" rx="5" fill="${person}"/>` +
            `<circle cx="0" cy="-4" r="11" fill="#000" fill-opacity="0.22"/>`
          : "") +
      `</g></g>`,
    );
  }

  // Table top and what's on it.
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${tableR}" fill="var(--c-table)"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${tableR - 10}" fill="none" stroke="var(--c-table-edge)" stroke-width="2"/>`);
  for (let i = 0; i < seats; i++) {
    const angle = (i / seats) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * (tableR - 30);
    const py = cy + Math.sin(angle) * (tableR - 30);
    parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13" fill="var(--c-plate)"/>`);
    parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7" fill="none" stroke="var(--c-plate-rim)" stroke-width="1.5"/>`);
  }
  // A shared dish in the middle.
  parts.push(`<circle cx="${cx}" cy="${cy}" r="24" fill="var(--c-marigold)" opacity="0.9"/>`);
  parts.push(`<circle cx="${cx - 8}" cy="${cy - 5}" r="6" fill="var(--c-green)"/>`);
  parts.push(`<circle cx="${cx + 7}" cy="${cy + 6}" r="5" fill="var(--c-brick)"/>`);
  parts.push(`<circle cx="${cx + 6}" cy="${cy - 9}" r="4" fill="var(--c-green)"/>`);

  return raw(
    `<svg class="table-illustration ${opts.className ?? ""}" viewBox="0 0 400 400" ${opts.label ? `role="img" aria-label="${opts.label}"` : 'aria-hidden="true"'} focusable="false">${parts.join("")}</svg>`,
  );
}
