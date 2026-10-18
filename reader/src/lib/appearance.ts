export interface ReadingAppearance { continuous: boolean; spacing: 'compact' | 'comfortable'; paper: 'light' | 'sepia' | 'night' }
export const APPEARANCE_KEY = 'yomustory.reader.appearance.v1';
export const DEFAULT_APPEARANCE: ReadingAppearance = { continuous: false, spacing: 'comfortable', paper: 'light' };
export function loadAppearance(): ReadingAppearance {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null');
    if (saved?.version !== 1 || typeof saved.continuous !== 'boolean' || !['compact', 'comfortable'].includes(saved.spacing) || !['light', 'sepia', 'night'].includes(saved.paper)) return { ...DEFAULT_APPEARANCE };
    return { continuous: saved.continuous, spacing: saved.spacing, paper: saved.paper };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
export function saveAppearance(value: ReadingAppearance): boolean {
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ version: 1, ...value })); return true; }
  catch { return false; }
}
