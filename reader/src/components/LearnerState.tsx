import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dictionaryService } from '../lib/dictionary';
import { type DictionaryService } from '../lib/dictionaryModel';
import type { Story } from '../lib/types';
import { type LearnerVocabularyItem,
  type VocabularyIdentity, type VocabularyStateService, type VocabularyStatus } from '../lib/vocabulary';

import { StoryStatusIndex } from '../lib/tokenStatuses';

const EMPTY: LearnerVocabularyItem[] = [];
export const LearnerContext = createContext<{ service: VocabularyStateService; items: LearnerVocabularyItem[]; error?: string } | undefined>(undefined);
export function useVocabularyItems(service: VocabularyStateService) {
  const [items, setItems] = useState<LearnerVocabularyItem[]>(EMPTY);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true, generation = 0;
    function load() {
      const request = ++generation;
      service.getAll().then((data) => { if (active && request === generation) { setItems(data); setError(undefined); } })
        .catch(() => { if (active && request === generation) setError('El vocabulario no se puede guardar o recuperar en este navegador.'); });
    }
    load(); const unsubscribe = service.subscribe(load);
    return () => { active = false; unsubscribe(); };
  }, [service]);
  return { service, items, error };
}
export function VocabularyControls({ identity }: { identity: VocabularyIdentity }) {
  const learner = useContext(LearnerContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!learner) return null;
  const status = learner.items.find((item) => item.id === identity.id)?.status;
  async function update(next?: VocabularyStatus) {
    setBusy(true); setError(undefined);
    try { if (next) await learner!.service.setStatus(identity, next); else await learner!.service.removeStatus(identity); }
    catch { setError('No se pudo guardar el estado. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <section className="vocabulary-controls" aria-label={`Estado de ${identity.lemma} / ${identity.reading}`}>
    <p>{status === 'learning' ? 'Aprendiendo' : status === 'known' ? 'Conocida' : 'Sin clasificar'}</p>
    <div className="status-actions">
      <button type="button" aria-pressed={status === 'learning'} disabled={busy || Boolean(learner.error)} onClick={() => void update('learning')}>Aprendiendo</button>
      <button type="button" aria-pressed={status === 'known'} disabled={busy || Boolean(learner.error)} onClick={() => void update('known')}>Conocida</button>
      {status && <button type="button" className="clear-status" disabled={busy || Boolean(learner.error)} onClick={() => void update()}>Quitar estado</button>}
    </div>
    {error && <p className="dictionary-note" role="alert">{error}</p>}
    {learner.error && <p className="dictionary-note">{learner.error}</p>}
  </section>;
}
export function useTokenStatuses(story: Story, dictionary: DictionaryService = dictionaryService) {
  const learner = useContext(LearnerContext);
  const items = learner?.error ? EMPTY : learner?.items ?? EMPTY;
  const index = useMemo(() => new StoryStatusIndex(story, dictionary), [story, dictionary]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const resolve = () => void index.resolve(items).then((changed) => {
      if (active && changed) setRevision((value) => value + 1);
    });
    resolve();
    const unsubscribe = dictionary.subscribe?.(() => {
      if (dictionary.getStatus?.().phase === 'ready') { index.retryUnresolved(); resolve(); }
    });
    return () => { active = false; unsubscribe?.(); };
  }, [index, dictionary, items]);
  return useMemo(() => index.statuses(items), [index, items, revision]);
}
