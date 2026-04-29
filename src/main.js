// ============================================================
// MISSION 31 — Application principale (Vanilla JS · PWA)
// ============================================================

import { readings, passagesText } from "./data/readings.js";
import { badges, unlockedBadges } from "./data/badges.js";
import { syncProgress, fetchGlobalStats, supabaseEnabled } from "./supabase.js";

// Liens & contacts (à un seul endroit pour éviter la duplication)
const CONTACT_EMAIL = "djochristkfreelance@gmail.com";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/I3ofVHRDGPlEEmCtzSSsxV?mode=gi_t";

// ------------------------------------------------------------
// State management (localStorage backed)
// ------------------------------------------------------------
const STORAGE_KEY = "mission31:state:v1";
const APP_START = new Date(2026, 4, 1); // 1er mai 2026

const defaultState = {
  startedAt: null,
  progress: {},                // { 1: { done: true, doneAt, batchSize }, ... }
  reminders: { enabled: true, times: ["08:00", "20:00"], message: "N'oublie pas ta lecture du jour." },
  installedDismissed: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed, reminders: { ...defaultState.reminders, ...(parsed.reminders || {}) } };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function currentDay() {
  // Si l'utilisateur a démarré, base sur la date de démarrage.
  if (!state.startedAt) return 1;
  const startedAt = new Date(state.startedAt);
  const now = new Date();
  const diff = Math.floor((now - new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate())) / (1000 * 60 * 60 * 24));
  return Math.min(31, Math.max(1, diff + 1));
}

function completedCount() {
  return Object.values(state.progress).filter((d) => d.done).length;
}

function streakCount() {
  let streak = 0;
  for (let d = currentDay(); d >= 1; d--) {
    if (state.progress[d]?.done) streak++;
    else if (d < currentDay()) break;
  }
  return streak;
}

function longestStreak() {
  let max = 0, cur = 0;
  for (let d = 1; d <= 31; d++) {
    if (state.progress[d]?.done) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

function doubleCount() {
  return Object.values(state.progress).filter((d) => d.done && d.batchSize === 2).length;
}
function tripleCount() {
  return Object.values(state.progress).filter((d) => d.done && d.batchSize === 3).length;
}
function progressPct() {
  return Math.round((completedCount() / 31) * 100);
}
function daysGained() {
  return Math.max(0, completedCount() - currentDay() + 1);
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function markRead(daysCount = 1) {
  const today = currentDay();
  for (let i = 0; i < daysCount; i++) {
    const d = today + i;
    if (d > 31) break;
    state.progress[d] = { done: true, doneAt: new Date().toISOString(), batchSize: daysCount };
  }
  if (!state.startedAt) state.startedAt = new Date().toISOString();
  saveState();

  // Synchronisation avec Supabase (silencieuse, n'affecte pas l'UX)
  syncProgress(completedCount());

  if (completedCount() >= 31) {
    showToast("🎉 Mission accomplie !");
    setTimeout(() => navigate("completion"), 600);
  } else {
    showToast(daysCount > 1 ? `${daysCount} jours validés !` : "Lecture validée !");
  }
}

// ------------------------------------------------------------
// Router (hash-based)
// ------------------------------------------------------------
const routes = ["welcome", "home", "reading", "accelerated", "planning", "stats", "rewards", "share", "help", "offline", "reminders", "completion", "globalstats"];

function getRoute() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  if (!h) return state.startedAt ? "home" : "welcome";
  return routes.includes(h) ? h : "home";
}

function navigate(r) {
  location.hash = `#/${r}`;
}

window.addEventListener("hashchange", render);
window.addEventListener("online", render);
window.addEventListener("offline", render);

// ------------------------------------------------------------
// Icons (inline SVG)
// ------------------------------------------------------------
const I = {
  bible: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`,
  bibleSmall: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`,
  menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>`,
  bell: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  cal: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  checkBig: `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  flame: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7a00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  // Tab icons
  tabHome: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>`,
  tabPlan: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  tabStats: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>`,
  tabRewards: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>`,
  tabHelp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  // Help icons
  question: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  reading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  bellSmall: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>`,
  phone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  whatsapp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.667 5.467l-.999 3.648 3.821-1.814zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>`,
  // Special badge icons
  rocket: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  key: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  lock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  shield: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  compass: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  trophy: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 0h1.5a2.5 2.5 0 0 1 0 5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`,
  bolt: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  flameSpec: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  medal: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/><path d="M9 9V2h6v7"/></svg>`,
  wifiOff: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
  users: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  install: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
};

const badgeIcons = { rocket: I.rocket, key: I.key, lock: I.lock, shield: I.shield, compass: I.compass, trophy: I.trophy, bolt: I.bolt, flame: I.flameSpec, medal: I.medal };

// ------------------------------------------------------------
// Components
// ------------------------------------------------------------
function topbar({ title, leftAction, rightActions = [] }) {
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:8px;">
        ${leftAction || ""}
        <span class="topbar__title">${title}</span>
      </div>
      <div style="display:flex;gap:6px;">${rightActions.join("")}</div>
    </div>`;
}

function tabbar(active) {
  const tabs = [
    { id: "home", icon: I.tabHome, label: "Accueil" },
    { id: "planning", icon: I.tabPlan, label: "Planning" },
    { id: "stats", icon: I.tabStats, label: "Stats" },
    { id: "rewards", icon: I.tabRewards, label: "Récompenses" },
    { id: "help", icon: I.tabHelp, label: "Aide" },
  ];
  return `
    <nav class="tabbar"><div class="tabbar__inner">
      ${tabs.map((t) => `
        <button class="tab" data-nav="${t.id}" ${active === t.id ? 'aria-current="page"' : ""}>
          ${t.icon}<span>${t.label}</span>
        </button>`).join("")}
    </div></nav>`;
}

// ------------------------------------------------------------
// Views
// ------------------------------------------------------------
function viewWelcome() {
  return `
    <div class="shell shell--dark">
      <div class="splash">
        <div></div>
        <div class="splash__hero">
          <div class="splash__icon">${I.bible}</div>
          <h1 class="splash__title">MISSION<span>31</span></h1>
          <p class="splash__subtitle">Lis le Nouveau Testament<br/>en 31 jours</p>
        </div>
        <div class="splash__cta">
          <button class="btn" data-action="start">Commencer la mission</button>
          <a class="splash__group" href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer">
            ${I.whatsapp}
            <span>Rejoindre le groupe WhatsApp Mission 31</span>
          </a>
          <p class="splash__verse">
            « Ta parole est une lampe à mes pieds,<br/>et une lumière sur mon sentier. »
            <small>Psaumes 119:105</small>
          </p>
        </div>
      </div>
    </div>`;
}

function viewHome() {
  const day = currentDay();
  const today = readings.find((r) => r.day === day);
  const passages = today ? today.passages.join(", ") : "—";
  const pct = progressPct();
  const completed = completedCount();
  const isTodayDone = state.progress[day]?.done;

  return `
    <div class="shell">
      ${topbar({
        title: "Accueil",
        leftAction: `<button class="topbar__btn" data-action="menu">${I.menu}</button>`,
        rightActions: [`<button class="topbar__btn" data-nav="reminders">${I.bell}</button>`],
      })}
      <main class="view">
        <div class="home">
          <div class="card day-card">
            <div class="day-card__label">${I.bibleSmall ? "" : ""}Jour <strong style="color:var(--primary);font-size:24px;font-weight:700;">${day}</strong> / 31</div>
            <div class="day-card__sub" style="margin-top:14px;">Aujourd'hui</div>
            <div class="day-card__passages">${passages}</div>
            <button class="btn" data-nav="reading">${isTodayDone ? "Relire aujourd'hui" : "Lire aujourd'hui"}</button>
          </div>

          <div class="card progress-card">
            <div class="progress-card__head">
              <span class="progress-card__title">Progression globale</span>
              <span class="progress-card__pct">${pct}%</span>
            </div>
            <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
            <div class="progress-card__count">${completed} / 31 jours</div>
          </div>

          <div class="card streak-card">
            <span class="streak-card__label">Streak actuel ${I.flame}</span>
            <span class="streak-card__value">${streakCount()} jours</span>
          </div>

          <div class="card streak-card" style="cursor:pointer" data-nav="accelerated">
            <span class="streak-card__label">Lecture accélérée</span>
            <span class="streak-card__value" style="font-size:14px;color:var(--primary);">Avancer →</span>
          </div>

          <a class="group-cta" href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer">
            ${I.whatsapp}
            <span class="group-cta__text">Rejoins la communauté <em>Mission 31</em></span>
            <span class="group-cta__arrow">→</span>
          </a>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewReading() {
  const day = currentDay();
  const today = readings.find((r) => r.day === day);
  const passages = today ? today.passages : [];
  const isDone = state.progress[day]?.done;

  return `
    <div class="shell">
      ${topbar({
        title: `Jour ${day}`,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="reading">
          <div class="reading__hero">
            <div class="reading__day-label">${today.date}</div>
            <div class="reading__day-title">Jour ${day} / 31</div>
            <div class="reading__passage">${passages.join(", ")}</div>
          </div>

          <div class="reading__list">
            <h3 class="reading__list-title">À lire aujourd'hui</h3>
            <div>${passages.map((p) => `<span class="reading__chip">${p}</span>`).join("")}</div>
          </div>

          <div class="card">
            <p class="reading__verse">
              « Heureux celui qui lit, et ceux qui entendent les paroles de la prophétie,<br/>
              et qui gardent les choses qui y sont écrites ! »
              <small>Apocalypse 1:3</small>
            </p>
          </div>

          ${!isDone
            ? `<button class="btn" data-action="mark-today">${I.checkBig.replace("42", "20").replace("42", "20")} J'ai terminé ma lecture</button>`
            : `<button class="btn btn--ghost" data-action="unmark-today">Lecture déjà validée — Annuler</button>`
          }
          <button class="btn btn--ghost" data-nav="share">Partager ma progression</button>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewAccelerated() {
  const day = currentDay();
  const remaining = 31 - completedCount();
  const options = [
    { count: 1,  title: "1 jour",   sub: "Lecture normale" },
    { count: 2,  title: "2 jours",  sub: "Double lecture" },
    { count: 3,  title: "3 jours",  sub: "Triple lecture" },
    { count: 5,  title: "5 jours",  sub: "Lecture avancée" },
    { count: 10, title: "10 jours", sub: "Mode intensif" },
    { count: 15, title: "15 jours", sub: "Mode marathon" },
  ];
  const selected = window.__accSelection || 1;

  return `
    <div class="shell">
      ${topbar({
        title: "Lecture accélérée",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="accelerated">
          <p class="accelerated__intro">Combien de jours veux-tu valider ?</p>
          <p class="accelerated__day">Tu es au jour ${day} — ${remaining} jours restants.</p>

          <div class="option-list">
            ${options.map((o) => `
              <button class="option ${selected === o.count ? "option--active" : ""}" data-acc="${o.count}" ${o.count > remaining ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>
                <span class="option__left">
                  <span class="option__title">${o.title}</span>
                  <span class="option__sub">${o.sub}</span>
                </span>
                <span class="option__radio"></span>
              </button>
            `).join("")}
          </div>

          <div class="callout">
            ${I.info}
            <span>Estimation : environ ${selected * 4} à ${selected * 6} minutes de lecture. Assure-toi d'avoir le temps nécessaire pour bien comprendre la Parole.</span>
          </div>

          <button class="btn" data-action="confirm-acc">Je confirme avoir lu ${selected} jour${selected > 1 ? "s" : ""}</button>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewPlanning() {
  const today = currentDay();
  return `
    <div class="shell">
      ${topbar({
        title: "Planning",
        leftAction: `<span style="margin-left:4px;">${I.cal}</span>`,
        rightActions: [`<button class="topbar__btn" data-nav="reminders">${I.bell}</button>`],
      })}
      <main class="view">
        <p class="planning__sub">Mai · 31 jours pour finir</p>
        <div class="planning-list">
          ${readings.map((r) => {
            const done = state.progress[r.day]?.done;
            const isToday = r.day === today;
            const cls = done ? "plan-row--done" : isToday ? "plan-row--today" : "";
            return `
              <button class="plan-row ${cls}" data-day="${r.day}">
                <span class="plan-row__check">${done ? I.check : isToday ? `<span style="font-size:11px;font-weight:700;color:var(--primary);">${r.day}</span>` : `<span style="font-size:11px;font-weight:600;color:var(--ink-faint);">${r.day}</span>`}</span>
                <span>
                  <div class="plan-row__title">${r.passages.join(", ")}</div>
                </span>
                <span class="plan-row__date">${isToday ? "Aujourd'hui" : r.date}</span>
              </button>`;
          }).join("")}
        </div>
      </main>
      ${tabbar("planning")}
    </div>`;
}

function viewStats() {
  const pct = progressPct();
  const C = 2 * Math.PI * 60;
  const offset = C - (pct / 100) * C;
  return `
    <div class="shell">
      ${topbar({ title: "Stats" })}
      <main class="view">
        <div class="stats">
          <div class="card donut-card">
            <div class="donut">
              <svg width="160" height="160" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" fill="none" stroke="#eef1f2" stroke-width="14"/>
                <circle cx="70" cy="70" r="60" fill="none" stroke="#2d8a8a" stroke-width="14"
                  stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
              </svg>
              <div class="donut__inner">
                <div class="donut__pct">${pct}%</div>
                <div class="donut__label">Progression</div>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-tile__label">Jours complétés</div>
              <div class="stat-tile__value">${completedCount()} / 31</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Streak actuel ${I.flame}</div>
              <div class="stat-tile__value">${streakCount()} jours</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Doubles lectures</div>
              <div class="stat-tile__value">${doubleCount()}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Triples lectures</div>
              <div class="stat-tile__value">${tripleCount()}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Plus longue série</div>
              <div class="stat-tile__value">${longestStreak()} jours</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Jours gagnés</div>
              <div class="stat-tile__value">${daysGained()} jours</div>
            </div>
          </div>

          <p class="encourage">Il te reste ${31 - completedCount()} jours pour finir la mission.<br/>Continue, tu y es presque !</p>

          <button class="btn btn--ghost" data-nav="globalstats">Voir les stats globales</button>
        </div>
      </main>
      ${tabbar("stats")}
    </div>`;
}

function viewRewards() {
  const unlocked = unlockedBadges(state);
  const completedB = badges.filter((b) => b.category === "completed");
  const specialB = badges.filter((b) => b.category === "special");

  function renderBadge(b) {
    const isUnlocked = unlocked.has(b.id);
    return `
      <div class="badge ${isUnlocked ? "" : "badge--locked"}">
        <div class="badge__icon">${badgeIcons[b.icon] || I.trophy}</div>
        <div class="badge__name">${b.name}</div>
        <div class="badge__desc">${b.desc}</div>
      </div>`;
  }

  return `
    <div class="shell">
      ${topbar({ title: "Récompenses" })}
      <main class="view">
        <div class="rewards">
          <h3 class="rewards__section-title">Badges débloqués</h3>
          <div class="badge-grid">${completedB.slice(0, 3).map(renderBadge).join("")}</div>

          <h3 class="rewards__section-title">Badges à débloquer</h3>
          <div class="badge-grid">${completedB.slice(3).map(renderBadge).join("")}</div>

          <h3 class="rewards__section-title">Badges spéciaux</h3>
          <div class="badge-grid">${specialB.map(renderBadge).join("")}</div>
        </div>
      </main>
      ${tabbar("rewards")}
    </div>`;
}

function viewShare() {
  const day = currentDay();
  return `
    <div class="shell">
      ${topbar({
        title: "Partager ma progression",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="share">
          <div class="share-card" id="shareCard">
            <div class="share-card__icon">${I.bible}</div>
            <h2 class="share-card__title">MISSION 31</h2>
            <div class="share-card__day">JOUR <strong>${day}</strong> / 31</div>
            <p class="share-card__msg">Je suis la mission et<br/>je lis le Nouveau Testament<br/>tout le mois de mai !</p>
            <span class="share-card__tag">#Mission31</span>
          </div>

          <div class="share-actions">
            <button class="btn btn--whatsapp" data-action="share-whatsapp">${I.whatsapp} Partager sur WhatsApp</button>
            <button class="btn btn--ghost" data-action="share-native">Enregistrer / Partager</button>
          </div>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewHelp() {
  const items = [
    { icon: I.question,  title: "Comment fonctionne Mission 31 ?", action: "faq-how" },
    { icon: I.reading,   title: "Comment utiliser les lectures accélérées ?", action: "faq-acc" },
    { icon: I.bellSmall, title: "Notifications & rappels", nav: "reminders" },
    {
      icon: I.whatsapp,
      title: "Rejoindre le groupe WhatsApp",
      sub: "Échange et encouragements avec la communauté",
      href: WHATSAPP_GROUP_URL,
      target: "_blank",
      accent: true,
    },
    {
      icon: I.mail,
      title: "Contact développeur",
      sub: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}?subject=Mission%2031`,
    },
  ];
  return `
    <div class="shell">
      ${topbar({ title: "Aide & Contact" })}
      <main class="view">
        <div class="help">
          ${items.map((it) => {
            const tag = it.href ? "a" : "button";
            const attrs = it.href
              ? `href="${it.href}" ${it.target ? `target="${it.target}" rel="noopener noreferrer"` : ""}`
              : `${it.nav ? `data-nav="${it.nav}"` : ""} ${it.action ? `data-action="${it.action}"` : ""}`;
            return `
              <${tag} class="help-row ${it.accent ? "help-row--accent" : ""}" ${attrs}>
                <span class="help-row__icon">${it.icon}</span>
                <span class="help-row__body">
                  <div class="help-row__title">${it.title}</div>
                  ${it.sub ? `<div class="help-row__sub">${it.sub}</div>` : ""}
                </span>
              </${tag}>`;
          }).join("")}
        </div>
      </main>
      ${tabbar("help")}
    </div>`;
}

function viewOffline() {
  return `
    <div class="shell">
      ${topbar({
        title: "Mode hors ligne",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view view--no-tabs">
        <div class="offline">
          <div class="offline__icon">${I.wifiOff}</div>
          <h2 class="offline__title">Pas de connexion Internet</h2>
          <p class="offline__msg">Aucun souci ! Tu peux continuer ta lecture. Tes données seront synchronisées dès que tu seras de nouveau connecté.</p>
          <button class="btn" data-action="back">Compris</button>
        </div>
      </main>
    </div>`;
}

function viewReminders() {
  const r = state.reminders;
  return `
    <div class="shell">
      ${topbar({
        title: "Rappels",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="reminders">
          <div class="row-toggle">
            <span class="row-toggle__title">Activer les rappels</span>
            <button class="switch ${r.enabled ? "switch--on" : ""}" data-action="toggle-rem"></button>
          </div>

          <div class="times-card">
            <h3 class="times-card__title">Heures de rappel</h3>
            <p class="times-card__sub">Choisis 1 ou 2 heures où tu veux être rappelé.</p>
            <div class="times-list">
              ${r.times.map((t, i) => `
                <span class="time-chip">${t}<button data-action="rem-del" data-i="${i}">${I.close}</button></span>
              `).join("")}
            </div>
            ${r.times.length < 4 ? `
              <div class="time-input-row">
                <input type="time" id="newTime" value="12:00"/>
                <button class="btn btn--ghost add-time" data-action="rem-add">${I.plus} Ajouter une heure</button>
              </div>` : ""}
          </div>

          <div class="field">
            <label>Message de rappel</label>
            <textarea id="remMsg" placeholder="N'oublie pas ta lecture du jour.">${r.message}</textarea>
          </div>

          <button class="btn" data-action="rem-save">Enregistrer</button>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewCompletion() {
  const endDate = "31 Mai 2026";
  return `
    <div class="shell">
      ${topbar({
        title: "Félicitations !",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view view--no-tabs">
        <div class="completion">
          <div class="completion__check">${I.checkBig}</div>
          <h2 class="completion__title">Félicitations !</h2>
          <p class="completion__msg">Tu as terminé la mission 🎉<br/>Que Dieu te bénisse abondamment.</p>
          <div class="completion__stats">
            <div class="stat-tile">
              <div class="stat-tile__label">Jours complétés</div>
              <div class="stat-tile__value">${completedCount()} / 31</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Date de fin</div>
              <div class="stat-tile__value" style="font-size:15px;">${endDate}</div>
            </div>
          </div>
          <button class="btn" data-action="reset">Recommencer une mission</button>
        </div>
      </main>
    </div>`;
}

function viewGlobalStats() {
  // Données réelles depuis Supabase (chargement asynchrone après render).
  // Tant que les données ne sont pas reçues, on affiche un état de chargement.
  return `
    <div class="shell">
      ${topbar({
        title: "Stats globales",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="gstats" id="gstats">
          ${!supabaseEnabled ? `
            <div class="gstats__empty">
              <p><strong>Stats globales indisponibles.</strong></p>
              <p>La connexion à la base de données n'est pas configurée. Voir le <code>README</code> pour activer Supabase.</p>
            </div>
          ` : `
            <div class="gstats__loading">Chargement des statistiques…</div>
          `}
        </div>

        <a class="group-cta" href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer" style="margin-top:20px;">
          ${I.whatsapp}
          <span class="group-cta__text">Rejoins la communauté <em>Mission 31</em></span>
          <span class="group-cta__arrow">→</span>
        </a>
      </main>
      ${tabbar("stats")}
    </div>`;
}

function renderGlobalStatsContent(data) {
  const container = document.getElementById("gstats");
  if (!container) return;
  if (!data) {
    container.innerHTML = `
      <div class="gstats__empty">
        <p><strong>Données indisponibles.</strong></p>
        <p>Impossible de récupérer les statistiques pour le moment. Vérifie ta connexion et réessaie plus tard.</p>
      </div>`;
    return;
  }
  const { total_users = 0, completed_missions = 0, completion_rate = 0 } = data;
  container.innerHTML = `
    <div class="gstat">
      <div class="gstat__icon">${I.users}</div>
      <div>
        <div class="gstat__value">${Number(total_users).toLocaleString("fr-FR")}</div>
        <div class="gstat__label">Utilisateurs</div>
      </div>
    </div>
    <div class="gstat">
      <div class="gstat__icon">${I.checkBig.replace('width="42"', 'width="20"').replace('height="42"', 'height="20"')}</div>
      <div>
        <div class="gstat__value">${Number(completed_missions).toLocaleString("fr-FR")}</div>
        <div class="gstat__label">Missions terminées</div>
      </div>
    </div>
    <div class="gstat">
      <div class="gstat__icon">${I.tabStats}</div>
      <div>
        <div class="gstat__value">${Number(completion_rate)}%</div>
        <div class="gstat__label">Taux de complétion</div>
      </div>
    </div>
    <p class="gstat__caption">Données réelles synchronisées depuis Supabase.</p>
  `;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
const VIEWS = {
  welcome: viewWelcome,
  home: viewHome,
  reading: viewReading,
  accelerated: viewAccelerated,
  planning: viewPlanning,
  stats: viewStats,
  rewards: viewRewards,
  share: viewShare,
  help: viewHelp,
  offline: viewOffline,
  reminders: viewReminders,
  completion: viewCompletion,
  globalstats: viewGlobalStats,
};

function render() {
  const route = !navigator.onLine && getRoute() !== "welcome" ? "offline" : getRoute();
  const view = VIEWS[route] || viewHome;
  document.getElementById("app").innerHTML = view();
  attachInstallBanner();
  window.scrollTo({ top: 0 });

  // Hooks après-rendu (chargements asynchrones par vue)
  if (route === "globalstats" && supabaseEnabled) {
    fetchGlobalStats().then(renderGlobalStatsContent);
  }
}

// ------------------------------------------------------------
// Event delegation
// ------------------------------------------------------------
document.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) { navigate(navEl.dataset.nav); return; }

  const dayEl = e.target.closest("[data-day]");
  if (dayEl) { /* Could open day detail; for now just navigate to reading if it's today */ navigate("reading"); return; }

  const accEl = e.target.closest("[data-acc]");
  if (accEl && !accEl.disabled) { window.__accSelection = Number(accEl.dataset.acc); render(); return; }

  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  switch (action) {
    case "start":
      state.startedAt = new Date().toISOString();
      saveState();
      navigate("home");
      break;
    case "back":
      history.length > 1 ? history.back() : navigate("home");
      break;
    case "menu":
      navigate("help");
      break;
    case "mark-today":
      markRead(1);
      render();
      break;
    case "unmark-today": {
      const d = currentDay();
      delete state.progress[d];
      saveState();
      render();
      break;
    }
    case "confirm-acc": {
      const n = window.__accSelection || 1;
      markRead(n);
      window.__accSelection = 1;
      navigate("home");
      break;
    }
    case "toggle-rem":
      state.reminders.enabled = !state.reminders.enabled;
      saveState();
      render();
      break;
    case "rem-add": {
      const v = document.getElementById("newTime")?.value;
      if (v && !state.reminders.times.includes(v)) {
        state.reminders.times.push(v);
        state.reminders.times.sort();
        saveState();
        render();
      }
      break;
    }
    case "rem-del": {
      const i = Number(actionEl.dataset.i);
      state.reminders.times.splice(i, 1);
      saveState();
      render();
      break;
    }
    case "rem-save": {
      const msg = document.getElementById("remMsg")?.value || "";
      state.reminders.message = msg;
      saveState();
      showToast("Rappels enregistrés !");
      if (state.reminders.enabled) {
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      }
      break;
    }
    case "share-whatsapp": {
      const txt = encodeURIComponent(`Je suis la mission #Mission31 ! Jour ${currentDay()}/31 — Je lis le Nouveau Testament tout le mois de mai. Rejoins-moi 🙏`);
      window.open(`https://wa.me/?text=${txt}`, "_blank");
      break;
    }
    case "share-native": {
      if (navigator.share) {
        navigator.share({
          title: "Mission 31",
          text: `Je suis la mission #Mission31 ! Jour ${currentDay()}/31 — Je lis le Nouveau Testament tout le mois de mai.`,
          url: location.href,
        }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(`#Mission31 — Jour ${currentDay()}/31 — ${location.href}`);
        showToast("Lien copié dans le presse-papier !");
      }
      break;
    }
    case "reset":
      if (confirm("Recommencer la mission ? Ta progression sera réinitialisée.")) {
        state = { ...defaultState };
        saveState();
        navigate("welcome");
      }
      break;
    case "faq-how":
      alert("Mission 31 te propose un plan de lecture pour parcourir tout le Nouveau Testament en 31 jours. Chaque jour, ouvre l'app, lis le passage proposé puis valide ta lecture. Tu peux activer des rappels pour ne rien manquer.");
      break;
    case "faq-acc":
      alert("Si tu as plus de temps un jour donné, utilise la lecture accélérée pour valider plusieurs jours d'un coup. Idéal pour rattraper un retard ou prendre de l'avance !");
      break;
    case "install":
      triggerInstall();
      break;
    case "install-dismiss":
      state.installedDismissed = true;
      saveState();
      render();
      break;
  }
});

// ------------------------------------------------------------
// PWA install prompt
// ------------------------------------------------------------
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  attachInstallBanner();
});

function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
}

function attachInstallBanner() {
  if (!deferredPrompt || state.installedDismissed) return;
  if (document.querySelector(".install-banner")) return;
  const el = document.createElement("div");
  el.className = "install-banner";
  el.innerHTML = `
    <span class="install-banner__icon">${I.install}</span>
    <div class="install-banner__body">
      <div class="install-banner__title">Installer Mission 31</div>
      <div class="install-banner__sub">Lis hors ligne, où tu veux.</div>
    </div>
    <button data-action="install">Installer</button>
    <button class="install-banner__close" data-action="install-dismiss">${I.close}</button>
  `;
  document.body.appendChild(el);
}

// ------------------------------------------------------------
// Service Worker registration
// ------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = new URL("./sw.js", document.baseURI).href;
    navigator.serviceWorker.register(swUrl, { scope: new URL("./", document.baseURI).pathname })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
window.__accSelection = 1;
render();
