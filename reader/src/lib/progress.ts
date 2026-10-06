import type { ProgressMap, StoryProgress } from './types';

export const PROGRESS_KEY = 'yomustory.reader.progress.v1';
export interface ProgressStore {
  load(): { progress: ProgressMap; notice?: string };
  save(progress: ProgressMap): string | undefined;
}
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
const emptyProgress = (): ProgressMap => Object.create(null) as ProgressMap;

function isEntry(value: unknown, id: string): value is StoryProgress {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return entry.story_id === id && /^[a-z0-9_]+$/.test(id) && typeof entry.completed === 'boolean'
    && typeof entry.last_opened === 'string' && Number.isFinite(Date.parse(entry.last_opened))
    && (entry.last_sentence === undefined || typeof entry.last_sentence === 'string');
}

export function createProgressStore(access: StorageAccess = () => window.localStorage): ProgressStore {
  return {
    load() {
      try {
        const raw = access().getItem(PROGRESS_KEY);
        if (raw === null) return { progress: emptyProgress() };
        const data: unknown = JSON.parse(raw);
        if (typeof data !== 'object' || data === null) throw new Error('Invalid storage');
        const envelope = data as { version?: unknown; stories?: unknown };
        if (envelope.version !== 1 || typeof envelope.stories !== 'object' || envelope.stories === null
          || Array.isArray(envelope.stories)) throw new Error('Invalid storage');
        const entries = Object.entries(envelope.stories);
        const valid = entries.filter(([id, entry]) => isEntry(entry, id));
        return { progress: Object.fromEntries(valid) as ProgressMap,
          notice: entries.length !== valid.length ? 'Parte del progreso guardado no se pudo recuperar. Puedes seguir leyendo.' : undefined };
      } catch {
        return { progress: emptyProgress(), notice: 'No se pudo recuperar el progreso local. Puedes seguir leyendo.' };
      }
    },
    save(progress) {
      try { access().setItem(PROGRESS_KEY, JSON.stringify({ version: 1, stories: progress })); }
      catch { return 'El progreso de esta sesión no se puede guardar. Mantén esta pestaña abierta para conservarlo.'; }
    },
  };
}
export const localProgressStore = createProgressStore();
