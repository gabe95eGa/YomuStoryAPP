import { useI18n } from '../lib/i18n';
import { useEffect, useState } from 'react';
import type { ProgressMap, StoryListing } from '../lib/types';

export function StoryLibrary({ stories, progress, onOpen }: {
  stories: StoryListing[]; progress: ProgressMap; onOpen: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const [topic, setTopic] = useState('');
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  const topics = [...new Set(stories.flatMap((story) => story.topics))].sort();
  const completed = stories.filter((story) => progress[story.id]?.completed).length;
  const visible = topic ? stories.filter((story) => story.topics.includes(topic)) : stories;
  return <main className="library" id="main-content" tabIndex={-1}>
    <header className="library-intro">
      <div><p className="eyebrow">{t("Japonés, una historia a la vez")}</p>
        <h1>{t("Un momento para leer.")}</h1>
        <p className="intro-description">{t("Historias breves para descubrir palabras nuevas")}<br className="desktop-break" />{t(" y encontrar tu propio ritmo.")}</p></div>
      <div className="library-mark" aria-hidden="true"><span lang="ja">読む</span><span>YOMUSTORY</span></div>
    </header>
    <section aria-labelledby="library-title">
      <div className="library-heading">
        <div><h2 id="library-title">{t("Tu biblioteca")}</h2><p>{stories.length} {stories.length === 1 ? t('lectura') : t('lecturas')} · {completed} {completed === 1 ? t('completada') : t('completadas')}</p></div>
        {topics.length > 0 && <label className="topic-filter">{t('Tema')}
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">{t("Todos los temas")}</option>{topics.map((item) => <option key={item} value={item} lang={language === 'en' ? 'en' : 'ja'}>{t(item)}</option>)}
          </select></label>}
      </div>
      {stories.length === 0 ? <div className="empty-state"><h3>{t("Tu próxima historia está por llegar.")}</h3><p>{t("No hay lecturas en esta biblioteca todavía.")}</p></div>
        : <div className="story-grid">{visible.map((story, index) => {
          const entry = progress[story.id];
          return <article key={story.id} className={`story-card${entry?.completed ? ' story-completed' : ''}`}>
            <div className="card-top"><span className="story-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="reading-status">{entry?.completed ? t('✓ Completada') : entry?.last_sentence ? t('En lectura') : t('Por descubrir')}</span></div>
            <div className="card-titles"><h3 lang="ja">{story.title}</h3><p>{t(story.title_es)}</p></div>
            <div className="story-topics" lang={language === 'en' ? 'en' : 'ja'}>{story.topics.map(t).join(' · ')}</div>
            <div className="card-meta"><span className="badge">{story.level}</span><span>{story.estimated_minutes} min</span>
              <span className="difficulty" aria-label={t(`Dificultad ${story.difficulty} de 5`)}>
                {Array.from({ length: 5 }, (_, dot) => <i key={dot} className={dot < story.difficulty ? 'filled' : ''} />)}</span></div>
            <button type="button" className="card-open" aria-label={t(`${entry?.completed ? t('Volver a leer') : entry?.last_sentence ? t('Continuar') : t('Leer')}: ${t(story.title_es)}`)}
              onClick={() => onOpen(story.id)}><span>{entry?.completed ? t('Volver a leer') : entry?.last_sentence ? t('Continuar lectura') : t('Empezar a leer')}</span><span aria-hidden="true">↗</span></button>
          </article>;
        })}</div>}
    </section>
    <p className="library-footer"><span lang="ja">少しずつ。</span>{t(" Poco a poco también se llega lejos.")}</p>
  </main>;
}
