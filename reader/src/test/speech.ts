import { vi } from 'vitest';
import type { SpeechEnvironment } from '../lib/narration';
export const voice = (name = 'Japanese local', localService = true, lang = 'ja-JP'): SpeechSynthesisVoice => ({ name, lang, localService, voiceURI: name, default: false });
export function speechFixture(initial: SpeechSynthesisVoice[] = [voice()]) {
  let voices = initial;
  const events = new EventTarget();
  const utterances: SpeechSynthesisUtterance[] = [];
  const synth = { getVoices: vi.fn(() => voices), speak: vi.fn((utterance: SpeechSynthesisUtterance) => { utterances.push(utterance); }), cancel: vi.fn(),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  const utterance = (text: string) => ({ text, lang: '', rate: 1, voice: null, onend: null, onerror: null }) as unknown as SpeechSynthesisUtterance;
  const environment: SpeechEnvironment = { synth, utterance };
  return { synth, utterances, environment, utterance, setVoices(next: SpeechSynthesisVoice[]) { voices = next; events.dispatchEvent(new Event('voiceschanged')); },
    end(index = utterances.length - 1) { utterances[index].onend?.call(utterances[index], {} as SpeechSynthesisEvent); },
    error(index = utterances.length - 1) { utterances[index].onerror?.call(utterances[index], {} as SpeechSynthesisErrorEvent); } };
}
