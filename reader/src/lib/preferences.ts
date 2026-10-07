import { migrateFurigana, type FuriganaMode } from './furigana';
export interface ReaderPreferences { furigana: FuriganaMode; textSize: 'normal' | 'large'; updatedAt: string }
export const DEFAULT_PREFERENCES: ReaderPreferences = { furigana: 'adaptive', textSize: 'normal', updatedAt: '1970-01-01T00:00:00.000Z' };
export const PREFERENCES_KEY = 'yomustory.reader.preferences.v1';
export interface PreferencesStore {
  load(): { preferences: ReaderPreferences; notice?: string };
  save(preferences: ReaderPreferences): string | undefined;
}
export function createPreferencesStore(access: () => Pick<Storage, 'getItem' | 'setItem'> = () => window.localStorage): PreferencesStore {
  return {
    load() {
      try {
        const raw = access().getItem(PREFERENCES_KEY);
        if (!raw) return { preferences: { ...DEFAULT_PREFERENCES } };
        const data = JSON.parse(raw);
        const prefs = data?.preferences;
        const furigana = migrateFurigana(prefs?.furigana);
        if (data.version !== 1 || !furigana || !['normal', 'large'].includes(prefs.textSize)
          || typeof prefs.updatedAt !== 'string' || !Number.isFinite(Date.parse(prefs.updatedAt))) throw new Error('Invalid preferences');
        return { preferences: { furigana, textSize: prefs.textSize, updatedAt: prefs.updatedAt } };
      } catch { return { preferences: { ...DEFAULT_PREFERENCES }, notice: 'No se pudieron recuperar las preferencias guardadas.' }; }
    },
    save(preferences) {
      try { access().setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, preferences })); }
      catch { return 'No se pudieron guardar las preferencias de esta sesión.'; }
    },
  };
}
export const localPreferencesStore = createPreferencesStore();
