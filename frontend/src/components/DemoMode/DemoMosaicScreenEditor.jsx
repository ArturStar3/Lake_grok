import { useEffect, useRef, useState } from 'react';
import { uploadDemoTableauMedia } from '../../api/demoScenarios';
import { DEMO_MOSAIC_CONTENT, DEMO_TEXT_FONTS, DEMO_TEXT_MAX_LENGTH } from '../../utils/demoScenario';
import { resolveMediaUrl } from '../../utils/mediaUrl';

export default function DemoMosaicScreenEditor({ screen, onChange, onBusyChange, readOnly }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef({ onChange, onBusyChange });
  current.current = { onChange, onBusyChange };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; current.current.onBusyChange?.(false); };
  }, []);
  const text = screen.text;
  const patchText = (partial) => onChange({ text: { ...text, ...partial } });
  const patchStyle = (partial) => patchText({ style: { ...text.style, ...partial } });
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readOnly || busy) return;
    setBusy(true);
    setError('');
    current.current.onBusyChange?.(true);
    try {
      const data = await uploadDemoTableauMedia(file);
      if (mounted.current) current.current.onChange({
        image_url: new URL(data.url, window.location.origin).pathname,
      });
    } catch (err) {
      if (mounted.current) setError(err.response?.data?.image?.[0] || err.response?.data?.detail || 'Не удалось загрузить фотографию.');
    } finally {
      if (mounted.current) {
        setBusy(false);
        current.current.onBusyChange?.(false);
      }
    }
  };
  return <>
    {screen.content_type === DEMO_MOSAIC_CONTENT.IMAGE && <fieldset className="demo-inspector__group" disabled={readOnly || busy}>
      <legend>Фотография</legend>
      <label className="demo-field">
        <span className="demo-field__label">Загрузить фотографию (PNG, JPEG, WebP)</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
      </label>
      {screen.image_url && <>
        <img className="demo-mosaic-studio-modal__image-preview" src={resolveMediaUrl(screen.image_url)} alt="Фотография экрана" />
        <button type="button" className="demo-btn demo-btn--ghost" onClick={() => onChange({ image_url: null })}>Убрать фотографию</button>
      </>}
      <label className="demo-field"><span className="demo-field__label">Отображение фотографии</span>
        <select value={screen.image_fit} onChange={(e) => onChange({ image_fit: e.target.value })}>
          <option value="contain">Целиком, без обрезки</option><option value="cover">Заполнить экран с обрезкой</option>
        </select>
      </label>
      {busy && <p role="status">Загрузка фотографии…</p>}
      {error && <p role="alert">{error}</p>}
    </fieldset>}
    <fieldset className="demo-inspector__group" disabled={readOnly}>
      <legend>Текст на экране</legend>
      <label className="demo-field"><span className="demo-field__label">Текст</span>
        <textarea rows={3} maxLength={DEMO_TEXT_MAX_LENGTH} value={text.content} onChange={(e) => patchText({ content: e.target.value })} />
      </label>
      <label className="demo-field"><span className="demo-field__label">Шрифт</span>
        <select value={text.style.font_family} onChange={(e) => patchStyle({ font_family: e.target.value })}>{DEMO_TEXT_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select>
      </label>
      <label className="demo-field"><span className="demo-field__label">Размер текста, px</span>
        <input type="number" min={8} max={200} value={text.style.font_size} onChange={(e) => patchStyle({ font_size: Number(e.target.value) })} />
      </label>
      <label className="demo-field"><span className="demo-field__label">Цвет текста</span>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(text.style.color) ? text.style.color : '#ffffff'} onChange={(e) => patchStyle({ color: e.target.value })} />
      </label>
      <label className="demo-field"><span className="demo-field__label">Выравнивание</span>
        <select value={text.style.text_align} onChange={(e) => patchStyle({ text_align: e.target.value })}>
          <option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option>
        </select>
      </label>
      {['x', 'y'].map((axis) => <label key={axis} className="demo-field"><span className="demo-field__label">Положение {axis.toUpperCase()}, %</span>
        <input type="number" min={0} max={100} value={Math.round(text.screen[axis] * 100)} onChange={(e) => patchText({ screen: { ...text.screen, [axis]: Number(e.target.value) / 100 } })} />
      </label>)}
      <label className="demo-checkbox"><input type="checkbox" checked={text.style.background.enabled} onChange={(e) => patchStyle({ background: { ...text.style.background, enabled: e.target.checked } })} /><span>Подложка под текстом</span></label>
      <p className="demo-field__hint">Текст принадлежит этому экрану и остаётся на нём при разворачивании. Пустое поле скрывает текст.</p>
    </fieldset>
  </>;
}
