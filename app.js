/* ===================================================================
 *  MUNICIPAL COMMAND CENTER — lite (zero-dependency, zero-build)
 *  Baseline data: data.json   |   Working state: localStorage
 *  Add / Resolve / Delete across all three categories. No cost.
 * =================================================================== */

const PILLARS = {
  "Clean City":          { short: "Clean" },
  "Safe City":           { short: "Safe" },
  "Clear Communication": { short: "Comms" },
};
const PILLAR_HEX = { "Clean City": "#1F6B3B", "Safe City": "#1F3A60", "Clear Communication": "#C2540C" };
const STATUS = {
  "Pending":     { c: "#B7791F", s: "rgba(183,121,31,0.12)" },
  "In Progress": { c: "#1F3A60", s: "rgba(31,58,96,0.12)" },
  "Resolved":    { c: "#1F6B3B", s: "rgba(31,107,59,0.12)" },
  "Completed":   { c: "#1F6B3B", s: "rgba(31,107,59,0.12)" },
  "Not Started": { c: "#938B80", s: "rgba(147,139,128,0.12)" },
  "Tabled":      { c: "#8A6D1F", s: "rgba(138,109,31,0.12)" },
  "Passed":      { c: "#1F6B3B", s: "rgba(31,107,59,0.12)" },
  "Denied":      { c: "#B03A2E", s: "rgba(176,58,46,0.12)" },
};

/* TODAY pinned to the demo date so seeded "days out" numbers stay sensible.
   In real use, replace with: const TODAY = new Date(); */
const TODAY = new Date("2026-06-04");
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const daysUntil = (s) => Math.round((new Date(s + "T00:00:00") - TODAY) / 86400000);
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
let _seq = 0;
const genId = (p) => {
  const rand = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8);
  return `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}_${rand}`; // timestamp + per-session counter + random = unique
};

/* ===================================================================
 *  THE DATA SEAM — the ONLY block that changes when you add Firebase.
 *  Today: read once from data.json, then persist edits to localStorage.
 *  To switch to Firebase, replace loadState() + persist() with Firestore
 *  reads/writes (onSnapshot + addDoc/updateDoc/deleteDoc). The render
 *  layer and every mutation below stay the same — they only touch
 *  `state` and call persist()/render().
 * =================================================================== */
const STORAGE_KEY = "mcc-state-v1";
let state = { concerns: [], projects: [], legislative: [] };
let ui = { view: "command", expanded: null, modal: null, savedAt: null };

async function loadState() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) { state = JSON.parse(cached); return; }
  const res = await fetch("./data.json");
  if (!res.ok) throw new Error("data.json fetch failed: " + res.status);
  state = await res.json();
  persist();
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  ui.savedAt = new Date();
}
/* --- mutations: change state, persist, re-render. --- */
function ackConcern(id)     { const c = state.concerns.find(x => x.id === id); if (c) { c.acknowledged = true; persist(); render(); } }
function resolveConcern(id) { const c = state.concerns.find(x => x.id === id); if (c) { c.status = "Resolved"; c.resolvedThisWeek = true; persist(); render(); } }
function togglePrep(id, i)  { const l = state.legislative.find(x => x.id === id); if (l && l.prep[i]) { l.prep[i].done = !l.prep[i].done; persist(); render(); } }
function addConcern(o)      { state.concerns.unshift(o); persist(); render(); }
function addProject(o)      { state.projects.push(o);    persist(); render(); }
function addLegislative(o)  { state.legislative.push(o); persist(); render(); }
function deleteItem(kind, id) {
  const key = { concern: "concerns", project: "projects", legislative: "legislative" }[kind];
  if (!key) return;
  state[key] = state[key].filter(x => x.id !== id);
  persist(); render();
}

/* --- Export / Import / Reset --- */
function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "command-center-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJson(file) {
  const r = new FileReader();
  r.onload = () => { try { state = JSON.parse(r.result); persist(); render(); } catch { alert("That file isn't valid JSON."); } };
  r.readAsText(file);
}
async function resetData() {
  if (!confirm("Reset to the baseline data.json? Your current changes will be lost.")) return;
  localStorage.removeItem(STORAGE_KEY);
  const res = await fetch("./data.json");
  state = await res.json();
  persist(); render();
}

/* ===================== derived selectors ===================== */
const getPulse = () => state.concerns.filter(c => c.priority === "High" && c.status === "Pending");
const getInProgress = () => state.projects.filter(p => p.status === "In Progress");
const getGovernance = () => state.legislative
  .filter(l => l.status === "Tabled" || l.status === "Pending")
  .sort((a, b) => new Date(a.voteDate) - new Date(b.voteDate));

/* ===================== view helpers ===================== */
const chip = (label, c, s) => `<span class="chip" style="color:${c};background:${s};border-color:${c}33">${esc(label)}</span>`;
const dot = (pillar) => `<span class="dot" style="background:${PILLAR_HEX[pillar] || "#938B80"}" title="${esc(pillar)}"></span>`;
const del = (kind, id) => `<button class="del-btn" data-action="delete" data-kind="${kind}" data-id="${id}" title="Delete">×</button>`;
const opts = (arr, sel) => arr.map(o => `<option value="${esc(o)}" ${o === sel ? "selected" : ""}>${esc(o)}</option>`).join("");
const optProjects = () => `<option value="">— none —</option>` + state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
const optLeg = () => `<option value="">— none —</option>` + state.legislative.map(l => `<option value="${l.id}">${esc(l.title)}</option>`).join("");

/* ===================== hero ===================== */
function renderHero() {
  const pulse = getPulse();
  const next = getGovernance()[0];
  const ip = getInProgress();
  const avg = ip.length ? Math.round(ip.reduce((s, p) => s + p.percentComplete, 0) / ip.length) : 0;
  const resolved = state.concerns.filter(c => c.resolvedThisWeek).length;
  const cards = [
    { hero: true, num: pulse.length, lab: "Open High-Priority Concerns", sub: "Clear this list by Friday" },
    { num: next ? daysUntil(next.voteDate) + "d" : "—", lab: "Next Council Vote", sub: next ? esc(next.title) : "Nothing scheduled" },
    { num: avg + "%", lab: "Fairfield 2035 Progress", sub: "Avg across active projects" },
    { num: resolved, lab: "Resolved This Week", sub: "Concerns closed since Monday" },
  ];
  return `<div class="hero">${cards.map(c => `
    <div class="stat ${c.hero ? "heroCard" : ""}"><div class="num">${c.num}</div><div class="lab">${c.lab}</div><div class="sub">${c.sub}</div></div>`).join("")}</div>`;
}

/* ===================== Pulse (col A) ===================== */
function concernCard(c) {
  return `<div class="card">
    ${del("concern", c.id)}
    <div class="row hdr">${dot(c.pillar)}${chip("High", "#B03A2E", "rgba(176,58,46,0.10)")}<span class="spacer muted" style="font-size:11px">${fmtDate(c.dateReceived)}</span></div>
    <div class="desc">${esc(c.description)}</div>
    <div class="meta">${esc(c.residentName)} · ${esc(c.contact)}</div>
    <div class="btnrow">
      <button class="act ack ${c.acknowledged ? "done" : ""}" data-action="ack" data-id="${c.id}" ${c.acknowledged ? "disabled" : ""}>${c.acknowledged ? "✓ Acknowledged" : "Acknowledge"}</button>
      <button class="act resolve" data-action="resolve" data-id="${c.id}">Resolve</button>
    </div>
  </div>`;
}
function renderPulse() {
  const pulse = getPulse();
  const body = pulse.length === 0 ? `<div class="empty">✓<br/>Inbox zero. Cleared for Friday.</div>` : pulse.map(concernCard).join("");
  return `<section>
    <div class="section-head"><div class="left"><span class="badge" style="background:#B03A2E">◈</span>
      <div><div class="k">Column A</div><div class="t">The Pulse</div></div></div>
      <div class="sh-right"><button class="add-btn" data-action="add" data-kind="concern">+ Add</button><span class="count" style="color:#B03A2E">${pulse.length}</span></div></div>
    ${body}</section>`;
}

/* ===================== Progress (col B) ===================== */
function projectCard(p) {
  const open = ui.expanded === p.id;
  const hex = PILLAR_HEX[p.pillar] || "#938B80";
  const vote = state.legislative.find(l => l.id === p.linkedResolutionId);
  const related = state.concerns.filter(c => (p.relatedConcernIds || []).includes(c.id));
  let detail = "";
  if (open) {
    detail = `<div class="proj-detail">
      <div class="lk"><span class="strong">Next milestone:</span> ${esc(p.nextMilestone)}</div>
      ${vote ? `<div class="lk">Linked vote: <span class="strong">${esc(vote.title)}</span> ${chip(vote.status, STATUS[vote.status].c, STATUS[vote.status].s)}</div>` : ""}
      ${related.length ? `<div>${related.length} linked concern${related.length > 1 ? "s" : ""}:
        <ul>${related.map(r => `<li><span class="pip" style="background:${STATUS[r.status].c}"></span>${esc(r.description)}</li>`).join("")}</ul></div>` : ""}
    </div>`;
  }
  return `<div class="card proj-card" data-action="toggle-project" data-id="${p.id}" role="button" tabindex="0">
    ${del("project", p.id)}
    <div class="row hdr">${dot(p.pillar)}<span class="strong" style="font-size:13px">${esc(p.name)}</span><span class="spacer muted">${open ? "▾" : "▸"}</span></div>
    <div class="meta" style="display:flex;gap:8px"><span style="color:${hex};font-weight:600">Phase ${p.phase}/6</span><span>·</span><span>${esc(p.lead)}</span></div>
    <div class="row" style="margin-top:4px"><span class="bar"><span style="width:${p.percentComplete}%;background:${hex}"></span></span><span class="pct" style="color:${hex}">${p.percentComplete}%</span></div>
    ${detail}</div>`;
}
function renderProgress() {
  const ip = getInProgress();
  return `<section>
    <div class="section-head"><div class="left"><span class="badge" style="background:#1F6B3B">⚑</span>
      <div><div class="k">Column B</div><div class="t">Fairfield 2035</div></div></div>
      <div class="sh-right"><button class="add-btn" data-action="add" data-kind="project">+ Add</button><span class="count" style="color:#1F6B3B">${ip.length}</span></div></div>
    ${ip.map(projectCard).join("")}</section>`;
}

/* ===================== Governance (col C) ===================== */
function govCard(item) {
  const d = daysUntil(item.voteDate);
  const done = (item.prep || []).filter(p => p.done).length;
  return `<div class="card">
    ${del("legislative", item.id)}
    <div class="row hdr"><span class="strong" style="font-size:13px">${esc(item.title)}</span><span class="spacer">${chip(item.status, STATUS[item.status].c, STATUS[item.status].s)}</span></div>
    <div class="gov-meta">📅 ${fmtDate(item.voteDate)} <span style="color:${d <= 5 ? "#B03A2E" : "var(--ink-faint)"};font-weight:600">(${d}d out)</span> · ${esc(item.committee)}</div>
    <div class="desc" style="font-size:11px;margin-top:0;color:var(--ink-soft)">${esc(item.description)}</div>
    <div class="prep">
      <div class="prep-head"><span class="pl">☑ Prep</span><span style="font-size:10px;font-weight:600;color:${done === (item.prep || []).length && item.prep.length ? "#1F6B3B" : "var(--ink-faint)"}">${done}/${(item.prep || []).length}</span></div>
      ${(item.prep || []).length ? (item.prep).map((p, i) => `<button class="${p.done ? "done" : ""}" data-action="prep" data-id="${item.id}" data-i="${i}"><span style="color:${p.done ? "#1F6B3B" : "var(--ink-faint)"}">${p.done ? "●" : "○"}</span><span class="lbl">${esc(p.label)}</span></button>`).join("") : `<div class="muted" style="font-size:11px">No prep items yet.</div>`}
    </div></div>`;
}
function renderGovernance() {
  const gov = getGovernance();
  return `<section>
    <div class="section-head"><div class="left"><span class="badge" style="background:#1F3A60">§</span>
      <div><div class="k">Column C</div><div class="t">Governance</div></div></div>
      <div class="sh-right"><button class="add-btn" data-action="add" data-kind="legislative">+ Add</button><span class="count" style="color:#1F3A60">${gov.length}</span></div></div>
    ${gov.map(govCard).join("")}</section>`;
}

/* ===================== Friday Review ===================== */
function renderReview() {
  const resolved = state.concerns.filter(c => c.resolvedThisWeek);
  const upcoming = state.legislative.filter(l => l.status !== "Passed" && l.status !== "Denied").sort((a, b) => new Date(a.voteDate) - new Date(b.voteDate));
  const milestones = state.projects.filter(p => p.status === "In Progress");
  const byPillar = Object.keys(PILLARS).map(k => ({
    name: PILLARS[k].short, hex: PILLAR_HEX[k],
    value: state.concerns.filter(c => c.pillar === k && (c.status === "Pending" || c.status === "In Progress")).length,
  }));
  const maxV = Math.max(1, ...byPillar.map(b => b.value));
  return `<div>
    <div class="fr-grid">
      <div class="block"><div class="block-head"><span>✓</span><span class="bt">Resolved This Week</span></div>
        <div class="bignum">${resolved.length}</div>
        ${resolved.map(r => `<div class="fr-line">${dot(r.pillar)}<span>${esc(r.description)}</span></div>`).join("")}</div>
      <div class="block"><div class="block-head"><span>§</span><span class="bt">Votes Requiring Attention</span></div>
        ${upcoming.map(v => { const d = daysUntil(v.voteDate); const ready = (v.prep || []).every(p => p.done);
          return `<div class="fr-line"><span class="strong">${esc(v.title)}</span>${chip(d + "d", d <= 5 ? "#B03A2E" : "var(--ink-soft)", d <= 5 ? "rgba(176,58,46,0.10)" : "var(--line-soft)")}${!ready ? `<span style="font-size:10px;font-weight:600;color:#B03A2E">prep incomplete</span>` : ""}</div>`; }).join("")}</div>
      <div class="block"><div class="block-head"><span>▤</span><span class="bt">Open Concerns by Pillar</span></div>
        <div class="barchart">${byPillar.map(b => `<div class="barrow"><span class="muted" style="font-weight:600">${b.name}</span><span class="track"><span style="width:${(b.value / maxV) * 100}%;background:${b.hex}"></span></span><span class="bnum" style="color:${b.hex}">${b.value}</span></div>`).join("")}</div></div>
    </div>
    <div class="block"><div class="block-head"><span>⚑</span><span class="bt">Fairfield 2035 — Milestone Updates</span></div>
      <div class="milestones">${milestones.map(m => `<div class="m">${dot(m.pillar)}<span class="strong">${esc(m.name)}</span><span class="muted">→ ${esc(m.nextMilestone)}</span><span class="spacer pct" style="color:${PILLAR_HEX[m.pillar]}">${m.percentComplete}%</span></div>`).join("")}</div></div>
  </div>`;
}

/* ===================== Add modal ===================== */
function renderModal() {
  const kind = ui.modal;
  const today = todayISO();
  const PK = Object.keys(PILLARS);
  let title, fields;
  if (kind === "concern") {
    title = "Resident Concern";
    fields = `
      <div class="field"><label>Concern description</label><textarea id="f-description" placeholder="What's the issue?"></textarea></div>
      <div class="row2"><div class="field"><label>Resident name</label><input id="f-residentName" /></div><div class="field"><label>Contact</label><input id="f-contact" placeholder="phone or email" /></div></div>
      <div class="row2"><div class="field"><label>Pillar</label><select id="f-pillar">${opts(PK, PK[0])}</select></div><div class="field"><label>Priority</label><select id="f-priority">${opts(["High", "Medium", "Low"], "High")}</select></div></div>
      <div class="row2"><div class="field"><label>Status</label><select id="f-status">${opts(["Pending", "In Progress", "Resolved"], "Pending")}</select></div><div class="field"><label>Date received</label><input id="f-dateReceived" type="date" value="${today}" /></div></div>
      <div class="field"><label>Linked project (optional)</label><select id="f-linkedProjectId">${optProjects()}</select></div>
      <p class="hint">Shows in <strong>The Pulse</strong> only when priority is High and status is Pending. Others count toward totals and the Friday Review.</p>`;
  } else if (kind === "project") {
    title = "2035 Project";
    fields = `
      <div class="field"><label>Project name</label><input id="f-name" placeholder="e.g. Sidewalk Repair Phase 1" /></div>
      <div class="row2"><div class="field"><label>Pillar</label><select id="f-pillar">${opts(PK, PK[0])}</select></div><div class="field"><label>Status</label><select id="f-status">${opts(["Not Started", "In Progress", "Completed"], "In Progress")}</select></div></div>
      <div class="row2"><div class="field"><label>Phase (1–6)</label><input id="f-phase" type="number" min="1" max="6" value="1" /></div><div class="field"><label>% complete</label><input id="f-percentComplete" type="number" min="0" max="100" value="0" /></div></div>
      <div class="field"><label>Lead / department</label><input id="f-lead" /></div>
      <div class="field"><label>Next milestone</label><input id="f-nextMilestone" /></div>
      <div class="field"><label>Linked vote (optional)</label><select id="f-linkedResolutionId">${optLeg()}</select></div>
      <p class="hint">Shows in the <strong>Fairfield 2035</strong> column when status is In Progress.</p>`;
  } else {
    title = "Council Vote";
    fields = `
      <div class="field"><label>Title</label><input id="f-title" placeholder="e.g. Park Funding Resolution" /></div>
      <div class="row2"><div class="field"><label>Vote date</label><input id="f-voteDate" type="date" value="${today}" /></div><div class="field"><label>Status</label><select id="f-status">${opts(["Tabled", "Pending", "Passed", "Denied"], "Pending")}</select></div></div>
      <div class="field"><label>Committee</label><input id="f-committee" /></div>
      <div class="field"><label>Description</label><textarea id="f-description"></textarea></div>
      <div class="field"><label>Prep checklist (one per line)</label><textarea id="f-prep" placeholder="Confirm budget line&#10;Brief with staff"></textarea></div>
      <p class="hint">Shows in <strong>Governance</strong> when status is Tabled or Pending.</p>`;
  }
  return `<div class="modal-backdrop" id="backdrop"><div class="modal" role="dialog" aria-modal="true">
    <h3>Add ${title}</h3>
    <div class="fields">${fields}</div>
    <div class="modal-actions"><button class="btn-ghost" data-action="close-modal">Cancel</button><button class="btn-primary" data-action="submit-add">Add</button></div>
  </div></div>`;
}
function openModal(kind) { ui.modal = kind; render(); }
function closeModal() { ui.modal = null; render(); }
function handleAdd() {
  const kind = ui.modal;
  const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, isNaN(n) ? a : n));
  let obj, fn;
  if (kind === "concern") {
    const d = v("f-description"); if (!d) return alert("Please add a concern description.");
    obj = { id: genId("rec"), description: d, residentName: v("f-residentName") || "—", contact: v("f-contact") || "—", pillar: v("f-pillar"), priority: v("f-priority"), status: v("f-status"), dateReceived: v("f-dateReceived") || todayISO(), acknowledged: false, linkedProjectId: v("f-linkedProjectId") || null };
    fn = addConcern;
  } else if (kind === "project") {
    const n = v("f-name"); if (!n) return alert("Please add a project name.");
    obj = { id: genId("proj"), name: n, pillar: v("f-pillar"), status: v("f-status"), phase: clamp(parseInt(v("f-phase")), 1, 6), percentComplete: clamp(parseInt(v("f-percentComplete")), 0, 100), lead: v("f-lead") || "—", nextMilestone: v("f-nextMilestone") || "—", linkedResolutionId: v("f-linkedResolutionId") || null, relatedConcernIds: [] };
    fn = addProject;
  } else {
    const t = v("f-title"); if (!t) return alert("Please add a title.");
    const prep = v("f-prep").split("\n").map(s => s.trim()).filter(Boolean).map(l => ({ label: l, done: false }));
    obj = { id: genId("res"), title: t, voteDate: v("f-voteDate") || todayISO(), status: v("f-status"), committee: v("f-committee") || "—", description: v("f-description"), prep };
    fn = addLegislative;
  }
  ui.modal = null;
  fn(obj);
}

/* ===================== top-level render ===================== */
function render() {
  const saved = ui.savedAt ? "Saved " + ui.savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  const body = ui.view === "command"
    ? `<div class="cols">${renderPulse()}${renderProgress()}${renderGovernance()}</div>`
    : renderReview();
  document.getElementById("app").innerHTML = `<div class="wrap">
    <header class="masthead">
      <div><div class="kicker">⚲ District 2 · Fairfield</div><h1 class="title display">Municipal Command Center</h1></div>
      <div class="masthead-right">
        <div class="date-stack"><div class="d1">Thursday</div><div class="d2">June 4, 2026</div></div>
        <div class="toggle"><button class="${ui.view === "command" ? "active" : ""}" data-action="view" data-v="command">Command</button><button class="${ui.view === "review" ? "active" : ""}" data-action="view" data-v="review">Friday Review</button></div>
      </div>
    </header>
    <div class="controls">
      <button data-action="export">⤓ Export JSON</button>
      <button data-action="import">⤒ Import JSON</button>
      <button data-action="reset">↺ Reset to baseline</button>
      <span class="spacer"></span><span class="saved">${saved}</span>
    </div>
    ${renderHero()}
    ${body}
    <footer class="foot"><span style="font-weight:700;text-transform:uppercase;letter-spacing:.05em">Pillars:</span>
      ${Object.keys(PILLARS).map(k => `<span class="leg">${dot(k)}${k}</span>`).join("")}
      <span class="spacer"></span><span>Lite build · saves to this browser · no account, no cost</span>
    </footer>
  </div>${ui.modal ? renderModal() : ""}`;
  if (ui.modal) { const f = document.querySelector(".modal .fields input, .modal .fields textarea, .modal .fields select"); if (f) f.focus(); }
}

/* ===================== events ===================== */
document.addEventListener("click", (e) => {
  if (e.target.id === "backdrop") { closeModal(); return; }
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "ack") ackConcern(el.dataset.id);
  else if (a === "resolve") resolveConcern(el.dataset.id);
  else if (a === "prep") togglePrep(el.dataset.id, +el.dataset.i);
  else if (a === "toggle-project") { ui.expanded = ui.expanded === el.dataset.id ? null : el.dataset.id; render(); }
  else if (a === "view") { ui.view = el.dataset.v; render(); }
  else if (a === "export") exportJson();
  else if (a === "import") document.getElementById("importFile").click();
  else if (a === "reset") resetData();
  else if (a === "add") openModal(el.dataset.kind);
  else if (a === "submit-add") handleAdd();
  else if (a === "close-modal") closeModal();
  else if (a === "delete") { if (confirm("Delete this item? This can't be undone.")) deleteItem(el.dataset.kind, el.dataset.id); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.modal) closeModal(); });
document.getElementById("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); });

/* ===================== boot ===================== */
(async function init() {
  try {
    await loadState();
    render();
  } catch (err) {
    document.getElementById("app").innerHTML = `<div class="fail">
      <h2>Couldn't load data.json</h2>
      <p>This happens when you open <code>index.html</code> directly from your file system — browsers block local file reads.</p>
      <p><strong>Fix:</strong> serve the folder. In a terminal here, run <code>python3 -m http.server 8000</code> and open <code>http://localhost:8000</code>. On GitHub Pages it just works.</p>
    </div>`;
    console.error(err);
  }
})();
