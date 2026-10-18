import catalog from '../../../audio/catalog.json';
import type { Story } from './types';

export interface RecordedStory {
  story_id: string; voice: string; provider: string; review: string;
  paragraphs: { id: string; sentences: { id: string; text: string }[] }[];
  files: { path: string; sha256: string; bytes: number }[];
}

// Exact source comparison prevents playing recordings after Japanese text edits.
// Translation, furigana and dictionary corrections do not invalidate recordings.
export function recordingFor(story: Story, entries: Record<string, RecordedStory> = catalog.stories): RecordedStory | null {
  const recording = entries[story.id];
  if (!recording || recording.story_id !== story.id || recording.provider !== 'azure-speech-f0'
    || recording.review !== 'playback-checked' || !/^ja-JP-(Nanami|Keita)Neural$/.test(recording.voice)
    || recording.paragraphs.length !== story.content.paragraphs.length
    || recording.files.length !== recording.paragraphs.length) return null;
  const expected = story.content.paragraphs.map(({ id, sentences }) => ({ id, sentences: sentences.map(({ id, text }) => ({ id, text })) }));
  if (JSON.stringify(recording.paragraphs) !== JSON.stringify(expected)) return null;
  if (!recording.files.every((file, i) => file.path === `audio/${story.id}/${String(i + 1).padStart(2, '0')}.mp3`
    && /^[a-z0-9_]+$/.test(story.id) && /^[a-f0-9]{64}$/.test(file.sha256) && file.bytes > 255)) return null;
  return recording;
}
