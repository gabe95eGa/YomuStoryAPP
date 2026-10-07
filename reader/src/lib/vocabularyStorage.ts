import { mergeVocabulary, type ImportMode, type LearnerVocabularyItem, type VocabularyIdentity,
  type VocabularyStateService, type VocabularyStatus } from './vocabulary';

export const LEARNER_DATABASE = 'yomustory.learner.v1';
const done = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error ?? new Error('No se guardaron los cambios.'));
  transaction.onerror = () => reject(transaction.error);
});
export function createVocabularyStateService(options: { name?: string; factory?: () => IDBFactory; now?: () => string } = {}): VocabularyStateService {
  let database: Promise<IDBDatabase> | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const now = options.now ?? (() => new Date().toISOString());
  const open = () => database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = (options.factory ?? (() => indexedDB))().open(options.name ?? LEARNER_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vocabulary', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('El almacenamiento del vocabulario está bloqueado.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
  }).catch((error) => { database = undefined; throw error; });
  async function read<T>(request: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const result = request(db.transaction('vocabulary').objectStore('vocabulary'));
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    });
  }
  async function change(action: (store: IDBObjectStore) => void): Promise<void> {
    const db = await open();
    const tx = db.transaction('vocabulary', 'readwrite');
    const completion = done(tx);
    try { action(tx.objectStore('vocabulary')); } catch (error) { tx.abort(); await completion.catch(() => {}); throw error; }
    await completion; notify();
  }
  return {
    getAll: () => read<LearnerVocabularyItem[]>((store) => store.getAll()),
    async getStatus(identity) { return (await read<LearnerVocabularyItem | undefined>((store) => store.get(identity.id)))?.status ?? null; },
    async setStatus(identity: VocabularyIdentity, status: VocabularyStatus) {
      await change((store) => {
        const request = store.get(identity.id);
        request.onsuccess = () => {
          const timestamp = new Date(Math.max(Date.parse(now()), request.result ? Date.parse(request.result.updatedAt) + 1 : 0)).toISOString();
          store.put({ ...identity, status, createdAt: request.result?.createdAt ?? timestamp, updatedAt: timestamp });
        };
      });
    },
    removeStatus: (identity) => change((store) => { store.delete(identity.id); }),
    clear: () => change((store) => { store.clear(); }),
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async applyRecords(records: LearnerVocabularyItem[], mode: ImportMode, sideEffect?: () => (() => void)) {
      const db = await open();
      const tx = db.transaction('vocabulary', 'readwrite');
      const completion = done(tx);
      let undo: (() => void) | undefined;
      let sideError: unknown;
      const store = tx.objectStore('vocabulary');
      const request = store.getAll();
      request.onsuccess = () => {
        try {
          const next = mode === 'replace' ? records : mergeVocabulary(request.result, records);
          store.clear(); next.forEach((item) => store.put(item));
          // Synchronous localStorage writes can still abort this IDB transaction.
          undo = sideEffect?.();
        } catch (error) { sideError = error; tx.abort(); }
      };
      try { await completion; }
      catch (error) {
        try { undo?.(); } catch { throw new Error('La importación falló y no se pudo restaurar todo el almacenamiento local. Conserva tu copia de seguridad.'); }
        throw sideError ?? error;
      }
      notify();
    },
  };
}
export const vocabularyStateService = createVocabularyStateService();
