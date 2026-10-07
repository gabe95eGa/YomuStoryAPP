import type { Token } from './types';
import type { VocabularyStatus } from './vocabulary';

export type FuriganaMode = 'all' | 'adaptive' | 'none';
export function migrateFurigana(value: unknown): FuriganaMode | undefined {
  if (value === true) return 'all';
  if (value === false) return 'none';
  return value === 'all' || value === 'adaptive' || value === 'none' ? value : undefined;
}
export function shouldShowFurigana(token: Token, status: VocabularyStatus | undefined, mode: FuriganaMode): boolean {
  return /\p{Script=Han}/u.test(token.surface) && mode !== 'none' && (mode !== 'adaptive' || status !== 'known');
}
