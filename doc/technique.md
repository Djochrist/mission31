# Mission 31 — Documentation technique

> Ce document détaille **l'architecture, les choix techniques et le code** de l'application. Pour le fonctionnement utilisateur, voir `fonctionnement.md`.

---

## 1. Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Langage | **JavaScript vanilla (ES2020)** | Aucune dépendance lourde, démarrage instantané |
| Build | **Vite 5** | Build ultra rapide, HMR natif |
| Framework UI | **Aucun** (pas de React, pas de Vue) | App simple, performance maximale, code lisible |
| Style | **CSS pur** (variables CSS, flex/grid) | Maintenable sans préprocesseur |
| PWA | **Service Worker manuel** + Web App Manifest | Contrôle total, versioning automatique par build |
| Stockage local | **localStorage** | Suffisant, synchrone, supporté partout |
| Texte biblique | **JSON statique** (`lsg-nt.json`) mis en cache par le SW | Lecture hors ligne sans dépendance externe |
| Son | **Web Audio API** (oscillateur natif) | Carillon sans fichier audio, zéro dépendance |
| Backend (optionnel) | **Supabase** (Postgres + RPC) | Stats anonymes, gratuit jusqu'à un certain volume |
| Hébergement | **Vercel** | CI gratuit, HTTPS automatique, edge global |
| Licence | **Apache 2.0** | Open source permissif |

---

## 2. Arborescence des fichiers

```
mission-31/
├── index.html                  # Point d'entrée HTML unique (SPA)
├── package.json                # Scripts npm + dépendances
├── vite.config.js              # Config build (base relative, plugin sw-version, port 5000)
├── vercel.json                 # Config déploiement Vercel
├── .env.example                # Modèle de variables d'env (Supabase)
├── .gitignore
├── LICENSE                     # Apache 2.0
├── README.md
├── SUPABASE_SETUP.md           # Guide pas-à-pas pour activer Supabase
├── doc/
│   ├── fonctionnement.md       # Fonctionnement utilisateur (lire en premier)
│   └── technique.md            # Ce fichier
├── public/
│   ├── manifest.webmanifest    # Manifest PWA
│   ├── sw.js                   # Service Worker (__BUILD_ID__ remplacé à la compilation)
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── icon-maskable-512.png
│   │   ├── favicon.svg
│   │   └── apple-touch-icon.png  # 180×180 PNG pour iOS (généré depuis favicon.svg)
│   └── bible/
│       └── lsg-nt.json         # NT Louis Segond 1910 (par livre / chapitre / verset)
└── src/
    ├── main.js                 # Logique principale (~2400 lignes : router, vues, state, events)
    ├── styles.css              # Toutes les feuilles de style
    ├── supabase.js             # Client Supabase + sync stats anonymes
    ├── assets/
    │   └── icon-512.png        # Icône importée par main.js via Vite
    └── data/
        ├── readings.js         # Plan des 31 jours
        ├── badges.js           # 9 badges de progression + unlockedBadges()
        ├── messages.js         # Tous les textes utilisateur (centralisés)
        └── bible.js            # Parseur de références bibliques + chargement JSON lazy
```

---

## 3. Architecture applicative

### 3.1. SPA avec routeur maison (hash-based)

`index.html` contient un seul `<div id="app"></div>`.
`main.js` rend la vue active selon le hash de l'URL.

**Format des routes :** `#/nom` ou `#/nom?param=valeur`

**Routes (17) :**

| Route | Description |
|---|---|
| `welcome` | Écran d'accueil pour un nouvel utilisateur |
| `home` | Tableau de bord principal |
| `reading` | Lecture du jour (redirige vers bible) |
| `accelerated` | Interface de lecture accélérée (batch) |
| `planning` | Vue plan des 31 jours |
| `stats` | Statistiques personnelles |
| `rewards` | Grille des badges (progression + tours) |
| `share` | Partage de progression (image canvas) |
| `help` | Aide / FAQ / installation PWA |
| `offline` | Écran hors ligne |
| `reminders` | Configuration des rappels quotidiens |
| `completion` | Félicitations (31 jours validés) |
| `bible` | Lecteur biblique intégré (Louis Segond 1910) |
| `memory` | Versets à mémoriser |
| `settings` | Paramètres (thème, reset) |
| `notes` | Notes par chapitre/jour |

### 3.2. State global

Un seul objet `state` en mémoire, persisté dans localStorage :

```js
state = {
  startedAt: null,           // ISO date du début du tour courant (null = non commencé)
  progress: {                // Objet indexé par numéro de jour
    1: { done: true, doneAt: '2026-05-01T08:30:00Z', batchSize: 1 },
    2: { done: true, doneAt: '2026-05-01T09:00:00Z', batchSize: 2 },
    // batchSize > 1 = lecture accélérée
  },
  reReads: {                 // Compteur de relectures par jour
    5: 2,                    // Jour 5 relu 2 fois
  },
  completionCount: 0,        // Nombre de fois que les 31 jours ont été complétés
  reminders: {
    enabled: true,
    times: ['08:00', '20:00'],
    message: "N'oublie pas ta lecture du jour."
  },
  lastSyncedAt: null,        // ISO date du dernier sync Supabase réussi
  memoryVerses: [],          // [{ id, date: 'YYYY-MM-DD', ref, text, addedAt }]
  theme: 'auto',             // 'auto' | 'light' | 'dark'
  notes: [],                 // [{ id, dayRef, chapterRef, title, content, createdAt, updatedAt }]
  highlights: {},            // { 'bookId-chapter-verseIdx': 'yellow'|'green'|'blue'|'pink' }
}
```

**Clés importantes ajoutées lors des dernières évolutions :**
- `reReads` — ajouté par `loadState()` via merge avec `defaultState` si absent.
- `completionCount` — idem.

### 3.3. Persistance

- Tout `state` est sérialisé en JSON dans `localStorage` sous la clé `mission31:state:v1`.
- À chaque modification : `saveState()` écrit immédiatement.
- Au démarrage : `loadState()` lit et hydrate l'objet (merge avec `defaultState` pour ajouter les nouveaux champs sans casser les données existantes).

**Versioning :** la clé contient `v1`. Si la structure change de manière incompatible, on incrémente (`v2`) et on migre.

### 3.4. Cycle de rendu

```
événement utilisateur (clic, hashchange, online/offline)
    ↓
mutation du state (si applicable)
    ↓
saveState()
    ↓
render() → recalcule innerHTML de #app selon la route courante
    ↓
attachEventListeners() → délégation d'événements sur #app
```

La célébration et les toasts s'affichent en **overlay** sur `document.body` (hors du cycle de rendu principal) et persistent jusqu'à ce que l'utilisateur les ferme.

### 3.5. Calcul du jour courant

```js
function currentDay() {
  if (!state.startedAt) return 1;
  const startedAt = startOfDay(new Date(state.startedAt));
  const now = startOfDay(new Date());
  const diff = Math.floor((now - startedAt) / (1000 * 60 * 60 * 24));
  return Math.min(31, Math.max(1, diff + 1));
}
```

---

## 4. Données métier

### 4.1. Le plan de lecture (`src/data/readings.js`)

Tableau de 31 objets :

```js
[
  { day: 1,  passages: ["Matthieu 1-9"] },
  { day: 4,  passages: ["Matthieu 28", "Marc 1-8"] },
  ...
  { day: 31, passages: ["Apocalypse 22"] }
]
```

**Total : 260 chapitres** sur les 27 livres du NT (~8,4 chapitres/jour en moyenne).

### 4.2. Les badges de progression (`src/data/badges.js`)

```js
export const badges = [
  { id: "lance",        name: "Lancé",            category: "completed", required: 3,  icon: "rocket"  },
  { id: "discipline",   name: "Discipline",        category: "completed", required: 7,  icon: "key"     },
  { id: "engagement",   name: "Engagement",        category: "completed", required: 15, icon: "lock"    },
  { id: "perseverant",  name: "Persévérant",       category: "completed", required: 21, icon: "shield"  },
  { id: "determine",    name: "Déterminé",         category: "completed", required: 28, icon: "compass" },
  { id: "accompli",     name: "Mission accomplie", category: "completed", required: 31, icon: "trophy"  },
  { id: "acceleration", name: "Accélération",      category: "special",   required: 1,  icon: "bolt"    },
  { id: "focus",        name: "Focus extrême",     category: "special",   required: 1,  icon: "flame"   },
  { id: "marathon",     name: "Marathon",          category: "special",   required: 1,  icon: "medal"   },
];
```

La fonction `unlockedBadges(state)` retourne un `Set` des IDs débloqués. Appelée à chaque rendu.

### 4.3. Les badges de tours (`src/data/messages.js` → `TOUR_BADGES`)

```js
export const TOUR_BADGES = [
  { emoji: "🔄", name: "Deuxième souffle", threshold: 2,  desc: "Tu as complété 2 tours" },
  { emoji: "🌟", name: "Fidèle",           threshold: 3,  desc: "Tu as complété 3 tours" },
  { emoji: "👑", name: "Pilier",           threshold: 5,  desc: "Tu as complété 5 tours" },
  { emoji: "🔥", name: "Légende",          threshold: 10, desc: "Tu as complété 10 tours" },
];
```

Affichés dans `viewRewards()` et `viewCompletion()`. Calculés à partir de `state.completionCount`.

### 4.4. Le fichier de messages (`src/data/messages.js`)

Centralise **tous les textes affichés à l'utilisateur** :

```js
export const CELEBRATION = {
  default: { emoji, title, body },
  days: {
    1:  { emoji, title, body },   // Premier pas
    3:  { emoji, title, body },   // Trois jours
    7:  { emoji, title, body },   // Une semaine
    15: { emoji, title, body },   // Mi-parcours
    28: { emoji, title, body },   // Presque là
    31: { emoji, title, body },   // Mission accomplie
  }
};

export const REFLECTION_QUESTION = "Qu'as-tu appris ou retenu aujourd'hui ?";

export const REREAD_MESSAGES = [
  { emoji, title, body },   // [0] 1ère relecture
  { emoji, title, body },   // [1] 2ème relecture — citation Josué 1:8
  { emoji, title, body },   // [2] 3ème relecture et au-delà — Jérémie 31:33
];

export const COMPLETION_MESSAGES = {
  first:    { emoji, title, body, quote },
  repeat:   (n) => ({ emoji, title, body, quote }),  // selon le numéro du tour
};

export const TOUR_BADGES = [ ... ];

export const TOASTS = {
  batchValidated: (n) => `${n} jours validés !`,
  newRun: "Nouvelle lancée ! Bonne route.",
  ...
};
```

**Pour modifier un message :** éditer uniquement `src/data/messages.js`.

### 4.5. Le lecteur biblique (`src/data/bible.js`)

- **`BOOK_IDS`** : mapping nom de livre → identifiant numérique (40–66 pour le NT)
- **`SINGLE_CHAPTER_BOOKS`** : livres à un seul chapitre (Philémon, 2 Jean, 3 Jean, Jude)
- **`loadBible()`** : chargement lazy de `public/bible/lsg-nt.json` (mis en cache en mémoire)
- **`parsePassage(ref)`** : parse `"Matthieu 1-9"` en objet structuré
- **`expandPassages(passages)`** : liste plate de chapitres individuels
- **`getChapterVerses(bible, bookId, chapter)`** : versets d'un chapitre donné

Format JSON : `{ text: { [bookId]: { [chapter]: string[] } } }`

---

## 5. Fonctions clés de `main.js`

### 5.1. `markRead(daysCount)`

Valide `daysCount` jours à partir du jour courant.

```
1. Boucle : marque chaque jour comme done dans state.progress
2. saveState() + syncProgress(completedCount())
3. Si completedCount() >= 31 :
     state.completionCount++
     setTimeout(() => navigate("completion"), 400)
   Sinon si daysCount > 1 :
     showToast(TOASTS.batchValidated(daysCount))
     render()
   Sinon :
     showCelebration(today, false)
```

### 5.2. `markReRead(day)`

Valide une relecture d'un jour déjà fait.

```
1. state.reReads[day] = (state.reReads[day] || 0) + 1
2. saveState()
3. showCelebration(day, true, state.reReads[day])
```

### 5.3. `showCelebration(day, isReRead, reReadCount?)`

Injecte un overlay DOM dans `document.body` :

```
1. Sélectionne le message depuis CELEBRATION.days[day] ou CELEBRATION.default
   (ou REREAD_MESSAGES[min(reReadCount-1, 2)] pour une relecture)
2. Crée .celeb-overlay > .celeb-box (stars, emoji, title, body, question, boutons)
3. playChime() — 4 notes C5-E5-G5-C6 via OscillatorNode
4. requestAnimationFrame → ajoute .celeb-overlay--visible (transition CSS)
5. Bouton "Prendre une note" → navigate("notes?day=N")
6. Bouton "Continuer" → supprime l'overlay + navigate("home")
```

### 5.4. `playChime()`

```js
function playChime() {
  const ctx = new AudioContext();
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.5);
  });
}
```

### 5.5. Actions de `handleAction()`

| Action | Effet |
|---|---|
| `mark-today` | `markRead(1)` puis `render()` |
| `mark-today-from-bible` | `showCelebration(day, false)` directement |
| `mark-reread-from-bible` | `markReRead(day)` |
| `new-run` | Reset `progress` + `startedAt`, conserve `completionCount` + `reReads` |
| `reset` | `state = { ...defaultState }` (efface tout) |

---

## 6. PWA

### 6.1. Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "Mission 31",
  "short_name": "Mission31",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#0a2e2e",
  "theme_color": "#0a2e2e",
  "icons": [
    { "src": "icons/icon-192.png",         "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png",         "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png","sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ]
}
```

### 6.2. Service Worker (`public/sw.js`)

Stratégie **cache-first** pour les assets statiques et le JSON biblique, **network-first** pour le HTML.

**Versioning automatique :** le placeholder `__BUILD_ID__` est remplacé à la compilation par :
- En production Vercel : 8 premiers caractères de `VERCEL_GIT_COMMIT_SHA`
- En développement : timestamp en base 36

**Mode développement :** si l'hôte contient `localhost`, `127.0.0.1` ou `replit.dev`, le SW est en mode **pass-through** (ne cache rien).

### 6.3. Enregistrement du SW

Dans `index.html`, conditionné à la production :

```js
if ('serviceWorker' in navigator
  && !location.hostname.includes('localhost')
  && !location.hostname.includes('replit.dev')) {
  navigator.serviceWorker.register('./sw.js');
}
```

---

## 7. Plugin Vite : sw-version

Remplace `__BUILD_ID__` dans `dist/sw.js` après chaque build de production.

```js
function swVersionPlugin() {
  return {
    name: "sw-version",
    apply: "build",
    closeBundle() {
      const buildId =
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
        process.env.VITE_BUILD_ID ||
        Date.now().toString(36);
      // Remplace dans dist/sw.js
    },
  };
}
```

---

## 8. Intégration Supabase (optionnelle)

### 8.1. Variables d'environnement

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Le préfixe `VITE_` est **obligatoire** (exposition côté client par Vite).
Si vides → toute la logique Supabase est désactivée silencieusement.

### 8.2. Fonctions exportées (`src/supabase.js`)

- `registerUser(clientId)` — insère la ligne anonyme à la première ouverture.
- `syncProgress(daysCompleted)` — upsert avec debounce de 5 secondes.
- `fetchGlobalStats()` — appelle la RPC `mission31_get_stats` si une vue serveur doit réutiliser les agrégats.

### 8.3. Schéma SQL

```sql
create table mission31_users (
  client_id uuid primary key,
  days_completed int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table mission31_users enable row level security;
create policy "anon insert" on mission31_users for insert to anon with check (true);
create policy "anon update own" on mission31_users for update to anon using (true);

create function mission31_get_stats() returns json
language sql security definer as $$
  select json_build_object(
    'total_users', count(*),
    'completed_missions', count(*) filter (where completed),
    'completion_rate', round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 1)
  ) from mission31_users;
$$;
```

**Sécurité :** la clé `anon` ne peut pas lire la table — seulement insérer/mettre à jour sa ligne, et appeler la RPC qui ne renvoie que des agrégats.

---

## 9. Build & déploiement

### 9.1. Scripts npm

```json
{
  "scripts": {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview"
  }
}
```

### 9.2. Config Vite

```js
export default defineConfig({
  base: './',
  plugins: [swVersionPlugin()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
  server: { host: true, port: 5000, allowedHosts: true },
  preview: { host: true, port: 4173 },
});
```

### 9.3. Config Vercel

```json
{ "buildCommand": "npm run build", "outputDirectory": "dist", "framework": null }
```

### 9.4. Pipeline

1. Push sur `main` (GitHub)
2. Vercel détecte → `npm install` + `npm run build`
3. `swVersionPlugin` injecte le hash du commit dans `sw.js`
4. `dist/` servi sur le CDN edge mondial
5. HTTPS automatique, cache navigateur invalidé automatiquement

---

## 10. Conventions de code

- **JavaScript moderne** : `const`/`let`, arrow functions, destructuring, template literals.
- **Cible** : ES2020 (navigateurs evergreen 2021+). Pas de transpilation Babel.
- **Pas de TypeScript** : volonté de simplicité, l'app est petite.
- **Indentation** : 2 espaces.
- **Nommage** : `camelCase` pour les fonctions/variables, `UPPER_SNAKE` pour les constantes, `view*()` pour les fonctions de rendu.
- **Mobile-first** : media queries pour tablette/desktop.
- **Icônes** : SVG inline dans l'objet `I` de `main.js` — aucune dépendance externe.
- **Messages** : tous dans `src/data/messages.js` — jamais de chaînes littérales en dur dans les fonctions `view*()`.

---

## 11. Couleurs et thème

```css
:root {
  --color-bg: #0a2e2e;       /* dark teal — fond principal */
  --color-accent: #2d8a8a;   /* teal lumineux — boutons, liens */
  --color-text: #e8f0f0;
  --color-muted: #88a8a8;
  --color-success: #4ade80;
  --color-warning: #fbbf24;
}
```

Trois modes : `dark` (par défaut), `light`, `auto`. Appliqué via `data-theme` sur `<html>`.

---

## 12. Maintenance courante

| Tâche | Fichier(s) à modifier |
|---|---|
| Modifier un message affiché à l'utilisateur | `src/data/messages.js` |
| Corriger les passages d'un jour | `src/data/readings.js` |
| Ajouter/modifier un badge de progression | `src/data/badges.js` |
| Ajouter/modifier un badge de tours | `src/data/messages.js` → `TOUR_BADGES` |
| Changer une couleur | `src/styles.css` (variables `:root`) |
| Changer le lien WhatsApp | `src/main.js` → constante `WHATSAPP_GROUP_URL` |
| Changer l'email contact | `src/main.js` → constante `CONTACT_EMAIL` |
| Régénérer les icônes | Remplacer dans `public/icons/` et `src/assets/icon-512.png` |
| Ajouter un écran | Créer `viewXxx(params)` + ajouter dans le tableau `routes` |
| Mettre à jour le texte biblique | Remplacer `public/bible/lsg-nt.json` |
| Forcer une mise à jour du cache | Pousser un commit (prod) ou incrémenter `VITE_BUILD_ID` (dev) |

---

## 13. Tests manuels recommandés avant déploiement

1. ✅ `npm run build` se termine sans erreur.
2. ✅ `npm run preview` → ouvrir l'app sur `http://localhost:4173`.
3. ✅ Parcourir les 17 routes.
4. ✅ Valider le Jour 1 → modal de célébration s'affiche avec son, étoiles et message.
5. ✅ Cliquer « Prendre une note » dans la modal → ouvre la modal de notes.
6. ✅ Cliquer « Continuer » → retour à l'accueil, carte « Jour suivant » visible.
7. ✅ Aller dans le lecteur Bible sur un jour déjà validé → bouton « Valider la relecture » présent.
8. ✅ Valider une relecture → modal avec message spécifique.
9. ✅ Valider 31 jours → écran complétion + `completionCount` = 1.
10. ✅ Cliquer « Nouvelle lancée » → retour welcome/home, historique des tours conservé.
11. ✅ Lecture ×2 → badge ⚡ **Accélération** dans Récompenses.
12. ✅ Surligner un verset → recharger → surlignage persisté.
13. ✅ Ajouter une note → retrouver dans l'écran Notes.
14. ✅ Vider localStorage → l'app redémarre proprement sur `welcome`.
15. ✅ Couper le wifi → texte biblique accessible hors ligne.
16. ✅ Lighthouse > PWA score ≥ 90.
17. ✅ `sw.js` dans `dist/` ne contient plus `__BUILD_ID__` (remplacé par un hash).
