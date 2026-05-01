// ============================================================
// MISSION 31 - Fichier de messages
// Modifie ce fichier pour personnaliser tous les textes
// envoyés à l'utilisateur à chaque étape de la mission.
// ============================================================

// ------------------------------------------------------------
// Célébration après validation d'un jour (modal plein écran)
// ------------------------------------------------------------
export const CELEBRATION = {
  // Message par défaut si aucun message spécifique n'est défini pour le jour
  default: {
    title: "Félicitations !",
    body: "Une nouvelle journée de Parole accomplie. Continue, la régularité est la clé de la transformation.",
  },

  // Messages spécifiques par jour (optionnels, le jour est la clé)
  days: {
    1: {
      title: "Premier pas franchi !",
      body: "« Le chemin de mille lieues commence par un seul pas. » Tu viens de poser le premier. Bien joué.",
    },
    3: {
      title: "3 jours, déjà !",
      body: "La constance se construit jour après jour. Tu montres déjà de la discipline, continue.",
    },
    7: {
      title: "Une semaine complète !",
      body: "« Heureux l'homme... qui trouve son plaisir dans la loi de l'Éternel, et qui la médite jour et nuit. » (Psaumes 1:1-2)",
    },
    15: {
      title: "À mi-chemin !",
      body: "Tu es à la moitié du Nouveau Testament. Ce que tu lis change ta façon de voir le monde, tiens bon.",
    },
    28: {
      title: "Plus que 3 jours !",
      body: "« Ne te lasse pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas. » (Galates 6:9)",
    },
    31: {
      title: "Mission accomplie ! 🎉",
      body: "Tu as terminé le Nouveau Testament. « Car la parole de Dieu est vivante et efficace. » (Hébreux 4:12)",
    },
  },
};

// ------------------------------------------------------------
// Question posée après chaque validation du jour
// (incite à la réflexion et à la prise de notes)
// ------------------------------------------------------------
export const REFLECTION_QUESTION = "Qu'as-tu appris ou retenu aujourd'hui ?";

// ------------------------------------------------------------
// Messages de relecture
// Affiché quand l'utilisateur relit un jour déjà validé.
// L'index correspond au nombre de relectures (0 = 1ère relecture).
// Le dernier message est utilisé pour toutes les relectures suivantes.
// ------------------------------------------------------------
export const REREAD_MESSAGES = [
  // 1ère relecture
  {
    title: "Relecture accomplie !",
    body: "Revenir sur la Parole, c'est lui permettre de creuser plus profond. Chaque lecture révèle quelque chose de nouveau.",
  },
  // 2ème relecture
  {
    title: "Deuxième relecture !",
    body: "La répétition est un principe fondateur que Dieu lui-même a utilisé. Moïse a reçu la Loi, puis l'a répétée intégralement au peuple : c'est le sens même du mot « Deutéronome ». « Ce livre de la loi ne s'éloignera point de ta bouche ; tu le méditeras jour et nuit. » (Josué 1:8)",
  },
  // 3ème relecture et au-delà
  {
    title: "Tu médites en profondeur !",
    body: "Tu atteins un niveau où la Parole est ancrée en toi. Le prophète l'a annoncé : « Je mettrai ma loi au dedans d'eux, je l'écrirai dans leur cœur. » (Jérémie 31:33). Quand on relit plusieurs fois, on n'est plus seulement lecteur, on devient disciple.",
  },
];

// ------------------------------------------------------------
// Messages de fin de tour (complétion des 31 jours)
// ------------------------------------------------------------
export const COMPLETION_MESSAGES = {
  // 1er tour terminé
  first: {
    title: "Mission accomplie ! 🏆",
    body: "Tu as terminé le Nouveau Testament en 31 jours. Que Dieu te bénisse abondamment. « Car la parole de Dieu est vivante et efficace, plus tranchante qu'une épée quelconque à deux tranchants. » (Hébreux 4:12)",
    cta: "Nouvelle lancée",
  },
  // Tours suivants (la fonction reçoit le numéro du tour)
  repeat: (count) => ({
    title: `Tour n°${count} accompli ! 🔥`,
    body: [
      "« Ce livre de la loi ne s'éloignera point de ta bouche ; tu le méditeras jour et nuit, afin d'agir fidèlement selon tout ce qui y est écrit. » (Josué 1:8)",
      "« Heureux celui qui lit et ceux qui entendent les paroles de cette prophétie, et qui gardent les choses qui y sont écrites ! » (Apocalypse 1:3)",
      "« Ainsi en est-il de ma parole, qui sort de ma bouche : elle ne retourne point à moi sans effet, sans avoir exécuté ma volonté et accompli mes desseins. » (Ésaïe 55:11)",
      "« Tes paroles ont été trouvées, et je les ai mangées ; tes paroles ont été pour moi ma joie et l'allégresse de mon cœur. » (Jérémie 15:16)",
    ][(count - 2) % 4],
    cta: "Nouvelle lancée",
  }),
};

// ------------------------------------------------------------
// Badges de tours complétés
// Chaque badge se débloque quand completionCount >= required
// ------------------------------------------------------------
export const TOUR_BADGES = [
  {
    id: "tour2",
    name: "Deuxième souffle",
    desc: "2 tours complets",
    emoji: "🔄",
    required: 2,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>`,
  },
  {
    id: "tour3",
    name: "Fidèle",
    desc: "3 tours complets",
    emoji: "🌟",
    required: 3,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  {
    id: "tour5",
    name: "Pilier",
    desc: "5 tours complets",
    emoji: "👑",
    required: 5,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17L5 7l5 5 4-9 4 9 5-5 3 10H2z"/><line x1="2" y1="21" x2="22" y2="21"/></svg>`,
  },
  {
    id: "tour10",
    name: "Légende",
    desc: "10 tours complets",
    emoji: "🔥",
    required: 10,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  },
];

// ------------------------------------------------------------
// Toast / messages courts (notifications légères)
// ------------------------------------------------------------
export const TOASTS = {
  resetConfirm: "Ta progression a été réinitialisée.",
  reminderSaved: "Rappels enregistrés !",
  notifEnabled: "Notifications activées !",
  notifDenied: "Permission refusée. Modifie les réglages du navigateur.",
  highlightRemoved: "Surligné retiré",
  highlights: { yellow: "Jaune", green: "Vert", blue: "Bleu", pink: "Rose" },
  noteSaved: "Note enregistrée.",
  noteDeleted: "Note supprimée.",
  memoryAdded: "Verset ajouté !",
  memoryDeleted: "Verset supprimé.",
  newRunStarted: "Nouvelle lancée démarrée ! Bonne lecture 🙏",
};
