const taskText = "Planlegg en aktivitet for nye deltakere i kommunen";

const nodes = {
  root: { label: "Planlegg en aktivitet", x: 50, y: 52, root: true },
  activity: { label: "Aktivitet", x: 18, y: 25 },
  place: { label: "Sted", x: 82, y: 25 },
  time: { label: "Tid", x: 18, y: 80 },
  transport: { label: "Transport", x: 82, y: 80 },
  weather: { label: "Vær?", x: 50, y: 9, new: true }
};

const phases = [
  { label: "Ready", mode: "ready" },
  { label: "Listening for topic", mode: "detecting", speaker: "Læreren" },
  { label: "Topic detected", mode: "conversation", speaker: "Anna", active: "place", nodes: ["root", "activity", "place", "time", "transport"] },
  { label: "Conversation in progress", mode: "conversation", speaker: "Omar", active: "place", discussed: ["place"], nodes: ["root", "activity", "place", "time", "transport"] },
  { label: "Suggestion after pause", mode: "conversation", speaker: "Anna", active: "place", discussed: ["place"], support: "say", supportLevel: 1, nodes: ["root", "activity", "place", "time", "transport"] },
  { label: "New branch detected", mode: "conversation", speaker: "Omar", active: "weather", discussed: ["place"], nodes: ["root", "activity", "place", "time", "transport", "weather"] },
  { label: "Clarification support", mode: "conversation", speaker: "Anna", active: "weather", discussed: ["place"], support: "understand", supportLevel: 1, nodes: ["root", "activity", "place", "time", "transport", "weather"] },
  { label: "Conversation completed", mode: "complete", discussed: ["place", "weather"], nodes: ["root", "activity", "place", "time", "transport", "weather"] },
  { label: "Feedback opened", mode: "complete", feedbackOpen: true, discussed: ["place", "weather"], nodes: ["root", "activity", "place", "time", "transport", "weather"] }
];

const supportContent = {
  say: [
    { title: "Et mulig neste steg", text: "Forklar hvorfor biblioteket passer for gruppen." },
    { title: "En nyttig struktur", text: "Jeg foreslår ... fordi ..." },
    { title: "Nyttige ord", text: "bibliotek · sentrum · i nærheten" },
    { title: "Start på en setning", text: "Jeg foreslår biblioteket fordi ..." },
    { title: "Et eksempel", text: "Jeg foreslår biblioteket fordi det er lett å komme dit." }
  ],
  understand: [
    { title: "Du kan spørre Omar", text: "Kan du si det en gang til?" },
    { title: "Be om enklere språk", text: "Kan du si det litt saktere eller på en annen måte?" },
    { title: "Nøkkelord", text: "vær · regn · plan B · innendørs" },
    { title: "Kort forklaring", text: "Omar foreslår et alternativ hvis det regner." },
    { title: "Oversettelse", text: "Omar suggests another option if it rains." }
  ]
};

const feedback = [
  "Du forklarte tydelig hvorfor biblioteket kunne passe.",
  "Du brukte fordi for å begrunne forslaget ditt.",
  "Prøv også uttrykket: Det er lett å komme dit.",
  "Nyttige ord fra samtalen: møtested, i nærheten og plan B."
];

let currentStep = 0;
let supportLevel = 1;
let feedbackOpen = false;
let toastTimer = null;

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function setStep(index) {
  currentStep = Math.max(0, Math.min(phases.length - 1, index));
  supportLevel = phases[currentStep].supportLevel || 1;
  feedbackOpen = Boolean(phases[currentStep].feedbackOpen);
  render();
}

function render() {
  renderDevice();
  renderDemoController();
}

function renderDevice() {
  const phase = phases[currentStep];
  const host = document.getElementById("participantDevice");
  if (phase.mode === "ready") {
    host.innerHTML = '<article class="device"><div class="ready-screen"><div><div class="ready-icon">◉</div>' +
      '<h1>Samtaleassistent</h1><p>Start appen og legg telefonen på bordet. Systemet følger samtalen og viser støtte når det er relevant.</p>' +
      '<button class="start-button" type="button" data-action="start">Start samtalen</button>' +
      '<p class="ready-note">Temaet kan bli hentet fra det læreren og gruppen sier.</p></div></div></article>';
    return;
  }

  const active = phase.mode === "conversation" || phase.mode === "detecting";
  host.innerHTML = '<article class="device">' + renderHeader(active, phase) + '<div class="device-content">' +
    (phase.mode === "detecting" ? renderDetecting() : phase.mode === "complete" ? renderComplete(phase) : renderConversation(phase)) +
    '</div></article>';
}

function renderHeader(active, phase) {
  return '<header class="device-header"><div class="brand"><span class="brand-mark">S</span><div class="brand-copy"><strong>Samtaleassistent</strong>' +
    '<span>' + (phase.mode === "complete" ? "Samtalen er ferdig" : "Følger gruppesamtalen") + '</span></div></div>' +
    (active ? '<div class="listening-status"><span class="listening-dot"></span>Lytter</div><button class="header-action" type="button" data-action="end">Avslutt</button>' : '') +
    '</header>';
}

function renderDetecting() {
  return '<section class="detecting-card"><div><div class="wave"><span></span><span></span><span></span><span></span><span></span></div>' +
    '<strong>Lytter etter tema og oppgave</strong><p>Begynn samtalen som vanlig.</p></div></section>' +
    '<section class="waiting-card">Kartet blir opprettet når systemet har nok kontekst.</section>';
}

function renderConversation(phase) {
  return '<section class="topic-card"><span>Tema oppdaget fra samtalen</span><strong>' + escapeHtml(taskText) + '</strong></section>' +
    '<section class="speaker-strip"><div><strong>' + escapeHtml(phase.speaker) + ' snakker</strong><br><span>Systemet følger samtalen automatisk</span></div><span class="speaker-live">Direkte</span></section>' +
    renderMap(phase) + (phase.support ? renderSupport(phase.support) : '<section class="waiting-card">Fortsett samtalen. Støtte vises bare når den kan være nyttig.</section>');
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

function renderSupport(type) {
  const item = supportContent[type][Math.max(0, Math.min(4, supportLevel - 1))];
  const bars = [1,2,3,4,5].map(level => '<span class="' + (level <= supportLevel ? "active" : "") + '"></span>').join("");
  const reason = type === "say" ? "Vises etter en lengre pause." : "Vises etter at du ba om en forklaring.";
  return '<section class="support-card"><div class="card-heading"><strong>Forslag til deg</strong><span class="private-tag">Bare for deg</span></div>' +
    '<h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.text) + '</p><p class="support-reason">' + escapeHtml(reason) + '</p>' +
    '<div class="support-levels">' + bars + '</div><div class="support-actions">' +
    (supportLevel < 5 ? '<button type="button" data-action="more-help">Mer hjelp</button>' : '') +
    '<button type="button" data-action="hide-help">Skjul</button></div></section>';
}

function renderComplete(phase) {
  return '<section class="complete-card"><div><div class="complete-icon">✓</div><h2>Samtalen er ferdig</h2><p>Kartet og personlig tilbakemelding er klare.</p></div></section>' +
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
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1600);
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
  if (action === "start") { setStep(1); return; }
  if (action === "end") { setStep(7); showToast("Samtalen er avsluttet"); return; }
  if (action === "more-help") { supportLevel = Math.min(5, supportLevel + 1); renderDevice(); return; }
  if (action === "hide-help") { button.closest(".support-card").remove(); return; }
  if (action === "open-feedback") { feedbackOpen = true; renderDevice(); }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowRight") setStep(currentStep + 1);
  if (event.key === "ArrowLeft") setStep(currentStep - 1);
  if (event.key.toLowerCase() === "r") setStep(0);
  if (/^[1-9]$/.test(event.key)) setStep(Number(event.key) - 1);
});

render();
