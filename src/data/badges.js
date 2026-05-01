// Système de récompenses
export const badges = [
  // Badges débloqués par jours complétés
  { id: "lance",        name: "Lancé",        category: "completed", required: 3,  icon: "rocket",  desc: "3 jours",               color: "#f4d03f" },
  { id: "discipline",   name: "Discipline",   category: "completed", required: 7,  icon: "key",     desc: "7 jours",              color: "#48c9b0" },
  { id: "engagement",   name: "Engagement",   category: "completed", required: 15, icon: "lock",    desc: "15 jours",             color: "#eb984e" },
  { id: "perseverant",  name: "Persévérant",  category: "completed", required: 21, icon: "shield",  desc: "21 jours",             color: "#8e44ad" },
  { id: "determine",    name: "Déterminé",    category: "completed", required: 28, icon: "compass", desc: "28 jours",             color: "#e74c3c" },
  { id: "accompli",     name: "Mission accomplie", category: "completed", required: 31, icon: "trophy", desc: "31 jours",         color: "#3498db" },
];

export function unlockedBadges(state) {
  const completed = Object.values(state.progress || {}).filter((d) => d.done).length;
  const result = new Set();

  badges.forEach((b) => {
    if (b.category === "completed" && completed >= b.required) result.add(b.id);
  });

  return result;
}
