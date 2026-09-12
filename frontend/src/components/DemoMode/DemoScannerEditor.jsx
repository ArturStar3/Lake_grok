import { useEffect, useRef, useState } from 'react';
import { importDemoScannerDocument, uploadDemoTableauMedia } from '../../api/demoScenarios';
import { normalizeScanner, SCANNER_EFFECTS, scannerDurationMs } from '../../utils/demoScanner';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './DemoScanner.css';

export default function DemoScannerEditor({ value, onChange, readOnly }) {
  const config = normalizeScanner(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentRef = useRef(config);
  currentRef.current = config;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const patch = (update) => onChangeRef.current({ ...currentRef.current, ...update });
  const upload = async (event, kind) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || readOnly) return;
    setBusy(true);
    setError('');
    try {
      if (kind === 'document') {
        const document = await importDemoScannerDocument(files[0]);
        if (mounted.current) patch({ document });
      } else {
        if (files.length + config.images.length > 40) throw new Error('В очереди может быть не более 40 изображений.');
        for (const file of files) {
          const data = await uploadDemoTableauMedia(file);
          if (!mounted.current) break;
          const src = new URL(data.url, window.location.origin).pathname;
          const images = [...currentRef.current.images, { src, title: file.name }];
          currentRef.current = { ...currentRef.current, images };
          patch({ images });
        }
      }
    } catch (err) {
      if (mounted.current) setError(err.response?.data?.file?.[0] || err.response?.data?.detail || err.message || 'Ошибка загрузки.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const move = (index, delta) => {
    const images = [...config.images];
    [images[index], images[index + delta]] = [images[index + delta], images[index]];
    patch({ images });
  };
  return <fieldset className="demo-scanner-editor" disabled={readOnly || busy}>
    <legend>Сканирование документов</legend>
    <label>Изображения очереди (до 40)<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event, 'images')} /></label>
    <ol>{config.images.map((image, index) => <li key={image.id}>
      <img src={resolveMediaUrl(image.src)} alt="" /><span title={image.title}>{image.title}</span>
      <button type="button" title="Выше" aria-label={`Поднять ${image.title}`} disabled={!index} onClick={() => move(index, -1)}>↑</button>
      <button type="button" title="Ниже" aria-label={`Опустить ${image.title}`} disabled={index === config.images.length - 1} onClick={() => move(index, 1)}>↓</button>
      <button type="button" title="Убрать из очереди" aria-label={`Убрать ${image.title}`} onClick={() => patch({ images: config.images.filter((_, i) => i !== index) })}>×</button>
    </li>)}</ol>
    <label>Текст из DOCX (до 10 МБ)<input type="file" accept=".docx" onChange={(event) => upload(event, 'document')} /></label>
    <span>{config.document.name || 'Документ не загружен'}</span>
    <p className="demo-tableau-studio-modal__hint">Сохраняются абзацы, основные стили текста и таблицы. Верстка страниц Word, колонтитулы, рисунки и сложная нумерация не воспроизводятся. Шрифты берутся с устройства. Длинный лист прокручивается автоматически.</p>
    <label>Появление текста<select value={config.effect} onChange={(e) => patch({ effect: e.target.value })}>{SCANNER_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label>
    <label>Шапка слева<input type="text" maxLength={120} value={config.header_left} onChange={(e) => patch({ header_left: e.target.value })} /></label>
    <label>Шапка справа<input type="text" maxLength={120} value={config.header_right} onChange={(e) => patch({ header_right: e.target.value })} /></label>
    <label>Метаданные листа<input type="text" maxLength={200} value={config.paper_meta} onChange={(e) => patch({ paper_meta: e.target.value })} /></label>
    <p className="demo-tableau-studio-modal__hint">Используйте <code>{'{status}'}</code> для текущего статуса обработки и <code>{'{document}'}</code> для имени DOCX.</p>
    {[['scan_min_ms', 'Минимум на один проход, мс', 500, 15000], ['scan_max_ms', 'Максимум на один проход, мс', 500, 15000], ['characters_per_second', 'Символов в секунду', 10, 500]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={config[key]} onChange={(e) => patch({ [key]: Number(e.target.value) })} /></label>)}
    <p className="demo-tableau-studio-modal__hint">Для показа целиком оставьте автоматическую длительность такта (до {Math.ceil(scannerDurationMs(config) / 1000)} с). Каждый перенос открывает следующую порцию текста.</p>
    {busy && <p role="status">Загрузка…</p>}
    {error && <p className="demo-scanner-editor__error" role="alert">{error}</p>}
  </fieldset>;
}
