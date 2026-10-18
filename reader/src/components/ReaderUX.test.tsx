import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StoryLibrary } from './StoryLibrary';
import { VocabularySheet } from './VocabularySheet';
import { ComprehensionQuiz } from './ComprehensionQuiz';
import { ReaderPage } from './ReaderPage';
import { LanguageProvider } from '../lib/i18n';
import { parseManifest } from '../lib/content';
import { parseStory } from '../lib/storyValidation';
import { parseDictionaryChunk, resolveEntry, type DictionaryResult, type DictionaryService } from '../lib/dictionaryModel';
import { APPEARANCE_KEY, loadAppearance } from '../lib/appearance';
import manifestData from '../../../manifest.json';
import work from '../../../stories/work/work_001.json';
import fixture from '../test/dictionary-entries.json';

const stories = parseManifest(manifestData).stories;
const story = parseStory(work, work.id);
const entry = resolveEntry(parseDictionaryChunk(fixture).find((item) => item.id === '1212670')!, { lemma: '慣れる', reading: 'なれる' }, 'lemma')!;

describe('library discovery', () => {
  it('keeps the search when returning from a story and accepts Spanish topic words', async () => {
    const user = userEvent.setup(); const props = { stories, progress: {}, onOpen: vi.fn() };
    const view = render(<StoryLibrary {...props} />);
    await user.type(screen.getByRole('searchbox', { name: 'Buscar lecturas' }), 'amigos');
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('article').length).toBeLessThan(stories.length);
    view.unmount(); render(<StoryLibrary {...props} />);
    expect(screen.getByRole('searchbox', { name: 'Buscar lecturas' })).toHaveValue('amigos');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getAllByRole('article')).toHaveLength(stories.length);
  });
  it('combines multilingual search, duration and topic and clears an empty result', async () => {
    const user = userEvent.setup(); render(<StoryLibrary stories={stories} progress={{}} onOpen={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Buscar lecturas' });
    await user.type(search, 'fridge');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('El papel de la nevera')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Duración' }), 'short');
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByText('No encontramos esa lectura.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ver todas las lecturas' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tema' }), '料理');
    await user.click(screen.getByRole('button', { name: 'Lecturas largas' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    await user.type(search, '冷蔵庫');
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
  it('resumes only the most recent incomplete story and filters completed stories without modifying records', async () => {
    const user = userEvent.setup(), onOpen = vi.fn();
    const progress = {
      daily_001: { story_id: 'daily_001', last_opened: '2026-10-15T10:00:00Z', completed: false, last_sentence: 's3' },
      work_001: { story_id: 'work_001', last_opened: '2026-10-17T10:00:00Z', completed: false, last_sentence: 's8' },
      cooking_001: { story_id: 'cooking_001', last_opened: '2026-10-18T10:00:00Z', completed: true },
    };
    const original = JSON.stringify(progress);
    render(<StoryLibrary stories={stories} progress={progress} onOpen={onOpen} />);
    await user.click(screen.getByRole('button', { name: /Retomar lectura/ }));
    expect(onOpen).toHaveBeenCalledWith('work_001');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'completed');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'reading');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(JSON.stringify(progress)).toBe(original);
  });
});

describe('quick dictionary', () => {
  it('keeps the reader interactive, ignores superseded results, expands without a second lookup, and handles Escape', async () => {
    const user = userEvent.setup(), close = vi.fn();
    let late: (value: DictionaryResult[]) => void = () => {};
    const dictionary: DictionaryService = { lookup: vi.fn().mockImplementationOnce(() => new Promise<DictionaryResult[]>((resolve) => { late = resolve; })).mockResolvedValue([entry]) };
    const initial = { surface: '仕事', lemma: '仕事', reading: 'しごと' };
    const view = render(<><button>Reader word</button><VocabularySheet quick token={initial} dictionary={dictionary} onClose={close} /></>);
    await user.click(screen.getByRole('button', { name: 'Reader word' }));
    const next = { surface: '慣れ', lemma: '慣れる', reading: 'なれ' };
    view.rerender(<><button>Reader word</button><VocabularySheet quick token={next} dictionary={dictionary} onClose={close} /></>);
    expect(await screen.findByText('acostumbrarse')).toBeVisible();
    await act(async () => late([]));
    expect(screen.getByText('acostumbrarse')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver todos los detalles' }));
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(dictionary.lookup).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Cerrar vocabulario' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver todos los detalles' })).toHaveFocus();
    await user.keyboard('{Escape}'); expect(close).toHaveBeenCalledOnce();
  });
  it('shows the language fallback and additional interpretations rather than treating the brief gloss as definitive', async () => {
    const upper = resolveEntry(parseDictionaryChunk(fixture).find((item) => item.readings.some((r) => r.text === 'かみて'))!, { lemma: '上手', reading: 'かみて' }, 'lemma')!;
    render(<VocabularySheet quick token={{ surface: '上手', lemma: '上手', reading: 'かみて' }} dictionary={{ lookup: async () => [upper, entry] }} onClose={vi.fn()} />);
    expect(await screen.findByText('Inglés · sin definición en español')).toBeVisible();
    expect(screen.getByText('Hay otros sentidos o entradas. Consulta los detalles.')).toBeVisible();
  });
});

describe('reading presentation and comprehension', () => {
  it('persists presentation separately from learner state and keeps the reading position', async () => {
    const user = userEvent.setup(), onPosition = vi.fn();
    render(<ReaderPage story={story} progress={{ story_id: work.id, last_sentence: 's3', last_opened: '2026-10-18', completed: false }} onBack={vi.fn()} onPosition={onPosition} onComplete={vi.fn()} />);
    await user.click(screen.getByText('Lectura', { exact: true }));
    await user.click(screen.getByRole('checkbox', { name: 'Párrafos continuos' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Color del papel' }), 'night');
    expect(loadAppearance()).toMatchObject({ continuous: true, paper: 'night' });
    expect(screen.getByText('Frase 3 de 15')).toBeVisible(); expect(onPosition).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toHaveProperty('version', 1);
    localStorage.setItem(APPEARANCE_KEY, 'broken'); expect(loadAppearance().paper).toBe('light');
  });
  it('checks closed answers, shows explanations in English and treats short answers as self-review', async () => {
    const user = userEvent.setup();
    render(<LanguageProvider language="en"><ComprehensionQuiz questions={story.comprehension!.questions} /></LanguageProvider>);
    await user.click(screen.getByText('What did you understand?'));
    const groups = screen.getAllByRole('group').filter((element) => element.tagName === 'FIELDSET');
    await user.click(within(groups[0]).getByRole('radio', { name: 'もう一度確認しました' }));
    await user.click(within(groups[0]).getByRole('button', { name: 'Check answer' }));
    expect(within(groups[0]).getByText('Correct!')).toBeVisible();
    await user.click(within(groups[1]).getByRole('radio', { name: 'False' }));
    await user.click(within(groups[1]).getByRole('button', { name: 'Check answer' }));
    expect(within(groups[1]).getByText('Take another look at this part of the story.')).toBeVisible();
    await user.click(within(groups[2]).getByRole('button', { name: 'Show model answer' }));
    expect(within(groups[2]).getByText('忙しくなる前です。')).toBeVisible();
    expect(within(groups[2]).getByText(/other answers may also be valid/)).toBeVisible();
  });
});
