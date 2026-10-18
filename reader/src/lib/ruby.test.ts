import { describe, expect, it } from 'vitest';
import { rubySegments } from './ruby';
const segments = (surface: string, reading: string) => rubySegments({ surface, reading, lemma: surface });
describe('conservative contextual furigana alignment', () => {
  it('separates literal kana from the kanji reading without splitting compounds', () => {
    expect(segments('食べる', 'タベル')).toEqual([{ text: '食', reading: 'た' }, { text: 'べる', reading: null }]);
    expect(segments('買い物', 'カイモノ')).toEqual([{ text: '買', reading: 'か' }, { text: 'い', reading: null }, { text: '物', reading: 'もの' }]);
    expect(segments('お茶', 'オチャ')).toEqual([{ text: 'お', reading: null }, { text: '茶', reading: 'ちゃ' }]);
    expect(segments('約束', 'ヤクソク')).toEqual([{ text: '約束', reading: 'ヤクソク' }]);
  });
  it('preserves explicit alignment and falls back for ambiguous or inconsistent anchors', () => {
    const explicit = [{ text: '今日', reading: 'きょう' }];
    expect(rubySegments({ surface: '今日', reading: 'キョウ', lemma: '今日', furigana_segments: explicit })).toBe(explicit);
    expect(segments('甲の乙', 'アノイノウ')).toEqual([{ text: '甲の乙', reading: 'アノイノウ' }]);
    expect(segments('食べる', 'ショク')).toEqual([{ text: '食べる', reading: 'ショク' }]);
  });
});
