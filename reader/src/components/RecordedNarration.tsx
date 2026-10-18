import { useEffect, useRef, useState, type RefObject } from 'react';
import { useI18n } from '../lib/i18n';
import type { RecordedStory } from '../lib/recordedAudio';

export interface RecordedControls { pause: () => void; stop: () => void; resume: () => void }

export function RecordedNarration({ recording, controller, onPlay, onSection, onState }: {
  recording: RecordedStory; controller: RefObject<RecordedControls | null>;
  onPlay: () => void; onSection: (id: string) => void;
  onState: (state: 'idle' | 'playing' | 'paused') => void;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const [section, setSection] = useState(0);
  const [continuous, setContinuous] = useState(true);
  const [error, setError] = useState(false);
  const pendingPlay = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const stopped = useRef(true);
  const callbacks = useRef({ onPlay, onSection, onState });
  callbacks.current = { onPlay, onSection, onState };
  function play() {
    const player = audio.current;
    if (!player) return;
    const attempt = ++generation.current;
    setError(false);
    void player.play().catch(() => { if (mounted.current && attempt === generation.current) { setError(true); callbacks.current.onState('idle'); } });
  }
  function stop() {
    generation.current++; stopped.current = true;
    pendingPlay.current = false;
    if (audio.current) { audio.current.pause(); audio.current.currentTime = 0; }
    callbacks.current.onState('idle');
  }
  useEffect(() => {
    mounted.current = true;
    controller.current = { pause: () => { generation.current++; pendingPlay.current = false; audio.current?.pause(); }, stop, resume: play };
    const player = audio.current;
    const leave = () => { pendingPlay.current = false; player?.pause(); };
    window.addEventListener('pagehide', leave);
    return () => { mounted.current = false; generation.current++; pendingPlay.current = false; player?.pause(); controller.current = null; window.removeEventListener('pagehide', leave); };
  }, [controller]);
  useEffect(() => {
    if (pendingPlay.current) { pendingPlay.current = false; play(); }
  }, [section]);
  function changeSection(next: number, autoPlay = false) {
    stop(); setError(false); setSection(next); pendingPlay.current = autoPlay;
    callbacks.current.onSection(recording.paragraphs[next].id);
  }
  return <section className="recorded-narration narration-panel" aria-label={t('Audio por secciones')}>
    <div className="recorded-heading"><strong>{t('Escuchar la historia')}</strong><span className="narration-label">{t('Audio japonés · Azure')}</span></div>
    <div className="narration-body">
      <p>{t('Audio generado previamente. Reproducirlo no utiliza la API de Azure. La voz es automática y puede cometer errores de pronunciación.')}</p>
      <label>{t('Sección')} <select value={section} onChange={(event) => changeSection(Number(event.target.value))}>
        {recording.paragraphs.map((paragraph, i) => <option key={paragraph.id} value={i}>{i + 1} / {recording.paragraphs.length}</option>)}
      </select></label>
      <audio ref={audio} controls preload="none" src={`${import.meta.env.BASE_URL}content/${recording.files[section].path}`}
        onPlay={() => { stopped.current = false; callbacks.current.onPlay(); callbacks.current.onSection(recording.paragraphs[section].id); callbacks.current.onState('playing'); }}
        onPause={() => callbacks.current.onState(stopped.current ? 'idle' : 'paused')}
        onEnded={() => { if (continuous && section + 1 < recording.files.length) changeSection(section + 1, true); else stop(); }}
        onError={() => { setError(true); callbacks.current.onState('idle'); }} />
      <div className="narration-actions">
        <button type="button" disabled={section === 0} onClick={() => changeSection(section - 1)}>{t('Sección anterior')}</button>
        <button type="button" onClick={() => { if (audio.current) audio.current.currentTime = 0; play(); }}>{t('Repetir sección')}</button>
        <button type="button" disabled={section + 1 === recording.files.length} onClick={() => changeSection(section + 1)}>{t('Sección siguiente')}</button>
      </div>
      <label className="narration-continuous"><input type="checkbox" checked={continuous} onChange={(event) => setContinuous(event.target.checked)} />{t('Continuar con la siguiente sección')}</label>
      {error && <p role="alert">{t('No se pudo reproducir el audio. Comprueba la conexión o utiliza la voz del dispositivo.')}</p>}
    </div>
  </section>;
}
