// ============================================================
// Bible — Louis Segond 1910 (FR) + King James Version (EN)
// Nouveau Testament uniquement (livres 40-66)
// ============================================================

// ── Mapping français livre → id ──────────────────────────────
export const BOOK_IDS = {
  "Matthieu": 40, "Marc": 41, "Luc": 42, "Jean": 43, "Actes": 44,
  "Romains": 45, "1 Corinthiens": 46, "2 Corinthiens": 47,
  "Galates": 48, "Éphésiens": 49, "Philippiens": 50, "Colossiens": 51,
  "1 Thessaloniciens": 52, "2 Thessaloniciens": 53,
  "1 Timothée": 54, "2 Timothée": 55, "Tite": 56, "Philémon": 57,
  "Hébreux": 58, "Jacques": 59, "1 Pierre": 60, "2 Pierre": 61,
  "1 Jean": 62, "2 Jean": 63, "3 Jean": 64, "Jude": 65, "Apocalypse": 66,
};

// ── Mapping anglais livre → id ───────────────────────────────
export const BOOK_IDS_EN = {
  "Matthew": 40, "Mark": 41, "Luke": 42, "John": 43, "Acts": 44,
  "Romans": 45, "1 Corinthians": 46, "2 Corinthians": 47,
  "Galatians": 48, "Ephesians": 49, "Philippians": 50, "Colossians": 51,
  "1 Thessalonians": 52, "2 Thessalonians": 53,
  "1 Timothy": 54, "2 Timothy": 55, "Titus": 56, "Philemon": 57,
  "Hebrews": 58, "James": 59, "1 Peter": 60, "2 Peter": 61,
  "1 John": 62, "2 John": 63, "3 John": 64, "Jude": 65, "Revelation": 66,
};

// ── Traduction FR → EN ───────────────────────────────────────
export const FR_TO_EN = {
  "Matthieu": "Matthew", "Marc": "Mark", "Luc": "Luke",
  "Jean": "John", "Actes": "Acts", "Romains": "Romans",
  "1 Corinthiens": "1 Corinthians", "2 Corinthiens": "2 Corinthians",
  "Galates": "Galatians", "Éphésiens": "Ephesians",
  "Philippiens": "Philippians", "Colossiens": "Colossians",
  "1 Thessaloniciens": "1 Thessalonians", "2 Thessaloniciens": "2 Thessalonians",
  "1 Timothée": "1 Timothy", "2 Timothée": "2 Timothy",
  "Tite": "Titus", "Philémon": "Philemon",
  "Hébreux": "Hebrews", "Jacques": "James",
  "1 Pierre": "1 Peter", "2 Pierre": "2 Peter",
  "1 Jean": "1 John", "2 Jean": "2 John", "3 Jean": "3 John",
  "Jude": "Jude", "Apocalypse": "Revelation",
};

// ── Livres à un seul chapitre ────────────────────────────────
export const SINGLE_CHAPTER_BOOKS = new Set(["Philémon", "2 Jean", "3 Jean", "Jude"]);
export const SINGLE_CHAPTER_BOOKS_EN = new Set(["Philemon", "2 John", "3 John", "Jude"]);

// ── Ordre des livres NT ──────────────────────────────────────
export const NT_BOOKS_ORDER = Object.keys(BOOK_IDS);

// ── Traduit un nom de livre FR → EN (ou retourne le nom tel quel) ──
export function translateBookName(frName, lang) {
  if (lang !== "en") return frName;
  return FR_TO_EN[frName] || frName;
}

// ── Traduit un passage complet, ex. "Matthieu 1-9" → "Matthew 1-9" ──
export function translatePassage(passage, lang) {
  if (lang !== "en") return passage;
  const sortedFR = Object.keys(BOOK_IDS).sort((a, b) => b.length - a.length);
  for (const frName of sortedFR) {
    if (passage === frName || passage.startsWith(frName + " ")) {
      const rest = passage.slice(frName.length);
      return (FR_TO_EN[frName] || frName) + rest;
    }
  }
  return passage;
}

// ── Chargement lazy des Bibles ───────────────────────────────
let _bibleCacheFR = null;
let _bibleCacheEN = null;
let _bibleLoadingFR = null;
let _bibleLoadingEN = null;

export function loadBible() {
  return loadBibleForLang("fr");
}

export function loadBibleForLang(lang) {
  if (lang === "en") {
    if (_bibleCacheEN) return Promise.resolve(_bibleCacheEN);
    if (_bibleLoadingEN) return _bibleLoadingEN;
    _bibleLoadingEN = fetch("./bible/kjv-nt.json")
      .then((r) => {
        if (!r.ok) throw new Error("KJV Bible not found (HTTP " + r.status + ")");
        return r.json();
      })
      .then((data) => {
        _bibleCacheEN = data;
        _bibleLoadingEN = null;
        return data;
      })
      .catch((err) => {
        _bibleLoadingEN = null;
        throw err;
      });
    return _bibleLoadingEN;
  }
  // FR (default)
  if (_bibleCacheFR) return Promise.resolve(_bibleCacheFR);
  if (_bibleLoadingFR) return _bibleLoadingFR;
  _bibleLoadingFR = fetch("./bible/lsg-nt.json")
    .then((r) => {
      if (!r.ok) throw new Error("Bible introuvable (HTTP " + r.status + ")");
      return r.json();
    })
    .then((data) => {
      _bibleCacheFR = data;
      _bibleLoadingFR = null;
      return data;
    })
    .catch((err) => {
      _bibleLoadingFR = null;
      throw err;
    });
  return _bibleLoadingFR;
}

export function isBibleLoaded() {
  return _bibleCacheFR !== null || _bibleCacheEN !== null;
}

// ── Parse une référence de passage (toujours en FR, format interne) ──
export function parsePassage(ref) {
  if (!ref || typeof ref !== "string") return null;
  const trimmed = ref.trim();
  const sortedBooks = Object.keys(BOOK_IDS).sort((a, b) => b.length - a.length);
  let bookName = null;
  for (const name of sortedBooks) {
    if (trimmed === name) { bookName = name; break; }
    if (trimmed.startsWith(name) && (trimmed[name.length] === " " || trimmed[name.length] === undefined)) {
      bookName = name;
      break;
    }
  }
  if (!bookName) return null;

  const id = BOOK_IDS[bookName];
  const rest = trimmed.slice(bookName.length).trim();

  if (!rest) {
    return { id, name: bookName, chapters: [1] };
  }

  const m = rest.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const end = m[2] ? parseInt(m[2], 10) : start;
  if (start < 1 || end < start) return null;

  const chapters = [];
  for (let c = start; c <= end; c++) chapters.push(c);
  return { id, name: bookName, chapters };
}

// ── Retourne la liste de versets pour un livre+chapitre ──────
export function getChapterVerses(bible, bookId, chapter) {
  if (!bible || !bible.text) return [];
  const book = bible.text[bookId];
  if (!book) return [];
  return book[chapter] || [];
}

// ── Génère la liste plate des chapitres d'un passage du plan ─
export function expandPassages(passages) {
  const out = [];
  for (const p of passages) {
    const parsed = parsePassage(p);
    if (!parsed) continue;
    for (const ch of parsed.chapters) {
      out.push({ id: parsed.id, name: parsed.name, chapter: ch });
    }
  }
  return out;
}

// ── Affichage d'un titre de chapitre ─────────────────────────
export function formatChapterLabel(name, chapter, lang) {
  const singleFR = SINGLE_CHAPTER_BOOKS.has(name);
  const singleEN = SINGLE_CHAPTER_BOOKS_EN.has(name);
  if (singleFR || singleEN) return name;
  return `${name} ${chapter}`;
}
