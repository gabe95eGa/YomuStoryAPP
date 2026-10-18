import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalNarrator, localJapaneseVoices } from './narration';
import { speechFixture, voice } from '../test/speech';
const disconnects: Array<() => void> = [];
function setup(voices = [voice()]) {
  const fixture = speechFixture(voices);
  const narrator = createLocalNarrator(['朝です。', '公園に行きます。'], () => fixture.environment);
  disconnects.push(narrator.connect());
  return { ...fixture, narrator };
}
afterEach(() => { disconnects.splice(0).forEach((disconnect) => disconnect()); });
describe('local-only Japanese narration', () => {
  it('excludes all remote, non-Japanese and unclassified voices, even remote defaults', () => {
    const cloud = { ...voice('Japanese cloud', false), default: true };
    expect(localJapaneseVoices([cloud, voice('English', true, 'en-US'), voice(), voice('Legacy', true, 'ja_JP')]).map((item) => item.name)).toEqual(['Japanese local', 'Legacy']);
    const { narrator, synth } = setup([cloud]);
    expect(narrator.getSnapshot().voices).toEqual([]);
    narrator.playFrom(0); expect(synth.speak).not.toHaveBeenCalled();
    expect(narrator.getSnapshot().error).toBe('voice');
  });
  it('discovers voices arriving late and never starts playback automatically', () => {
    const { narrator, synth, setVoices } = setup([]);
    setVoices([voice(), voice('Online', false)]);
    expect(narrator.getSnapshot().voices).toHaveLength(1); expect(synth.speak).not.toHaveBeenCalled();
  });
  it('reads original Japanese sentence by sentence with an explicit local voice and chosen speed', () => {
    const { narrator, utterances, end } = setup(); const select = vi.fn();
    narrator.setRate(0.65); narrator.playFrom(0, true, select);
    expect(utterances[0]).toMatchObject({ text: '朝です。', lang: 'ja-JP', rate: 0.65, voice: { localService: true } });
    end(); expect(utterances[1].text).toBe('公園に行きます。');
    end(); expect(narrator.getSnapshot().phase).toBe('ended');
    expect(utterances).toHaveLength(2); expect(select.mock.calls).toEqual([[0], [1]]);
  });
  it('pauses by cancellation, resumes the same sentence and ignores cancelled events', () => {
    const { narrator, synth, utterances, end, error } = setup();
    narrator.playFrom(0); narrator.pause();
    expect(synth.cancel).toHaveBeenCalledOnce(); expect(narrator.getSnapshot().phase).toBe('paused');
    end(0); error(0); expect(utterances).toHaveLength(1); expect(narrator.getSnapshot().phase).toBe('paused');
    narrator.resume(); expect(utterances[1].text).toBe('朝です。');
    narrator.stop(); end(1); expect(narrator.getSnapshot().phase).toBe('idle'); expect(utterances).toHaveLength(2);
  });
  it('cancels a superseded sentence and supports single-sentence playback', () => {
    const { narrator, utterances, end } = setup();
    narrator.playFrom(0); narrator.playFrom(1, false); end(0);
    expect(narrator.getSnapshot().sentence).toBe(1); expect(utterances).toHaveLength(2);
    end(1); expect(narrator.getSnapshot().phase).toBe('ended');
    narrator.playFrom(0, false); end(2); expect(utterances).toHaveLength(3);
  });
  it('stops when the voice disappears and never switches to a cloud replacement', () => {
    const { narrator, utterances, setVoices, end, synth } = setup();
    narrator.playFrom(0); setVoices([voice('Japanese local', false)]); end(0);
    expect(utterances).toHaveLength(1); expect(synth.cancel).toHaveBeenCalledOnce();
    expect(narrator.getSnapshot().voices).toHaveLength(0); expect(narrator.getSnapshot().phase).toBe('idle');
  });
  it('rechecks voice locality between sentences even without a discovery event', () => {
    const { narrator, utterances, synth, end } = setup();
    narrator.playFrom(0); synth.getVoices.mockReturnValue([voice('Japanese local', false)]); end();
    expect(utterances).toHaveLength(1); expect(narrator.getSnapshot()).toMatchObject({ phase: 'error', error: 'voice', voices: [] });
  });
  it('cancels on pagehide and disconnect and ignores late completion events', () => {
    const { narrator, utterances, end } = setup(); narrator.playFrom(0);
    window.dispatchEvent(new Event('pagehide')); end(); expect(narrator.getSnapshot().phase).toBe('idle');
    narrator.playFrom(0); disconnects.pop()!(); end(); expect(utterances).toHaveLength(2);
  });
  it('handles unsupported browsers, platform errors and invalid control input', () => {
    const unsupported = createLocalNarrator(['朝'], () => undefined); unsupported.connect(); unsupported.playFrom(0);
    expect(unsupported.getSnapshot().supported).toBe(false);
    const { narrator, synth } = setup(); narrator.setVoice('cloud'); narrator.setRate(99); narrator.playFrom(-1); narrator.playFrom(3);
    expect(narrator.getSnapshot().rate).toBe(0.8); expect(synth.speak).not.toHaveBeenCalled();
    synth.speak.mockImplementationOnce(() => { throw new Error('unavailable'); }); narrator.playFrom(0);
    expect(narrator.getSnapshot()).toMatchObject({ phase: 'error', error: 'playback' });
  });
});
