import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { dictionaryService, type DictionaryResult, type DictionaryService, type DictionaryStatus } from '../lib/dictionary';
import type { Token } from '../lib/types';
import { DictionaryDefinition } from './DictionaryDefinition';
import { VocabularyControls } from './LearnerState';
import { identityForToken } from '../lib/vocabulary';
import { hiraganaReading } from './JapaneseText';

export function VocabularySheet({ token, onClose, dictionary = dictionaryService }: {
  token: Token; onClose: () => void; dictionary?: DictionaryService;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<DictionaryResult[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<DictionaryStatus>({ phase: 'idle' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal(); // Native dialog supplies focus trapping and inert background.
    return () => { element.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setEntries([]);
    setState('loading');
    const updateStatus = () => setStatus(dictionary.getStatus?.() ?? { phase: 'idle' });
    updateStatus();
    const unsubscribe = dictionary.subscribe?.(updateStatus);
    dictionary.lookup({ lemma: token.lemma, surface: token.surface, reading: token.reading, type: token.type }, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setEntries(result); setState('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => { controller.abort(); unsubscribe?.(); };
  }, [token, dictionary, retry]);
  const tokenFacts = <dl className="word-facts">
    <div><dt>{t("Forma de diccionario en la historia")}</dt><dd lang="ja">{token.lemma}</dd></div>
    <div><dt>{t("Lectura de la forma seleccionada")}</dt><dd lang="ja">{hiraganaReading(token.reading)}</dd></div>
    {token.type && <div><dt>{t("Tipo en la historia")}</dt><dd>{({ noun: t('Sustantivo'), verb: t('Verbo'), adjective: t('Adjetivo'), adverb: t('Adverbio') } as Record<string, string>)[token.type] ?? token.type}</dd></div>}
  </dl>;
  return <dialog ref={dialog} className="vocabulary-sheet" aria-labelledby="word-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === dialog.current) {
      const bounds = dialog.current.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    <div className="sheet-top"><p className="eyebrow">{t("La palabra en esta lectura")}</p>
      <button type="button" className="icon-button" aria-label={t("Cerrar vocabulario")} onClick={onClose} autoFocus>×</button></div>
    <h2 id="word-title" lang="ja">{token.surface}</h2>
    {token.target && <p className="target-label">{t("Vocabulario objetivo")}</p>}
    {state === 'loading' && <div className="dictionary-status" role="status">
      <p>{status.phase === 'preparing' ? t('Preparando el diccionario japonés…') : t('Buscando en el diccionario…')}</p>
      {status.phase === 'preparing' && <><progress aria-label={t("Preparación del diccionario")} max={100} value={status.progress ?? 0} />
        <span>{status.progress ?? 0}{t("% · Solo se prepara una vez en este navegador.")}</span></>}
    </div>}
    {state === 'error' && <div className="dictionary-status" role="status"><p>{t("Diccionario no disponible.")}</p>
      <p className="dictionary-note">{t("Puedes consultar la información de la lectura. Comprueba que el diccionario local esté preparado y que el navegador permita guardarlo.")}</p>
      <button type="button" className="text-button" onClick={() => setRetry((count) => count + 1)}>{t("Reintentar diccionario")}</button></div>}
    {state === 'ready' && entries.length === 0 && <p className="dictionary-note" role="status">{t("No se encontró una entrada. Información de la lectura:")}</p>}
    {state === 'ready' && entries.length > 0 ? <>
      <DictionaryDefinition entry={entries[0]} />
      {entries.length > 1 && <details className="dictionary-details other-entries"><summary>{t('Otras entradas')} ({entries.length - 1})</summary>
        {entries.slice(1).map((entry) => <DictionaryDefinition key={entry.id} entry={entry} />)}</details>}
      <details className="dictionary-details token-annotations"><summary>{t("Información de la lectura")}</summary>{tokenFacts}</details>
      {status.message && <p className="dictionary-note" role="status">{t(status.message)}</p>}
    </> : <>{tokenFacts}{state !== 'loading' && <VocabularyControls identity={identityForToken(token)} />}</>}
    <footer className="dictionary-attribution">
      <p>{t("JMdict · © James William Breen y EDRDG. Datos JSON: jmdict-simplified.")}</p>
      <a href="https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html" target="_blank" rel="noreferrer">{t("Fuente")}</a>
      <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer">{t("Licencia CC BY-SA 4.0")}</a>
      <a href={`${import.meta.env.BASE_URL}dictionary-notice.md`} target="_blank" rel="noreferrer">{t("Créditos")}</a>
    </footer>
  </dialog>;
}
