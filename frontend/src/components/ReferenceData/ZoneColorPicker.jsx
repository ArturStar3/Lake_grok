import { normalizeHexColor, ZONE_COLOR_PALETTE } from '../../utils/actionZoneStyle';

export default function ZoneColorPicker({
  value,
  onChange,
  fallback = '#3388ff',
  disabled = false,
}) {
  const normalized = normalizeHexColor(value, fallback);

  return (
    <div className="zone-color-picker">
      <input
        type="color"
        className="zone-color-picker__input"
        value={normalized}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label="Выбор цвета"
      />
      <div className="zone-color-picker__palette" role="listbox" aria-label="Палитра цветов">
        {ZONE_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            role="option"
            aria-selected={normalized === color}
            className={`zone-color-picker__swatch${
              normalized === color ? ' zone-color-picker__swatch--active' : ''
            }`}
            style={{ backgroundColor: color }}
            disabled={disabled}
            onClick={() => onChange?.(color)}
            aria-label={`Цвет ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
