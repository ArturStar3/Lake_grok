import {
  ZONE_CENTER_HIGHLIGHT_HOVER_WEIGHT,
  ZONE_CENTER_HIGHLIGHT_WEIGHT,
  ZONE_STROKE_HOVER_WEIGHT,
} from './actionZoneStyle';

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

/**
 * Императивное управление подсветкой зон действия без ре-рендеров React.
 * Поддерживает hover по objId (все зоны объекта) и по entryId (одна зона).
 */
export function createZoneHoverController() {
  /** @type {Map<string, { entryId: string, objId: string, layers: object[], highlightLayer: object|null, baseStyle: object }>} */
  const entries = new Map();
  let hoveredObjIds = new Set();
  let hoveredEntryIds = new Set();

  const isEntryHovered = (entryId, objId) =>
    hoveredEntryIds.has(entryId) || hoveredObjIds.has(objId);

  const applyLayerStyle = (layer, style, hovered, isCross = false) => {
    if (!layer?.setStyle) return;
    const weight = hovered ? (style.hoverWeight ?? ZONE_STROKE_HOVER_WEIGHT) : style.weight;
    const opacity = hovered ? (style.hoverOpacity ?? 0.95) : style.opacity;
    layer.setStyle({
      color: style.color,
      weight: isCross ? weight + 0.25 : weight,
      opacity: isCross ? Math.min(opacity + 0.15, 1) : opacity,
      dashArray: style.dashArray,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
    });
  };

  const applyStyles = () => {
    entries.forEach(({ entryId, objId, layers, highlightLayer, baseStyle }) => {
      const hovered = isEntryHovered(entryId, objId);
      layers.forEach((item) => {
        if (item?.layer) {
          applyLayerStyle(item.layer, baseStyle, hovered, item.cross);
        } else {
          applyLayerStyle(item, baseStyle, hovered, false);
        }
      });
      if (highlightLayer?.setStyle) {
        highlightLayer.setStyle({
          color: baseStyle.color,
          fillColor: baseStyle.color,
          fillOpacity: hovered ? 0.28 : 0.18,
          weight: hovered ? ZONE_CENTER_HIGHLIGHT_HOVER_WEIGHT : ZONE_CENTER_HIGHLIGHT_WEIGHT,
          opacity: 0.9,
        });
      }
    });
  };

  const applyEntryStyles = (entryId, { objId, layers, highlightLayer, baseStyle }) => {
    const hovered = isEntryHovered(entryId, objId);
    layers.forEach((item) => {
      if (item?.layer) {
        applyLayerStyle(item.layer, baseStyle, hovered, item.cross);
      } else {
        applyLayerStyle(item, baseStyle, hovered, false);
      }
    });
    if (highlightLayer?.setStyle) {
      highlightLayer.setStyle({
        color: baseStyle.color,
        fillColor: baseStyle.color,
        fillOpacity: hovered ? 0.28 : 0.18,
        weight: hovered ? 4 : 2,
        opacity: 0.9,
      });
    }
  };

  return {
    register(entryId, { objId, layers, highlightLayer = null, baseStyle }) {
      entries.set(entryId, {
        entryId,
        objId,
        layers: (layers || []).filter(Boolean),
        highlightLayer,
        baseStyle,
      });
      applyEntryStyles(entryId, entries.get(entryId));
    },

    unregister(entryId) {
      entries.delete(entryId);
    },

    setHovered(objIds) {
      const next = objIds instanceof Set
        ? objIds
        : new Set(Array.isArray(objIds) ? objIds : (objIds ? [objIds] : []));
      if (setsEqual(hoveredObjIds, next) && hoveredEntryIds.size === 0) return;
      hoveredObjIds = next;
      hoveredEntryIds = new Set();
      applyStyles();
    },

    setHoveredEntries(entryIds) {
      const next = entryIds instanceof Set
        ? entryIds
        : new Set(Array.isArray(entryIds) ? entryIds : (entryIds ? [entryIds] : []));
      if (setsEqual(hoveredEntryIds, next) && hoveredObjIds.size === 0) return;
      hoveredEntryIds = next;
      hoveredObjIds = new Set();
      applyStyles();
    },

    clear() {
      if (hoveredObjIds.size === 0 && hoveredEntryIds.size === 0) return;
      hoveredObjIds = new Set();
      hoveredEntryIds = new Set();
      applyStyles();
    },
  };
}
