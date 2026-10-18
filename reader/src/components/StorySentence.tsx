import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import type { Sentence, Token } from '../lib/types';
import { JapaneseText } from './JapaneseText';
import type { VocabularyStatus } from '../lib/vocabulary';
import type { FuriganaMode } from '../lib/furigana';

export function StorySentence({ sentence, number, active, furigana, onToken, onSelect, vocabularyStatuses, selectedToken, translated: controlledTranslation, onTranslation }: {
  sentence: Sentence; number: number; active: boolean; furigana: FuriganaMode;
  onToken: (token: Token) => void; onSelect: () => void;
  vocabularyStatuses?: Map<string, VocabularyStatus>;
  selectedToken?: Token;
  translated?: boolean; onTranslation?: () => void;
}) {
  const { t, language } = useI18n();
  const [sessionTranslation, setTranslated] = useState(false);
  const translated = controlledTranslation ?? sessionTranslation;
  const translationId = `translation-${sentence.id}`;
  return <section id={`sentence-${sentence.id}`} className={`sentence${active ? ' sentence-active' : ''}`}
    tabIndex={0} aria-label={t(`Frase ${number}`)} aria-describedby="reader-help"
    onClick={(event) => {
      if ((event.target as Element).closest('button, a, summary, details, input, select, textarea')) return;
      if (window.getSelection()?.isCollapsed === false) return;
      onSelect();
    }}
    onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); onSelect();
      }
    }}>
    <JapaneseText sentence={sentence} furigana={furigana} onToken={onToken} selectedToken={selectedToken} vocabularyStatuses={vocabularyStatuses} />
    <div className="sentence-tools">
      <button type="button" className="text-button" aria-expanded={translated}
        aria-controls={translationId} aria-label={t(`${translated ? 'Ocultar' : 'Mostrar'} traducción de la frase ${number}`)}
        onClick={() => { if (onTranslation) onTranslation(); else setTranslated(!translated); onSelect(); }}>
        {translated ? t('Ocultar traducción') : t('Traducción')} <span aria-hidden="true">{translated ? '−' : '+'}</span>
      </button>
      {sentence.grammar_points?.length ? <details className="grammar-info">
        <summary>{t("Gramática ")}<span aria-hidden="true">{sentence.grammar_points.length}</span></summary>
        <div className="grammar-list">{sentence.grammar_points.map((point, index) => <div key={index}>
          <strong lang="ja">{point.pattern}</strong>
          {point.level && <span className="badge">{point.level}</span>}
          {point.target && <span className="small-label">{t("Objetivo")}</span>}
          {point.meaning_es && <p>{t(point.meaning_es)}</p>}
        </div>)}</div>
      </details> : null}
    </div>
    <p id={translationId} className="translation" lang={language} hidden={!translated}>{t(sentence.translation_es ?? '')}</p>
  </section>;
}
