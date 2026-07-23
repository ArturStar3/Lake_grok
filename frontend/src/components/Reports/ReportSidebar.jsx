export default function ReportSidebar({
  templates = [],
  selectedId = null,
  search = '',
  onSearchChange,
  loading = false,
  error = '',
  canWrite = false,
  canDelete = false,
  busyId = null,
  onCreate,
  onSelect,
  onDelete,
}) {
  const needle = search.trim().toLowerCase();
  const filtered = !needle
    ? templates
    : templates.filter((tpl) => {
      const name = String(tpl.name || '').toLowerCase();
      const description = String(tpl.description || '').toLowerCase();
      return name.includes(needle) || description.includes(needle);
    });

  return (
    <aside className="report-sidebar">
      {canWrite && (
        <button
          type="button"
          className="report-btn report-btn--primary report-sidebar__create"
          onClick={onCreate}
        >
          Создать
        </button>
      )}

      <label className="report-sidebar__search-wrap">
        <span className="report-sidebar__search-label">Поиск шаблонов</span>
        <input
          type="search"
          className="report-filters__input report-sidebar__search"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Название или описание…"
        />
      </label>

      {loading && <p className="report-status">Загрузка…</p>}
      {error && <p className="report-status report-status--error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="report-status">
          {templates.length === 0 ? 'Шаблонов пока нет.' : 'Ничего не найдено.'}
        </p>
      )}

      <ul className="report-sidebar__list" role="listbox" aria-label="Шаблоны отчётов">
        {filtered.map((tpl) => {
          const active = selectedId === tpl.id;
          return (
            <li key={tpl.id}>
              <div
                className={`report-sidebar__item${active ? ' report-sidebar__item--active' : ''}`}
              >
                <button
                  type="button"
                  className="report-sidebar__item-main"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect?.(tpl)}
                >
                  <strong className="report-sidebar__item-name">{tpl.name}</strong>
                  <span className="report-sidebar__item-meta">
                    {tpl.sections_count ?? tpl.sections?.length ?? 0} разд.
                    {tpl.updated_at
                      ? ` · ${new Date(tpl.updated_at).toLocaleDateString('ru-RU')}`
                      : ''}
                  </span>
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="report-sidebar__item-delete"
                    title="Удалить шаблон"
                    aria-label={`Удалить «${tpl.name}»`}
                    disabled={busyId === tpl.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(tpl);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
