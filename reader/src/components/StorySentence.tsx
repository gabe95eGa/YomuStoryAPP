import { useState } from 'react';
import type { Sentence, Token } from '../lib/types';
import { JapaneseText } from './JapaneseText';

export function StorySentence({ sentence, number, active, furigana, onToken, onSelect }: {
  sentence: Sentence; number: number; active: boolean; furigana: boolean;
  onToken: (token: Token) => void; onSelect: () => void;
}) {
  const [translated, setTranslated] = useState(false);
  const translationId = `translation-${sentence.id}`;
  return <section id={`sentence-${sentence.id}`} className={`sentence${active ? ' sentence-active' : ''}`}
    tabIndex={-1} aria-label={`Frase ${number}`}>
    <JapaneseText sentence={sentence} furigana={furigana} onToken={onToken} />
    <div className="sentence-tools">
      <button type="button" className="text-button" aria-expanded={translated}
        aria-controls={translationId} aria-label={`${translated ? 'Ocultar' : 'Mostrar'} traducción de la frase ${number}`}
        onClick={() => { setTranslated(!translated); onSelect(); }}>
        {translated ? 'Ocultar traducción' : 'Traducción'} <span aria-hidden="true">{translated ? '−' : '+'}</span>
      </button>
      {sentence.grammar_points?.length ? <details className="grammar-info">
        <summary>Gramática <span aria-hidden="true">{sentence.grammar_points.length}</span></summary>
        <div className="grammar-list">{sentence.grammar_points.map((point, index) => <div key={index}>
          <strong lang="ja">{point.pattern}</strong>
          {point.level && <span className="badge">{point.level}</span>}
          {point.target && <span className="small-label">Objetivo</span>}
          {point.meaning_es && <p>{point.meaning_es}</p>}
        </div>)}</div>
      </details> : null}
    </div>
    <p id={translationId} className="translation" lang="es" hidden={!translated}>{sentence.translation_es}</p>
  </section>;
}
