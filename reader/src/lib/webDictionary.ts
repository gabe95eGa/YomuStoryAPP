import {
  entryKeys, normalizeJapanese, parseDictionaryChunk, parseDictionaryManifest, rankResults, resolveEntry,
  type DictionaryEntry, type DictionaryManifest, type DictionaryQuery, type DictionaryResult,
  type DictionaryService, type DictionaryStatus,
} from './dictionaryModel';

export interface DictionaryStorage {
  installed(): Promise<DictionaryManifest | undefined>;
  checkpoint(version: string): Promise<number>;
  writeChunk(version: string, entries: DictionaryEntry[], next: number): Promise<void>;
  finish(manifest: DictionaryManifest): Promise<void>;
  find(version: string, term: string): Promise<DictionaryEntry[]>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Dictionary transaction aborted'));
    transaction.onerror = () => reject(transaction.error);
  });
}

export function createIndexedDictionaryStorage(name = 'yomustory.dictionary.v1', factory: () => IDBFactory = () => indexedDB): DictionaryStorage {
  let database: Promise<IDBDatabase> | undefined;
  function open(): Promise<IDBDatabase> {
    if (database) return database;
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory().open(name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const entries = db.createObjectStore('entries', { keyPath: 'key' });
        entries.createIndex('terms', 'terms', { multiEntry: true });
        entries.createIndex('version', 'version');
        db.createObjectStore('meta');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Dictionary storage is blocked'));
    }).catch((error) => { database = undefined; throw error; });
    return database;
  }
  async function meta<T>(key: string): Promise<T | undefined> {
    const db = await open();
    return requestResult(db.transaction('meta').objectStore('meta').get(key));
  }
  return {
    async installed() {
      const value = await meta<unknown>('installed');
      return value === undefined ? undefined : parseDictionaryManifest(value);
    },
    async checkpoint(version) {
      const value = await meta<unknown>(`checkpoint:${version}`);
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
    },
    async writeChunk(version, entries, next) {
      const db = await open();
      const transaction = db.transaction(['entries', 'meta'], 'readwrite');
      const done = transactionDone(transaction);
      const store = transaction.objectStore('entries');
      for (const entry of entries) store.put({ key: `${version}:${entry.id}`, version,
        terms: entryKeys(entry).map((term) => `${version}:${term}`), entry });
      transaction.objectStore('meta').put(next, `checkpoint:${version}`);
      await done; // Entry writes and resume checkpoint commit together.
    },
    async finish(manifest) {
      const db = await open();
      const previous = await meta<DictionaryManifest>('installed');
      const count = await requestResult(db.transaction('entries').objectStore('entries').index('version').count(manifest.version));
      if (count !== manifest.entryCount) throw new Error('El diccionario está incompleto. Prepara sus archivos de nuevo.');
      const transaction = db.transaction(['entries', 'meta'], 'readwrite');
      const done = transactionDone(transaction);
      transaction.objectStore('meta').put(manifest, 'installed');
      // Only after a full validated import, remove older dictionary versions.
      // Reader progress is in a different storage system and is never touched.
      if (previous && previous.version !== manifest.version) {
        const cursor = transaction.objectStore('entries').index('version').openCursor(previous.version);
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (item) { item.delete(); item.continue(); }
        };
      }
      await done;
    },
    async find(version, term) {
      const db = await open();
      const records = await requestResult(db.transaction('entries').objectStore('entries').index('terms').getAll(`${version}:${term}`));
      return parseDictionaryChunk(records.map((item) => item.entry));
    },
  };
}

export async function unpackDictionary(bytes: Uint8Array): Promise<unknown> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
async function digest(bytes: Uint8Array): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(value)].map((item) => item.toString(16).padStart(2, '0')).join('');
}
const aborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
};

export function createWebDictionaryService(options: {
  storage?: DictionaryStorage; fetcher?: typeof fetch; baseUrl?: string;
  unpack?: (bytes: Uint8Array) => Promise<unknown>; hash?: (bytes: Uint8Array) => Promise<string>;
} = {}): DictionaryService {
  const storage = options.storage ?? createIndexedDictionaryStorage();
  const fetcher: typeof fetch = (...args) => (options.fetcher ?? fetch)(...args);
  const base = options.baseUrl ?? `${import.meta.env.BASE_URL}dictionary/`;
  let status: DictionaryStatus = { phase: 'idle' };
  let ready: Promise<DictionaryManifest> | undefined;
  const listeners = new Set<() => void>();
  const cache = new Map<string, DictionaryResult[]>();
  function publish(next: DictionaryStatus) { status = next; listeners.forEach((listener) => listener()); }
  async function initialize(): Promise<DictionaryManifest> {
    publish({ phase: 'preparing', progress: 0 });
    const installed = await storage.installed();
    let manifest: DictionaryManifest;
    try {
      const response = await fetcher(`${base}manifest.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error('No están disponibles los archivos del diccionario.');
      manifest = parseDictionaryManifest(await response.json());
    } catch (error) {
      // Persisted data remains useful if local assets are unreachable/offline.
      if (!installed) throw error;
      publish({ phase: 'ready', message: 'Usando el diccionario guardado en este navegador.' });
      return installed;
    }
    if (installed?.version === manifest.version) {
      publish({ phase: 'ready' }); return installed;
    }
    try {
      const start = await storage.checkpoint(manifest.version);
      if (start > manifest.chunks.length) throw new Error('Estado de importación incorrecto.');
      for (let index = start; index < manifest.chunks.length; index++) {
        const chunk = manifest.chunks[index];
        const response = await fetcher(`${base}${chunk.path}`);
        if (!response.ok) throw new Error('Faltan archivos del diccionario local.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength !== chunk.bytes || await (options.hash ?? digest)(bytes) !== chunk.sha256) {
          throw new Error('Un archivo del diccionario está dañado.');
        }
        const entries = parseDictionaryChunk(await (options.unpack ?? unpackDictionary)(bytes));
        if (entries.length !== chunk.entries) throw new Error('El diccionario está incompleto.');
        await storage.writeChunk(manifest.version, entries, index + 1);
        publish({ phase: 'preparing', progress: Math.round((index + 1) / manifest.chunks.length * 100) });
      }
      await storage.finish(manifest);
      publish({ phase: 'ready' });
      return manifest;
    } catch (error) {
      if (!installed) throw error;
      publish({ phase: 'ready', message: 'No se pudo actualizar el diccionario. Usando la versión guardada.' });
      return installed;
    }
  }
  function ensureReady() {
    if (!ready) ready = initialize().catch((error) => {
      ready = undefined;
      if (import.meta.env.DEV) console.warn('Dictionary initialization failed:', error);
      publish({ phase: 'unavailable', message: 'Diccionario no disponible. Puedes consultar la información de la lectura e intentar de nuevo.' });
      throw error;
    });
    return ready;
  }
  return {
    getStatus: () => status,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async lookup(query, signal) {
      aborted(signal);
      const key = JSON.stringify(query);
      const cached = cache.get(key);
      if (cached) return cached;
      // Initialization is shared. Closing one sheet cancels its result, not the
      // import; the next tap can use the same import or resume its checkpoints.
      const manifest = await ensureReady();
      aborted(signal);
      for (const matchedBy of ['lemma', 'surface', 'reading'] as const) {
        const term = normalizeJapanese(query[matchedBy]);
        if (!term) continue;
        const entries = await storage.find(manifest.version, term);
        aborted(signal);
        const results = rankResults(entries.map((entry) => resolveEntry(entry, query, matchedBy))
          .filter((entry): entry is DictionaryResult => entry !== null), query);
        if (results.length) {
          if (cache.size >= 200) cache.delete(cache.keys().next().value!);
          cache.set(key, results); return results;
        }
      }
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, []); return [];
    },
  };
}
