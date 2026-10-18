import { useEffect, useState, useSyncExternalStore } from 'react';
import { useI18n } from '../lib/i18n';
import { NARRATION_RATES, type LocalNarrator } from '../lib/narration';

export function NarrationPanel({ narrator, current, onSentence }: { narrator: LocalNarrator; current: number; onSentence: (index: number) => void }) {
  const { t } = useI18n();
  const state = useSyncExternalStore(narrator.subscribe, narrator.getSnapshot);
  const [continuous, setContinuous] = useState(true);
  useEffect(() => narrator.connect(), [narrator]);
  const active = state.phase === 'playing' || state.phase === 'paused';
  return <details className="narration-panel"><summary><span>{t('Escuchar en japonés')}</span><span className="narration-label">{t('Voz del dispositivo')}</span></summary>
    <div className="narration-body">
      <p>{t('Narración automática con una voz japonesa local. No utiliza servicios de voz externos. La disponibilidad y la pronunciación dependen de tu dispositivo.')}</p>
      {!state.supported ? <p role="status">{t('Este navegador no ofrece narración local. Prueba con un navegador compatible.')}</p>
        : !state.voices.length ? <div><p role="status">{t('No hay una voz japonesa local disponible. Instala una voz japonesa en los ajustes de voz de tu dispositivo y vuelve a abrir el navegador.')}</p>
          <button type="button" onClick={narrator.refresh}>{t('Actualizar voces')}</button></div>
        : <><div className="narration-settings"><label>{t('Voz japonesa')}<select value={state.voiceId} onChange={(event) => narrator.setVoice(event.target.value)}>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
          <label>{t('Velocidad')}<select value={state.rate} onChange={(event) => narrator.setRate(Number(event.target.value))}>{NARRATION_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label></div>
          <label className="narration-continuous"><input type="checkbox" checked={continuous} disabled={active} onChange={(event) => setContinuous(event.target.checked)} />{t('Continuar con las siguientes frases')}</label>
          <div className="narration-actions">{state.phase === 'playing' ? <button type="button" onClick={narrator.pause}>{t('Pausar narración')}</button>
            : state.phase === 'paused' ? <button type="button" onClick={narrator.resume}>{t('Reanudar narración')}</button>
            : <button type="button" className="primary-button" onClick={() => narrator.playFrom(current, continuous, onSentence)}>{t('Escuchar desde esta frase')}</button>}
            <button type="button" disabled={!active} onClick={narrator.stop}>{t('Detener narración')}</button></div>
          <p className="narration-status" role="status">{state.phase === 'playing' ? t(`Escuchando la frase ${state.sentence! + 1}`) : state.phase === 'paused' ? t('Narración en pausa. Al reanudar se repite la frase pausada.') : state.phase === 'ended' ? t('Narración terminada.') : state.phase === 'error' ? t('Narración detenida.') : t('Lista para escuchar.')}</p>
        </>}
      {state.phase === 'error' && <p role="alert">{state.error === 'voice' ? t('La voz local ya no está disponible. Actualiza las voces e inténtalo de nuevo.') : t('No se pudo reproducir la voz local. Revisa los ajustes de voz o prueba otro navegador.')}</p>}
      <details className="narration-help"><summary>{t('Cómo funciona sin conexión')}</summary>
        <p>{t('La voz debe estar descargada e instalada en el dispositivo. Algunas voces japonesas del navegador necesitan internet y no aparecen aquí. Una vez abierta la historia, su narración local no necesita conexión; abrir otras páginas o historias puede requerirla.')}</p>
        <p>{t('Esta es una voz automática, no una grabación revisada por un profesor. Puede leer algunos kanji de otra manera según el contexto. Escuchar no marca la historia como completada.')}</p>
        <a href="https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices" target="_blank" rel="noopener noreferrer">{t('Ayuda para instalar voces en Windows')}</a>
      </details>
    </div>
  </details>;
}
