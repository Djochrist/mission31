// Plan de lecture du Nouveau Testament en 31 jours
// 260 chapitres au total répartis en portions équilibrées
// Les dates affichées sont calculées dynamiquement depuis la date
// de démarrage de l'utilisateur (date réelle du téléphone).

export const readings = [
  { day: 1,  passages: ["Matthieu 1-9"] },
  { day: 2,  passages: ["Matthieu 10-18"] },
  { day: 3,  passages: ["Matthieu 19-27"] },
  { day: 4,  passages: ["Matthieu 28", "Marc 1-8"] },
  { day: 5,  passages: ["Marc 9-16", "Luc 1"] },
  { day: 6,  passages: ["Luc 2-10"] },
  { day: 7,  passages: ["Luc 11-19"] },
  { day: 8,  passages: ["Luc 20-24", "Jean 1-4"] },
  { day: 9,  passages: ["Jean 5-13"] },
  { day: 10, passages: ["Jean 14-21", "Actes 1"] },
  { day: 11, passages: ["Actes 2-10"] },
  { day: 12, passages: ["Actes 11-19"] },
  { day: 13, passages: ["Actes 20-28"] },
  { day: 14, passages: ["Romains 1-9"] },
  { day: 15, passages: ["Romains 10-16", "1 Corinthiens 1-2"] },
  { day: 16, passages: ["1 Corinthiens 3-11"] },
  { day: 17, passages: ["1 Corinthiens 12-16", "2 Corinthiens 1-4"] },
  { day: 18, passages: ["2 Corinthiens 5-13"] },
  { day: 19, passages: ["Galates 1-6", "Éphésiens 1-3"] },
  { day: 20, passages: ["Éphésiens 4-6", "Philippiens 1-4", "Colossiens 1-2"] },
  { day: 21, passages: ["Colossiens 3-4", "1 Thessaloniciens 1-5", "2 Thessaloniciens 1-2"] },
  { day: 22, passages: ["2 Thessaloniciens 3", "1 Timothée 1-6", "2 Timothée 1-2"] },
  { day: 23, passages: ["2 Timothée 3-4", "Tite 1-3", "Philémon", "Hébreux 1-3"] },
  { day: 24, passages: ["Hébreux 4-12"] },
  { day: 25, passages: ["Hébreux 13", "Jacques 1-5", "1 Pierre 1-3"] },
  { day: 26, passages: ["1 Pierre 4-5", "2 Pierre 1-3", "1 Jean 1-4"] },
  { day: 27, passages: ["1 Jean 5", "2 Jean", "3 Jean", "Jude", "Apocalypse 1-5"] },
  { day: 28, passages: ["Apocalypse 6-14"] },
  { day: 29, passages: ["Apocalypse 15-19"] },
  { day: 30, passages: ["Apocalypse 20-21"] },
  { day: 31, passages: ["Apocalypse 22"] },
];

export function passagesText(day) {
  const r = readings.find((x) => x.day === day);
  return r ? r.passages.join(", ") : "";
}
