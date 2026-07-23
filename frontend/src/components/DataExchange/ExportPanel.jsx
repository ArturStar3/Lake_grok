import { useState } from 'react';
import CountriesMultiAutocomplete from '../common/CountriesMultiAutocomplete/CountriesMultiAutocomplete';
import { exportCountries } from '../../api/dataExchange';

export default function ExportPanel({ countries = [], busy, setBusy, error, setError }) {
  const [countryIds, setCountryIds] = useState([]);

  const handleExport = async () => {
    if (!countryIds.length) {
      setError('Выберите хотя бы одну страну');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await exportCountries(countryIds);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Не удалось сформировать бандл');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="data-exchange-panel">
      <p className="data-exchange-panel__hint">
        Выберите страны — в ZIP попадут их объекты, события, персоналии, техника, формуляр,
        досье и связанные справочники вместе с медиафайлами.
      </p>
      <div className="data-exchange-panel__field">
        <label className="data-exchange-panel__label">Страны</label>
        <CountriesMultiAutocomplete
          countries={countries}
          value={countryIds}
          onChange={setCountryIds}
          placeholder="Поиск страны…"
          disabled={busy}
        />
      </div>
      {error && <p className="data-exchange-panel__error">{error}</p>}
      <div className="data-exchange-panel__actions">
        <button
          type="button"
          className="data-exchange-btn data-exchange-btn--primary"
          onClick={handleExport}
          disabled={busy || countryIds.length === 0}
        >
          {busy ? 'Формирование…' : 'Скачать бандл'}
        </button>
      </div>
    </div>
  );
}
