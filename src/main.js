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
  parsePassage,
  expandPassages,
  getChapterVerses,
  formatChapterLabel,
  SINGLE_CHAPTER_BOOKS,
  NT_BOOKS_ORDER,
  BOOK_IDS,
} from "./data/bible.js";

// Liens & contacts (à un seul endroit pour éviter la duplication)
const CONTACT_EMAIL = "djochristkfreelance@gmail.com";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/I3ofVHRDGPlEEmCtzSSsxV?mode=gi_t";
const APP_URL = "https://mission31.vercel.app";

// ------------------------------------------------------------
// State management (localStorage backed)
// ------------------------------------------------------------
const STORAGE_KEY = "mission31:state:v1";

const defaultState = {
  startedAt: null,
  progress: {},                // { 1: { done: true, doneAt, batchSize }, ... }
  reReads: {},                 // { 1: 2, 3: 1, ... } — nombre de relectures par jour
  completionCount: 0,          // nombre de fois que les 31 jours ont été terminés
  reminders: { enabled: true, times: ["08:00", "20:00"], message: "N'oublie pas ta lecture du jour." },
  lastSyncedAt: null,          // ISO date du dernier sync réussi (multi-appareils)
  memoryVerses: [],            // [{ id, date: "YYYY-MM-DD", ref, text, addedAt }]
  theme: "auto",               // "auto" | "light" | "dark"
  readerMode: "normal",        // "normal" | "night"
  notes: [],                   // [{ id, dayRef, chapterRef, title, content, createdAt, updatedAt }]
  highlights: {},              // { "bookId-chapter-verseIdx": "yellow"|"green"|"blue"|"pink" }
  lastReading: null,           // { day, i, label, scrollY, updatedAt }
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
// Date helpers (basées sur la date réelle du téléphone)
// ------------------------------------------------------------
const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MONTHS_FR_SHORT = [
  "janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getStartDate() {
  // Si l'utilisateur a démarré la mission, on prend cette date comme jour 1.
  // Sinon, on simule avec aujourd'hui pour l'aperçu.
  return state.startedAt ? startOfDay(new Date(state.startedAt)) : startOfDay(new Date());
}

function dateForDay(day) {
  return addDays(getStartDate(), day - 1);
}

function formatShortDate(d) {
  return `${d.getDate()} ${MONTHS_FR_SHORT[d.getMonth()]}`;
}

function formatLongDate(d) {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRange(start, end) {
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `Du ${start.getDate()} au ${end.getDate()} ${MONTHS_FR[start.getMonth()]}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `Du ${start.getDate()} ${MONTHS_FR_SHORT[start.getMonth()]} au ${end.getDate()} ${MONTHS_FR_SHORT[end.getMonth()]}`;
  }
  return `Du ${formatShortDate(start)} ${start.getFullYear()} au ${formatShortDate(end)} ${end.getFullYear()}`;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function currentDay() {
  // Si l'utilisateur a démarré, base sur la date réelle du téléphone.
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

// ------------------------------------------------------------
// Estimation du temps de lecture
// Base : ~4 min par chapitre en moyenne (NT français ≈ 18h / 260 chapitres)
// ------------------------------------------------------------
const MINUTES_PER_CHAPTER = 4;

function estimateMinutes(passages) {
  return expandPassages(passages).length * MINUTES_PER_CHAPTER;
}

function formatReadingTime(minutes) {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h${String(m).padStart(2,"0")}` : `~${h}h`;
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
  const label = lr.label || formatChapterLabel(queue[idx].name, queue[idx].chapter);
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
    const payload = {
      app: "Mission 31",
      exportedAt: new Date().toISOString(),
      version: 1,
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mission31-sauvegarde-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Sauvegarde exportée.");
  } catch {
    showToast("Export impossible sur ce navigateur.");
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
  showToast(`Badge débloqué : ${badge.name}`);
  if ("Notification" in window && Notification.permission === "granted") {
    const opts = {
      body: `Tu as débloqué le badge « ${badge.name} » !`,
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
// Son de célébration (Web Audio API — aucun fichier requis)
// ------------------------------------------------------------
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
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
  } catch (_) { /* contexte audio non disponible */ }
}

// ------------------------------------------------------------
// Modal de célébration (validation ou relecture)
// day        : numéro du jour validé
// isReRead   : true si c'est une relecture
// reReadCount: nombre de relectures déjà faites pour ce jour
// ------------------------------------------------------------
function showCelebration(day, isReRead = false, reReadCount = 0, unlockedBadge = null) {
  playChime();

  let title, body;
  if (isReRead) {
    const idx = Math.min(reReadCount - 1, REREAD_MESSAGES.length - 1);
    ({ title, body } = REREAD_MESSAGES[Math.max(0, idx)]);
  } else if (unlockedBadge) {
    title = `Bravo ! Tu as débloqué un badge`;
    body = `Tu viens de mériter le badge « ${unlockedBadge.name} ». Partage-le pour encourager d'autres lecteurs !`;
  } else {
    const dayMsg = CELEBRATION.days[day];
    ({ title, body } = dayMsg || CELEBRATION.default);
  }

  const nextDay = (!isReRead && day < 31) ? day + 1 : null;
  const nextReading = nextDay ? readings.find((r) => r.day === nextDay) : null;
  const nextPassages = nextReading ? nextReading.passages.join(", ") : "";

  const overlay = document.createElement("div");
  overlay.className = "celeb-overlay";
  overlay.innerHTML = `
    <div class="celeb-box">
      <div class="celeb-stars" aria-hidden="true">
        ${Array.from({ length: 12 }, (_, i) =>
          `<span class="celeb-star" style="--i:${i}">✦</span>`
        ).join("")}
      </div>
      <div class="celeb-emoji">${I.checkBig}</div>
      <h2 class="celeb-title">${escapeHtml(title)}</h2>
      <p class="celeb-body">${escapeHtml(body)}</p>
      <p class="celeb-verse">Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.</p>
      ${unlockedBadge ? `
        <div class="celeb-badge-card">
          <div class="celeb-badge-icon" style="background:${escapeHtml(unlockedBadge.color || "var(--primary)")}">${badgeIcons[unlockedBadge.icon] || I.trophy}</div>
          <div class="celeb-badge-name">${escapeHtml(unlockedBadge.name)}</div>
          <div class="celeb-badge-desc">${escapeHtml(unlockedBadge.desc)}</div>
        </div>
      ` : ""}
      <div class="celeb-divider"></div>
      <p class="celeb-question">${escapeHtml(REFLECTION_QUESTION)}</p>
      <div class="celeb-actions">
        <button class="btn celeb-btn--notes" data-celeb-action="notes" data-celeb-day="${day}">
          ✏️ Prendre une note
        </button>
        ${unlockedBadge ? `
        <button class="btn celeb-btn--share" data-celeb-action="share-badge" data-badge-id="${escapeHtml(unlockedBadge.id)}">
          ${I.share} Partager le badge
        </button>
        ` : ""}
        ${nextDay ? `
        <button class="btn celeb-btn--next" data-celeb-action="next" data-celeb-day="${nextDay}">
          Lire le Jour ${nextDay} <span style="font-size:12px;opacity:.7;">${escapeHtml(nextPassages)}</span>
        </button>` : ""}
        <button class="btn btn--ghost celeb-btn--continue" data-celeb-action="continue">
          Retour au planning
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("celeb-overlay--visible"));

  function dismiss() {
    overlay.classList.remove("celeb-overlay--visible");
    setTimeout(() => { overlay.remove(); render(); navigate("planning"); }, 350);
  }

  overlay.querySelector("[data-celeb-action='continue']").addEventListener("click", dismiss);

  overlay.querySelector("[data-celeb-action='notes']").addEventListener("click", () => {
    overlay.remove();
    render();
    navigate("planning");
    setTimeout(() => showNoteModal(day, ""), 100);
  });

  const shareBtn = overlay.querySelector("[data-celeb-action='share-badge']");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const badgeId = shareBtn.dataset.badgeId;
      const badge = badges.find((b) => b.id === badgeId);
      if (badge) {
        await shareWithImage({ text: `J'ai débloqué le badge « ${badge.name} » dans Mission 31 !` });
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
// Marquer un jour déjà validé comme relu
// ------------------------------------------------------------
function markReRead(day) {
  state.reReads[day] = (state.reReads[day] || 0) + 1;
  saveState();
  const count = state.reReads[day];
  showCelebration(day, true, count);
}

// ------------------------------------------------------------
// Détection plateforme & mode d'installation
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

  // Synchronisation avec Supabase (silencieuse, n'affecte pas l'UX)
  syncProgress(completedCount());

  const currentBadges = unlockedBadges(state);
  [...currentBadges].forEach((id) => {
    if (!previousBadges.has(id)) {
      const badge = badges.find((b) => b.id === id);
      if (badge) notifyBadgeUnlock(badge);
    }
  });

  if (completedCount() >= 31) {
    // Tour complet → incrémenter le compteur et aller à l'écran de complétion
    state.completionCount = (state.completionCount || 0) + 1;
    saveState();
    setTimeout(() => navigate("completion"), 400);
  } else if (daysCount > 1) {
    showToast(`${daysCount} jours validés !`);
  } else {
    showCelebration(today, false);
  }
}

// ------------------------------------------------------------
// Router (hash-based, avec support de query string)
// Exemples : #/home  #/bible?day=1&i=0  #/bible?b=40&c=1  #/memory
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
  // Icônes additionnelles : lecture du texte, mode sombre/clair, paramètres, mémorisation
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
  bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
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
    { id: "home",    icon: I.tabHome,    label: "Accueil"  },
    { id: "planning",icon: I.tabPlan,    label: "Planning" },
    { id: "rewards", icon: I.trophy,     label: "Badges"   },
    { id: "stats",   icon: I.tabStats,   label: "Stats"    },
    { id: "help",    icon: I.tabHelp,    label: "Aide"     },
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
          <div class="splash__icon-wrap">
            <img class="splash__app-icon" src="${appIconUrl}" alt="Mission 31" />
            <span class="splash__m31">M31</span>
          </div>
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
  const activeDay = getActiveDay();
  const day = activeDay;
  const today = readings.find((r) => r.day === day);
  const passages = today ? today.passages.join(", ") : "...";
  const pct = progressPct();
  const completed = completedCount();
  const isTodayDone = state.progress[day]?.done;
  const memVerse = todaysMemoryVerse();
  const todayMinutes = today ? estimateMinutes(today.passages) : 0;
  const dayNotes = notesForDay(day);
  const dayStatus = day === currentDay() ? "Aujourd'hui" : "Lecture disponible";
  const resume = validLastReading();
  const mainCta = resume ? "Continuer ma lecture" : isTodayDone ? "Relire aujourd'hui" : "Lire aujourd'hui";

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
            <div class="day-card__label">Jour <strong style="color:var(--primary);font-size:24px;font-weight:700;">${day}</strong> / 31 · ${escapeHtml(passages)}</div>
            <div class="day-card__sub" style="margin-top:14px;">${dayStatus}</div>
            <div class="day-card__passages">${resume ? `Reprendre à ${escapeHtml(resume.label)}` : escapeHtml(passages)}</div>
            <div class="day-card__meta">
              <span class="reading-time-badge">${I.clock} ${formatReadingTime(todayMinutes)}</span>
              ${dayNotes.length > 0 ? `<span class="notes-badge" data-nav="notes?day=${day}">${I.pen} ${dayNotes.length} note${dayNotes.length > 1 ? "s" : ""}</span>` : ""}
            </div>
            <div class="day-card__actions">
              ${(() => {
                if (isTodayDone && day < 31) {
                  const nextDay = day + 1;
                  const nextReading = readings.find((r) => r.day === nextDay);
                  const nextPassages = nextReading ? nextReading.passages.join(", ") : "";
                  const nextMin = nextReading ? estimateMinutes(nextReading.passages) : 0;
                  const nextDone = state.progress[nextDay]?.done;
                  return `
                    <div class="next-day-inline ${nextDone ? "next-day-inline--done" : ""}">
                      <div class="next-day-inline__label">Jour ${nextDay} ${nextDone ? "✓" : "· Suivant"}</div>
                      <div class="next-day-inline__passages">${escapeHtml(nextPassages)}</div>
                      <div class="next-day-inline__meta">${I.clock} ${formatReadingTime(nextMin)}</div>
                      ${nextDone
                        ? `<span class="next-day-inline__done-label">Déjà validé</span>`
                        : `<button class="btn btn--sm" data-nav="bible?day=${nextDay}&i=0">${I.bookOpen} Commencer le jour suivant</button>`}
                    </div>
                    <button class="btn btn--ghost" data-nav="bible?day=${day}&i=0">${I.bookOpen} Relire aujourd'hui</button>`;
                }
                return `<button class="btn" data-nav="${resume ? `bible?day=${resume.day}&i=${resume.i}&resume=1` : `bible?day=${day}&i=0`}">${I.bookOpen} ${mainCta}</button>`;
              })()}
              <button class="btn btn--ghost" data-nav="reading">Voir le détail</button>
            </div>
          </div>

          ${!isAppInstalled() ? `
            <div class="install-card" data-action="install">
              <div class="install-card__icon">${I.install}</div>
              <div class="install-card__body">
                <div class="install-card__title">Installer Mission 31</div>
                <div class="install-card__sub">Accès rapide et lecture hors ligne.</div>
              </div>
            </div>
          ` : ""}

          ${memVerse ? `
            <div class="card memory-today">
              <div class="memory-today__head">
                ${I.bookmark}
                <span class="memory-today__label">Verset à mémoriser aujourd'hui</span>
              </div>
              <div class="memory-today__ref">${escapeHtml(memVerse.ref)}</div>
              <div class="memory-today__text">« ${escapeHtml(memVerse.text)} »</div>
            </div>
          ` : ""}

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

          <div class="card streak-card" style="cursor:pointer" data-nav="rewards">
            <span class="streak-card__label">Mes badges ${I.trophy}</span>
            <span class="streak-card__value" style="font-size:14px;color:var(--primary);">${unlockedBadges(state).size} débloqués →</span>
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
  const dateLabel = formatLongDate(dateForDay(day));
  const chapters = expandPassages(passages);
  const totalMin = estimateMinutes(passages);
  const dayNotes = notesForDay(day);

  return `
    <div class="shell">
      ${topbar({
        title: `Jour ${day}`,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
        rightActions: [`<button class="topbar__btn" data-nav="notes?day=${day}">${I.pen}</button>`],
      })}
      <main class="view">
        <div class="reading">
          <div class="reading__hero">
            <div class="reading__day-label">${dateLabel}</div>
            <div class="reading__day-title">Jour ${day} / 31</div>
            <div class="reading__passage">${passages.join(", ")}</div>
            <div class="reading__time-row">
              ${I.clock} <span>${formatReadingTime(totalMin)}</span>
              <span class="reading__time-sep">·</span>
              <span>${chapters.length} chapitre${chapters.length > 1 ? "s" : ""}</span>
            </div>
          </div>

          <div class="reading__list">
            <h3 class="reading__list-title">À lire aujourd'hui</h3>
            <div class="reading__chapters">
              ${chapters.map((c, i) => `
                <button class="reading__chapter" data-nav="bible?day=${day}&i=${i}">
                  <span class="reading__chapter-name">${formatChapterLabel(c.name, c.chapter)}</span>
                  <span style="display:flex;align-items:center;gap:6px;">
                    <span class="reading__chapter-time">${I.clock} ${MINUTES_PER_CHAPTER} min</span>
                    <span class="reading__chapter-go">${I.bookOpen}</span>
                  </span>
                </button>
              `).join("")}
            </div>
          </div>

          ${dayNotes.length > 0 ? `
            <div class="card notes-preview">
              <div class="notes-preview__head">
                ${I.pen} <span class="notes-preview__title">Mes notes du jour</span>
                <button class="notes-preview__all" data-nav="notes?day=${day}">Tout voir</button>
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
              « Heureux celui qui lit, et ceux qui entendent les paroles de la prophétie,<br/>
              et qui gardent les choses qui y sont écrites ! »
              <small>Apocalypse 1:3</small>
            </p>
          </div>

          ${!isDone
            ? `<button class="btn" data-action="mark-today">${I.checkBig.replace("42", "20").replace("42", "20")} J'ai terminé ma lecture</button>`
            : `<button class="btn btn--ghost" data-action="unmark-today">Lecture déjà validée. Annuler</button>`
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
        title: "Validation par lot",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="accelerated">
          <p class="accelerated__intro">Combien de jours veux-tu valider ?</p>
          <p class="accelerated__day">Tu es au jour ${day} : ${remaining} jours restants.</p>

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
  const start = getStartDate();
  const end = addDays(start, 30);
  const headerLabel = formatRange(start, end);
  return `
    <div class="shell">
      ${topbar({
        title: "Planning",
        leftAction: `<span style="margin-left:4px;">${I.cal}</span>`,
        rightActions: [`<button class="topbar__btn" data-nav="reminders">${I.bell}</button>`],
      })}
      <main class="view">
        <p class="planning__sub">${headerLabel} · 31 jours pour finir</p>
        <div class="planning-list">
          ${readings.map((r) => {
            const done = state.progress[r.day]?.done;
            const isToday = r.day === today;
            const cls = done ? "plan-row--done" : isToday ? "plan-row--today" : "";
            const dateLabel = formatShortDate(dateForDay(r.day));
            const mins = estimateMinutes(r.passages);
            const chapCount = expandPassages(r.passages).length;
            const dayNoteCount = notesForDay(r.day).length;
            return `
              <button class="plan-row ${cls}" data-day="${r.day}">
                <span class="plan-row__check">${done ? I.check : isToday ? `<span style="font-size:11px;font-weight:700;color:var(--primary);">${r.day}</span>` : `<span style="font-size:11px;font-weight:600;color:var(--ink-faint);">${r.day}</span>`}</span>
                <span class="plan-row__body">
                  <div class="plan-row__title">${r.passages.join(", ")}</div>
                  <div class="plan-row__sub">${I.clock} ${formatReadingTime(mins)} · ${chapCount} ch.${dayNoteCount > 0 ? ` · ${I.pen} ${dayNoteCount}` : ""}</div>
                </span>
                <span class="plan-row__date">${isToday ? "Aujourd'hui" : dateLabel}</span>
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
  const hasGlobalVisitors = Number.isFinite(Number(globalStats?.total_users));
  const hasInstalledUsers = Number.isFinite(Number(globalStats?.installed_users));
  const visitorCount = hasGlobalVisitors ? Number(globalStats.total_users) : null;
  const installedUsers = hasInstalledUsers
    ? Number(globalStats.installed_users)
    : null;
  const unavailableLabel = "Pas encore disponible";
  const loadingLabel = "...";
  const globalVisitorsLabel = hasGlobalVisitors
    ? visitorCount.toLocaleString("fr-FR")
    : globalStatsUnavailable ? unavailableLabel : loadingLabel;
  const installedUsersLabel = hasInstalledUsers
    ? installedUsers.toLocaleString("fr-FR")
    : globalStatsUnavailable ? unavailableLabel : loadingLabel;
  const globalVisitorsValueClass = hasGlobalVisitors ? "" : " visitor-counter__value--muted";
  const installedUsersValueClass = hasInstalledUsers ? "" : " visitor-counter__value--muted";
  const globalCaption = globalStatsUnavailable
    ? ""
    : "Ces chiffres sont partagés entre tous les participants. Tu ne marches pas seul(e).";
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
              <div class="stat-tile__label">Plus longue série</div>
              <div class="stat-tile__value">${longestStreak()} jours</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Jours gagnés</div>
              <div class="stat-tile__value">${daysGained()} jours</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-tile__label">${I.clock} Temps total estimé</div>
              <div class="stat-tile__value">${formatReadingTime(totalMissionMinutes())}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${I.clock} Temps restant estimé</div>
              <div class="stat-tile__value">${formatReadingTime(remainingMissionMinutes())}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-tile__label">${I.pen} Mes notes</div>
              <div class="stat-tile__value stat-tile__value--link" data-nav="notes">${(state.notes || []).length}</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">${I.bookOpen} Reprise</div>
              <div class="stat-tile__value stat-tile__value--small">${validLastReading() ? escapeHtml(validLastReading().label) : "Aucune"}</div>
            </div>
          </div>

          <div class="visitor-counter" aria-live="polite">
            <div class="visitor-counter__icon">${I.users}</div>
            <div class="visitor-counter__body">
              <div class="visitor-counter__grid">
                <div>
                  <div class="visitor-counter__label">Ont entendu parler de Mission 31</div>
                  <div class="visitor-counter__value${globalVisitorsValueClass}">${globalVisitorsLabel}</div>
                </div>
                <div>
                  <div class="visitor-counter__label">Sont dans la mission</div>
                  <div class="visitor-counter__value${installedUsersValueClass}">${installedUsersLabel}</div>
                </div>
              </div>
              ${globalCaption ? `<div class="visitor-counter__caption">${globalCaption}</div>` : ""}
            </div>
          </div>

          <p class="encourage">Il te reste ${31 - completedCount()} jours pour finir la mission.<br/>Continue, tu y es presque !</p>

          <div class="stats-actions">
            <button class="btn btn--danger" data-action="reset">
              Réinitialiser la mission
            </button>
          </div>
        </div>
      </main>
      ${tabbar("stats")}
    </div>`;
}

function viewRewards() {
  const unlocked = unlockedBadges(state);
  const completedB = badges.filter((b) => b.category === "completed");

  function renderBadge(b) {
    const isUnlocked = unlocked.has(b.id);
    const iconStyle = isUnlocked && b.color ? `style="background:${escapeHtml(b.color)}"` : "";
    return `
      <div class="badge ${isUnlocked ? "" : "badge--locked"}">
        <div class="badge__icon" ${iconStyle}>${badgeIcons[b.icon] || I.trophy}</div>
        <div class="badge__name">${b.name}</div>
        <div class="badge__desc">${b.desc}</div>
      </div>`;
  }

  const completionCount = state.completionCount || 0;

  return `
    <div class="shell">
      ${topbar({ title: "Récompenses" })}
      <main class="view">
        <div class="rewards">
          <h3 class="rewards__section-title">Badges de progression</h3>
          <div class="badge-grid">${completedB.map(renderBadge).join("")}</div>

          <h3 class="rewards__section-title">Badges de fidélité (tours)</h3>
          <div class="badge-grid">
            ${TOUR_BADGES.map((b) => {
              const isUnlocked = completionCount >= b.required;
              return `
                <div class="badge ${isUnlocked ? "" : "badge--locked"}">
                  <div class="badge__icon">${b.icon}</div>
                  <div class="badge__name">${escapeHtml(b.name)}</div>
                  <div class="badge__desc">${escapeHtml(b.desc)}</div>
                </div>`;
            }).join("")}
          </div>

          ${completionCount > 0 ? `
            <div class="card" style="margin-top:16px;text-align:center;padding:14px;">
              <div style="display:flex;justify-content:center;margin-bottom:6px;color:var(--primary);">${TOUR_BADGES[0].icon}</div>
              <div style="font-weight:700;color:var(--primary);">${completionCount} tour${completionCount > 1 ? "s" : ""} accompli${completionCount > 1 ? "s" : ""}</div>
              <div style="font-size:13px;color:var(--ink-faint);margin-top:4px;">Tu continues à creuser la Parole.</div>
            </div>
          ` : ""}
        </div>
      </main>
      ${tabbar("rewards")}
    </div>`;
}

function viewShare() {
  const day = currentDay();
  const reading = readings.find((r) => r.day === getActiveDay());
  const passages = reading ? reading.passages.join(", ") : "Nouveau Testament";
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
            <p class="share-card__msg">Je lis ${escapeHtml(passages)}<br/>dans le Nouveau Testament.</p>
            <p class="share-card__link">${APP_URL}</p>
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
  const installed = isAppInstalled();
  const items = [
    { icon: I.bookmark,  title: "Versets à mémoriser", sub: "Programme et révise tes versets", nav: "memory", accent: true },
    { icon: I.settings,  title: "Paramètres", sub: "Date de début, mode sombre, rappels, contact", nav: "settings" },
    { icon: I.question,  title: "Comment fonctionne Mission 31 ?", sub: "Guide complet, navigation par jour, rappels…", nav: "how" },
    { icon: I.bellSmall, title: "Notifications & rappels", nav: "reminders" },
    !installed && {
      icon: I.install,
      title: "Installer l'application",
      sub: "Accès rapide depuis l'écran d'accueil, fonctionne hors ligne",
      action: "install",
      accent: true,
    },
    installed && {
      icon: I.checkBig.replace('width="42"', 'width="20"').replace('height="42"', 'height="20"'),
      title: "Application installée",
      sub: "Mission 31 fonctionne déjà comme une app native",
    },
  ].filter(Boolean);
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
  const notifSupported = "Notification" in window;
  const notifPerm = notifSupported ? Notification.permission : "unsupported";

  let permBanner = "";
  if (!notifSupported) {
    permBanner = `<div class="notif-banner notif-banner--warn">${I.bell} Notifications non supportées sur ce navigateur.</div>`;
  } else if (notifPerm === "denied") {
    permBanner = `<div class="notif-banner notif-banner--err">${I.bell} Notifications bloquées. Autorise-les dans les réglages de ton navigateur puis reviens ici.</div>`;
  } else if (notifPerm === "default") {
    permBanner = `<div class="notif-banner notif-banner--info">${I.bell} <span>Les notifications ne sont pas encore autorisées.</span> <button class="btn btn--sm" data-action="notif-request">Autoriser</button></div>`;
  } else {
    permBanner = `<div class="notif-banner notif-banner--ok">${I.bell} Notifications autorisées ✓ <button class="btn btn--sm btn--ghost" data-action="notif-test">Tester</button></div>`;
  }

  return `
    <div class="shell">
      ${topbar({
        title: "Rappels",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="reminders">
          ${permBanner}
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
  const count = state.completionCount || 1;
  const isFirst = count === 1;
  const msg = isFirst ? COMPLETION_MESSAGES.first : COMPLETION_MESSAGES.repeat(count);
  const { title, body, cta } = typeof msg === "object" ? msg : { title: "Mission accomplie !", body: msg, cta: "Nouvelle lancée" };

  // Badges de tour débloqués
  const earnedTourBadges = TOUR_BADGES.filter((b) => count >= b.required);

  return `
    <div class="shell">
      ${topbar({
        title: "Mission accomplie !",
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
              <div class="stat-tile__label">Jours complétés</div>
              <div class="stat-tile__value">${completedCount()} / 31</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile__label">Tours accomplis</div>
              <div class="stat-tile__value">${count}</div>
            </div>
          </div>

          ${earnedTourBadges.length > 0 ? `
            <div class="completion__tour-badges">
              <h3 class="completion__tour-badges-title">Badges de fidélité</h3>
              <div class="tour-badge-row">
                ${earnedTourBadges.map((b) => `
                  <div class="tour-badge">
                    <span class="tour-badge__icon">${b.icon}</span>
                    <span class="tour-badge__name">${escapeHtml(b.name)}</span>
                    <span class="tour-badge__desc">${escapeHtml(b.desc)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ""}

          <button class="btn" data-action="new-run">${cta}</button>
          <button class="btn btn--ghost" style="margin-top:10px;" data-nav="home">Retour à l'accueil</button>
        </div>
      </main>
    </div>`;
}

// ============================================================
// Bible reader (Louis Segond 1910 · NT)
// ============================================================
// Construit la file d'attente des chapitres à afficher selon les params :
//   - day=N         → tous les chapitres prévus pour le jour N du plan
//   - b=ID&c=N      → un seul chapitre (lecture libre)
// Sinon : tous les chapitres du jour courant.
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
  const queue = bibleQueueFromParams(params);
  const idx = Math.max(0, Math.min(queue.length - 1, parseInt(params.i, 10) || 0));
  const day = parseInt(params.day, 10) || currentDay();
  const isFreeRead = !!(params.b && params.c);
  const night = state.readerMode === "night";

  const current = queue[idx];
  const title = current ? formatChapterLabel(current.name, current.chapter) : "Lecture";
  const chapterRef = current ? formatChapterLabel(current.name, current.chapter) : "";

  return `
    <div class="shell">
      ${topbar({
        title: title,
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
        rightActions: [
          `<button class="topbar__btn" data-action="reader-mode-toggle" title="${night ? "Mode normal" : "Mode soir"}">${night ? I.sun : I.moon}</button>`,
          `<button class="topbar__btn" data-action="open-note-modal" data-day="${day}" data-chapter="${escapeHtml(chapterRef)}" title="Prendre une note">${I.pen}</button>`,
        ],
      })}
      <main class="view view--bible ${night ? "view--reader-night" : ""}">
        <div class="bible-hint">${I.highlighter} Appuie sur un verset pour le surligner ou prendre une note.</div>
        <div class="bible-reader" id="bibleReader">
          <div class="bible-reader__loading">${I.bookOpen} Chargement du texte...</div>
        </div>

        ${queue.length > 1 ? `
          <div class="bible-nav">
            <button class="bible-nav__btn" ${idx === 0 ? "disabled" : ""} data-bible-nav="prev" data-day="${day}" data-i="${idx - 1}">
              ${I.arrowLeft} <span>Précédent</span>
            </button>
            <span class="bible-nav__pos">${idx + 1} / ${queue.length}</span>
            <button class="bible-nav__btn" ${idx >= queue.length - 1 ? "disabled" : ""} data-bible-nav="next" data-day="${day}" data-i="${idx + 1}">
              <span>Suivant</span> ${I.arrowRight}
            </button>
          </div>
        ` : ""}

        ${!isFreeRead && idx >= queue.length - 1 && queue.length > 0 ? `
          <div class="bible-finish">
            ${state.progress[day]?.done ? `
              <button class="btn btn--reread" data-action="mark-reread-from-bible" data-day="${day}">✓ Valider la relecture</button>
              ${day < 31 ? `<button class="btn" data-nav="bible?day=${day + 1}&i=0">Lire le Jour ${day + 1} →</button>` : ""}
            ` : `
              <button class="btn" data-action="mark-today-from-bible" data-day="${day}">J'ai terminé ma lecture</button>
            `}
          </div>
        ` : ""}
      </main>
      ${tabbar("home")}
    </div>`;
}

function renderBibleContent(params) {
  const container = document.getElementById("bibleReader");
  if (!container) return;
  const queue = bibleQueueFromParams(params);
  if (queue.length === 0) {
    container.innerHTML = `<p class="bible-reader__empty">Aucun passage à afficher.</p>`;
    return;
  }
  const idx = Math.max(0, Math.min(queue.length - 1, parseInt(params.i, 10) || 0));
  const item = queue[idx];
  const verseDay = parseInt(params.day, 10) || currentDay();
  const shouldResume = params.resume === "1";

  loadBible().then((bible) => {
    const verses = getChapterVerses(bible, item.id, item.chapter);
    if (!verses || verses.length === 0) {
      container.innerHTML = `<p class="bible-reader__empty">Texte introuvable pour ${formatChapterLabel(item.name, item.chapter)}.</p>`;
      return;
    }
    const heading = SINGLE_CHAPTER_BOOKS.has(item.name) ? item.name : `${item.name} ${item.chapter}`;
    const chapterLabel = formatChapterLabel(item.name, item.chapter);
    const highlights = state.highlights || {};
    saveLastReading(verseDay, idx, chapterLabel, shouldResume && state.lastReading?.day === verseDay && Number(state.lastReading?.i || 0) === idx ? state.lastReading.scrollY : 0);
    container.innerHTML = `
      <h1 class="bible-reader__title">${heading}</h1>
      <p class="bible-reader__sub">Louis Segond 1910</p>
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
    container.innerHTML = `
      <p class="bible-reader__empty">
        Impossible de charger le texte. Vérifie ta connexion puis réessaie.
      </p>`;
  });
}

// ============================================================
// Memory verses (versets à mémoriser, planifiables)
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
  const list = [...(state.memoryVerses || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const today = todayISO();

  return `
    <div class="shell">
      ${topbar({
        title: "Versets à mémoriser",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="memory">
          <p class="memory__intro">Ajoute autant de versets que tu veux et programme-les pour un jour précis. Le verset du jour s'affichera sur l'accueil.</p>

          <div class="card memory__form">
            <h3 class="memory__form-title">Nouveau verset</h3>
            <div class="field">
              <label for="memDate">Date du jour de mémorisation</label>
              <input type="date" id="memDate" value="${today}" min="${today}"/>
            </div>
            <div class="field">
              <label for="memRef">Référence</label>
              <input type="text" id="memRef" placeholder="ex. Jean 3:16" autocomplete="off"/>
            </div>
            <div class="field">
              <label for="memText">Texte du verset</label>
              <textarea id="memText" rows="3" placeholder="Colle ou écris le verset à mémoriser..."></textarea>
            </div>
            <button class="btn" data-action="memory-add">${I.plus} Ajouter ce verset</button>
          </div>

          <h3 class="memory__list-title">Mes versets (${list.length})</h3>
          ${list.length === 0 ? `
            <div class="card memory__empty">
              <div class="memory__empty-icon">${I.bookmark}</div>
              <p>Aucun verset programmé pour le moment.</p>
            </div>
          ` : list.map((v) => {
            const isToday = v.date === today;
            const isPast = v.date < today;
            return `
              <div class="card memory-card ${isToday ? "memory-card--today" : ""} ${isPast ? "memory-card--past" : ""}">
                <div class="memory-card__head">
                  <span class="memory-card__date">${formatMemoryDate(v.date)} ${isToday ? "· Aujourd'hui" : ""}</span>
                  <button class="memory-card__del" data-action="memory-del" data-id="${v.id}" aria-label="Supprimer">${I.trash}</button>
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
// Notes (prendre des notes, les organiser par jour)
// ============================================================
function viewNotes(params) {
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
        title: filterDay ? `Notes · Jour ${filterDay}` : "Mes notes",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="notes-page">

          ${noteBeingEdited ? `
            <div class="card notes-form notes-form--edit">
              <h3 class="notes-form__title">${I.edit} Modifier la note</h3>
              <div class="field">
                <label for="noteTitle">Titre (optionnel)</label>
                <input type="text" id="noteTitle" placeholder="ex. Réflexion sur la grâce" value="${escapeHtml(noteBeingEdited.title || "")}" autocomplete="off"/>
              </div>
              <div class="field">
                <label for="noteContent">Note</label>
                <textarea id="noteContent" rows="5" placeholder="Écris ta note ici...">${escapeHtml(noteBeingEdited.content)}</textarea>
              </div>
              <div class="notes-form__actions">
                <button class="btn" data-action="note-save-edit" data-id="${editId}">Enregistrer</button>
                <button class="btn btn--ghost" data-action="back">Annuler</button>
              </div>
            </div>
          ` : `
            <div class="card notes-form">
              <h3 class="notes-form__title">${I.pen} Nouvelle note</h3>
              <div class="field">
                <label for="noteDay">Jour</label>
                <select id="noteDay">
                  ${readings.map((r) => `<option value="${r.day}" ${r.day === defaultDay ? "selected" : ""}>${r.day} : ${r.passages.join(", ")}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="noteChapter">Passage (optionnel)</label>
                <input type="text" id="noteChapter" placeholder="ex. Jean 3" autocomplete="off"/>
              </div>
              <div class="field">
                <label for="noteTitle">Titre (optionnel)</label>
                <input type="text" id="noteTitle" placeholder="ex. Ce qui m'a marqué aujourd'hui" autocomplete="off"/>
              </div>
              <div class="field">
                <label for="noteContent">Note</label>
                <textarea id="noteContent" rows="5" placeholder="Écris ta note ici..."></textarea>
              </div>
              <button class="btn" data-action="note-add">Enregistrer la note</button>
            </div>
          `}

          <div class="notes-filter">
            <button class="notes-filter__btn ${!filterDay ? "notes-filter__btn--active" : ""}" data-nav="notes">Tout (${allNotes.length})</button>
            ${readings.filter((r) => notesForDay(r.day).length > 0).map((r) => `
              <button class="notes-filter__btn ${filterDay === r.day ? "notes-filter__btn--active" : ""}" data-nav="notes?day=${r.day}">Jour ${r.day} (${notesForDay(r.day).length})</button>
            `).join("")}
          </div>

          <h3 class="notes-page__section">${filteredNotes.length} note${filteredNotes.length !== 1 ? "s" : ""}${filterDay ? ` · Jour ${filterDay}` : ""}</h3>

          ${filteredNotes.length === 0 ? `
            <div class="card notes-empty">
              <div class="notes-empty__icon">${I.pen}</div>
              <p>Aucune note pour le moment. Commence à écrire pendant ta lecture !</p>
            </div>
          ` : filteredNotes.map((n) => {
            const dateStr = n.createdAt ? formatShortDate(new Date(n.createdAt)) : "";
            const updatedStr = n.updatedAt && n.updatedAt !== n.createdAt ? `· modifié ${formatShortDate(new Date(n.updatedAt))}` : "";
            return `
              <div class="card note-card" id="note-${n.id}">
                <div class="note-card__head">
                  <div class="note-card__meta">
                    <span class="note-card__day">Jour ${n.dayRef || "?"}</span>
                    ${n.chapterRef ? `<span class="note-card__chapter">${escapeHtml(n.chapterRef)}</span>` : ""}
                    <span class="note-card__date">${dateStr} ${updatedStr}</span>
                  </div>
                  <div class="note-card__actions">
                    <button class="note-card__btn" data-nav="notes?edit=${n.id}" title="Modifier">${I.edit}</button>
                    <button class="note-card__btn note-card__btn--del" data-action="note-del" data-id="${n.id}" title="Supprimer">${I.trash}</button>
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
// Comment fonctionne Mission 31 (page dédiée)
// ============================================================
function viewHow() {
  return `
    <div class="shell">
      ${topbar({
        title: "Comment ça marche ?",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view view--no-tabs">
        <div class="how-page">

          <div class="how-hero">
            <div class="how-hero__icon">📖</div>
            <h2 class="how-hero__title">Mission 31</h2>
            <p class="how-hero__sub">Lis tout le Nouveau Testament en seulement 31 jours.<br/>Simple, guidé, communautaire.</p>
          </div>

          <!-- Vue d'ensemble -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bible}</div>
              <h3 class="how-section__title">C'est quoi Mission 31 ?</h3>
            </div>
            <p class="how-section__body">
              Mission 31 est un plan de lecture qui te permet de parcourir <strong>les 27 livres du Nouveau Testament</strong> en exactement 31 jours.
              Chaque jour correspond à un passage précis, soigneusement découpé pour une lecture d'environ <strong>15 à 30 minutes</strong>.
              Tu peux lire à ton rythme, seul ou en groupe.
            </p>
          </div>

          <!-- Comment lire chaque jour -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.tabPlan}</div>
              <h3 class="how-section__title">Comment lire chaque jour</h3>
            </div>
            <ul class="how-steps">
              <li class="how-step">
                <span class="how-step__num">1</span>
                <span class="how-step__text">Ouvre l'app et consulte le <strong>passage du jour</strong> sur l'accueil.</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">2</span>
                <span class="how-step__text">Appuie sur <strong>"Lire"</strong> pour accéder au texte intégral dans l'app (Louis Segond 1910).</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">3</span>
                <span class="how-step__text">Lis le passage, surligne des versets et prends des <strong>notes</strong> si tu le souhaites.</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">4</span>
                <span class="how-step__text">Appuie sur <strong>"J'ai terminé ma lecture"</strong> pour valider le jour et gagner un badge.</span>
              </li>
            </ul>
            <div class="how-tip">💡 Tu peux aussi valider ta lecture depuis l'accueil sans passer par le lecteur intégré.</div>
          </div>

          <!-- Lecture du jour suivant -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bolt}</div>
              <h3 class="how-section__title">Lecture du jour suivant</h3>
            </div>
            <p class="how-section__body" style="margin-bottom:10px;">
              Après avoir validé un jour, tu peux continuer sur le jour suivant directement depuis l'accueil.
              Le bouton <strong>Lire le jour suivant</strong> reste disponible tant que des jours sont ouverts.
            </p>
            <ul class="how-steps">
              <li class="how-step">
                <span class="how-step__num">1</span>
                <span class="how-step__text">Valide ta lecture du jour courant.</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">2</span>
                <span class="how-step__text">Le jour suivant devient disponible automatiquement.</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">3</span>
                <span class="how-step__text">Tu peux ensuite lire Jour 3, Jour 4, etc., jusqu'à la fin de la mission.</span>
              </li>
            </ul>
            <div class="how-tip">➡️ La navigation se met à jour jour après jour : tu peux avancer autant que nécessaire.</div>
          </div>

          <!-- Versets à mémoriser -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bookmark}</div>
              <h3 class="how-section__title">Versets à mémoriser</h3>
            </div>
            <p class="how-section__body">
              Tu peux enregistrer des versets que tu veux retenir pour un jour précis.
              Le verset sélectionné s'affiche ensuite sur l'accueil le jour choisi, pour t'aider à le revoir et à le mémoriser.
            </p>
            <ul class="how-steps">
              <li class="how-step">
                <span class="how-step__num">1</span>
                <span class="how-step__text">Ouvre l'onglet <strong>Versets à mémoriser</strong> depuis l'aide ou le menu.</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">2</span>
                <span class="how-step__text">Ajoute la référence, le texte et la date de mémorisation.</span>
              </li>
              <li class="how-step">
                <span class="how-step__num">3</span>
                <span class="how-step__text">Le verset s'affichera automatiquement sur l'accueil le jour choisi.</span>
              </li>
            </ul>
            <div class="how-tip">📌 C'est un moyen simple de garder un verset important présent dans ta journée de lecture.</div>
          </div>

          <!-- Surlignage et notes -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.pen}</div>
              <h3 class="how-section__title">Notes &amp; surlignage</h3>
            </div>
            <p class="how-section__body">
              Dans le lecteur de Bible intégré, <strong>appuie sur n'importe quel verset</strong> pour l'annoter ou le surligner en jaune, vert, bleu ou rose.
              Tes notes sont organisées par jour de lecture et restent accessibles depuis les raccourcis du lecteur et des statistiques.
            </p>
          </div>

          <!-- Rappels -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.bell}</div>
              <h3 class="how-section__title">Rappels &amp; notifications</h3>
            </div>
            <p class="how-section__body" style="margin-bottom:10px;">
              Active les rappels pour ne jamais oublier ta lecture du jour. Tu peux configurer <strong>jusqu'à 4 heures de rappel</strong> personnalisées et un message motivant.
            </p>
            <button class="btn btn--ghost" data-nav="reminders">Configurer mes rappels →</button>
          </div>

          <!-- Badges & progression -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.tabRewards}</div>
              <h3 class="how-section__title">Badges &amp; progression</h3>
            </div>
            <p class="how-section__body">
              À chaque jour validé, tu progresses et débloques des <strong>badges</strong> de progression, de fidélité et spéciaux.
              Tu peux suivre ton avancement dans l'onglet Stats et partager ta progression avec ta communauté via WhatsApp.
            </p>
          </div>

          <!-- Multi-appareils -->
          <div class="how-section">
            <div class="how-section__header">
              <div class="how-section__icon">${I.tabStats}</div>
              <h3 class="how-section__title">Relire &amp; recommencer</h3>
            </div>
            <p class="how-section__body">
              Une fois les 31 jours terminés, tu peux <strong>relancer une nouvelle mission</strong> pour approfondir ta lecture.
              Chaque passage peut aussi être relu pour en extraire de nouvelles richesses, et les relectures sont comptabilisées séparément.
            </p>
          </div>

          <button class="btn" data-nav="home">Commencer ma lecture →</button>

        </div>
      </main>
    </div>`;
}

// ============================================================
// Settings (date de début personnalisée + thème)
// ============================================================
function viewSettings() {
  const startISO = state.startedAt
    ? new Date(state.startedAt).toISOString().slice(0, 10)
    : todayISO();
  const theme = state.theme || "auto";

  return `
    <div class="shell">
      ${topbar({
        title: "Paramètres",
        leftAction: `<button class="topbar__btn" data-action="back">${I.back}</button>`,
      })}
      <main class="view">
        <div class="settings">

          <div class="card">
            <h3 class="settings__section-title">${I.cal} Date de début</h3>
            <p class="settings__section-sub">Synchronise ton plan de lecture avec ton groupe en choisissant la date du jour 1.</p>
            <div class="field">
              <label for="startDate">Jour 1 de la mission</label>
              <input type="date" id="startDate" value="${startISO}"/>
            </div>
            <button class="btn" data-action="start-date-save">Enregistrer la date</button>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.moon} Apparence</h3>
            <p class="settings__section-sub">Choisis l'apparence qui te convient le mieux pour la lecture.</p>
            <div class="theme-options">
              <button class="theme-opt ${theme === "light" ? "theme-opt--active" : ""}" data-action="theme-set" data-theme="light">
                ${I.sun}<span>Clair</span>
              </button>
              <button class="theme-opt ${theme === "dark" ? "theme-opt--active" : ""}" data-action="theme-set" data-theme="dark">
                ${I.moon}<span>Sombre</span>
              </button>
              <button class="theme-opt ${theme === "auto" ? "theme-opt--active" : ""}" data-action="theme-set" data-theme="auto">
                ${I.settings}<span>Auto</span>
              </button>
            </div>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.bell} Notifications &amp; rappels</h3>
            <p class="settings__section-sub">Configure tes heures de rappel pour ne jamais oublier ta lecture du jour.</p>
            <button class="btn btn--ghost" data-nav="reminders">Gérer mes rappels →</button>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.download} Sauvegarde</h3>
            <p class="settings__section-sub">Exporte ta progression, tes notes, tes versets et tes surlignages dans un fichier JSON.</p>
            <button class="btn btn--ghost" data-action="export-data">${I.download} Exporter mes données</button>
          </div>

          <div class="card">
            <h3 class="settings__section-title">${I.mail} Contact &amp; communauté</h3>
            <p class="settings__section-sub">Une question, un bug ou une suggestion ? Contacte le développeur ou rejoins la communauté.</p>
            <a class="settings-contact-row" href="mailto:${CONTACT_EMAIL}?subject=Mission%2031">
              <div class="settings-contact-row__icon">${I.mail}</div>
              <div class="settings-contact-row__body">
                <div class="settings-contact-row__title">Contacter le développeur</div>
                <div class="settings-contact-row__sub">${CONTACT_EMAIL}</div>
              </div>
            </a>
            <a class="settings-contact-row" href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer">
              <div class="settings-contact-row__icon">${I.whatsapp}</div>
              <div class="settings-contact-row__body">
                <div class="settings-contact-row__title">Groupe WhatsApp Mission 31</div>
                <div class="settings-contact-row__sub">Rejoins la communauté</div>
              </div>
            </a>
          </div>

          <div class="card settings__danger">
            <h3 class="settings__section-title">Réinitialisation</h3>
            <p class="settings__section-sub">Efface ta progression et recommence la mission à zéro.</p>
            <button class="btn btn--ghost" data-action="reset">Réinitialiser ma mission</button>
          </div>

        </div>
      </main>
      ${tabbar("help")}
    </div>`;
}

// Petit helper de sécurité pour éviter d'injecter du HTML utilisateur.
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

  // Hooks après-rendu (chargements asynchrones par vue)
  if (route === "bible") {
    renderBibleContent(r.params || {});
  } else if (route === "stats") {
    refreshGlobalStats();
  }
}

// ------------------------------------------------------------
// Thème (clair / sombre / auto)
// ------------------------------------------------------------
function applyTheme() {
  const t = state.theme || "auto";
  const root = document.documentElement;
  let effective = t;
  if (t === "auto") {
    effective = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }
  root.setAttribute("data-theme", effective);
}
// Re-applique le thème quand l'OS change de mode (uniquement en "auto").
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
  // Fermer un éventuel popover existant
  document.getElementById("versePopover")?.remove();

  if (!state.highlights) state.highlights = {};
  const currentColor = state.highlights[hKey] || "";
  const colors = ["yellow", "green", "blue", "pink"];
  const colorLabels = { yellow: "🟡", green: "🟢", blue: "🔵", pink: "🩷" };
  const colorNames = { yellow: "Jaune", green: "Vert", blue: "Bleu", pink: "Rose" };

  const pop = document.createElement("div");
  pop.id = "versePopover";
  pop.className = "verse-pop";

  // Position : juste au-dessus ou en dessous du verset
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
      ${currentColor ? `<button class="verse-pop__clear" data-vpcolor="" title="Retirer">✕</button>` : ""}
    </div>
    <button class="verse-pop__note" data-vpnote="${day}" data-vpchapter="${escapeHtml(chapterRef)}">
      ✏️ Note
    </button>`;

  document.body.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add("verse-pop--visible"));

  // Surlignage
  pop.querySelectorAll("[data-vpcolor]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const color = btn.dataset.vpcolor;
      if (color) {
        state.highlights[hKey] = color;
        showToast(colorNames[color]);
      } else {
        delete state.highlights[hKey];
        showToast(TOASTS.highlightRemoved);
      }
      saveState();
      // Mettre à jour la classe du verset
      const verseP = document.querySelector(`[data-hkey="${hKey}"]`);
      if (verseP) {
        colors.forEach((c) => verseP.classList.remove(`bv--hl-${c}`));
        if (color) verseP.classList.add(`bv--hl-${color}`);
      }
      pop.remove();
    });
  });

  // Note
  const noteBtn = pop.querySelector("[data-vpnote]");
  if (noteBtn) {
    noteBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      pop.remove();
      showNoteModal(parseInt(noteBtn.dataset.vpnote, 10) || currentDay(), noteBtn.dataset.vpchapter || "");
    });
  }
}

// Fermer le popover en cliquant en dehors
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

  // Navigation chapitre suivant/précédent dans le lecteur Bible
  const bnavEl = e.target.closest("[data-bible-nav]");
  if (bnavEl && !bnavEl.disabled) {
    const day = bnavEl.dataset.day;
    const i = bnavEl.dataset.i;
    navigate(`bible?day=${day}&i=${i}`);
    return;
  }

  const accEl = e.target.closest("[data-acc]");
  if (accEl && !accEl.disabled) { window.__accSelection = Number(accEl.dataset.acc); render(); return; }

  const actionEl = e.target.closest("[data-action]");
  if (actionEl) {
    handleAction(actionEl);
    return;
  }

  // Lignes du planning : navigue vers la lecture du jour sélectionné
  const dayEl = e.target.closest("[data-day]");
  if (dayEl) {
    const day = parseInt(dayEl.dataset.day, 10);
    if (day) navigate(`bible?day=${day}&i=0`);
    return;
  }
});

function handleAction(actionEl) {
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
      if (!("Notification" in window)) { showToast("Notifications non supportées."); break; }
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") { scheduleReminders(); render(); showToast("Notifications activées !"); }
        else if (perm === "denied") { render(); showToast("Permission refusée. Modifie les réglages du navigateur."); }
      });
      break;
    }
    case "notif-test": {
      if (!("Notification" in window) || Notification.permission !== "granted") {
        showToast("Autorise d'abord les notifications."); break;
      }
      const opts = { body: "Ceci est un test. Mission 31 fonctionne !", icon: "./icons/icon-192.png", tag: "mission31-test" };
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => reg.showNotification("Mission 31", opts));
      } else { new Notification("Mission 31", opts); }
      showToast("Notification test envoyée !");
      break;
    }
    case "share-whatsapp": {
      const txt = encodeURIComponent(`Je suis la mission #Mission31 ! Jour ${currentDay()}/31. Je lis le Nouveau Testament en 31 jours. Rejoins-moi : ${APP_URL}`);
      window.open(`https://wa.me/?text=${txt}`, "_blank");
      break;
    }
    case "share-native": {
      shareWithImage().catch(() => {});
      break;
    }
    case "reset":
      if (confirm("Réinitialiser toutes les données ? Cette action est irréversible.")) {
        state = { ...defaultState };
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
      if (!content) { showToast("La note ne peut pas être vide."); break; }
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
      showToast("Note enregistrée !");
      break;
    }
    // ------------------------------------------------------
    // Versets à mémoriser
    // ------------------------------------------------------
    case "memory-add": {
      const date = document.getElementById("memDate")?.value || todayISO();
      const ref = (document.getElementById("memRef")?.value || "").trim();
      const text = (document.getElementById("memText")?.value || "").trim();
      if (!ref || !text) {
        showToast("Référence et texte du verset requis.");
        break;
      }
      state.memoryVerses.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date, ref, text,
        addedAt: new Date().toISOString(),
      });
      saveState();
      showToast("Verset ajouté !");
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
    // ------------------------------------------------------
    // Paramètres : date de début + thème
    // ------------------------------------------------------
    case "start-date-save": {
      const v = document.getElementById("startDate")?.value;
      if (!v) { showToast("Choisis une date valide."); break; }
      const [y, m, d] = v.split("-").map((n) => parseInt(n, 10));
      if (!y || !m || !d) { showToast("Date invalide."); break; }
      const newStart = new Date(y, m - 1, d, 0, 0, 0).toISOString();
      state.startedAt = newStart;
      saveState();
      showToast("Date de début mise à jour.");
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
    // ------------------------------------------------------
    // Notes
    // ------------------------------------------------------
    case "note-add": {
      const dayRef = parseInt(document.getElementById("noteDay")?.value, 10) || currentDay();
      const chapterRef = (document.getElementById("noteChapter")?.value || "").trim();
      const noteTitle = (document.getElementById("noteTitle")?.value || "").trim();
      const content = (document.getElementById("noteContent")?.value || "").trim();
      if (!content) { showToast("La note ne peut pas être vide."); break; }
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
      showToast("Note enregistrée !");
      navigate(`notes?day=${dayRef}`);
      break;
    }
    case "note-del": {
      const id = actionEl.dataset.id;
      if (!id) break;
      if (confirm("Supprimer cette note ?")) {
        state.notes = (state.notes || []).filter((n) => n.id !== id);
        saveState();
        showToast("Note supprimée.");
        render();
      }
      break;
    }
    case "note-save-edit": {
      const id = actionEl.dataset.id;
      const noteTitle = (document.getElementById("noteTitle")?.value || "").trim();
      const content = (document.getElementById("noteContent")?.value || "").trim();
      if (!content) { showToast("La note ne peut pas être vide."); break; }
      const note = noteById(id);
      if (!note) break;
      note.title = noteTitle || null;
      note.content = content;
      note.updatedAt = new Date().toISOString();
      saveState();
      showToast("Note mise à jour !");
      navigate(`notes${note.dayRef ? `?day=${note.dayRef}` : ""}`);
      break;
    }
    // ------------------------------------------------------
    // Popover verset : surlignage + note
    // ------------------------------------------------------
    case "verse-menu": {
      const hKey = actionEl.dataset.hkey;
      const verseDay = parseInt(actionEl.dataset.day, 10) || currentDay();
      const chapterRef = actionEl.dataset.chapter || "";
      if (!hKey) break;
      showVerseMenu(hKey, verseDay, chapterRef, actionEl);
      break;
    }
    // Open note modal from Bible reader
    case "open-note-modal": {
      const day = parseInt(actionEl.dataset.day, 10) || currentDay();
      const chapter = actionEl.dataset.chapter || "";
      showNoteModal(day, chapter);
      break;
    }
    // ------------------------------------------------------
    // Validation depuis le lecteur Bible
    // ------------------------------------------------------
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
    // ------------------------------------------------------
    // Validation d'une relecture depuis le lecteur Bible
    // ------------------------------------------------------
    case "mark-reread-from-bible": {
      const day = parseInt(actionEl.dataset.day, 10) || currentDay();
      markReRead(day);
      break;
    }
    // ------------------------------------------------------
    // Nouvelle lancée (reset progression, garde l'historique)
    // ------------------------------------------------------
    case "new-run": {
      if (confirm("Démarrer une nouvelle lancée ? Ta progression sera remise à zéro mais ton historique de tours est conservé.")) {
        const savedCount = state.completionCount || 0;
        const savedReReads = state.reReads || {};
        state = { ...defaultState };
        state.completionCount = savedCount;
        state.reReads = savedReReads;
        saveState();
        showToast(TOASTS.newRunStarted);
        navigate("welcome");
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// PWA install prompt + barre de progression d'installation
// L'option d'installation reste TOUJOURS accessible :
//   - via la bannière flottante (sur toutes les pages, sauf si déjà installé
//     ou rejetée pour la session)
//   - via la page Aide ("Installer l'application")
//   - via une modale d'instructions sur iOS (où il n'y a pas de prompt natif).
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
        showInstallProgress(0, 1, "Installation en cours...");
        await markInstalled();
        globalStatsLoadedAt = 0;
        refreshGlobalStats();
      } else {
        hideInstallProgress();
      }
      // Si accepté, le SW va envoyer ses propres événements de progression.
    });
    return;
  }
  // Pas de prompt natif disponible : on guide l'utilisateur.
  if (isIOS()) {
    showInstallModal({
      title: "Installer sur iPhone / iPad",
      steps: [
        "Appuie sur le bouton <strong>Partager</strong> en bas de Safari (l'icône carrée avec une flèche vers le haut).",
        "Fais défiler puis choisis <strong>« Sur l'écran d'accueil »</strong>.",
        "Confirme avec <strong>« Ajouter »</strong> en haut à droite.",
      ],
      note: "L'app apparaîtra avec son icône, comme une vraie application.",
    });
  } else if (isAndroid()) {
    showInstallModal({
      title: "Installer sur Android",
      steps: [
        "Ouvre le <strong>menu</strong> de ton navigateur (les trois points en haut à droite).",
        "Choisis <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.",
        "Confirme avec <strong>« Installer »</strong>.",
      ],
      note: "Si l'option n'apparaît pas, ouvre le site dans Chrome.",
    });
  } else {
    showInstallModal({
      title: "Installer l'application",
      steps: [
        "Ouvre le menu de ton navigateur.",
        "Cherche <strong>« Installer Mission 31 »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.",
        "Confirme l'installation.",
      ],
      note: "L'app fonctionnera ensuite comme une application native, même hors ligne.",
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
  el.setAttribute("aria-label", "Installer Mission 31");
  el.innerHTML = `
    <span class="install-banner__icon">${I.install}</span>
    <div class="install-banner__body">
      <div class="install-banner__title">Installer Mission 31</div>
      <div class="install-banner__sub">Lis hors ligne, où tu veux.</div>
    </div>
    <button data-action="install">Installer</button>
    <button class="install-banner__close" data-action="install-dismiss" aria-label="Masquer">${I.close}</button>
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
      <button class="btn" data-action="modal-close">J'ai compris</button>
    </div>
  `;
  document.body.appendChild(el);
}

// -------------------------------------------------------
// Modale de prise de note rapide (depuis le lecteur Bible)
// -------------------------------------------------------
function showNoteModal(day, chapterRef) {
  document.querySelector(".note-modal")?.remove();
  const el = document.createElement("div");
  el.className = "modal note-modal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Nouvelle note");
  el.innerHTML = `
    <div class="modal__backdrop" data-action="modal-close"></div>
    <div class="modal__card">
      <h3 class="modal__title">${I.pen} Note rapide</h3>
      ${chapterRef ? `<p style="font-size:13px;color:var(--ink-faint);margin:0 0 10px;">${escapeHtml(chapterRef)}</p>` : ""}
      <div class="field">
        <label for="quickNoteTitle">Titre (optionnel)</label>
        <input type="text" id="quickNoteTitle" placeholder="ex. Ce verset m'interpelle…" autocomplete="off"/>
      </div>
      <div class="field">
        <label for="quickNoteContent">Ma note</label>
        <textarea id="quickNoteContent" rows="4" placeholder="Écris tes réflexions, insights..."></textarea>
      </div>
      <button class="btn" data-action="quick-note-save" data-day="${day}" data-chapter="${escapeHtml(chapterRef)}">Enregistrer</button>
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
  setTimeout(() => {
    window.location.reload();
  }, 500);
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
        <div class="install-progress__title">Installation en cours</div>
        <div class="install-progress__sub" id="ipsub">${label || "Préparation du mode hors ligne..."}</div>
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

// Affiche la progression au tout premier chargement (cache initial du SW),
// uniquement si rien n'est encore en cache (vraie première visite).
async function maybeShowFirstInstallProgress() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  try {
    const keys = await caches.keys();
    const hasCache = keys.some((k) => k.startsWith("mission31"));
    installMode = hasCache ? "update" : "install";
    if (hasCache) return; // déjà installé ou déjà visité, pas besoin d'une installation initiale
    showInstallProgress(0, 1, "Préparation du mode hors ligne...");
  } catch { /* noop */ }
}

// ------------------------------------------------------------
// Rappels quotidiens (Notification API, planifié pendant que l'app est ouverte)
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
    const tid = setTimeout(() => {
      fireReminder();
      // Replanifie pour le lendemain
      scheduleReminders();
    }, delay);
    reminderTimers.push(tid);
  });
}

function fireReminder() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const day = currentDay();
  // Si aujourd'hui est déjà fait, on n'ennuie pas l'utilisateur.
  if (state.progress[day]?.done) return;
  const passages = passagesText(day);
  const body = `${state.reminders.message} Jour ${day}/31 · ${passages}`;
  const opts = {
    body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "mission31-daily",
    requireInteraction: false,
  };
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification("Mission 31", opts));
    } else {
      new Notification("Mission 31", opts);
    }
  } catch { /* ignore */ }
}

// ------------------------------------------------------------
// Partage enrichi : génère une image canvas du share-card
// et la transmet via la Web Share API (avec fallback texte).
// ------------------------------------------------------------
async function shareWithImage(options = {}) {
  const day = currentDay();
  const text = options.text || `Je suis la mission #Mission31 ! Jour ${day}/31. Je lis le Nouveau Testament en 31 jours. ${APP_URL}`;
  let file = null;
  try {
    const blob = await renderShareImage(day);
    if (blob) file = new File([blob], `mission31-jour-${day}.png`, { type: "image/png" });
  } catch { /* fallback text-only */ }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Mission 31",
        text,
        files: [file],
      });
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
  // Fallback ultime : copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(`${text} ${APP_URL}`);
    showToast("Lien copié dans le presse-papier !");
  } catch {
    showToast("Partage indisponible.");
  }
}

function renderShareImage(day) {
  return new Promise((resolve) => {
    const W = 720, H = 720;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);

    // Fond dégradé teal
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a2e2e");
    grad.addColorStop(1, "#0e3838");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Cadre intérieur
    ctx.strokeStyle = "rgba(207, 230, 230, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // Icône bible (dessin vectoriel simple)
    ctx.save();
    ctx.translate(W / 2, 180);
    ctx.strokeStyle = "#cfe6e6";
    ctx.fillStyle = "#0a2e2e";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Livre
    ctx.beginPath();
    ctx.moveTo(-50, -60);
    ctx.lineTo(60, -60);
    ctx.lineTo(60, 60);
    ctx.lineTo(-50, 60);
    ctx.arcTo(-65, 60, -65, 50, 12);
    ctx.lineTo(-65, -45);
    ctx.arcTo(-65, -60, -50, -60, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Croix
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(0, 25);
    ctx.moveTo(-20, -10);
    ctx.lineTo(20, -10);
    ctx.stroke();
    ctx.restore();

    // Titre MISSION 31
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "700 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("MISSION 31", W / 2, 320);

    // Jour X / 31
    ctx.fillStyle = "#2d8a8a";
    ctx.font = "600 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(`JOUR ${day} / 31`, W / 2, 380);

    // Message
    ctx.fillStyle = "#cfe6e6";
    ctx.font = "400 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const lines = [
      "Je suis la mission",
      "et je lis le Nouveau Testament",
      "en 31 jours.",
    ];
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 460 + i * 42));

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "500 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(APP_URL.replace(/^https?:\/\//, ""), W / 2, 600);

    // Tag
    ctx.fillStyle = "#f7b955";
    ctx.font = "700 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("#Mission31", W / 2, 655);

    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

// ------------------------------------------------------------
// Service Worker registration + écoute des événements de cache
// ------------------------------------------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "sw-cache-progress") {
      const label = installMode === "update" ? "Mise à jour en cours..." : "Installation en cours...";
      showInstallProgress(data.done, data.total, label);
    } else if (data.type === "sw-cache-done") {
      const label = installMode === "update" ? "Mise à jour terminée !" : "Installation terminée !";
      showInstallProgress(data.total, data.total, label);
      setTimeout(hideInstallProgress, 800);
    }
  });

  window.addEventListener("load", () => {
    maybeShowFirstInstallProgress();
    const swUrl = new URL("./sw.js", document.baseURI).href;
    navigator.serviceWorker.register(swUrl, { scope: new URL("./", document.baseURI).pathname })
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
attachInstallBanner(); // affiche la bannière même sans beforeinstallprompt (iOS, etc.)
registerUser(completedCount()).then((registered) => {
  // Après un enregistrement confirmé, on force les stats à se relire une fois.
  if (registered && getRoute().name === "stats") {
    globalStatsLoadedAt = 0;
    refreshGlobalStats();
  }
}); // synchronisation anonyme si Supabase est configuré (silencieux)
if (isAppInstalled()) {
  markInstalled();
}
scheduleReminders();   // planifie les notifications si déjà autorisées

// Demande la permission de notification après 5 s si reminders.enabled
// et que la permission n'a pas encore été accordée ou refusée.
if (state.reminders?.enabled && "Notification" in window) {
  setTimeout(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") scheduleReminders();
      });
    }
  }, 5000);
}

// Re-planifie les rappels au retour de l'app au premier plan.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleReminders();
});
