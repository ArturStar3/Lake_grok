const FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
];

export default function FormatToggle({
  value = 'pdf',
  onChange,
  disabled = false,
  name = 'report-export-format',
  compact = false,
}) {
  return (
    <div
      className={`report-format-toggle${compact ? ' report-format-toggle--compact' : ''}`}
      role="radiogroup"
      aria-label="Формат файла"
    >
      {FORMATS.map((item) => (
        <label
          key={item.value}
          className={`report-format-toggle__option${value === item.value ? ' report-format-toggle__option--active' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={item.value}
            checked={value === item.value}
            disabled={disabled}
            onChange={() => onChange?.(item.value)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}
