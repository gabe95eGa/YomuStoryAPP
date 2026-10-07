import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import profileSchema from '../../../profiles/learner-profile.schema.json';
import exampleProfile from '../../../profiles/learner-profile.example.json';
import contextSchema from '../../../schema/yomustory-learner-context-v1.schema.json';
import { vocabularyContextWords, type LearnerVocabularyItem, type VocabularyStateService } from './vocabulary';

type Grammar = { pattern: string; notes?: string };
type Level = 'N5' | 'N5-N4' | 'N4' | 'N4-N3' | 'N3' | 'N3-N2' | 'N2' | 'N2-N1' | 'N1';
interface GenerationPreferences {
  default_story_length?: 'short' | 'standard' | 'long'; desired_difficulty?: number;
  maximum_new_vocabulary?: number; desired_grammar_target_count?: number; preferred_familiar_vocabulary_proportion?: number;
}
export interface GenerationConfiguration {
  language: { native_language: string; target_language: 'ja'; current_level: Level; target_level: Level };
  known_grammar: Grammar[]; learning_grammar: Grammar[];
  preferences: { interests: string[]; preferred_topics: string[]; avoid_topics: string[]; generation_preferences: GenerationPreferences };
}
export interface LearnerGenerationContext extends GenerationConfiguration, ReturnType<typeof vocabularyContextWords> {
  context_version: '1.0'; generated_at: string;
}
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const checkProfile = ajv.compile(profileSchema);
const checkContext = ajv.compile<LearnerGenerationContext>(contextSchema);

// Project the existing profile format, never copy its example vocabulary or
// arbitrary extensions. A future profile settings adapter can supply this input.
export function configurationFromProfile(value: unknown): GenerationConfiguration {
  if (!checkProfile(value)) throw new Error('El perfil de generación no es válido.');
  const profile = value as typeof exampleProfile;
  const preferences = Object.fromEntries(Object.keys(profileSchema.properties.generation_preferences.properties)
    .filter((key) => Object.hasOwn(profile.generation_preferences, key))
    .map((key) => [key, profile.generation_preferences[key as keyof typeof profile.generation_preferences]]));
  const grammar = (items: Grammar[]) => items.map(({ pattern, notes }) => ({ pattern, ...(notes ? { notes } : {}) }));
  return structuredClone({ language: { native_language: profile.native_language, target_language: 'ja',
    current_level: profile.current_level as Level, target_level: profile.target_level as Level },
    known_grammar: grammar(profile.known_grammar), learning_grammar: grammar(profile.learning_grammar),
    preferences: { interests: profile.interests, preferred_topics: profile.preferred_topics,
      avoid_topics: profile.avoid_topics, generation_preferences: preferences } });
}
export function parseLearnerContext(value: unknown): LearnerGenerationContext {
  if (!checkContext(value)) throw new Error('El contexto de aprendizaje no es válido.');
  return structuredClone(value);
}
// Vocabulary selection is isolated for later bounded/subset policies. V1 always
// exports the complete committed snapshot, with deterministic vocabulary order.
export function buildLearnerContext(configuration: GenerationConfiguration, items: LearnerVocabularyItem[], generatedAt: string): LearnerGenerationContext {
  return parseLearnerContext({ context_version: '1.0', generated_at: generatedAt, ...configuration, ...vocabularyContextWords(items) });
}
export interface LearnerContextService {
  readonly configuration: GenerationConfiguration;
  buildContext(): Promise<LearnerGenerationContext>;
  exportContext(): Promise<string>;
}
export function createLearnerContextService(vocabulary: Pick<VocabularyStateService, 'getAll'>, profile: unknown = exampleProfile,
  now: () => string = () => new Date().toISOString()): LearnerContextService {
  const configuration = configurationFromProfile(profile);
  const buildContext = async () => buildLearnerContext(configuration, await vocabulary.getAll(), now());
  return { get configuration() { return structuredClone(configuration); }, buildContext,
    async exportContext() { return JSON.stringify(await buildContext(), null, 2) + '\n'; } };
}
