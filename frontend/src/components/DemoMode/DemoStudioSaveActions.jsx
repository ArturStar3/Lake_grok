import './DemoStudioModal.css';

/**
 * Кнопка сохранения сценария для шапок вложенных конструкторов.
 */
export default function DemoStudioSaveActions({
  canWrite = false,
  onSave,
  busy = false,
  notice = '',
  disabled = false,
}) {
  if (!canWrite || !onSave) return null;
  return (
    <>
      {notice ? (
        <span className="demo-studio-save__notice" title={notice}>{notice}</span>
      ) : null}
      <button
        type="button"
        className="demo-btn demo-btn--primary"
        onClick={onSave}
        disabled={busy || disabled}
      >
        {busy ? 'Сохранение…' : 'Сохранить'}
      </button>
    </>
  );
}
