/* CleanSea · widget de rastreamento de navios, montado DENTRO do protótipo (ADR-017).
 * 1) push de proximidade como banner no topo do celular do protótipo;
 * 2) card "Rastreamento ao vivo" na tela M06 Navio;
 * 3) painel completo na página do protótipo, antes do Wireflow;
 * 4) card "Acompanhamento ao vivo" com o mapa, na coluna ao lado do celular.
 * As mensagens de rastreamento têm botão de pausa: pausadas, ficam só na lista de alertas.
 * Posição AIS, rotas, ETAs e mensagens: SIMULADO. Clima: Open-Meteo quando a rede permitir, senão SIMULADO.
 * Sem dependência do runtime do protótipo: só lê o atributo data-screen-label do celular.
 */
(function () {
  "use strict";
  const CS = window.CS;
  if (!CS || !window.L) return;

  // ---------- Geometria ----------
  const R_NM = 3440.065;
  const rad = (d) => (d * Math.PI) / 180;
  function nm(a, b) {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R_NM * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
    const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const PORT = [CS.port.lat, CS.port.lon];
  // Leaflet escreve cores em atributos SVG, que não resolvem var(): lê os tokens computados do design system do protótipo.
  const tok = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name) || "").trim() || fallback;
  const termById = Object.fromEntries(CS.terminals.map((t) => [t.id, t]));

  // ---------- Relógio simulado ----------
  const t0 = Date.now();
  let simMs = t0, factor = 600, paused = false;
  const simH = () => (simMs - t0) / 3.6e6; // horas simuladas desde o início
  const fmt = (ms) => new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const atH = (h) => t0 + h * 3.6e6;

  // ---------- Estado dos navios ----------
  const vessels = CS.vessels.map((v) => {
    const legs = [];
    let total = 0;
    for (let i = 1; i < v.route.length; i++) { const d = nm(v.route[i - 1], v.route[i]); legs.push(d); total += d; }
    return { ...v, legs, total, done: v.start * total, inside: {}, berthed: false, track: [], obs: null };
  });
  function posOf(v) {
    let d = v.done;
    for (let i = 0; i < v.legs.length; i++) {
      if (d <= v.legs[i]) {
        const f = v.legs[i] ? d / v.legs[i] : 0, a = v.route[i], b = v.route[i + 1];
        return { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f, cog: bearing(a, b) };
      }
      d -= v.legs[i];
    }
    const e = v.route[v.route.length - 1];
    return { lat: e[0], lon: e[1], cog: 0 };
  }
  const remaining = (v) => Math.max(0, v.total - v.done);
  const sog = (v) => (v.berthed ? 0 : remaining(v) < 8 ? Math.min(v.speedKn, 6) : v.speedKn); // reduz ao entrar no canal

  // ---------- ETA: observações preservadas + regra de prioridade e validade ----------
  const ruleBy = Object.fromEntries(CS.etaRule.map((r) => [r.kind, r]));
  function etaObservations(v) {
    const list = v.eta.map((e) => ({ src: e.src, kind: e.manual ? "manual" : e.port ? "port" : "agency", etaMs: atH(e.h), obsMs: atH(e.at), why: e.why }));
    const s = sog(v);
    if (!v.berthed && s > 0) list.push({ src: "Posição AIS ÷ velocidade", kind: "ais", etaMs: simMs + (remaining(v) / s) * 3.6e6, obsMs: simMs });
    for (const o of list) {
      const r = ruleBy[o.kind];
      o.priority = r.priority;
      o.valid = (simMs - o.obsMs) / 3.6e6 <= r.validH;
    }
    list.sort((a, b) => b.priority - a.priority);
    const chosen = list.find((o) => o.valid) || null;
    const ais = list.find((o) => o.kind === "ais");
    const divergenceH = chosen && ais && chosen !== ais ? Math.abs(chosen.etaMs - ais.etaMs) / 3.6e6 : 0;
    return { list, chosen, ais, divergenceH };
  }

  // ---------- Cruzamento de dados ----------
  function crossings(v) {
    const out = [];
    const term = termById[v.terminal];
    if (term && !term.sludge) {
      out.push(v.op.pre.sludge > 0
        ? { level: "bad", text: `${term.name}: ${term.note} A operação prevê ${v.op.pre.sludge} ${v.op.pre.unit} de sludge.` }
        : { level: "ok", text: `${term.name}: ${term.note} A operação prevê só garbage: restrição respeitada.` });
    }
    if (v.aliases) out.push({ level: "warn", text: v.aliasNote });
    const mine = etaObservations(v).chosen;
    for (const o of vessels) {
      if (o === v || o.terminal !== v.terminal) continue;
      const other = etaObservations(o).chosen;
      if (mine && other && Math.abs(mine.etaMs - other.etaMs) < 6 * 3.6e6)
        out.push({ level: "warn", text: `Operações simultâneas no ${term.name}: ${o.name} chega ${fmt(other.etaMs)}. O app só alerta; a prioridade é decisão de Felipe.` });
    }
    const e = etaObservations(v);
    if (e.divergenceH > CS.etaDivergenceH)
      out.push({ level: "warn", text: `ETA divergente: ${e.chosen.src} diz ${fmt(e.chosen.etaMs)}; a posição AIS indica ${fmt(e.ais.etaMs)} (${e.divergenceH.toFixed(1)} h).` });
    if (weather && weather.risk) out.push({ level: "warn", text: `Clima na barra: ${weather.riskText}. Considere reprogramar a janela.` });
    return out;
  }

  // ---------- Alertas e push ----------
  const alerts = [];
  let pushHost = null, systemNotify = false;
  // Pausa das mensagens de rastreamento: os banners param de entrar e os visíveis ficam parados.
  // O alerta continua registrado na lista "Alertas e push".
  let msgPaused = false, msgHeld = 0;
  function setMsgPaused(on) {
    msgPaused = on;
    if (pushHost) {
      for (const b of pushHost.querySelectorAll(".cst-banner")) {
        if (on) clearTimeout(b._t); else b.remove();
      }
    }
    if (!on) msgHeld = 0;
    renderPauseUi();
  }
  function renderPauseUi() {
    const label = msgPaused ? "Retomar mensagens" : "Pausar mensagens";
    for (const btn of document.querySelectorAll("[data-cst-msgpause]")) {
      btn.textContent = btn.hasAttribute("data-short") ? (msgPaused ? "Retomar" : "Pausar") : label;
      btn.setAttribute("aria-pressed", String(msgPaused));
    }
    if (!pushHost) return;
    let chip = pushHost.querySelector(".cst-paused");
    if (!msgPaused) { chip?.remove(); return; }
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "cst-paused";
      chip.innerHTML = `<span></span><button type="button" class="cst-btn" data-cst-msgpause data-short aria-pressed="true">Retomar</button>`;
      chip.querySelector("button").onclick = () => setMsgPaused(false);
      pushHost.prepend(chip);
    }
    chip.querySelector("span").textContent = `Mensagens pausadas${msgHeld ? ` · ${msgHeld} nova${msgHeld > 1 ? "s" : ""} na lista` : ""}`;
  }
  function push(title, text, level) {
    alerts.unshift({ at: simMs, title, text, level });
    if (alerts.length > 60) alerts.pop();
    renderAlerts();
    if (msgPaused) { msgHeld++; renderPauseUi(); }
    else if (pushHost) {
      const b = document.createElement("div");
      b.className = "cst-banner";
      b.setAttribute("role", "status");
      b.innerHTML = `<span class="ic" aria-hidden="true">C</span><span class="t"><b>CLEANSEA · ${esc(title)}</b><span>agora</span></span><span>${esc(text)}</span><button type="button" class="cst-banner-pause" data-cst-msgpause data-short aria-pressed="false" aria-label="Pausar mensagens de rastreamento">Pausar</button>`;
      b.querySelector("button").onclick = () => setMsgPaused(!msgPaused);
      pushHost.prepend(b);
      for (const old of [...pushHost.querySelectorAll(".cst-banner")].slice(3)) old.remove();
      b._t = setTimeout(() => b.remove(), 6500);
    }
    if (msgPaused) return;
    if (systemNotify) try { new Notification(`CleanSea · ${title}`, { body: text }); } catch (e) { systemNotify = false; }
    if (navigator.vibrate && navigator.userActivation?.hasBeenActive) try { navigator.vibrate(120); } catch (e) { /* ignore */ }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- Clima (Open-Meteo, com fallback simulado) ----------
  let weather = null;
  async function loadWeather() {
    const q = `latitude=${CS.port.lat}&longitude=${CS.port.lon}&timezone=America%2FSao_Paulo&forecast_days=1`;
    try {
      const [m, f] = await Promise.all([
        fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&current=wave_height,wave_direction`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=wind_speed_10m,wind_gusts_10m,precipitation&wind_speed_unit=kn`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ]);
      weather = { live: true, wave: m.current.wave_height, wind: f.current.wind_speed_10m, gust: f.current.wind_gusts_10m, rain: f.current.precipitation, time: f.current.time };
    } catch (e) {
      console.warn("Open-Meteo indisponível, usando valores de exemplo", e);
      weather = { live: false, wave: 1.4, wind: 14, gust: 22, rain: 0, time: null };
    }
    weather.risk = weather.wave >= 2.5 || weather.gust >= 35;
    weather.riskText = `onda ${weather.wave} m, rajada ${weather.gust} kn`;
    if (weather.risk) push("Clima", `Risco de atraso na barra de Santos: ${weather.riskText}.`, "warn");
    renderWeather();
  }

  // ---------- Posição do colaborador ----------
  let me = null;
  function locate() {
    const fallback = (why) => {
      me = { lat: -23.9745, lon: -46.3045, src: "SIMULADO", why };
      push("Minha posição", `Posição simulada (portão do Saboo III): ${why}.`, "info");
      renderAll();
    };
    if (!navigator.geolocation) return fallback("o navegador não oferece geolocalização");
    navigator.geolocation.getCurrentPosition(
      (p) => { me = { lat: p.coords.latitude, lon: p.coords.longitude, src: "GPS do aparelho", why: `precisão ${Math.round(p.coords.accuracy)} m` }; renderAll(); },
      () => fallback("o protótipo roda isolado (sandbox) e a localização foi negada"),
      { timeout: 5000 },
    );
  }

  // ---------- WhatsApp (webhook simulado) e associação à operação ----------
  const wa = [];
  const seen = new Set();
  function associate(text) {
    const tag = text.match(/#(OP-[A-Z0-9-]+)/);
    if (tag) {
      const v = vessels.find((x) => x.op.id === tag[1]);
      if (v) return { v, how: "código da operação" };
    }
    const named = vessels.filter((x) => text.toUpperCase().includes(x.name));
    if (named.length === 1) return { v: named[0], how: "navio citado" };
    return { v: null, how: "ambíguo", candidates: named.length ? named : vessels.filter((x) => text.toUpperCase().includes(x.agency.split(" ")[0])) };
  }
  function tickWhatsApp() {
    CS.whatsapp.forEach((m, i) => {
      const id = `wamid.SIM.${i}`;
      if (seen.has(id) || simH() * 60 < m.minute) return;
      seen.add(id); // o ID original evita duplicados
      const a = associate(m.text);
      wa.unshift({ id, ...m, at: atH(m.minute / 60), ...a });
      if (a.v) push("WhatsApp", `${m.from} → ${a.v.op.id}: ${m.text}`, "info");
      else push("WhatsApp", `${m.from}: mensagem sem operação clara. Confirme no painel.`, "warn");
      renderWa();
    });
  }

  // ---------- Simulação ----------
  let selected = vessels[0];
  function step(dtRealMs) {
    if (paused) return;
    const dtSimMs = dtRealMs * factor;
    simMs += dtSimMs;
    const dtH = dtSimMs / 3.6e6;
    for (const v of vessels) {
      if (v.berthed) continue;
      v.done = Math.min(v.total, v.done + sog(v) * dtH);
      const p = posOf(v);
      v.obs = { lat: p.lat, lon: p.lon, cog: p.cog, sog: sog(v), source: "AIS · SIMULADO", observedAt: simMs, collectedAt: simMs + 90000 };
      v.track.push([p.lat, p.lon]);
      if (v.track.length > 400) v.track.shift();
      const dPort = nm([p.lat, p.lon], PORT);
      for (const r of CS.rings) {
        const inside = dPort <= r.nm;
        if (inside && v.inside[r.id] === false) {
          const e = etaObservations(v).chosen;
          push("Proximidade", `${v.name} entrou em ${r.nm} mn de Santos. ETA ${e ? fmt(e.etaMs) : "—"} (${e ? e.src : "sem fonte válida"}). ${v.op.id} · ${r.step}.`, "info");
        }
        v.inside[r.id] = inside;
      }
      if (remaining(v) <= CS.berthRadiusNm) {
        v.berthed = true;
        v.berthedAt = simMs;
        push("Atracação", `${v.name} chegou ao ${termById[v.terminal].name}. Confirmar chegada (S10, decisão G-01).`, "ok");
      }
    }
    tickWhatsApp();
  }
  // Estado inicial dos anéis sem disparar push.
  for (const v of vessels) { const p = posOf(v); for (const r of CS.rings) v.inside[r.id] = nm([p.lat, p.lon], PORT) <= r.nm; v.obs = { ...p, sog: sog(v), source: "AIS · SIMULADO", observedAt: simMs, collectedAt: simMs }; v.track.push([p.lat, p.lon]); }

  // ---------- Mapas ----------
  const maps = [];
  function makeMap(el, opts) {
    const map = L.map(el, { zoomControl: !opts.mini, attributionControl: true, scrollWheelZoom: false }).setView(opts.mini ? PORT : [-24.25, -46.1], opts.mini ? 9 : 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 16, attribution: "© OpenStreetMap" }).addTo(map);
    const layer = { map, mini: opts.mini, vessels: {}, tracks: {}, me: null };
    if (!opts.mini) {
      CS.rings.forEach((r, i) => L.circle(PORT, { radius: r.nm * 1852, color: i ? tok("--color-warning", "#b25000") : tok("--color-accent-600", "#0071e3"), weight: 1.5, dashArray: "6 6", fill: false }).bindTooltip(r.label).addTo(map));
      CS.terminals.forEach((t) => {
        L.circle([t.lat, t.lon], { radius: CS.berthRadiusNm * 1852, color: tok("--color-success", "#248a3d"), weight: 1, fillOpacity: 0.08 }).addTo(map);
        L.circleMarker([t.lat, t.lon], { radius: 4, color: tok("--color-text", "#1d1d1f"), fillOpacity: 1 }).bindTooltip(`${t.name} (coordenada aproximada)${t.sludge ? "" : " · não permite sludge"}`).addTo(map);
      });
    }
    maps.push(layer);
    return layer;
  }
  function shipIcon(v, sel) {
    const c = v.berthed ? tok("--color-success", "#248a3d") : sel ? tok("--color-accent-600", "#0071e3") : tok("--color-text-muted", "#6e6e73");
    return L.divIcon({ className: "cst-vessel-icon", iconSize: [22, 22], iconAnchor: [11, 11], html: `<svg width="22" height="22" viewBox="0 0 24 24" style="transform:rotate(${v.obs.cog}deg)" aria-hidden="true"><path d="M12 2 L18 20 L12 16 L6 20 Z" fill="${c}" stroke="#fff" stroke-width="1.2"/></svg>` });
  }
  function drawMaps() {
    for (const m of maps) {
      if (!document.body.contains(m.map.getContainer())) continue;
      const list = m.mini ? [selected] : vessels;
      for (const v of list) {
        const ll = [v.obs.lat, v.obs.lon];
        if (!m.vessels[v.id]) {
          m.vessels[v.id] = L.marker(ll, { icon: shipIcon(v, v === selected), keyboard: false }).addTo(m.map).bindTooltip(v.name);
          m.vessels[v.id].on("click", () => select(v));
          m.tracks[v.id] = L.polyline(v.track, { color: tok("--color-accent-600", "#0071e3"), weight: 2, opacity: 0.5 }).addTo(m.map);
        }
        m.vessels[v.id].setLatLng(ll).setIcon(shipIcon(v, v === selected));
        m.tracks[v.id].setLatLngs(v.track);
      }
      if (m.mini) m.map.panTo([selected.obs.lat, selected.obs.lon], { animate: false });
      if (me) {
        if (!m.me) m.me = L.circleMarker([me.lat, me.lon], { radius: 6, color: tok("--color-danger", "#d70015"), fillOpacity: 0.9 }).addTo(m.map).bindTooltip("Minha posição");
        m.me.setLatLng([me.lat, me.lon]);
      }
    }
  }

  // ---------- Painel na página do protótipo ----------
  let panel = null;
  function buildPanel() {
    const s = document.createElement("section");
    s.className = "cst-section";
    s.id = "cleansea-tracking";
    s.setAttribute("aria-labelledby", "cst-title");
    s.innerHTML = `
      <div class="cst-head"><h2 id="cst-title">Rastreamento de navios</h2><span class="cst-tag">AIS SIMULADO</span></div>
      <p class="cst-lede">Widget do app: posição dos navios a caminho de Santos, push de proximidade (aparece no topo do celular), cruzamento com operação, terminal, ETA e clima, e mensagens do WhatsApp associadas à operação. Posições, rotas e mensagens são simuladas até existir contrato de API AIS e WhatsApp Business. Coordenadas de terminais são aproximadas.</p>
      <div class="cst-controls" role="group" aria-label="Controles da simulação">
        <label class="cst-label" for="cst-speed">Velocidade</label>
        <select id="cst-speed" class="cst-select"><option value="60">1 min = 1 h</option><option value="600" selected>6 s = 1 h</option><option value="3600">1 s = 1 h</option></select>
        <button type="button" class="cst-btn" id="cst-pause" aria-pressed="false">Pausar simulação</button>
        <button type="button" class="cst-btn" data-cst-msgpause aria-pressed="false">Pausar mensagens</button>
        <button type="button" class="cst-btn" id="cst-locate">Minha posição</button>
        <button type="button" class="cst-btn" id="cst-notify">Alertas no aparelho</button>
        <span class="cst-label" id="cst-clock" aria-live="off"></span>
      </div>
      <div class="cst-grid">
        <div class="cst-card">
          <div id="cst-map" class="cst-map" role="img" aria-label="Mapa com navios, terminais e anéis de proximidade de Santos"></div>
          <ul class="cst-legend"><li><i></i>50 mn · aproximação</li><li><i class="r2"></i>12 mn · fundeadouro</li><li><i class="r3"></i>0,5 mn · berço</li></ul>
        </div>
        <div class="cst-card"><div class="cst-head"><span class="cst-label">Navios monitorados</span></div><ul class="cst-vessels" id="cst-vessels"></ul></div>
        <div class="cst-card" id="cst-detail"></div>
        <div class="cst-card"><div class="cst-head"><span class="cst-label">Clima na barra de Santos</span><span id="cst-wsrc" class="cst-tag"></span></div><div id="cst-weather"></div></div>
        <div class="cst-card"><div class="cst-head"><span class="cst-label">Alertas e push</span><button type="button" class="cst-btn" id="cst-clear">Limpar</button></div><ol class="cst-list" id="cst-alerts" aria-live="polite"></ol></div>
        <div class="cst-card"><div class="cst-head"><span class="cst-label">WhatsApp da operação</span><span class="cst-tag">SIMULADO</span></div><p class="cst-muted">Webhook do número empresarial. Associação: código <code>#OP-…</code>, depois navio citado, depois confirmação humana. O ID original evita duplicados.</p><ol class="cst-list" id="cst-wa"></ol></div>
      </div>
      <p class="cst-muted">Fontes: posição <span class="cst-tag">SIMULADO</span> · operações e histórico do protótipo (planilha "Controle Operacional de Navios", não validada) · clima <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>. Não usar para navegação.</p>`;
    s.querySelector("#cst-speed").onchange = (e) => (factor = Number(e.target.value));
    s.querySelector("#cst-pause").onclick = (e) => { paused = !paused; e.target.textContent = paused ? "Continuar simulação" : "Pausar simulação"; e.target.setAttribute("aria-pressed", String(paused)); };
    s.querySelector("[data-cst-msgpause]").onclick = () => setMsgPaused(!msgPaused);
    s.querySelector("#cst-locate").onclick = locate;
    s.querySelector("#cst-clear").onclick = () => { alerts.length = 0; renderAlerts(); };
    s.querySelector("#cst-notify").onclick = async (e) => {
      if (!("Notification" in window)) { e.target.textContent = "Push do sistema indisponível aqui"; return; }
      try { systemNotify = (await Notification.requestPermission()) === "granted"; } catch (err) { systemNotify = false; }
      e.target.textContent = systemNotify ? "Alertas do sistema ativos" : "Sistema bloqueou (o push aparece no celular do protótipo)";
    };
    return s;
  }
  function select(v) { selected = v; renderAll(); }

  function renderVessels() {
    const ul = document.getElementById("cst-vessels");
    if (!ul) return;
    ul.innerHTML = "";
    for (const v of vessels) {
      const e = etaObservations(v).chosen;
      const d = nm([v.obs.lat, v.obs.lon], PORT);
      const chip = v.berthed ? ["ok", "No berço"] : d <= 12 ? ["warn", "Fundeadouro / canal"] : d <= 50 ? ["info", "Em aproximação"] : ["mute", "Em rota"];
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" class="cst-vessel" aria-pressed="${v === selected}"><b>${esc(v.name)}</b><span class="cst-chip ${chip[0]}">${chip[1]}</span><small>IMO ${v.imo} · ${esc(termById[v.terminal].name)}</small><small>${d.toFixed(1)} mn · ETA ${e ? hhmm(e.etaMs) : "—"}</small></button>`;
      li.firstChild.onclick = () => select(v);
      ul.append(li);
    }
  }

  function renderDetail() {
    const el = document.getElementById("cst-detail");
    if (!el) return;
    const v = selected, e = etaObservations(v), term = termById[v.terminal], o = v.obs;
    const dMe = me ? nm([me.lat, me.lon], [o.lat, o.lon]) : null;
    el.innerHTML = `
      <div class="cst-head"><span class="cst-label">Cruzamento · ${esc(v.name)}</span><span class="cst-tag">${esc(v.op.id)}</span></div>
      <dl class="cst-kv">
        <dt>Identidade</dt><dd>${esc(v.id)} · IMO ${v.imo} · MMSI ${v.mmsi} <span class="cst-tag">MMSI SIMULADO</span></dd>
        <dt>Fornecedores</dt><dd>MarineTraffic ${esc(v.providers.marinetraffic)} · AIS ${esc(v.providers.ais)}</dd>
        <dt>Posição</dt><dd>${o.lat.toFixed(4)}, ${o.lon.toFixed(4)} · ${o.sog.toFixed(1)} kn · rumo ${Math.round(o.cog)}° · ${esc(o.source)}</dd>
        <dt>Horários</dt><dd>observado ${hhmm(o.observedAt)} · recolhido ${hhmm(o.collectedAt)}</dd>
        <dt>Operação</dt><dd>${esc(v.op.id)} · etapa ${v.op.step} · ${esc(v.agency)} · ${esc(term.name)}</dd>
        <dt>PRE</dt><dd>sludge ${v.op.pre.sludge} ${v.op.pre.unit} · garbage ${v.op.pre.garbage} (unid. a confirmar) · ${v.history} operação(ões) anteriores</dd>
        ${v.berthed ? `<dt>Atracação</dt><dd>${fmt(v.berthedAt)} · aguardando confirmação (S10, G-01)</dd>` : ""}
        <dt>ETB / ETC</dt><dd>${fmt(atH(v.op.etb))} / ${fmt(atH(v.op.etc))}</dd>
        ${dMe != null ? `<dt>Até você</dt><dd>${dMe.toFixed(1)} mn (${esc(me.src)})</dd>` : ""}
      </dl>
      <table class="cst-table" aria-label="Observações de ETA">
        <thead><tr><th>Fonte de ETA</th><th>ETA</th><th>Observada</th><th>Status</th></tr></thead>
        <tbody>${e.list.map((x) => `<tr class="${x === e.chosen ? "vale" : ""}"><td>${esc(x.src)}${x === e.chosen ? '<span class="cst-pill">VALE</span>' : ""}${x.why ? `<br><small>${esc(x.why)}</small>` : ""}</td><td>${fmt(x.etaMs)}</td><td>${hhmm(x.obsMs)}</td><td>${x.valid ? "válida" : "expirada"}</td></tr>`).join("")}</tbody>
      </table>
      <p class="cst-muted">Regra: manual com autor e justificativa (12 h) &gt; autoridade portuária (6 h) &gt; agência (24 h) &gt; cálculo AIS (1 h). Cada observação é guardada; vale a de maior prioridade ainda válida.</p>
      ${crossings(v).map((c) => `<div class="cst-alert ${c.level === "bad" ? "bad" : c.level === "ok" ? "ok" : ""}">${esc(c.text)}</div>`).join("") || '<div class="cst-alert ok">Sem conflitos para este navio.</div>'}`;
  }

  function renderWeather() {
    const el = document.getElementById("cst-weather"), src = document.getElementById("cst-wsrc");
    if (!el || !weather) return;
    src.textContent = weather.live ? "AO VIVO · OPEN-METEO" : "SIMULADO";
    src.className = weather.live ? "cst-tag live" : "cst-tag";
    el.innerHTML = `<div class="cst-weather"><div><span>Onda</span><b>${weather.wave} m</b></div><div><span>Vento</span><b>${weather.wind} kn</b></div><div><span>Rajada</span><b>${weather.gust} kn</b></div><div><span>Chuva</span><b>${weather.rain} mm</b></div></div>
      <p class="cst-muted">${weather.live ? `Open-Meteo, ${weather.time} (horário de Brasília). Previsão, não substitui avisos náuticos oficiais.` : "Rede bloqueada ou indisponível: valores de exemplo."} Limite de alerta: onda ≥ 2,5 m ou rajada ≥ 35 kn.</p>
      ${weather.risk ? `<div class="cst-alert">Risco de atraso: ${esc(weather.riskText)}.</div>` : ""}`;
  }

  function renderAlerts() {
    const ol = document.getElementById("cst-alerts");
    if (!ol) return;
    ol.innerHTML = alerts.length ? alerts.map((a) => `<li><time>${hhmm(a.at)}</time><b>${esc(a.title)}</b> · ${esc(a.text)}</li>`).join("") : '<li class="cst-muted">Nenhum alerta ainda. Os navios entram nos anéis de 50 e 12 mn conforme a simulação avança.</li>';
  }

  function renderWa() {
    const ol = document.getElementById("cst-wa");
    if (!ol) return;
    ol.innerHTML = wa.length ? "" : '<li class="cst-muted">Aguardando mensagens (aparecem com o avanço da simulação).</li>';
    for (const m of wa) {
      const li = document.createElement("li");
      li.innerHTML = `<time>${hhmm(m.at)}</time><b>${esc(m.from)}</b>: ${esc(m.text)}<br><small>${m.v ? `→ ${esc(m.v.op.id)} (${esc(m.how)})` : "Sem operação clara: escolha"}</small>`;
      if (!m.v) {
        for (const c of m.candidates.length ? m.candidates : vessels) {
          const b = document.createElement("button");
          b.type = "button"; b.className = "cst-btn"; b.textContent = c.op.id;
          b.onclick = () => { m.v = c; m.how = "confirmação humana"; renderWa(); push("WhatsApp", `Mensagem associada a ${c.op.id} por confirmação.`, "ok"); };
          li.append(" ", b);
        }
      }
      ol.append(li);
    }
  }

  // ---------- Celular do protótipo: push e card na tela M06 Navio ----------
  let phoneCard = null, miniMap = null;
  // O runtime do protótipo normaliza o atributo style; identifica o celular pela altura declarada (844 px).
  function phoneFrame() { return [...document.querySelectorAll("[data-screen-label]")].find((el) => el.style.height === "844px") || null; }
  function syncPhone() {
    const f = phoneFrame();
    if (!f) return;
    if (!pushHost || !f.contains(pushHost)) { pushHost = document.createElement("div"); pushHost.className = "cst-push"; pushHost.setAttribute("aria-live", "assertive"); f.append(pushHost); }
    const onNavio = /M06/.test(f.getAttribute("data-screen-label") || "");
    if (!onNavio) return;
    const scroll = [...f.querySelectorAll("div")].find((d) => d.style.overflowY === "auto" && d.offsetParent !== null);
    if (!scroll) return;
    if (phoneCard && scroll.contains(phoneCard)) return;
    phoneCard = document.createElement("div");
    phoneCard.className = "cst-phone-card";
    phoneCard.innerHTML = `<div class="cst-head"><span class="cst-label">Rastreamento ao vivo</span><span class="cst-tag">AIS SIMULADO</span></div><div class="cst-map mini" role="img" aria-label="Mini-mapa do navio selecionado"></div><div class="cst-phone-info" style="font-size:13px;line-height:1.4"></div><a href="#cleansea-tracking" style="font-size:13px">Abrir painel de rastreamento</a>`;
    scroll.prepend(phoneCard);
    miniMap = makeMap(phoneCard.querySelector(".cst-map"), { mini: true });
    renderPhoneInfo();
  }
  function renderPhoneInfo() {
    if (!phoneCard || !document.body.contains(phoneCard)) return;
    const v = selected, e = etaObservations(v).chosen, d = nm([v.obs.lat, v.obs.lon], PORT);
    phoneCard.querySelector(".cst-phone-info").innerHTML = `<b>${esc(v.name)}</b> · IMO ${v.imo}<br>${d.toFixed(1)} mn de Santos · ${v.obs.sog.toFixed(1)} kn<br>ETA ${e ? fmt(e.etaMs) : "—"} · <span style="color:var(--color-text-muted)">${e ? esc(e.src) : "sem fonte válida"}</span>`;
  }

  // ---------- Acompanhamento ao vivo: mapa na coluna ao lado do celular ----------
  let side = null, sideMap = null;
  function mountSide() {
    if (side && document.body.contains(side)) return;
    const f = phoneFrame();
    const row = f?.parentElement?.parentElement;
    const col = row && [...row.children].find((c) => !c.contains(f));
    if (!col) return;
    if (sideMap) { sideMap.map.remove(); maps.splice(maps.indexOf(sideMap), 1); sideMap = null; }
    side = document.createElement("div");
    side.className = "cst-card cst-side";
    side.id = "cst-side";
    side.innerHTML = `<div class="cst-head"><span class="cst-label">Acompanhamento ao vivo</span><span class="cst-tag">AIS SIMULADO</span></div>
      <div class="cst-map side" role="img" aria-label="Mapa de acompanhamento com navios, terminais e anéis de proximidade de Santos"></div>
      <div class="cst-side-info" aria-live="off"></div>
      <div class="cst-controls" role="group" aria-label="Navios e mensagens"><span class="cst-side-ships"></span></div>
      <div class="cst-controls"><button type="button" class="cst-btn" data-cst-msgpause aria-pressed="false">Pausar mensagens</button><a class="cst-btn" href="#cleansea-tracking">Painel completo</a></div>`;
    side.querySelector("[data-cst-msgpause]").onclick = () => setMsgPaused(!msgPaused);
    col.insertBefore(side, col.children[1] || null);
    sideMap = makeMap(side.querySelector(".cst-map"), { mini: false });
    setTimeout(() => sideMap?.map.invalidateSize(), 50);
    renderPauseUi();
    renderSide();
  }
  function renderSide() {
    if (!side || !document.body.contains(side)) return;
    const v = selected, e = etaObservations(v).chosen, d = nm([v.obs.lat, v.obs.lon], PORT);
    side.querySelector(".cst-side-info").innerHTML = `<b>${esc(v.name)}</b> · IMO ${v.imo} · ${esc(termById[v.terminal].name)}<br>${d.toFixed(1)} mn de Santos · ${v.obs.sog.toFixed(1)} kn · ETA ${e ? fmt(e.etaMs) : "—"} <span class="cst-muted">(${e ? esc(e.src) : "sem fonte válida"})</span>`;
    const ships = side.querySelector(".cst-side-ships");
    if (ships.childElementCount !== vessels.length) {
      ships.innerHTML = "";
      for (const x of vessels) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "cst-btn"; b.textContent = x.name;
        b.onclick = () => select(x);
        b._v = x;
        ships.append(b);
      }
    }
    for (const b of ships.children) b.setAttribute("aria-pressed", String(b._v === selected));
  }

  // ---------- Montagem ----------
  function mountPanel() {
    if (panel && document.body.contains(panel)) return;
    const wf = [...document.querySelectorAll("section")].find((s) => /Wireflow/.test(s.firstElementChild?.textContent || ""));
    if (!wf) return;
    panel = buildPanel();
    wf.parentNode.insertBefore(panel, wf);
    makeMap(panel.querySelector("#cst-map"), { mini: false });
    renderAll();
    renderWeather();
  }
  function renderAll() {
    const c = document.getElementById("cst-clock");
    if (c) c.textContent = `Relógio simulado · ${fmt(simMs)}`;
    renderVessels(); renderDetail(); renderAlerts(); renderWa(); renderPhoneInfo(); renderSide(); drawMaps();
  }

  let last = performance.now(), acc = 0;
  function loop(now) {
    const dt = Math.min(1000, now - last);
    last = now;
    step(dt);
    acc += dt;
    if (acc > 500) { acc = 0; mountPanel(); mountSide(); syncPhone(); renderAll(); }
    requestAnimationFrame(loop);
  }
  const start = () => { mountPanel(); mountSide(); syncPhone(); loadWeather(); requestAnimationFrame(loop); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("hashchange", () => { if (location.hash === "#cleansea-tracking") panel?.scrollIntoView({ behavior: "smooth" }); });
})();
