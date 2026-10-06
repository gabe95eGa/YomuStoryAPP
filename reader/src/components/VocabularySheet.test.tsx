import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import manifestData from '../../../manifest.json';
import work from '../../../stories/work/work_001.json';
import fixture from '../test/dictionary-entries.json';
import { parseManifest, parseStory } from '../lib/content';
import { parseDictionaryChunk, type DictionaryManifest, type DictionaryService } from '../lib/dictionaryModel';
import { createIndexedDictionaryStorage, createWebDictionaryService } from '../lib/webDictionary';
import { VocabularySheet } from './VocabularySheet';

const token = { surface: '慣れて', lemma: '慣れる', reading: 'ナレテ', type: 'verb', target: true };
async function realFixtureDictionary() {
  const entries = parseDictionaryChunk(fixture);
  const version = 'e'.repeat(24);
  const manifest: DictionaryManifest = { format: 1, version, entryCount: entries.length, dictionaryDate: '2026-10-05',
    chunks: [{ path: `${version}/entries-0000.json.gz.bin`, entries: entries.length, bytes: 1, sha256: '0'.repeat(64) }] };
  const factory = new IDBFactory();
  const storage = createIndexedDictionaryStorage('sheet-fixture', () => factory);
  await storage.writeChunk(version, entries, 1); await storage.finish(manifest);
  return createWebDictionaryService({ storage, fetcher: vi.fn<typeof fetch>(async () => new Response(JSON.stringify(manifest))) });
}

describe('dictionary vocabulary sheet', () => {
  it('renders a real Spanish gloss, lemma reading, readable POS, common marker and attribution', async () => {
    const dictionary = await realFixtureDictionary();
    const lookup = vi.spyOn(dictionary, 'lookup');
    const user = userEvent.setup();
    render(<VocabularySheet token={token} dictionary={dictionary} onClose={vi.fn()} />);
    expect(await screen.findByText('acostumbrarse')).toBeVisible();
    expect(screen.getByText('なれる')).toBeVisible();
    expect(screen.getByText('Español')).toBeVisible();
    expect(screen.getByText('Palabra común')).toBeVisible();
    expect(lookup).toHaveBeenCalledWith({ lemma: token.lemma, surface: token.surface, reading: token.reading, type: token.type }, expect.any(AbortSignal));
    expect(screen.getAllByText(/Verbo ichidan/).some((element) => element.closest('details') === null)).toBe(true);
    expect(screen.getByRole('link', { name: 'Licencia CC BY-SA 4.0' })).toHaveAttribute('href', 'https://www.edrdg.org/edrdg/licence.html');
    await user.click(screen.getByText('Información de la lectura', { exact: true }));
    expect(screen.getByText('ナレテ')).toBeVisible();
  });
  it('labels English fallback and exposes additional valid dictionary matches', async () => {
    const dictionary = await realFixtureDictionary();
    const user = userEvent.setup();
    render(<VocabularySheet token={{ surface: '上手', lemma: '上手', reading: 'カミテ' }} dictionary={dictionary} onClose={vi.fn()} />);
    expect(await screen.findByText('Inglés · sin definición en español')).toBeVisible();
    expect(screen.getByText('upper part')).toBeVisible();
    await user.click(screen.getByText('Otras entradas (1)'));
    expect(screen.getByText('Español')).toBeVisible();
  });
  it('shows first-run preparation progress and continues with token data', async () => {
    const pending = new Promise<never>(() => {});
    const dictionary: DictionaryService = { lookup: () => pending,
      getStatus: () => ({ phase: 'preparing', progress: 42 }), subscribe: () => () => {} };
    render(<VocabularySheet token={token} dictionary={dictionary} onClose={vi.fn()} />);
    expect(await screen.findByText('Preparando el diccionario japonés…')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Preparación del diccionario' })).toHaveAttribute('value', '42');
    expect(screen.getByText('ナレテ')).toBeVisible();
  });
  it('shows unavailable state, retains token data, and retries successfully', async () => {
    const fixtureDictionary = await realFixtureDictionary();
    const success = await fixtureDictionary.lookup(token);
    const dictionary: DictionaryService = { lookup: vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(success) };
    const user = userEvent.setup();
    render(<VocabularySheet token={token} dictionary={dictionary} onClose={vi.fn()} />);
    expect(await screen.findByText('Diccionario no disponible.')).toBeVisible();
    expect(screen.getByText('ナレテ')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar diccionario' }));
    expect(await screen.findByText('acostumbrarse')).toBeVisible();
  });
  it('distinguishes unknown words from an unavailable dictionary', async () => {
    const dictionary = await realFixtureDictionary();
    render(<VocabularySheet token={{ surface: '架空語の例', lemma: '架空語の例', reading: 'かくうごのれい' }} dictionary={dictionary} onClose={vi.fn()} />);
    expect(await screen.findByText(/No se encontró una entrada/)).toBeVisible();
    expect(screen.queryByText('Diccionario no disponible.')).toBeNull();
    expect(screen.getByText('かくうごのれい')).toBeVisible();
  });
  it('token click in the actual reader performs lemma lookup and keeps reader controls intact', async () => {
    const dictionary = await realFixtureDictionary();
    const lookup = vi.spyOn(dictionary, 'lookup');
    const user = userEvent.setup();
    render(<App dictionary={dictionary} content={{ loadManifest: async () => parseManifest(manifestData),
      loadStory: async () => parseStory(work, 'work_001') }} />);
    await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
    const first = await screen.findByRole('region', { name: 'Frase 2' });
    const word = within(first).getByRole('button', { name: 'Ver palabra: 慣れ' });
    await user.click(word);
    expect(await screen.findByText('acostumbrarse')).toBeVisible();
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ lemma: '慣れる', surface: '慣れ', reading: 'ナレ' }), expect.any(AbortSignal));
    await user.click(screen.getByRole('button', { name: 'Cerrar vocabulario' }));
    expect(word).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Mostrar traducción de la frase 2' }));
    expect(screen.getByText(work.content.paragraphs[0].sentences[1].translation_es)).toBeVisible();
  });
  it('ignores late dictionary results after the sheet is closed', async () => {
    let resolve: (entries: []) => void = () => {};
    const dictionary: DictionaryService = { lookup: () => new Promise<[]>((done) => { resolve = done; }) };
    const { unmount } = render(<VocabularySheet token={token} dictionary={dictionary} onClose={vi.fn()} />);
    unmount(); resolve([]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
