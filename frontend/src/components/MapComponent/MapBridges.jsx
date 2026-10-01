import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { setDemoAnimationMap } from "./demo/demoRafDriver";

 // Компонент для отслеживания изменений зума
export function EmbedMapFixer({ enabled }) {
    const map = useMap();
    useEffect(() => {
        if (!enabled || !map) return undefined;
        const run = () => {
            try {
                map.invalidateSize();
            } catch {
                // контейнер ещё без размеров
            }
        };
        run();
        const t0 = setTimeout(run, 50);
        const t1 = setTimeout(run, 300);
        return () => {
            clearTimeout(t0);
            clearTimeout(t1);
        };
    }, [enabled, map]);
    return null;
}

export function ZoomTracker({ onZoomChange }) {
    const map = useMapEvents({
        zoomend: () => {
            onZoomChange(map.getZoom());
        }
    });
    return null;
}

/**
 * Единый стабильный мост для событий карты (click и т.п.).
 * Компонент объявлен на уровне модуля (не внутри рендера MapComponent), поэтому
 * его тип стабилен и Leaflet-обработчики не переподписываются на каждый ре-рендер.
 * Актуальная логика читается из ref (apiRef.current) в момент события.
 */
export function MapEventBridge({ apiRef }) {
    const map = useMapEvents({
        click: (e) => apiRef.current?.onClick?.(e, map),
        dblclick: (e) => {
            const handled = apiRef.current?.onDblClick?.(e, map);
            if (handled) {
                L.DomEvent.stopPropagation(e);
            }
        },
        mousemove: (e) => apiRef.current?.onMouseMove?.(e, map),
        mouseout: (e) => apiRef.current?.onMouseOut?.(e, map),
    });
    return null;
}

/** Связывает Leaflet-карту с rAF-анимациями демонстрации и отдаёт API слоёв наружу. */
export function DemoMapBridge({ onOverlayLayersRef, setOnlyOverlayLayers, overlayEnabledById, bindAnimationMap = true }) {
    const map = useMap();

    useEffect(() => {
        if (!bindAnimationMap) return undefined;
        setDemoAnimationMap(map);
        return () => setDemoAnimationMap(null);
    }, [map, bindAnimationMap]);

    useEffect(() => {
        if (!onOverlayLayersRef) return undefined;
        onOverlayLayersRef.current = {
            setOverlayLayers: setOnlyOverlayLayers,
            getEnabledIds: () => Object.entries(overlayEnabledById || {})
                .filter(([, enabled]) => enabled)
                .map(([id]) => id),
        };
        return () => {
            onOverlayLayersRef.current = null;
        };
    }, [onOverlayLayersRef, setOnlyOverlayLayers, overlayEnabledById]);

    return null;
}

/**
 * Во время показа докладчик может свободно работать с картой: демонстрация при
 * этом не прерывается, лишь отсчёт текущего такта придерживается, пока идёт
 * перетаскивание или зум — иначе автопереход выдернул бы камеру из-под руки.
 */
export function DemoInteractionBridge({ active, onHold, onRelease, suspendHold = false }) {
    const map = useMap();
    const suspendHoldRef = useRef(suspendHold);
    suspendHoldRef.current = suspendHold;

    useEffect(() => {
        if (!active || !map) return undefined;
        const hold = () => {
            if (suspendHoldRef.current) return;
            onHold?.();
        };
        const release = () => onRelease?.();

        map.on('dragstart zoomstart mousedown', hold);
        map.on('dragend zoomend mouseup', release);
        return () => {
            map.off('dragstart zoomstart mousedown', hold);
            map.off('dragend zoomend mouseup', release);
            onRelease?.();
        };
    }, [active, map, onHold, onRelease]);

    return null;
}
