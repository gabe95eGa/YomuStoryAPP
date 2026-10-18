import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordedNarration, type RecordedControls } from './RecordedNarration';
import { recordingFor, type RecordedStory } from '../lib/recordedAudio';
import { parseStory } from '../lib/storyValidation';
import cooking from '../../../stories/cooking/cooking_001.json';
import { LanguageProvider } from '../lib/i18n';
import { ReaderPage } from './ReaderPage';
import { speechFixture } from '../test/speech';

vi.mock('../../../audio/catalog.json', async () => {
  const { default: story } = await import('../../../stories/cooking/cooking_001.json');
  return { default: { version: 1, stories: { [story.id]: {
    story_id: story.id, provider: 'azure-speech-f0', review: 'playback-checked', voice: 'ja-JP-NanamiNeural',
    paragraphs: story.content.paragraphs.map(({ id, sentences }) => ({ id, sentences: sentences.map(({ id, text }) => ({ id, text })) })),
    files: story.content.paragraphs.map((_, i) => ({ path: `audio/${story.id}/${String(i + 1).padStart(2, '0')}.mp3`, sha256: 'a'.repeat(64), bytes: 300 })),
  } } } };
});

const story = parseStory(cooking, cooking.id);
const recording: RecordedStory = {
  story_id: story.id, provider: 'azure-speech-f0', review: 'playback-checked', voice: 'ja-JP-NanamiNeural',
  paragraphs: story.content.paragraphs.map(({ id, sentences }) => ({ id, sentences: sentences.map(({ id, text }) => ({ id, text })) })),
  files: story.content.paragraphs.map((_, i) => ({ path: `audio/${story.id}/${String(i + 1).padStart(2, '0')}.mp3`, sha256: 'a'.repeat(64), bytes: 300 })),
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('recorded narration', () => {
  it('rejects stale text and external audio URLs, but accepts translation corrections', () => {
    expect(recordingFor(story, { [story.id]: recording })).toEqual(recording);
    const changed = structuredClone(story); changed.content.paragraphs[0].sentences[0].text += '。';
    expect(recordingFor(changed, { [story.id]: recording })).toBeNull();
    const external = structuredClone(recording); external.files[0].path = 'https://example.org/track.mp3';
    expect(recordingFor(story, { [story.id]: external })).toBeNull();
    const translated = structuredClone(story); translated.content.paragraphs[0].sentences[0].translation_es = 'Updated';
    expect(recordingFor(translated, { [story.id]: recording })).not.toBeNull();
  });
  it('advances sections, repeats and stops with controls reachable outside the player', async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const controller = createRef<RecordedControls>(); const onPlay = vi.fn(), onSection = vi.fn(), onState = vi.fn();
    const view = render(<LanguageProvider language="en"><RecordedNarration recording={recording} controller={controller} onPlay={onPlay} onSection={onSection} onState={onState} /></LanguageProvider>);
    const audio = view.container.querySelector('audio')!;
    expect(audio.preload).toBe('none');
    fireEvent.play(audio); expect(onPlay).toHaveBeenCalled(); expect(onSection).toHaveBeenLastCalledWith(recording.paragraphs[0].id);
    fireEvent.ended(audio);
    expect(screen.getByRole('combobox')).toHaveValue('1'); expect(audio.src).toContain('/02.mp3');
    expect(play).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Repeat section' })); expect(play).toHaveBeenCalledTimes(2);
    act(() => controller.current?.pause()); expect(pause).toHaveBeenCalled();
    act(() => controller.current?.stop()); expect(audio.currentTime).toBe(0); expect(onState).toHaveBeenLastCalledWith('idle');
    await user.click(screen.getByRole('checkbox')); fireEvent.ended(audio);
    expect(screen.getByRole('combobox')).toHaveValue('1');
    view.unmount(); expect(controller.current).toBeNull();
  });
  it('reports failed playback and ignores obsolete promise failures after stopping', async () => {
    let reject!: (reason: Error) => void;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => new Promise((_, no) => { reject = no; }));
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const controller = createRef<RecordedControls>(); const onState = vi.fn();
    const view = render(<RecordedNarration recording={recording} controller={controller} onPlay={vi.fn()} onSection={vi.fn()} onState={onState} />);
    act(() => controller.current?.resume()); act(() => controller.current?.stop());
    await act(async () => reject(new Error('cancelled'))); expect(screen.queryByRole('alert')).toBeNull();
    act(() => controller.current?.resume()); await act(async () => reject(new Error('autoplay denied')));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo reproducir');
    fireEvent.error(view.container.querySelector('audio')!); expect(onState).toHaveBeenLastCalledWith('idle');
    view.unmount();
  });
  it('coordinates recorded and local voices and never completes reading automatically', async () => {
    const user = userEvent.setup(); const fixture = speechFixture();
    vi.stubGlobal('speechSynthesis', fixture.synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text: string) { return fixture.utterance(text); } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const onComplete = vi.fn(), onPosition = vi.fn();
    const view = render(<ReaderPage story={story} onBack={vi.fn()} onPosition={onPosition} onComplete={onComplete} dictionary={{ lookup: async () => [] }} />);
    const audio = view.container.querySelector('audio')!;
    fireEvent.play(audio);
    expect(view.container.querySelectorAll('.audio-section-active')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Frase siguiente' })); expect(pause).toHaveBeenCalled();
    await user.click(screen.getByText('Escuchar en japonés'));
    await user.click(screen.getByRole('button', { name: 'Escuchar desde esta frase' }));
    expect(screen.queryByText('Audio por secciones', { selector: '.narration-transport span' })).toBeNull();
    fireEvent.play(audio);
    expect(screen.queryByText('Voz local', { selector: '.narration-transport span' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Sección'), '3'); fireEvent.ended(audio);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onPosition).toHaveBeenCalledWith(story.content.paragraphs[3].sentences[0].id);
    view.unmount(); vi.unstubAllGlobals();
  });
});
