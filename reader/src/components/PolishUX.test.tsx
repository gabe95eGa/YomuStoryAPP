import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnkiExport } from './AnkiExport';
import { ReaderPage } from './ReaderPage';
import { LanguageProvider } from '../lib/i18n';
import type { LearnerVocabularyItem } from '../lib/vocabulary';
import { parseStory } from '../lib/storyValidation';
import work from '../../../stories/work/work_001.json';
const item: LearnerVocabularyItem = { id: 'token:近所:きんじょ', lemma: '近所', reading: 'きんじょ', status: 'learning', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' };
describe('reader polish and Anki preparation', () => {
  it('defaults Anki to learning words, previews unresolved cards and invalidates the snapshot after changing scope', async () => {
    const user = userEvent.setup(); const items = [item, { ...item, id: 'known', lemma: '公園', reading: 'こうえん', status: 'known' as const }];
    const before = JSON.stringify(items); const lookup = vi.fn().mockResolvedValue([]);
    render(<AnkiExport items={items} dictionary={{ lookup }} />);
    expect(screen.getByRole('combobox', { name: 'Palabras para Anki' })).toHaveValue('learning');
    await user.click(screen.getByRole('button', { name: 'Preparar tarjetas' }));
    expect(await screen.findByRole('button', { name: 'Descargar para Anki' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Registros sin definición inequívoca: 1');
    expect(lookup).toHaveBeenCalledTimes(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Palabras para Anki' }), 'all');
    expect(screen.queryByRole('button', { name: 'Descargar para Anki' })).toBeNull();
    expect(JSON.stringify(items)).toBe(before);
  });
  it('discards late Anki results after cancellation and translates its controls into English', async () => {
    const user = userEvent.setup(); let resolve: (value: []) => void = () => {};
    render(<LanguageProvider language="en"><AnkiExport items={[item]} dictionary={{ lookup: () => new Promise((done) => { resolve = done; }) }} /></LanguageProvider>);
    await user.click(screen.getByRole('button', { name: 'Prepare cards' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => resolve([]));
    expect(screen.queryByRole('button', { name: 'Download for Anki' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Prepare cards' })).toBeEnabled();
  });
  it('uses one translation state for sentence actions and the persistent navigation control', async () => {
    const user = userEvent.setup(); const story = parseStory(work, work.id);
    render(<ReaderPage story={story} dictionary={{ lookup: vi.fn().mockResolvedValue([]) }} onBack={vi.fn()} onPosition={vi.fn()} onComplete={vi.fn()} />);
    const control = screen.getByRole('button', { name: 'Traducción de la frase actual' });
    await user.click(control);
    expect(screen.getByText(story.content.paragraphs[0].sentences[0].translation_es!)).toBeVisible();
    expect(control).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Ocultar traducción de la frase 1' }));
    expect(control).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Frase siguiente' }));
    await user.click(control);
    await waitFor(() => expect(screen.getByText(story.content.paragraphs[0].sentences[1].translation_es!)).toBeVisible());
    expect(screen.getByText(story.content.paragraphs[0].sentences[0].translation_es!)).not.toBeVisible();
  });
});
