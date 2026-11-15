// @loop/ui screens behaviour — ports the Main.dc.html component logic (feed loop, pause, reveal, tilt,
// scroll spy, tabs/parts, 3D rotation) to plain DOM. Loaded as a classic script; no dependencies.
(() => {
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Theme: the design switches with [data-theme]; follow the OS setting.
  const root = document.documentElement;
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const setTheme = () => root.setAttribute("data-theme", scheme.matches ? "dark" : "light");
  setTheme(); scheme.addEventListener?.("change", setTheme);

  // Feed: endless upward scroll (componentDidMount loop). Items are doubled so the loop is seamless.
  $$("[data-sv-feed]").forEach((feed) => {
    feed.innerHTML += feed.innerHTML;
    const pause = document.querySelector(`[data-sv-pause="${feed.id}"]`);
    let y = 0, paused = rm;
    const label = () => { if (!pause) return; pause.textContent = paused ? pause.dataset.play : pause.dataset.pause; pause.setAttribute("aria-pressed", String(paused)); };
    if (pause) { pause.addEventListener("click", () => { paused = !paused; label(); }); label(); }
    const speed = +feed.dataset.svFeed || 0.5;
    const loop = () => {
      if (!paused && document.visibilityState === "visible") {
        y -= speed; const half = feed.scrollHeight / 2;
        if (half && -y >= half) y += half;
        feed.style.transform = `translateY(${y}px)`;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  // Reveal on scroll (setupReveal): fade up 24px, stagger of 90 ms in groups of three.
  if (!rm && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.style.opacity = 1; e.target.style.transform = "none"; io.unobserve(e.target); }
    }), { threshold: 0.1 });
    $$("[data-reveal]").forEach((el, i) => {
      el.style.opacity = 0; el.style.transform = "translateY(24px)";
      el.style.transition = `opacity .8s var(--ease-standard) ${(i % 3) * 90}ms, transform .8s var(--ease-standard) ${(i % 3) * 90}ms`;
      io.observe(el);
    });
  }

  // Tilt (stories): follow the pointer, ease back on leave.
  $$("[data-sv-tilt]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = "transform .1s linear";
      el.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.02)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transition = "transform .6s var(--ease-standard)"; el.style.transform = "none"; });
  });

  // Scroll spy: TOC links and header tabs get aria-current for the section in view (onScroll, 35% line).
  const spies = $$("[data-sv-spy] a[href^='#']");
  if (spies.length) {
    const ids = [...new Set(spies.map((a) => a.hash.slice(1)))].map((id) => document.getElementById(id)).filter(Boolean);
    const onScroll = () => {
      let cur = null;
      for (const s of ids) if (s.getBoundingClientRect().top < innerHeight * 0.35) cur = s.id;
      spies.forEach((a) => a.setAttribute("aria-current", String(a.hash.slice(1) === cur)));
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  // Tabs (segmented control and parts grid): buttons[role=tab] show one [role=tabpanel]; panel swap fades (swapChat).
  $$("[data-sv-tabs]").forEach((group) => {
    const tabs = $$("[role=tab]", group);
    const fade = group.dataset.svTabs === "fade";
    const show = (tab) => {
      const stage = document.querySelector(`[data-sv-stage="${group.id}"]`); if (stage) stage.textContent = tab.dataset.head || tab.textContent;
      const apply = () => tabs.forEach((t) => {
        const on = t === tab; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
        const p = document.getElementById(t.getAttribute("aria-controls")); if (p) p.hidden = !on;
      });
      const panel = document.getElementById(tab.getAttribute("aria-controls"))?.parentElement;
      if (!fade || rm || !panel) { apply(); return; }
      panel.style.opacity = 0; panel.style.transform = "translateY(10px)";
      setTimeout(() => { apply(); requestAnimationFrame(() => { panel.style.opacity = 1; panel.style.transform = "none"; }); }, 220);
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => t.getAttribute("aria-selected") !== "true" && show(t));
      t.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); show(n); }
      });
    });
  });

  // 3D stage rotation (slider → rotateY/rotateX).
  $$("[data-sv-rotate]").forEach((input) => {
    const card = document.getElementById(input.dataset.svRotate);
    const set = () => { const v = +input.value; card.style.transform = `rotateY(${(v - 50) * 0.4}deg) rotateX(${Math.abs(v - 50) * 0.12}deg)`; };
    input.addEventListener("input", set); set();
  });
})();
