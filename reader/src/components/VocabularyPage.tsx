import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { downloadJson, MAX_BACKUP_BYTES, parseBackupText, readBackupFile, type BackupService, type LearnerBackup } from '../lib/backup';
import { normalizeJapanese } from '../lib/dictionaryModel';
import type { ImportMode } from '../lib/vocabulary';
import { LearnerContext, VocabularyControls } from './LearnerState';
import type { LearnerContextService } from '../lib/learnerContext';

function Confirmation({ title, description, action, onConfirm, onCancel, busy }: {
  title: string; description: string; action: string; onConfirm: () => void; onCancel: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!; element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="data-confirmation" role="alertdialog" aria-label={title}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h3>{title}</h3><p>{description}</p>
    <button type="button" className="primary-button" disabled={busy} onClick={onConfirm}>{busy ? 'Guardando…' : action}</button>
    <button type="button" className="text-button" disabled={busy} onClick={onCancel}>Cancelar</button>
  </dialog>;
}
export function VocabularyPage({ backup, generationContext, usesExampleProfile }: {
  backup: BackupService; generationContext: LearnerContextService; usesExampleProfile?: boolean;
}) {
  const learner = useContext(LearnerContext)!;
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<LearnerBackup>();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirmation, setConfirmation] = useState<'replace' | 'clear'>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const fileGeneration = useRef(0);
  const filtered = useMemo(() => {
    const query = normalizeJapanese(search);
    return learner.items.filter((item) => (filter === 'all' || item.status === filter)
      && (!query || normalizeJapanese(item.lemma).includes(query) || normalizeJapanese(item.reading).includes(query)))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
  }, [learner.items, filter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages - 1);
  const learning = learner.items.filter((item) => item.status === 'learning').length;
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); setConfirmation(undefined); }
  }
  async function chooseFile(file?: File) {
    const generation = ++fileGeneration.current;
    setPending(undefined); setConfirmation(undefined); setMessage(''); setError('');
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('La copia supera el límite de 25 MiB.');
      const parsed = parseBackupText(await readBackupFile(file));
      if (generation === fileGeneration.current) { setPending(parsed); setMode('merge'); }
    } catch (reason) { if (generation === fileGeneration.current) setError(reason instanceof Error ? reason.message : 'No se pudo leer el archivo.'); }
  }
  const importPending = () => void run(async () => { await backup.importBackup(pending!, mode); setPending(undefined); }, 'Copia importada. Tus datos ya están disponibles.');
  return <main className="vocabulary-page library" id="main-content" tabIndex={-1}>
    <header className="vocabulary-intro"><p className="eyebrow">Tu aprendizaje</p><h1>Vocabulario</h1>
      <p>Aprendiendo: {learning} · Conocidas: {learner.items.length - learning}</p></header>
    {learner.error && <p role="alert">{learner.error}</p>}
    <div className="vocabulary-filters">
      <label>Estado<select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }}>
        <option value="all">Todas</option><option value="learning">Aprendiendo</option><option value="known">Conocidas</option></select></label>
      <label>Buscar vocabulario<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Palabra o lectura" /></label>
    </div>
    <p className="vocabulary-total">{filtered.length} {filtered.length === 1 ? 'palabra' : 'palabras'} · Página {currentPage + 1} de {totalPages}</p>
    <div className="vocabulary-list">{filtered.slice(currentPage * 50, currentPage * 50 + 50).map((item) => <article key={item.id}>
      <div><h2 lang="ja">{item.lemma}</h2><p lang="ja">{item.reading}</p>
        <small>Actualizada: {new Date(item.updatedAt).toLocaleDateString('es')}</small>
        {!item.dictionaryEntryId && <small> · Identidad de la lectura</small>}</div>
      <VocabularyControls identity={item} />
    </article>)}</div>
    {!filtered.length && <p className="empty-state">{learner.items.length ? 'No hay palabras para este filtro.' : 'Marca palabras desde una lectura para empezar tu vocabulario.'}</p>}
    {totalPages > 1 && <nav className="vocabulary-pagination" aria-label="Páginas de vocabulario">
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
      <button type="button" disabled={currentPage + 1 === totalPages} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
    </nav>}
    <section className="backup-section" aria-labelledby="backup-title"><h2 id="backup-title">Copias de seguridad</h2>
      <p>Guarda tu vocabulario, progreso y preferencias en un archivo. Tus datos se quedan en este navegador hasta que tú exportes una copia.</p>
      <div className="backup-actions">
        <button type="button" disabled={busy || Boolean(learner.error)} onClick={() => void run(async () => {
          const data = await backup.exportBackup(); downloadJson(data, `yomustory-backup-${data.exported_at.slice(0, 10)}.json`);
        }, 'Copia exportada. Guarda el archivo en un lugar seguro.')}>Exportar copia</button>
        <button type="button" disabled={busy || Boolean(learner.error)} onClick={() => fileInput.current?.click()}>Importar copia</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Archivo de copia de seguridad" hidden disabled={busy}
        onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
      {pending && <div className="import-preview"><h3>Copia validada</h3>
        <p>{pending.vocabulary.length} {pending.vocabulary.length === 1 ? 'palabra' : 'palabras'} · {pending.reading_progress.length} {pending.reading_progress.length === 1 ? 'lectura' : 'lecturas'} · Exportada: {new Date(pending.exported_at).toLocaleString('es')}</p>
        <label>Cómo importar<select value={mode} disabled={busy} onChange={(event) => { setMode(event.target.value as ImportMode); setConfirmation(undefined); }}>
          <option value="merge">Combinar con mis datos</option><option value="replace">Reemplazar mis datos</option></select></label>
        <p>{mode === 'merge' ? 'Se conserva el registro más reciente. En un empate, se conservan tus datos actuales.' : 'Reemplaza vocabulario, progreso y preferencias. El diccionario y las historias se conservan.'}</p>
        <button type="button" className="primary-button" disabled={busy} onClick={() => mode === 'replace' ? setConfirmation('replace') : importPending()}>Aplicar importación</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => { setPending(undefined); setConfirmation(undefined); }}>Cancelar importación</button>
      </div>}
      {confirmation === 'replace' && <Confirmation title="¿Reemplazar tus datos?" description="Se sustituirán tu vocabulario, progreso y preferencias por los de esta copia. Exporta primero si quieres conservar tus datos actuales."
        action="Confirmar reemplazo" busy={busy} onConfirm={importPending} onCancel={() => setConfirmation(undefined)} />}
      <div className="vocabulary-deletion"><button type="button" disabled={busy || Boolean(learner.error) || learner.items.length === 0} onClick={() => setConfirmation('clear')}>Vaciar vocabulario</button></div>
      {confirmation === 'clear' && <Confirmation title="¿Vaciar tu vocabulario?" description="Se quitarán todas las clasificaciones. Tu progreso, preferencias, diccionario e historias se conservan."
        action="Confirmar vaciado" busy={busy} onConfirm={() => void run(() => learner.service.clear(), 'Vocabulario vaciado.')} onCancel={() => setConfirmation(undefined)} />}
    </section>
    <section className="backup-section context-section" aria-labelledby="context-title"><h2 id="context-title">Contexto para nuevas lecturas</h2>
      <p>Comparte tu nivel y vocabulario con un generador de historias. Este archivo sirve para crear lecturas; para restaurar tus datos, utiliza una copia de seguridad.</p>
      <p>Nivel: {generationContext.configuration.language.current_level} → {generationContext.configuration.language.target_level}
        {usesExampleProfile && ' · Perfil de ejemplo'}<br />Conocidas: {learner.items.length - learning} · Aprendiendo: {learning}</p>
      <div className="backup-actions"><button type="button" disabled={busy || Boolean(learner.error)} onClick={() => void run(async () => {
        const data = await generationContext.buildContext();
        downloadJson(data, `yomustory-learner-context-${data.generated_at.slice(0, 10)}.json`);
      }, 'Contexto de aprendizaje exportado para generar lecturas.')}>Exportar contexto de aprendizaje</button></div>
    </section>
    {busy && <p role="status">Preparando tus datos…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </main>;
}
