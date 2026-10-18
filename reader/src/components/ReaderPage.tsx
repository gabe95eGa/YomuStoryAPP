import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import type { Story, StoryProgress, Token } from '../lib/types';
import { StorySentence } from './StorySentence';
import { VocabularySheet } from './VocabularySheet';
import type { DictionaryService } from '../lib/dictionaryModel';
import type { ReaderPreferences } from '../lib/preferences';
import { useTokenStatuses } from './LearnerState';
import type { FuriganaMode } from '../lib/furigana';
import { loadAppearance, saveAppearance, type ReadingAppearance } from '../lib/appearance';
import { ComprehensionQuiz } from './ComprehensionQuiz';

export function ReaderPage({ story, progress, onBack, onPosition, onComplete, dictionary, preferences, onPreferences }: {
  story: Story; progress?: StoryProgress; onBack: () => void;
  onPosition: (id: string) => void; onComplete: () => void;
  dictionary?: DictionaryService;
  preferences?: ReaderPreferences; onPreferences?: (patch: Partial<ReaderPreferences>) => void;
}) {
  const { t, language } = useI18n();
  const allSentences = story.content.paragraphs.flatMap((paragraph) => paragraph.sentences);
  const [current, setCurrent] = useState(() => progress?.completed ? 0
    : Math.max(0, allSentences.findIndex((sentence) => sentence.id === progress?.last_sentence)));
  const [sessionFurigana, setFurigana] = useState<FuriganaMode>('adaptive');
  const [sessionLargeText, setLargeText] = useState(false);
  const furigana = preferences?.furigana ?? sessionFurigana;
  const largeText = preferences ? preferences.textSize === 'large' : sessionLargeText;
  const vocabularyStatuses = useTokenStatuses(story, dictionary);
  const [selected, setSelected] = useState<Token | null>(null);
  const [translations, setTranslations] = useState<Set<string>>(() => new Set());
  function toggleTranslation(id: string) {
    setTranslations((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const [appearance, setAppearance] = useState(loadAppearance);
  const [appearanceNotice, setAppearanceNotice] = useState(false);
  function changeAppearance(patch: Partial<ReadingAppearance>) {
    const next = { ...appearance, ...patch }; setAppearance(next); setAppearanceNotice(!saveAppearance(next));
  }
  useEffect(() => {
    if (!selected) return;
    let frame = 0;
    const adjust = () => {
      const sentence = document.getElementById(`sentence-${allSentences[current].id}`);
      const panel = document.querySelector('.quick-lookup');
      if (!sentence || !panel) return;
      const bounds = sentence.getBoundingClientRect();
      const limit = window.innerWidth < 1100 ? panel.getBoundingClientRect().top - 18 : window.innerHeight - 100;
      const top = (document.querySelector('.reader-toolbar')?.getBoundingClientRect().bottom ?? 80) + 14;
      const offset = bounds.height > limit - top ? bounds.top - top : bounds.bottom > limit ? bounds.bottom - limit : bounds.top < top ? bounds.top - top : 0;
      if (Math.abs(offset) > 2) window.scrollBy({ top: offset, behavior: 'smooth' });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(adjust); };
    schedule(); window.addEventListener('resize', schedule);
    const panel = document.querySelector('.quick-lookup');
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : undefined;
    if (panel) observer?.observe(panel);
    const activeSentence = document.getElementById(`sentence-${allSentences[current].id}`);
    if (activeSentence) observer?.observe(activeSentence);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); observer?.disconnect(); };
  }, [selected, current]);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    if (current > 0) document.getElementById(`sentence-${allSentences[current].id}`)?.scrollIntoView({ block: 'center' });
    // Resume only when this story's keyed component mounts, not on each progress save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function selectSentence(index: number, focus = false) {
    setSelected(null);
    setCurrent(index);
    onPosition(allSentences[index].id);
    if (focus) {
      const element = document.getElementById(`sentence-${allSentences[index].id}`);
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      element?.focus({ preventScroll: true });
    }
  }
  let index = 0;
  return <main className={`reader-page${selected ? ' has-quick' : ''}`} data-paper={appearance.paper} data-spacing={appearance.spacing} id="main-content" tabIndex={-1}>
    <nav className="reader-toolbar" aria-label={t("Controles de lectura")}>
      <button type="button" className="back-button" onClick={onBack}><span aria-hidden="true">←</span>{t(" Biblioteca")}</button>
      <div className="reader-options">
        <label className="furigana-control">Furigana
          <select value={furigana} onChange={(event) => {
            const mode = event.target.value as FuriganaMode;
            if (onPreferences) onPreferences({ furigana: mode }); else setFurigana(mode);
          }}><option value="all">{t("Todas")}</option><option value="adaptive">{t("Adaptativa")}</option><option value="none">{t("Ninguna")}</option></select>
        </label>
        <button type="button" className="size-button" aria-label={t("Texto grande")} aria-pressed={largeText} onClick={() => onPreferences ? onPreferences({ textSize: largeText ? 'normal' : 'large' }) : setLargeText(!largeText)}>A<span>A</span></button>
        <details className="reader-settings"><summary>{t('Lectura')} <span aria-hidden="true">☷</span></summary>
          <div className="reader-settings-panel">
            <h2>{t('A tu manera')}</h2>
            <label><input type="checkbox" checked={appearance.continuous} onChange={(event) => changeAppearance({ continuous: event.target.checked })} />{t('Párrafos continuos')}</label>
            <label>{t('Espaciado')}<select value={appearance.spacing} onChange={(event) => changeAppearance({ spacing: event.target.value as ReadingAppearance['spacing'] })}><option value="comfortable">{t('Amplio')}</option><option value="compact">{t('Compacto')}</option></select></label>
            <label>{t('Color del papel')}<select value={appearance.paper} onChange={(event) => changeAppearance({ paper: event.target.value as ReadingAppearance['paper'] })}><option value="light">{t('Claro')}</option><option value="sepia">{t('Sepia')}</option><option value="night">{t('Noche')}</option></select></label>
            {appearanceNotice && <p role="status">{t('El aspecto se ha cambiado solo para esta sesión.')}</p>}
          </div>
        </details>
      </div>
    </nav>
    <header className="reader-header"><p className="eyebrow">{t("Una lectura de YomuStory")}</p>
      <h1 lang="ja" tabIndex={-1} ref={title}>{story.metadata.title}</h1><p className="reader-subtitle">{t(story.metadata.title_es)}</p>
      <div className="reader-meta"><span className="badge">{story.metadata.level}</span><span>{story.metadata.estimated_minutes}{t(" min de lectura")}</span>
        <span lang={language === 'en' ? 'en' : 'ja'}>{story.metadata.topics.map(t).join(' · ')}</span></div>
    </header>
    <div className="reader-layout">
      <aside className="reading-aside"><p className="eyebrow">{t("A tu ritmo")}</p><p>{t("Lee primero.")}<br />{t("La ayuda está a un toque.")}</p>
        <div className="target-key">{t("Fondo suave: objetivo del relato.")}<br />{t("Subrayado de puntos: aprendiendo.")}<br />{t("Subrayado continuo: conocida.")}</div></aside>
      <article className={`reading-surface${largeText ? ' large-text' : ''}${appearance.continuous ? ' continuous-reading' : ''}`} aria-label={t("Texto de la historia")}>
        <details className="reader-instructions"><summary>{t('Cómo usar el lector')}</summary><p className="reader-help" id="reader-help">{t("Puedes tocar cualquier palabra para consultarla y guardarla, tenga marcas o no. Las marcas de estado se repiten en todas sus coincidencias identificadas. Pulsa el espacio vacío de una frase para seleccionarla; con el teclado, enfócala y pulsa Intro o Espacio.")}</p></details>
        {story.content.paragraphs.map((paragraph, paragraphIndex) => <div className="story-paragraph" key={paragraph.id}>
          <div className="paragraph-label">{String(paragraphIndex + 1).padStart(2, '0')}</div>
          {paragraph.sentences.map((sentence) => {
            const sentenceIndex = index++;
            return <StorySentence key={sentence.id} sentence={sentence} number={sentenceIndex + 1} active={sentenceIndex === current}
              translated={translations.has(sentence.id)} onTranslation={() => toggleTranslation(sentence.id)}
              furigana={furigana} selectedToken={selected ?? undefined} vocabularyStatuses={vocabularyStatuses} onSelect={() => selectSentence(sentenceIndex)}
              onToken={(token) => { selectSentence(sentenceIndex); setSelected(token); }} />;
          })}
        </div>)}
        {story.comprehension && <ComprehensionQuiz questions={story.comprehension.questions} />}
        <section className="reading-end" aria-labelledby="end-title"><span className="end-mark" aria-hidden="true">終</span>
          <h2 id="end-title">{progress?.completed ? t('Una historia más, un paso más.') : t('Has llegado al final.')}</h2>
          <p>{progress?.completed ? t('Esta lectura está marcada como completada.') : t('Tómate un momento. ¿Qué te ha quedado de esta historia?')}</p>
          {progress?.completed ? <button type="button" className="primary-button" onClick={onBack}>{t("Volver a la biblioteca ")}<span aria-hidden="true">→</span></button>
            : <button type="button" className="primary-button" onClick={onComplete}>{t("Completar lectura ")}<span aria-hidden="true">✓</span></button>}
        </section>
      </article>
    </div>
    <nav className="position-bar" aria-label={t("Navegar por las frases")}>
      <button type="button" className="icon-button" aria-label={t("Frase anterior")} disabled={current === 0} onClick={() => selectSentence(current - 1, true)}>←</button>
      <div className="position-info"><span aria-live="polite">{t("Frase ")}{current + 1}{t(' de ')}{allSentences.length}{progress?.completed ? t(' · Completada') : ''}</span>
        <progress aria-label={t("Posición en la lectura")} max={allSentences.length} value={current + 1} /></div>
      <button type="button" className="position-translation" aria-label={t('Traducción de la frase actual')}
        aria-expanded={translations.has(allSentences[current].id)} aria-controls={`translation-${allSentences[current].id}`}
        onClick={() => { toggleTranslation(allSentences[current].id); document.getElementById(`sentence-${allSentences[current].id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>{t('Traducción')}</button>
      <button type="button" className="icon-button" aria-label={t("Frase siguiente")} disabled={current === allSentences.length - 1} onClick={() => selectSentence(current + 1, true)}>→</button>
    </nav>
    {selected && <VocabularySheet key={`${current}:${selected.start}:${selected.surface}`} quick token={selected} dictionary={dictionary} onClose={() => setSelected(null)} />}
  </main>;
}
