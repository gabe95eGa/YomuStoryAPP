import { describe, expect, it, vi } from 'vitest';
import { buildAnkiExport } from './anki';
import { identityForEntry, type LearnerVocabularyItem } from './vocabulary';
import { parseDictionaryChunk, resolveEntry } from './dictionaryModel';
import fixture from '../test/dictionary-entries.json';
const entry = resolveEntry(parseDictionaryChunk(fixture).find((item) => item.id === '1212670')!, { lemma: '慣れる', reading: 'なれる' }, 'lemma')!;
const item: LearnerVocabularyItem = { ...identityForEntry(entry), status: 'learning', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' };

describe('Anki text export', () => {
  it('exports UTF-8 tab-separated Basic notes with real preferred glosses, tags and attribution without mutating vocabulary', async () => {
    const items = [item]; const before = JSON.stringify(items);
    const data = await buildAnkiExport(items, { lookup: vi.fn().mockResolvedValue([entry]) }, 'es');
    expect(data.count).toBe(1); expect(data.missing).toBe(0); expect(data.fallback).toBe(0);
    expect(data.text).toContain('#separator:Tab\n#html:true\n#tags column:3');
    expect(data.text).toContain('慣れる【なれる】'); expect(data.text).toContain('acostumbrarse');
    expect(data.text).toContain('yomustory::learning'); expect(data.text).toContain('CC BY-SA 4.0');
    expect(JSON.stringify(items)).toBe(before);
  });
  it('deduplicates a token and dictionary identity for the same front and keeps both statuses', async () => {
    const token = { ...item, id: 'token', dictionaryEntryId: undefined, status: 'known' as const };
    const data = await buildAnkiExport([item, token], { lookup: vi.fn().mockResolvedValue([entry]) }, 'en');
    expect(data.count).toBe(1); expect(data.text).toContain('yomustory::known yomustory::learning');
    expect(data.text).toContain('to get used to'); expect(data.text).not.toContain('acostumbrarse');
  });
  it('does not substitute unrelated entries or ambiguous token identities and reports missing definitions', async () => {
    const data = await buildAnkiExport([item], { lookup: vi.fn().mockResolvedValue([{ ...entry, id: '9999999' }]) }, 'es');
    expect(data.missing).toBe(1); expect(data.text).not.toContain('acostumbrarse');
    const ambiguous = await buildAnkiExport([{ ...item, dictionaryEntryId: undefined }], { lookup: vi.fn().mockResolvedValue([entry, { ...entry, id: '9999999' }]) }, 'en');
    expect(ambiguous.missing).toBe(1);
  });
  it('escapes HTML and quotes inside fields and distinguishes readings of homographs', async () => {
    const unsafe = { ...item, lemma: '<img src=x onerror="bad()">\t\n', reading: 'あ' };
    const data = await buildAnkiExport([unsafe, { ...unsafe, id: 'other', reading: 'い' }], { lookup: vi.fn().mockResolvedValue([]) }, 'en');
    expect(data.count).toBe(2); expect(data.text).toContain('&lt;img'); expect(data.text).not.toContain('<img'); expect(data.text).toContain('&quot;');
  });
  it('reports a language fallback, preserves failures and cancels without returning partial output', async () => {
    const englishOnly = { ...entry, senses: entry.senses.map((sense) => ({ ...sense, glosses: sense.glosses.filter((gloss) => gloss.language === 'en') })).filter((sense) => sense.glosses.length) };
    const data = await buildAnkiExport([item], { lookup: vi.fn().mockResolvedValue([englishOnly]) }, 'es');
    expect(data.fallback).toBe(1); expect(data.text).toContain('lang=""en""');
    await expect(buildAnkiExport([item], { lookup: vi.fn().mockRejectedValue(new Error('offline')) }, 'en')).rejects.toThrow('offline');
    const controller = new AbortController(); controller.abort();
    const lookup = vi.fn(); await expect(buildAnkiExport([item], { lookup }, 'en', controller.signal)).rejects.toThrow(); expect(lookup).not.toHaveBeenCalled();
  });
});
