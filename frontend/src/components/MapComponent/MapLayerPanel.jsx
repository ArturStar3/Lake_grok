import { useEffect, useMemo, useRef, useState } from "react";
import "./MapLayerPanel.css";
import { MAP_OVERLAY_LAYERS } from "../../config/tiles";

const COLLAPSE_STORAGE_KEY = "infolake.mapLayers.collapsed.v1";

function readInitialCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Панель переключения картографических слоёв (гидрография, транспорт, POI и т.д.).
 * layout="flat" — без сворачивания (fullscreen dock «Слои»).
 */
export default function MapLayerPanel({
  layout = "flat",
  enabledById = {},
  currentZoom = 0,
  onToggle,
  onSetAll,
}) {
  const isFlat = layout === "flat";
  const [collapsed, setCollapsed] = useState(() => (isFlat ? false : readInitialCollapsed()));
  const selectAllRef = useRef(null);

  const groups = useMemo(() => {
    const map = new Map();
    MAP_OVERLAY_LAYERS.forEach((layer) => {
      const key = layer.group || "Прочее";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(layer);
    });
    return Array.from(map.entries());
  }, []);

  const enabledCount = useMemo(
    () => MAP_OVERLAY_LAYERS.filter((layer) => enabledById[layer.id]).length,
    [enabledById],
  );

  const total = MAP_OVERLAY_LAYERS.length;
  const allEnabled = enabledCount === total && total > 0;
  const someEnabled = enabledCount > 0 && enabledCount < total;
  const contentVisible = isFlat || !collapsed;

  useEffect(() => {
    if (isFlat) return;
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage недоступен — молча пропускаем
    }
  }, [collapsed, isFlat]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someEnabled;
    }
  }, [someEnabled]);

  const handleSetAll = (checked) => {
    if (checked) {
      const ok = window.confirm(
        'Включить все слои? На мелком масштабе это может замедлить отрисовку карты на слабых устройствах.',
      );
      if (!ok) return;
    }
    onSetAll?.(checked);
  };

  const isLayerUnavailable = (layer) =>
    typeof layer.minZoom === 'number' && currentZoom < layer.minZoom;

  const layerList = (
    <>
      <p className="map-layer-panel__hint">
        Слои с пометкой zoom включаются при приближении карты.
      </p>

      <label className="map-layer-panel__item map-layer-panel__item--all">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allEnabled}
          onChange={(e) => handleSetAll(e.target.checked)}
        />
        <span className="map-layer-panel__label map-layer-panel__label--all">
          {allEnabled ? "Снять выделение" : "Выделить все"}
        </span>
      </label>

      <div className="map-layer-panel__groups">
        {groups.map(([groupTitle, layers]) => (
          <div key={groupTitle} className="map-layer-panel__group">
            <div className="map-layer-panel__group-title">{groupTitle}</div>
            {layers.map((layer) => {
              const unavailable = isLayerUnavailable(layer);
              return (
                <label
                  key={layer.id}
                  className={`map-layer-panel__item${unavailable ? " map-layer-panel__item--unavailable" : ""}`}
                  title={
                    unavailable
                      ? `Рекомендуется с zoom ${layer.minZoom} и выше (сейчас ${currentZoom})`
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={Boolean(enabledById[layer.id])}
                    onChange={() => onToggle?.(layer.id)}
                  />
                  <span className="map-layer-panel__label">
                    {layer.label}
                    {unavailable && (
                      <span className="map-layer-panel__zoom-hint">
                        {' '}(zoom ≥{layer.minZoom})
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className={`map-layer-panel${isFlat ? " map-layer-panel--flat" : ""}`}>
      {isFlat ? (
        <div className="map-layer-panel__header">
          <span className="map-layer-panel__header-label">Включено слоёв</span>
          <span className="map-layer-panel__counter">{enabledCount}/{total}</span>
        </div>
      ) : (
        <button
          type="button"
          className="map-layer-panel__title"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          <span
            className={`map-layer-panel__chevron${collapsed ? " map-layer-panel__chevron--collapsed" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
          <span>Слои карты</span>
          <span className="map-layer-panel__counter">{enabledCount}/{total}</span>
        </button>
      )}

      {contentVisible && layerList}
    </div>
  );
}
