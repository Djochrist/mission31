// Système de récompenses (bilingue FR/EN)
export const badges = [
  { id: "lance",       name: "Lancé",             nameEn: "Launched",         category: "completed", required: 3,  icon: "rocket",  desc: "3 jours",          descEn: "3 days",   color: "#f4d03f" },
  { id: "discipline",  name: "Discipline",         nameEn: "Discipline",       category: "completed", required: 7,  icon: "key",     desc: "7 jours",          descEn: "7 days",   color: "#48c9b0" },
  { id: "engagement",  name: "Engagement",         nameEn: "Commitment",       category: "completed", required: 15, icon: "lock",    desc: "15 jours",         descEn: "15 days",  color: "#eb984e" },
  { id: "perseverant", name: "Persévérant",        nameEn: "Perseverant",      category: "completed", required: 21, icon: "shield",  desc: "21 jours",         descEn: "21 days",  color: "#8e44ad" },
  { id: "determine",   name: "Déterminé",          nameEn: "Determined",       category: "completed", required: 28, icon: "compass", desc: "28 jours",         descEn: "28 days",  color: "#e74c3c" },
  { id: "accompli",    name: "Mission accomplie",  nameEn: "Mission complete", category: "completed", required: 31, icon: "trophy",  desc: "31 jours",         descEn: "31 days",  color: "#3498db" },
];

export function unlockedBadges(state) {
  const completed = Object.values(state.progress || {}).filter((d) => d.done).length;
  const result = new Set();
  badges.forEach((b) => {
    if (b.category === "completed" && completed >= b.required) result.add(b.id);
  });
  return result;
}
