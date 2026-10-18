import { useI18n, translate } from '../lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import type { ProgressMap, StoryListing } from '../lib/types';
import { loadLibraryView, saveLibraryView } from '../lib/libraryView';

const searchKey = (text: string) => text.normalize('NFKC').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const categoryLabels: Record<string, [string, string]> = {
  cooking: ['料理', 'Cocina'], daily: ['日', 'Vida cotidiana'], work: ['働', 'Trabajo'],
  travel: ['旅', 'Viajes'], japan: ['街', 'Vida en Japón'], relationships: ['縁', 'Relaciones'],
};
const topicSearch: Record<string, string> = { '料理': 'cocina cocinar', '友達': 'amigos amistad', '仕事': 'trabajo', '旅行': 'viajes viajar', '日常生活': 'vida cotidiana', '日本生活': 'vida en japón', 'バイク': 'moto motocicleta', '自然': 'naturaleza', '買い物': 'compras', '留学': 'estudios extranjero', '準備': 'preparación', '人間関係': 'relaciones', 'オーストラリア': 'australia' };
export function StoryLibrary({ stories, progress, onOpen }: {
  stories: StoryListing[]; progress: ProgressMap; onOpen: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const [initialView] = useState(loadLibraryView);
  const [topic, setTopic] = useState(initialView.topic);
  const [query, setQuery] = useState(initialView.query);
  const [status, setStatus] = useState(initialView.status);
  const [duration, setDuration] = useState(initialView.duration);
  const [order, setOrder] = useState(initialView.order);
  useEffect(() => { saveLibraryView({ topic, query, status, duration, order }); }, [topic, query, status, duration, order]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  const topics = [...new Set(stories.flatMap((story) => story.topics))].sort();
  const completed = stories.filter((story) => progress[story.id]?.completed).length;
  const resume = stories.filter((story) => progress[story.id]?.last_opened && !progress[story.id].completed)
    .sort((a, b) => (Date.parse(progress[b.id].last_opened) || 0) - (Date.parse(progress[a.id].last_opened) || 0))[0];
  const searchIndex = useMemo(() => new Map(stories.map((story) => [story.id, searchKey([
    story.title, story.title_es, translate(story.title_es, 'en'), ...story.topics,
    ...story.topics.map((label) => translate(label, 'en')), story.level,
    ...story.topics.map((label) => topicSearch[label] ?? ''),
    categoryLabels[story.id.split('_')[0]]?.[1] ?? '',
  ].join(' '))])), [stories]);
  const visible = stories.filter((story) => {
    const entry = progress[story.id];
    return (!topic || story.topics.includes(topic)) && (!query.trim() || searchKey(query).trim().split(/\s+/).every((word) => searchIndex.get(story.id)!.includes(word)))
      && (status === 'all' || (status === 'unread' ? !entry : status === 'reading' ? Boolean(entry && !entry.completed) : entry?.completed))
      && (duration === 'all' || (duration === 'short' ? story.estimated_minutes <= 5 : duration === 'medium' ? story.estimated_minutes > 5 && story.estimated_minutes <= 10 : story.estimated_minutes > 10));
  }).sort((a, b) => order === 'shortest' ? a.estimated_minutes - b.estimated_minutes : order === 'title' ? t(a.title_es).localeCompare(t(b.title_es), language) : 0);
  const filtered = Boolean(topic || query || status !== 'all' || duration !== 'all');
  function reset() { setTopic(''); setQuery(''); setStatus('all'); setDuration('all'); setOrder('catalog'); }
  return <main className="library" id="main-content" tabIndex={-1}>
    <header className="library-intro">
      <div><p className="eyebrow">{t('Japonés, una historia a la vez')}</p>
        <h1>{t('Un momento para leer.')}</h1>
        <p className="intro-description">{t('Historias breves para descubrir palabras nuevas')}<br className="desktop-break" />{t(' y encontrar tu propio ritmo.')}</p></div>
    </header>
    {resume && <section className="resume-reading" aria-label={t('Tu lectura en curso')}>
      <svg className="resume-book" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h8c2 0 3 1 3 3v18c0-2-1-3-3-3H5zM27 6h-8c-2 0-3 1-3 3v18c0-2 1-3 3-3h8z" /></svg>
      <div><p className="eyebrow">{t('Sigue donde lo dejaste')}</p><h2>{t(resume.title_es)}</h2>
        <p><span lang="ja">{resume.title}</span><span> · {resume.level} · {resume.estimated_minutes} min</span></p></div>
      <button className="primary-button" type="button" onClick={() => onOpen(resume.id)}>{t('Retomar lectura')} <span aria-hidden="true">→</span></button>
    </section>}
    <section aria-labelledby="library-title">
      <div className="library-heading">
        <div><h2 id="library-title">{t('Tu biblioteca')}</h2><p>{stories.length} {stories.length === 1 ? t('lectura') : t('lecturas')} · {completed} {completed === 1 ? t('completada') : t('completadas')}</p></div>
        <div className="library-shortcuts"><button type="button" aria-pressed={duration === 'short'} onClick={() => setDuration(duration === 'short' ? 'all' : 'short')}>{t('Tengo 5 minutos')}</button>
          <button type="button" aria-pressed={duration === 'long'} onClick={() => setDuration(duration === 'long' ? 'all' : 'long')}>{t('Lecturas largas')}</button></div>
      </div>
      <div className="library-filters" role="search" aria-label={t('Buscar lecturas')}>
        <label className="library-search"><span>{t('Buscar lecturas')}</span><input type="search" maxLength={512} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Título, tema o palabra…')} /></label>
        <label><span>{t('Tema')}</span><select value={topic} onChange={(event) => setTopic(event.target.value)}>
          <option value="">{t('Todos los temas')}</option>{topics.map((item) => <option key={item} value={item} lang={language === 'en' ? 'en' : 'ja'}>{t(item)}</option>)}
        </select></label>
        <label><span>{t('Estado')}</span><select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">{t('Todas las lecturas')}</option><option value="unread">{t('Por descubrir')}</option><option value="reading">{t('En lectura')}</option><option value="completed">{t('Completadas')}</option>
        </select></label>
        <label><span>{t('Duración')}</span><select value={duration} onChange={(event) => setDuration(event.target.value)}>
          <option value="all">{t('Cualquier duración')}</option><option value="short">{t('Hasta 5 min')}</option><option value="medium">6–10 min</option><option value="long">{t('Más de 10 min')}</option>
        </select></label>
        <label><span>{t('Ordenar')}</span><select value={order} onChange={(event) => setOrder(event.target.value)}>
          <option value="catalog">{t('Orden de la biblioteca')}</option><option value="shortest">{t('Más breves primero')}</option><option value="title">{t('Por título')}</option>
        </select></label>
      </div>
      <div className="library-results"><p role="status">{t(`${visible.length} ${visible.length === 1 ? 'lectura disponible' : 'lecturas disponibles'}`)}</p>{filtered && <button type="button" className="text-button" onClick={reset}>{t('Limpiar filtros')}</button>}</div>
      {stories.length === 0 ? <div className="empty-state"><h3>{t('Tu próxima historia está por llegar.')}</h3><p>{t('No hay lecturas en esta biblioteca todavía.')}</p></div>
        : visible.length === 0 ? <div className="empty-state"><h3>{t('No encontramos esa lectura.')}</h3><p>{t('Prueba otro título o quita algún filtro.')}</p><button className="primary-button" type="button" onClick={reset}>{t('Ver todas las lecturas')}</button></div>
        : <div className="story-grid">{visible.map((story) => {
          const entry = progress[story.id]; const category = story.id.split('_')[0]; const cover = categoryLabels[category] ?? ['読', 'Historias'];
          return <article key={story.id} className={`story-card category-${category}${entry?.completed ? ' story-completed' : ''}`}>
            <div className="card-top"><span className="story-category"><i aria-hidden="true" />{t(cover[1])}</span>
              <span className="reading-status">{entry?.completed ? t('✓ Completada') : entry ? t('En lectura') : t('Por descubrir')}</span></div>
            <div className="card-titles"><h3 lang="ja">{story.title}</h3><p>{t(story.title_es)}</p></div>
            <div className="story-topics" lang={language === 'en' ? 'en' : 'ja'}>{story.topics.map(t).join(' · ')}</div>
            <div className="card-meta"><span className="badge">{story.level}</span><span>{story.estimated_minutes} min</span>
              <span className="difficulty" aria-label={t(`Dificultad ${story.difficulty} de 5`)}>{Array.from({ length: 5 }, (_, dot) => <i key={dot} className={dot < story.difficulty ? 'filled' : ''} />)}</span></div>
            <button type="button" className="card-open" aria-label={t(`${entry?.completed ? t('Volver a leer') : entry ? t('Continuar') : t('Leer')}: ${t(story.title_es)}`)}
              onClick={() => onOpen(story.id)}><span>{entry?.completed ? t('Volver a leer') : entry ? t('Continuar lectura') : t('Empezar a leer')}</span><span aria-hidden="true">↗</span></button>
          </article>;
        })}</div>}
    </section>
    <p className="library-footer"><span lang="ja">少しずつ。</span>{t(' Poco a poco también se llega lejos.')}</p>
  </main>;
}
