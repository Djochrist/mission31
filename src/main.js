// ============================================================
// MISSION 31 : Application principale (Vanilla JS · PWA)
// ============================================================

import appIconUrl from "./assets/icon-512.png";
import { readings, passagesText } from "./data/readings.js";
import { badges, unlockedBadges } from "./data/badges.js";
import { fetchGlobalStats, markInstalled, registerUser, syncProgress } from "./supabase.js";
import { CELEBRATION, REFLECTION_QUESTION, REREAD_MESSAGES, COMPLETION_MESSAGES, TOUR_BADGES, TOASTS } from "./data/messages.js";
import {
  loadBible,
  loadBibleForLang,
  parsePassage,
  expandPassages,
  getChapterVerses,
  formatChapterLabel,
  SINGLE_CHAPTER_BOOKS,
  NT_BOOKS_ORDER,
  BOOK_IDS,
  translateBookName,
  translatePassage,
} from "./data/bible.js";
import { FR, EN } from "./i18n.js";

// Liens & contacts
const CONTACT_EMAIL = "djochristkfreelance@gmail.com";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/I3ofVHRDGPlEEmCtzSSsxV?mode=gi_t";
const APP_URL = "https://mission31.vercel.app";

// ------------------------------------------------------------
// State management (localStorage backed)
// ------------------------------------------------------------
const STORAGE_KEY = "mission31:state:v1";

const defaultState = {
  startedAt: null,
  progress: {},
  reReads: {},
  completionCount: 0,
  reminders: { enabled: true, times: ["08:00", "20:00"], message: "N'oublie pas ta lecture du jour." },
  lastSyncedAt: null,
  memoryVerses: [],
  theme: "auto",
  readerMode: "normal",
  notes: [],
  highlights: {},
  lastReading: null,
  lang: "fr",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      reminders: { ...defaultState.reminders, ...(parsed.reminders || {}) },
      memoryVerses: Array.isArray(parsed.memoryVerses) ? parsed.memoryVerses : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      highlights: (parsed.highlights && typeof parsed.highlights === "object") ? parsed.highlights : {},
      reReads: (parsed.reReads && typeof parsed.reReads === "object") ? parsed.reReads : {},
      completionCount: typeof parsed.completionCount === "number" ? parsed.completionCount : 0,
      readerMode: ["normal", "night"].includes(parsed.readerMode) ? parsed.readerMode : "normal",
      lastReading: (parsed.lastReading && typeof parsed.lastReading === "object") ? parsed.lastReading : null,
      lang: ["fr", "en"].includes(parsed.lang) ? parsed.lang : "fr",
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let globalStats = null;
let globalStatsLoading = false;
let globalStatsLoadedAt = 0;
let globalStatsUnavailable = false;

// ------------------------------------------------------------
// i18n helper — retourne le bon dictionnaire selon la langue
// ------------------------------------------------------------
function T() { return state.lang === "en" ? EN : FR; }

// Raccourcis pour les messages de la bibliothèque
function getLang() { return state.lang === "en" ? "en" : "fr"; }
function tMsg(obj) { return obj[getLang()] || obj.fr; }
function getBadgeName(badge) { return getLang() === "en" ? (badge.nameEn || badge.name) : badge.name; }
function getBadgeDesc(badge) { return getLang() === "en" ? (badge.descEn || badge.desc) : badge.desc; }

async function refreshGlobalStats() {
  if (globalStatsLoading || Date.now() - globalStatsLoadedAt < 60000) return;
  globalStatsLoading = true;
  const stats = await fetchGlobalStats();
  globalStatsLoading = false;
  if (!stats) {
    globalStats = null;
    globalStatsUnavailable = true;
    globalStatsLoadedAt = Date.now();
    if (getRoute().name === "stats") render();
    return;
  }
  globalStats = stats;
  globalStatsUnavailable = false;
  globalStatsLoadedAt = Date.now();
  if (getRoute().name === "stats") render();
}

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function getStartDate() {
  return state.startedAt ? startOfDay(new Date(state.startedAt)) : startOfDay(new Date());
}
function dateForDay(day) {
  return addDays(getStartDate(), day - 1);
}
function formatShortDate(d) {
  return `${d.getDate()} ${T().months_short[d.getMonth()]}`;
}
function formatLongDate(d) {
  return `${d.getDate()} ${T().months_long[d.getMonth()]} ${d.getFullYear()}`;
}
function formatRange(start, end) {
  const from = T().date_from;
  const to = T().date_to;
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${from} ${start.getDate()} ${to} ${end.getDate()} ${T().months_long[start.getMonth()]}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${from} ${start.getDate()} ${T().months_short[start.getMonth()]} ${to} ${end.getDate()} ${T().months_short[end.getMonth()]}`;
  }
  return `${from} ${formatShortDate(start)} ${start.getFullYear()} ${to} ${formatShortDate(end)} ${end.getFullYear()}`;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function currentDay() {
  if (!state.startedAt) return 1;
  const startedAt = startOfDay(new Date(state.startedAt));
  const now = startOfDay(new Date());
  const diff = Math.floor((now - startedAt) / (1000 * 60 * 60 * 24));
  return Math.min(31, Math.max(1, diff + 1));
}
function getLastCompletedDay() {
  const doneDays = Object.keys(state.progress || {})
    .map((key) => Number(key))
    .filter((day) => state.progress[day]?.done);
  return doneDays.length ? Math.max(...doneDays) : 0;
}
function getActiveDay() {
  return Math.max(currentDay(), getLastCompletedDay() + 1);
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

const MINUTES_PER_CHAPTER = 4;
function estimateMinutes(passages) {
  return expandPassages(passages).length * MINUTES_PER_CHAPTER;
}
function formatReadingTime(minutes) {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h${String(m).padStart(2, "0")}` : `~${h}h`;
}
function totalMissionMinutes() {
  return readings.reduce((sum, r) => sum + estimateMinutes(r.passages), 0);
}
function remainingMissionMinutes() {
  return readings.reduce((sum, r) => {
    if (state.progress[r.day]?.done) return sum;
    return sum + estimateMinutes(r.passages);
  }, 0);
}

function validLastReading() {
  const lr = state.lastReading;
  if (!lr || typeof lr !== "object") return null;
  const day = Number(lr.day);
  const idx = Number(lr.i || 0);
  if (!day || day < 1 || day > 31) return null;
  const reading = readings.find((r) => r.day === day);
  if (!reading) return null;
  const queue = expandPassages(reading.passages);
  if (!queue.length || idx < 0 || idx >= queue.length) return null;
  const label = lr.label || formatChapterLabel(translateBookName(queue[idx].name, getLang()), queue[idx].chapter);
  return { day, i: idx, label, scrollY: Math.max(0, Number(lr.scrollY || 0)) };
}
function saveLastReading(day, idx, label, scrollY = window.scrollY || 0) {
  if (!day || day < 1 || day > 31) return;
  state.lastReading = {
    day,
    i: Math.max(0, Number(idx || 0)),
    label,
    scrollY: Math.max(0, Math.round(Number(scrollY || 0))),
    updatedAt: new Date().toISOString(),
  };
  saveState();
}

function exportUserData() {
  try {
    const payload = { app: "Mission 31", exportedAt: new Date().toISOString(), version: 1, state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mission31-sauvegarde-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(getLang() === "en" ? "Backup exported." : "Sauvegarde exportée.");
  } catch {
    showToast(getLang() === "en" ? "Export not available on this browser." : "Export impossible sur ce navigateur.");
  }
}

// ------------------------------------------------------------
// Notes helpers
// ------------------------------------------------------------
function notesForDay(day) {
  return (state.notes || []).filter((n) => n.dayRef === day);
}
function noteById(id) {
  return (state.notes || []).find((n) => n.id === id) || null;
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.setAttribute("aria-live", "polite");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function notifyBadgeUnlock(badge) {
  const lang = getLang();
  const name = getBadgeName(badge);
  showToast(lang === "en" ? `Badge unlocked: ${name}` : `Badge débloqué : ${name}`);
  if ("Notification" in window && Notification.permission === "granted") {
    const opts = {
      body: lang === "en" ? `You earned the "${name}" badge!` : `Tu as débloqué le badge « ${name} » !`,
      icon: "./icons/icon-192.png",
      tag: `mission31-badge-${badge.id}`,
    };
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification("Mission 31", opts));
    } else {
      new Notification("Mission 31", opts);
    }
  }
}

// ------------------------------------------------------------
// Son de célébration (Web Audio API)
// ------------------------------------------------------------
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    });
  } catch (_) { /* audio unavailable */ }
}

// ------------------------------------------------------------
// Modal de célébration
// ------------------------------------------------------------
function showCelebration(day, isReRead = false, reReadCount = 0, unlockedBadge = null) {
  playChime();
  const lang = getLang();

  let title, body;
  if (isReRead) {
    const idx = Math.min(reReadCount - 1, REREAD_MESSAGES.length - 1);
    const msgObj = REREAD_MESSAGES[Math.max(0, idx)];
    ({ title, body } = tMsg(msgObj));
  } else if (unlockedBadge) {
    const name = unlockedBadge.name ? (typeof unlockedBadge.name === "object" ? tMsg(unlockedBadge.name) : getBadgeName(unlockedBadge)) : "";
    title = lang === "en" ? `Well done! You earned a badge` : `Bravo ! Tu as débloqué un badge`;
    body = lang === "en"
      ? `You just earned the "${name}" badge. Share it to encourage other readers!`
      : `Tu viens de mériter le badge « ${name} ». Partage-le pour encourager d'autres lecteurs !`;
  } else {
    const msgObj = CELEBRATION.days[day] || CELEBRATION.default;
    ({ title, body } = tMsg(msgObj));
  }

  const nextDay = (!isReRead && day < 31) ? day + 1 : null;
  const nextReading = nextDay ? readings.find((r) => r.day === nextDay) : null;
  const nextPassages = nextReading ? nextReading.passages.map((p) => translatePassage(p, lang)).join(", ") : "";
  const nextLabel = nextDay ? (lang === "en" ? `Read Day ${nextDay}` : `Lire le Jour ${nextDay}`) : "";

  const overlay = document.createElement("div");
  overlay.className = "celeb-overlay";
  overlay.innerHTML = `
    <div class="celeb-box">
      <div class="celeb-stars" aria-hidden="true">
        ${Array.from({ length: 12 }, (_, i) => `<span class="celeb-star" style="--i:${i}">✦</span>`).join("")}
      </div>
      <div class="celeb-emoji">${I.checkBig}</div>
      <h2 class="celeb-title">${escapeHtml(title)}</h2>
      <p class="celeb-body">${escapeHtml(body)}</p>
      <p class="celeb-verse">${lang === "en"
        ? "Your word is a lamp to my feet and a light to my path."
        : "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier."}</p>
      ${unlockedBadge ? `
        <div class="celeb-badge-card">
          <div class="celeb-badge-icon" style="background:${escapeHtml(unlockedBadge.color || "var(--primary)")}">${badgeIcons[unlockedBadge.icon] || I.trophy}</div>
          <div class="celeb-badge-name">${escapeHtml(getBadgeName(unlockedBadge))}</div>
          <div class="celeb-badge-desc">${escapeHtml(getBadgeDesc(unlockedBadge))}</div>
        </div>
      ` : ""}
      <div class="celeb-divider"></div>
      <p class="celeb-question">${escapeHtml(tMsg(REFLECTION_QUESTION))}</p>
      <div class="celeb-actions">
        <button class="btn celeb-btn--notes" data-celeb-action="notes" data-celeb-day="${day}">
          ✏️ ${lang === "en" ? "Take a note" : "Prendre une note"}
        </button>
        ${unlockedBadge ? `
        <button class="btn celeb-btn--share" data-celeb-action="share-badge" data-badge-id="${escapeHtml(unlockedBadge.id)}">
          ${I.share} ${lang === "en" ? "Share the badge" : "Partager le badge"}
        </button>
        ` : ""}
        ${nextDay ? `
        <button class="btn celeb-btn--next" data-celeb-action="next" data-celeb-day="${nextDay}">
          ${nextLabel} <span style="font-size:12px;opacity:.7;">${escapeHtml(nextPassages)}</span>
        </button>` : ""}
        <button class="btn btn--ghost celeb-btn--continue" data-celeb-action="continue">
          ${lang === "en" ? "Back to home" : "Retour à l'accueil"}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("celeb-overlay--visible"));

  function dismiss() {
    overlay.classList.remove("celeb-overlay--visible");
    setTimeout(() => { overlay.remove(); render(); navigate("home"); }, 350);
  }

  overlay.querySelector("[data-celeb-action='continue']").addEventListener("click", dismiss);
  overlay.querySelector("[data-celeb-action='notes']").addEventListener("click", () => {
    overlay.remove();
    render();
    navigate("home");
    setTimeout(() => showNoteModal(day, ""), 100);
  });

  const shareBtn = overlay.querySelector("[data-celeb-action='share-badge']");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const badgeId = shareBtn.dataset.badgeId;
      const badge = badges.find((b) => b.id === badgeId);
      if (badge) {
        const name = getBadgeName(badge);
        await shareWithImage({ text: getLang() === "en" ? `I earned the "${name}" badge in Mission 31!` : `J'ai débloqué le badge « ${name} » dans Mission 31 !` });
      }
    });
  }

  const nextBtn = overlay.querySelector("[data-celeb-action='next']");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const nd = parseInt(nextBtn.dataset.celebDay, 10);
      overlay.classList.remove("celeb-overlay--visible");
      setTimeout(() => {
        overlay.remove();
        navigate(`bible?day=${nd}&i=0`);
      }, 250);
    });
  }
}

// ------------------------------------------------------------
// Marquer un jour comme relu
// ------------------------------------------------------------
function markReRead(day) {
  state.reReads[day] = (state.reReads[day] || 0) + 1;
  saveState();
  const count = state.reReads[day];
  showCelebration(day, true, count);
}

// ------------------------------------------------------------
// Détection plateforme
// ------------------------------------------------------------
function isAppInstalled() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}
function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "") && !window.MSStream;
}
function isAndroid() {
  return /Android/i.test(navigator.userAgent || "");
}

function markRead(daysCount = 1) {
  const previousBadges = unlockedBadges(state);
  const today = currentDay();
  for (let i = 0; i < daysCount; i++) {
    const d = today + i;
    if (d > 31) break;
    state.progress[d] = { done: true, doneAt: new Date().toISOString(), batchSize: daysCount };
  }
  if (!state.startedAt) state.startedAt = new Date().toISOString();
  state.lastSyncedAt = new Date().toISOString();
  saveState();
  syncProgress(completedCount());

  const currentBadgesSet = unlockedBadges(state);
  [...currentBadgesSet].forEach((id) => {
    if (!previousBadges.has(id)) {
      const badge = badges.find((b) => b.id === id);
      if (badge) notifyBadgeUnlock(badge);
    }
  });

  if (completedCount() >= 31) {
    state.completionCount = (state.completionCount || 0) + 1;
    saveState();
    setTimeout(() => navigate("completion"), 400);
  } else if (daysCount > 1) {
    showToast(getLang() === "en" ? `${daysCount} days validated!` : `${daysCount} jours validés !`);
  } else {
    showCelebration(today, false);
  }
}

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------
const routes = [
  "welcome", "home", "reading", "accelerated", "planning", "stats", "rewards",
  "share", "help", "offline", "reminders", "completion",
  "bible", "memory", "settings", "notes", "how",
];

function getRoute() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  const [name, qs] = h.split("?");
  const cleanName = name || "";
  const params = {};
  if (qs) {
    for (const pair of qs.split("&")) {
      const [k, v] = pair.split("=");
      if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v.replace(/\+/g, " ")) : "";
    }
  }
  if (!cleanName) return { name: state.startedAt ? "home" : "welcome", params };
  return { name: routes.includes(cleanName) ? cleanName : "home", params };
}

function navigate(r) {
  location.hash = `#/${r}`;
}

window.addEventListener("hashchange", render);
window.addEventListener("online", render);
window.addEventListener("offline", render);

let bibleScrollSaveTimer = null;
window.addEventListener("scroll", () => {
  const route = getRoute();
  if (route.name !== "bible") return;
  const day = parseInt(route.params.day, 10) || currentDay();
  const idx = Math.max(0, parseInt(route.params.i, 10) || 0);
  const title = document.querySelector(".bible-reader__title")?.textContent || state.lastReading?.label || "Lecture";
  clearTimeout(bibleScrollSaveTimer);
  bibleScrollSaveTimer = setTimeout(() => saveLastReading(day, idx, title, window.scrollY || 0), 250);
}, { passive: true });

// ------------------------------------------------------------
// Icons (inline SVG)
// ------------------------------------------------------------
const I = {
  bible: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`,
  bibleSmall: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="14"/><line x1="9" y1="10" x2="15" y2="10"/></svg>`,
  menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>`,
  bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  cal: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  checkBig: `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  flame: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7a00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  tabHome: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>`,
  tabPlan: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  tabStats: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>`,
  tabRewards: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>`,
  tabHelp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  question: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  reading: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  bellSmall: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>`,
  whatsapp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.667 5.467l-.999 3.648 3.821-1.814zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>`,
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
  bookOpen: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  bookmark: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  moon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  arrowRight: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  arrowLeft: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  clockMed: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  pen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  penMed: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  fileText: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  highlighter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l-6 6v3h3l6-6"/><path d="M22 4l-3.5-3.5a2 2 0 0 0-2.83 0l-9 9a2 2 0 0 0 0 2.83l1.5 1.5a2 2 0 0 0 2.83 0l9-9a2 2 0 0 0 0-2.83z"/></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
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
    { id: "home",     icon: I.tabHome,    label: T().tab_home },
    { id: "planning", icon: I.tabPlan,    label: T().tab_planning },
    { id: "rewards",  icon: I.trophy,     label: T().tab_rewards },
    { id: "stats",    icon: I.tabStats,   label: T().tab_stats },
    { id: "help",     icon: I.tabHelp,    label: T().tab_help },
  ];
  return `
    <nav class="tabbar"><div class="tabbar__inner">
      ${tabs.map((t) => `
        <button class="tab" data-nav="${t.id}" ${active === t.id ? 'aria-current="page"' : ""}>
          ${t.icon}<span>${t.label}</span>
        </button>`).join("")}
    </div></nav>`;
}

// Sélecteur de langue
function langSwitcher(variant = "compact") {
  const lang = getLang();
  const isSettings = variant === "settings";
  return `
    <div class="lang-switcher ${isSettings ? "lang-switcher--settings" : ""}">
      ${isSettings ? "" : `<span class="lang-switcher__label">${T().welcome_lang_label}</span>`}
      <div class="lang-switcher__actions ${isSettings ? "lang-switcher__actions--settings" : ""}" role="group" aria-label="${T().welcome_lang_label}">
        <button type="button" class="lang-chip ${isSettings ? "lang-chip--settings" : ""} ${lang === "fr" ? "lang-chip--active" : ""}" data-action="lang-set" data-lang="fr" aria-pressed="${lang === "fr" ? "true" : "false"}">
          <span class="lang-chip__flag" aria-hidden="true">🇫🇷</span>
          <span class="lang-chip__text">FR</span>
        </button>
        <button type="button" class="lang-chip ${isSettings ? "lang-chip--settings" : ""} ${lang === "en" ? "lang-chip--active" : ""}" data-action="lang-set" data-lang="en" aria-pressed="${lang === "en" ? "true" : "false"}">
          <span class="lang-chip__flag" aria-hidden="true">🇬🇧</span>
          <span class="lang-chip__text">EN</span>
        </button>
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Views
// ------------------------------------------------------------
function viewWelcome() {
  return `
    <div class="shell shell--dark">
      <div class="splash">
        <div class="splash__hero">
          <div class="splash__icon-wrap">
            <img class="splash__app-icon" src="${appIconUrl}" alt="Mission 31" />
          </div>
          <h1 class="splash__title">Mission <span>31</span></h1>
          <p class="splash__subtitle">${T().welcome_subtitle}</p>
        </div>
        <div class="splash__cta">
          <button class="btn" data-action="start">${T().welcome_start}</button>
          <div class="splash__footer">
            ${langSwitcher()}
          </div>
          <p class="splash__verse">
            ${T().welcome_verse}
            <small>${T().welcome_verse_ref}</small>
          </p>
        </div>
      </div>
    </div>`;
}

function viewHome() {
  const lang = getLang();
  const activeDay = getActiveDay();
  const day = activeDay;
  const communityCta = lang !== "en"
    ? `<a class="group-cta" href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer">${I.whatsapp}<span class="group-cta__text">${T().home_community} <em>Mission 31</em></span><span class="group-cta__arrow">→</span></a>`
    : "";
  const today = readings.find((r) => r.day === day);
  const passages = today ? today.passages.map((p) => translatePassage(p, lang)).join(", ") : "...";
  const pct = progressPct();
  const completed = completedCount();
  const isTodayDone = state.progress[day]?.done;
  const memVerse = todaysMemoryVerse();
  const todayMinutes = today ? estimateMinutes(today.passages) : 0;
  const dayNotes = notesForDay(day);
  const dayStatus = day === currentDay() ? T().home_status_today : T().home_status_avail;
  const resume = validLastReading();
  const mainCta = resume ? T().home_cta_continue : isTodayDone ? T().home_cta_reread : T().home_cta_read;

  return `
    <div class="shell">
      ${topbar({
        title: T().home_title,
        leftAction: `<button class="topbar__btn" data-action="menu">${I.menu}</button>`,
        rightActions: [`<button class="topbar__btn" data-nav="reminders">${I.bell}</button>`],
      })}
      <main class="view">
        <div class="home">
          <div class="card day-card">
            <div class="day-card__label">${lang === "en" ? "Day" : "Jour"} <strong style="color:var(--primary);font-size:24px;font-weight:700;">${day}</strong> / 31 · ${escapeHtml(passages)}</div>
            <div class="day-card__sub" style="margin-top:14px;">${dayStatus}</div>
            <div class="day-card__passages">${resume ? T().home_resume_at(escapeHtml(resume.label)) : escapeHtml(passages)}</div>
            <div class="day-card__meta">
              <span class="reading-time-badge">${I.clock} ${formatReadingTime(todayMinutes)}</span>
              ${dayNotes.length > 0 ? `<span class="notes-badge" data-nav="notes?day=${day}">${I.pen} ${dayNotes.length} note${dayNotes.length > 1 ? "s" : ""}</span>` : ""}
            </div>
            <div class="day-card__actions">
              ${(() => {
                if (isTodayDone && day < 31) {
                  const nextDay = day + 1;
                  const nextReading = readings.find((r) => r.day === nextDay);
                  const nextPassages = nextReading ? nextReading.passages.map((p) => translatePassage(p, lang)).join(", ") : "";
                  const nextMin = nextReading ? estimateMinutes(nextReading.passages) : 0;
                  const nextDone = state.progress[nextDay]?.done;
                  return `
                    <div class="next-day-inline ${nextDone ? "next-day-inline--done" : ""}">
                      <div class="next-day-inline__label">${lang === "en" ? "Day" : "Jour"} ${nextDay} ${nextDone ? "✓" : "· " + T().home_next_sub}</div>
                      <div class="next-day-inline__passages">${escapeHtml(nextPassages)}</div>
                      <div class="next-day-inline__meta">${I.clock} ${formatReadingTime(nextMin)}</div>
                      ${nextDone
                        ? `<span class="next-day-inline__done-label">${T().home_next_done}</span>`
                        : `<button class="btn btn--sm" data-nav="bible?day=${nextDay}&i=0">${I.bookOpen} ${T().home_next_start}</button>`}
                    </div>
                    <button class="btn btn--ghost" data-nav="bible?day=${day}&i=0">${I.bookOpen} ${T().home_reread}</button>`;
                }
                return `<button class="btn" data-nav="${resume ? `bible?day=${resume.day}&i=${resume.i}&resume=1` : `bible?day=${day}&i=0`}">${I.bookOpen} ${mainCta}</button>`;
              })()}
              <button class="btn btn--ghost" data-nav="reading">${T().home_detail}</button>
            </div>
          </div>

          ${!isAppInstalled() ? `
            <div class="install-card" data-action="install">
              <div class="install-card__icon">${I.install}</div>
              <div class="install-card__body">
                <div class="install-card__title">${T().home_install_title}</div>
                <div class="install-card__sub">${T().home_install_sub}</div>
              </div>
            </div>
          ` : ""}

          ${memVerse ? `
            <div class="card memory-today">
              <div class="memory-today__head">
                ${I.bookmark}
                <span class="memory-today__label">${T().home_mem_label}</span>
              </div>
              <div class="memory-today__ref">${escapeHtml(memVerse.ref)}</div>
              <div class="memory-today__text">« ${escapeHtml(memVerse.text)} »</div>
            </div>
          ` : ""}

          <div class="card progress-card">
            <div class="progress-card__head">
              <span class="progress-card__title">${T().home_progress_title}</span>
              <span class="progress-card__pct">${pct}%</span>
            </div>
            <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
            <div class="progress-card__count">${T().home_progress_days(completed)}</div>
          </div>

          <div class="card streak-card">
            <span class="streak-card__label">${T().home_streak_label} ${I.flame}</span>
            <span class="streak-card__value">${T().home_streak_days(streakCount())}</span>
          </div>

          <div class="card streak-card" style="cursor:pointer" data-nav="rewards">
            <span class="streak-card__label">${T().home_badges_label} ${I.trophy}</span>
            <span class="streak-card__value" style="font-size:14px;color:var(--primary);">${T().home_badges_value(unlockedBadges(state).size)}</span>
          </div>

          ${communityCta}
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewReading() {
  const lang = getLang();
  const day = currentDay();
  const today = readings.find((r) => r.day === day);
  const passages = today ? today.passages : [];
  const isDone = state.progress[day]?.done;
  const dateLabel = formatLongDate(dateForDay(day));
  const chapters = expandPassages(passages);
  const totalMin = estimateMinutes(passages);
  const dayNotes = notesForDay(day);

  return `
    <div class="shell">
      ${topbar({
        title: `${lang === "en" ? "Day" : "Jour"} ${day}`,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
        rightActions: [`<button class="topbar__btn" data-nav="notes?day=${day}">${I.pen}</button>`],
      })}
      <main class="view">
        <div class="reading">
          <div class="reading__hero">
            <div class="reading__day-label">${dateLabel}</div>
            <div class="reading__day-title">${T().date_day_slash(day)}</div>
            <div class="reading__passage">${passages.map((p) => translatePassage(p, lang)).join(", ")}</div>
            <div class="reading__time-row">
              ${I.clock} <span>${formatReadingTime(totalMin)}</span>
              <span class="reading__time-sep">·</span>
              <span>${T().reading_chapters(chapters.length)}</span>
            </div>
          </div>

          <div class="reading__list">
            <h3 class="reading__list-title">${T().reading_list_title}</h3>
            <div class="reading__chapters">
              ${chapters.map((c, i) => {
                const displayName = translateBookName(c.name, lang);
                const label = formatChapterLabel(displayName, c.chapter);
                return `
                <button class="reading__chapter" data-nav="bible?day=${day}&i=${i}">
                  <span class="reading__chapter-name">${label}</span>
                  <span style="display:flex;align-items:center;gap:6px;">
                    <span class="reading__chapter-time">${I.clock} ${MINUTES_PER_CHAPTER} min</span>
                    <span class="reading__chapter-go">${I.bookOpen}</span>
                  </span>
                </button>`;
              }).join("")}
            </div>
          </div>

          ${dayNotes.length > 0 ? `
            <div class="card notes-preview">
              <div class="notes-preview__head">
                ${I.pen} <span class="notes-preview__title">${T().reading_notes_head}</span>
                <button class="notes-preview__all" data-nav="notes?day=${day}">${T().reading_notes_all}</button>
              </div>
              ${dayNotes.slice(0, 2).map((n) => `
                <div class="notes-preview__item">
                  ${n.chapterRef ? `<span class="notes-preview__ref">${escapeHtml(n.chapterRef)}</span>` : ""}
                  <p class="notes-preview__text">${escapeHtml(n.content).slice(0, 80)}${n.content.length > 80 ? "…" : ""}</p>
                </div>
              `).join("")}
            </div>
          ` : ""}

          <div class="card">
            <p class="reading__verse">
              ${T().reading_verse}
              <small>${T().reading_verse_ref}</small>
            </p>
          </div>

          ${!isDone
            ? `<button class="btn" data-action="mark-today">${I.checkBig.replace("42", "20").replace("42", "20")} ${T().reading_done}</button>`
            : `<button class="btn btn--ghost" data-action="unmark-today">${T().reading_undone}</button>`
          }
          <button class="btn btn--ghost" data-nav="share">${T().reading_share}</button>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewAccelerated() {
  const lang = getLang();
  const day = currentDay();
  const remaining = 31 - completedCount();
  const options = T().acc_options;
  const selected = window.__accSelection || 1;

  return `
    <div class="shell">
      ${topbar({
        title: T().acc_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="accelerated">
          <p class="accelerated__intro">${T().acc_intro}</p>
          <p class="accelerated__day">${T().acc_day_info(day, remaining)}</p>

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
            <span>${T().acc_callout(selected)}</span>
          </div>

          <button class="btn" data-action="confirm-acc">${T().acc_confirm(selected)}</button>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewPlanning() {
  const lang = getLang();
  const today = currentDay();
  const start = getStartDate();
  const end = addDays(start, 30);
  const headerLabel = formatRange(start, end);
  return `
    <div class="shell">
      ${topbar({
        title: T().planning_title,
        leftAction: `<span style="margin-left:4px;">${I.cal}</span>`,
        rightActions: [`<button class="topbar__btn" data-nav="reminders">${I.bell}</button>`],
      })}
      <main class="view">
        <p class="planning__sub">${T().planning_sub(headerLabel)}</p>
        <div class="planning-list">
          ${readings.map((r) => {
            const done = state.progress[r.day]?.done;
            const isToday = r.day === today;
            const cls = done ? "plan-row--done" : isToday ? "plan-row--today" : "";
            const dateLabel = formatShortDate(dateForDay(r.day));
            const mins = estimateMinutes(r.passages);
            const chapCount = expandPassages(r.passages).length;
            const dayNoteCount = notesForDay(r.day).length;
            const passagesLabel = r.passages.map((p) => translatePassage(p, lang)).join(", ");
            return `
              <button class="plan-row ${cls}" data-day="${r.day}">
                <span class="plan-row__check">${done ? I.check : isToday ? `<span style="font-size:11px;font-weight:700;color:var(--primary);">${r.day}</span>` : `<span style="font-size:11px;font-weight:600;color:var(--ink-faint);">${r.day}</span>`}</span>
                <span class="plan-row__body">
                  <div class="plan-row__title">${passagesLabel}</div>
                  <div class="plan-row__sub">${I.clock} ${formatReadingTime(mins)} · ${chapCount} ch.${dayNoteCount > 0 ? ` · ${I.pen} ${dayNoteCount}` : ""}</div>
                </span>
                <span class="plan-row__date">${isToday ? T().planning_today : dateLabel}</span>
              </button>`;
          }).join("")}
        </div>
      </main>
      ${tabbar("planning")}
    </div>`;
}

function viewStats() {
  const lang = getLang();
  const pct = progressPct();
  const C = 2 * Math.PI * 60;
  const offset = C - (pct / 100) * C;
  const hasGlobalVisitors = Number.isFinite(Number(globalStats?.total_users));
  const hasInstalledUsers = Number.isFinite(Number(globalStats?.installed_users));
  const visitorCount = hasGlobalVisitors ? Number(globalStats.total_users) : null;
  const installedUsers = hasInstalledUsers ? Number(globalStats.installed_users) : null;
  const unavailableLabel = T().stats_unavail;
  const loadingLabel = T().stats_loading;
  const localeStr = lang === "en" ? "en-US" : "fr-FR";
  const globalVisitorsLabel = hasGlobalVisitors
    ? visitorCount.toLocaleString(localeStr)
    : globalStatsUnavailable ? unavailableLabel : loadingLabel;
  const installedUsersLabel = hasInstalledUsers
    ? installedUsers.toLocaleString(localeStr)
    : globalStatsUnavailable ? unavailableLabel : loadingLabel;
  const globalVisitorsValueClass = hasGlobalVisitors ? "" : " visitor-counter__value--muted";
  const installedUsersValueClass = hasInstalledUsers ? "" : " visitor-counter__value--muted";
  const globalCaption = globalStatsUnavailable
    ? ""
    : T().stats_visitors_caption;
  const lastResume = validLastReading();
  const noResume = lang === "en" ? "None" : "Aucune";
  const remaining31 = 31 - completedCount();

  return `
    <div class="shell">
      ${topbar({ title: T().stats_title })}
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
                <div class="donut__label">${lang === "en" ? "Progress" : "Progression"}</div>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-tile__label">${lang === "en" ? "Days completed" : "Jours complétés"}</div>
              <div class="stat-tile__value">${completedCount()} / 31</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${lang === "en" ? "Current streak" : "Streak actuel"} ${I.flame}</div>
              <div class="stat-tile__value">${streakCount()} ${lang === "en" ? "days" : "jours"}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${lang === "en" ? "Longest streak" : "Plus longue série"}</div>
              <div class="stat-tile__value">${longestStreak()} ${lang === "en" ? "days" : "jours"}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${lang === "en" ? "Days ahead" : "Jours gagnés"}</div>
              <div class="stat-tile__value">${daysGained()} ${lang === "en" ? "days" : "jours"}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-tile__label">${I.clock} ${lang === "en" ? "Estimated total time" : "Temps total estimé"}</div>
              <div class="stat-tile__value">${formatReadingTime(totalMissionMinutes())}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${I.clock} ${lang === "en" ? "Estimated remaining" : "Temps restant estimé"}</div>
              <div class="stat-tile__value">${formatReadingTime(remainingMissionMinutes())}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-tile__label">${I.pen} ${lang === "en" ? "My notes" : "Mes notes"}</div>
              <div class="stat-tile__value stat-tile__value--link" data-nav="notes">${(state.notes || []).length}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${I.bookOpen} ${lang === "en" ? "Resume" : "Reprise"}</div>
              <div class="stat-tile__value stat-tile__value--small">${lastResume ? escapeHtml(lastResume.label) : noResume}</div>
            </div>
          </div>

          <div class="visitor-counter" aria-live="polite">
            <div class="visitor-counter__icon">${I.users}</div>
            <div class="visitor-counter__body">
              <div class="visitor-counter__grid">
                <div>
                  <div class="visitor-counter__label">${T().stats_visitors_title}</div>
                  <div class="visitor-counter__value${globalVisitorsValueClass}">${globalVisitorsLabel}</div>
                </div>
                <div>
                  <div class="visitor-counter__label">${T().stats_installed_title}</div>
                  <div class="visitor-counter__value${installedUsersValueClass}">${installedUsersLabel}</div>
                </div>
              </div>
              ${globalCaption ? `<div class="visitor-counter__caption">${globalCaption}</div>` : ""}
            </div>
          </div>

          <p class="encourage">${lang === "en"
            ? `${remaining31} day${remaining31 !== 1 ? "s" : ""} left to complete the mission.<br/>Keep going, you're almost there!`
            : `Il te reste ${remaining31} jour${remaining31 !== 1 ? "s" : ""} pour finir la mission.<br/>Continue, tu y es presque !`}</p>

          <div class="stats-actions">
            <button class="btn btn--danger" data-action="reset">
              ${lang === "en" ? "Reset the mission" : "Réinitialiser la mission"}
            </button>
          </div>
        </div>
      </main>
      ${tabbar("stats")}
    </div>`;
}

function viewRewards() {
  const lang = getLang();
  const unlocked = unlockedBadges(state);
  const completedB = badges.filter((b) => b.category === "completed");

  function renderBadge(b) {
    const isUnlocked = unlocked.has(b.id);
    const iconStyle = isUnlocked && b.color ? `style="background:${escapeHtml(b.color)}"` : "";
    const name = getBadgeName(b);
    const desc = getBadgeDesc(b);
    return `
      <div class="badge ${isUnlocked ? "" : "badge--locked"}">
        <div class="badge__icon" ${iconStyle}>${badgeIcons[b.icon] || I.trophy}</div>
        <div class="badge__name">${name}</div>
        <div class="badge__desc">${desc}</div>
      </div>`;
  }

  const completionCount = state.completionCount || 0;

  return `
    <div class="shell">
      ${topbar({ title: T().rewards_title })}
      <main class="view">
        <div class="rewards">
          <h3 class="rewards__section-title">${lang === "en" ? "Progress badges" : "Badges de progression"}</h3>
          <div class="badge-grid">${completedB.map(renderBadge).join("")}</div>

          <h3 class="rewards__section-title">${lang === "en" ? "Loyalty badges (rounds)" : "Badges de fidélité (tours)"}</h3>
          <div class="badge-grid">
            ${TOUR_BADGES.map((b) => {
              const isUnlocked = completionCount >= b.required;
              const bName = tMsg(b.name);
              const bDesc = tMsg(b.desc);
              return `
                <div class="badge ${isUnlocked ? "" : "badge--locked"}">
                  <div class="badge__icon">${b.icon}</div>
                  <div class="badge__name">${escapeHtml(bName)}</div>
                  <div class="badge__desc">${escapeHtml(bDesc)}</div>
                </div>`;
            }).join("")}
          </div>

          ${completionCount > 0 ? `
            <div class="card" style="margin-top:16px;text-align:center;padding:14px;">
              <div style="display:flex;justify-content:center;margin-bottom:6px;color:var(--primary);">${TOUR_BADGES[0].icon}</div>
              <div style="font-weight:700;color:var(--primary);">${completionCount} ${lang === "en"
                ? `round${completionCount > 1 ? "s" : ""} complete`
                : `tour${completionCount > 1 ? "s" : ""} accompli${completionCount > 1 ? "s" : ""}`}</div>
              <div style="font-size:13px;color:var(--ink-faint);margin-top:4px;">${lang === "en" ? "You keep diving deeper into the Word." : "Tu continues à creuser la Parole."}</div>
            </div>
          ` : ""}
        </div>
      </main>
      ${tabbar("rewards")}
    </div>`;
}

function viewShare() {
  const lang = getLang();
  const day = currentDay();
  const reading = readings.find((r) => r.day === getActiveDay());
  const passagesRaw = reading ? reading.passages.map((p) => translatePassage(p, lang)).join(", ") : (lang === "en" ? "New Testament" : "Nouveau Testament");
  return `
    <div class="shell">
      ${topbar({
        title: T().share_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="share">
          <div class="share-card" id="shareCard">
            <div class="share-card__icon">${I.bible}</div>
            <h2 class="share-card__title">MISSION 31</h2>
            <div class="share-card__day">${T().share_day_label(day)}</div>
            <p class="share-card__msg">${T().share_card_msg(escapeHtml(passagesRaw))}</p>
            <p class="share-card__link">${APP_URL}</p>
            <span class="share-card__tag">#Mission31</span>
          </div>

          <div class="share-actions">
            ${getLang() !== "en" ? `<button class="btn btn--whatsapp" data-action="share-whatsapp">${I.whatsapp} ${T().share_whatsapp}</button>` : ""}
            <button class="btn btn--ghost" data-action="share-native">${T().share_native}</button>
          </div>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewHelp() {
  const lang = getLang();
  const installed = isAppInstalled();
  const items = [
    { icon: I.bookmark,  title: T().help_memory_title, sub: T().help_memory_sub, nav: "memory", accent: true },
    { icon: I.settings,  title: T().help_settings_title, sub: T().help_settings_sub, nav: "settings" },
    { icon: I.question,  title: T().help_how_title, sub: T().help_how_sub, nav: "how" },
    { icon: I.bellSmall, title: T().help_notif_title, nav: "reminders" },
    !installed && {
      icon: I.install,
      title: T().help_install_title,
      sub: T().help_install_sub,
      action: "install",
      accent: true,
    },
    installed && {
      icon: I.checkBig.replace('width="42"', 'width="20"').replace('height="42"', 'height="20"'),
      title: T().help_installed_title,
      sub: T().help_installed_sub,
    },
  ].filter(Boolean);
  return `
    <div class="shell">
      ${topbar({ title: T().help_title })}
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
        title: T().offline_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view view--no-tabs">
        <div class="offline">
          <div class="offline__icon">${I.wifiOff}</div>
          <h2 class="offline__title">${T().offline_heading}</h2>
          <p class="offline__msg">${T().offline_msg}</p>
          <button class="btn" data-action="back">${T().offline_btn}</button>
        </div>
      </main>
    </div>`;
}

function viewReminders() {
  const r = state.reminders;
  const notifSupported = "Notification" in window;
  const notifPerm = notifSupported ? Notification.permission : "unsupported";

  let permBanner = "";
  if (!notifSupported) {
    permBanner = `<div class="notif-banner notif-banner--warn">${I.bell} ${T().rem_notif_unsupported}</div>`;
  } else if (notifPerm === "denied") {
    permBanner = `<div class="notif-banner notif-banner--err">${I.bell} ${T().rem_notif_denied}</div>`;
  } else if (notifPerm === "default") {
    permBanner = `<div class="notif-banner notif-banner--info">${I.bell} <span>${T().rem_notif_default_msg}</span> <button class="btn btn--sm" data-action="notif-request">${T().rem_notif_grant_btn}</button></div>`;
  } else {
    permBanner = `<div class="notif-banner notif-banner--ok">${I.bell} ${T().rem_notif_ok} <button class="btn btn--sm btn--ghost" data-action="notif-test">${T().rem_notif_test_btn}</button></div>`;
  }

  return `
    <div class="shell">
      ${topbar({
        title: T().rem_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="reminders">
          ${permBanner}
          <div class="row-toggle">
            <span class="row-toggle__title">${T().rem_toggle}</span>
            <button class="switch ${r.enabled ? "switch--on" : ""}" data-action="toggle-rem"></button>
          </div>

          <div class="times-card">
            <h3 class="times-card__title">${T().rem_times_title}</h3>
            <p class="times-card__sub">${T().rem_times_sub}</p>
            <div class="times-list">
              ${r.times.map((t, i) => `
                <span class="time-chip">${t}<button data-action="rem-del" data-i="${i}">${I.close}</button></span>
              `).join("")}
            </div>
            ${r.times.length < 4 ? `
              <div class="time-input-row">
                <input type="time" id="newTime" value="12:00"/>
                <button class="btn btn--ghost add-time" data-action="rem-add">${I.plus} ${T().rem_add_btn}</button>
              </div>` : ""}
          </div>

          <div class="field">
            <label>${T().rem_msg_label}</label>
            <textarea id="remMsg" placeholder="${T().rem_msg_placeholder}">${r.message}</textarea>
          </div>

          <button class="btn" data-action="rem-save">${T().rem_save_btn}</button>
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function viewCompletion() {
  const lang = getLang();
  const count = state.completionCount || 1;
  const isFirst = count === 1;
  const msgObjRaw = isFirst ? COMPLETION_MESSAGES.first : COMPLETION_MESSAGES.repeat(count);
  const msg = tMsg(msgObjRaw);
  const { title, body, cta } = typeof msg === "object" ? msg : { title: T().completion_title, body: msg, cta: lang === "en" ? "New round" : "Nouvelle lancée" };

  const earnedTourBadges = TOUR_BADGES.filter((b) => count >= b.required);

  return `
    <div class="shell">
      ${topbar({
        title: T().completion_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view view--no-tabs">
        <div class="completion">
          <div class="completion__stars" aria-hidden="true">
            ${Array.from({ length: 10 }, (_, i) => `<span class="celeb-star celeb-star--static" style="--i:${i}">✦</span>`).join("")}
          </div>
          <div class="completion__emoji">🏆</div>
          <h2 class="completion__title">${escapeHtml(title)}</h2>
          <p class="completion__msg">${escapeHtml(body)}</p>

          <div class="completion__stats">
            <div class="stat-tile">
              <div class="stat-tile__label">${T().completion_days_done}</div>
              <div class="stat-tile__value">${completedCount()} / 31</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${T().completion_tours}</div>
              <div class="stat-tile__value">${count}</div>
            </div>
          </div>

          ${earnedTourBadges.length > 0 ? `
            <div class="completion__tour-badges">
              <h3 class="completion__tour-badges-title">${T().completion_tour_badges}</h3>
              <div class="tour-badge-row">
                ${earnedTourBadges.map((b) => `
                  <div class="tour-badge">
                    <span class="tour-badge__icon">${b.icon}</span>
                    <span class="tour-badge__name">${escapeHtml(tMsg(b.name))}</span>
                    <span class="tour-badge__desc">${escapeHtml(tMsg(b.desc))}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ""}

          <button class="btn" data-action="new-run">${cta}</button>
          <button class="btn btn--ghost" style="margin-top:10px;" data-nav="home">${T().completion_home_btn}</button>
        </div>
      </main>
    </div>`;
}

// ============================================================
// Bible reader
// ============================================================
function bibleQueueFromParams(params) {
  if (params.b && params.c) {
    const id = parseInt(params.b, 10);
    const chapter = parseInt(params.c, 10);
    const name = NT_BOOKS_ORDER.find((n) => BOOK_IDS[n] === id);
    if (name && chapter >= 1) return [{ id, name, chapter }];
  }
  const day = parseInt(params.day, 10) || currentDay();
  const reading = readings.find((r) => r.day === day);
  if (!reading) return [];
  return expandPassages(reading.passages);
}

function viewBible(params) {
  const lang = getLang();
  const queue = bibleQueueFromParams(params);
  const idx = Math.max(0, Math.min(queue.length - 1, parseInt(params.i, 10) || 0));
  const day = parseInt(params.day, 10) || currentDay();
  const isFreeRead = !!(params.b && params.c);
  const night = state.readerMode === "night";

  const current = queue[idx];
  const displayName = current ? translateBookName(current.name, lang) : "";
  const title = current ? formatChapterLabel(displayName, current.chapter) : (lang === "en" ? "Reading" : "Lecture");
  const chapterRef = current ? formatChapterLabel(displayName, current.chapter) : "";

  return `
    <div class="shell">
      ${topbar({
        title: title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
        rightActions: [
          `<button class="topbar__btn" data-action="reader-mode-toggle" title="${night ? T().bible_mode_normal : T().bible_mode_night}">${night ? I.sun : I.moon}</button>`,
          `<button class="topbar__btn" data-action="open-note-modal" data-day="${day}" data-chapter="${escapeHtml(chapterRef)}" title="${T().bible_note_title}">${I.pen}</button>`,
        ],
      })}
      <main class="view view--bible ${night ? "view--reader-night" : ""}">
        <div class="bible-hint">${I.highlighter} ${T().bible_hint}</div>
        <div class="bible-reader" id="bibleReader">
          <div class="bible-reader__loading">${I.bookOpen} ${T().bible_loading}</div>
        </div>

        ${queue.length > 1 ? `
          <div class="bible-nav">
            <button class="bible-nav__btn" ${idx === 0 ? "disabled" : ""} data-bible-nav="prev" data-day="${day}" data-i="${idx - 1}">
              ${I.arrowLeft} <span>${T().bible_prev}</span>
            </button>
            <span class="bible-nav__pos">${idx + 1} / ${queue.length}</span>
            <button class="bible-nav__btn" ${idx >= queue.length - 1 ? "disabled" : ""} data-bible-nav="next" data-day="${day}" data-i="${idx + 1}">
              <span>${T().bible_next}</span> ${I.arrowRight}
            </button>
          </div>
        ` : ""}

        ${!isFreeRead && idx >= queue.length - 1 && queue.length > 0 ? `
          <div class="bible-finish">
            ${state.progress[day]?.done ? `
              <button class="btn btn--reread" data-action="mark-reread-from-bible" data-day="${day}">${T().bible_reread}</button>
              ${day < 31 ? `<button class="btn" data-nav="bible?day=${day + 1}&i=0">${T().bible_next_day(day + 1)}</button>` : ""}
            ` : `
              <button class="btn" data-action="mark-today-from-bible" data-day="${day}">${T().bible_done}</button>
            `}
          </div>
        ` : ""}
      </main>
      ${tabbar("home")}
    </div>`;
}

function renderBibleContent(params) {
  const lang = getLang();
  const container = document.getElementById("bibleReader");
  if (!container) return;
  const queue = bibleQueueFromParams(params);
  if (queue.length === 0) {
    container.innerHTML = `<p class="bible-reader__empty">${T().bible_empty}</p>`;
    return;
  }
  const idx = Math.max(0, Math.min(queue.length - 1, parseInt(params.i, 10) || 0));
  const item = queue[idx];
  const verseDay = parseInt(params.day, 10) || currentDay();
  const shouldResume = params.resume === "1";
  const displayName = translateBookName(item.name, lang);
  const chapterLabel = formatChapterLabel(displayName, item.chapter);

  loadBibleForLang(lang).then((bible) => {
    const verses = getChapterVerses(bible, item.id, item.chapter);
    if (!verses || verses.length === 0) {
      container.innerHTML = `<p class="bible-reader__empty">${T().bible_not_found(chapterLabel)}</p>`;
      return;
    }
    const heading = chapterLabel;
    const highlights = state.highlights || {};
    saveLastReading(verseDay, idx, chapterLabel, shouldResume && state.lastReading?.day === verseDay && Number(state.lastReading?.i || 0) === idx ? state.lastReading.scrollY : 0);
    container.innerHTML = `
      <h1 class="bible-reader__title">${heading}</h1>
      <p class="bible-reader__sub">${T().bible_attribution}</p>
      <div class="bible-reader__text">
        ${verses.map((v, i) => {
          if (!v) return "";
          const hKey = `${item.id}-${item.chapter}-${i}`;
          const hColor = highlights[hKey] || "";
          return `<p class="bv ${hColor ? `bv--hl-${hColor}` : ""}" data-hkey="${hKey}" data-verse="${i + 1}" data-action="verse-menu" data-day="${verseDay}" data-chapter="${escapeHtml(chapterLabel)}">
            <span class="bv__n">${i + 1}</span>
            <span class="bv__t">${escapeHtml(v)}</span>
          </p>`;
        }).join("")}
      </div>`;
    const saved = validLastReading();
    const scrollY = shouldResume && saved && saved.day === verseDay && saved.i === idx ? saved.scrollY : 0;
    window.scrollTo({ top: scrollY || 0 });
  }).catch(() => {
    container.innerHTML = `<p class="bible-reader__empty">${T().bible_error}</p>`;
  });
}

// ============================================================
// Memory verses
// ============================================================
function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function todaysMemoryVerse() {
  const today = todayISO();
  return (state.memoryVerses || []).find((v) => v.date === today) || null;
}

function viewMemory() {
  const lang = getLang();
  const list = [...(state.memoryVerses || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const today = todayISO();

  return `
    <div class="shell">
      ${topbar({
        title: T().memory_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="memory">
          <p class="memory__intro">${T().memory_intro}</p>

          <div class="card memory__form">
            <h3 class="memory__form-title">${T().memory_form_title}</h3>
            <div class="field">
              <label for="memDate">${T().memory_date_label}</label>
              <input type="date" id="memDate" value="${today}" min="${today}"/>
            </div>
            <div class="field">
              <label for="memRef">${T().memory_ref_label}</label>
              <input type="text" id="memRef" placeholder="${T().memory_ref_placeholder}" autocomplete="off"/>
            </div>
            <div class="field">
              <label for="memText">${T().memory_text_label}</label>
              <textarea id="memText" rows="3" placeholder="${T().memory_text_placeholder}"></textarea>
            </div>
            <button class="btn" data-action="memory-add">${I.plus} ${T().memory_add_btn}</button>
          </div>

          <h3 class="memory__list-title">${T().memory_list_title(list.length)}</h3>
          ${list.length === 0 ? `
            <div class="card memory__empty">
              <div class="memory__empty-icon">${I.bookmark}</div>
              <p>${T().memory_empty}</p>
            </div>
          ` : list.map((v) => {
            const isToday = v.date === today;
            const isPast = v.date < today;
            return `
              <div class="card memory-card ${isToday ? "memory-card--today" : ""} ${isPast ? "memory-card--past" : ""}">
                <div class="memory-card__head">
                  <span class="memory-card__date">${formatMemoryDate(v.date)} ${isToday ? T().memory_today_badge : ""}</span>
                  <button class="memory-card__del" data-action="memory-del" data-id="${v.id}" aria-label="${lang === "en" ? "Delete" : "Supprimer"}">${I.trash}</button>
                </div>
                <div class="memory-card__ref">${escapeHtml(v.ref)}</div>
                <div class="memory-card__text">${escapeHtml(v.text)}</div>
              </div>`;
          }).join("")}
        </div>
      </main>
      ${tabbar("home")}
    </div>`;
}

function formatMemoryDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return formatLongDate(dt);
}

// ============================================================
// Notes
// ============================================================
function viewNotes(params) {
  const lang = getLang();
  const filterDay = params.day ? parseInt(params.day, 10) : null;
  const editId = params.edit || null;
  const noteBeingEdited = editId ? noteById(editId) : null;

  const allNotes = [...(state.notes || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const filteredNotes = filterDay ? allNotes.filter((n) => n.dayRef === filterDay) : allNotes;

  const today = todayISO();
  const defaultDay = filterDay || currentDay();

  return `
    <div class="shell">
      ${topbar({
        title: filterDay ? T().notes_title_day(filterDay) : T().notes_title_all,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="notes-page">

          ${noteBeingEdited ? `
            <div class="card notes-form notes-form--edit">
              <h3 class="notes-form__title">${I.edit} ${T().notes_edit_title}</h3>
              <div class="field">
                <label for="noteTitle">${T().notes_title_label}</label>
                <input type="text" id="noteTitle" placeholder="${T().notes_title_edit_placeholder}" value="${escapeHtml(noteBeingEdited.title || "")}" autocomplete="off"/>
              </div>
              <div class="field">
                <label for="noteContent">${T().notes_content_label}</label>
                <textarea id="noteContent" rows="5" placeholder="${T().notes_content_placeholder}">${escapeHtml(noteBeingEdited.content)}</textarea>
              </div>
              <div class="notes-form__actions">
                <button class="btn" data-action="note-save-edit" data-id="${editId}">${T().notes_save_edit_btn}</button>
                <button class="btn btn--ghost" data-action="back">${T().notes_cancel_btn}</button>
              </div>
            </div>
          ` : `
            <div class="card notes-form">
              <h3 class="notes-form__title">${I.pen} ${T().notes_new_title}</h3>
              <div class="field">
                <label for="noteDay">${T().notes_day_label}</label>
                <select id="noteDay">
                  ${readings.map((r) => `<option value="${r.day}" ${r.day === defaultDay ? "selected" : ""}>${r.day} : ${r.passages.map((p) => translatePassage(p, lang)).join(", ")}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="noteChapter">${T().notes_passage_label}</label>
                <input type="text" id="noteChapter" placeholder="${T().notes_passage_placeholder}" autocomplete="off"/>
              </div>
              <div class="field">
                <label for="noteTitle">${T().notes_title_label}</label>
                <input type="text" id="noteTitle" placeholder="${T().notes_title_new_placeholder}" autocomplete="off"/>
              </div>
              <div class="field">
                <label for="noteContent">${T().notes_content_label}</label>
                <textarea id="noteContent" rows="5" placeholder="${T().notes_content_placeholder}"></textarea>
              </div>
              <button class="btn" data-action="note-add">${T().notes_save_btn}</button>
            </div>
          `}

          <div class="notes-filter">
            <button class="notes-filter__btn ${!filterDay ? "notes-filter__btn--active" : ""}" data-nav="notes">${T().notes_filter_all(allNotes.length)}</button>
            ${readings.filter((r) => notesForDay(r.day).length > 0).map((r) => `
              <button class="notes-filter__btn ${filterDay === r.day ? "notes-filter__btn--active" : ""}" data-nav="notes?day=${r.day}">${T().notes_filter_day(r.day, notesForDay(r.day).length)}</button>
            `).join("")}
          </div>

          <h3 class="notes-page__section">${T().notes_count(filteredNotes.length, filterDay)}</h3>

          ${filteredNotes.length === 0 ? `
            <div class="card notes-empty">
              <div class="notes-empty__icon">${I.pen}</div>
              <p>${T().notes_empty}</p>
            </div>
          ` : filteredNotes.map((n) => {
            const dateStr = n.createdAt ? formatShortDate(new Date(n.createdAt)) : "";
            const updatedStr = n.updatedAt && n.updatedAt !== n.createdAt ? T().notes_modified(formatShortDate(new Date(n.updatedAt))) : "";
            return `
              <div class="card note-card" id="note-${n.id}">
                <div class="note-card__head">
                  <div class="note-card__meta">
                    <span class="note-card__day">${T().notes_day_card(n.dayRef)}</span>
                    ${n.chapterRef ? `<span class="note-card__chapter">${escapeHtml(n.chapterRef)}</span>` : ""}
                    <span class="note-card__date">${dateStr} ${updatedStr}</span>
                  </div>
                  <div class="note-card__actions">
                    <button class="note-card__btn" data-nav="notes?edit=${n.id}" title="${lang === "en" ? "Edit" : "Modifier"}">${I.edit}</button>
                    <button class="note-card__btn note-card__btn--del" data-action="note-del" data-id="${n.id}" title="${lang === "en" ? "Delete" : "Supprimer"}">${I.trash}</button>
                  </div>
                </div>
                ${n.title ? `<div class="note-card__title">${escapeHtml(n.title)}</div>` : ""}
                <p class="note-card__content">${escapeHtml(n.content)}</p>
              </div>`;
          }).join("")}
        </div>
      </main>
      ${tabbar("help")}
    </div>`;
}

// ============================================================
// Comment ça marche
// ============================================================
function viewHow() {
  return `
    <div class="shell">
      ${topbar({
        title: T().how_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view view--no-tabs">
        <div class="how-page">

          <div class="how-hero">
            <div class="how-hero__icon">📖</div>
            <h2 class="how-hero__title">${T().how_hero_title}</h2>
            <p class="how-hero__sub">${T().how_hero_sub}</p>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bible}</div>
              <h3 class="how-section__title">${T().how_what_title}</h3>
            </div>
            <p class="how-section__body">${T().how_what_body}</p>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.tabPlan}</div>
              <h3 class="how-section__title">${T().how_daily_title}</h3>
            </div>
            <ul class="how-steps">
              ${T().how_daily_steps.map((s, i) => `
                <li class="how-step">
                  <span class="how-step__num">${i + 1}</span>
                  <span class="how-step__text">${s}</span>
                </li>
              `).join("")}
            </ul>
            <div class="how-tip">${T().how_daily_tip}</div>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bolt}</div>
              <h3 class="how-section__title">${T().how_next_title}</h3>
            </div>
            <p class="how-section__body" style="margin-bottom:10px;">${T().how_next_body}</p>
            <ul class="how-steps">
              ${T().how_next_steps.map((s, i) => `
                <li class="how-step">
                  <span class="how-step__num">${i + 1}</span>
                  <span class="how-step__text">${s}</span>
                </li>
              `).join("")}
            </ul>
            <div class="how-tip">${T().how_next_tip}</div>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bookmark}</div>
              <h3 class="how-section__title">${T().how_memory_title}</h3>
            </div>
            <p class="how-section__body">${T().how_memory_body}</p>
            <ul class="how-steps">
              ${T().how_memory_steps.map((s, i) => `
                <li class="how-step">
                  <span class="how-step__num">${i + 1}</span>
                  <span class="how-step__text">${s}</span>
                </li>
              `).join("")}
            </ul>
            <div class="how-tip">${T().how_memory_tip}</div>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.pen}</div>
              <h3 class="how-section__title">${T().how_notes_title}</h3>
            </div>
            <p class="how-section__body">${T().how_notes_body}</p>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bell}</div>
              <h3 class="how-section__title">${T().how_rem_title}</h3>
            </div>
            <p class="how-section__body" style="margin-bottom:10px;">${T().how_rem_body}</p>
            <button class="btn btn--ghost" data-nav="reminders">${T().how_rem_btn}</button>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.tabRewards}</div>
              <h3 class="how-section__title">${T().how_badges_title}</h3>
            </div>
            <p class="how-section__body">${T().how_badges_body}</p>
          </div>

          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.tabStats}</div>
              <h3 class="how-section__title">${T().how_reread_title}</h3>
            </div>
            <p class="how-section__body">${T().how_reread_body}</p>
          </div>

          <button class="btn" data-nav="home">${T().how_start_btn}</button>

        </div>
      </main>
    </div>`;
}

// ============================================================
// Settings
// ============================================================
function viewSettings() {
  const lang = getLang();
  const startISO = state.startedAt
    ? new Date(state.startedAt).toISOString().slice(0, 10)
    : todayISO();
  const theme = state.theme || "auto";

  return `
    <div class="shell">
      ${topbar({
        title: T().settings_title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="settings">

          <div class="card">
            <h3 class="settings__section-title">${I.cal} ${T().settings_date_title}</h3>
            <p class="settings__section-sub">${T().settings_date_sub}</p>
            <div class="field">
              <label for="startDate">${T().settings_date_label}</label>
              <input type="date" id="startDate" value="${startISO}"/>
            </div>
            <button class="btn" data-action="start-date-save">${T().settings_date_save}</button>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.moon} ${T().settings_theme_title}</h3>
            <p class="settings__section-sub">${T().settings_theme_sub}</p>
            <div class="theme-options">
              <button class="theme-opt ${theme === "light" ? "theme-opt--active" : ""}" data-action="theme-set" data-theme="light">
                ${I.sun}<span>${T().settings_theme_light}</span>
              </button>
              <button class="theme-opt ${theme === "dark" ? "theme-opt--active" : ""}" data-action="theme-set" data-theme="dark">
                ${I.moon}<span>${T().settings_theme_dark}</span>
              </button>
              <button class="theme-opt ${theme === "auto" ? "theme-opt--active" : ""}" data-action="theme-set" data-theme="auto">
                ${I.settings}<span>${T().settings_theme_auto}</span>
              </button>
            </div>
          </div>

          <div class="card">
            <h3 class="settings__section-title">🌐 ${T().settings_lang_title}</h3>
            <p class="settings__section-sub">${T().settings_lang_sub}</p>
            ${langSwitcher("settings")}
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.bell} ${T().settings_notif_title}</h3>
            <p class="settings__section-sub">${T().settings_notif_sub}</p>
            <button class="btn btn--ghost" data-nav="reminders">${T().settings_notif_btn}</button>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.download} ${T().settings_backup_title}</h3>
            <p class="settings__section-sub">${T().settings_backup_sub}</p>
            <button class="btn btn--ghost" data-action="export-data">${I.download} ${T().settings_export_btn}</button>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.mail} ${T().settings_contact_title}</h3>
            <p class="settings__section-sub">${T().settings_contact_sub}</p>
            <a class="settings-contact-row" href="mailto:${CONTACT_EMAIL}?subject=Mission%2031">
              <div class="settings-contact-row__icon">${I.mail}</div>
              <div class="settings-contact-row__body">
                <div class="settings-contact-row__title">${T().settings_contact_dev}</div>
                <div class="settings-contact-row__sub">${CONTACT_EMAIL}</div>
              </div>
            </a>
            ${getLang() !== "en" ? `<a class="settings-contact-row" href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer">
              <div class="settings-contact-row__icon">${I.whatsapp}</div>
              <div class="settings-contact-row__body">
                <div class="settings-contact-row__title">${T().settings_community_title}</div>
                <div class="settings-contact-row__sub">${T().settings_community_sub}</div>
              </div>
            </a>` : ""}
          </div>

          <div class="card settings__danger">
            <h3 class="settings__section-title">${T().settings_reset_title}</h3>
            <p class="settings__section-sub">${T().settings_reset_sub}</p>
            <button class="btn btn--ghost" data-action="reset">${T().settings_reset_btn}</button>
          </div>

        </div>
      </main>
      ${tabbar("help")}
    </div>`;
}

// ------------------------------------------------------------
// Escape HTML
// ------------------------------------------------------------
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  bible: viewBible,
  memory: viewMemory,
  settings: viewSettings,
  notes: viewNotes,
  how: viewHow,
};

function render() {
  const r = getRoute();
  const route = !navigator.onLine && r.name !== "welcome" ? "offline" : r.name;
  const view = VIEWS[route] || viewHome;
  document.getElementById("app").innerHTML = view(r.params || {});
  attachInstallBanner();
  applyTheme();
  window.scrollTo({ top: 0 });

  if (route === "bible") {
    renderBibleContent(r.params || {});
  } else if (route === "stats") {
    refreshGlobalStats();
  }
}

// ------------------------------------------------------------
// Thème
// ------------------------------------------------------------
function applyTheme() {
  const t = state.theme || "auto";
  const root = document.documentElement;
  let effective = t;
  if (t === "auto") {
    effective = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.setAttribute("data-theme", effective);
}
if (window.matchMedia) {
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if ((state.theme || "auto") === "auto") applyTheme();
    });
  } catch { /* anciens navigateurs */ }
}

// ------------------------------------------------------------
// Popover verset (surlignage + note)
// ------------------------------------------------------------
function showVerseMenu(hKey, day, chapterRef, verseEl) {
  document.getElementById("versePopover")?.remove();
  if (!state.highlights) state.highlights = {};
  const currentColor = state.highlights[hKey] || "";
  const colors = ["yellow", "green", "blue", "pink"];
  const colorLabels = { yellow: "🟡", green: "🟢", blue: "🔵", pink: "🩷" };
  const colorNames = {
    yellow: T().color_yellow,
    green: T().color_green,
    blue: T().color_blue,
    pink: T().color_pink,
  };

  const pop = document.createElement("div");
  pop.id = "versePopover";
  pop.className = "verse-pop";

  const rect = verseEl.getBoundingClientRect();
  const below = rect.bottom + 120 < window.innerHeight;
  const top = below ? rect.bottom + window.scrollY + 6 : rect.top + window.scrollY - 120;
  pop.style.top = `${top}px`;
  pop.style.left = `50%`;
  pop.style.transform = `translateX(-50%)`;

  pop.innerHTML = `
    <div class="verse-pop__colors">
      ${colors.map((c) => `
        <button class="verse-pop__color verse-pop__color--${c} ${currentColor === c ? "verse-pop__color--active" : ""}"
          data-vpcolor="${c}" title="${colorNames[c]}">${colorLabels[c]}</button>
      `).join("")}
      ${currentColor ? `<button class="verse-pop__clear" data-vpcolor="" title="${getLang() === "en" ? "Remove" : "Retirer"}">✕</button>` : ""}
    </div>
    <button class="verse-pop__note" data-vpnote="${day}" data-vpchapter="${escapeHtml(chapterRef)}">
      ✏️ ${getLang() === "en" ? "Note" : "Note"}
    </button>`;

  document.body.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add("verse-pop--visible"));

  pop.querySelectorAll("[data-vpcolor]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const color = btn.dataset.vpcolor;
      if (color) {
        state.highlights[hKey] = color;
        showToast(colorNames[color]);
      } else {
        delete state.highlights[hKey];
        showToast(tMsg(TOASTS.highlightRemoved));
      }
      saveState();
      const verseP = document.querySelector(`[data-hkey="${hKey}"]`);
      if (verseP) {
        colors.forEach((c) => verseP.classList.remove(`bv--hl-${c}`));
        if (color) verseP.classList.add(`bv--hl-${color}`);
      }
      pop.remove();
    });
  });

  const noteBtn = pop.querySelector("[data-vpnote]");
  if (noteBtn) {
    noteBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      pop.remove();
      showNoteModal(parseInt(noteBtn.dataset.vpnote, 10) || currentDay(), noteBtn.dataset.vpchapter || "");
    });
  }
}

document.addEventListener("click", (e) => {
  const pop = document.getElementById("versePopover");
  if (pop && !pop.contains(e.target) && !e.target.closest("[data-action='verse-menu']")) {
    pop.remove();
  }
}, true);

// ------------------------------------------------------------
// Event delegation
// ------------------------------------------------------------
document.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) { navigate(navEl.dataset.nav); return; }

  const bnavEl = e.target.closest("[data-bible-nav]");
  if (bnavEl && !bnavEl.disabled) {
    navigate(`bible?day=${bnavEl.dataset.day}&i=${bnavEl.dataset.i}`);
    return;
  }

  const accEl = e.target.closest("[data-acc]");
  if (accEl && !accEl.disabled) { window.__accSelection = Number(accEl.dataset.acc); render(); return; }

  const actionEl = e.target.closest("[data-action]");
  if (actionEl) { handleAction(actionEl); return; }

  const dayEl = e.target.closest("[data-day]");
  if (dayEl) {
    const day = parseInt(dayEl.dataset.day, 10);
    if (day) navigate(`bible?day=${day}&i=0`);
    return;
  }
});

function handleAction(actionEl) {
  const action = actionEl.dataset.action;
  const lang = getLang();

  switch (action) {
    case "lang-set": {
      const newLang = actionEl.dataset.lang;
      if (["fr", "en"].includes(newLang)) {
        state.lang = newLang;
        saveState();
        render();
      }
      break;
    }
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
      showToast(tMsg(TOASTS.reminderSaved));
      if (state.reminders.enabled && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().then(() => scheduleReminders());
        } else {
          scheduleReminders();
        }
      } else {
        clearReminderTimers();
      }
      break;
    }
    case "notif-request": {
      if (!("Notification" in window)) { showToast(T().toast_notif_unsupported); break; }
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") { scheduleReminders(); render(); showToast(T().toast_notif_granted); }
        else if (perm === "denied") { render(); showToast(T().toast_notif_denied); }
      });
      break;
    }
    case "notif-test": {
      if (!("Notification" in window) || Notification.permission !== "granted") {
        showToast(T().toast_notif_allow_first); break;
      }
      const opts = { body: T().notif_test_body, icon: "./icons/icon-192.png", tag: "mission31-test" };
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => reg.showNotification("Mission 31", opts));
      } else { new Notification("Mission 31", opts); }
      showToast(T().toast_notif_test_sent);
      break;
    }
    case "share-whatsapp": {
      const txt = encodeURIComponent(`${T().share_text(currentDay())} ${APP_URL}`);
      window.open(`https://wa.me/?text=${txt}`, "_blank");
      break;
    }
    case "share-native": {
      shareWithImage().catch(() => {});
      break;
    }
    case "reset":
      if (confirm(T().toast_reset_confirm)) {
        const savedLang = state.lang;
        state = { ...defaultState };
        state.lang = savedLang;
        saveState();
        navigate("welcome");
      }
      break;
    case "faq-how":
    case "faq-acc":
      navigate("how");
      break;
    case "install":
      triggerInstall();
      break;
    case "install-dismiss":
      window.__installSessionDismissed = true;
      document.querySelector(".install-banner")?.remove();
      break;
    case "install-progress-close": {
      const ov = document.getElementById("install-progress");
      if (ov) ov.remove();
      break;
    }
    case "modal-close": {
      document.querySelector(".modal")?.remove();
      break;
    }
    case "quick-note-save": {
      const day = parseInt(actionEl.dataset.day, 10) || currentDay();
      const chapterRef = actionEl.dataset.chapter || "";
      const quickTitle = (document.getElementById("quickNoteTitle")?.value || "").trim();
      const content = (document.getElementById("quickNoteContent")?.value || "").trim();
      if (!content) { showToast(T().toast_note_empty); break; }
      if (!state.notes) state.notes = [];
      const now = new Date().toISOString();
      state.notes.push({
        id: generateId(),
        dayRef: day,
        chapterRef: chapterRef || null,
        title: quickTitle || null,
        content,
        createdAt: now,
        updatedAt: now,
      });
      saveState();
      document.querySelector(".note-modal")?.remove();
      showToast(tMsg(TOASTS.noteSaved));
      break;
    }
    case "memory-add": {
      const date = document.getElementById("memDate")?.value || todayISO();
      const ref = (document.getElementById("memRef")?.value || "").trim();
      const text = (document.getElementById("memText")?.value || "").trim();
      if (!ref || !text) { showToast(T().toast_mem_required); break; }
      state.memoryVerses.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date, ref, text,
        addedAt: new Date().toISOString(),
      });
      saveState();
      showToast(tMsg(TOASTS.memoryAdded));
      render();
      break;
    }
    case "memory-del": {
      const id = actionEl.dataset.id;
      state.memoryVerses = (state.memoryVerses || []).filter((v) => v.id !== id);
      saveState();
      render();
      break;
    }
    case "start-date-save": {
      const v = document.getElementById("startDate")?.value;
      if (!v) { showToast(T().toast_date_invalid); break; }
      const [y, m, d] = v.split("-").map((n) => parseInt(n, 10));
      if (!y || !m || !d) { showToast(T().toast_date_bad); break; }
      const newStart = new Date(y, m - 1, d, 0, 0, 0).toISOString();
      state.startedAt = newStart;
      saveState();
      showToast(T().toast_date_saved);
      navigate("home");
      break;
    }
    case "theme-set": {
      const t = actionEl.dataset.theme;
      if (["light", "dark", "auto"].includes(t)) {
        state.theme = t;
        saveState();
        applyTheme();
        render();
      }
      break;
    }
    case "reader-mode-toggle": {
      state.readerMode = state.readerMode === "night" ? "normal" : "night";
      saveState();
      render();
      break;
    }
    case "export-data": {
      exportUserData();
      break;
    }
    case "note-add": {
      const dayRef = parseInt(document.getElementById("noteDay")?.value, 10) || currentDay();
      const chapterRef = (document.getElementById("noteChapter")?.value || "").trim();
      const noteTitle = (document.getElementById("noteTitle")?.value || "").trim();
      const content = (document.getElementById("noteContent")?.value || "").trim();
      if (!content) { showToast(T().toast_note_empty); break; }
      if (!state.notes) state.notes = [];
      const now = new Date().toISOString();
      state.notes.push({
        id: generateId(),
        dayRef,
        chapterRef: chapterRef || null,
        title: noteTitle || null,
        content,
        createdAt: now,
        updatedAt: now,
      });
      saveState();
      showToast(tMsg(TOASTS.noteSaved));
      navigate(`notes?day=${dayRef}`);
      break;
    }
    case "note-del": {
      const id = actionEl.dataset.id;
      if (!id) break;
      if (confirm(T().toast_note_delete_confirm)) {
        state.notes = (state.notes || []).filter((n) => n.id !== id);
        saveState();
        showToast(tMsg(TOASTS.noteDeleted));
        render();
      }
      break;
    }
    case "note-save-edit": {
      const id = actionEl.dataset.id;
      const noteTitle = (document.getElementById("noteTitle")?.value || "").trim();
      const content = (document.getElementById("noteContent")?.value || "").trim();
      if (!content) { showToast(T().toast_note_empty); break; }
      const note = noteById(id);
      if (!note) break;
      note.title = noteTitle || null;
      note.content = content;
      note.updatedAt = new Date().toISOString();
      saveState();
      showToast(lang === "en" ? "Note updated!" : "Note mise à jour !");
      navigate(`notes${note.dayRef ? `?day=${note.dayRef}` : ""}`);
      break;
    }
    case "verse-menu": {
      const hKey = actionEl.dataset.hkey;
      const verseDay = parseInt(actionEl.dataset.day, 10) || currentDay();
      const chapterRef = actionEl.dataset.chapter || "";
      if (!hKey) break;
      showVerseMenu(hKey, verseDay, chapterRef, actionEl);
      break;
    }
    case "open-note-modal": {
      const day = parseInt(actionEl.dataset.day, 10) || currentDay();
      const chapter = actionEl.dataset.chapter || "";
      showNoteModal(day, chapter);
      break;
    }
    case "mark-today-from-bible": {
      const day = parseInt(actionEl.dataset.day, 10) || currentDay();
      if (day === currentDay()) {
        markRead(1);
      } else {
        state.progress[day] = { done: true, doneAt: new Date().toISOString(), batchSize: 1 };
        if (!state.startedAt) state.startedAt = new Date().toISOString();
        saveState();
        syncProgress(completedCount());
        showCelebration(day, false);
      }
      break;
    }
    case "mark-reread-from-bible": {
      const day = parseInt(actionEl.dataset.day, 10) || currentDay();
      markReRead(day);
      break;
    }
    case "new-run": {
      if (confirm(T().toast_newrun_confirm)) {
        const savedCount = state.completionCount || 0;
        const savedReReads = state.reReads || {};
        const savedLang = state.lang;
        state = { ...defaultState };
        state.completionCount = savedCount;
        state.reReads = savedReReads;
        state.lang = savedLang;
        saveState();
        showToast(tMsg(TOASTS.newRunStarted));
        navigate("welcome");
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// PWA install prompt
// ------------------------------------------------------------
let deferredPrompt = null;
let installMode = "install";
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  attachInstallBanner();
});

function triggerInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(async (choice) => {
      deferredPrompt = null;
      if (choice && choice.outcome === "accepted") {
        installMode = "install";
        showInstallProgress(0, 1, T().toast_install_progress);
        await markInstalled();
        globalStatsLoadedAt = 0;
        refreshGlobalStats();
      } else {
        hideInstallProgress();
      }
    });
    return;
  }
  if (isIOS()) {
    showInstallModal({
      title: T().install_ios_title,
      steps: T().install_ios_steps,
      note: T().install_ios_note,
    });
  } else if (isAndroid()) {
    showInstallModal({
      title: T().install_android_title,
      steps: T().install_android_steps,
      note: T().install_android_note,
    });
  } else {
    showInstallModal({
      title: T().install_other_title,
      steps: T().install_other_steps,
      note: T().install_other_note,
    });
  }
}

function attachInstallBanner() {
  if (isAppInstalled()) return;
  if (window.__installSessionDismissed) return;
  if (document.querySelector(".install-banner")) return;
  const el = document.createElement("div");
  el.className = "install-banner";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", T().install_banner_title);
  el.innerHTML = `
    <span class="install-banner__icon">${I.install}</span>
    <div class="install-banner__body">
      <div class="install-banner__title">${T().install_banner_title}</div>
      <div class="install-banner__sub">${T().install_banner_sub}</div>
    </div>
    <button data-action="install">${T().install_banner_btn}</button>
    <button class="install-banner__close" data-action="install-dismiss" aria-label="${getLang() === "en" ? "Dismiss" : "Masquer"}">${I.close}</button>
  `;
  document.body.appendChild(el);
}

function showInstallModal({ title, steps, note }) {
  document.querySelector(".modal")?.remove();
  const el = document.createElement("div");
  el.className = "modal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", title);
  el.innerHTML = `
    <div class="modal__backdrop" data-action="modal-close"></div>
    <div class="modal__card">
      <div class="modal__icon">${I.install}</div>
      <h3 class="modal__title">${title}</h3>
      <ol class="modal__steps">
        ${steps.map((s) => `<li>${s}</li>`).join("")}
      </ol>
      ${note ? `<p class="modal__note">${note}</p>` : ""}
      <button class="btn" data-action="modal-close">${T().install_understood}</button>
    </div>
  `;
  document.body.appendChild(el);
}

// ------------------------------------------------------------
// Modale de note rapide
// ------------------------------------------------------------
function showNoteModal(day, chapterRef) {
  document.querySelector(".note-modal")?.remove();
  const el = document.createElement("div");
  el.className = "modal note-modal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", T().quick_note_title);
  el.innerHTML = `
    <div class="modal__backdrop" data-action="modal-close"></div>
    <div class="modal__card">
      <h3 class="modal__title">${I.pen} ${T().quick_note_title}</h3>
      ${chapterRef ? `<p style="font-size:13px;color:var(--ink-faint);margin:0 0 10px;">${escapeHtml(chapterRef)}</p>` : ""}
      <div class="field">
        <label for="quickNoteTitle">${T().quick_note_title_label}</label>
        <input type="text" id="quickNoteTitle" placeholder="${T().quick_note_title_placeholder}" autocomplete="off"/>
      </div>
      <div class="field">
        <label for="quickNoteContent">${T().quick_note_content_label}</label>
        <textarea id="quickNoteContent" rows="4" placeholder="${T().quick_note_content_placeholder}"></textarea>
      </div>
      <button class="btn" data-action="quick-note-save" data-day="${day}" data-chapter="${escapeHtml(chapterRef)}">${T().quick_note_save}</button>
    </div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.querySelector("textarea")?.focus(), 100);
}

window.appInstalled && window.removeEventListener("appinstalled", window.appInstalled);
window.addEventListener("appinstalled", async () => {
  document.querySelector(".install-banner")?.remove();
  await markInstalled();
  globalStatsLoadedAt = 0;
  refreshGlobalStats();
  setTimeout(hideInstallProgress, 800);
  setTimeout(() => { window.location.reload(); }, 500);
});

function showInstallProgress(done, total, label) {
  let el = document.getElementById("install-progress");
  if (!el) {
    el = document.createElement("div");
    el.id = "install-progress";
    el.className = "install-progress";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `
      <div class="install-progress__card">
        <div class="install-progress__icon">${I.bible}</div>
        <div class="install-progress__title">${getLang() === "en" ? "Installing" : "Installation en cours"}</div>
        <div class="install-progress__sub" id="ipsub">${label || T().toast_sw_prep}</div>
        <div class="install-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="ipbar"><div class="install-progress__fill" id="ipfill"></div></div>
        <div class="install-progress__pct" id="ippct">0%</div>
      </div>
    `;
    document.body.appendChild(el);
  }
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fill = document.getElementById("ipfill");
  const pctEl = document.getElementById("ippct");
  const subEl = document.getElementById("ipsub");
  if (fill) fill.style.width = pct + "%";
  if (pctEl) pctEl.textContent = pct + "%";
  if (label && subEl) subEl.textContent = label;
  const bar = document.getElementById("ipbar");
  if (bar) bar.setAttribute("aria-valuenow", String(pct));
}

function hideInstallProgress() {
  const el = document.getElementById("install-progress");
  if (!el) return;
  el.classList.add("install-progress--done");
  setTimeout(() => el.remove(), 500);
}

async function maybeShowFirstInstallProgress() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  try {
    const keys = await caches.keys();
    const hasCache = keys.some((k) => k.startsWith("mission31"));
    installMode = hasCache ? "update" : "install";
    if (hasCache) return;
    showInstallProgress(0, 1, T().toast_sw_prep);
  } catch { /* noop */ }
}

// ------------------------------------------------------------
// Rappels quotidiens
// ------------------------------------------------------------
let reminderTimers = [];
function clearReminderTimers() {
  reminderTimers.forEach((t) => clearTimeout(t));
  reminderTimers = [];
}

function scheduleReminders() {
  clearReminderTimers();
  if (!state.reminders.enabled) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const now = new Date();
  state.reminders.times.forEach((time) => {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next - now;
    if (delay <= 0 || delay > 24 * 3600 * 1000) return;
    const tid = setTimeout(() => { fireReminder(); scheduleReminders(); }, delay);
    reminderTimers.push(tid);
  });
}

function fireReminder() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const day = currentDay();
  if (state.progress[day]?.done) return;
  const lang = getLang();
  const passages = readings.find((r) => r.day === day)?.passages.map((p) => translatePassage(p, lang)).join(", ") || "";
  const body = `${state.reminders.message} ${lang === "en" ? "Day" : "Jour"} ${day}/31 · ${passages}`;
  const opts = { body, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: "mission31-daily", requireInteraction: false };
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification("Mission 31", opts));
    } else {
      new Notification("Mission 31", opts);
    }
  } catch { /* ignore */ }
}

// ------------------------------------------------------------
// Partage enrichi
// ------------------------------------------------------------
async function shareWithImage(options = {}) {
  const lang = getLang();
  const day = currentDay();
  const text = options.text || `${T().share_text(day)} ${APP_URL}`;
  let file = null;
  try {
    const blob = await renderShareImage(day);
    if (blob) file = new File([blob], `mission31-day-${day}.png`, { type: "image/png" });
  } catch { /* fallback text-only */ }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: "Mission 31", text, files: [file] });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: "Mission 31", text, url: APP_URL });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${APP_URL}`);
    showToast(T().toast_clipboard);
  } catch {
    showToast(T().toast_share_unavail);
  }
}

function renderShareImage(day) {
  return new Promise((resolve) => {
    const lang = getLang();
    const W = 720, H = 720;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a2e2e");
    grad.addColorStop(1, "#0e3838");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(207, 230, 230, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.save();
    ctx.translate(W / 2, 180);
    ctx.strokeStyle = "#cfe6e6";
    ctx.fillStyle = "#0a2e2e";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-50, -60); ctx.lineTo(60, -60); ctx.lineTo(60, 60); ctx.lineTo(-50, 60);
    ctx.arcTo(-65, 60, -65, 50, 12); ctx.lineTo(-65, -45);
    ctx.arcTo(-65, -60, -50, -60, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -35); ctx.lineTo(0, 25); ctx.moveTo(-20, -10); ctx.lineTo(20, -10);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "700 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("MISSION 31", W / 2, 320);

    ctx.fillStyle = "#2d8a8a";
    ctx.font = "600 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(T().share_day_label(day), W / 2, 380);

    ctx.fillStyle = "#cfe6e6";
    ctx.font = "400 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const lines = [T().share_img_line1, T().share_img_line2, T().share_img_line3];
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 460 + i * 42));

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "500 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(APP_URL.replace(/^https?:\/\//, ""), W / 2, 600);

    ctx.fillStyle = "#f7b955";
    ctx.font = "700 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("#Mission31", W / 2, 655);

    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

// ------------------------------------------------------------
// Service Worker
// ------------------------------------------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "sw-cache-progress") {
      const label = installMode === "update" ? T().toast_sw_updating : T().toast_install_progress;
      showInstallProgress(data.done, data.total, label);
    } else if (data.type === "sw-cache-done") {
      const label = installMode === "update" ? T().toast_sw_updated : T().toast_sw_done;
      showInstallProgress(data.total, data.total, label);
      setTimeout(hideInstallProgress, 800);
    }
  });

  // When a new SW takes control, reload the page to apply the update.
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    swRefreshing = true;
    showToast(getLang() === "en" ? "App updated — reloading..." : "App mise à jour — rechargement...");
    setTimeout(() => window.location.reload(), 1200);
  });

  window.addEventListener("load", () => {
    maybeShowFirstInstallProgress();
    const swUrl = new URL("./sw.js", document.baseURI).href;
    navigator.serviceWorker.register(swUrl, { scope: new URL("./", document.baseURI).pathname })
      .then((reg) => {
        // Detect when a new SW version is found and being installed.
        reg.addEventListener("updatefound", () => {
          installMode = "update";
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version cached and ready — controllerchange will trigger reload.
              showInstallProgress(1, 1, T().toast_sw_updated);
              setTimeout(hideInstallProgress, 800);
            }
          });
        });
        // Check for updates every hour silently.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
        hideInstallProgress();
      });
  });
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
window.__accSelection = 1;
render();
attachInstallBanner();
registerUser(completedCount()).then((registered) => {
  if (registered && getRoute().name === "stats") {
    globalStatsLoadedAt = 0;
    refreshGlobalStats();
  }
});
if (isAppInstalled()) { markInstalled(); }
scheduleReminders();

if (state.reminders?.enabled && "Notification" in window) {
  setTimeout(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") scheduleReminders();
      });
    }
  }, 5000);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleReminders();
});
