import type { ProgressMap, StoryProgress } from './types';
import type { ReaderPreferences } from './preferences';
import { exportLearnerContext, vocabularyId, type ImportMode, type LearnerVocabularyItem, type VocabularyStateService } from './vocabulary';
import { normalizeJapanese } from './dictionaryModel';

export interface LearnerBackup {
  backup_version: '1.0'; app: 'YomuStory'; exported_at: string;
  vocabulary: LearnerVocabularyItem[]; reading_progress: StoryProgress[]; preferences: ReaderPreferences;
}
export interface ReaderState { progress: ProgressMap; preferences: ReaderPreferences }
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const invalid = () => new Error('Copia de seguridad inválida o versión no compatible. No se ha cambiado ningún dato.');
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
export const timestamp = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
export function parseBackup(value: unknown): LearnerBackup {
  if (!object(value) || !only(value, ['backup_version', 'app', 'exported_at', 'vocabulary', 'reading_progress', 'preferences'])
    || value.backup_version !== '1.0' || value.app !== 'YomuStory' || !timestamp(value.exported_at)
    || !Array.isArray(value.vocabulary) || value.vocabulary.length > 100000 || !Array.isArray(value.reading_progress)
    || value.reading_progress.length > 100000 || !object(value.preferences)) throw invalid();
  for (const item of value.vocabulary) {
    if (!object(item) || !only(item, ['id', 'dictionaryEntryId', 'lemma', 'reading', 'status', 'createdAt', 'updatedAt'])
      || !text(item.lemma) || !text(item.reading) || !normalizeJapanese(item.lemma) || !normalizeJapanese(item.reading)
      || typeof item.status !== 'string' || !['learning', 'known'].includes(item.status)
      || (item.dictionaryEntryId !== undefined && (typeof item.dictionaryEntryId !== 'string' || !/^\d{1,12}$/.test(item.dictionaryEntryId)))
      || item.id !== vocabularyId(item.lemma, item.reading, item.dictionaryEntryId as string | undefined)
      || !timestamp(item.createdAt) || !timestamp(item.updatedAt) || Date.parse(item.createdAt) > Date.parse(item.updatedAt)) throw invalid();
  }
  for (const progress of value.reading_progress) {
    if (!object(progress) || !only(progress, ['story_id', 'last_opened', 'completed', 'last_sentence', 'updated_at'])
      || typeof progress.story_id !== 'string' || !/^[a-z0-9_]{1,128}$/.test(progress.story_id)
      || typeof progress.completed !== 'boolean' || !timestamp(progress.last_opened)
      || (progress.updated_at !== undefined && !timestamp(progress.updated_at))
      || (progress.last_sentence !== undefined && !text(progress.last_sentence))) throw invalid();
  }
  const preferences = value.preferences;
  if (!only(preferences, ['furigana', 'textSize', 'updatedAt']) || typeof preferences.furigana !== 'boolean'
    || typeof preferences.textSize !== 'string' || !['normal', 'large'].includes(preferences.textSize) || !timestamp(preferences.updatedAt)
    || new Set(value.vocabulary.map((item) => item.id)).size !== value.vocabulary.length
    || new Set(value.reading_progress.map((item) => item.story_id)).size !== value.reading_progress.length) throw invalid();
  // Drop object prototypes and give callers their own validated portable data.
  return structuredClone(value) as unknown as LearnerBackup;
}
export function parseBackupText(raw: string): LearnerBackup {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('La copia supera el límite de 25 MiB.');
  try { return parseBackup(JSON.parse(raw)); } catch (error) { if (error instanceof SyntaxError) throw invalid(); throw error; }
}
export function mergeReaderState(current: ReaderState, backup: LearnerBackup, mode: ImportMode): ReaderState {
  const imported = Object.fromEntries(backup.reading_progress.map((entry) => [entry.story_id, entry]));
  if (mode === 'replace') return { progress: imported, preferences: backup.preferences };
  const progress = Object.assign(Object.create(null), current.progress) as ProgressMap;
  for (const [id, next] of Object.entries(imported)) {
    const previous = progress[id];
    if (!previous || Date.parse(next.updated_at ?? next.last_opened) > Date.parse(previous.updated_at ?? previous.last_opened)) progress[id] = next;
  }
  return { progress, preferences: Date.parse(backup.preferences.updatedAt) > Date.parse(current.preferences.updatedAt)
    ? backup.preferences : current.preferences };
}
export function createBackupService(vocabulary: VocabularyStateService, reader: {
  read(): ReaderState;
  // A synchronous write returns a rollback function, restoring both legacy stores
  // itself if either write fails. UI state changes only after IDB commits.
  stage(next: ReaderState): () => void;
  committed(next: ReaderState): void;
}, now: () => string = () => new Date().toISOString()) {
  return {
    async exportBackup(): Promise<LearnerBackup> {
      const state = reader.read();
      return parseBackup({ app: 'YomuStory', backup_version: '1.0', exported_at: now(),
        vocabulary: await vocabulary.getAll(), reading_progress: Object.values(state.progress).sort((a, b) => a.story_id.localeCompare(b.story_id)),
        preferences: state.preferences });
    },
    async importBackup(value: unknown, mode: ImportMode): Promise<void> {
      const backup = parseBackup(value); // Every record validates before any write.
      let next: ReaderState | undefined;
      await vocabulary.applyRecords(backup.vocabulary, mode, () => {
        next = mergeReaderState(reader.read(), backup, mode);
        return reader.stage(next);
      });
      reader.committed(next!);
    },
    async exportLearnerContext() { return exportLearnerContext(await vocabulary.getAll()); },
  };
}
export type BackupService = ReturnType<typeof createBackupService>;
export function readBackupFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la copia de seguridad.'));
    reader.onabort = () => reject(new Error('Se canceló la lectura del archivo.'));
    reader.readAsText(file, 'utf-8');
  });
}
export function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
