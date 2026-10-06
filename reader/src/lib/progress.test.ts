import { describe, expect, it } from 'vitest';
import { createProgressStore, PROGRESS_KEY } from './progress';

describe('local progress store', () => {
  it('round trips completion, last opened, and last sentence separately from content', () => {
    const store = createProgressStore();
    const progress = { work_001: { story_id: 'work_001', last_opened: '2026-10-06T11:00:00Z', completed: true, last_sentence: 's15' } };
    expect(store.save(progress)).toBeUndefined();
    expect(createProgressStore().load().progress).toEqual(progress);
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).version).toBe(1);
  });
  it('recovers from invalid JSON, unknown versions, and malformed entries', () => {
    localStorage.setItem(PROGRESS_KEY, '{broken');
    expect(createProgressStore().load().notice).toBeTruthy();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 9, stories: {} }));
    expect(createProgressStore().load().progress).toEqual({});
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, stories: { work_001: { completed: 'yes' } } }));
    expect(createProgressStore().load().notice).toBeTruthy();
  });
  it('handles blocked storage reads and writes without throwing', () => {
    const store = createProgressStore(() => { throw new Error('blocked'); });
    expect(store.load().progress).toEqual({});
    expect(store.load().notice).toBeTruthy();
    expect(store.save({})).toContain('no se puede guardar');
  });
});
