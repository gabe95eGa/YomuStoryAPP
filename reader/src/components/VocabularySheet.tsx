import { useEffect, useRef, useState } from 'react';
import { dictionaryService, type DictionaryEntry, type DictionaryService } from '../lib/dictionary';
import type { Token } from '../lib/types';

export function VocabularySheet({ token, onClose, dictionary = dictionaryService }: {
  token: Token; onClose: () => void; dictionary?: DictionaryService;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal(); // Native dialog supplies focus trapping and inert background.
    return () => { element.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setEntry(null);
    dictionary.lookup(token.lemma, controller.signal).then((result) => {
      if (!controller.signal.aborted) setEntry(result);
    }).catch(() => { /* Token annotations remain usable if a future adapter fails. */ });
    return () => controller.abort();
  }, [token, dictionary]);
  return <dialog ref={dialog} className="vocabulary-sheet" aria-labelledby="word-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === dialog.current) {
      const bounds = dialog.current.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    <div className="sheet-top"><p className="eyebrow">La palabra en esta lectura</p>
      <button type="button" className="icon-button" aria-label="Cerrar vocabulario" onClick={onClose} autoFocus>×</button></div>
    <h2 id="word-title" lang="ja">{token.surface}</h2>
    {token.target && <p className="target-label">Vocabulario objetivo</p>}
    <dl className="word-facts">
      <div><dt>Forma de diccionario</dt><dd lang="ja">{token.lemma}</dd></div>
      <div><dt>Lectura de esta forma</dt><dd lang="ja">{token.reading}</dd></div>
      {token.type && <div><dt>Tipo</dt><dd>{({ noun: 'Sustantivo', verb: 'Verbo', adjective: 'Adjetivo', adverb: 'Adverbio' } as Record<string, string>)[token.type] ?? token.type}</dd></div>}
    </dl>
    {entry ? <div className="dictionary-entry"><p>{entry.meanings_es.join('; ')}</p><small>Fuente: {entry.source}</small></div>
      : <p className="dictionary-note">Información de la lectura. Las definiciones del diccionario estarán disponibles en una próxima versión.</p>}
  </dialog>;
}
