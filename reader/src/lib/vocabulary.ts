import { normalizeJapanese, type DictionaryResult } from './dictionaryModel';
import type { Token } from './types';

export type VocabularyStatus = 'learning' | 'known';
export interface VocabularyIdentity {
  id: string; lemma: string; reading: string; dictionaryEntryId?: string;
}
export interface LearnerVocabularyItem extends VocabularyIdentity {
  status: VocabularyStatus; createdAt: string; updatedAt: string;
}
export type ImportMode = 'merge' | 'replace';
export interface VocabularyStateService {
  getAll(): Promise<LearnerVocabularyItem[]>;
  getStatus(identity: VocabularyIdentity): Promise<VocabularyStatus | null>;
  setStatus(identity: VocabularyIdentity, status: VocabularyStatus): Promise<void>;
  removeStatus(identity: VocabularyIdentity): Promise<void>;
  clear(): Promise<void>;
  subscribe(listener: () => void): () => void;
  applyRecords(records: LearnerVocabularyItem[], mode: ImportMode, sideEffect?: () => (() => void)): Promise<void>;
}
export function vocabularyId(lemma: string, reading: string, dictionaryEntryId?: string): string {
  const pair = `${encodeURIComponent(normalizeJapanese(lemma))}:${encodeURIComponent(normalizeJapanese(reading))}`;
  return dictionaryEntryId ? `jmdict:${dictionaryEntryId}:${pair}` : `token:${pair}`;
}
export function identityForEntry(entry: DictionaryResult): VocabularyIdentity {
  const reading = normalizeJapanese(entry.readings[0]);
  return { id: vocabularyId(entry.headword, reading, entry.id), dictionaryEntryId: entry.id,
    lemma: entry.headword, reading };
}
export function identityForToken(token: Token): VocabularyIdentity {
  const lemma = token.lemma.normalize('NFKC').trim();
  const reading = normalizeJapanese(token.reading);
  return { id: vocabularyId(lemma, reading), lemma, reading };
}
export const tokenQueryKey = (token: Token) => JSON.stringify([token.lemma, token.reading, token.type]);
export function mergeVocabulary(current: LearnerVocabularyItem[], incoming: LearnerVocabularyItem[]): LearnerVocabularyItem[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = merged.get(item.id);
    if (!previous || Date.parse(item.updatedAt) > Date.parse(previous.updatedAt)) merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function exportLearnerContext(items: LearnerVocabularyItem[]) {
  const words = (status: VocabularyStatus) => items.filter((item) => item.status === status)
    .sort((a, b) => a.id.localeCompare(b.id)).map(({ lemma, reading, dictionaryEntryId }) => ({ lemma, reading,
      ...(dictionaryEntryId ? { dictionary_entry_id: dictionaryEntryId } : {}) }));
  return { known_vocabulary: words('known'), learning_vocabulary: words('learning') };
}
