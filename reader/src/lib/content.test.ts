import { describe, expect, it, vi } from 'vitest';
import manifestData from '../../../manifest.json';
import storyData from '../../../stories/work/work_001.json';
import dailyBatch from '../../../stories/daily/daily_002.json';
import workBatch from '../../../stories/work/work_002.json';
import travelBatch from '../../../stories/travel/travel_002.json';
import japanBatch from '../../../stories/japan/japan_002.json';
import cookingBatch from '../../../stories/cooking/cooking_002.json';
import { contentService, parseManifest, parseStory, sentenceSegments } from './content';
import type { Sentence } from './types';

describe('content loading and validation', () => {
  it.each([dailyBatch, workBatch, travelBatch, japanBatch, cookingBatch])('reads published reinforcement content $id', (data) => {
    const story = parseStory(data, data.id);
    const listing = parseManifest(manifestData).stories.find((item) => item.id === data.id);
    expect(listing).toBeDefined();
    expect(story.comprehension).toEqual(data.comprehension);
    expect(data.comprehension.questions).toHaveLength(3);
    expect(story.content.paragraphs.flatMap((p) => p.sentences).every((s) => s.translation_es && s.tokens.length)).toBe(true);
  });
  it('loads the actual manifest through the content URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => manifestData });
    vi.stubGlobal('fetch', fetchMock);
    const manifest = await contentService.loadManifest();
    expect(manifest.stories).toHaveLength(manifestData.stories.length);
    expect(fetchMock.mock.calls[0][0]).toMatch(/content\/manifest\.json$/);
  });
  it('loads a selected manifest path and retains grammar and comprehension', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => storyData });
    vi.stubGlobal('fetch', fetchMock);
    const listing = parseManifest(manifestData).stories.find((item) => item.id === 'work_001')!;
    const story = await contentService.loadStory(listing);
    expect(fetchMock.mock.calls[0][0]).toMatch(/content\/stories\/work\/work_001.json$/);
    expect(story.comprehension).toEqual(storyData.comprehension);
    expect(story.content.paragraphs[2].sentences[1].grammar_points).toHaveLength(1);
  });
  it('explains missing files and invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(contentService.loadManifest()).rejects.toThrow('No se encontró');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new Error('parse')) }));
    await expect(contentService.loadManifest()).rejects.toThrow('JSON válido');
  });
  it('accepts empty libraries and rejects malformed, duplicate, and unsafe listings', () => {
    expect(parseManifest({ schema_version: '1.0', stories: [] }).stories).toEqual([]);
    expect(() => parseManifest({ stories: [{}] })).toThrow();
    const duplicate = structuredClone(manifestData);
    duplicate.stories.push(duplicate.stories[0]);
    expect(() => parseManifest(duplicate)).toThrow();
    const unsafe = structuredClone(manifestData);
    unsafe.stories[0].path = 'https://example.com/story.json';
    expect(() => parseManifest(unsafe)).toThrow();
  });
  it('rejects malformed story structure, wrong IDs, bad offsets, and repeated sentence IDs', () => {
    expect(() => parseStory({}, 'work_001')).toThrow();
    expect(() => parseStory(storyData, 'other_001')).toThrow();
    const badOffset = structuredClone(storyData);
    badOffset.content.paragraphs[0].sentences[0].tokens[0].end = 99;
    expect(() => parseStory(badOffset, 'work_001')).toThrow('Anotación');
    const duplicate = structuredClone(storyData);
    duplicate.content.paragraphs[0].sentences[1].id = 's1';
    expect(() => parseStory(duplicate, 'work_001')).toThrow('duplicadas');
  });
});

describe('exact structured text', () => {
  it('preserves unannotated gaps and code-point offsets around supplementary characters', () => {
    const sentence: Sentence = { id: 's1', text: '😀仕事に慣れて。', tokens: [
      { surface: '仕事', lemma: '仕事', reading: 'しごと', start: 1, end: 3 },
      { surface: '慣れて', lemma: '慣れる', reading: 'なれて' },
    ] };
    const parts = sentenceSegments(sentence);
    expect(parts.map((part) => part.text).join('')).toBe(sentence.text);
    expect(parts.filter((part) => !part.token).map((part) => part.text)).toEqual(['😀', 'に', '。']);
  });
  it('does not reuse the same occurrence of a repeated surface', () => {
    const token = { surface: '仕事', lemma: '仕事', reading: 'しごと' };
    expect(() => sentenceSegments({ id: 's1', text: '仕事。', tokens: [token, token] })).toThrow();
  });
  it('reconstructs every sentence in the actual sample exactly', () => {
    const story = parseStory(storyData, 'work_001');
    for (const paragraph of story.content.paragraphs) for (const sentence of paragraph.sentences) {
      expect(sentenceSegments(sentence).map((part) => part.text).join('')).toBe(sentence.text);
    }
  });
});
