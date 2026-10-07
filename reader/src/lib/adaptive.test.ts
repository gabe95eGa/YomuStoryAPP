import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import storyFixture from '../../../stories/work/work_001.json';
import dictionaryFixture from '../test/dictionary-entries.json';
import backupFixture from '../test/backups/valid.json';
import profile from '../../../profiles/learner-profile.example.json';
import { shouldShowFurigana, type FuriganaMode } from './furigana';
import { createPreferencesStore, PREFERENCES_KEY } from './preferences';
import { parseStory } from './content';
import { parseDictionaryChunk, resolveEntry } from './dictionaryModel';
import { identityForEntry, identityForToken, tokenQueryKey, type VocabularyStatus } from './vocabulary';
import { reliableTokenIdentity, StoryStatusIndex } from './tokenStatuses';
import { buildLearnerContext, configurationFromProfile, createLearnerContextService, parseLearnerContext } from './learnerContext';
import { createVocabularyStateService } from './vocabularyStorage';
import { createBackupService, parseBackup } from './backup';

const story = parseStory(storyFixture, 'work_001'), backup = parseBackup(backupFixture);
const token = story.content.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens)).find((t) => t.lemma === '慣れる')!;
const entry = parseDictionaryChunk(dictionaryFixture).map((e) => resolveEntry(e, { lemma: token.lemma, reading: token.reading }, 'lemma'))
  .find((e) => e?.headword === token.lemma)!;
const record = { ...backup.vocabulary[0], ...identityForEntry(entry) };

describe('adaptive furigana model and identity cache', () => {
  it.each(['all', 'adaptive', 'none'] as FuriganaMode[])('handles known, learning, untracked and kana in %s mode', (mode) => {
    for (const status of ['known', 'learning', undefined] as (VocabularyStatus | undefined)[]) {
      expect(shouldShowFurigana(token, status, mode)).toBe(mode !== 'none' && (mode !== 'adaptive' || status !== 'known'));
      expect(shouldShowFurigana({ ...token, surface: 'これ', reading: 'これ' }, status, mode)).toBe(false);
    }
  });
  it('updates cached status keys without repeating dictionary lookups or clearing unchanged states', async () => {
    const lookup = vi.fn(async () => [entry]), index = new StoryStatusIndex(story, { lookup });
    expect(index.statuses([]).size).toBe(0);
    await index.resolve([record]);
    const learning = index.statuses([{ ...record, status: 'learning' }]);
    expect(learning.get(tokenQueryKey(token))).toBe('learning');
    const calls = lookup.mock.calls.length;
    await index.resolve([{ ...record, status: 'known' }]);
    const known = index.statuses([{ ...record, status: 'known' }]);
    expect(known.get(tokenQueryKey(token))).toBe('known');
    expect(index.statuses([{ ...record, status: 'known' }])).toBe(known);
    expect(lookup).toHaveBeenCalledTimes(calls);
    expect(index.statuses([]).has(tokenQueryKey(token))).toBe(false);
  });
  it('keeps ambiguous or mismatched words uncertain and disambiguates matching readings', () => {
    const homograph = { ...entry, id: '999999', common: false };
    expect(reliableTokenIdentity(token, [entry, homograph])).toBeUndefined();
    expect(reliableTokenIdentity(token, [{ ...entry, readings: ['なれる', 'ならす'] }])).toBeUndefined();
    expect(reliableTokenIdentity(token, [{ ...entry, headword: '違う' }])).toBeUndefined();
    const exact = { ...token, surface: '慣れる', reading: 'なれる' };
    expect(reliableTokenIdentity(exact, [entry, { ...homograph, readings: ['ならす'] }])).toBe(identityForEntry(entry).id);
    expect(reliableTokenIdentity({ ...exact, type: 'noun', reading: 'ちがう' }, [entry])).toBeUndefined();
  });
  it('uses exact annotation identity during dictionary failure, never surface text alone', async () => {
    const index = new StoryStatusIndex(story, { lookup: vi.fn(async () => { throw new Error('offline'); }) });
    const fallback = { ...record, ...identityForToken(token), dictionaryEntryId: undefined, status: 'known' as const };
    await index.resolve([record]);
    expect(index.statuses([record]).get(tokenQueryKey(token))).toBeUndefined();
    expect(index.statuses([fallback]).get(tokenQueryKey(token))).toBe('known');
    expect(index.statuses([{ ...fallback, ...identityForToken({ ...token, lemma: '違う' }) }]).get(tokenQueryKey(token))).toBeUndefined();
  });
  it('preserves an ambiguous Learning indicator while keeping Known readings visible', async () => {
    const index = new StoryStatusIndex(story, { lookup: async () => [entry, { ...entry, id: '999999' }] });
    await index.resolve([record]);
    expect(index.statuses([{ ...record, status: 'learning' }]).get(tokenQueryKey(token))).toBe('learning');
    expect(index.statuses([{ ...record, status: 'known' }]).get(tokenQueryKey(token))).toBeUndefined();
    index.retryUnresolved(); expect(await index.resolve([record])).toBe(true);
  });
});

describe('preference and backup 1.0 compatibility', () => {
  it.each([[true, 'all'], [false, 'none'], ['all', 'all'], ['adaptive', 'adaptive'], ['none', 'none']] as const)(
    'loads legacy/current preference %s as %s and preserves other settings', (old, mode) => {
      const preferences = { furigana: old, textSize: 'large', updatedAt: '2026-10-01T00:00:00Z' };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, preferences }));
      const store = createPreferencesStore(), migrated = store.load().preferences;
      expect(migrated).toEqual({ ...preferences, furigana: mode });
      store.save(migrated); expect(createPreferencesStore().load().preferences).toEqual(migrated);
      expect(parseBackup({ ...backupFixture, preferences }).preferences).toEqual(migrated);
    });
  it('defaults fresh readers to adaptive and rejects malformed modes rather than coercing them', () => {
    expect(createPreferencesStore().load().preferences.furigana).toBe('adaptive');
    for (const furigana of ['sometimes', ['all'], null, 1]) {
      const preferences = { ...backup.preferences, furigana };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, preferences }));
      expect(createPreferencesStore().load().notice).toBeDefined();
      expect(() => parseBackup({ ...backup, preferences })).toThrow();
    }
  });
  it.each(['all', 'adaptive', 'none'] as const)('round trips %s through committed backup export/import', async (furigana) => {
    const vocabulary = createVocabularyStateService({ factory: () => new IDBFactory() });
    let state = { progress: {}, preferences: { ...backup.preferences, furigana } };
    const service = createBackupService(vocabulary, { read: () => state, stage: () => () => {}, committed: (next) => { state = next; } });
    const exported = await service.exportBackup();
    state.preferences.furigana = 'none';
    await service.importBackup(JSON.parse(JSON.stringify(exported)), 'replace');
    expect(exported.backup_version).toBe('1.0'); expect(state.preferences.furigana).toBe(furigana);
  });
});

describe('portable learner generation context', () => {
  it('composes levels, grammar and explicit preferences with live vocabulary, excluding unrelated profile extensions', () => {
    const configured = { ...profile, current_level: 'N3', target_level: 'N2', private_note: 'secret', dictionary: ['cache'],
      generation_preferences: { ...profile.generation_preferences, browserSetting: 'excluded' },
      known_grammar: [{ pattern: '〜たい', notes: 'Repasar', internal_id: 'hidden' }] };
    const context = buildLearnerContext(configurationFromProfile(configured), backup.vocabulary, '2026-10-07T00:00:00Z');
    expect(context.language).toEqual({ native_language: 'es', target_language: 'ja', current_level: 'N3', target_level: 'N2' });
    expect(context.known_grammar).toEqual([{ pattern: '〜たい', notes: 'Repasar' }]);
    expect(context.preferences.preferred_topics).toEqual(profile.preferred_topics);
    expect(context.preferences.interests).toEqual(profile.interests);
    expect(context.preferences.generation_preferences).toEqual(profile.generation_preferences);
    expect(context.known_vocabulary.map((w) => w.lemma)).toEqual(['仕事']);
    expect(context.learning_vocabulary.map((w) => w.lemma)).toEqual(['慣れる']);
    expect(context.known_vocabulary.map((w) => w.lemma)).not.toContain('食べる');
    const json = JSON.stringify(context);
    for (const field of ['private_note', 'dictionary', 'reading_progress', 'backup_version', 'exported_at', 'textSize', 'furigana', 'createdAt', 'updatedAt', 'internal_id', 'browserSetting']) expect(json).not.toContain(JSON.stringify(field) + ':');
    expect(parseLearnerContext(JSON.parse(json))).toEqual(context);
    expect(() => parseBackup(context)).toThrow();
  });
  it('exports current committed vocabulary and valid JSON offline without mutating profile or fetching assets', async () => {
    const fetch = vi.fn(async () => { throw new Error('network unavailable'); }); vi.stubGlobal('fetch', fetch);
    const before = JSON.stringify(profile);
    const vocabulary = createVocabularyStateService({ factory: () => new IDBFactory() });
    const service = createLearnerContextService(vocabulary, profile, () => '2026-10-07T00:00:00Z');
    expect((await service.buildContext()).known_vocabulary).toEqual([]);
    await vocabulary.applyRecords(backup.vocabulary, 'replace');
    const context = parseLearnerContext(JSON.parse(await service.exportContext()));
    expect(context.known_vocabulary).toHaveLength(1); expect(context.learning_vocabulary).toHaveLength(1);
    await vocabulary.setStatus(backup.vocabulary[0], 'known');
    expect((await service.buildContext()).learning_vocabulary).toEqual([]);
    expect((await service.buildContext()).known_vocabulary).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(profile)).toBe(before);
    expect(() => configurationFromProfile({ ...profile, target_level: 'N0' })).toThrow();
  });
  it('exports full thousands-word snapshots in deterministic order and rejects invalid context JSON shapes', () => {
    const items = Array.from({ length: 2500 }, (_, index) => ({ ...backup.vocabulary[0], ...identityForToken({ surface: `単語${index}`, lemma: `単語${index}`, reading: 'たんご' }) }));
    const configuration = configurationFromProfile(profile);
    const context = buildLearnerContext(configuration, items, '2026-10-07T00:00:00Z');
    expect(context.learning_vocabulary).toHaveLength(2500);
    expect(buildLearnerContext(configuration, [...items].reverse(), context.generated_at)).toEqual(context);
    for (const invalid of [{ ...context, context_version: '2.0' }, { ...context, generated_at: 'bad' }, { ...context, reading_progress: [] },
      { ...context, known_vocabulary: [{ lemma: '仕事', reading: 'しごと', id: 'private' }] }]) expect(() => parseLearnerContext(invalid)).toThrow();
  });
});
