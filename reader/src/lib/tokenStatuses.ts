import { normalizeJapanese, type DictionaryResult, type DictionaryService } from './dictionaryModel';
import type { Story, Token } from './types';
import { identityForEntry, identityForToken, tokenQueryKey, type LearnerVocabularyItem, type VocabularyStatus } from './vocabulary';

// Ranking/commonness alone cannot establish that a homograph is known.
export function reliableTokenIdentity(token: Token, results: DictionaryResult[]): string | undefined {
  const lemma = normalizeJapanese(token.lemma), reading = normalizeJapanese(token.reading);
  const sameLemma = results.filter((entry) => normalizeJapanese(entry.headword) === lemma);
  const sameReading = sameLemma.filter((entry) => entry.readings.some((value) => normalizeJapanese(value) === reading));
  const candidates = sameReading.length ? sameReading : token.type === 'verb' || token.type === 'adjective' ? sameLemma : [];
  if (candidates.length !== 1 || candidates[0].readings.length !== 1) return undefined;
  return identityForEntry(candidates[0]).id;
}

export class StoryStatusIndex {
  private tokens: Map<string, Token>;
  private identities = new Map<string, string | undefined>();
  private learningIdentities = new Map<string, string>();
  private fallbackIdentities = new Map<string, string>();
  private requests = new Map<string, Promise<void>>();
  private current = new Map<string, VocabularyStatus>();
  constructor(story: Story, private dictionary: DictionaryService) {
    this.tokens = new Map(story.content.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.tokens))
      .filter((token) => !token.ignore_lookup).map((token) => [tokenQueryKey(token), token]));
    for (const [key, token] of this.tokens) this.fallbackIdentities.set(key, identityForToken(token).id);
  }
  async resolve(items: LearnerVocabularyItem[]): Promise<boolean> {
    const lemmas = new Set(items.filter((item) => item.dictionaryEntryId).map((item) => normalizeJapanese(item.lemma)));
    const pending: Promise<void>[] = [];
    for (const [key, token] of this.tokens) {
      if (!lemmas.has(normalizeJapanese(token.lemma)) || this.identities.has(key)) continue;
      let request = this.requests.get(key);
      if (!request) {
        request = this.dictionary.lookup({ lemma: token.lemma, surface: token.surface, reading: token.reading, type: token.type })
          .then((results) => {
            this.identities.set(key, reliableTokenIdentity(token, results));
            // Preserve the existing sheet's Learning indicator even when the
            // first displayed entry is too ambiguous to suppress a reading.
            if (results[0]) this.learningIdentities.set(key, identityForEntry(results[0]).id);
          })
          .catch(() => { /* Uncertain words keep their annotation; failed requests may retry. */ })
          .finally(() => { this.requests.delete(key); });
        this.requests.set(key, request);
      }
      pending.push(request);
    }
    await Promise.all(pending);
    return pending.length > 0;
  }
  // Reconcile only changed keys. No per-token learner-store requests, and no
  // clearing/re-resolving dictionary identities on a Learning/Known transition.
  statuses(items: LearnerVocabularyItem[]): Map<string, VocabularyStatus> {
    const byId = new Map(items.map((item) => [item.id, item.status]));
    let next = this.current;
    for (const key of this.tokens.keys()) {
      const id = this.identities.get(key);
      const status = byId.get(id ?? this.fallbackIdentities.get(key)!)
        ?? (byId.get(this.learningIdentities.get(key) ?? '') === 'learning' ? 'learning' : undefined);
      if (status === next.get(key)) continue;
      if (next === this.current) next = new Map(this.current);
      if (status) next.set(key, status); else next.delete(key);
    }
    this.current = next;
    return next;
  }
  retryUnresolved() {
    for (const [key, identity] of this.identities) if (!identity) this.identities.delete(key);
  }
}
