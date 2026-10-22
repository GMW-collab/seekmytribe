"""Browser checks for the Seek My Tribe site, using Playwright (Python).

Run:  pip install playwright && playwright install chromium
      npm run build:preview
      python3 scripts/browser_checks.py

Starts the real server against /dist (plus a fixture build for the activity
filters), then checks every page in a real browser. Exits non-zero on failure.
"""
import json, os, re, subprocess, sys, time, pathlib, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "qa-output"
SHOTS.mkdir(exist_ok=True)
MAIN, FIX = 8095, 8096
failures = []

def fail(msg):
    failures.append(msg)
    print("  FAIL", msg)

def wait(port):
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=1); return
        except Exception:
            time.sleep(0.25)
    raise SystemExit(f"server on {port} did not start")

env = {**os.environ, "PORT": str(MAIN)}
env.pop("RESEND_API_KEY", None)
procs = [
    subprocess.Popen(["node", "src/server.ts"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
    subprocess.Popen(["node", "scripts/serve-fixture.ts"], cwd=ROOT, env={**os.environ, "PORT": str(FIX)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
]
try:
    wait(MAIN); wait(FIX)
    sitemap = (ROOT / "dist" / "sitemap.xml").read_text()
    paths = [re.sub(r"^https?://[^/]+", "", u) for u in re.findall(r"<loc>([^<]+)</loc>", sitemap)]
    paths += ["/thanks/contact/", "/partners/programmes/the-open-table/"]

    CONTRAST_JS = """
    () => {
      const lum = (c) => { const [r,g,b] = c.map(v => { v/=255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4 }); return .2126*r+.7152*g+.0722*b };
      const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0,3), a: p.length > 3 ? p[3] : 1 } };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b.a > 0.5) return b.rgb; } return [255,255,255] };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const t = walker.currentNode; const el = t.parentElement;
        if (!el || seen.has(el) || !t.textContent.trim()) continue; seen.add(el);
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || el.closest('[hidden],[aria-hidden="true"],.visually-hidden,.form__trap,.skip-link,svg')) continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const fg = parse(cs.color).rgb, bg = bgOf(el);
        const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
        const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
        if (ratio < need) out.push(`${ratio.toFixed(2)} < ${need}: "${t.textContent.trim().slice(0,40)}"`);
      }
      return out;
    }"""

    with sync_playwright() as p:
        browser = p.chromium.launch()

        print("Every page at 320px and 1280px")
        for width in (320, 1280):
            page = browser.new_page(viewport={"width": width, "height": 800}, reduced_motion="reduce")
            for path in paths:
                resp = page.goto(f"http://127.0.0.1:{MAIN}{path}")
                if resp.status != 200: fail(f"{path} returned {resp.status}")
                overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if overflow > 1: fail(f"{path} scrolls sideways by {overflow}px at {width}px")
                if width == 1280:
                    for problem in page.evaluate(CONTRAST_JS): fail(f"{path} contrast {problem}")
                    unlabeled = page.evaluate("[...document.querySelectorAll('svg[role=img]')].filter(s => !s.getAttribute('aria-label')).length")
                    if unlabeled: fail(f"{path} has {unlabeled} unlabelled images")
                    empty_links = page.evaluate("[...document.querySelectorAll('a')].filter(a => !a.textContent.trim() && !a.getAttribute('aria-label')).length")
                    if empty_links: fail(f"{path} has {empty_links} links without text")
            page.close()

        print("Keyboard: skip link and visible focus")
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"http://127.0.0.1:{MAIN}/")
        page.keyboard.press("Tab")
        if page.evaluate("document.activeElement.className") != "skip-link": fail("first Tab does not reach the skip link")
        page.keyboard.press("Tab")
        style = page.evaluate("(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth })()")
        if style.startswith("none") or style.endswith(" 0px"): fail(f"no visible focus outline ({style})")
        page.close()

        print("Mobile menu")
        page = browser.new_page(viewport={"width": 390, "height": 800})
        page.goto(f"http://127.0.0.1:{MAIN}/")
        if page.is_visible("#site-nav"): fail("mobile nav should start closed")
        page.click(".nav-toggle")
        if not page.is_visible("#site-nav"): fail("menu button does not open nav")
        if page.get_attribute(".nav-toggle", "aria-expanded") != "true": fail("aria-expanded not updated")
        page.keyboard.press("Escape")
        if page.is_visible("#site-nav"): fail("Escape does not close nav")
        page.screenshot(path=str(SHOTS / "mobile-menu.png"))
        page.close()

        print("Contact form: errors, then honest 'not set up' message")
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{MAIN}/contact/")
        form = "main form[data-form=contact]"
        page.click(f"{form} button[type=submit]")
        if not page.is_visible(f"{form} .form__summary"): fail("error summary not shown")
        if page.evaluate("document.activeElement.className") != "form__summary": fail("focus not moved to error summary")
        if page.get_attribute(f"{form} #contact-email", "aria-invalid") != "true": fail("aria-invalid not set on email")
        page.screenshot(path=str(SHOTS / "contact-errors.png"), full_page=False)
        page.fill(f"{form} #contact-name", "Test Person")
        page.fill(f"{form} #contact-email", "test@example.org")
        page.select_option(f"{form} #contact-topic", "general")
        page.fill(f"{form} #contact-message", "Browser check")
        page.wait_for_timeout(3200)  # tokens younger than 3s are rejected as bot-like
        page.click(f"{form} button[type=submit]")
        page.wait_for_selector(f"{form} .form__status--error", timeout=5000)
        text = page.text_content(f"{form} .form__status")
        if "isn't switched on yet" not in text: fail(f"unexpected status: {text}")
        page.close()

        print("Activity filters (fixture build)")
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{FIX}/activities/")
        page.wait_for_function("document.querySelector('[data-results-count]').textContent.includes('2')")
        page.select_option("#f-area", "Otherton")
        page.wait_for_function("document.querySelector('[data-results-count]').textContent.startsWith('1 ')")
        if "area=Otherton" not in page.url: fail("filters not reflected in URL")
        page.check("#f-cost")
        page.wait_for_function("document.querySelector('[data-results-count]').textContent.startsWith('0 ')")
        if not page.is_visible("[data-no-results]"): fail("no-results message not shown")
        page.goto(f"http://127.0.0.1:{FIX}/activities/?area=Testville")
        page.wait_for_function("document.querySelector('[data-results-count]').textContent.startsWith('1 ')")
        page.goto(f"http://127.0.0.1:{FIX}/activities/")
        page.screenshot(path=str(SHOTS / "activities-with-fixtures.png"), full_page=True)
        page.goto(f"http://127.0.0.1:{FIX}/activities/supper-club/")
        page.screenshot(path=str(SHOTS / "activity-detail-fixture.png"), full_page=True)
        page.close()
        browser.close()
finally:
    for pr in procs: pr.terminate()

print(f"\n{len(failures)} problem(s) found" if failures else "\nAll browser checks passed")
sys.exit(1 if failures else 0)
