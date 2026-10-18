import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createLocalNarrator } from '../lib/narration';
import { speechFixture, voice } from '../test/speech';
import { NarrationPanel } from './NarrationPanel';
import { ReaderPage } from './ReaderPage';
import { LanguageProvider } from '../lib/i18n';
import { parseStory } from '../lib/storyValidation';
import work from '../../../stories/work/work_001.json';

describe('local narration controls', () => {
  it('explains unavailable local voices without offering a cloud fallback', async () => {
    const user = userEvent.setup(); const fixture = speechFixture([voice('Cloud', false)]);
    const narrator = createLocalNarrator(['朝です。'], () => fixture.environment);
    render(<LanguageProvider language="en"><NarrationPanel narrator={narrator} current={0} onSentence={vi.fn()} /></LanguageProvider>);
    await user.click(screen.getByText('Listen in Japanese'));
    expect(screen.getByRole('status')).toHaveTextContent('No local Japanese voice is available');
    expect(screen.queryByRole('button', { name: 'Listen from this sentence' })).toBeNull();
    await act(async () => fixture.setVoices([voice()]));
    expect(screen.getByRole('button', { name: 'Listen from this sentence' })).toBeEnabled();
  });
  it('keeps pause and stop reachable, selects spoken sentences, cancels on manual navigation and never completes a story', async () => {
    const user = userEvent.setup(); const fixture = speechFixture();
    vi.stubGlobal('speechSynthesis', fixture.synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text: string) { return fixture.utterance(text); } });
    const onPosition = vi.fn(), onComplete = vi.fn();
    const view = render(<ReaderPage story={parseStory(work, work.id)} onPosition={onPosition} onComplete={onComplete} onBack={vi.fn()} dictionary={{ lookup: async () => [] }} />);
    await user.click(screen.getByText('Escuchar en japonés'));
    await user.click(screen.getByRole('button', { name: 'Escuchar desde esta frase' }));
    const navigation = screen.getByRole('navigation', { name: 'Navegar por las frases' });
    expect(within(navigation).getByRole('button', { name: 'Pausar audio' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mostrar traducción de la frase 1' }));
    expect(within(navigation).getByRole('button', { name: 'Pausar audio' })).toBeVisible();
    await user.click(screen.getAllByRole('button', { name: /Ver palabra:/ })[0]);
    expect(within(navigation).getByRole('button', { name: 'Reanudar audio' })).toBeVisible();
    await user.click(within(navigation).getByRole('button', { name: 'Reanudar audio' }));
    await act(async () => fixture.end());
    expect(screen.getByText('Frase 2 de 15')).toBeVisible(); expect(onPosition).toHaveBeenCalledWith('s2');
    await user.click(within(navigation).getByRole('button', { name: 'Pausar audio' }));
    await user.click(within(navigation).getByRole('button', { name: 'Reanudar audio' }));
    await user.click(screen.getByRole('button', { name: 'Frase siguiente' }));
    await act(async () => fixture.end());
    expect(screen.getByText('Frase 3 de 15')).toBeVisible();
    expect(onComplete).not.toHaveBeenCalled();
    expect(fixture.utterances.every((utterance) => utterance.voice?.localService === true)).toBe(true);
    view.unmount();
  });
});
