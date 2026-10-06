import { useEffect, useState } from 'react';
import type { ProgressMap, StoryListing } from '../lib/types';

export function StoryLibrary({ stories, progress, onOpen }: {
  stories: StoryListing[]; progress: ProgressMap; onOpen: (id: string) => void;
}) {
  const [topic, setTopic] = useState('');
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  const topics = [...new Set(stories.flatMap((story) => story.topics))].sort();
  const completed = stories.filter((story) => progress[story.id]?.completed).length;
  const visible = topic ? stories.filter((story) => story.topics.includes(topic)) : stories;
  return <main className="library" id="main-content" tabIndex={-1}>
    <header className="library-intro">
      <div><p className="eyebrow">Japonés, una historia a la vez</p>
        <h1>Un momento para leer.</h1>
        <p className="intro-description">Historias breves para descubrir palabras nuevas<br className="desktop-break" /> y encontrar tu propio ritmo.</p></div>
      <div className="library-mark" aria-hidden="true"><span lang="ja">読む</span><span>YOMUSTORY</span></div>
    </header>
    <section aria-labelledby="library-title">
      <div className="library-heading">
        <div><h2 id="library-title">Tu biblioteca</h2><p>{stories.length} {stories.length === 1 ? 'lectura' : 'lecturas'} · {completed} {completed === 1 ? 'completada' : 'completadas'}</p></div>
        {topics.length > 0 && <label className="topic-filter">Tema
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">Todos los temas</option>{topics.map((item) => <option key={item} value={item} lang="ja">{item}</option>)}
          </select></label>}
      </div>
      {stories.length === 0 ? <div className="empty-state"><h3>Tu próxima historia está por llegar.</h3><p>No hay lecturas en esta biblioteca todavía.</p></div>
        : <div className="story-grid">{visible.map((story, index) => {
          const entry = progress[story.id];
          return <article key={story.id} className={`story-card${entry?.completed ? ' story-completed' : ''}`}>
            <div className="card-top"><span className="story-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="reading-status">{entry?.completed ? '✓ Completada' : entry?.last_sentence ? 'En lectura' : 'Por descubrir'}</span></div>
            <div className="card-titles"><h3 lang="ja">{story.title}</h3><p>{story.title_es}</p></div>
            <div className="story-topics" lang="ja">{story.topics.join(' · ')}</div>
            <div className="card-meta"><span className="badge">{story.level}</span><span>{story.estimated_minutes} min</span>
              <span className="difficulty" aria-label={`Dificultad ${story.difficulty} de 5`}>
                {Array.from({ length: 5 }, (_, dot) => <i key={dot} className={dot < story.difficulty ? 'filled' : ''} />)}</span></div>
            <button type="button" className="card-open" aria-label={`${entry?.completed ? 'Volver a leer' : entry?.last_sentence ? 'Continuar' : 'Leer'}: ${story.title_es}`}
              onClick={() => onOpen(story.id)}><span>{entry?.completed ? 'Volver a leer' : entry?.last_sentence ? 'Continuar lectura' : 'Empezar a leer'}</span><span aria-hidden="true">↗</span></button>
          </article>;
        })}</div>}
    </section>
    <p className="library-footer"><span lang="ja">少しずつ。</span> Poco a poco también se llega lejos.</p>
  </main>;
}
