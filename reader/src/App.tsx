import { useCallback, useEffect, useRef, useState } from 'react';
import { contentService, type ContentService } from './lib/content';
import { localProgressStore, type ProgressStore } from './lib/progress';
import type { Manifest, Story, StoryProgress } from './lib/types';
import { StoryLibrary } from './components/StoryLibrary';
import { ReaderPage } from './components/ReaderPage';
import type { DictionaryService } from './lib/dictionaryModel';

type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };
const getStoryId = () => window.location.hash.match(/^#\/story\/([a-z0-9_]+)$/)?.[1] ?? null;
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo cargar la lectura. Inténtalo de nuevo.';

function LoadMessage({ error, onRetry, onBack }: { error?: string; onRetry?: () => void; onBack?: () => void }) {
  return <main className="load-message" id="main-content" tabIndex={-1} aria-live="polite">
    <span className="load-mark" lang="ja" aria-hidden="true">読</span>
    <h1>{error ? 'No pudimos abrir esta página.' : 'Preparando tu lectura…'}</h1>
    {error && <p role="alert">{error}</p>}
    {onRetry && <button type="button" className="primary-button" onClick={onRetry}>Intentar de nuevo</button>}
    {onBack && <button type="button" className="text-button" onClick={onBack}>Volver a la biblioteca</button>}
  </main>;
}

export default function App({ content = contentService, store = localProgressStore, dictionary }: {
  content?: ContentService; store?: ProgressStore; dictionary?: DictionaryService;
}) {
  const [initial] = useState(() => store.load());
  const [progress, setProgress] = useState(initial.progress);
  const progressRef = useRef(progress);
  const [notice, setNotice] = useState(initial.notice);
  const [storyId, setStoryId] = useState(getStoryId);
  const [library, setLibrary] = useState<LoadState<Manifest>>({ status: 'loading' });
  const [story, setStory] = useState<LoadState<Story>>({ status: 'loading' });
  const [retry, setRetry] = useState(0);

  const updateProgress = useCallback((id: string, patch: Partial<StoryProgress>) => {
    const previous = Object.hasOwn(progressRef.current, id) ? progressRef.current[id] : undefined;
    const next = { ...progressRef.current, [id]: {
      ...(previous ?? { last_opened: new Date().toISOString(), completed: false }), ...patch, story_id: id,
    } };
    progressRef.current = next;
    setProgress(next);
    const warning = store.save(next);
    if (warning) setNotice(warning);
  }, [store]);

  useEffect(() => {
    const handler = () => setStoryId(getStoryId());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLibrary({ status: 'loading' });
    content.loadManifest(controller.signal).then((data) => {
      if (!controller.signal.aborted) setLibrary({ status: 'ready', data });
    }).catch((error) => { if (!controller.signal.aborted) setLibrary({ status: 'error', message: message(error) }); });
    return () => controller.abort();
  }, [content, retry]);
  useEffect(() => {
    if (!storyId || library.status !== 'ready') return;
    const listing = library.data.stories.find((item) => item.id === storyId);
    if (!listing) { setStory({ status: 'error', message: 'Esta lectura no está disponible en la biblioteca.' }); return; }
    const controller = new AbortController();
    setStory({ status: 'loading' });
    content.loadStory(listing, controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        updateProgress(data.id, { last_opened: new Date().toISOString() });
        setStory({ status: 'ready', data });
      }
    }).catch((error) => { if (!controller.signal.aborted) setStory({ status: 'error', message: message(error) }); });
    return () => controller.abort();
  }, [storyId, library, content, updateProgress]);

  function goLibrary() { window.location.hash = ''; }
  const retryLoad = () => setRetry((count) => count + 1);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); document.getElementById('main-content')?.focus();
    }}>Saltar al contenido</a>
    <header className="app-header"><button type="button" className="brand" onClick={goLibrary} aria-label="YomuStory, biblioteca">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h8c2 0 3 1 3 3v18c0-2-1-3-3-3H5zM27 6h-8c-2 0-3 1-3 3v18c0-2 1-3 3-3h8z" /></svg>
      <span>Yomu<span>Story</span></span></button><span className="header-note">Tu japonés, a tu ritmo.</span></header>
    {notice && <p className="storage-notice" role="status">{notice}</p>}
    {library.status === 'loading' ? <LoadMessage />
      : library.status === 'error' ? <LoadMessage error={library.message} onRetry={retryLoad} />
      : !storyId ? <StoryLibrary stories={library.data.stories} progress={progress} onOpen={(id) => { window.location.hash = `/story/${id}`; }} />
      : story.status === 'error' ? <LoadMessage error={story.message} onRetry={retryLoad} onBack={goLibrary} />
      : story.status !== 'ready' || story.data.id !== storyId ? <LoadMessage />
      : <ReaderPage key={story.data.id} story={story.data} progress={progress[storyId]} onBack={goLibrary} dictionary={dictionary}
          onPosition={(id) => updateProgress(storyId, { last_sentence: id })}
          onComplete={() => updateProgress(storyId, { completed: true, last_sentence: story.data.content.paragraphs.at(-1)!.sentences.at(-1)!.id })} />}
  </div>;
}
