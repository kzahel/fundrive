export interface ScoreEntry {
  distance: number;
  coins: number;
  score: number;
  car: string;
  seed: number;
  date: string;
}

const STORAGE_KEY = 'fundrive-scores';
const MAX_SCORES = 10;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScoreEntry[];
  } catch {
    return [];
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, MAX_SCORES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(top));
  return top;
}
