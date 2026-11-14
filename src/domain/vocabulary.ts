import type {Word} from './models';

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;
export type VocabularyMode = 'cards' | 'translation' | 'context';
export type VocabularyQueueKind = 'due' | 'new';

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function isTranslationCorrect(answer: string, translation: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(translation);
}

export function nextReviewInterval(currentIntervalDays: number, known: boolean): number {
  if (!known) return REVIEW_INTERVALS[0];
  return REVIEW_INTERVALS.find(days => days > currentIntervalDays) ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

export function reviewSchedule(currentIntervalDays: number, known: boolean, reviewedAt = new Date()) {
  const intervalDays = nextReviewInterval(currentIntervalDays, known);
  return {
    intervalDays,
    reviewIntervalDays: known ? intervalDays : 0,
    status: known && intervalDays >= 14 ? 'learned' as const : 'learning' as const,
    nextReviewAt: new Date(reviewedAt.getTime() + intervalDays * 86400000).toISOString(),
  };
}

export function makeClozeSentence(example: string | undefined, term: string): string | null {
  const sentence = example?.trim();
  const word = term.trim();
  if (!sentence || !word) return null;
  if (/_{2,}/.test(sentence)) return sentence;

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const match = new RegExp(`\\b${escaped}\\b`, 'i');
  return match.test(sentence) ? sentence.replace(match, '_____') : null;
}

function isUsableInMode(word: Word, mode: VocabularyMode): boolean {
  if (!word.term?.trim() || !word.translation?.trim()) return false;
  return mode !== 'context' || makeClozeSentence(word.example, word.term) !== null;
}

export function vocabularyQueue(
  words: Word[],
  mode: VocabularyMode,
  kind: VocabularyQueueKind,
  now = new Date(),
): Word[] {
  return words.filter(word => {
    if (!isUsableInMode(word, mode)) return false;
    const due = !!word.nextReviewAt && Date.parse(word.nextReviewAt) <= now.getTime();
    return kind === 'due' ? due : word.status === 'new' && !due;
  });
}

export function shuffleWords(words: Word[], random = Math.random): Word[] {
  const shuffled = [...words];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function wordOfDay(words: Word[], date = new Date()): Word | null {
  if (!words.length) return null;
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return words[((day % words.length) + words.length) % words.length];
}
