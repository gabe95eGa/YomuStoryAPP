import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import manifestFixture from '../../../manifest.json';
import storyFixture from '../../../stories/work/work_001.json';
import dictionaryFixture from '../test/dictionary-entries.json';
import backupFixture from '../test/backups/valid.json';
import invalidVersion from '../test/backups/invalid-version.json';
import { parseManifest, parseStory } from '../lib/content';
import { normalizeJapanese, parseDictionaryChunk, rankResults, resolveEntry, type DictionaryService, type DictionaryResult } from '../lib/dictionaryModel';
import { parseBackup, readBackupFile } from '../lib/backup';
import { vocabularyId } from '../lib/vocabulary';
import { createVocabularyStateService } from '../lib/vocabularyStorage';
import { createProgressStore } from '../lib/progress';
import { createPreferencesStore } from '../lib/preferences';

const entries = parseDictionaryChunk(dictionaryFixture), backup = parseBackup(backupFixture);
function setup(factory = new IDBFactory()) {
  const vocabulary = createVocabularyStateService({ factory: () => factory });
  const dictionary: DictionaryService = { lookup: vi.fn(async (query) => rankResults(entries
    .filter((entry) => [...entry.spellings, ...entry.readings].some((form) => normalizeJapanese(form.text) === normalizeJapanese(query.lemma)))
    .map((entry) => resolveEntry(entry, query, 'lemma')).filter((entry): entry is DictionaryResult => entry !== null), query)) };
  const content = { loadManifest: vi.fn(async () => parseManifest(manifestFixture)), loadStory: vi.fn(async () => parseStory(storyFixture, 'work_001')) };
  const props = { vocabulary, dictionary, content };
  return { factory, ...props, mount: () => render(<App {...props} />) };
}
async function openReader(state: ReturnType<typeof setup>) {
  const user = userEvent.setup(); state.mount();
  await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
  await screen.findByRole('heading', { name: '注文をもう一度', level: 1 });
  return user;
}

describe('learner state in the reader and vocabulary library', () => {
  it('marks both states, updates every matching word immediately, and preserves global hiragana furigana', async () => {
    const state = setup(), user = await openReader(state);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Furigana' }), 'all');
    await user.click(screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Aprendiendo' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Aprendiendo' })).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' }).every((word) => word.dataset.vocabularyStatus === 'learning')).toBe(true));
    await user.click(within(dialog).getByRole('button', { name: 'Conocida' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Conocida' })).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' }).every((word) => word.dataset.vocabularyStatus === 'known')).toBe(true));
    expect(screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' })[0].querySelector('rt')?.textContent).toBe('なれ');
    await user.click(within(dialog).getByRole('button', { name: 'Quitar estado' }));
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Quitar estado' })).toBeNull());
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar vocabulario' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Furigana' }), 'none');
    expect(document.querySelectorAll('rt')).toHaveLength(0);
  });
  it('reacts to all repeated words in adaptive mode, retains sheet readings, and performs no new lookups on status changes', async () => {
    const state = setup(); await state.vocabulary.applyRecords(backup.vocabulary, 'replace');
    const getStatus = vi.spyOn(state.vocabulary, 'getStatus');
    const user = await openReader(state);
    expect(screen.getByRole('combobox', { name: 'Furigana' })).toHaveValue('adaptive');
    const words = () => screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' });
    await waitFor(() => expect(words().every((word) => word.dataset.vocabularyStatus === 'learning')).toBe(true));
    expect(words().every((word) => word.querySelector('rt')?.textContent === 'なれ')).toBe(true);
    await user.click(words()[0]); const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: 'Conocida' });
    const calls = vi.mocked(state.dictionary.lookup).mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Conocida' }));
    await waitFor(() => expect(words().every((word) => word.dataset.vocabularyStatus === 'known' && !word.querySelector('rt'))).toBe(true));
    expect(dialog.querySelector('.dictionary-reading')?.textContent).toContain('なれる');
    await user.click(within(dialog).getByRole('button', { name: 'Aprendiendo' }));
    await waitFor(() => expect(words().every((word) => word.classList.contains('word-learning') && word.querySelector('rt')?.textContent === 'なれ')).toBe(true));
    await user.click(within(dialog).getByRole('button', { name: 'Quitar estado' }));
    await waitFor(() => expect(words().every((word) => !word.dataset.vocabularyStatus && word.querySelector('rt'))).toBe(true));
    expect(state.dictionary.lookup).toHaveBeenCalledTimes(calls); expect(getStatus).not.toHaveBeenCalled();
  });
  it('persists vocabulary and reader preferences after a remount', async () => {
    const state = setup(); await state.vocabulary.applyRecords(backup.vocabulary, 'replace');
    const user = userEvent.setup(), mounted = state.mount();
    await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
    await user.click(await screen.findByRole('button', { name: 'Texto grande' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Furigana' }), 'none');
    mounted.unmount(); state.mount();
    expect(await screen.findByRole('button', { name: 'Texto grande' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Furigana' })).toHaveValue('none');
    await user.click(screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' })[0]);
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprendiendo' })).toHaveAttribute('aria-pressed', 'true'));
  });
  it('filters/searches vocabulary, derives counts, and changes status from the list', async () => {
    const state = setup(); await state.vocabulary.applyRecords(backup.vocabulary, 'replace');
    window.location.hash = '#/vocabulary'; state.mount(); const user = userEvent.setup();
    expect(await screen.findByText('Aprendiendo: 1 · Conocidas: 1')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'learning');
    expect(screen.getAllByRole('article')).toHaveLength(1); expect(screen.getByRole('heading', { name: '慣れる' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Conocida' }));
    expect(await screen.findByText('Aprendiendo: 0 · Conocidas: 2')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'all');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar vocabulario' }), 'シゴト');
    expect(screen.getAllByRole('article')).toHaveLength(1); expect(screen.getByRole('heading', { name: '仕事' })).toBeVisible();
  });
  it('keeps dictionary-unresolved words classifiable using a fallback identity', async () => {
    const state = setup(); state.dictionary.lookup = vi.fn(async () => []);
    const user = await openReader(state);
    await user.click(screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Aprendiendo' }));
    await waitFor(async () => expect(await state.vocabulary.getAll()).toHaveLength(1));
    const item = (await state.vocabulary.getAll())[0]; expect(item.id.startsWith('token:')).toBe(true); expect(item.dictionaryEntryId).toBeUndefined();
  });
  it('paginates thousands of items without any dictionary preload', async () => {
    const state = setup(); const items = Array.from({ length: 2000 }, (_, index) => ({ ...backup.vocabulary[0],
      dictionaryEntryId: undefined, lemma: `単語${index}`, reading: 'たんご', id: vocabularyId(`単語${index}`, 'たんご') }));
    await state.vocabulary.applyRecords(items, 'replace'); window.location.hash = '#/vocabulary'; state.mount();
    expect(await screen.findByText('2000 palabras · Página 1 de 40')).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(50); expect(state.dictionary.lookup).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('2000 palabras · Página 2 de 40')).toBeVisible(); expect(screen.getAllByRole('article')).toHaveLength(50);
  });
});

describe('backup controls and confirmations', () => {
  it('validates a selected file, requires confirmation to replace, imports progress, and can cancel deletion', async () => {
    const state = setup(); const progress = createProgressStore(); progress.save({ daily_001: { story_id: 'daily_001', completed: false, last_opened: '2026-10-01T01:00:00Z' } });
    window.location.hash = '#/vocabulary'; state.mount(); const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Archivo de copia de seguridad'), new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }));
    expect(await screen.findByRole('heading', { name: 'Copia validada' })).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cómo importar' }), 'replace');
    await user.click(screen.getByRole('button', { name: 'Aplicar importación' }));
    expect(await screen.findByRole('alertdialog', { name: '¿Reemplazar tus datos?' })).toBeVisible();
    expect(progress.load().progress.daily_001).toBeDefined(); expect(await state.vocabulary.getAll()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await state.vocabulary.getAll()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Aplicar importación' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reemplazo' }));
    expect(await screen.findByText('Copia importada. Tus datos ya están disponibles.')).toBeVisible();
    expect(progress.load().progress.work_001.completed).toBe(true); expect(progress.load().progress.daily_001).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Vaciar vocabulario' }));
    expect(await screen.findByRole('alertdialog', { name: '¿Vaciar tu vocabulario?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await state.vocabulary.getAll()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Vaciar vocabulario' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar vaciado' }));
    expect(await screen.findByText('Vocabulario vaciado.')).toBeVisible(); expect(progress.load().progress.work_001.completed).toBe(true);
    await user.click(screen.getByRole('link', { name: 'Biblioteca' }));
    expect(await screen.findByRole('button', { name: 'Volver a leer: Confirmar el pedido' })).toBeVisible();
  });
  it('rejects invalid selected files without changing stored vocabulary or progress', async () => {
    const state = setup(); await state.vocabulary.applyRecords(backup.vocabulary, 'replace');
    window.location.hash = '#/vocabulary'; state.mount(); const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Archivo de copia de seguridad'), new File([JSON.stringify(invalidVersion)], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha cambiado ningún dato');
    expect(await state.vocabulary.getAll()).toEqual(backup.vocabulary);
    expect(screen.queryByRole('button', { name: 'Aplicar importación' })).toBeNull();
  });
  it('exports a real JSON Blob and portable generation context only on explicit clicks', async () => {
    const state = setup(); await state.vocabulary.applyRecords(backup.vocabulary, 'replace');
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:test'; }), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    window.location.hash = '#/vocabulary'; state.mount(); const user = userEvent.setup();
    expect(blobs).toHaveLength(0); await user.click(screen.getByRole('button', { name: 'Exportar copia' }));
    await screen.findByText('Copia exportada. Guarda el archivo en un lugar seguro.');
    expect(click).toHaveBeenCalledOnce(); const exported = parseBackup(JSON.parse(await readBackupFile(blobs[0] as File)));
    expect(exported.vocabulary).toHaveLength(2); expect(exported.preferences).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Exportar contexto de aprendizaje' }));
    await screen.findByText('Contexto de aprendizaje exportado para generar lecturas.');
    expect(JSON.parse(await readBackupFile(blobs[1] as File)).learning_vocabulary[0].lemma).toBe('慣れる');
  });
  it('rolls back vocabulary/progress if preferences cannot be saved during import', async () => {
    const state = setup(); await state.vocabulary.applyRecords(backup.vocabulary, 'replace');
    const old = createProgressStore(); old.save({ daily_001: { story_id: 'daily_001', last_opened: '2026-10-01T01:00:00Z', completed: false } });
    const prefs = createPreferencesStore(); const original = prefs.load().preferences;
    prefs.save = vi.fn((next) => next.updatedAt === original.updatedAt ? undefined : 'quota');
    window.location.hash = '#/vocabulary'; render(<App vocabulary={state.vocabulary} dictionary={state.dictionary} content={state.content} preferenceStore={prefs} />);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Archivo de copia de seguridad'), new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }));
    await screen.findByRole('heading', { name: 'Copia validada' }); await user.click(screen.getByRole('button', { name: 'Aplicar importación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('quota');
    expect(await state.vocabulary.getAll()).toEqual(backup.vocabulary); expect(old.load().progress.daily_001).toBeDefined(); expect(old.load().progress.work_001).toBeUndefined();
  });
});
