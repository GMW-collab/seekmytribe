// Tiny, dependency-free HTML templating with escaping by default.
//
//   html`<p>${userText}</p>`         -> userText is escaped
//   html`<div>${raw(trustedHtml)}</div>` -> inserted as-is
//   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>` -> arrays are joined

export class SafeHtml {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

export function raw(value: string): SafeHtml {
  return new SafeHtml(value);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

type Interpolation = SafeHtml | string | number | boolean | null | undefined | Interpolation[];

function render(value: Interpolation): string {
  if (value === null || value === undefined || value === false || value === true) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += render(values[i] as Interpolation);
  });
  return new SafeHtml(out);
}

/** Join class names, skipping empty ones. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
