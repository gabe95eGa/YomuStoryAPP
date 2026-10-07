import { formatPartOfSpeech, preferredSenses, type DictionaryResult, type DictionarySense } from '../lib/dictionaryModel';
import { identityForEntry } from '../lib/vocabulary';
import { VocabularyControls } from './LearnerState';

function Sense({ sense, language }: { sense: DictionarySense; language: 'es' | 'en' }) {
  const glosses = sense.glosses.filter((gloss) => gloss.language === language);
  return <div className="dictionary-sense">
    <p lang={language} className="dictionary-gloss">{glosses.map((gloss) => gloss.text).join('; ')}</p>
    {sense.partsOfSpeech.length > 0 && <p className="dictionary-pos">{sense.partsOfSpeech.map(formatPartOfSpeech).join(' · ')}</p>}
    {[...sense.fields, ...sense.misc, ...sense.dialects, ...sense.notes].length > 0
      && <p className="sense-notes">{[...sense.fields, ...sense.misc, ...sense.dialects, ...sense.notes].join(' · ')}</p>}
  </div>;
}

export function DictionaryDefinition({ entry }: { entry: DictionaryResult }) {
  const { language, senses } = preferredSenses(entry);
  const english = language === 'es' ? entry.senses.filter((sense) => sense.glosses.some((gloss) => gloss.language === 'en')) : [];
  return <section className="dictionary-entry" aria-label={`Entrada: ${entry.headword}`}>
    <h3 lang="ja">{entry.headword}</h3><p lang="ja" className="dictionary-reading">{entry.readings.join(' · ')}</p>
    <div className="dictionary-labels">
      <span>{language === 'es' ? 'Español' : 'Inglés · sin definición en español'}</span>
      {entry.common && <span>Palabra común</span>}
      {entry.matchedBy === 'reading' && <span>Coincidencia por lectura</span>}
    </div>
    {entry.formLabels.length > 0 && <p className="sense-notes">{entry.formLabels.join(' · ')}</p>}
    <Sense sense={senses[0]} language={language} />
    <VocabularyControls identity={identityForEntry(entry)} />
    {senses.length > 1 && <details className="dictionary-details"><summary>Otros sentidos ({senses.length - 1})</summary>
      {senses.slice(1).map((sense, index) => <Sense key={index} sense={sense} language={language} />)}</details>}
    {english.length > 0 && <details className="dictionary-details"><summary>Consultar también en inglés</summary>
      {english.map((sense, index) => <Sense key={index} sense={sense} language="en" />)}</details>}
  </section>;
}
