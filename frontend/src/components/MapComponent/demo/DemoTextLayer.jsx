import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import DemoTextItem from './DemoTextItem';
import { demoTextExitDuration } from '../../../utils/demoTextStyle';
import './DemoTextLayer.css';

const MIN_FONT_SCALE = 0.15;
const MAX_FONT_SCALE = 8;
const EDIT_KEY = 'demo-text-edit';

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
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

function positionStyle(map, text, key, baseZoomRef) {
    let fontScale = 1;
    let anchorStyle;

    if (text.anchor === 'geo' && text.lat != null && text.lng != null) {
        const point = map.latLngToContainerPoint([text.lat, text.lng]);
        anchorStyle = {
            left: `${point.x + (text.offset?.x || 0)}px`,
            top: `${point.y + (text.offset?.y || 0)}px`,
        };
        if (text.style?.scale_with_map) {
            if (!baseZoomRef.current.has(key)) {
                baseZoomRef.current.set(key, map.getZoom());
            }
            const baseZoom = baseZoomRef.current.get(key);
            fontScale = Math.min(
                MAX_FONT_SCALE,
                Math.max(MIN_FONT_SCALE, 2 ** (map.getZoom() - baseZoom)),
            );
        }
    } else {
        const x = (text.screen?.x ?? 0.5) * 100;
        const y = (text.screen?.y ?? 0.15) * 100;
        anchorStyle = {
            left: `calc(${x}% + ${text.offset?.x || 0}px)`,
            top: `calc(${y}% + ${text.offset?.y || 0}px)`,
        };
    }

    return { anchorStyle, fontScale };
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
 * Геопривязанные блоки пересчитываются в экранные координаты на каждом событии
 * `move`/`zoom`, поэтому едут вместе с картой и при перетаскивании, и при зуме.
 * Экранные блоки просто стоят в долях вьюпорта.
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
    const [, forceReposition] = useState(0);
    const [dragPx, setDragPx] = useState(null);

    const exitTimersRef = useRef(new Map());
    const baseZoomRef = useRef(new Map());
    const editTextRef = useRef(editText);
    const onEditChangeRef = useRef(onEditChange);
    editTextRef.current = editText;
    onEditChangeRef.current = onEditChange;

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

            return next;
        });
    }, [active, texts, scheduleExit, editing]);

    useEffect(() => () => {
        exitTimersRef.current.forEach((timer) => clearTimeout(timer));
        exitTimersRef.current.clear();
    }, []);

    const hasGeoText = editing
        ? editText?.anchor === 'geo'
        : items.some((item) => item.text?.anchor === 'geo');

    useEffect(() => {
        if (!map || !hasGeoText) return undefined;
        const handler = () => forceReposition((value) => value + 1);
        map.on('move zoom viewreset resize zoomanim', handler);
        return () => map.off('move zoom viewreset resize zoomanim', handler);
    }, [map, hasGeoText]);

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

    if (!container) return null;

    const playback = (!editing && items.length)
        ? items.map((item) => {
            const { anchorStyle, fontScale } = positionStyle(map, item.text, item.key, baseZoomRef);
            return (
                <DemoTextItem
                    key={`${item.key}-${item.phase}-${item.enterToken || 0}`}
                    text={item.text}
                    phase={item.phase}
                    fontScale={fontScale}
                    anchorStyle={anchorStyle}
                />
            );
        })
        : null;

    const editor = (editing && editDisplay)
        ? (() => {
            const placed = positionStyle(map, editDisplay, EDIT_KEY, baseZoomRef);
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
