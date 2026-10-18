import { useI18n } from '../lib/i18n';
import { sentenceSegments } from '../lib/content';
import type { Sentence, Token } from '../lib/types';
import { tokenQueryKey, type VocabularyStatus } from '../lib/vocabulary';
import { shouldShowFurigana, type FuriganaMode } from '../lib/furigana';
import { rubySegments, hiraganaReading } from '../lib/ruby';
export { hiraganaReading } from '../lib/ruby';

const hasKanji = (surface: string) => /\p{Script=Han}/u.test(surface);
// Tokenizer readings stay intact; ruby uses hiragana, including voiced kana.
export const isInteractive = (token: Token) => !token.ignore_lookup
  && token.type !== 'punctuation' && token.type !== 'particle' && token.type !== 'auxiliary'
  && /[\p{L}\p{N}]/u.test(token.surface);

export function FuriganaText({ token, enabled }: { token: Token; enabled: boolean }) {
  if (!enabled || !hasKanji(token.surface)) return <>{token.surface}</>;
  return <>{rubySegments(token).map((part, index) => part.reading
    && hasKanji(part.text) ? <ruby key={index}>{part.text}<rt>{hiraganaReading(part.reading)}</rt></ruby>
    : <span key={index}>{part.text}</span>)}</>;
}

export function JapaneseText({ sentence, furigana, onToken, vocabularyStatuses, selectedToken }: {
  sentence: Sentence; furigana: FuriganaMode; onToken: (token: Token) => void;
  vocabularyStatuses?: Map<string, VocabularyStatus>;
  selectedToken?: Token;
}) {
  const { t } = useI18n();
  return <span lang="ja" className="japanese-text" data-testid={`text-${sentence.id}`}>
    {sentenceSegments(sentence).map((segment, index) => segment.token && isInteractive(segment.token)
      ? <button key={index} type="button" className={`word${segment.token.target ? ' word-target' : ''}${vocabularyStatuses?.get(tokenQueryKey(segment.token)) === 'learning' ? ' word-learning' : ''}${vocabularyStatuses?.get(tokenQueryKey(segment.token)) === 'known' ? ' word-known' : ''}`}
          data-vocabulary-status={vocabularyStatuses?.get(tokenQueryKey(segment.token))} aria-pressed={selectedToken ? segment.token === selectedToken : undefined}
          aria-label={t(`Ver palabra: ${segment.token.surface}`)} onClick={() => onToken(segment.token!)}>
          <FuriganaText token={segment.token} enabled={shouldShowFurigana(segment.token, vocabularyStatuses?.get(tokenQueryKey(segment.token)), furigana)} />
        </button>
      : <span key={index}>{segment.token ? <FuriganaText token={segment.token} enabled={shouldShowFurigana(segment.token, vocabularyStatuses?.get(tokenQueryKey(segment.token)), furigana)} /> : segment.text}</span>)}
  </span>;
}
