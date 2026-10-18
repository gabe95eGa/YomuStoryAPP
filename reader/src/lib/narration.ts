export type NarrationPhase = 'idle' | 'playing' | 'paused' | 'ended' | 'error';
export interface LocalVoice { id: string; name: string; lang: string }
export interface NarrationState {
  supported: boolean; voices: LocalVoice[]; voiceId: string; rate: number;
  phase: NarrationPhase; sentence: number | null; error?: 'voice' | 'playback';
}
export interface SpeechEnvironment {
  synth: Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel' | 'addEventListener' | 'removeEventListener'>;
  utterance: (text: string) => SpeechSynthesisUtterance;
}
const voiceId = (voice: SpeechSynthesisVoice) => JSON.stringify([voice.voiceURI, voice.name, voice.lang]);
export const localJapaneseVoices = (voices: SpeechSynthesisVoice[]) => voices.filter((voice) => voice.localService === true && /^ja(?:[-_]|$)/i.test(voice.lang));
export const NARRATION_RATES = [0.65, 0.8, 1, 1.15];
function browserSpeech(): SpeechEnvironment | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  return { synth: window.speechSynthesis, utterance: (text) => new window.SpeechSynthesisUtterance(text) };
}

// Only installed Japanese voices are eligible. No default/cloud fallback and no
// HTTP requests, keys, text uploads, persisted audio or learner-state writes.
export function createLocalNarrator(sentences: string[], environment: () => SpeechEnvironment | undefined = browserSpeech) {
  let speech: SpeechEnvironment | undefined;
  let state: NarrationState = { supported: false, voices: [], voiceId: '', rate: 0.8, phase: 'idle', sentence: null };
  const listeners = new Set<() => void>();
  let generation = 0;
  let currentUtterance: SpeechSynthesisUtterance | undefined;
  let continuous = true;
  let onSentence: (index: number) => void = () => {};
  const publish = (patch: Partial<NarrationState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  function cancelOwned() {
    generation++;
    const owned = currentUtterance; currentUtterance = undefined;
    if (owned) speech?.synth.cancel();
  }
  function stop() { cancelOwned(); publish({ phase: 'idle', sentence: null, error: undefined }); }
  function refresh() {
    if (!speech) return;
    let voices: SpeechSynthesisVoice[];
    try { voices = localJapaneseVoices(speech.synth.getVoices()); }
    catch { cancelOwned(); publish({ voices: [], voiceId: '', phase: 'error', error: 'voice' }); return; }
    const choices = [...new Map(voices.map((voice) => [voiceId(voice), { id: voiceId(voice), name: voice.name, lang: voice.lang }])).values()];
    const selected = choices.find((voice) => voice.id === state.voiceId)?.id ?? choices[0]?.id ?? '';
    if (state.voiceId && selected !== state.voiceId && (state.phase === 'playing' || state.phase === 'paused')) stop();
    publish({ voices: choices, voiceId: selected });
  }
  function speakAt(index: number, ticket: number) {
    if (!speech || ticket !== generation) return;
    try {
      // Recheck at every sentence, including resume: a voice can disappear or
      // change its locality after the initial discovery event.
      const voice = localJapaneseVoices(speech.synth.getVoices()).find((item) => voiceId(item) === state.voiceId);
      if (!voice) { cancelOwned(); publish({ phase: 'error', error: 'voice' }); refresh(); return; }
      const utterance = speech.utterance(sentences[index]);
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = state.rate;
      currentUtterance = utterance;
      utterance.onend = () => {
        if (ticket !== generation || currentUtterance !== utterance) return;
        currentUtterance = undefined;
        if (continuous && index + 1 < sentences.length) speakAt(index + 1, ticket);
        else publish({ phase: 'ended' });
      };
      utterance.onerror = () => {
        if (ticket !== generation || currentUtterance !== utterance) return;
        currentUtterance = undefined; generation++;
        publish({ phase: 'error', error: 'playback' });
      };
      publish({ phase: 'playing', sentence: index, error: undefined });
      onSentence(index);
      speech.synth.speak(utterance);
    } catch { cancelOwned(); publish({ phase: 'error', error: 'playback' }); }
  }
  function playFrom(index: number, nextContinuous = true, notify: (index: number) => void = () => {}) {
    if (!speech || !Number.isInteger(index) || index < 0 || index >= sentences.length) return;
    cancelOwned(); continuous = nextContinuous; onSentence = notify;
    speakAt(index, generation);
  }
  function pause() {
    if (state.phase !== 'playing') return;
    cancelOwned(); publish({ phase: 'paused' });
  }
  function resume() { if (state.phase === 'paused' && state.sentence !== null) playFrom(state.sentence, continuous, onSentence); }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect() {
      speech = environment();
      if (!speech) return () => {};
      publish({ supported: true });
      speech.synth.addEventListener('voiceschanged', refresh);
      window.addEventListener('pagehide', stop);
      refresh();
      return () => {
        speech?.synth.removeEventListener('voiceschanged', refresh);
        window.removeEventListener('pagehide', stop);
        cancelOwned(); speech = undefined;
      };
    },
    refresh, playFrom, pause, resume, stop,
    setVoice(id: string) { if (state.voices.some((voice) => voice.id === id)) { stop(); publish({ voiceId: id }); } },
    setRate(rate: number) { if (NARRATION_RATES.includes(rate)) { stop(); publish({ rate }); } },
  };
}
export type LocalNarrator = ReturnType<typeof createLocalNarrator>;
