// Système de récompenses
export const badges = [
  // Badges débloqués par jours complétés
  { id: "lance",        name: "Lancé",        category: "completed", required: 3,  icon: "rocket",  desc: "3 jours" },
  { id: "discipline",   name: "Discipline",   category: "completed", required: 7,  icon: "key",     desc: "7 jours" },
  { id: "engagement",   name: "Engagement",   category: "completed", required: 15, icon: "lock",    desc: "15 jours" },
  { id: "perseverant",  name: "Persévérant",  category: "completed", required: 21, icon: "shield",  desc: "21 jours" },
  { id: "determine",    name: "Déterminé",    category: "completed", required: 28, icon: "compass", desc: "28 jours" },
  { id: "accompli",     name: "Mission accomplie", category: "completed", required: 31, icon: "trophy", desc: "31 jours" },

  // Badges spéciaux liés aux lectures accélérées
  { id: "acceleration", name: "Accélération", category: "special", required: 1, icon: "bolt",    desc: "Utiliser un double" },
  { id: "focus",        name: "Focus extrême",category: "special", required: 1, icon: "flame",   desc: "Utiliser un triple" },
  { id: "marathon",     name: "Marathon",     category: "special", required: 1, icon: "medal",   desc: "Valider 15 jours" },
];

export function unlockedBadges(state) {
  const completed = Object.values(state.progress || {}).filter((d) => d.done).length;
  const result = new Set();

  badges.forEach((b) => {
    if (b.category === "completed" && completed >= b.required) result.add(b.id);
  });

  // Spéciaux
  const usedDouble  = Object.values(state.progress || {}).some((d) => d.batchSize === 2);
  const usedTriple  = Object.values(state.progress || {}).some((d) => d.batchSize === 3);
  const usedMega    = Object.values(state.progress || {}).some((d) => d.batchSize >= 15);
  if (usedDouble) result.add("acceleration");
  if (usedTriple) result.add("focus");
  if (usedMega || completed >= 15) result.add("marathon");

  return result;
}
