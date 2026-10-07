import { useEffect, useRef, useState } from 'react';
import type { Story, StoryProgress, Token } from '../lib/types';
import { StorySentence } from './StorySentence';
import { VocabularySheet } from './VocabularySheet';
import type { DictionaryService } from '../lib/dictionaryModel';
import type { ReaderPreferences } from '../lib/preferences';
import { useTokenStatuses } from './LearnerState';
import type { FuriganaMode } from '../lib/furigana';

export function ReaderPage({ story, progress, onBack, onPosition, onComplete, dictionary, preferences, onPreferences }: {
  story: Story; progress?: StoryProgress; onBack: () => void;
  onPosition: (id: string) => void; onComplete: () => void;
  dictionary?: DictionaryService;
  preferences?: ReaderPreferences; onPreferences?: (patch: Partial<ReaderPreferences>) => void;
}) {
  const allSentences = story.content.paragraphs.flatMap((paragraph) => paragraph.sentences);
  const [current, setCurrent] = useState(() => progress?.completed ? 0
    : Math.max(0, allSentences.findIndex((sentence) => sentence.id === progress?.last_sentence)));
  const [sessionFurigana, setFurigana] = useState<FuriganaMode>('adaptive');
  const [sessionLargeText, setLargeText] = useState(false);
  const furigana = preferences?.furigana ?? sessionFurigana;
  const largeText = preferences ? preferences.textSize === 'large' : sessionLargeText;
  const vocabularyStatuses = useTokenStatuses(story, dictionary);
  const [selected, setSelected] = useState<Token | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    if (current > 0) document.getElementById(`sentence-${allSentences[current].id}`)?.scrollIntoView({ block: 'center' });
    // Resume only when this story's keyed component mounts, not on each progress save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function selectSentence(index: number, focus = false) {
    setCurrent(index);
    onPosition(allSentences[index].id);
    if (focus) {
      const element = document.getElementById(`sentence-${allSentences[index].id}`);
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      element?.focus({ preventScroll: true });
    }
  }
  let index = 0;
  return <main className="reader-page" id="main-content" tabIndex={-1}>
    <nav className="reader-toolbar" aria-label="Controles de lectura">
      <button type="button" className="back-button" onClick={onBack}><span aria-hidden="true">←</span> Biblioteca</button>
      <div className="reader-options">
        <label className="furigana-control">Furigana
          <select value={furigana} onChange={(event) => {
            const mode = event.target.value as FuriganaMode;
            if (onPreferences) onPreferences({ furigana: mode }); else setFurigana(mode);
          }}><option value="all">Todas</option><option value="adaptive">Adaptativa</option><option value="none">Ninguna</option></select>
        </label>
        <button type="button" className="size-button" aria-label="Texto grande" aria-pressed={largeText} onClick={() => onPreferences ? onPreferences({ textSize: largeText ? 'normal' : 'large' }) : setLargeText(!largeText)}>A<span>A</span></button>
      </div>
    </nav>
    <header className="reader-header"><p className="eyebrow">Una lectura de YomuStory</p>
      <h1 lang="ja" tabIndex={-1} ref={title}>{story.metadata.title}</h1><p className="reader-subtitle">{story.metadata.title_es}</p>
      <div className="reader-meta"><span className="badge">{story.metadata.level}</span><span>{story.metadata.estimated_minutes} min de lectura</span>
        <span lang="ja">{story.metadata.topics.join(' · ')}</span></div>
    </header>
    <div className="reader-layout">
      <aside className="reading-aside"><p className="eyebrow">A tu ritmo</p><p>Lee primero.<br />La ayuda está a un toque.</p>
        <div className="target-key"><span aria-hidden="true">·</span> Vocabulario objetivo</div></aside>
      <article className={`reading-surface${largeText ? ' large-text' : ''}`} aria-label="Texto de la historia">
        {story.content.paragraphs.map((paragraph, paragraphIndex) => <div className="story-paragraph" key={paragraph.id}>
          <div className="paragraph-label">{String(paragraphIndex + 1).padStart(2, '0')}</div>
          {paragraph.sentences.map((sentence) => {
            const sentenceIndex = index++;
            return <StorySentence key={sentence.id} sentence={sentence} number={sentenceIndex + 1} active={sentenceIndex === current}
              furigana={furigana} vocabularyStatuses={vocabularyStatuses} onSelect={() => selectSentence(sentenceIndex)}
              onToken={(token) => { selectSentence(sentenceIndex); setSelected(token); }} />;
          })}
        </div>)}
        <section className="reading-end" aria-labelledby="end-title"><span className="end-mark" aria-hidden="true">終</span>
          <h2 id="end-title">{progress?.completed ? 'Una historia más, un paso más.' : 'Has llegado al final.'}</h2>
          <p>{progress?.completed ? 'Esta lectura está marcada como completada.' : 'Tómate un momento. ¿Qué te ha quedado de esta historia?'}</p>
          {progress?.completed ? <button type="button" className="primary-button" onClick={onBack}>Volver a la biblioteca <span aria-hidden="true">→</span></button>
            : <button type="button" className="primary-button" onClick={onComplete}>Completar lectura <span aria-hidden="true">✓</span></button>}
        </section>
      </article>
    </div>
    <nav className="position-bar" aria-label="Navegar por las frases">
      <button type="button" className="icon-button" aria-label="Frase anterior" disabled={current === 0} onClick={() => selectSentence(current - 1, true)}>←</button>
      <div className="position-info"><span aria-live="polite">Frase {current + 1} de {allSentences.length}{progress?.completed ? ' · Completada' : ''}</span>
        <progress aria-label="Posición en la lectura" max={allSentences.length} value={current + 1} /></div>
      <button type="button" className="icon-button" aria-label="Frase siguiente" disabled={current === allSentences.length - 1} onClick={() => selectSentence(current + 1, true)}>→</button>
    </nav>
    {selected && <VocabularySheet token={selected} dictionary={dictionary} onClose={() => setSelected(null)} />}
  </main>;
}
