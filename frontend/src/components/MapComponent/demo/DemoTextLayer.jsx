import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import DemoTextItem from './DemoTextItem';
import { demoTextExitDuration } from '../../../utils/demoTextStyle';
import './DemoTextLayer.css';

const MIN_FONT_SCALE = 0.15;
const MAX_FONT_SCALE = 8;
const EDIT_KEY = 'demo-text-edit';
/** Совпадает с длительностью анимации зума в CSS самого Leaflet. */
const LEAFLET_ZOOM_MS = 250;

/** Геоблоки позиционируются transform-ом, поэтому в потоке стоят в нуле. */
const GEO_ANCHOR_STYLE = { left: 0, top: 0 };

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function clampScale(value) {
    return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, value));
}

function staticText(text) {
    if (!text) return text;
    return {
        ...text,
        content: text.content || 'Пример текста',
        enter: { ...(text.enter || {}), effect: 'none', delay_ms: 0 },
        exit: { ...(text.exit || {}), effect: 'none', delay_ms: 0 },
    };
}

function isGeo(text) {
    return text?.anchor === 'geo' && text.lat != null && text.lng != null;
}

/**
 * Экранные координаты геоблока и его масштаб.
 *
 * `target` задаётся во время анимации зума: там нужны координаты не текущего
 * состояния карты, а того, в котором она окажется по завершении анимации.
 */
function geoLayout(map, text, key, baseZoomRef, target = null) {
    const zoom = target ? target.zoom : map.getZoom();
    const center = target ? target.center : map.getCenter();
    const size = map.getSize();
    const point = map.project([text.lat, text.lng], zoom)
        .subtract(map.project(center, zoom))
        .add(size.divideBy(2));

    let scale = 1;
    if (text.style?.scale_with_map) {
        if (!baseZoomRef.current.has(key)) baseZoomRef.current.set(key, zoom);
        scale = clampScale(2 ** (zoom - baseZoomRef.current.get(key)));
    }

    return {
        x: point.x + (text.offset?.x || 0),
        y: point.y + (text.offset?.y || 0),
        scale,
    };
}

/** Позиция блока в режиме правки — обычный inline-стиль, элемент всего один. */
function editPositionStyle(map, text, baseZoomRef) {
    if (isGeo(text)) {
        const { x, y, scale } = geoLayout(map, text, EDIT_KEY, baseZoomRef);
        return { anchorStyle: { left: `${x}px`, top: `${y}px` }, fontScale: scale };
    }
    const x = (text.screen?.x ?? 0.5) * 100;
    const y = (text.screen?.y ?? 0.15) * 100;
    return {
        anchorStyle: {
            left: `calc(${x}% + ${text.offset?.x || 0}px)`,
            top: `calc(${y}% + ${text.offset?.y || 0}px)`,
        },
        fontScale: 1,
    };
}

function screenAnchorStyle(text) {
    const x = (text.screen?.x ?? 0.5) * 100;
    const y = (text.screen?.y ?? 0.15) * 100;
    return {
        left: `calc(${x}% + ${text.offset?.x || 0}px)`,
        top: `calc(${y}% + ${text.offset?.y || 0}px)`,
    };
}

function pointFromEvent(map, event) {
    const container = map.getContainer();
    const rect = container.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
    };
}

/**
 * Текстовые оверлеи демонстрации поверх карты.
 *
 * Геопривязанные блоки едут вместе с картой: их положение пишется прямо в
 * `transform` DOM-узла из обработчика `move`, без рендера React — иначе каждый
 * кадр перетаскивания перерисовывал бы все блоки разом. На время анимации зума
 * включается CSS-переход той же длительности, что и у самого Leaflet, поэтому
 * текст не телепортируется в конечную точку.
 *
 * Уход текста (`exit`) живёт здесь же: элемент остаётся в DOM ещё на время
 * анимации выхода, чтобы плеер мог оставаться чистой функцией состояния.
 *
 * В режиме правки (`editText`) поверх карты рисуется один черновик без анимаций:
 * его можно перетащить мышью.
 */
export default function DemoTextLayer({
    texts,
    active = false,
    editText = null,
    onEditChange,
}) {
    const map = useMap();
    const [container, setContainer] = useState(null);
    const [items, setItems] = useState([]);
    const [, forceEditReposition] = useState(0);
    const [dragPx, setDragPx] = useState(null);

    const exitTimersRef = useRef(new Map());
    const baseZoomRef = useRef(new Map());
    const nodesRef = useRef(new Map());
    const nodeRefCallbacksRef = useRef(new Map());
    const itemsRef = useRef(items);
    const repaintFrameRef = useRef(null);
    const zoomTimerRef = useRef(null);
    const editTextRef = useRef(editText);
    const onEditChangeRef = useRef(onEditChange);
    editTextRef.current = editText;
    onEditChangeRef.current = onEditChange;
    itemsRef.current = items;

    const editing = Boolean(editText);

    useEffect(() => {
        const mapContainer = map?.getContainer?.();
        if (!mapContainer) return undefined;
        const el = document.createElement('div');
        el.className = 'demo-text-layer';
        mapContainer.appendChild(el);
        setContainer(el);
        return () => {
            el.remove();
            setContainer(null);
        };
    }, [map]);

    useEffect(() => {
        if (!container) return;
        container.classList.toggle('demo-text-layer--edit', editing);
    }, [container, editing]);

    /** Стабильный callback-ref на ключ: иначе memo у DemoTextItem не сработает. */
    const nodeRefFor = useCallback((key) => {
        const cache = nodeRefCallbacksRef.current;
        if (!cache.has(key)) {
            cache.set(key, (node) => {
                if (node) nodesRef.current.set(key, node);
                else nodesRef.current.delete(key);
            });
        }
        return cache.get(key);
    }, []);

    const paintGeoPositions = useCallback((target = null) => {
        if (!map) return;
        itemsRef.current.forEach((item) => {
            if (!isGeo(item.text)) return;
            const node = nodesRef.current.get(item.key);
            if (!node) return;
            const { x, y, scale } = geoLayout(map, item.text, item.key, baseZoomRef, target);
            node.style.transform = scale === 1
                ? `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
                : `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
        });
    }, [map]);

    const scheduleGeoRepaint = useCallback(() => {
        if (repaintFrameRef.current != null) return;
        repaintFrameRef.current = requestAnimationFrame(() => {
            repaintFrameRef.current = null;
            paintGeoPositions();
        });
    }, [paintGeoPositions]);

    const scheduleExit = useCallback((key, durationMs) => {
        const timers = exitTimersRef.current;
        if (timers.has(key)) return;
        const timer = setTimeout(() => {
            timers.delete(key);
            baseZoomRef.current.delete(key);
            setItems((prev) => prev.filter((item) => item.key !== key));
        }, Math.max(0, durationMs));
        timers.set(key, timer);
    }, []);

    // Синхронизация состава: новые тексты появляются, снятые уходят с анимацией.
    useEffect(() => {
        if (editing) {
            setItems([]);
            return;
        }
        const incoming = active ? (texts || []) : [];
        const incomingByKey = new Map(incoming.map((item) => [item.key, item]));

        setItems((prev) => {
            const next = [];
            const seen = new Set();

            prev.forEach((item) => {
                const fresh = incomingByKey.get(item.key);
                if (fresh) {
                    seen.add(item.key);
                    const timer = exitTimersRef.current.get(item.key);
                    if (timer) {
                        clearTimeout(timer);
                        exitTimersRef.current.delete(item.key);
                    }
                    next.push({
                        key: item.key,
                        text: fresh.text,
                        phase: 'enter',
                        enterToken: fresh.enterToken ?? 0,
                    });
                    return;
                }
                if (item.phase === 'exit') {
                    next.push(item);
                    return;
                }
                const duration = demoTextExitDuration(item.text);
                scheduleExit(item.key, duration);
                next.push({ ...item, phase: 'exit' });
            });

            incoming.forEach((item) => {
                if (seen.has(item.key)) return;
                next.push({
                    key: item.key,
                    text: item.text,
                    phase: 'enter',
                    enterToken: item.enterToken ?? 0,
                });
            });

            // Ничего не поменялось — возвращаем прежний массив, чтобы не гонять
            // лишний рендер слоя на каждом такте плеера.
            const same = next.length === prev.length && next.every((item, index) => (
                prev[index].key === item.key
                && prev[index].phase === item.phase
                && prev[index].text === item.text
                && prev[index].enterToken === item.enterToken
            ));
            return same ? prev : next;
        });
    }, [active, texts, scheduleExit, editing]);

    useEffect(() => () => {
        exitTimersRef.current.forEach((timer) => clearTimeout(timer));
        exitTimersRef.current.clear();
        if (repaintFrameRef.current != null) cancelAnimationFrame(repaintFrameRef.current);
        if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    }, []);

    // Первичная расстановка до отрисовки кадра — иначе блок мигнёт в углу.
    useLayoutEffect(() => {
        if (editing) return;
        paintGeoPositions();
    }, [editing, items, paintGeoPositions]);

    const hasGeoPlayback = !editing && items.some((item) => isGeo(item.text));

    useEffect(() => {
        if (!map || !container || !hasGeoPlayback) return undefined;

        const endZoom = () => {
            if (zoomTimerRef.current) {
                clearTimeout(zoomTimerRef.current);
                zoomTimerRef.current = null;
            }
            container.classList.remove('demo-text-layer--zooming');
            paintGeoPositions();
        };

        const onMove = () => scheduleGeoRepaint();
        const onZoomAnim = (event) => {
            // Leaflet анимирует свои слои CSS-переходом; включаем такой же для
            // текста и сразу ставим конечные координаты — доедут синхронно.
            container.classList.add('demo-text-layer--zooming');
            paintGeoPositions({ zoom: event.zoom, center: event.center });
            if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
            // Страховка на случай, если zoomend не придёт (прерванная анимация).
            zoomTimerRef.current = setTimeout(endZoom, LEAFLET_ZOOM_MS + 50);
        };

        map.on('move zoom viewreset resize', onMove);
        map.on('zoomanim', onZoomAnim);
        map.on('zoomend', endZoom);
        return () => {
            map.off('move zoom viewreset resize', onMove);
            map.off('zoomanim', onZoomAnim);
            map.off('zoomend', endZoom);
            container.classList.remove('demo-text-layer--zooming');
        };
    }, [map, container, hasGeoPlayback, paintGeoPositions, scheduleGeoRepaint]);

    // Черновик правки — единственный элемент, его дешевле двигать через рендер.
    const editIsGeo = editing && isGeo(editText);
    useEffect(() => {
        if (!map || !editIsGeo) return undefined;
        const handler = () => forceEditReposition((value) => value + 1);
        map.on('move zoom viewreset resize zoomanim', handler);
        return () => map.off('move zoom viewreset resize zoomanim', handler);
    }, [map, editIsGeo]);

    const handleEditPointerDown = useCallback((event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (!map) return;

        map.dragging?.disable();
        const start = pointFromEvent(map, event);
        const el = event.currentTarget;
        let moved = false;

        const paintPixels = (point) => {
            if (el instanceof HTMLElement) {
                el.style.left = `${point.x}px`;
                el.style.top = `${point.y}px`;
            }
            setDragPx({ x: point.x, y: point.y });
        };

        const onMove = (ev) => {
            const current = editTextRef.current;
            if (!current) return;
            const point = pointFromEvent(map, ev);
            if (!moved && Math.abs(point.x - start.x) < 3 && Math.abs(point.y - start.y) < 3) return;
            moved = true;
            paintPixels(point);
            const offsetX = current.offset?.x || 0;
            const offsetY = current.offset?.y || 0;
            if (current.anchor === 'geo') {
                const latlng = map.containerPointToLatLng([point.x - offsetX, point.y - offsetY]);
                onEditChangeRef.current?.({ ...current, lat: latlng.lat, lng: latlng.lng });
                return;
            }
            onEditChangeRef.current?.({
                ...current,
                screen: {
                    x: clamp01((point.x - offsetX) / point.width),
                    y: clamp01((point.y - offsetY) / point.height),
                },
            });
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            map.dragging?.enable();
            setDragPx(null);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [map]);

    const editDisplay = useMemo(() => staticText(editText), [editText]);

    const playback = useMemo(() => ((!editing && items.length)
        ? items.map((item) => (
            <DemoTextItem
                key={`${item.key}-${item.phase}-${item.enterToken || 0}`}
                text={item.text}
                phase={item.phase}
                anchorStyle={isGeo(item.text) ? GEO_ANCHOR_STYLE : screenAnchorStyle(item.text)}
                className={isGeo(item.text) ? 'demo-text__anchor--geo' : ''}
                anchorRef={nodeRefFor(item.key)}
            />
        ))
        : null), [editing, items, nodeRefFor]);

    if (!container) return null;

    const editor = (editing && editDisplay)
        ? (() => {
            const placed = editPositionStyle(map, editDisplay, baseZoomRef);
            const anchorStyle = dragPx
                ? { left: `${dragPx.x}px`, top: `${dragPx.y}px` }
                : placed.anchorStyle;
            return (
                <DemoTextItem
                    key={EDIT_KEY}
                    text={editDisplay}
                    phase="enter"
                    fontScale={placed.fontScale}
                    anchorStyle={anchorStyle}
                    className="demo-text__anchor--edit"
                    onPointerDown={handleEditPointerDown}
                />
            );
        })()
        : null;

    if (!playback && !editor) return null;
    return createPortal(<>{playback}{editor}</>, container);
}
