// Progressive enhancement only. Every page and form works without this file.

// ------------------------------------------------------------ Mobile menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("site-nav");
if (toggle && nav) {
  document.documentElement.classList.add("has-nav-toggle");
  toggle.hidden = false;
  nav.dataset.open = "false";
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav.dataset.open = String(open);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      toggle.setAttribute("aria-expanded", "false");
      nav.dataset.open = "false";
      toggle.focus();
    }
  });
}

// ------------------------------------------------------------ Print button
document.querySelectorAll("[data-print]").forEach((btn) => {
  btn.hidden = false;
  btn.addEventListener("click", () => window.print());
});

// ------------------------------------------------------------ Contact prefill (?about=activity-slug)
const about = new URLSearchParams(location.search).get("about");
if (about && /^[a-z0-9-]{1,120}$/.test(about)) {
  document.querySelectorAll('form[data-form="contact"]').forEach((form) => {
    const hidden = form.querySelector('input[name="activity"]');
    if (hidden) hidden.value = about;
    const topic = form.querySelector('select[name="topic"]');
    if (topic && !topic.value) topic.value = "activity";
  });
}

// ------------------------------------------------------------ Forms
function fieldLabel(form, name) {
  const wrap = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
  const label = wrap?.querySelector("legend, label");
  return (label?.textContent || name).trim();
}

function clearErrors(form) {
  form.querySelectorAll(".field--invalid").forEach((el) => el.classList.remove("field--invalid"));
  form.querySelectorAll("[data-error-for]").forEach((el) => { el.hidden = true; el.textContent = ""; });
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  const summary = form.querySelector(".form__summary");
  if (summary) { summary.hidden = true; summary.querySelector("ul").innerHTML = ""; }
  const status = form.querySelector(".form__status");
  if (status) { status.textContent = ""; status.classList.remove("form__status--error"); }
}

function showErrors(form, errors) {
  const summary = form.querySelector(".form__summary");
  const list = summary.querySelector("ul");
  for (const [name, message] of Object.entries(errors)) {
    const wrap = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!wrap) continue;
    wrap.classList.add("field--invalid");
    const err = wrap.querySelector("[data-error-for]");
    if (err) { err.textContent = message; err.hidden = false; }
    const control = wrap.querySelector("input, select, textarea");
    if (control) control.setAttribute("aria-invalid", "true");
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${control?.id || ""}`;
    a.textContent = message;
    a.addEventListener("click", (e) => { e.preventDefault(); control?.focus(); });
    li.append(a);
    list.append(li);
  }
  summary.hidden = false;
  summary.focus();
}

// Mirror the server's required-field checks so people get instant feedback.
// The server still validates everything.
function clientErrors(form) {
  const errors = {};
  form.querySelectorAll("[data-field]").forEach((wrap) => {
    const name = wrap.dataset.field;
    const controls = [...wrap.querySelectorAll("input, select, textarea")];
    const first = controls[0];
    if (!first) return;
    if (first.type === "checkbox" && controls.length === 1) {
      if (first.required && !first.checked) errors[name] = "Tick this box to continue.";
      return;
    }
    if (first.type === "radio" || first.type === "checkbox") {
      if (wrap.dataset.required === "true" && !controls.some((c) => c.checked)) {
        errors[name] = wrap.dataset.requiredMessage || `Choose an option for ${fieldLabel(form, name).replace(/\?$/, "").toLowerCase()}.`;
      }
      return;
    }
    const value = first.value.trim();
    if (first.required && !value) {
      errors[name] = wrap.dataset.requiredMessage || (first.type === "email" ? "Enter your email address." : `Enter ${fieldLabel(form, name).toLowerCase()}.`);
    } else if (first.type === "email" && value && !first.checkValidity()) {
      errors[name] = "Enter an email address in the format name@example.com.";
    }
  });
  return errors;
}

document.querySelectorAll("form[data-enhance]").forEach((form) => {
  form.noValidate = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(form);
    const local = clientErrors(form);
    if (Object.keys(local).length) { showErrors(form, local); return; }

    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector(".form__status");
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
    status.textContent = "Sending…";

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(new FormData(form)),
      });
      const data = await res.json().catch(() => ({ ok: false, message: "Something went wrong. Please try again." }));
      if (data.ok && data.redirect) { location.assign(data.redirect); return; }
      status.textContent = "";
      if (data.errors) showErrors(form, data.errors);
      else { status.textContent = data.message; status.classList.add("form__status--error"); status.setAttribute("tabindex", "-1"); status.focus(); }
    } catch {
      status.textContent = "We couldn't reach the server. Check your connection and try again.";
      status.classList.add("form__status--error");
    } finally {
      button.removeAttribute("aria-busy");
      button.disabled = false;
    }
  });
});
