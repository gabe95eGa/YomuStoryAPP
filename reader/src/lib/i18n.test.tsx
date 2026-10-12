import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { LanguageProvider, LANGUAGE_KEY, loadLanguage, translate } from './i18n';
import englishContent from '../locales/content.en.json';
import manifest from '../../../manifest.json';
import work from '../../../stories/work/work_001.json';
import fixture from '../test/dictionary-entries.json';
import { parseManifest, parseStory, contentService } from './content';
import { parseDictionaryChunk, resolveEntry } from './dictionaryModel';
import { DictionaryDefinition } from '../components/DictionaryDefinition';
import { PROGRESS_KEY } from './progress';

const stories = import.meta.glob('../../../stories/*/*.json', { eager: true, import: 'default' });

describe('English reading and shared learner state', () => {
  it('has an English translation for every editorial Spanish field in all published stories', () => {
    let sentences = 0;
    function check(value: unknown) {
      if (Array.isArray(value)) value.forEach(check);
      else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => {
        if (key.endsWith('_es') && typeof child === 'string') {
          expect(Object.hasOwn(englishContent, child), `${key}: ${child}`).toBe(true);
          expect((englishContent as Record<string, string>)[child].trim()).not.toBe('');
          if (key === 'translation_es') sentences++;
        } else check(child);
      });
    }
    expect(Object.keys(stories)).toHaveLength(manifest.stories.length);
    Object.values(stories).forEach(check);
    expect(sentences).toBeGreaterThan(0);
  });
  it('switches story text aids and interface without reloading the story or resetting position; persists after remount', async () => {
    const user = userEvent.setup();
    const content = { loadManifest: vi.fn(async () => parseManifest(manifest)),
      loadStory: vi.fn(async () => parseStory(work, work.id)) };
    const app = render(<App content={content} />);
    await user.click(await screen.findByRole('button', { name: 'Leer: Confirmar el pedido' }));
    await user.click(await screen.findByRole('region', { name: /^Frase 3$/ }));
    const savedProgress = localStorage.getItem(PROGRESS_KEY);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en');
    expect(screen.getByText('Sentence 3 of 15')).toBeVisible();
    expect(screen.getByText('Confirming the order')).toBeVisible();
    expect(content.loadStory).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(savedProgress);
    expect(document.documentElement.lang).toBe('en');
    await user.click(screen.getByRole('button', { name: 'Show translation for sentence 1' }));
    expect(screen.getByText("It's been two weeks since I started working at a small restaurant.")).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'es');
    expect(screen.getByText(work.content.paragraphs[0].sentences[0].translation_es)).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en');
    app.unmount(); render(<App content={content} />);
    expect(await screen.findByText('Confirming the order')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  });
  it('prefers real English dictionary senses and retains the same word identity', () => {
    const raw = parseDictionaryChunk(fixture).find((entry) => entry.id === '1212670')!;
    const entry = resolveEntry(raw, { lemma: '慣れる', reading: 'なれる' }, 'lemma')!;
    render(<LanguageProvider language="en"><DictionaryDefinition entry={entry} /></LanguageProvider>);
    const primary = screen.getByRole('region', { name: 'Entry: 慣れる' });
    expect(within(primary).getByText('English')).toBeVisible();
    expect(primary.querySelector('.dictionary-gloss')?.getAttribute('lang')).toBe('en');
    expect(primary.querySelector('.dictionary-gloss')?.textContent).not.toContain('acostumbrarse');
    expect(entry.readings).toEqual(['なれる']);
  });
  it('translates template labels and gracefully defaults invalid preferences to Spanish', () => {
    expect(translate('Mostrar traducción de la frase 12', 'en')).toBe('Show translation for sentence 12');
    expect(translate('Estado de 公園 / こうえん', 'en')).toBe('Status of 公園 / こうえん');
    expect(translate('Ver palabra: 料理', 'en')).toBe('Look up word: 料理');
    expect(translate('Entrada: レストラン', 'en')).toBe('Entry: レストラン');
    expect(translate('  Biblioteca ', 'en')).toBe('  Library ');
    localStorage.setItem(LANGUAGE_KEY, 'invalid'); expect(loadLanguage()).toBe('es');
  });
  it('explains network fetch failures and preserves cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(contentService.loadManifest()).rejects.toThrow('No se pudo conectar con el servidor');
    const controller = new AbortController(); controller.abort();
    const aborted = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));
    await expect(contentService.loadManifest(controller.signal)).rejects.toBe(aborted);
  });
  it('can recover from a failed content fetch using the visible retry button', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(new Response(JSON.stringify(manifest))));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en');
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't connect to the server");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Your library' })).toBeVisible();
  });
});
