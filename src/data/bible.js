// ============================================================
// Bible Louis Segond 1910 (Nouveau Testament)
// Le texte est servi en JSON depuis /public/bible/lsg-nt.json
// (mis en cache par le service worker pour la lecture hors ligne).
// ============================================================

// Mapping nom français du livre → identifiant numérique (40-66, NT uniquement).
// Les noms doivent correspondre EXACTEMENT à ceux utilisés dans readings.js.
export const BOOK_IDS = {
  "Matthieu": 40, "Marc": 41, "Luc": 42, "Jean": 43, "Actes": 44,
  "Romains": 45, "1 Corinthiens": 46, "2 Corinthiens": 47,
  "Galates": 48, "Éphésiens": 49, "Philippiens": 50, "Colossiens": 51,
  "1 Thessaloniciens": 52, "2 Thessaloniciens": 53,
  "1 Timothée": 54, "2 Timothée": 55, "Tite": 56, "Philémon": 57,
  "Hébreux": 58, "Jacques": 59, "1 Pierre": 60, "2 Pierre": 61,
  "1 Jean": 62, "2 Jean": 63, "3 Jean": 64, "Jude": 65, "Apocalypse": 66,
};

// Livres NT à un seul chapitre (la référence n'inclut donc pas de numéro).
export const SINGLE_CHAPTER_BOOKS = new Set(["Philémon", "2 Jean", "3 Jean", "Jude"]);

// Liste ordonnée des livres NT (utile pour navigation chapitre suivant/précédent).
export const NT_BOOKS_ORDER = Object.keys(BOOK_IDS);

// ------------------------------------------------------------
// Chargement paresseux & mise en cache locale du JSON LSG.
// ------------------------------------------------------------
let _bibleCache = null;
let _bibleLoading = null;

export function loadBible() {
  if (_bibleCache) return Promise.resolve(_bibleCache);
  if (_bibleLoading) return _bibleLoading;
  _bibleLoading = fetch("./bible/lsg-nt.json")
    .then((r) => {
      if (!r.ok) throw new Error("Bible introuvable (HTTP " + r.status + ")");
      return r.json();
    })
    .then((data) => {
      _bibleCache = data;
      _bibleLoading = null;
      return data;
    })
    .catch((err) => {
      _bibleLoading = null;
      throw err;
    });
  return _bibleLoading;
}

export function isBibleLoaded() {
  return _bibleCache !== null;
}

// ------------------------------------------------------------
// Parse une référence de passage du plan de lecture.
// Exemples acceptés :
//   "Matthieu 1-9"       → { id:40, name:"Matthieu", chapters:[1..9] }
//   "Apocalypse 22"      → { id:66, name:"Apocalypse", chapters:[22] }
//   "Philémon"           → { id:57, name:"Philémon", chapters:[1] }
//   "1 Corinthiens 3-11" → { id:46, name:"1 Corinthiens", chapters:[3..11] }
// Renvoie null si la référence est inconnue.
// ------------------------------------------------------------
export function parsePassage(ref) {
  if (!ref || typeof ref !== "string") return null;
  const trimmed = ref.trim();

  // On essaie les noms de livres dans l'ordre du plus long au plus court
  // pour éviter qu'un nom court (ex. "Jean") matche avant un long (ex. "1 Jean").
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

  // Match "X" ou "X-Y" (chapitres uniquement, pas de versets pour le plan)
  const m = rest.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const end = m[2] ? parseInt(m[2], 10) : start;
  if (start < 1 || end < start) return null;

  const chapters = [];
  for (let c = start; c <= end; c++) chapters.push(c);
  return { id, name: bookName, chapters };
}

// Récupère la liste des versets (string[]) pour un livre+chapitre donnés.
export function getChapterVerses(bible, bookId, chapter) {
  if (!bible || !bible.text) return [];
  const book = bible.text[bookId];
  if (!book) return [];
  return book[chapter] || [];
}

// Génère la liste plate des chapitres d'un passage du plan, dans l'ordre.
// passages = ["Matthieu 28", "Marc 1-8"] → [{id:40,name:..,ch:28},{id:41,..,ch:1},...]
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

// Petit utilitaire d'affichage : "Matthieu 1" / "Philémon" / "2 Jean".
export function formatChapterLabel(name, chapter) {
  if (SINGLE_CHAPTER_BOOKS.has(name)) return name;
  return `${name} ${chapter}`;
}
