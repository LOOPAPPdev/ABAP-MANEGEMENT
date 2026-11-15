/* CleanSea · dados do widget de rastreamento (protótipo).
 * Navios, agências, terminais e histórico vêm do protótipo de design (planilha "Controle Operacional de Navios", não validada).
 * MMSI, IDs de fornecedor, rotas, posições, ETAs e mensagens são SIMULADOS.
 * Coordenadas de terminais são aproximadas. Não usar para navegação.
 */
window.CS = {
  // Ponto de referência dos anéis de proximidade: barra do canal de Santos (aprox.).
  port: { id: "PRT-SANTOS", name: "Porto de Santos", unlocode: "BRSSZ", lat: -24.0, lon: -46.305 },
  rings: [
    { id: "R50", nm: 50, label: "50 mn · aproximação", step: "S07 Monitorar navio" },
    { id: "R12", nm: 12, label: "12 mn · fundeadouro e praticagem", step: "S09 Estimar chegada" },
  ],
  berthRadiusNm: 0.5,

  terminals: [
    { id: "TRM-SABOO3", name: "Saboo III", lat: -23.973, lon: -46.303, sludge: true },
    { id: "TRM-12A", name: "Berço 12A", lat: -23.958, lon: -46.318, sludge: true },
    { id: "TRM-TEAG", name: "TEAG", lat: -23.927, lon: -46.33, sludge: true },
    { id: "TRM-TGG", name: "TGG", lat: -23.935, lon: -46.313, sludge: false, note: "TGG não permite a coleta de sludge." },
    { id: "TRM-2021", name: "Berços 20/21", lat: -23.918, lon: -46.345, sludge: true },
  ],

  // Identidade: ID interno + IMO (identidade do navio) + MMSI (complementar) + IDs de cada fornecedor.
  vessels: [
    {
      id: "VSL-001", name: "ANADOLU S", imo: "9667758", mmsi: "271000101", agency: "ORION", terminal: "TRM-SABOO3",
      providers: { marinetraffic: "MT-SIM-4410", ais: "271000101" }, speedKn: 12.5,
      route: [[-24.95, -45.2], [-24.55, -45.75], [-24.18, -46.18], [-24.08, -46.31], [-24.0, -46.305], [-23.973, -46.303]],
      start: 0.18, history: 2,
      op: { id: "OP-1511-ANADOLU", step: "S07", etb: 26, etc: 40, pre: { sludge: 15, garbage: 5, unit: "m³" } },
      eta: [{ src: "Agência (e-mail)", h: 24.5, at: -6 }, { src: "Lançamento manual · Marcos", h: 25, at: -2, manual: true, why: "Agência confirmou janela de praticagem" }],
    },
    {
      id: "VSL-002", name: "STAR GENESIS", imo: "9457464", mmsi: "538000202", agency: "CARGONAVE", terminal: "TRM-12A",
      providers: { marinetraffic: "MT-SIM-7721", ais: "538000202" }, speedKn: 11.8,
      route: [[-25.6, -44.9], [-25.0, -45.5], [-24.4, -46.0], [-24.08, -46.31], [-24.0, -46.305], [-23.958, -46.318]],
      start: 0.05, history: 2,
      op: { id: "OP-1611-STARGEN", step: "S06", etb: 40, etc: 52, pre: { sludge: 15, garbage: 5, unit: "m³" } },
      eta: [{ src: "Agência (e-mail)", h: 36, at: -10 }],
    },
    {
      id: "VSL-003", name: "PERSEAS", imo: "9650638", mmsi: "636000303", agency: "MARTIN SHIPPING", terminal: "TRM-TGG",
      providers: { marinetraffic: "MT-SIM-1288", ais: "636000303" }, speedKn: 13.2,
      route: [[-24.75, -46.9], [-24.4, -46.6], [-24.12, -46.36], [-24.0, -46.305], [-23.935, -46.313]],
      start: 0.42, history: 1,
      op: { id: "OP-1411-PERSEAS", step: "S09", etb: 12, etc: 20, pre: { sludge: 0, garbage: 6, unit: "m³" } },
      eta: [{ src: "Autoridade portuária (APS)", h: 10.5, at: -1, port: true }, { src: "Agência (e-mail)", h: 9, at: -20 }],
    },
    {
      id: "VSL-004", name: "ILENAO", imo: "9524683", mmsi: "352000404", agency: "MARTIN SHIPPING", terminal: "TRM-TEAG",
      providers: { marinetraffic: "MT-SIM-5530", ais: "352000404" }, speedKn: 10.9,
      route: [[-24.3, -47.4], [-24.25, -46.9], [-24.1, -46.45], [-24.0, -46.305], [-23.927, -46.33]],
      start: 0.3, history: 2,
      op: { id: "OP-1511-ILENAO", step: "S07", etb: 30, etc: 38, pre: { sludge: 0, garbage: 4, unit: "m³" } },
      eta: [{ src: "Agência (e-mail)", h: 27, at: -5 }],
    },
    {
      id: "VSL-005", name: "LMZ ATLAS", imo: "9741293", mmsi: "248000505", agency: "ALPHAMAR", terminal: "TRM-SABOO3",
      providers: { marinetraffic: "MT-SIM-9902", ais: "248000505" }, speedKn: 12.0,
      aliases: ["LEMESSOS NAPA"], aliasNote: "IMO 9741293 também aparece como LEMESSOS NAPA no PRE. Confirme o vínculo antes de salvar.",
      route: [[-25.2, -46.2], [-24.7, -46.25], [-24.25, -46.3], [-24.08, -46.31], [-24.0, -46.305], [-23.973, -46.303]],
      start: 0.25, history: 1,
      op: { id: "OP-1511-LMZATLAS", step: "S07", etb: 27, etc: 33, pre: { sludge: 0, garbage: 6, unit: "m³" } },
      eta: [{ src: "Agência (e-mail)", h: 26, at: -8 }],
    },
  ],

  // Prioridade das fontes de ETA (maior vence) e validade de cada observação, em horas.
  etaRule: [
    { kind: "manual", label: "Lançamento manual com autor e justificativa", priority: 4, validH: 12 },
    { kind: "port", label: "Autoridade portuária / praticagem", priority: 3, validH: 6 },
    { kind: "agency", label: "Agência", priority: 2, validH: 24 },
    { kind: "ais", label: "Cálculo pela posição AIS (distância ÷ velocidade)", priority: 1, validH: 1 },
  ],
  etaDivergenceH: 3,

  // Mensagens simuladas do WhatsApp Business (webhook). minute = minutos simulados após o início.
  whatsapp: [
    { minute: 20, from: "Agência ORION", text: "#OP-1511-ANADOLU praticagem confirmada para amanhã cedo." },
    { minute: 90, from: "João (visitador)", text: "Chegando no Saboo III, aguardo o ANADOLU S." },
    { minute: 150, from: "Agência MARTIN", text: "Navio atrasou 2 h, sigo com a previsão." },
    { minute: 240, from: "Marcos", text: "#OP-1411-PERSEAS só garbage, TGG não libera sludge." },
  ],
};
