// Integration boundary: a future local JMdict adapter implements lookup(lemma).
// The V1 adapter reports absence; token annotations remain the panel's source.
export interface DictionaryEntry { lemma: string; reading: string; meanings_es: string[]; source: string }
export interface DictionaryService { lookup(lemma: string, signal?: AbortSignal): Promise<DictionaryEntry | null> }
export const dictionaryService: DictionaryService = { async lookup() { return null; } };
