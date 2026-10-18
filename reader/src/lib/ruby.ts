import type { FuriganaSegment, Token } from './types';

export const hiraganaReading = (reading: string) => reading.normalize('NFKC')
  .replace(/[ァ-ヶヽヾ]/gu, (kana) => String.fromCodePoint(kana.codePointAt(0)! - 0x60));

// Align literal kana anchors against the tokenizer's contextual reading. Never
// guess individual readings inside a kanji compound or choose ambiguous splits.
export function rubySegments(token: Token): FuriganaSegment[] {
  if (token.furigana_segments) return token.furigana_segments;
  const fallback = [{ text: token.surface, reading: token.reading }];
  const parts = token.surface.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) ?? [];
  const reading = hiraganaReading(token.reading);
  if (parts.length < 2 || token.surface.length > 80 || reading.length > 100
    || !/^[\p{Script=Hiragana}ー]+$/u.test(reading)
    || parts.some((part) => !/^\p{Script=Han}+$/u.test(part) && !/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(part))) return fallback;
  const matches: FuriganaSegment[][] = [];
  let budget = 2000;
  function align(index: number, offset: number, result: FuriganaSegment[]) {
    if (--budget < 0 || matches.length > 1) return;
    if (index === parts.length) { if (offset === reading.length) matches.push(result); return; }
    const part = parts[index];
    if (!/^\p{Script=Han}+$/u.test(part)) {
      const kana = hiraganaReading(part);
      if (reading.startsWith(kana, offset)) align(index + 1, offset + kana.length, [...result, { text: part, reading: null }]);
    } else {
      for (let end = offset + 1; end <= reading.length && matches.length < 2 && budget > 0; end++) {
        align(index + 1, end, [...result, { text: part, reading: reading.slice(offset, end) }]);
      }
    }
  }
  align(0, 0, []);
  return budget > 0 && matches.length === 1 ? matches[0] : fallback;
}
