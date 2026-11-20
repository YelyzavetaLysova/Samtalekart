const task = {
  title: "Planlegg en aktivitet for nye deltakere",
  instruction: "Bli enige om én aktivitet, et sted og et tidspunkt.",
  group: ["Anna", "Omar", "Sara"]
};

const nodes = {
  root: {
    label: "Felles aktivitet", x: 50, y: 52, root: true,
    words: "forslag · velge · bli enige",
    phrases: "Hva synes dere? · Skal vi velge ...?"
  },
  activity: {
    label: "Aktivitet", x: 18, y: 25,
    words: "tur · kafé · arrangement",
    phrases: "Vi kan ... · Jeg foreslår ..."
  },
  place: {
    label: "Sted", x: 82, y: 25,
    words: "bibliotek · sentrum · i nærheten",
    phrases: "Det ligger ... · Det er lett å komme dit."
  },
  time: {
    label: "Tid", x: 18, y: 80,
    words: "hverdag · helg · ettermiddag",
    phrases: "Det passer best ... · Hva med klokka ...?"
  },
  transport: {
    label: "Transport", x: 82, y: 80,
    words: "buss · holdeplass · avstand",
    phrases: "Man kan ta ... · Det tar omtrent ..."
  },
  weather: {
    label: "Dårlig vær?", x: 50, y: 9, new: true,
    words: "regn · innendørs · plan B",
    phrases: "Hvis det regner ... · Vi kan heller ..."
  }
};

const phases = [
  { label: "Activity ready", mode: "ready" },
  { label: "Sound check", mode: "calibration", calibration: 0 },
  {
    label: "Conversation starts", mode: "conversation", speaker: "Omar",
    active: "activity", nodes: ["root", "activity", "place", "time", "transport"]
  },
  {
    label: "Map updates automatically", mode: "conversation", speaker: "Sara",
    active: "place", discussed: ["activity"], languageNode: "place",
    nodes: ["root", "activity", "place", "time", "transport"], updateMessage: "Sted ble lagt til fra samtalen"
  },
  {
    label: "Learner is speaking", mode: "conversation", speaker: "Anna",
    active: "place", discussed: ["activity"], languageNode: "place",
    nodes: ["root", "activity", "place", "time", "transport"]
  },
  {
    label: "New topic is detected", mode: "conversation", speaker: "Omar",
    active: "weather", discussed: ["activity", "place"], languageNode: "weather",
    nodes: ["root", "activity", "place", "time", "transport", "weather"], updateMessage: "Ny gren: Dårlig vær?"
  },
  {
    label: "Conversation is completed", mode: "complete",
    discussed: ["activity", "place", "weather"],
    nodes: ["root", "activity", "place", "time", "transport", "weather"]
  }
];

const sayHelp = {
  place: [
    { title: "Velg en retning", text: "Forklar hvilket sted som passer og hvorfor." },
    { title: "Bruk denne strukturen", text: "Jeg foreslår ... fordi ..." },
    { title: "Nyttige ord", text: "bibliotek · sentrum · i nærheten" },
    { title: "Start på en setning", text: "Jeg foreslår biblioteket fordi ..." },
    { title: "Eksempel", text: "Jeg foreslår biblioteket fordi det er lett å komme dit." }
  ],
  weather: [
    { title: "Velg en retning", text: "Foreslå hva gruppen kan gjøre hvis været er dårlig." },
    { title: "Bruk denne strukturen", text: "Hvis det regner, kan vi ..." },
    { title: "Nyttige ord", text: "innendørs · alternativ · plan B" },
    { title: "Start på en setning", text: "Hvis det regner, kan vi heller ..." },
    { title: "Eksempel", text: "Hvis det regner, kan vi heller møtes på biblioteket." }
  ],
  general: [
    { title: "Velg en retning", text: "Gi et forslag eller spør hva de andre mener." },
    { title: "Bruk denne strukturen", text: "Jeg synes ... Hva synes dere?" },
    { title: "Nyttige ord", text: "forslag · mening · enig" },
    { title: "Start på en setning", text: "Jeg synes at vi kan ..." },
    { title: "Eksempel", text: "Jeg synes at vi kan velge en aktivitet som passer for alle." }
  ]
};

const understandHelp = [
  { title: "Spør først", text: "Kan du si det en gang til?" },
  { title: "Be om enklere språk", text: "Kan du si det litt saktere eller på en annen måte?" },
  { title: "Nøkkelord fra svaret", text: "vær · regn · plan B · innendørs" },
  { title: "Kort forklaring", text: "Omar foreslår et alternativ hvis det regner." },
  { title: "Oversettelse", text: "Omar suggests another option if it rains." }
];

const feedback = [
  "Du forklarte forslaget ditt og ga en tydelig grunn.",
  "Du brukte fordi riktig: «Biblioteket passer fordi det ligger i sentrum.»",
  "Prøv også: «Hva synes dere om dette stedet?»",
  "Ord fra samtalen: møtested, i nærheten, alternativ og plan B."
];

let currentStep = 0;
let helpType = null;
let helpLevel = 1;
let helpNode = "general";
let feedbackOpen = false;
let toastTimer = null;

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function setStep(index) {
  currentStep = Math.max(0, Math.min(phases.length - 1, index));
  if (currentStep === 0) phases[1].calibration = 0;
  helpType = null;
  helpLevel = 1;
  feedbackOpen = false;
  render();
}

function render() {
  renderDevice();
  renderDemoController();
}

function renderDevice() {
  const phase = phases[currentStep];
  const host = document.getElementById("participantDevice");
  host.innerHTML = '<article class="device">' +
    (phase.mode === "ready" ? renderReady() : renderHeader(phase) + '<div class="device-content">' +
      (phase.mode === "calibration" ? renderCalibration(phase) : phase.mode === "complete" ? renderComplete(phase) : renderConversation(phase)) +
      '</div>') + '</article>';
}

function renderReady() {
  return '<div class="ready-screen"><div class="ready-inner"><div class="ready-icon">S</div>' +
    '<span class="eyebrow">Du er med i gruppe 2</span><h1>' + escapeHtml(task.title) + '</h1>' +
    '<p>' + escapeHtml(task.instruction) + '</p>' +
    '<div class="group-list"><span>Anna</span><span>Omar</span><span>Sara</span></div>' +
    '<button class="start-button" type="button" data-action="sound-check">Start lydsjekk</button>' +
    '<p class="ready-note">Alle bruker sin egen telefon. Hold telefonen nær deg under samtalen.</p></div></div>';
}

function renderHeader(phase) {
  const listening = phase.mode === "conversation";
  return '<header class="device-header"><div class="brand"><span class="brand-mark">S</span><div class="brand-copy"><strong>Samtaleassistent</strong>' +
    '<span>' + (phase.mode === "complete" ? "Samtalen er ferdig" : listening ? "Følger gruppesamtalen" : "Lydsjekk") + '</span></div></div>' +
    (listening ? '<div class="listening-status"><span class="listening-dot"></span>Lytter</div>' : '') + '</header>';
}

function renderCalibration(phase) {
  if (phase.calibration === 0) {
    return '<section class="calibration-card"><span class="step-label">Kort lydsjekk</span><h2>Les setningen høyt</h2>' +
      '<blockquote>Jeg liker å møte nye mennesker og gjøre aktiviteter sammen.</blockquote>' +
      '<p>Snakk med vanlig stemme og hold telefonen slik du vil bruke den.</p>' +
      '<button class="primary-action" type="button" data-action="record-check">Start opptak</button></section>';
  }
  return '<section class="calibration-card success"><div class="check-icon">✓</div><h2>Lyden fungerer</h2>' +
    '<p>Systemet kan høre stemmen din. Vent til læreren starter samtalen.</p>' +
    '<button class="primary-action" type="button" data-action="begin-conversation">Vis samtalen</button></section>';
}

function renderConversation(phase) {
  const isLearnerSpeaking = phase.speaker === "Anna";
  return '<section class="task-card"><span>Oppgave</span><strong>' + escapeHtml(task.title) + '</strong><p>' + escapeHtml(task.instruction) + '</p></section>' +
    '<section class="speaker-strip"><div><strong>' + (isLearnerSpeaking ? "Du snakker" : escapeHtml(phase.speaker) + " snakker") + '</strong>' +
    '<span>' + (isLearnerSpeaking ? "Du kan be om hjelp hvis du står fast" : "Lytt til den som snakker") + '</span></div><span class="speaker-live">Direkte</span></section>' +
    (phase.updateMessage ? '<div class="map-update"><span>✓</span>' + escapeHtml(phase.updateMessage) + '</div>' : '') +
    renderMap(phase) + renderLanguage(phase) + renderActions(phase, isLearnerSpeaking) + renderPrivateHelp();
}

function renderMap(phase) {
  const nodeIds = phase.nodes || [];
  const discussed = phase.discussed || [];
  const lines = nodeIds.filter(id => id !== "root").map(id => '<line x1="50" y1="52" x2="' + nodes[id].x + '" y2="' + nodes[id].y + '"></line>').join("");
  const nodeMarkup = nodeIds.map(function (id) {
    const node = nodes[id];
    const classes = ["map-node"];
    if (node.root) classes.push("root");
    if (id === phase.active) classes.push("current");
    if (node.new) classes.push("new");
    const check = discussed.includes(id) ? '<span class="check">✓</span>' : '';
    return '<span class="' + classes.join(" ") + '" style="left:' + node.x + '%;top:' + node.y + '%">' + escapeHtml(node.label) + check + '</span>';
  }).join("");
  return '<section class="map-card"><div class="card-heading"><strong>Samtalekart</strong><span class="automatic-tag">Oppdateres automatisk</span></div>' +
    '<div class="conversation-map"><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + lines + '</svg>' + nodeMarkup + '</div></section>';
}

function renderLanguage(phase) {
  const node = nodes[phase.languageNode || phase.active || "root"] || nodes.root;
  return '<section class="language-card"><div class="card-heading"><strong>Nyttig akkurat nå</strong><span>Felles for gruppen</span></div>' +
    '<div class="language-row"><small>Ord</small><p>' + escapeHtml(node.words) + '</p></div>' +
    '<div class="language-row"><small>Uttrykk</small><p>' + escapeHtml(node.phrases) + '</p></div></section>';
}

function renderActions(phase, isLearnerSpeaking) {
  return '<div class="quick-actions">' +
    (isLearnerSpeaking ? '<button class="help-say" type="button" data-action="help-say">Hva kan jeg si?</button>' : '') +
    (!isLearnerSpeaking ? '<button type="button" data-action="help-understand">Jeg forstod ikke</button>' : '') +
    '</div>';
}

function renderPrivateHelp() {
  if (!helpType) return "";
  const items = helpType === "say" ? (sayHelp[helpNode] || sayHelp.general) : understandHelp;
  const item = items[Math.min(helpLevel - 1, items.length - 1)];
  const bars = [1,2,3,4,5].map(level => '<span class="' + (level <= helpLevel ? "active" : "") + '"></span>').join("");
  return '<section class="support-card"><div class="card-heading"><strong>Personlig hjelp</strong><span class="private-tag">Bare for deg</span></div>' +
    '<h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.text) + '</p>' +
    '<div class="support-levels">' + bars + '</div><div class="support-actions">' +
    (helpLevel < 5 ? '<button type="button" data-action="more-help">Mer hjelp</button>' : '') +
    '<button type="button" data-action="hide-help">Lukk</button></div></section>';
}

function renderComplete(phase) {
  return '<section class="complete-card"><div><div class="complete-icon">✓</div><h2>Samtalen er ferdig</h2>' +
    '<p>Læreren har avsluttet aktiviteten. Kartet og din personlige tilbakemelding er klare.</p></div></section>' +
    renderMap(phase) + (feedbackOpen ? renderFeedback() : '<button class="feedback-button" type="button" data-action="open-feedback">Se min tilbakemelding</button>');
}

function renderFeedback() {
  return '<section class="feedback-card"><div class="card-heading"><strong>Tilbakemelding etter samtalen</strong><span class="private-tag">Bare for deg</span></div>' +
    '<div class="feedback-list">' + feedback.map(item => '<div class="feedback-item">' + escapeHtml(item) + '</div>').join("") + '</div></section>';
}

function renderDemoController() {
  const list = document.getElementById("demoStateList");
  list.innerHTML = phases.map(function (phase, index) {
    return '<button class="demo-state-button' + (index === currentStep ? " active" : "") + '" type="button" data-demo-state="' + index + '"><span>' + (index + 1) + '</span>' + escapeHtml(phase.label) + '</button>';
  }).join("");
  document.getElementById("demoPrevious").disabled = currentStep === 0;
  document.getElementById("demoNext").disabled = currentStep === phases.length - 1;
}

function setDemoPanel(open) {
  document.getElementById("demoPanel").hidden = !open;
  document.getElementById("demoToggle").setAttribute("aria-expanded", String(open));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

document.addEventListener("click", function (event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "demoToggle") { setDemoPanel(document.getElementById("demoPanel").hidden); return; }
  if (button.id === "demoClose") { setDemoPanel(false); return; }
  if (button.id === "demoPrevious") { setStep(currentStep - 1); return; }
  if (button.id === "demoNext") { setStep(currentStep + 1); return; }
  if (button.dataset.demoState !== undefined) { setStep(Number(button.dataset.demoState)); return; }

  const action = button.dataset.action;
  if (action === "sound-check") { setStep(1); return; }
  if (action === "record-check") {
    phases[1].calibration = 1;
    renderDevice();
    showToast("Lyden ble registrert");
    return;
  }
  if (action === "begin-conversation") { setStep(2); return; }
  if (action === "help-say") {
    helpType = "say";
    helpLevel = 1;
    helpNode = phases[currentStep].active || "general";
    renderDevice();
    return;
  }
  if (action === "help-understand") {
    helpType = "understand";
    helpLevel = 1;
    renderDevice();
    return;
  }
  if (action === "more-help") { helpLevel = Math.min(5, helpLevel + 1); renderDevice(); return; }
  if (action === "hide-help") { helpType = null; renderDevice(); return; }
  if (action === "open-feedback") { feedbackOpen = true; renderDevice(); }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowRight") setStep(currentStep + 1);
  if (event.key === "ArrowLeft") setStep(currentStep - 1);
  if (event.key.toLowerCase() === "r") setStep(0);
  if (/^[1-7]$/.test(event.key)) setStep(Number(event.key) - 1);
});

render();
