import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { dictionaryService } from '../lib/dictionary';
import type { DictionaryService } from '../lib/dictionaryModel';
import type { LearnerVocabularyItem } from '../lib/vocabulary';
import { buildAnkiExport, downloadAnki, type AnkiExport as ExportData } from '../lib/anki';

export function AnkiExport({ items, unavailable, dictionary = dictionaryService }: { items: LearnerVocabularyItem[]; unavailable?: boolean; dictionary?: DictionaryService }) {
  const { t, language } = useI18n();
  const [scope, setScope] = useState('learning');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportData>();
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { request.current?.abort(); setBusy(false); setResult(undefined); setError(false); }, [items, scope, language]);
  useEffect(() => () => request.current?.abort(), []);
  const selected = items.filter((item) => scope === 'all' || item.status === scope);
  async function prepare() {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(false); setResult(undefined);
    try { const data = await buildAnkiExport(selected, dictionary, language, controller.signal); if (!controller.signal.aborted) setResult(data); }
    catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="backup-section anki-section" aria-labelledby="anki-title"><h2 id="anki-title">{t('Llévalo a Anki')}</h2>
    <p>{t('Repasa tus palabras fuera del lector. Exporta tarjetas con palabra, lectura y significados del diccionario en el idioma seleccionado, cuando estén disponibles.')}</p>
    <label>{t('Palabras para Anki')}<select value={scope} disabled={busy} onChange={(event) => setScope(event.target.value)}>
      <option value="learning">{t('Aprendiendo')}</option><option value="known">{t('Conocidas')}</option><option value="all">{t('Todas')}</option></select></label>
    <p>{selected.length} {selected.length === 1 ? t('palabra') : t('palabras')}</p>
    <button type="button" disabled={busy || unavailable || selected.length === 0} onClick={() => void prepare()}>{t('Preparar tarjetas')}</button>
    {busy && <div role="status"><p>{t('Preparando tarjetas con el diccionario…')}</p><button type="button" onClick={() => { request.current?.abort(); setBusy(false); }}>{t('Cancelar')}</button></div>}
    {error && <p role="alert">{t('No se pudieron preparar las tarjetas. Comprueba el diccionario e inténtalo de nuevo.')}</p>}
    {result && <div className="anki-preview" role="status"><p>{t('Tarjetas preparadas: ')}{result.count}<br />{t('Registros sin definición inequívoca: ')}{result.missing}<br />{t('Definiciones en otro idioma: ')}{result.fallback}</p>
      <button type="button" className="primary-button" onClick={() => downloadAnki(result.text)}>{t('Descargar para Anki')}</button></div>}
    <details><summary>{t('Cómo importarlo en Anki')}</summary><ol>
      <li>{t('En Anki de escritorio, elige Archivo → Importar y selecciona el archivo descargado.')}</li>
      <li>{t('Elige un mazo y el tipo de nota Básico, con dos campos: anverso y reverso. Comprueba la vista previa: Front → Anverso, Back → Reverso y Tags → Etiquetas; separador Tab y HTML activado.')}</li>
      <li>{t('Revisa las definiciones antes de estudiar. Al volver a importar, elige actualizar o ignorar duplicados según prefieras.')}</li>
    </ol><p>{t('Se combinan las palabras con la misma escritura y lectura. La exportación no cambia tus estados ni sincroniza el progreso con Anki.')}</p>
      <a href="https://docs.ankiweb.net/importing/text-files.html" target="_blank" rel="noopener noreferrer">{t('Guía oficial de Anki')}</a></details>
  </section>;
}
