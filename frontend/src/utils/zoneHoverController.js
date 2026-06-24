function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

/**
 * Императивное управление подсветкой зон действия без ре-рендеров React.
 */
export function createZoneHoverController() {
  /** @type {Map<string, { objId: string, layers: object[], highlightLayer: object|null, baseStyle: object }>} */
  const entries = new Map();
  let hoveredObjIds = new Set();

  const applyLayerStyle = (layer, style, hovered, isCross = false) => {
    if (!layer?.setStyle) return;
    const weight = hovered ? (style.hoverWeight ?? 3.5) : style.weight;
    const opacity = hovered ? (style.hoverOpacity ?? 0.95) : style.opacity;
    layer.setStyle({
      color: style.color,
      weight: isCross ? weight + 0.5 : weight,
      opacity: isCross ? Math.min(opacity + 0.15, 1) : opacity,
      dashArray: style.dashArray,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
    });
  };

  const applyStyles = () => {
    entries.forEach(({ objId, layers, highlightLayer, baseStyle }) => {
      const hovered = hoveredObjIds.has(objId);
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
    });
  };

  return {
    register(entryId, { objId, layers, highlightLayer = null, baseStyle }) {
      entries.set(entryId, {
        objId,
        layers: (layers || []).filter(Boolean),
        highlightLayer,
        baseStyle,
      });
      const hovered = hoveredObjIds.has(objId);
      (layers || []).forEach((item) => {
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
    },

    unregister(entryId) {
      entries.delete(entryId);
    },

    setHovered(objIds) {
      const next = objIds instanceof Set
        ? objIds
        : new Set(Array.isArray(objIds) ? objIds : (objIds ? [objIds] : []));
      if (setsEqual(hoveredObjIds, next)) return;
      hoveredObjIds = next;
      applyStyles();
    },

    clear() {
      this.setHovered(new Set());
    },
  };
}
