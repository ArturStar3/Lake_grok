/**
 * Вкладки панели данных (Объекты / События).
 */
export default function PanelTabs({ tabs, activeId, onChange }) {
  return (
    <div className="gis-panel-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          className={`gis-panel-tabs__tab${activeId === tab.id ? ' gis-panel-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge != null && (
            <span className="gis-panel-tabs__badge">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
