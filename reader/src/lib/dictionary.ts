import { createWebDictionaryService } from './webDictionary';
export * from './dictionaryModel';

// A native SQLite provider can replace the web implementation without changing
// story files or the vocabulary UI.
export const dictionaryService = createWebDictionaryService();
