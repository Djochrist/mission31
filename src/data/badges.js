// Système de récompenses
export const badges = [
  // Badges débloqués par jours complétés
  { id: "lance",        name: "Lancé",        category: "completed", required: 3,  icon: "rocket",  desc: "3 jours" },
  { id: "discipline",   name: "Discipline",   category: "completed", required: 7,  icon: "key",     desc: "7 jours" },
  { id: "engagement",   name: "Engagement",   category: "completed", required: 15, icon: "lock",    desc: "15 jours" },
  { id: "perseverant",  name: "Persévérant",  category: "completed", required: 21, icon: "shield",  desc: "21 jours" },
  { id: "determine",    name: "Déterminé",    category: "completed", required: 28, icon: "compass", desc: "28 jours" },
  { id: "accompli",     name: "Mission accomplie", category: "completed", required: 31, icon: "trophy", desc: "31 jours" },
];

export function unlockedBadges(state) {
  const completed = Object.values(state.progress || {}).filter((d) => d.done).length;
  const result = new Set();

  badges.forEach((b) => {
    if (b.category === "completed" && completed >= b.required) result.add(b.id);
  });

  return result;
}
