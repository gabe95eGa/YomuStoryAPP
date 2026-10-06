import { IDBFactory } from 'fake-indexeddb';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../test/dictionary-entries.json';
import {
  entryKeys, formatPartOfSpeech, normalizeJapanese, parseDictionaryChunk, parseDictionaryManifest, preferredSenses,
  type DictionaryEntry, type DictionaryManifest,
} from './dictionaryModel';
import { createIndexedDictionaryStorage, createWebDictionaryService } from './webDictionary';

export const entries = parseDictionaryChunk(fixture);
const version = 'f'.repeat(24);
const packed = gzipSync(JSON.stringify(entries));
const hash = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const manifest: DictionaryManifest = { format: 1, version, dictionaryDate: '2026-10-05', entryCount: entries.length,
  chunks: [{ path: `${version}/entries-0000.json.gz.bin`, entries: entries.length, bytes: packed.length,
    sha256: createHash('sha256').update(packed).digest('hex') }] };
const unpack = async (bytes: Uint8Array) => JSON.parse(gunzipSync(bytes).toString());
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

async function prepared() {
  const factory = new IDBFactory();
  const storage = createIndexedDictionaryStorage('test-dictionary', () => factory);
  await storage.writeChunk(version, entries, 1);
  await storage.finish(manifest);
  const fetcher = vi.fn<typeof fetch>(async () => response(manifest));
  return { factory, storage, fetcher, service: createWebDictionaryService({ storage, fetcher }) };
}

describe('real JMdict lookup', () => {
  it('resolves an inflected surface by exact lemma and prefers Spanish', async () => {
    const { service } = await prepared();
    const result = await service.lookup({ lemma: '慣れる', surface: '慣れて', reading: 'ナレテ', type: 'verb' });
    expect(result[0].headword).toBe('慣れる');
    expect(result[0].readings).toEqual(['なれる']);
    expect(result[0].matchedBy).toBe('lemma');
    expect(preferredSenses(result[0]).language).toBe('es');
    expect(preferredSenses(result[0]).senses[0].glosses[0].text).toBe('acostumbrarse');
  });
  it('ranks compatible lemma readings first and retains ambiguous entries', async () => {
    const { service } = await prepared();
    const akeru = await service.lookup({ lemma: '開く', reading: 'ヒラク' });
    expect(akeru).toHaveLength(2);
    expect(akeru[0].readings).toContain('ひらく');
    const aku = await service.lookup({ lemma: '開く', reading: 'アク' });
    expect(aku).toHaveLength(2);
    expect(aku[0].readings).toContain('あく');
  });
  it('normalizes katakana/half-width readings, whitespace and surrounding punctuation', async () => {
    const { service } = await prepared();
    expect(normalizeJapanese(' 「 ｶｲｸ 」 ')).toBe('かいく');
    expect((await service.lookup({ lemma: '「 レストラン 」' }))[0].headword).toBe('レストラン');
    expect(entryKeys(entries[0])).toContain('れすとらん');
  });
  it('falls back to English honestly when the entry has no Spanish', async () => {
    const { service } = await prepared();
    // Both 上手 entries remain accessible; the kamite sense lacks Spanish.
    const result = await service.lookup({ lemma: '上手', reading: 'カミテ' });
    const kamite = result.find((entry) => entry.readings.includes('かみて'))!;
    expect(kamite).toBeDefined();
    expect(preferredSenses(kamite).language).toBe('en');
  });
  it('supports surface then reading-assisted fallback, and unknown words return no entries', async () => {
    const { service } = await prepared();
    expect((await service.lookup({ lemma: 'unknown', surface: '仕事' }))[0].matchedBy).toBe('surface');
    expect((await service.lookup({ lemma: 'unknown', reading: 'シゴト' }))[0].matchedBy).toBe('reading');
    expect(await service.lookup({ lemma: '未知のフィクスチャ' })).toEqual([]);
  });
  it('formats common and rare POS labels without displaying XML codes', () => {
    expect(formatPartOfSpeech('Ichidan verb')).toBe('Verbo ichidan');
    expect(formatPartOfSpeech("Godan verb with 'ku' ending")).toContain('Verbo godan');
    expect(formatPartOfSpeech('Nidan verb (lower class) with su ending (archaic)')).toContain('Nidan verb');
  });
  it('retains reading/sense restrictions instead of showing incompatible meanings', async () => {
    const { factory, storage, fetcher } = await prepared();
    const restricted: DictionaryEntry = structuredClone(entries.find((entry) => entry.id === '1212670')!);
    restricted.id = '9999999';
    restricted.readings = [
      { text: 'なれる', common: true, labels: [], appliesToSpellings: ['慣れる'] },
      { text: 'ならす', common: false, labels: [], appliesToSpellings: ['馴れる'] },
    ];
    restricted.senses = [
      { ...restricted.senses[0], glosses: [{ language: 'en', text: 'compatible fixture sense' }], appliesToReadings: ['なれる'] },
      { ...restricted.senses[0], glosses: [{ language: 'es', text: 'incompatible fixture sense' }], appliesToReadings: ['ならす'] },
    ];
    await storage.writeChunk(version, [restricted], 1);
    const service = createWebDictionaryService({ storage: createIndexedDictionaryStorage('test-dictionary', () => factory), fetcher });
    const result = (await service.lookup({ lemma: '慣れる', reading: 'ナレル' })).find((entry) => entry.id === restricted.id)!;
    expect(result.readings).toEqual(['なれる']);
    expect(result.senses).toHaveLength(1);
    expect(preferredSenses(result).language).toBe('en');
  });
});

describe('persistent import and graceful failure', () => {
  it('imports and validates chunks once, then queries without network requests, including after reload', async () => {
    const factory = new IDBFactory();
    const storage = createIndexedDictionaryStorage('import-test', () => factory);
    const fetcher = vi.fn<typeof fetch>(async (url) => String(url).endsWith('manifest.json') ? response(manifest) : new Response(packed));
    const service = createWebDictionaryService({ storage, fetcher, hash, unpack });
    const listener = vi.fn(); service.subscribe!(listener);
    expect((await service.lookup({ lemma: '仕事' }))[0].headword).toBe('仕事');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await service.lookup({ lemma: '経験' });
    await service.lookup({ lemma: '仕事' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(service.getStatus!().phase).toBe('ready');
    expect(listener).toHaveBeenCalled();
    const offline = vi.fn<typeof fetch>(async () => { throw new Error('offline'); });
    const reopened = createWebDictionaryService({ storage: createIndexedDictionaryStorage('import-test', () => factory), fetcher: offline });
    expect((await reopened.lookup({ lemma: '慣れる' }))[0].headword).toBe('慣れる');
    await reopened.lookup({ lemma: '経験' });
    expect(offline).toHaveBeenCalledTimes(1); // One version check, no requests for words.
  });
  it('reports unavailable assets and supports retry after recovery', async () => {
    const storage = createIndexedDictionaryStorage('retry', () => new IDBFactory());
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(response(manifest)).mockResolvedValueOnce(new Response(packed));
    const service = createWebDictionaryService({ storage, fetcher, hash, unpack });
    await expect(service.lookup({ lemma: '仕事' })).rejects.toThrow();
    expect(service.getStatus!().phase).toBe('unavailable');
    expect((await service.lookup({ lemma: '仕事' }))[0].headword).toBe('仕事');
  });
  it('rejects malformed indexes, entries, and checksum failures', async () => {
    expect(() => parseDictionaryManifest({ ...manifest, chunks: [{ ...manifest.chunks[0], path: '../secret' }] })).toThrow();
    expect(() => parseDictionaryChunk([{ ...entries[0], readings: [] }])).toThrow();
    expect(() => parseDictionaryChunk([entries[0], entries[0]])).toThrow();
    const service = createWebDictionaryService({ storage: createIndexedDictionaryStorage('corrupt', () => new IDBFactory()),
      fetcher: vi.fn<typeof fetch>(async (url) => String(url).endsWith('manifest.json') ? response(manifest) : new Response(packed)),
      unpack, hash: async () => '0'.repeat(64) });
    await expect(service.lookup({ lemma: '仕事' })).rejects.toThrow('dañado');
  });
  it('resumes a committed import checkpoint and does not replace a working dictionary on failed update', async () => {
    const { storage } = await prepared();
    const newer = { ...manifest, version: 'a'.repeat(24), chunks: manifest.chunks.map((chunk) => ({ ...chunk, path: `${'a'.repeat(24)}/entries-0000.json.gz.bin` })) };
    await storage.writeChunk(newer.version, entries, 1);
    const fetcher = vi.fn<typeof fetch>(async () => response(newer));
    const service = createWebDictionaryService({ storage, fetcher, hash, unpack });
    expect((await service.lookup({ lemma: '仕事' }))[0].headword).toBe('仕事');
    expect(fetcher).toHaveBeenCalledTimes(1); // No reimport of completed chunk.
    expect((await storage.installed())?.version).toBe(newer.version);
    expect(await storage.find(version, '仕事')).toEqual([]);
    const failed = createWebDictionaryService({ storage, fetcher: vi.fn<typeof fetch>(async (url) => String(url).endsWith('manifest.json') ? response(manifest) : new Response('', { status: 404 })) });
    expect((await failed.lookup({ lemma: '仕事' }))[0].headword).toBe('仕事');
    expect(failed.getStatus!().message).toContain('versión guardada');
    expect((await storage.installed())?.version).toBe(newer.version);
  });
  it('handles blocked browser storage and cancels a closed sheet lookup', async () => {
    const service = createWebDictionaryService({ storage: createIndexedDictionaryStorage('blocked', () => { throw new Error('blocked'); }) });
    await expect(service.lookup({ lemma: '仕事' })).rejects.toThrow('blocked');
    const controller = new AbortController(); controller.abort();
    await expect(service.lookup({ lemma: '仕事' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
