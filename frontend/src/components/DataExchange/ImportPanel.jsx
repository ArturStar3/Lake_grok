import { useState } from 'react';
import {
  cancelImportSession,
  createImportSession,
  resolveImportSession,
} from '../../api/dataExchange';
import ImportConflictsList from './ImportConflictsList';

export default function ImportPanel({ canWrite, busy, setBusy, error, setError }) {
  const [file, setFile] = useState(null);
  const [session, setSession] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!file) {
      setError('Выберите ZIP-файл бандла');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await createImportSession(file);
      setSession(data);
      const initial = {};
      (data.conflicts || []).forEach((item) => {
        initial[item.id] = 'keep_local';
      });
      setDecisions(initial);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err?.message || 'Не удалось проанализировать бандл');
      setSession(null);
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!session?.id) return;
    setBusy(true);
    setError('');
    try {
      const data = await resolveImportSession(session.id, decisions);
      setResult(data);
      setSession(data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || err?.message || 'Не удалось применить импорт');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!session?.id) {
      setSession(null);
      setFile(null);
      return;
    }
    setBusy(true);
    try {
      await cancelImportSession(session.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSession(null);
      setFile(null);
      setDecisions({});
      setResult(null);
      setBusy(false);
    }
  };

  const summary = session?.summary || {};

  return (
    <div className="data-exchange-panel">
      <p className="data-exchange-panel__hint">
        Загрузите ZIP-бандл, полученный экспортом с другого контура. Сначала выполняется анализ:
        новые записи, без изменений и конфликты. Конфликты решаются вручную перед применением.
      </p>

      {!session && (
        <>
          <div className="data-exchange-panel__field">
            <label className="data-exchange-panel__label">Файл бандла (.zip)</label>
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={busy || !canWrite}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          {error && <p className="data-exchange-panel__error">{error}</p>}
          <div className="data-exchange-panel__actions">
            <button
              type="button"
              className="data-exchange-btn data-exchange-btn--primary"
              onClick={handleAnalyze}
              disabled={busy || !file || !canWrite}
            >
              {busy ? 'Анализ…' : 'Анализировать'}
            </button>
          </div>
          {!canWrite && (
            <p className="data-exchange-panel__hint">Для импорта нужны права на запись модуля.</p>
          )}
        </>
      )}

      {session && session.status !== 'applied' && (
        <>
          <div className="data-exchange-summary">
            <span>Новых: <strong>{summary.new || 0}</strong></span>
            <span>Без изменений: <strong>{summary.unchanged || 0}</strong></span>
            <span>Конфликтов: <strong>{summary.conflict || 0}</strong></span>
            <span>Неоднозначных: <strong>{summary.ambiguous || 0}</strong></span>
          </div>
          {error && <p className="data-exchange-panel__error">{error}</p>}
          <ImportConflictsList
            conflicts={session.conflicts || []}
            decisions={decisions}
            onDecisionChange={(id, value) => setDecisions((prev) => ({ ...prev, [id]: value }))}
            onSetAllDecisions={(value) => {
              const next = {};
              (session.conflicts || []).forEach((item) => {
                next[item.id] = value;
              });
              setDecisions(next);
            }}
            busy={busy}
          />
          <div className="data-exchange-panel__actions">
            <button
              type="button"
              className="data-exchange-btn"
              onClick={handleCancel}
              disabled={busy}
            >
              Отменить
            </button>
            <button
              type="button"
              className="data-exchange-btn data-exchange-btn--primary"
              onClick={handleResolve}
              disabled={busy || !canWrite}
            >
              {busy ? 'Применение…' : 'Применить импорт'}
            </button>
          </div>
        </>
      )}

      {session?.status === 'applied' && (
        <div className="data-exchange-panel">
          <p className="data-exchange-panel__success">
            Импорт применён. Применено записей: {result?.apply_summary?.applied ?? summary.applied ?? '—'},
            пропущено: {result?.apply_summary?.skipped ?? summary.skipped ?? '—'}.
          </p>
          <div className="data-exchange-panel__actions">
            <button
              type="button"
              className="data-exchange-btn data-exchange-btn--primary"
              onClick={() => {
                setSession(null);
                setFile(null);
                setDecisions({});
                setResult(null);
              }}
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
