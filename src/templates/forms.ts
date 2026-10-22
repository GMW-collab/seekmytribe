import { html, raw, type SafeHtml } from "../lib/html.ts";
import type { FieldDef } from "../forms/definitions.ts";
import { HONEYPOT_FIELD, TOKEN_FIELD } from "../forms/spam.ts";
import type { Ctx } from "./context.ts";

/** Replaced per request by the server with a freshly signed token. */
export const TOKEN_PLACEHOLDER = "__FORM_TOKEN__";

interface FormOptions {
  compact?: boolean;
  idPrefix?: string;
  /** Prefill hidden context, e.g. the activity someone is asking about. */
  hidden?: Record<string, string>;
}

function describedBy(...ids: Array<string | false | undefined>): SafeHtml {
  const list = ids.filter(Boolean).join(" ");
  return list ? raw(` aria-describedby="${list}"`) : raw("");
}

function renderField(f: FieldDef, id: string, compact: boolean): SafeHtml {
  if (f.type === "hidden") return raw("");
  const helpId = f.help ? `${id}-help` : undefined;
  const errId = `${id}-error`;
  const req = f.required ? raw(" required") : raw("");
  const help = f.help ? html`<p class="field__help" id="${helpId}">${f.help}</p>` : raw("");
  const error = html`<p class="field__error" id="${errId}" data-error-for="${f.name}" hidden></p>`;

  if (f.type === "checkboxes" || f.type === "radio") {
    const type = f.type === "radio" ? "radio" : "checkbox";
    return html`<fieldset class="field field--choices" data-field="${f.name}" data-required="${f.required ? "true" : "false"}" data-required-message="${f.requiredMessage ?? ""}"${describedBy(helpId, errId)}>
      <legend class="field__label">${f.label}</legend>
      ${help}${error}
      <div class="choices${(f.options?.length ?? 0) > 4 ? " choices--columns" : ""}">
        ${(f.options ?? []).map((o, i) => html`<div class="choice">
          <input type="${type}" id="${id}-${i}" name="${f.name}" value="${o.value}"${f.type === "radio" && f.required ? raw(" required") : raw("")}>
          <label for="${id}-${i}">${o.label}</label>
        </div>`)}
      </div>
    </fieldset>`;
  }

  if (f.type === "consent") {
    return html`<div class="field field--consent" data-field="${f.name}">
      ${error}
      <div class="choice">
        <input type="checkbox" id="${id}" name="${f.name}" value="yes"${req}${describedBy(errId)}>
        <label for="${id}">${f.label}</label>
      </div>
    </div>`;
  }

  const label = html`<label class="field__label${compact ? " visually-hidden" : ""}" for="${id}">${f.label}</label>`;
  const common = html` id="${id}" name="${f.name}"${req}${f.maxLength ? raw(` maxlength="${f.maxLength}"`) : raw("")}${f.autocomplete ? raw(` autocomplete="${f.autocomplete}"`) : raw("")}${describedBy(helpId, errId)}`;

  let control: SafeHtml;
  if (f.type === "textarea") control = html`<textarea${common} rows="5"></textarea>`;
  else if (f.type === "select") {
    control = html`<select${common}>
      ${f.options?.[0]?.value === "" ? raw("") : html`<option value="">Choose one</option>`}
      ${(f.options ?? []).map((o) => html`<option value="${o.value}">${o.label}</option>`)}
    </select>`;
  } else {
    control = html`<input type="${f.type}"${common}${compact ? raw(` placeholder="${f.label}"`) : raw("")}${f.type === "email" ? raw(' spellcheck="false" inputmode="email"') : raw("")}>`;
  }

  return html`<div class="field" data-field="${f.name}" data-required-message="${f.requiredMessage ?? ""}">${label}${help}${error}${control}</div>`;
}

export function renderForm(ctx: Ctx, formId: string, opts: FormOptions = {}): SafeHtml {
  const def = ctx.forms[formId];
  if (!def) throw new Error(`Unknown form ${formId}`);
  const prefix = opts.idPrefix ?? "";
  const compact = Boolean(opts.compact);
  const fields = compact ? def.fields.filter((f) => f.required) : def.fields;

  return html`<form class="form${compact ? " form--compact" : ""}" method="post" action="/api/forms/${def.id}" data-enhance data-form="${def.id}" accept-charset="utf-8">
    <div class="form__summary" role="alert" tabindex="-1" hidden>
      <h3 class="form__summary-title">There's a problem</h3>
      <ul class="form__summary-list"></ul>
    </div>
    <div class="form__status" role="status" aria-live="polite"></div>
    ${fields.map((f) => renderField(f, `${prefix}${def.id}-${f.name}`, compact))}
    <div class="form__trap" aria-hidden="true">
      <label for="${prefix}${def.id}-${HONEYPOT_FIELD}">Leave this empty</label>
      <input type="text" id="${prefix}${def.id}-${HONEYPOT_FIELD}" name="${HONEYPOT_FIELD}" tabindex="-1" autocomplete="off">
    </div>
    <input type="hidden" name="${TOKEN_FIELD}" value="${TOKEN_PLACEHOLDER}">
    ${def.fields.filter((f) => f.type === "hidden").map((f) => html`<input type="hidden" name="${f.name}" value="${opts.hidden?.[f.name] ?? ""}" data-hidden-field>`)}
    ${compact ? raw("") : html`<p class="form__privacy">We'll only use what you send for the reason above. See our <a href="/privacy/">privacy notice</a>.</p>`}
    <button class="button" type="submit">${def.submitLabel}</button>
  </form>`;
}
