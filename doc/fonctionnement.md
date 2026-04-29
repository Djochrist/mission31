# Mission 31 — Fonctionnement détaillé

> Ce document explique **tout** ce que l'application fait, écran par écran, du point de vue de l'utilisateur final. Aucun code ici. Pour la partie code, voir `technique.md`.

---

## 1. Vue d'ensemble

**Mission 31** est une application web (PWA) qui propose de lire l'intégralité du **Nouveau Testament en 31 jours**, du 1er au 31 mai 2026.

- **260 chapitres** du Nouveau Testament, répartis en **31 lectures quotidiennes**.
- L'utilisateur coche les chapitres lus → sa progression est sauvegardée localement (sur son téléphone/ordinateur).
- L'application fonctionne **hors ligne** (PWA installable).
- Des **badges** récompensent les étapes franchies.
- Une page de **statistiques globales** (optionnelle) montre combien de personnes participent dans le monde.
- Possibilité de rejoindre une **communauté WhatsApp** pour s'encourager.

**Public visé :** chrétiens francophones, débutants ou habitués de la lecture biblique.

---

## 2. Les 12 écrans de l'application

### 2.1. Écran d'accueil (`welcome`)

Premier écran vu par un nouvel utilisateur.

**Contenu :**
- Logo / titre **Mission 31**
- Phrase d'accroche : « Lis le Nouveau Testament en 31 jours »
- Dates de la mission (1er → 31 mai 2026)
- Bouton **« Commencer »** → demande le prénom
- Bandeau d'invitation à rejoindre la communauté WhatsApp

**Comportement :**
- Si l'utilisateur a déjà commencé (un prénom est enregistré), il est automatiquement redirigé vers l'écran **Accueil** la prochaine fois qu'il ouvre l'app.

---

### 2.2. Écran Prénom (`name`)

**Contenu :**
- Champ texte « Comment t'appelles-tu ? »
- Bouton **« Continuer »**

**Comportement :**
- Le prénom est enregistré dans le navigateur (localStorage).
- Sert uniquement à personnaliser les messages (« Bonjour Marie ! »).
- Aucune donnée n'est envoyée à un serveur à cette étape.

---

### 2.3. Écran Accueil (`home`)

C'est le tableau de bord principal.

**Contenu affiché :**
- Salutation personnalisée : « Bonjour [Prénom] »
- **Jour actuel** de la mission (Jour 1 sur 31, etc.)
- **Lecture du jour** : titre + nombre de chapitres
- Bouton **« Commencer la lecture »** ou **« Continuer »**
- Mini-statistiques personnelles : chapitres lus / total
- Barre de progression
- Lien rapide vers la communauté WhatsApp

**Logique du jour affiché :**
- Avant le 1er mai 2026 : « La mission commence dans X jours »
- Du 1er au 31 mai 2026 : affiche le jour correspondant (Jour 1 = 1er mai…)
- Après le 31 mai 2026 : affiche « Mission terminée » avec récapitulatif

---

### 2.4. Écran Lecture (`reading`)

L'écran le plus utilisé : c'est ici qu'on coche les chapitres lus.

**Contenu :**
- En-tête : « Jour X — [Titre du jour] »
- Liste des chapitres prévus pour ce jour
  - Exemple Jour 1 : Matthieu 1, Matthieu 2, Matthieu 3…
- Chaque chapitre est une **case à cocher** (touchable au doigt)
- Indicateur : « X / Y chapitres lus aujourd'hui »
- Bouton **« Terminer la lecture »** quand tout est coché

**Comportement :**
- Cocher un chapitre → enregistré immédiatement.
- Si tous les chapitres du jour sont cochés → la mission du jour est marquée **complétée**.
- Possibilité de naviguer vers d'autres jours via le bouton **Plan**.

---

### 2.5. Écran Plan complet (`plan`)

Vue d'ensemble des **31 jours**.

**Contenu :**
- Liste des 31 jours, avec pour chacun :
  - Numéro du jour
  - Titre (ex. « Évangile selon Matthieu — début »)
  - Statut : ✅ terminé / 🔵 en cours / ⚪ à venir / 🔴 manqué
- Cliquer sur un jour → ouvre l'écran **Lecture** pour ce jour-là

**Utilité :**
- Permet de rattraper un jour manqué.
- Permet d'avancer si on a du temps.

---

### 2.6. Écran Profil (`profile`)

**Contenu :**
- Prénom de l'utilisateur (modifiable)
- Date de début
- Statistiques personnelles :
  - Chapitres lus / 260
  - Jours complétés / 31
  - Série actuelle (jours consécutifs)
- Bouton **« Réinitialiser ma progression »** (avec confirmation)
- Bouton **« Modifier mon prénom »**

---

### 2.7. Écran Badges (`badges`)

**Contenu :**
- Grille des **9 badges** disponibles
- Chaque badge :
  - Icône
  - Nom (ex. « Premier pas »)
  - Description (ex. « Termine la lecture du jour 1 »)
  - État : 🔓 obtenu (en couleur) / 🔒 verrouillé (grisé)

**Liste des 9 badges :**
1. **Premier pas** — Terminer le jour 1
2. **Une semaine** — 7 jours consécutifs
3. **Mi-chemin** — 50 % des chapitres
4. **Évangéliste** — Terminer les 4 évangiles
5. **Apôtre** — Terminer les Actes
6. **Théologien** — Terminer les épîtres pauliniennes
7. **Visionnaire** — Terminer l'Apocalypse
8. **Persévérant** — 31 jours consécutifs
9. **Mission accomplie** — 100 % des 260 chapitres

---

### 2.8. Écran Statistiques personnelles (`stats`)

**Contenu :**
- Graphiques simples : progression jour par jour
- Total chapitres lus
- Pourcentage d'avancement
- Date estimée de fin (au rythme actuel)

---

### 2.9. Écran Statistiques globales (`globalstats`)

**Contenu (si Supabase est configuré) :**
- **Nombre total de participants** dans le monde
- **Nombre de personnes ayant complété** la mission
- **Taux de complétion** global
- Bandeau d'invitation à la communauté WhatsApp

**Si Supabase n'est PAS configuré :**
- Affiche un message : « Statistiques globales bientôt disponibles »
- Aucune donnée fictive n'est affichée.

**Important :** chaque utilisateur est anonyme. Aucun prénom, aucun email n'est partagé. On envoie seulement un identifiant aléatoire et le compte de chapitres lus.

---

### 2.10. Écran Aide / FAQ (`help`)

**Contenu :**
- Questions fréquentes
- Comment installer l'app sur son téléphone
- Comment utiliser hors ligne
- Comment rattraper un jour manqué
- Lien vers la communauté WhatsApp
- Lien email vers le développeur (mailto direct)

---

### 2.11. Écran Réglages (`settings`)

**Contenu :**
- Mode clair / sombre (par défaut : sombre)
- Notifications (rappel quotidien — si activé par le navigateur)
- Réinitialiser toutes les données
- Version de l'application

---

### 2.12. Écran Fin de mission (`completed`)

Affiché quand l'utilisateur a complété les 31 jours.

**Contenu :**
- Message de félicitations
- Récapitulatif : 260/260 chapitres, 31/31 jours
- Tous les badges obtenus
- Témoignage à partager
- Invitation à recommander à un proche

---

## 3. Fonctionnement hors ligne (PWA)

### Qu'est-ce qu'une PWA ?
Une **Progressive Web App** est un site web qui se comporte comme une application installable.

### Comment ça marche pour l'utilisateur ?
1. Premier accès au site → tous les fichiers sont téléchargés et mis en cache.
2. Le navigateur propose **« Ajouter à l'écran d'accueil »**.
3. Une fois installée, l'app fonctionne **sans connexion Internet**.
4. La progression est sauvegardée dans le navigateur même hors ligne.
5. Quand la connexion revient, les statistiques globales se synchronisent (si Supabase configuré).

### Sur quels appareils ça marche ?
- ✅ iPhone (Safari) — installable depuis le menu « Partager »
- ✅ Android (Chrome) — installable via la bannière qui apparaît
- ✅ Ordinateur (Chrome, Edge) — installable via l'icône dans la barre d'adresse

---

## 4. Stockage des données

### Ce qui est stocké **sur l'appareil de l'utilisateur** (localStorage) :
- Prénom
- Date de début de la mission
- Liste des chapitres cochés
- Liste des badges obtenus
- Préférences (thème, notifications)
- Identifiant anonyme aléatoire (pour les stats globales)

### Ce qui est envoyé au serveur (Supabase, optionnel) :
- Identifiant anonyme aléatoire
- Nombre de chapitres lus
- Nombre de jours complétés
- Mission terminée (oui/non)

**Jamais envoyé :** prénom, email, adresse IP nominative, données personnelles.

### Si l'utilisateur efface ses données navigateur :
- Toute la progression est perdue (c'est inévitable avec localStorage).
- Le compteur global garde l'ancien identifiant comme « participant inactif ».

---

## 5. Communauté WhatsApp

- Lien d'invitation : `https://chat.whatsapp.com/I3ofVHRDGPlEEmCtzSSsxV?mode=gi_t`
- Affiché à 4 endroits : écran d'accueil, accueil principal, aide, statistiques globales.
- C'est un **groupe** (pas un numéro personnel).
- Permet aux participants de s'encourager et de partager.

---

## 6. Contact développeur

- Email : `djochristkfreelance@gmail.com`
- Lien direct (mailto) sur l'écran d'aide.
- Aucun formulaire intermédiaire, aucun bot.

---

## 7. Cycle de vie d'un utilisateur type

1. **J-7** : Marie découvre Mission 31 sur WhatsApp, ouvre le lien.
2. Elle voit l'écran d'accueil → clique sur « Commencer ».
3. Elle entre son prénom → arrive sur l'accueil → voit « La mission commence dans 7 jours ».
4. Elle installe l'app sur son téléphone.
5. **1er mai** : elle ouvre l'app → voit « Jour 1 : Matthieu 1-5 » → lit dans sa Bible → coche les chapitres.
6. Elle obtient le badge **« Premier pas »**.
7. Chaque jour, elle reçoit (si activé) un rappel à 7h.
8. **8 mai** : badge **« Une semaine »**.
9. **15 mai** : badge **« Mi-chemin »**.
10. **31 mai** : badge **« Mission accomplie »** + écran de félicitations.

---

## 8. Limites connues

- La progression est **liée au navigateur**. Si Marie change de téléphone, sa progression ne suit pas (sauf à exporter manuellement — fonctionnalité non incluse).
- Pas de compte utilisateur : c'est volontaire, pour rester simple et anonyme.
- Pas de notifications push hors ligne sur iOS sans installation.

---

**Pour comprendre le code, voir `technique.md`.**
**Pour apprendre à modifier et maintenir l'app, voir le PDF `Formation-Mission-31.pdf`.**
