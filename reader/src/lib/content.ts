import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import storySchema from '../../../schema/yomustory-v1.schema.json';
import type { Manifest, Sentence, Story, StoryListing, Token } from './types';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const checkStorySchema = ajv.compile<Story>(storySchema);
const levels = new Set(['N5', 'N5-N4', 'N4', 'N4-N3', 'N3', 'N3-N2', 'N2', 'N2-N1', 'N1']);
const text = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function safeStoryPath(value: unknown): value is string {
  return typeof value === 'string' && /^stories\/[a-z0-9_/-]+\.json$/.test(value) && !value.split('/').includes('..');
}

function isListing(value: unknown): value is StoryListing {
  return record(value) && text(value.id) && /^[a-z0-9_]+$/.test(value.id) && text(value.title)
    && text(value.title_es) && typeof value.level === 'string' && levels.has(value.level)
    && Number.isInteger(value.difficulty) && Number(value.difficulty) >= 1 && Number(value.difficulty) <= 5
    && typeof value.estimated_minutes === 'number' && Number.isFinite(value.estimated_minutes) && value.estimated_minutes > 0
    && Array.isArray(value.topics) && value.topics.every(text) && safeStoryPath(value.path);
}

export function parseManifest(value: unknown): Manifest {
  if (!record(value) || value.schema_version !== '1.0' || !Array.isArray(value.stories)
    || !value.stories.every(isListing) || new Set(value.stories.map((item) => item.id)).size !== value.stories.length) {
    throw new Error('La biblioteca tiene un formato incorrecto. Revisa el archivo manifest.json.');
  }
  return value as unknown as Manifest;
}

export interface SentenceSegment { text: string; token?: Token }

// JS string indices count UTF-16 units; YomuStory offsets count Unicode code points.
// Preserve unannotated gaps, particles, whitespace, and punctuation exactly.
export function sentenceSegments(sentence: Sentence): SentenceSegment[] {
  const points = Array.from(sentence.text);
  const segments: SentenceSegment[] = [];
  let cursor = 0;
  for (const token of sentence.tokens) {
    let start = token.start;
    if (start === undefined) {
      const remaining = points.slice(cursor).join('');
      const found = remaining.indexOf(token.surface);
      if (found < 0) throw new Error(`Token ausente en la frase ${sentence.id}.`);
      start = cursor + Array.from(remaining.slice(0, found)).length;
    }
    const end = token.end ?? start + Array.from(token.surface).length;
    if (start < cursor || end <= start || end > points.length || points.slice(start, end).join('') !== token.surface) {
      throw new Error(`Anotación incorrecta en la frase ${sentence.id}.`);
    }
    if (start > cursor) segments.push({ text: points.slice(cursor, start).join('') });
    segments.push({ text: token.surface, token });
    cursor = end;
  }
  if (cursor < points.length) segments.push({ text: points.slice(cursor).join('') });
  return segments;
}

export function parseStory(value: unknown, expectedId: string): Story {
  if (!checkStorySchema(value) || value.id !== expectedId) {
    throw new Error('Esta lectura tiene un formato incorrecto o no corresponde a la historia elegida.');
  }
  const paragraphIds = new Set<string>();
  const sentenceIds = new Set<string>();
  for (const paragraph of value.content.paragraphs) {
    if (paragraphIds.has(paragraph.id)) throw new Error('La lectura tiene párrafos duplicados.');
    paragraphIds.add(paragraph.id);
    for (const sentence of paragraph.sentences) {
      if (sentenceIds.has(sentence.id)) throw new Error('La lectura tiene frases duplicadas.');
      sentenceIds.add(sentence.id);
      if (!sentence.translation_es?.trim()) throw new Error('Falta una traducción en esta lectura.');
      sentenceSegments(sentence);
      if (sentence.tokens.some((token) => token.furigana_segments
        && token.furigana_segments.map((part) => part.text).join('') !== token.surface)) {
        throw new Error('Una anotación de furigana no coincide con el texto.');
      }
    }
  }
  return value; // Retain grammar, comprehension, and future fields in the original object.
}

async function fetchJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}content/${path}`, { signal });
  if (!response.ok) throw new Error(response.status === 404
    ? 'No se encontró el archivo de la lectura. Comprueba que el contenido esté preparado.'
    : 'No se pudo cargar el contenido. Comprueba la conexión con el servidor local.');
  try { return await response.json(); }
  catch { throw new Error('El archivo de contenido no contiene JSON válido.'); }
}

export interface ContentService {
  loadManifest(signal?: AbortSignal): Promise<Manifest>;
  loadStory(listing: StoryListing, signal?: AbortSignal): Promise<Story>;
}
export const contentService: ContentService = {
  async loadManifest(signal) { return parseManifest(await fetchJson('manifest.json', signal)); },
  async loadStory(listing, signal) {
    if (!safeStoryPath(listing.path)) throw new Error('La ruta de esta lectura no es válida.');
    return parseStory(await fetchJson(listing.path, signal), listing.id);
  },
};
