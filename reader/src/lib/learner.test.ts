import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import validFixture from '../test/backups/valid.json';
import invalidVersion from '../test/backups/invalid-version.json';
import malformed from '../test/backups/malformed.json';
import conflictFixture from '../test/backups/merge-conflict.json';
import dictionaryFixture from '../test/dictionary-entries.json';
import { createBackupService, mergeReaderState, parseBackup, parseBackupText, type ReaderState } from './backup';
import { createVocabularyStateService } from './vocabularyStorage';
import { exportLearnerContext, identityForEntry, identityForToken, mergeVocabulary, vocabularyId } from './vocabulary';
import { parseDictionaryChunk, resolveEntry } from './dictionaryModel';
import { createIndexedDictionaryStorage } from './webDictionary';
import { createPreferencesStore, DEFAULT_PREFERENCES } from './preferences';
import { createProgressStore } from './progress';

const valid = parseBackup(validFixture), conflict = parseBackup(conflictFixture);
const identity = valid.vocabulary[0];
const service = (factory = new IDBFactory()) => createVocabularyStateService({ factory: () => factory, now: () => '2026-10-09T01:00:00.000Z' });
function coordinator(vocabulary = service()) {
  let current: ReaderState = { progress: { daily_001: { story_id: 'daily_001', last_opened: '2026-10-01T01:00:00Z', completed: false, last_sentence: 's3' } },
    preferences: { ...DEFAULT_PREFERENCES } };
  let persisted = structuredClone(current);
  return { vocabulary, read: () => current, persisted: () => persisted,
    backup: createBackupService(vocabulary, { read: () => current, stage(next) {
      const previous = persisted; persisted = structuredClone(next); return () => { persisted = previous; };
    }, committed(next) { current = next; } }, () => '2026-10-10T01:00:00Z') };
}

describe('learner vocabulary persistence and identity', () => {
  it('marks learning/known, changes both ways, clears classification, and preserves creation timestamps', async () => {
    const vocabulary = service();
    expect(await vocabulary.getStatus(identity)).toBeNull();
    await vocabulary.setStatus(identity, 'learning');
    const first = (await vocabulary.getAll())[0];
    expect(first.status).toBe('learning');
    await vocabulary.setStatus(identity, 'known'); expect(await vocabulary.getStatus(identity)).toBe('known');
    await vocabulary.setStatus(identity, 'learning'); expect(await vocabulary.getStatus(identity)).toBe('learning');
    expect((await vocabulary.getAll())[0].createdAt).toBe(first.createdAt);
    expect(Date.parse((await vocabulary.getAll())[0].updatedAt)).toBeGreaterThan(Date.parse(first.updatedAt));
    await vocabulary.removeStatus(identity); expect(await vocabulary.getAll()).toEqual([]);
  });
  it('persists across service recreation and notifies live subscribers after committed writes', async () => {
    const factory = new IDBFactory(), vocabulary = service(factory), listener = vi.fn();
    const unsubscribe = vocabulary.subscribe(listener);
    await vocabulary.setStatus(identity, 'known');
    expect(await service(factory).getStatus(identity)).toBe('known'); expect(listener).toHaveBeenCalledOnce();
    unsubscribe(); await vocabulary.removeStatus(identity); expect(listener).toHaveBeenCalledOnce();
  });
  it('uses lemma dictionary identity across inflections and separates homographs/readings', () => {
    const entries = parseDictionaryChunk(dictionaryFixture);
    const word = entries.find((entry) => entry.id === identity.dictionaryEntryId)!;
    const a = identityForEntry(resolveEntry(word, { lemma: '慣れる', surface: '慣れて', reading: 'ナレテ' }, 'lemma')!);
    const b = identityForEntry(resolveEntry(word, { lemma: '慣れる', surface: '慣れた', reading: 'ナレタ' }, 'lemma')!);
    expect(a.id).toBe(b.id); expect(a.id).toBe(identity.id);
    expect(vocabularyId('上手', 'じょうず', '1234567')).not.toBe(vocabularyId('上手', 'かみて', '1234567'));
    expect(vocabularyId('開く', 'あく', '1111111')).not.toBe(vocabularyId('開く', 'あく', '2222222'));
    expect(identityForToken({ lemma: '未知語', surface: '未知語', reading: 'ミチゴ' }).id)
      .toBe(identityForToken({ lemma: '未知語', surface: '未知語', reading: 'みちご' }).id);
  });
  it('dictionary replacement and vocabulary clearing leave other storage systems intact', async () => {
    const factory = new IDBFactory(), vocabulary = service(factory);
    await vocabulary.setStatus(identity, 'learning');
    const dictionary = createIndexedDictionaryStorage('dictionary-test', () => factory);
    const entries = parseDictionaryChunk(dictionaryFixture);
    const manifest = (version: string) => ({ format: 1 as const, version, entryCount: entries.length, dictionaryDate: '2026-10-05',
      chunks: [{ path: `${version}/entries-0000.json.gz.bin`, sha256: '0'.repeat(64), entries: entries.length, bytes: 1 }] });
    await dictionary.writeChunk('a'.repeat(24), entries, 1); await dictionary.finish(manifest('a'.repeat(24)));
    await dictionary.writeChunk('b'.repeat(24), entries, 1); await dictionary.finish(manifest('b'.repeat(24)));
    expect(await vocabulary.getStatus(identity)).toBe('learning');
    const progress = createProgressStore(); progress.save({ work_001: valid.reading_progress[0] });
    await vocabulary.clear(); expect(progress.load().progress.work_001.completed).toBe(true);
    expect((await dictionary.find('b'.repeat(24), '慣れる'))[0].id).toBe(identity.dictionaryEntryId);
  });
  it('reports blocked learner storage instead of silently dropping classifications', async () => {
    const vocabulary = createVocabularyStateService({ factory: () => { throw new Error('blocked'); } });
    await expect(vocabulary.setStatus(identity, 'known')).rejects.toThrow('blocked');
  });
});

describe('portable backups and data safety', () => {
  it('exports only learner data with Unicode, timestamps, preferences and progress', async () => {
    const { vocabulary, backup } = coordinator(); await vocabulary.applyRecords(valid.vocabulary, 'replace');
    const exported = await backup.exportBackup();
    expect(exported.vocabulary.map((item) => item.lemma)).toContain('慣れる');
    expect(exported.reading_progress[0].last_sentence).toBe('s3');
    expect(exported.preferences.furigana).toBe(true);
    expect(parseBackupText(JSON.stringify(exported))).toEqual(exported);
    expect(Object.keys(exported)).toEqual(['app', 'backup_version', 'exported_at', 'vocabulary', 'reading_progress', 'preferences']);
    expect(exported).not.toHaveProperty('dictionary'); expect(exported).not.toHaveProperty('stories');
  });
  it('imports valid backups and keeps existing Reader V1 progress on merge', async () => {
    const state = coordinator(); await state.backup.importBackup(valid, 'merge');
    expect(await state.vocabulary.getAll()).toHaveLength(2);
    expect(state.read().progress.daily_001.last_sentence).toBe('s3');
    expect(state.read().progress.work_001.completed).toBe(true);
    expect(state.persisted()).toEqual(state.read());
  });
  it('replaces exactly learner records, progress and preferences after validation', async () => {
    const state = coordinator(); await state.backup.importBackup(valid, 'replace');
    expect(Object.keys(state.read().progress)).toEqual(['work_001']);
    expect(await state.vocabulary.getAll()).toEqual(valid.vocabulary);
    expect(state.read().preferences).toEqual(valid.preferences);
  });
  it('merges most recent records deterministically and keeps current data in timestamp ties', async () => {
    const state = coordinator(); await state.backup.importBackup(valid, 'replace');
    await state.backup.importBackup(conflict, 'merge');
    expect(await state.vocabulary.getStatus(identity)).toBe('known');
    expect(mergeVocabulary(conflict.vocabulary, valid.vocabulary)).toEqual(conflict.vocabulary.sort((a, b) => a.id.localeCompare(b.id)));
    const tie = structuredClone(valid.vocabulary[0]); tie.status = 'known';
    expect(mergeVocabulary([valid.vocabulary[0]], [tie])[0].status).toBe('learning');
    const current = { progress: { work_001: { ...valid.reading_progress[0], completed: false } }, preferences: valid.preferences };
    expect(mergeReaderState(current, valid, 'merge').progress.work_001.completed).toBe(false);
    expect(mergeReaderState(current, { ...valid, preferences: { ...valid.preferences, furigana: false } }, 'merge').preferences.furigana).toBe(true);
  });
  it('rejects unsupported/malformed data, duplicates, altered identities and invalid dates before any writes', async () => {
    const state = coordinator(); await state.backup.importBackup(valid, 'replace');
    const previous = structuredClone(state.read()), records = await state.vocabulary.getAll();
    const candidates = [invalidVersion, malformed, { ...valid, vocabulary: [...valid.vocabulary, valid.vocabulary[0]] },
      { ...valid, vocabulary: [{ ...identity, id: 'forged' }] }, { ...valid, exported_at: '2026-02-30T00:00:00Z' },
      { ...valid, preferences: { ...valid.preferences, textSize: 'huge' } }, { ...valid, preferences: { ...valid.preferences, textSize: ['large'] } },
      { ...valid, vocabulary: [{ ...identity, status: ['known'] }] }, { ...valid, reading_progress: [{ ...valid.reading_progress[0], completed: 'yes' }] },
      { ...valid, dictionary: ['unwanted cache'] }];
    for (const candidate of candidates) await expect(state.backup.importBackup(candidate, 'replace')).rejects.toThrow();
    expect(await state.vocabulary.getAll()).toEqual(records); expect(state.read()).toEqual(previous); expect(state.persisted()).toEqual(previous);
    expect(() => parseBackupText('{broken')).toThrow();
  });
  it('aborts vocabulary replacement if reader storage fails and restores staged values on later IDB abort', async () => {
    const state = coordinator(); await state.backup.importBackup(valid, 'replace');
    const records = await state.vocabulary.getAll();
    const failing = createBackupService(state.vocabulary, { read: state.read, stage() { throw new Error('quota'); }, committed: vi.fn() });
    await expect(failing.importBackup(conflict, 'replace')).rejects.toThrow('quota');
    expect(await state.vocabulary.getAll()).toEqual(records);
    const original = IDBDatabase.prototype.transaction;
    let writeTransaction: IDBTransaction | undefined;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args: Parameters<typeof original>) {
      const tx = original.apply(this, args); if (args[1] === 'readwrite') writeTransaction = tx; return tx;
    });
    const undo = vi.fn();
    await expect(state.vocabulary.applyRecords(conflict.vocabulary, 'replace', () => { writeTransaction!.abort(); return undo; })).rejects.toThrow();
    expect(undo).toHaveBeenCalledOnce(); expect(await state.vocabulary.getAll()).toEqual(records);
  });
  it('exports generator vocabulary context without rewriting profile configuration', () => {
    const context = exportLearnerContext(valid.vocabulary);
    expect(context.learning_vocabulary[0]).toMatchObject({ lemma: '慣れる', reading: 'なれる' });
    expect(context.known_vocabulary[0]).toMatchObject({ lemma: '仕事' });
    expect(context).not.toHaveProperty('current_level');
  });
  it('merges valid story identifiers without inherited object-key collisions', () => {
    const incoming = { ...valid, reading_progress: [{ ...valid.reading_progress[0], story_id: '__proto__' }] };
    const next = mergeReaderState({ progress: {}, preferences: valid.preferences }, parseBackup(incoming), 'merge');
    expect(Object.hasOwn(next.progress, '__proto__')).toBe(true);
    expect(next.progress.__proto__.completed).toBe(true);
    expect(Object.getPrototypeOf(next.progress)).toBeNull();
    expect(Object.prototype).not.toHaveProperty('completed');
  });
  it('preserves existing progress format and round trips new saved reader preferences', () => {
    const progress = createProgressStore(); progress.save({ work_001: valid.reading_progress[0] });
    expect(createProgressStore().load().progress.work_001).toEqual(valid.reading_progress[0]);
    const preferences = createPreferencesStore(); preferences.save({ ...valid.preferences, textSize: 'large', furigana: false });
    expect(createPreferencesStore().load().preferences).toMatchObject({ textSize: 'large', furigana: false });
  });
});
