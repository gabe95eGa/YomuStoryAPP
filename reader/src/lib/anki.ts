import { normalizeJapanese, preferredSenses, type DictionaryService } from './dictionaryModel';
import type { LearnerVocabularyItem } from './vocabulary';
import type { Language } from './i18n';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const field = (value: string) => `"${value.replace(/"/g, '""')}"`;
export interface AnkiExport { text: string; count: number; missing: number; fallback: number }
export async function buildAnkiExport(items: LearnerVocabularyItem[], dictionary: DictionaryService, language: Language, signal?: AbortSignal): Promise<AnkiExport> {
  const notes = new Map<string, { front: string; meanings: Set<string>; statuses: Set<string> }>();
  let missing = 0, fallback = 0;
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    signal?.throwIfAborted();
    const key = JSON.stringify([normalizeJapanese(item.lemma), normalizeJapanese(item.reading)]);
    const note = notes.get(key) ?? { front: `${escapeHtml(item.lemma)}【${escapeHtml(normalizeJapanese(item.reading))}】`, meanings: new Set<string>(), statuses: new Set<string>() };
    note.statuses.add(`yomustory::${item.status}`);
    const results = await dictionary.lookup({ lemma: item.lemma, reading: item.reading }, signal);
    signal?.throwIfAborted();
    const candidates = results.filter((entry) => item.dictionaryEntryId ? entry.id === item.dictionaryEntryId
      : normalizeJapanese(entry.headword) === normalizeJapanese(item.lemma)
        && entry.readings.some((reading) => normalizeJapanese(reading) === normalizeJapanese(item.reading)));
    // A saved dictionary ID is authoritative. Token-only identities must resolve
    // unambiguously; never export an unrelated top-ranked homograph as its meaning.
    const entry = candidates.length === 1 ? candidates[0] : undefined;
    if (entry) {
      const preferred = preferredSenses(entry, language);
      if (preferred.language !== language) fallback++;
      const glosses = preferred.senses.flatMap((sense) => sense.glosses.filter((gloss) => gloss.language === preferred.language).map((gloss) => gloss.text));
      if (glosses.length) note.meanings.add(`<span lang="${preferred.language}">${escapeHtml(glosses.join('; '))}</span>`);
      else missing++;
    } else missing++;
    notes.set(key, note);
  }
  const label = language === 'en' ? 'Dictionary meanings' : 'Significados del diccionario';
  const unresolved = language === 'en' ? 'No unambiguous definition available. Review this card.' : 'Sin definición inequívoca. Revisa esta tarjeta.';
  const rows = [...notes.values()].map((note) => [note.front,
    `<b>${label}</b><br>${[...note.meanings].join('<br>') || unresolved}<br><small>JMdict: James William Breen / EDRDG; JSON: scriptin/jmdict-simplified. ES: HISPADIC / Francisco Barberan (RUI). Selected glosses formatted by YomuStory. <a href="https://www.edrdg.org/edrdg/licence.html">EDRDG</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></small>`,
    ['yomustory', ...[...note.statuses].sort()].join(' ')].map(field).join('\t'));
  return { text: ['#separator:Tab', '#html:true', '#tags column:3', '#columns:Front\tBack\tTags', ...rows, ''].join('\n'), count: notes.size, missing, fallback };
}
export function downloadAnki(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `yomustory-anki-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
