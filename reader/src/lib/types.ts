export interface StoryMetadata {
  title: string;
  title_es: string;
  level: string;
  difficulty: number;
  estimated_minutes: number;
  topics: string[];
  summary_es?: string;
}
export interface StoryListing extends StoryMetadata { id: string; path: string }
export interface Manifest { schema_version: '1.0'; stories: StoryListing[]; generated_at?: string }
export interface FuriganaSegment { text: string; reading: string | null }
export interface Token {
  surface: string; lemma: string; reading: string;
  start?: number; end?: number; target?: boolean; type?: string;
  ignore_lookup?: boolean; dictionary_id?: string; furigana_segments?: FuriganaSegment[];
}
export interface GrammarPoint {
  pattern: string; meaning_es?: string; level?: string; target?: boolean; start?: number; end?: number;
}
export interface Sentence {
  id: string; text: string; translation_es?: string; tokens: Token[]; grammar_points?: GrammarPoint[];
}
export interface Paragraph { id: string; sentences: Sentence[] }
export interface Story {
  schema_version: '1.0'; id: string; metadata: StoryMetadata;
  content: { paragraphs: Paragraph[] };
  targets: { vocabulary: { lemma: string; reading: string; meaning_es?: string }[]; grammar: GrammarPoint[] };
  generation: { generator: string; prompt_version: string; created_at: string; validated?: boolean };
  comprehension?: unknown;
}
export interface StoryProgress {
  story_id: string;
  last_opened: string;
  completed: boolean;
  last_sentence?: string;
  updated_at?: string;
}
export type ProgressMap = Record<string, StoryProgress>;
