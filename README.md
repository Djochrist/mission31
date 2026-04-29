# Mission 31

> **Lis le Nouveau Testament en 31 jours.**
> Une PWA personnelle de progression spirituelle — légère, hors-ligne, sans inscription.

[![Licence: Apache 2.0](https://img.shields.io/badge/Licence-Apache_2.0-2d8a8a.svg)](LICENSE)
![PWA](https://img.shields.io/badge/PWA-installable-2d8a8a)
![Vanilla JS](https://img.shields.io/badge/Vanilla-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-0a2e2e)

---

## Fonctionnalités

- **Plan de lecture sur 31 jours** — couvre l'intégralité du Nouveau Testament (260 chapitres).
- **Suivi des lectures** — marquez chaque jour comme terminé d'un seul tap.
- **Lectures accélérées** — rattrapez votre retard avec 2, 3, 5, 10 ou 15 jours d'un coup.
- **Statistiques** — progression globale, streak, plus longue série, jours gagnés.
- **Système de badges** — débloquez 9 récompenses différentes au fil de votre progression.
- **Rappels quotidiens** — notifications planifiées (1 à 4 par jour) avec message personnalisable, déclenchées via `Notification API` quand l'app est ouverte.
- **PWA installable** — option d'installation **toujours visible** (bannière flottante + page Aide), avec barre de progression à l'installation et instructions iOS/Android dédiées.
- **Partage social enrichi** — partagez votre progression sur WhatsApp ou via le partage natif du système avec une **image générée** du jour en cours (Web Share API + `<canvas>`).
- **Versioning automatique du SW** — chaque build Vercel reçoit un identifiant unique (`VERCEL_GIT_COMMIT_SHA`), garantissant que les utilisateurs reçoivent la dernière version sans avoir à vider leur cache.
- **Stockage local** — toute la progression est sauvegardée dans le `localStorage`. Aucune inscription, aucune donnée envoyée à un serveur.
- **Stats globales en temps réel** (optionnel) — via Supabase, anonyme et respectueux de la vie privée.

## Philosophie

Mission 31 a été conçue pour être **simple, légère et focalisée**. Pas de compte à créer, pas de tracking, pas de framework lourd. Une PWA en HTML/CSS/JavaScript pur qui vous accompagne pendant 31 jours.

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer en développement (http://localhost:5173)
npm run dev

# Construire pour la production (vers ./dist)
npm run build

# Prévisualiser le build de production
npm run preview
```

Le dossier `dist/` est un site statique prêt à déployer **n'importe où** : Vercel, Netlify, GitHub Pages, Cloudflare Pages, votre propre serveur Nginx, etc.

## 📂 Structure du projet

```
mission-31/
├── index.html              # Point d'entrée HTML
├── public/                 # Assets statiques copiés tels quels
│   ├── manifest.webmanifest
│   ├── sw.js               # Service worker (cache + offline)
│   └── icons/              # Icônes PWA (192, 512, maskable, favicon)
├── src/
│   ├── main.js             # Logique de l'app (router, state, render)
│   ├── styles.css          # Styles complets
│   ├── supabase.js         # Client Supabase (stats globales, optionnel)
│   └── data/
│       ├── readings.js     # Plan de lecture des 31 jours
│       └── badges.js       # Définition des badges
├── vite.config.js          # Configuration Vite (build statique)
├── vercel.json             # Configuration de déploiement Vercel
├── .env.example            # Variables d'environnement (Supabase)
├── LICENSE                 # Apache 2.0
├── README.md
└── SUPABASE_SETUP.md       # Guide pour activer les stats globales
```

## 📖 Plan de lecture

Le plan a été conçu pour répartir équitablement les **260 chapitres du Nouveau Testament** sur 31 jours, soit ~8.4 chapitres par jour. Chaque journée regroupe des passages cohérents (un évangile complet, une épître entière, etc.).

Voir [`src/data/readings.js`](./src/data/readings.js) pour le détail.

## 🏆 Badges

| Badge | Condition |
| --- | --- |
| 🚀 **Lancé** | 3 jours validés |
| 🔑 **Discipline** | 7 jours validés |
| 🔒 **Engagement** | 15 jours validés |
| 🛡️ **Persévérant** | 21 jours validés |
| 🧭 **Déterminé** | 28 jours validés |
| 🏆 **Mission accomplie** | 31 jours validés |
| ⚡ **Accélération** | Utiliser une double lecture |
| 🔥 **Focus extrême** | Utiliser une triple lecture |
| 🎖️ **Marathon** | Valider 15 jours en accéléré |

## 📊 Statistiques globales (Supabase)

Pour afficher les vraies statistiques globales (nombre d'utilisateurs, missions terminées, taux de complétion), connecte une base **Supabase** (gratuit).

> Sans Supabase, l'app fonctionne normalement et affiche "Stats globales indisponibles" sur l'écran dédié.

## 🤝 Communauté

Un groupe WhatsApp dédié rassemble les participants de Mission 31 pour s'encourager mutuellement : [Rejoindre le groupe](https://chat.whatsapp.com/I3ofVHRDGPlEEmCtzSSsxV?mode=gi_t).

## 🔒 Vie privée

Mission 31 ne collecte **aucune donnée personnelle**. Toute votre progression est stockée localement dans votre navigateur (`localStorage`). Si Supabase est activé, seul un identifiant anonyme (UUID v4 généré localement) et un compteur de jours validés sont synchronisés — aucune information identifiante (email, nom, IP géolocalisée) n'est envoyée.

## 🤝 Contribuer

Les contributions sont les bienvenues ! Ouvrez une *issue* ou une *pull request* sur GitHub.

## 📜 Licence

Distribué sous la licence **Apache 2.0**. Voir le fichier [LICENSE](./LICENSE) pour plus d'informations.

> *« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. »* — **Psaumes 119:105**
