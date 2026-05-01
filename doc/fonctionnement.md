# Mission 31 — Fonctionnement détaillé

> Ce document explique **tout** ce que l'application fait, écran par écran, du point de vue de l'utilisateur final. Aucun code ici. Pour la partie code, voir `technique.md`.

---

## 1. Vue d'ensemble

**Mission 31** est une application web (PWA) qui propose de lire l'intégralité du **Nouveau Testament en 31 jours**.

- **260 chapitres** du Nouveau Testament, répartis en **31 lectures quotidiennes** (~8 chapitres/jour).
- La mission commence le **jour où l'utilisateur démarre l'application** (pas de date fixe).
- L'utilisateur valide chaque jour de lecture → sa progression est sauvegardée localement.
- L'application fonctionne **hors ligne** (PWA installable).
- Après chaque validation, une **célébration** s'affiche (animation, son, message biblique, question de réflexion).
- Des **lectures accélérées** permettent de valider 2, 3, 5, 10 ou 15 jours d'un coup.
- La **relecture** d'un jour déjà validé est encouragée et trackée, avec des messages progressifs.
- Un **compteur de tours** enregistre combien de fois les 31 jours ont été complétés.
- Des **badges de fidélité** récompensent les tours successifs.
- Un **lecteur biblique intégré** (Louis Segond 1910) permet de lire directement dans l'app.
- Des **versets à mémoriser** peuvent être programmés pour un jour précis.
- Des **notes** et du **surlignage** sont disponibles dans le lecteur.
- Une page de **statistiques globales** (optionnelle) montre combien de personnes participent dans le monde.
- Tous les textes affichés à l'utilisateur sont centralisés dans un fichier `messages.js` modifiable librement.

**Public visé :** chrétiens francophones, débutants ou habitués de la lecture biblique.

---

## 2. Les écrans de l'application

L'application compte **17 routes** (vues) :

### 2.1. Écran d'accueil (`welcome`)

Premier écran vu par un nouvel utilisateur.

**Contenu :**
- Logo / titre **Mission 31**
- Phrase d'accroche : « Lis le Nouveau Testament en 31 jours »
- Bouton **« Commencer la mission »** → démarre la mission et enregistre la date du jour comme Jour 1
- Bandeau d'invitation à rejoindre la communauté WhatsApp

**Comportement :**
- Si l'utilisateur a déjà commencé, il est automatiquement redirigé vers l'écran **Accueil**.
- Aucun prénom n'est demandé.

---

### 2.2. Écran Accueil (`home`)

C'est le tableau de bord principal.

**Contenu affiché :**
- **Jour actuel** de la mission (Jour X / 31)
- **Passages du jour** et temps de lecture estimé
- Bouton **« Lire aujourd'hui »** → ouvre le lecteur Bible sur le jour courant
- **Si le jour est déjà validé :**
  - Carte **« Jour suivant »** (passages + bouton « Commencer le jour suivant ») — affichée juste au-dessus de « Relire aujourd'hui »
  - Bouton **« Relire aujourd'hui »**
- Barre de progression globale
- Streak actuel
- Lien vers la lecture accélérée
- Verset à mémoriser du jour (si programmé)
- Lien rapide vers la communauté WhatsApp

**Logique du jour affiché :**
- Le Jour 1 = la date à laquelle l'utilisateur a cliqué sur « Commencer ».
- Le Jour X est calculé automatiquement en fonction de la date réelle du téléphone.
- Après le Jour 31 : l'utilisateur est redirigé vers l'écran de complétion.

---

### 2.3. Écran Lecture accélérée (`accelerated`)

Permet de valider plusieurs jours d'un coup.

**Contenu :**
- Boutons de sélection : 2, 3, 5, 10, 15 jours
- Confirmation avant validation
- Après confirmation : toast simple (pas de modal de célébration pour les batchs)

**Utilité :** rattraper plusieurs jours manqués en une seule session intensive.

---

### 2.4. Écran Plan complet (`planning`)

Vue d'ensemble des **31 jours**.

**Contenu :**
- Liste des 31 jours avec passages, date calculée et statut (✅ terminé / en cours / à venir)
- Cliquer sur un jour → ouvre le lecteur Bible pour ce jour-là

---

### 2.5. Écran Statistiques personnelles (`stats`)

**Contenu :**
- Progression globale (%, jours validés / 31)
- Streak actuel et plus longue série
- Jours gagnés (avance sur le rythme prévu)
- Compteur persistant des visiteurs du site (si Supabase est configuré)
- Date estimée de fin

---

### 2.6. Écran Récompenses (`rewards`)

**Contenu :**
- **9 badges de progression** (débloqués par jours validés ou actions spéciales)
- **4 badges de fidélité** (débloqués par nombre de tours complets)
- Compteur de tours accomplis

**Badges de progression (9) :**

| Badge | Condition |
|---|---|
| 🚀 Lancé | 3 jours validés |
| 🔑 Discipline | 7 jours validés |
| 🔒 Engagement | 15 jours validés |
| 🛡️ Persévérant | 21 jours validés |
| 🧭 Déterminé | 28 jours validés |
| 🏆 Mission accomplie | 31 jours validés |
| ⚡ Accélération | Utiliser une lecture ×2 |
| 🔥 Focus extrême | Utiliser une lecture ×3 |
| 🎖️ Marathon | 15 jours validés ou lecture ×15 |

**Badges de fidélité — tours (4) :**

| Badge | Condition |
|---|---|
| 🔄 Deuxième souffle | 2 tours complets |
| 🌟 Fidèle | 3 tours complets |
| 👑 Pilier | 5 tours complets |
| 🔥 Légende | 10 tours complets |

---

### 2.7. Écran Partage (`share`)

**Contenu :**
- Génère une image de progression via `<canvas>`
- Bouton de partage natif (WhatsApp, Messages…)
- Bouton de téléchargement

---

### 2.8. Écran Aide (`help`)

**Contenu :**
- Questions fréquentes
- Instructions d'installation PWA (iOS / Android / Bureau)
- Comment rattraper un jour manqué
- Lien vers la communauté WhatsApp
- Lien email vers le développeur
- Bouton d'installation de la PWA (toujours visible)

---

### 2.9. Écran Hors ligne (`offline`)

Affiché automatiquement quand la connexion est perdue.
Retour automatique quand la connexion revient.

---

### 2.10. Écran Rappels (`reminders`)

**Contenu :**
- Activation/désactivation des rappels quotidiens
- Choix des horaires (1 à 4 rappels par jour)
- Message de rappel personnalisable
- Les rappels fonctionnent via la Notification API (l'app doit être ouverte)

---

### 2.11. Écran Complétion (`completion`)

Affiché quand l'utilisateur a validé les 31 jours.

**Contenu :**
- Message de félicitations spécifique au numéro du tour (1er, 2ème, 3ème…) avec citation biblique correspondante
- Statistiques : jours complétés + **numéro du tour**
- Badges de fidélité débloqués (si applicable)
- Bouton **« Nouvelle lancée »** — remet la progression à zéro **sans effacer** le compteur de tours ni les relectures
- Bouton « Retour à l'accueil »

**Différence « Nouvelle lancée » vs « Réinitialiser » :**
- **Nouvelle lancée** : conserve `completionCount` et `reReads`, remet uniquement `progress` et `startedAt` à zéro. L'utilisateur repart pour un nouveau tour.
- **Réinitialiser** (dans les paramètres) : efface **tout**, y compris l'historique des tours.

---

### 2.13. Lecteur Bible (`bible`)

L'app intègre le texte complet du **Nouveau Testament (Louis Segond 1910)**.

**Contenu :**
- Texte verset par verset du chapitre sélectionné
- Navigation entre les chapitres du jour (précédent / suivant)
- **Surlignage** en 4 couleurs (jaune, vert, bleu, rose) — sauvegardé localement
- Bouton **« Prendre une note »**
- **Si le jour n'est pas encore validé :** bouton **« J'ai terminé ma lecture »** → déclenche la célébration
- **Si le jour est déjà validé :** bouton **« ✓ Valider la relecture »** → déclenche la célébration de relecture

Navigation par URL : `#/bible?day=N&i=0` (jour du plan) ou `#/bible?b=40&c=1` (chapitre libre).

---

### 2.14. Versets à mémoriser (`memory`)

**Contenu :**
- Formulaire : référence, texte, date de mémorisation
- Liste des versets programmés
- Le verset du jour s'affiche en haut de l'**Accueil**

---

### 2.15. Paramètres (`settings`)

**Contenu :**
- Thème : clair / sombre / auto
- Réinitialiser toutes les données (efface tout, y compris l'historique des tours)

---

### 2.16. Notes (`notes`)

**Contenu :**
- Liste de toutes les notes triées par jour
- Création / modification / suppression
- Chaque note est associée à un jour et/ou un chapitre

**Accès :** depuis le lecteur Bible ou depuis le menu.

---

## 3. Système de célébration

Chaque validation d'un jour (première lecture) déclenche une **modal de célébration** plein écran :

- **Animation** : overlay qui apparaît en fondu, étoiles animées en arrière-plan, emoji 🎉 en rebond
- **Son** : carillon de 4 notes (C5-E5-G5-C6) généré via Web Audio API — aucun fichier audio requis
- **Message** : spécifique au numéro du jour pour les jours clés (1, 3, 7, 15, 28, 31) — message générique pour les autres
- **Question de réflexion** : « Qu'as-tu appris ou retenu aujourd'hui ? »
- **Deux boutons** :
  - **✏️ Prendre une note** → ouvre directement la modal de notes pour le jour validé
  - **Continuer →** → ferme la modal et retourne à l'accueil

> Pour les lectures accélérées (batchs ≥ 2 jours), un simple toast s'affiche à la place de la modal.

---

## 4. Système de relecture

Quand un utilisateur relit un jour déjà validé et clique sur **« ✓ Valider la relecture »** en fin de lecture :

- La relecture est comptabilisée dans `state.reReads[day]`
- Une **modal de célébration** s'affiche avec un message progressif selon le nombre de relectures :

| Nombre de relectures | Message affiché |
|---|---|
| 1ère | Encouragement : « Revenir sur la Parole, c'est lui permettre de creuser plus profond. » |
| 2ème | Citation sur la répétition biblique (Deutéronome, Josué 1:8) |
| 3ème et au-delà | Exhortation sur l'ancrage de la Parole (Jérémie 31:33) |

---

## 5. Système de tours

- Chaque fois que les 31 jours sont complétés, `completionCount` s'incrémente.
- Le bouton **« Nouvelle lancée »** sur l'écran de complétion remet la progression à zéro sans effacer l'historique.
- Les badges de fidélité (🔄 🌟 👑 🔥) se débloquent automatiquement dans l'écran Récompenses.
- Le message de complétion change à chaque tour avec une citation biblique différente.

---

## 6. Fichier de messages (`src/data/messages.js`)

Tous les textes affichés à l'utilisateur sont centralisés dans ce fichier :

| Clé | Contenu |
|---|---|
| `CELEBRATION.default` | Message générique après validation |
| `CELEBRATION.days[N]` | Message spécifique au jour N |
| `REFLECTION_QUESTION` | Question posée après chaque validation |
| `REREAD_MESSAGES[0/1/2]` | Messages de relecture (1ère, 2ème, 3ème+) |
| `COMPLETION_MESSAGES.first` | Message fin du 1er tour |
| `COMPLETION_MESSAGES.repeat(n)` | Message fin du tour n (avec citation) |
| `TOUR_BADGES` | Définition des 4 badges de tours |
| `TOASTS` | Tous les messages courts (toasts) |

**Pour modifier un message :** éditer `src/data/messages.js` uniquement — sans toucher à `main.js`.

---

## 7. Fonctionnement hors ligne (PWA)

1. Premier accès → tous les fichiers (dont `lsg-nt.json`) mis en cache.
2. Le navigateur propose « Ajouter à l'écran d'accueil ».
3. L'app fonctionne sans connexion, le texte biblique aussi.
4. La progression est sauvegardée localement même hors ligne.

**Appareils supportés :**
- ✅ iPhone (Safari) — « Partager » > « Sur l'écran d'accueil »
- ✅ Android (Chrome) — bannière automatique
- ✅ Ordinateur (Chrome, Edge) — icône dans la barre d'adresse

---

## 8. Stockage des données

**Clé localStorage :** `mission31:state:v1`

| Champ | Type | Description |
|---|---|---|
| `startedAt` | string ISO | Date de démarrage du tour courant |
| `progress` | objet | `{ [jour]: { done, doneAt, batchSize } }` |
| `reReads` | objet | `{ [jour]: nombre }` — relectures par jour |
| `completionCount` | nombre | Nombre de tours de 31 jours terminés |
| `reminders` | objet | `{ enabled, times[], message }` |
| `lastSyncedAt` | string ISO | Dernier sync Supabase réussi |
| `memoryVerses` | tableau | Versets à mémoriser |
| `theme` | string | `'auto'` \| `'light'` \| `'dark'` |
| `notes` | tableau | Notes par chapitre/jour |
| `highlights` | objet | Surlignages de versets |

**Envoyé au serveur (Supabase, optionnel) :** UUID anonyme + jours validés + mission terminée.
**Jamais envoyé :** prénom, email, IP nominative, données personnelles.

---

## 9. Communauté WhatsApp

- Lien : `https://chat.whatsapp.com/I3ofVHRDGPlEEmCtzSSsxV?mode=gi_t`
- Affiché sur l'accueil, le welcome et la page d'aide.

---

## 10. Contact développeur

- Email : `djochristkfreelance@gmail.com`
- Lien mailto direct sur l'écran d'aide.

---

## 11. Cycle de vie d'un utilisateur type

1. Marie découvre Mission 31 sur WhatsApp, clique sur le lien.
2. Elle voit l'écran d'accueil → **« Commencer la mission »** → arrivée sur l'accueil.
3. Elle installe l'app (bannière ou page Aide).
4. **Jour 1** : elle lit Matthieu 1-9 dans le lecteur → valide → **modal de célébration** avec message « Premier pas franchi ! » + question de réflexion → elle prend une note.
5. Elle surligne un verset qui l'a marquée.
6. **Jour 3** : badge 🚀 **Lancé** débloqué.
7. **Jour 7** : badge 🔑 **Discipline** + message de célébration spécifique.
8. Elle relit le Jour 5 → bouton « Valider la relecture » → message de 1ère relecture.
9. Elle relit le Jour 5 une 2ème fois → message avec citation sur la répétition (Josué 1:8).
10. Si elle a du retard, elle utilise une lecture ×2 → badge ⚡ **Accélération**.
11. **Jour 31** → écran de complétion, **compteur de tours = 1**, bouton **« Nouvelle lancée »**.
12. Elle relance → nouveau tour, ses badges de fidélité s'accumulent.

---

## 12. Limites connues

- La progression est liée au navigateur — pas d'export de données.
- Pas de compte utilisateur : volontaire, pour rester simple et anonyme.
- Les rappels nécessitent que l'app soit ouverte (pas de push en arrière-plan sur iOS).
- Le texte biblique nécessite un accès réseau au premier chargement (ensuite mis en cache).
