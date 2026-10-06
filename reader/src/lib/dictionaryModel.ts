export interface DictionaryQuery { lemma?: string; surface?: string; reading?: string; type?: string }
export interface DictionaryForm { text: string; common: boolean; labels: string[] }
export interface DictionaryReading extends DictionaryForm { appliesToSpellings: string[] }
export interface DictionaryGloss { language: 'es' | 'en'; text: string; type?: string; gender?: string }
export interface DictionarySense {
  glosses: DictionaryGloss[]; partsOfSpeech: string[]; fields: string[]; misc: string[];
  dialects: string[]; notes: string[]; appliesToSpellings: string[]; appliesToReadings: string[];
}
export interface DictionaryEntry {
  id: string; provider: 'jmdict'; spellings: DictionaryForm[]; readings: DictionaryReading[]; senses: DictionarySense[];
}
export interface DictionaryResult {
  id: string; provider: 'jmdict'; headword: string; readings: string[]; senses: DictionarySense[];
  partsOfSpeech: string[]; common: boolean; formLabels: string[];
  matchedBy: 'lemma' | 'surface' | 'reading';
}
export interface DictionaryStatus {
  phase: 'idle' | 'preparing' | 'ready' | 'unavailable'; progress?: number; message?: string;
}
export interface DictionaryService {
  lookup(query: DictionaryQuery, signal?: AbortSignal): Promise<DictionaryResult[]>;
  subscribe?(listener: () => void): () => void;
  getStatus?(): DictionaryStatus;
}
export interface DictionaryManifest {
  format: 1; version: string; entryCount: number; dictionaryDate: string;
  chunks: { path: string; sha256: string; entries: number; bytes: number }[];
}

// Preserve long-vowel marks and interior punctuation. Normalize half-width kana,
// compatibility characters, whitespace and surrounding sentence punctuation.
export function normalizeJapanese(value = ''): string {
  return value.normalize('NFKC').trim().replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
    .replace(/\s+/gu, '').replace(/[ァ-ヶ]/gu, (kana) => String.fromCodePoint(kana.codePointAt(0)! - 0x60));
}
export function entryKeys(entry: DictionaryEntry): string[] {
  return [...new Set([...entry.spellings, ...entry.readings].map((form) => normalizeJapanese(form.text)).filter(Boolean))];
}
const applies = (restrictions: string[], text: string) => restrictions.includes('*')
  || restrictions.some((item) => normalizeJapanese(item) === normalizeJapanese(text));

export function resolveEntry(entry: DictionaryEntry, query: DictionaryQuery, matchedBy: DictionaryResult['matchedBy']): DictionaryResult | null {
  const term = normalizeJapanese(query[matchedBy]);
  const spelling = entry.spellings.find((form) => normalizeJapanese(form.text) === term);
  const matchedReading = entry.readings.find((form) => normalizeJapanese(form.text) === term);
  const headword = spelling?.text ?? (matchedReading ? matchedReading.text : entry.spellings[0]?.text ?? entry.readings[0].text);
  const readings = spelling ? entry.readings.filter((reading) => applies(reading.appliesToSpellings, headword))
    : matchedReading ? [matchedReading] : entry.readings;
  const compatibleReading = readings.find((reading) => normalizeJapanese(reading.text) === normalizeJapanese(query.reading));
  // Inflected token readings often differ from lemma readings. Keep the lemma's
  // readings/senses in that case, without inventing a deinflection algorithm.
  const selectedReadings = compatibleReading ? [compatibleReading] : readings;
  const senses = entry.senses.filter((sense) => (!spelling || applies(sense.appliesToSpellings, headword))
    && selectedReadings.some((reading) => applies(sense.appliesToReadings, reading.text)));
  if (senses.length === 0) return null;
  const primaryLanguage = senses.some((sense) => sense.glosses.some((gloss) => gloss.language === 'es')) ? 'es' : 'en';
  const primarySenses = senses.filter((sense) => sense.glosses.some((gloss) => gloss.language === primaryLanguage));
  return { id: entry.id, provider: entry.provider, headword,
    readings: selectedReadings.map((reading) => reading.text), senses,
    partsOfSpeech: [...new Set(primarySenses.flatMap((sense) => sense.partsOfSpeech))],
    common: Boolean(spelling?.common || selectedReadings.some((reading) => reading.common)),
    formLabels: [...new Set([...(spelling?.labels ?? []), ...selectedReadings.flatMap((reading) => reading.labels)])], matchedBy };
}

export function rankResults(results: DictionaryResult[], query: DictionaryQuery): DictionaryResult[] {
  const reading = normalizeJapanese(query.reading);
  const posMatch = (result: DictionaryResult) => result.partsOfSpeech.some((label) => {
    const lower = label.toLowerCase();
    return query.type === 'noun' ? lower.includes('noun')
      : query.type === 'verb' ? lower.includes('verb')
      : query.type === 'adjective' ? lower.includes('adjective')
      : query.type === 'adverb' ? lower.includes('adverb') : false;
  });
  const score = (result: DictionaryResult) => (result.readings.some((value) => normalizeJapanese(value) === reading) ? 100 : 0)
    + (posMatch(result) ? 10 : 0) + (result.common ? 1 : 0);
  return [...results].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

export function preferredSenses(entry: DictionaryResult): { language: 'es' | 'en'; senses: DictionarySense[] } {
  const language = entry.senses.some((sense) => sense.glosses.some((gloss) => gloss.language === 'es')) ? 'es' : 'en';
  return { language, senses: entry.senses.filter((sense) => sense.glosses.some((gloss) => gloss.language === language)) };
}

const posLabels: Record<string, string> = {
  'noun (common) (futsuumeishi)': 'Sustantivo', 'Ichidan verb': 'Verbo ichidan',
  'intransitive verb': 'Intransitivo', 'transitive verb': 'Transitivo',
  'adjective (keiyoushi)': 'Adjetivo i', 'adjectival nouns or quasi-adjectives (keiyodoshi)': 'Adjetivo na',
  'adverb (fukushi)': 'Adverbio', 'expressions (phrases, clauses, etc.)': 'Expresión',
  'particle': 'Partícula', 'auxiliary': 'Auxiliar', 'auxiliary verb': 'Verbo auxiliar',
  'suru verb - included': 'Verbo suru', 'noun or participle which takes the aux. verb suru': 'Sustantivo / verbo suru',
  'Kuru verb - special class': 'Verbo kuru', 'unclassified': 'Sin clasificación',
};
export function formatPartOfSpeech(label: string): string {
  if (posLabels[label]) return posLabels[label];
  if (label.startsWith('Godan verb')) return `Verbo godan (${label.replace(/^Godan verb\s*(?:with\s*)?/, '')})`;
  // Every uncommon label arrives expanded from upstream, never a raw XML code.
  return label;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const form = (value: unknown): value is DictionaryForm => record(value) && typeof value.text === 'string' && value.text.length > 0
  && typeof value.common === 'boolean' && strings(value.labels);
export function parseDictionaryChunk(value: unknown): DictionaryEntry[] {
  if (!Array.isArray(value) || value.some((entry) => !record(entry) || typeof entry.id !== 'string' || !/^\d+$/.test(entry.id)
    || entry.provider !== 'jmdict' || !Array.isArray(entry.spellings) || !entry.spellings.every(form)
    || !Array.isArray(entry.readings) || entry.readings.length === 0
    || !entry.readings.every((item) => form(item) && record(item) && strings(item.appliesToSpellings))
    || !Array.isArray(entry.senses) || entry.senses.length === 0 || !entry.senses.every((sense) => record(sense)
      && Array.isArray(sense.glosses) && sense.glosses.length > 0 && sense.glosses.every((gloss) => record(gloss)
        && ['es', 'en'].includes(String(gloss.language)) && typeof gloss.text === 'string' && gloss.text.length > 0)
      && ['partsOfSpeech', 'fields', 'misc', 'dialects', 'notes', 'appliesToSpellings', 'appliesToReadings'].every((key) => strings(sense[key]))))) {
    throw new Error('Los datos del diccionario tienen un formato incorrecto.');
  }
  if (new Set(value.map((entry) => entry.id)).size !== value.length) throw new Error('Entradas duplicadas en el diccionario.');
  return value as DictionaryEntry[];
}
export function parseDictionaryManifest(value: unknown): DictionaryManifest {
  if (!record(value) || value.format !== 1 || typeof value.version !== 'string' || !/^[a-f0-9]{24}$/.test(value.version)
    || !Number.isInteger(value.entryCount) || Number(value.entryCount) <= 0 || typeof value.dictionaryDate !== 'string'
    || !Array.isArray(value.chunks) || value.chunks.length === 0 || !value.chunks.every((chunk) => record(chunk)
      && typeof chunk.path === 'string' && new RegExp(`^${value.version}/entries-\\d{4}\\.json\\.gz\\.bin$`).test(chunk.path)
      && typeof chunk.sha256 === 'string' && /^[a-f0-9]{64}$/.test(chunk.sha256)
      && Number.isInteger(chunk.entries) && Number(chunk.entries) > 0 && Number.isInteger(chunk.bytes) && Number(chunk.bytes) > 0)
    || new Set(value.chunks.map((chunk) => chunk.path)).size !== value.chunks.length
    || value.chunks.reduce((sum, chunk) => sum + chunk.entries, 0) !== value.entryCount) {
    throw new Error('No se pudo leer el índice del diccionario.');
  }
  return value as unknown as DictionaryManifest;
}
