export interface ReaderPreferences { furigana: boolean; textSize: 'normal' | 'large'; updatedAt: string }
export const DEFAULT_PREFERENCES: ReaderPreferences = { furigana: true, textSize: 'normal', updatedAt: '1970-01-01T00:00:00.000Z' };
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
        if (data.version !== 1 || typeof prefs?.furigana !== 'boolean' || !['normal', 'large'].includes(prefs.textSize)
          || typeof prefs.updatedAt !== 'string' || !Number.isFinite(Date.parse(prefs.updatedAt))) throw new Error('Invalid preferences');
        return { preferences: prefs };
      } catch { return { preferences: { ...DEFAULT_PREFERENCES }, notice: 'No se pudieron recuperar las preferencias guardadas.' }; }
    },
    save(preferences) {
      try { access().setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, preferences })); }
      catch { return 'No se pudieron guardar las preferencias de esta sesión.'; }
    },
  };
}
export const localPreferencesStore = createPreferencesStore();
