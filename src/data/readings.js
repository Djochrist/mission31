// Plan de lecture du Nouveau Testament en 31 jours (mai)
// 260 chapitres au total répartis en portions équilibrées

export const readings = [
  { day: 1,  date: "1 Mai",  passages: ["Matthieu 1-9"] },
  { day: 2,  date: "2 Mai",  passages: ["Matthieu 10-18"] },
  { day: 3,  date: "3 Mai",  passages: ["Matthieu 19-27"] },
  { day: 4,  date: "4 Mai",  passages: ["Matthieu 28", "Marc 1-8"] },
  { day: 5,  date: "5 Mai",  passages: ["Marc 9-16", "Luc 1"] },
  { day: 6,  date: "6 Mai",  passages: ["Luc 2-10"] },
  { day: 7,  date: "7 Mai",  passages: ["Luc 11-19"] },
  { day: 8,  date: "8 Mai",  passages: ["Luc 20-24", "Jean 1-4"] },
  { day: 9,  date: "9 Mai",  passages: ["Jean 5-13"] },
  { day: 10, date: "10 Mai", passages: ["Jean 14-21", "Actes 1"] },
  { day: 11, date: "11 Mai", passages: ["Actes 2-10"] },
  { day: 12, date: "12 Mai", passages: ["Actes 11-19"] },
  { day: 13, date: "13 Mai", passages: ["Actes 20-28"] },
  { day: 14, date: "14 Mai", passages: ["Romains 1-9"] },
  { day: 15, date: "15 Mai", passages: ["Romains 10-16", "1 Corinthiens 1-2"] },
  { day: 16, date: "16 Mai", passages: ["1 Corinthiens 3-11"] },
  { day: 17, date: "17 Mai", passages: ["1 Corinthiens 12-16", "2 Corinthiens 1-4"] },
  { day: 18, date: "18 Mai", passages: ["2 Corinthiens 5-13"] },
  { day: 19, date: "19 Mai", passages: ["Galates 1-6", "Éphésiens 1-3"] },
  { day: 20, date: "20 Mai", passages: ["Éphésiens 4-6", "Philippiens 1-4", "Colossiens 1-2"] },
  { day: 21, date: "21 Mai", passages: ["Colossiens 3-4", "1 Thessaloniciens 1-5", "2 Thessaloniciens 1-2"] },
  { day: 22, date: "22 Mai", passages: ["2 Thessaloniciens 3", "1 Timothée 1-6", "2 Timothée 1-2"] },
  { day: 23, date: "23 Mai", passages: ["2 Timothée 3-4", "Tite 1-3", "Philémon", "Hébreux 1-3"] },
  { day: 24, date: "24 Mai", passages: ["Hébreux 4-12"] },
  { day: 25, date: "25 Mai", passages: ["Hébreux 13", "Jacques 1-5", "1 Pierre 1-3"] },
  { day: 26, date: "26 Mai", passages: ["1 Pierre 4-5", "2 Pierre 1-3", "1 Jean 1-4"] },
  { day: 27, date: "27 Mai", passages: ["1 Jean 5", "2 Jean", "3 Jean", "Jude", "Apocalypse 1-5"] },
  { day: 28, date: "28 Mai", passages: ["Apocalypse 6-14"] },
  { day: 29, date: "29 Mai", passages: ["Apocalypse 15-19"] },
  { day: 30, date: "30 Mai", passages: ["Apocalypse 20-21"] },
  { day: 31, date: "31 Mai", passages: ["Apocalypse 22"] },
];

export function passagesText(day) {
  const r = readings.find((x) => x.day === day);
  return r ? r.passages.join(", ") : "";
}
