import { useRef, useState } from 'react';
import { uploadDemoTableauMedia } from '../../api/demoScenarios';
import { normalizeTableauNetwork } from '../../utils/demoScenario';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './DemoNetwork.css';

const SLOT_COUNT = 3;

export default function DemoNetworkEditor({ value, onChange, readOnly }) {
  const network = normalizeTableauNetwork(value);
  const [busySlot, setBusySlot] = useState(null);
  const [error, setError] = useState('');
  const inputs = useRef([]);

  const patchLogos = (logos) => onChange({ ...network, logos: logos.slice(0, SLOT_COUNT) });
  const upload = async (event, index) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readOnly) return;
    setBusySlot(index);
    setError('');
    try {
      const data = await uploadDemoTableauMedia(file);
      const src = new URL(data.url, window.location.origin).pathname;
      const logos = [...network.logos];
      logos[index] = { ...logos[index], src, title: logos[index]?.title || file.name };
      patchLogos(logos);
    } catch (err) {
      setError(err.response?.data?.file?.[0] || err.response?.data?.detail || err.message || 'Ошибка загрузки логотипа.');
    } finally {
      setBusySlot(null);
    }
  };

  return <fieldset className="demo-network-editor" disabled={readOnly || busySlot !== null}>
    <legend>Загрузка логотипов</legend>
    <p className="demo-tableau-studio-modal__hint">Выберите три изображения: они будут показаны вершинами треугольника. В сценарии сохраняются ссылки на медиафайлы.</p>
    <div className="demo-network-editor__slots">
      {Array.from({ length: SLOT_COUNT }, (_, index) => {
        const logo = network.logos[index];
        return <section key={index} className="demo-network-editor__slot">
          <span>Логотип {index + 1}</span>
          <input ref={(node) => { inputs.current[index] = node; }} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => upload(event, index)} />
          {logo?.src ? <img src={resolveMediaUrl(logo.src)} alt={logo.title || `Логотип ${index + 1}`} /> : <div className="demo-network-editor__empty">Не выбран</div>}
          <button type="button" className="demo-btn demo-btn--ghost" onClick={() => inputs.current[index]?.click()}>{busySlot === index ? 'Загрузка…' : logo?.src ? 'Заменить файл' : 'Загрузить файл'}</button>
          {logo?.src ? <button type="button" className="demo-btn demo-btn--ghost" onClick={() => { const logos = [...network.logos]; logos[index] = { ...logos[index], src: '' }; patchLogos(logos); }}>Убрать</button> : null}
          <input type="text" value={logo?.title || ''} placeholder="Подпись (необязательно)" onChange={(event) => { const logos = [...network.logos]; logos[index] = { ...logo, title: event.target.value }; patchLogos(logos); }} />
        </section>;
      })}
    </div>
    {error ? <p className="demo-network-editor__error" role="alert">{error}</p> : null}
  </fieldset>;
}
