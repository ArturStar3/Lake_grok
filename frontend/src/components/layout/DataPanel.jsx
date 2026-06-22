/**
 * Правая плавающая панель данных (Figma Group 15, 460px).
 * Скрывается сдвигом вправо; вкладка на краю экрана открывает снова.
 */
export default function DataPanel({
  title,
  subtitle,
  children,
  toolbar,
  footer,
  open = true,
  onOpenChange,
  toolsActive = false,
}) {
  return (
    <>
      <aside
        className={`gis-data-panel${toolsActive ? " gis-data-panel--tools" : ""}${open ? "" : " gis-data-panel--collapsed"}`}
        aria-label={title || "Панель данных"}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="gis-data-panel__edge-collapse"
          onClick={() => onOpenChange?.(false)}
          aria-label="Скрыть панель данных"
          title="Скрыть панель"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <header className="gis-data-panel__header">
          <div className="gis-data-panel__heading">
            <h2 className="gis-data-panel__title">{title}</h2>
            {subtitle && <p className="gis-data-panel__subtitle">{subtitle}</p>}
          </div>
          <div className="gis-data-panel__header-actions">
            {toolbar}
            <button
              type="button"
              className="gis-data-panel__close"
              onClick={() => onOpenChange?.(false)}
              aria-label="Скрыть панель"
              title="Скрыть панель"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>
        <div className="gis-data-panel__body">{children}</div>
        {footer && <footer className="gis-data-panel__footer">{footer}</footer>}
      </aside>

      <button
        type="button"
        className={`gis-data-panel__toggle${open ? " gis-data-panel__toggle--hidden" : ""}`}
        onClick={() => onOpenChange?.(true)}
        aria-label="Показать панель данных"
        title="Панель данных"
      >
        <svg width="16" height="16" aria-hidden="true">
          <use href="/sprite.svg#arrows-angle-expand" />
        </svg>
        <span className="gis-data-panel__toggle-label">{title || "Данные"}</span>
      </button>
    </>
  );
}
