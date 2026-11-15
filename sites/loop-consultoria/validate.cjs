// Acceptance checks for the landing page (criteria in README.md). Usage: node validate.cjs <url>
const { chromium } = require("playwright");
const LIMITS = { "hero.title": 48, "hero.subtitle": 110, "section.title": 32, "card.label": 16, "card.title": 28, "card.desc": 64, "feature.title": 52, "cta.label": 22, "nav.item": 16, "footer.link": 24 };
(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch(process.env.HTTPS_PROXY && !/localhost/.test(url) ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const results = [];
  const check = (id, ok, detail = "") => results.push({ id, ok: !!ok, detail });
  for (const vp of [{ w: 1440, h: 900 }, { w: 390, h: 844 }, { w: 320, h: 640 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
    const res = await page.goto(url, { waitUntil: "networkidle" });
    const m = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const h1 = [...document.querySelectorAll("h1")];
      const cta = document.querySelector('[data-cta="hero"]');
      return {
        scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h1: h1.length, h1Bottom: h1[0] ? r(h1[0]).bottom : 9999, ctaBottom: cta ? r(cta).bottom : 9999,
        smallTargets: [...document.querySelectorAll("a.btn,button.btn,summary,.nav-links a")].filter((e) => r(e).height && r(e).height < 36).length,
        imgsNoAlt: [...document.querySelectorAll("img:not([alt])")].length,
      };
    });
    const tag = `${vp.w}px`;
    check(`${tag} status 200`, res.status() === 200, String(res.status()));
    check(`${tag} no horizontal scroll`, m.scrollX <= 0, `overflow ${m.scrollX}px`);
    check(`${tag} one h1`, m.h1 === 1, String(m.h1));
    if (vp.w !== 320) check(`${tag} headline and primary CTA above the fold`, m.h1Bottom <= vp.h && m.ctaBottom <= vp.h, `h1 ${Math.round(m.h1Bottom)} cta ${Math.round(m.ctaBottom)} fold ${vp.h}`);
    check(`${tag} touch targets >= 36px`, m.smallTargets === 0, String(m.smallTargets));
    check(`${tag} no console errors`, errors.length === 0, errors.join(" | "));
    if (vp.w === 1440) {
      const slots = await page.evaluate(() => [...document.querySelectorAll("[data-slot]")].map((e) => [e.dataset.slot, e.textContent.trim()]));
      const over = slots.filter(([s, t]) => LIMITS[s] && t.length > LIMITS[s]);
      check("copy within limits", over.length === 0, over.map(([s, t]) => `${s}(${t.length}) ${t}`).join(" | "));
      const ctas = slots.filter(([s]) => s === "cta.label").map(([, t]) => t);
      check("CTA labels start with a verb", ctas.every((t) => /^(Agendar|Ver|Testar)\b/.test(t)), ctas.join(", "));
      check("primary CTA repeated (nav, hero, form)", (await page.locator("[data-cta]").count()) === 3);
      // keyboard: the skip link is the first focus stop (checked before any other interaction)
      await page.keyboard.press("Tab");
      check("skip link is first focus", await page.evaluate(() => document.activeElement?.className === "skip"));
      // simulator reacts
      const before = await page.locator("#k-util").innerText();
      await page.locator("#s-a").fill("60");
      check("simulator reacts to input", (await page.locator("#k-util").innerText()) !== before);
      // form validation and submit
      await page.locator("#lead button").click();
      check("form blocks empty submit", /Informe/.test(await page.locator("#form-msg").innerText()));
      if (process.argv[3] === "--submit") {
        await page.fill('[name="name"]', "Teste automatizado"); await page.fill('[name="company"]', "Validação Loop"); await page.fill('[name="email"]', "teste@example.com"); await page.fill('[name="message"]', "Envio de verificação. Pode apagar.");
        await page.check('[name="consent"]'); await page.locator("#lead button").click();
        await page.waitForFunction(() => document.getElementById("form-msg").className.includes("ok") || document.getElementById("form-msg").className.includes("err"), null, { timeout: 15000 });
        check("form submits and confirms", (await page.locator("#form-msg").getAttribute("class")).includes("ok"), await page.locator("#form-msg").innerText());
      }
      const size = (await res.body()).length;
      check("HTML under 60 KB", size < 60000, `${size} bytes`);
    }
    await ctx.close();
  }
  await browser.close();
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
