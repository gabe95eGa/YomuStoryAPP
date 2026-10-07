import { createContext, useContext, useEffect, useState } from 'react';
import { dictionaryService } from '../lib/dictionary';
import { normalizeJapanese, type DictionaryService } from '../lib/dictionaryModel';
import type { Story, Token } from '../lib/types';
import { identityForEntry, identityForToken, tokenQueryKey, type LearnerVocabularyItem,
  type VocabularyIdentity, type VocabularyStateService, type VocabularyStatus } from '../lib/vocabulary';

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
  const items = useContext(LearnerContext)?.items ?? EMPTY;
  const [statuses, setStatuses] = useState<Map<string, VocabularyStatus>>(new Map());
  useEffect(() => {
    let active = true;
    const byId = new Map(items.map((item) => [item.id, item.status]));
    const trackedLemmas = new Set(items.filter((item) => item.dictionaryEntryId).map((item) => normalizeJapanese(item.lemma)));
    const tokens = story.content.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens));
    const unique = new Map(tokens.filter((token) => !token.ignore_lookup).map((token) => [tokenQueryKey(token), token]));
    const next = new Map<string, VocabularyStatus>();
    unique.forEach((token, key) => { const status = byId.get(identityForToken(token).id); if (status) next.set(key, status); });
    setStatuses(new Map(next));
    const queries = [...unique].filter(([, token]) => trackedLemmas.has(normalizeJapanese(token.lemma)));
    void Promise.all(queries.map(async ([key, token]: [string, Token]) => {
      try {
        const result = (await dictionary.lookup({ lemma: token.lemma, surface: token.surface, reading: token.reading, type: token.type }))[0];
        if (result) { const status = byId.get(identityForEntry(result).id); if (status) next.set(key, status); else next.delete(key); }
      } catch { /* Original annotations remain usable when dictionary assets are absent. */ }
    })).then(() => { if (active) setStatuses(new Map(next)); });
    return () => { active = false; };
  }, [story, dictionary, items]);
  return statuses;
}
