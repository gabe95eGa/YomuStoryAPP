import { useI18n } from '../lib/i18n';
import { formatPartOfSpeech, preferredSenses, type DictionaryResult, type DictionarySense } from '../lib/dictionaryModel';
import { identityForEntry } from '../lib/vocabulary';
import { VocabularyControls } from './LearnerState';

function Sense({ sense, language }: { sense: DictionarySense; language: 'es' | 'en' }) {
  const { language: interfaceLanguage } = useI18n();
  const glosses = sense.glosses.filter((gloss) => gloss.language === language);
  return <div className="dictionary-sense">
    <p lang={language} className="dictionary-gloss">{glosses.map((gloss) => gloss.text).join('; ')}</p>
    {sense.partsOfSpeech.length > 0 && <p className="dictionary-pos">{sense.partsOfSpeech.map((pos) => interfaceLanguage === 'en' ? pos : formatPartOfSpeech(pos)).join(' · ')}</p>}
    {[...sense.fields, ...sense.misc, ...sense.dialects, ...sense.notes].length > 0
      && <p className="sense-notes">{[...sense.fields, ...sense.misc, ...sense.dialects, ...sense.notes].join(' · ')}</p>}
  </div>;
}

export function DictionaryDefinition({ entry }: { entry: DictionaryResult }) {
  const { t, language: interfaceLanguage } = useI18n();
  const { language, senses } = preferredSenses(entry, interfaceLanguage);
  const secondaryLanguage = language === 'es' ? 'en' : 'es';
  const secondary = entry.senses.filter((sense) => sense.glosses.some((gloss) => gloss.language === secondaryLanguage));
  return <section className="dictionary-entry" aria-label={t(`Entrada: ${entry.headword}`)}>
    <h3 lang="ja">{entry.headword}</h3><p lang="ja" className="dictionary-reading">{entry.readings.join(' · ')}</p>
    <div className="dictionary-labels">
      <span>{language === interfaceLanguage ? t(language === 'es' ? 'Español' : 'Inglés') : t(language === 'es' ? 'Español · sin definición en inglés' : 'Inglés · sin definición en español')}</span>
      {entry.common && <span>{t("Palabra común")}</span>}
      {entry.matchedBy === 'reading' && <span>{t("Coincidencia por lectura")}</span>}
    </div>
    {entry.formLabels.length > 0 && <p className="sense-notes">{entry.formLabels.join(' · ')}</p>}
    <Sense sense={senses[0]} language={language} />
    <VocabularyControls identity={identityForEntry(entry)} />
    {Boolean(entry.otherReadings?.length) && <details className="dictionary-details"><summary>{t("Otras lecturas de esta escritura")}</summary>
      <p lang="ja" className="dictionary-reading">{entry.otherReadings!.join(' · ')}</p>
      <p className="dictionary-note">{t("Lecturas registradas en JMdict. Pueden corresponder a otros sentidos; no sustituyen la lectura de esta frase.")}</p>
    </details>}
    {senses.length > 1 && <details className="dictionary-details"><summary>{t('Otros sentidos')} ({senses.length - 1})</summary>
      {senses.slice(1).map((sense, index) => <Sense key={index} sense={sense} language={language} />)}</details>}
    {secondary.length > 0 && <details className="dictionary-details"><summary>{t(secondaryLanguage === 'en' ? 'Consultar también en inglés' : 'Consultar también en español')}</summary>
      {secondary.map((sense, index) => <Sense key={index} sense={sense} language={secondaryLanguage} />)}</details>}
  </section>;
}
