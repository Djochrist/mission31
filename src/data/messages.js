// ============================================================
// MISSION 31 - Messages (FR + EN)
// ============================================================

// ── Célébration après validation ─────────────────────────────
export const CELEBRATION = {
  default: {
    fr: { title: "Félicitations !", body: "Une nouvelle journée de Parole accomplie. Continue, la régularité est la clé de la transformation." },
    en: { title: "Congratulations!", body: "Another day in the Word accomplished. Keep going — consistency is the key to transformation." },
  },
  days: {
    1: {
      fr: { title: "Premier pas franchi !", body: "« Le chemin de mille lieues commence par un seul pas. » Tu viens de poser le premier. Bien joué." },
      en: { title: "First step taken!", body: "\"A journey of a thousand miles begins with a single step.\" You've just taken yours. Well done." },
    },
    3: {
      fr: { title: "3 jours, déjà !", body: "La constance se construit jour après jour. Tu montres déjà de la discipline, continue." },
      en: { title: "3 days already!", body: "Consistency is built day by day. You're already showing discipline — keep it up." },
    },
    7: {
      fr: { title: "Une semaine complète !", body: "« Heureux l'homme... qui trouve son plaisir dans la loi de l'Éternel, et qui la médite jour et nuit. » (Psaumes 1:1-2)" },
      en: { title: "A full week!", body: "\"Blessed is the man... whose delight is in the law of the Lord, and who meditates on his law day and night.\" (Psalm 1:1-2)" },
    },
    15: {
      fr: { title: "À mi-chemin !", body: "Tu es à la moitié du Nouveau Testament. Ce que tu lis change ta façon de voir le monde, tiens bon." },
      en: { title: "Halfway there!", body: "You're halfway through the New Testament. What you're reading is changing the way you see the world — hold on." },
    },
    28: {
      fr: { title: "Plus que 3 jours !", body: "« Ne te lasse pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas. » (Galates 6:9)" },
      en: { title: "Only 3 days left!", body: "\"And let us not be weary in well doing: for in due season we shall reap, if we faint not.\" (Galatians 6:9)" },
    },
    31: {
      fr: { title: "Mission accomplie ! 🎉", body: "Tu as terminé le Nouveau Testament. « Car la parole de Dieu est vivante et efficace. » (Hébreux 4:12)" },
      en: { title: "Mission complete! 🎉", body: "You've finished the New Testament. \"For the word of God is quick, and powerful.\" (Hebrews 4:12)" },
    },
  },
};

// ── Question de réflexion ─────────────────────────────────────
export const REFLECTION_QUESTION = {
  fr: "Qu'as-tu appris ou retenu aujourd'hui ?",
  en: "What did you learn or take away today?",
};

// ── Messages de relecture ─────────────────────────────────────
export const REREAD_MESSAGES = [
  {
    fr: { title: "Relecture accomplie !", body: "Revenir sur la Parole, c'est lui permettre de creuser plus profond. Chaque lecture révèle quelque chose de nouveau." },
    en: { title: "Re-reading complete!", body: "Returning to the Word allows it to dig deeper. Each reading reveals something new." },
  },
  {
    fr: { title: "Deuxième relecture !", body: "La répétition est un principe fondateur que Dieu lui-même a utilisé. Moïse a reçu la Loi, puis l'a répétée intégralement au peuple : c'est le sens même du mot « Deutéronome ». « Ce livre de la loi ne s'éloignera point de ta bouche ; tu le méditeras jour et nuit. » (Josué 1:8)" },
    en: { title: "Second re-reading!", body: "Repetition is a founding principle that God himself used. Moses received the Law and repeated it entirely to the people — that's the very meaning of 'Deuteronomy'. \"This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night.\" (Joshua 1:8)" },
  },
  {
    fr: { title: "Tu médites en profondeur !", body: "Tu atteins un niveau où la Parole est ancrée en toi. Le prophète l'a annoncé : « Je mettrai ma loi au dedans d'eux, je l'écrirai dans leur cœur. » (Jérémie 31:33). Quand on relit plusieurs fois, on n'est plus seulement lecteur, on devient disciple." },
    en: { title: "Deep meditation!", body: "You're reaching a level where the Word is anchored within you. The prophet announced it: \"I will put my law in their inward parts, and write it in their hearts.\" (Jeremiah 31:33). When you re-read multiple times, you're no longer just a reader — you become a disciple." },
  },
];

// ── Messages de fin de tour ───────────────────────────────────
export const COMPLETION_MESSAGES = {
  first: {
    fr: { title: "Mission accomplie ! 🏆", body: "Tu as terminé le Nouveau Testament en 31 jours. Que Dieu te bénisse abondamment. « Car la parole de Dieu est vivante et efficace, plus tranchante qu'une épée quelconque à deux tranchants. » (Hébreux 4:12)", cta: "Nouvelle lancée" },
    en: { title: "Mission complete! 🏆", body: "You've finished the New Testament in 31 days. May God bless you abundantly. \"For the word of God is quick, and powerful, and sharper than any twoedged sword.\" (Hebrews 4:12)", cta: "New round" },
  },
  repeat: (count) => ({
    fr: {
      title: `Tour n°${count} accompli ! 🔥`,
      body: [
        "« Ce livre de la loi ne s'éloignera point de ta bouche ; tu le méditeras jour et nuit, afin d'agir fidèlement selon tout ce qui y est écrit. » (Josué 1:8)",
        "« Heureux celui qui lit et ceux qui entendent les paroles de cette prophétie, et qui gardent les choses qui y sont écrites ! » (Apocalypse 1:3)",
        "« Ainsi en est-il de ma parole, qui sort de ma bouche : elle ne retourne point à moi sans effet, sans avoir exécuté ma volonté et accompli mes desseins. » (Ésaïe 55:11)",
        "« Tes paroles ont été trouvées, et je les ai mangées ; tes paroles ont été pour moi ma joie et l'allégresse de mon cœur. » (Jérémie 15:16)",
      ][(count - 2) % 4],
      cta: "Nouvelle lancée",
    },
    en: {
      title: `Round ${count} complete! 🔥`,
      body: [
        "\"This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night.\" (Joshua 1:8)",
        "\"Blessed is he that readeth, and they that hear the words of this prophecy, and keep those things which are written therein.\" (Revelation 1:3)",
        "\"So shall my word be that goeth forth out of my mouth: it shall not return unto me void, but it shall accomplish that which I please.\" (Isaiah 55:11)",
        "\"Thy words were found, and I did eat them; and thy word was unto me the joy and rejoicing of mine heart.\" (Jeremiah 15:16)",
      ][(count - 2) % 4],
      cta: "New round",
    },
  }),
};

// ── Badges de tours ───────────────────────────────────────────
export const TOUR_BADGES = [
  {
    id: "tour2",
    name: { fr: "Deuxième souffle", en: "Second wind" },
    desc: { fr: "2 tours complets", en: "2 complete rounds" },
    emoji: "🔄",
    required: 2,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>`,
  },
  {
    id: "tour3",
    name: { fr: "Fidèle", en: "Faithful" },
    desc: { fr: "3 tours complets", en: "3 complete rounds" },
    emoji: "🌟",
    required: 3,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  {
    id: "tour5",
    name: { fr: "Pilier", en: "Pillar" },
    desc: { fr: "5 tours complets", en: "5 complete rounds" },
    emoji: "👑",
    required: 5,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17L5 7l5 5 4-9 4 9 5-5 3 10H2z"/><line x1="2" y1="21" x2="22" y2="21"/></svg>`,
  },
  {
    id: "tour10",
    name: { fr: "Légende", en: "Legend" },
    desc: { fr: "10 tours complets", en: "10 complete rounds" },
    emoji: "🔥",
    required: 10,
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  },
];

// ── Toasts ────────────────────────────────────────────────────
export const TOASTS = {
  resetConfirm: { fr: "Ta progression a été réinitialisée.", en: "Your progress has been reset." },
  reminderSaved: { fr: "Rappels enregistrés !", en: "Reminders saved!" },
  notifEnabled: { fr: "Notifications activées !", en: "Notifications enabled!" },
  notifDenied: { fr: "Permission refusée. Modifie les réglages du navigateur.", en: "Permission denied. Update your browser settings." },
  highlightRemoved: { fr: "Surligné retiré", en: "Highlight removed" },
  highlights: { yellow: { fr: "Jaune", en: "Yellow" }, green: { fr: "Vert", en: "Green" }, blue: { fr: "Bleu", en: "Blue" }, pink: { fr: "Rose", en: "Pink" } },
  noteSaved: { fr: "Note enregistrée.", en: "Note saved." },
  noteDeleted: { fr: "Note supprimée.", en: "Note deleted." },
  memoryAdded: { fr: "Verset ajouté !", en: "Verse added!" },
  memoryDeleted: { fr: "Verset supprimé.", en: "Verse removed." },
  newRunStarted: { fr: "Nouvelle lancée démarrée ! Bonne lecture 🙏", en: "New round started! Happy reading 🙏" },
};
