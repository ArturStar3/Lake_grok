import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { canReadModule, canWriteModule } from '../../utils/permissions';
import { API_URL } from '../../config/api';
import ExportPanel from './ExportPanel';
import ImportPanel from './ImportPanel';
import './DataExchangeModal.css';

export default function DataExchangeModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const canRead = canReadModule(user, 'data_exchange');
  const canWrite = canWriteModule(user, 'data_exchange');
  const [tab, setTab] = useState('export');
  const [countries, setCountries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTab('export');
    setExportError('');
    setImportError('');
    axios.get(`${API_URL}/api/v1/countries/`)
      .then((res) => setCountries(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error('Не удалось загрузить страны', err));
  }, [isOpen]);

  if (!isOpen || !canRead) return null;

  return (
    <div className="data-exchange-modal__overlay" onClick={onClose}>
      <div
        className="data-exchange-modal__content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-exchange-title"
      >
        <header className="data-exchange-modal__header">
          <div>
            <h2 id="data-exchange-title">Импорт / экспорт данных</h2>
            <p className="data-exchange-modal__subtitle">
              Перенос данных между независимыми контурами (ZIP с медиафайлами)
            </p>
          </div>
          <button type="button" className="data-exchange-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="data-exchange-modal__tabs">
          <button
            type="button"
            className={`data-exchange-modal__tab${tab === 'export' ? ' data-exchange-modal__tab--active' : ''}`}
            onClick={() => setTab('export')}
          >
            Экспорт
          </button>
          <button
            type="button"
            className={`data-exchange-modal__tab${tab === 'import' ? ' data-exchange-modal__tab--active' : ''}`}
            onClick={() => setTab('import')}
          >
            Импорт
          </button>
        </div>

        <div className="data-exchange-modal__body">
          {tab === 'export' ? (
            <ExportPanel
              countries={countries}
              busy={busy}
              setBusy={setBusy}
              error={exportError}
              setError={setExportError}
            />
          ) : (
            <ImportPanel
              canWrite={canWrite}
              busy={busy}
              setBusy={setBusy}
              error={importError}
              setError={setImportError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
