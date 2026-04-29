# Mission 31 — Documentation technique

> Ce document détaille **l'architecture, les choix techniques et le code** de l'application. Pour le fonctionnement utilisateur, voir `fonctionnement.md`.

---

## 1. Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Langage | **JavaScript vanilla (ES2022)** | Aucune dépendance lourde, démarrage instantané |
| Build | **Vite 5** | Build ultra rapide, HMR natif |
| Framework UI | **Aucun** (pas de React, pas de Vue) | App simple, performance maximale, code lisible |
| Style | **CSS pur** (variables CSS, flex/grid) | Maintenable sans préprocesseur |
| PWA | **Service Worker manuel** + Web App Manifest | Contrôle total, pas de magie |
| Stockage local | **localStorage** | Suffisant, synchrone, supporté partout |
| Backend (optionnel) | **Supabase** (Postgres + RPC) | Stats anonymes, gratuit jusqu'à un certain volume |
| Hébergement | **Vercel** | CI gratuit, HTTPS automatique, edge global |
| Licence | **Apache 2.0** | Open source permissif |

---

## 2. Arborescence des fichiers

```
mission-31/
├── index.html                  # Point d'entrée HTML unique (SPA)
├── package.json                # Scripts npm + dépendances
├── vite.config.js              # Config build (base relative, outDir=dist)
├── vercel.json                 # Config déploiement Vercel
├── .env.example                # Modèle de variables d'env
├── .gitignore                  # Fichiers à ignorer par git
├── LICENSE                     # Apache 2.0
├── README.md                   # Présentation publique
├── SUPABASE_SETUP.md           # Guide pas-à-pas pour activer Supabase
├── doc/
│   ├── fonctionnement.md       # Fonctionnement utilisateur
│   └── technique.md            # Ce fichier
├── public/                     # Fichiers servis tels quels
│   ├── manifest.webmanifest    # Manifest PWA
│   ├── sw.js                   # Service Worker
│   └── icons/                  # Icônes PNG (192, 512, maskable, favicon)
└── src/
    ├── main.js                 # Logique principale (router, vues, state)
    ├── styles.css              # Toutes les feuilles de style
    ├── supabase.js             # Client Supabase + sync stats
    └── data/
        ├── readings.js         # Plan des 31 jours (260 chapitres)
        └── badges.js           # Définition des 9 badges
```

---

## 3. Architecture applicative

### 3.1. SPA avec routeur maison

`index.html` contient un seul `<div id="app"></div>`.
`main.js` rend la vue active selon `state.route`.

**Routes (12) :** `welcome`, `name`, `home`, `reading`, `plan`, `profile`, `badges`, `stats`, `globalstats`, `help`, `settings`, `completed`.

Aucun history API : on reste sur la même URL et on ne pollue pas l'historique navigateur.

### 3.2. State global

Un seul objet `state` en mémoire :

```js
state = {
  route: 'home',
  user: { name: 'Marie', startedAt: '2026-04-29T12:00:00Z', clientId: 'uuid' },
  progress: {
    chaptersRead: { 'matthieu-1': true, 'matthieu-2': true, ... },
    daysCompleted: [1, 2, 3],
    badges: ['first_step', 'one_week']
  },
  settings: { theme: 'dark', notifications: false },
  selectedDay: 1,
  globalStats: null
}
```

### 3.3. Persistance

- Tout `state.user`, `state.progress` et `state.settings` est sérialisé en JSON dans `localStorage` sous la clé `mission31:state:v1`.
- À chaque modification : `saveState()` écrit immédiatement.
- Au démarrage : `loadState()` lit et hydrate l'objet.

**Versioning :** la clé contient `v1`. Si la structure change, on incrémente (`v2`) et on migre.

### 3.4. Cycle de rendu

```
événement utilisateur
    ↓
mutation du state
    ↓
saveState()
    ↓
render() → recalcule innerHTML de #app
    ↓
attachEventListeners()
```

Pas de virtual DOM : un re-render complet est acceptable car l'app est petite (~12 écrans, contenu léger).

---

## 4. Données métier

### 4.1. Le plan de lecture (`src/data/readings.js`)

Tableau de 31 objets :

```js
[
  { day: 1, title: 'Matthieu 1-5', chapters: ['matthieu-1', ..., 'matthieu-5'] },
  ...
  { day: 31, title: 'Apocalypse 19-22', chapters: ['apocalypse-19', ..., 'apocalypse-22'] }
]
```

**Total : 260 chapitres** sur les 27 livres du NT.

### 4.2. Les badges (`src/data/badges.js`)

```js
[
  {
    id: 'first_step',
    name: 'Premier pas',
    description: 'Termine la lecture du jour 1',
    icon: '🌱',
    check: (state) => state.progress.daysCompleted.includes(1)
  },
  ...
]
```

Chaque badge a une fonction `check(state)` pure qui retourne `true` si débloqué. Évalué à chaque mutation.

---

## 5. PWA

### 5.1. Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "Mission 31",
  "short_name": "Mission31",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#0a2e2e",
  "theme_color": "#0a2e2e",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 5.2. Service Worker (`public/sw.js`)

Stratégie **cache-first** pour les assets, **network-first** pour le HTML.

**Important — comportement en développement :**
- Si l'hôte contient `localhost`, `127.0.0.1` ou `replit.dev`, le SW se met en mode **pass-through** (ne cache rien). Cela évite de servir une vieille version pendant le dev.
- En production : caching agressif → l'app marche hors ligne.

**Versioning du cache :**
```js
const CACHE_NAME = 'mission31-v1';
```
Quand on déploie une mise à jour majeure, incrémenter (`v2`). L'ancien cache est supprimé à l'activation.

### 5.3. Enregistrement du SW

Dans `main.js`, conditionné à la production :

```js
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('./sw.js');
}
```

---

## 6. Intégration Supabase (optionnelle)

### 6.1. Variables d'environnement

`.env.example` :
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

⚠️ Le préfixe `VITE_` est **obligatoire** : sans lui, Vite n'expose pas la variable au code client.

Si une des deux est vide → toute la logique Supabase est désactivée silencieusement (l'app continue de marcher).

### 6.2. Client (`src/supabase.js`)

```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = (url && key) ? createClient(url, key) : null;
```

### 6.3. Fonctions exportées

- `syncProgress(state)` — fait un upsert dans la table `mission31_users` à chaque changement (avec debounce de 5 secondes).
- `fetchGlobalStats()` — appelle la fonction RPC `mission31_get_stats` qui renvoie `{ total_users, completed_missions, completion_rate }`.

### 6.4. Schéma SQL (voir `SUPABASE_SETUP.md`)

```sql
create table mission31_users (
  client_id uuid primary key,
  chapters_read int not null default 0,
  days_completed int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table mission31_users enable row level security;

-- INSERT/UPDATE permis à tout le monde sur sa propre ligne (pas de SELECT)
create policy "anon insert" on mission31_users for insert to anon with check (true);
create policy "anon update own" on mission31_users for update to anon using (true);

-- Lecture des stats globales uniquement via RPC (security definer)
create function mission31_get_stats()
returns json language sql security definer as $$
  select json_build_object(
    'total_users', count(*),
    'completed_missions', count(*) filter (where completed),
    'completion_rate', round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 1)
  ) from mission31_users;
$$;
```

**Sécurité :** la clé `anon` ne peut **rien lire** dans la table (pas de SELECT). Elle peut seulement insérer/mettre à jour sa propre ligne et appeler la fonction RPC qui ne renvoie que des agrégats.

---

## 7. Build & déploiement

### 7.1. Scripts npm (`package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 7.2. Config Vite (`vite.config.js`)

```js
export default {
  base: './',          // chemins relatifs (déployable n'importe où)
  build: { outDir: 'dist' }
}
```

### 7.3. Config Vercel (`vercel.json`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null
}
```

### 7.4. Pipeline de déploiement

1. Push sur `main` (GitHub) →
2. Vercel détecte le push →
3. `npm install` puis `npm run build` →
4. Le contenu de `dist/` est servi sur le CDN edge mondial →
5. HTTPS automatique, cache invalidé.

---

## 8. Conventions de code

- **JavaScript moderne** : `const`/`let`, arrow functions, destructuring, template literals.
- **Pas de transpilation Babel** : on cible les navigateurs evergreen (2023+).
- **Pas de TypeScript** : volonté de simplicité, l'app est petite.
- **Indentation** : 2 espaces.
- **Nommage** : `camelCase` pour les variables et fonctions, `UPPER_SNAKE` pour les constantes.
- **Pas de framework CSS** : variables CSS (`--color-primary`, `--color-bg`) dans `:root`.
- **Mobile-first** : les media queries ajoutent des règles pour tablette/desktop.

---

## 9. Couleurs et thème

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

Mode clair (optionnel) : `[data-theme="light"]` redéfinit ces variables.

---

## 10. Sécurité & confidentialité

- **Aucun cookie**, **aucun tracker tiers** (pas de Google Analytics).
- **localStorage uniquement** sur l'appareil.
- **Identifiant anonyme** : UUID v4 généré côté client, jamais relié à une identité.
- **Pas de PII** envoyé au serveur (ni prénom, ni email, ni IP nominative).
- **CSP recommandée** (à ajouter via header Vercel) :
  ```
  default-src 'self';
  connect-src 'self' https://*.supabase.co;
  img-src 'self' data:;
  ```

---

## 11. Maintenance courante

| Tâche | Fichier(s) à modifier |
|---|---|
| Corriger un titre de jour | `src/data/readings.js` |
| Ajouter/modifier un badge | `src/data/badges.js` |
| Changer une couleur | `src/styles.css` (variables `:root`) |
| Modifier un texte d'écran | `src/main.js` (fonction `view*`) |
| Changer le lien WhatsApp | `src/main.js` (constante `WHATSAPP_GROUP_URL`) |
| Changer l'email contact | `src/main.js` (constante `CONTACT_EMAIL`) |
| Régénérer les icônes | Remplacer dans `public/icons/` |
| Ajouter un écran | Créer `viewXxx()` + ajouter route dans `render()` |
| Mise à jour de cache | Incrémenter `CACHE_NAME` dans `public/sw.js` |

---

## 12. Tests manuels recommandés avant déploiement

1. ✅ `npm run build` se termine sans erreur.
2. ✅ `npm run preview` ouvre l'app en local sur `http://localhost:4173`.
3. ✅ Parcourir les 12 écrans.
4. ✅ Cocher tous les chapitres du jour 1 → vérifier badge « Premier pas ».
5. ✅ Vider localStorage → l'app redémarre proprement sur `welcome`.
6. ✅ Couper le wifi → l'app continue de fonctionner (PWA).
7. ✅ Ouvrir DevTools > Application > Manifest : icônes et nom corrects.
8. ✅ Lighthouse > PWA score : ≥ 90.

---

**Pour la formation pas-à-pas destinée aux débutants, voir le PDF `Formation-Mission-31.pdf`.**
