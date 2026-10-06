import { sentenceSegments } from '../lib/content';
import type { Sentence, Token } from '../lib/types';

const hasKanji = (surface: string) => /\p{Script=Han}/u.test(surface);
export const isInteractive = (token: Token) => !token.ignore_lookup
  && token.type !== 'punctuation' && token.type !== 'particle' && token.type !== 'auxiliary'
  && /[\p{L}\p{N}]/u.test(token.surface);

export function FuriganaText({ token, enabled }: { token: Token; enabled: boolean }) {
  if (!enabled || !hasKanji(token.surface)) return <>{token.surface}</>;
  if (token.furigana_segments) return <>{token.furigana_segments.map((part, index) => part.reading
    && hasKanji(part.text) ? <ruby key={index}>{part.text}<rt>{part.reading}</rt></ruby>
    : <span key={index}>{part.text}</span>)}</>;
  return <ruby>{token.surface}<rt>{token.reading}</rt></ruby>;
}

export function JapaneseText({ sentence, furigana, onToken }: {
  sentence: Sentence; furigana: boolean; onToken: (token: Token) => void;
}) {
  return <span lang="ja" className="japanese-text" data-testid={`text-${sentence.id}`}>
    {sentenceSegments(sentence).map((segment, index) => segment.token && isInteractive(segment.token)
      ? <button key={index} type="button" className={`word${segment.token.target ? ' word-target' : ''}`}
          aria-label={`Ver palabra: ${segment.token.surface}`} onClick={() => onToken(segment.token!)}>
          <FuriganaText token={segment.token} enabled={furigana} />
        </button>
      : <span key={index}>{segment.token ? <FuriganaText token={segment.token} enabled={furigana} /> : segment.text}</span>)}
  </span>;
}
