import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import manifestData from '../../manifest.json';
import storyData from '../../stories/work/work_001.json';
import App from './App';
import { parseManifest, parseStory, type ContentService } from './lib/content';
import { createProgressStore, PROGRESS_KEY } from './lib/progress';
import { FuriganaText } from './components/JapaneseText';

function service(): ContentService {
  return { loadManifest: vi.fn(async () => parseManifest(manifestData)), loadStory: vi.fn(async () => parseStory(storyData, 'work_001')) };
}
async function openStory(content = service()) {
  const user = userEvent.setup();
  const result = render(<App content={content} />);
  await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
  await screen.findByRole('heading', { name: '注文をもう一度', level: 1 });
  return { ...result, user, content };
}

describe('reader flows', () => {
  it('renders the manifest library, metadata, topic filter, and opens a structured story', async () => {
    const { content } = await openStory();
    expect(content.loadManifest).toHaveBeenCalled();
    expect(content.loadStory).toHaveBeenCalledWith(expect.objectContaining({ path: 'stories/work/work_001.json' }), expect.any(AbortSignal));
    expect(screen.getAllByRole('region', { name: /^Frase \d+$/ })).toHaveLength(15);
    const first = screen.getByTestId('text-s1').cloneNode(true) as HTMLElement;
    first.querySelectorAll('rt').forEach((element) => element.remove());
    expect(first.textContent).toBe(storyData.content.paragraphs[0].sentences[0].text);
    expect(screen.getByRole('button', { name: 'Frase anterior' })).toBeDisabled();
  });
  it('toggles ruby while never annotating pure kana redundantly', async () => {
    const { container, user } = await openStory();
    expect(container.querySelectorAll('ruby').length).toBeGreaterThan(0);
    const kana = screen.getByRole('button', { name: 'Ver palabra: レストラン' });
    expect(kana.querySelector('ruby')).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Furigana' }), 'none');
    expect(container.querySelectorAll('ruby')).toHaveLength(0);
    expect(screen.getByRole('combobox', { name: 'Furigana' })).toHaveValue('none');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Furigana' }), 'all');
    expect(container.querySelectorAll('ruby').length).toBeGreaterThan(0);
  });
  it('uses supplied furigana segments for mixed words', () => {
    const { container } = render(<FuriganaText enabled token={{ surface: '取り扱う', lemma: '取り扱う', reading: 'とりあつかう',
      furigana_segments: [{ text: '取', reading: 'と' }, { text: 'り', reading: null }, { text: '扱', reading: 'あつか' }, { text: 'う', reading: null }] }} />);
    expect([...container.querySelectorAll('rt')].map((node) => node.textContent)).toEqual(['と', 'あつか']);
  });
  it('reveals only an individual translation and can hide it again', async () => {
    const { user } = await openStory();
    const first = storyData.content.paragraphs[0].sentences[0].translation_es;
    const second = storyData.content.paragraphs[0].sentences[1].translation_es;
    expect(screen.getByText(first)).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mostrar traducción de la frase 1' }));
    expect(screen.getByText(first)).toBeVisible();
    expect(screen.getByText(second)).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ocultar traducción de la frase 1' }));
    expect(screen.getByText(first)).not.toBeVisible();
  });
  it('opens lexical token information, targets, and closes without losing focus', async () => {
    const { user } = await openStory();
    const target = screen.getAllByRole('button', { name: 'Ver palabra: 慣れ' })[0];
    await user.click(target);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('慣れる')).toBeVisible();
    expect(within(dialog).getByText('ナレ')).toBeVisible();
    expect(within(dialog).getByText('Vocabulario objetivo')).toBeVisible();
    expect(await within(dialog).findByText('Diccionario no disponible.')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar vocabulario' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(target).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Ver palabra: 。' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver palabra: は' })).toBeNull();
  });
  it('persists completion across a remount, updates the library, and reopens completed stories', async () => {
    const { user, unmount, content } = await openStory();
    await user.click(screen.getByRole('button', { name: /Completar lectura/ }));
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).stories.work_001.completed).toBe(true);
    await user.click(screen.getByRole('button', { name: /Volver a la biblioteca/ }));
    await screen.findByRole('button', { name: 'Volver a leer: Confirmar el pedido' });
    unmount();
    render(<App content={content} store={createProgressStore()} />);
    expect(await screen.findByText('✓ Completada')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Volver a leer: Confirmar el pedido' }));
    await screen.findByRole('heading', { name: '注文をもう一度', level: 1 });
    expect(screen.getByText('Frase 1 de 15 · Completada')).toBeVisible();
  });
  it('saves and resumes a sentence position; supports previous and next controls', async () => {
    const { user, unmount, content } = await openStory();
    await user.click(screen.getByRole('button', { name: 'Frase siguiente' }));
    expect(screen.getByText('Frase 2 de 15')).toBeVisible();
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).stories.work_001.last_sentence).toBe('s2');
    unmount();
    render(<App content={content} />);
    await screen.findByText('Frase 2 de 15');
    await user.click(screen.getByRole('button', { name: 'Frase anterior' }));
    expect(screen.getByText('Frase 1 de 15')).toBeVisible();
  });
  it('filters topics without duplicating metadata in the frontend', async () => {
    const user = userEvent.setup();
    render(<App content={service()} />);
    expect(await screen.findByText('5 lecturas · 0 completadas')).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tema' }), 'レストラン');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '注文をもう一度' })).toBeVisible();
  });
  it('skip link focuses the reader without navigating to the library', async () => {
    const { user } = await openStory();
    await user.click(screen.getByRole('link', { name: 'Saltar al contenido' }));
    expect(window.location.hash).toBe('#/story/work_001');
    expect(screen.getByRole('main')).toHaveFocus();
  });
});

describe('recoverable reader errors', () => {
  it('shows a retry action when the manifest is unavailable', async () => {
    const content = service();
    content.loadManifest = vi.fn().mockRejectedValueOnce(new Error('Biblioteca no disponible')).mockResolvedValue(parseManifest(manifestData));
    const user = userEvent.setup();
    render(<App content={content} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Biblioteca no disponible');
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await screen.findByRole('heading', { name: 'Tu biblioteca' })).toBeVisible();
  });
  it('shows an empty library message', async () => {
    const content = service();
    content.loadManifest = vi.fn(async () => ({ schema_version: '1.0' as const, stories: [] }));
    render(<App content={content} />);
    expect(await screen.findByText(/No hay lecturas/)).toBeVisible();
  });
  it('handles a malformed or missing story without a blank screen', async () => {
    const content = service();
    content.loadStory = vi.fn().mockRejectedValue(new Error('Archivo de lectura incorrecto'));
    const user = userEvent.setup();
    render(<App content={content} />);
    await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo de lectura incorrecto');
    await user.click(screen.getByRole('button', { name: 'Volver a la biblioteca' }));
    expect(await screen.findByRole('heading', { name: 'Tu biblioteca' })).toBeVisible();
  });
  it('continues reading with unavailable progress storage and explains the limitation', async () => {
    const store = createProgressStore(() => { throw new Error('blocked'); });
    const user = userEvent.setup();
    render(<App content={service()} store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
    await screen.findByRole('heading', { name: '注文をもう一度', level: 1 });
    expect(screen.getByRole('status')).toHaveTextContent('no se puede guardar');
    await user.click(screen.getByRole('button', { name: /Completar lectura/ }));
    expect(screen.getByText('Esta lectura está marcada como completada.')).toBeVisible();
  });
  it('handles an unknown deep link and supports browser history changes', async () => {
    window.history.replaceState(null, '', '/#/story/missing_001');
    render(<App content={service()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible');
    act(() => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible());
  });
});
