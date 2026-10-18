export const LIBRARY_VIEW_KEY = 'yomustory.library.view.v1';
export interface LibraryView { topic: string; query: string; status: string; duration: string; order: string }
const initial: LibraryView = { topic: '', query: '', status: 'all', duration: 'all', order: 'catalog' };
export function loadLibraryView(): LibraryView {
  try {
    const value = JSON.parse(sessionStorage.getItem(LIBRARY_VIEW_KEY) ?? 'null');
    if (value?.version !== 1 || typeof value.topic !== 'string' || value.topic.length > 200 || typeof value.query !== 'string' || value.query.length > 512
      || !['all', 'unread', 'reading', 'completed'].includes(value.status) || !['all', 'short', 'medium', 'long'].includes(value.duration) || !['catalog', 'shortest', 'title'].includes(value.order)) return { ...initial };
    return { topic: value.topic, query: value.query, status: value.status, duration: value.duration, order: value.order };
  } catch { return { ...initial }; }
}
export function saveLibraryView(value: LibraryView) {
  try { sessionStorage.setItem(LIBRARY_VIEW_KEY, JSON.stringify({ version: 1, ...value })); } catch { /* Filters remain usable for this view. */ }
}
