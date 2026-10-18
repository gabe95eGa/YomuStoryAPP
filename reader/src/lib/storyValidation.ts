import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import storySchema from '../../../schema/yomustory-v1.schema.json';
import type { Story } from './types';
import { sentenceSegments } from './content';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const checkStorySchema = ajv.compile<Story>(storySchema);

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
