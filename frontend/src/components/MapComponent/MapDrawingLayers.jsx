import React, { useMemo } from "react";
import { Circle, Marker, Polygon, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import MarkdownContent from "../common/MarkdownEditor/MarkdownContent";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import {
    applyDemoEffectCssVars,
    demoEffectClassName,
    demoEffectCssVars,
    demoMarkerIconClass,
    resolveEventDemoEffect,
} from "./demo/eventDemoAnimations";

/**
 * Иконки событий кэшируются по маркеру и активному эффекту демонстрации:
 * пересоздание divIcon на каждом рендере сбрасывало бы CSS-анимацию мигания.
 */
const eventMarkerIconCache = new Map();

function getEventMarkerIconCached({ markerId, path, svg, demoEffect }) {
    const demoClass = demoMarkerIconClass(demoEffect);
    const durationKey = demoEffect
        ? `${demoEffect.durationMs ?? ""}|${demoEffect.continuous ? "1" : "0"}|${demoEffect.repeat ?? ""}|${demoEffect.runId ?? ""}`
        : "";
    const cacheKey = `${markerId ?? path ?? "fallback"}|${svg ? "svg" : "img"}|${demoClass}|${durationKey}`;
    const cached = eventMarkerIconCache.get(cacheKey);
    if (cached) return cached;

    const cssVars = demoEffect ? demoEffectCssVars(demoEffect) : "";
    const content = svg
        ? `<div class="event-marker-icon__wrap event-marker-icon__svg" style="${cssVars}">${svg}</div>`
        : path
            ? `<div class="event-marker-icon__wrap" style="${cssVars}"><img src="${path}" alt="event-marker" /></div>`
            : `<div class="event-marker-icon__fallback" style="${cssVars}"></div>`;
    const icon = L.divIcon({
        className: `event-marker-icon${demoClass}`,
        html: content,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
    });
    eventMarkerIconCache.set(cacheKey, icon);
    return icon;
}

const LAYER_NON_INTERACTIVE = Object.freeze({ interactive: false, bubblingMouseEvents: false });
const MEASURE_SEGMENT_STYLE = Object.freeze({ color: "#008DD2", weight: 2, dashArray: "6,4" });
const MEASURE_TOTAL_STYLE = Object.freeze({ color: "#FF6B6B", weight: 1, opacity: 0.6 });

const measureIconCache = new Map();
export function getMeasureIcon(label) {
    const key = String(label);
    let icon = measureIconCache.get(key);
    if (icon) return icon;
    icon = L.divIcon({
        className: "measure-marker",
        html: `<div class="measure-marker__circle">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
    measureIconCache.set(key, icon);
    return icon;
}

const measureTotalIconCache = new Map();
function getMeasureTotalIcon(text) {
    let icon = measureTotalIconCache.get(text);
    if (icon) return icon;
    icon = L.divIcon({
        className: "measure-total-label",
        html: `<div class="measure-total-label__text">${text}</div>`,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
    });
    measureTotalIconCache.set(text, icon);
    return icon;
}

function formatDistance(meters) {
    if (!meters) return "0 м";
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} км` : `${meters.toFixed(0)} м`;
}

function getEventShapeCentroid(shape) {
    if (!shape?.geometry) return null;
    if (shape.type === "point" || shape.type === "circle") {
        return [shape.geometry.lat, shape.geometry.lng];
    }
    if (shape.type === "area" && shape.geometry.points?.length > 0) {
        const pts = shape.geometry.points;
        let lat = 0;
        let lng = 0;
        for (let i = 0; i < pts.length; i += 1) {
            lat += pts[i].lat;
            lng += pts[i].lng;
        }
        return [lat / pts.length, lng / pts.length];
    }
    return null;
}

const circleFallbackIconCache = new Map();
export function getCircleFallbackIcon(fill) {
    let icon = circleFallbackIconCache.get(fill);
    if (icon) return icon;
    icon = L.divIcon({
        html: `<div class="circle-item-marker" style="cursor: pointer; opacity: 0.9;"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${fill}" stroke="#FFFFFF" stroke-width="2"/></svg></div>`,
        className: "circle-item-div-icon",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
    circleFallbackIconCache.set(fill, icon);
    return icon;
}

const EventPopup = React.memo(function EventPopup({ eventItem }) {
    const dateLabel = eventItem.date_start
        ? `с ${eventItem.date_start}${eventItem.date_end ? ` по ${eventItem.date_end}` : ""}`
        : "—";
    const timeLabel = eventItem.time_start
        ? `с ${eventItem.time_start}${eventItem.time_end ? ` по ${eventItem.time_end}` : ""}`
        : "—";
    const description = eventItem.description?.trim() || "";
    return (
        <Popup
            autoPan={false}
            closeOnClick={false}
            className="event-popup"
            eventHandlers={{
                click: (e) => e.originalEvent?.stopPropagation(),
                mousedown: (e) => e.originalEvent?.stopPropagation(),
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <strong>{eventItem.title || "Событие"}</strong>
                <br />
                Объект: {eventItem.object_name || "—"}
                <br />
                Страна: {eventItem.country?.title || "—"}
                <br />
                Дата: {dateLabel}
                <br />
                Время: {timeLabel}
                <br />
                Доп. информация:{' '}
                {description ? (
                    <MarkdownContent variant="popup">{description}</MarkdownContent>
                ) : (
                    '—'
                )}
            </div>
        </Popup>
    );
});

export const EventShapeLayer = React.memo(function EventShapeLayer({
    eventItem,
    markerSvg,
    isMapDrawingActive,
    demoAnimation,
}) {
    const shape = eventItem?.shape;
    const eventColor = eventItem.color || "#2f80ed";
    const demoEventEffect = resolveEventDemoEffect(eventItem, demoAnimation);
    const shapeClassName = demoEffectClassName(demoEventEffect) || undefined;
    const pathOptions = useMemo(() => ({
        color: eventColor,
        fillColor: eventColor,
        fillOpacity: 0.2,
        weight: 1,
        className: shapeClassName,
    }), [eventColor, shapeClassName]);
    const demoShapeHandlers = useMemo(
      () => (demoEventEffect
          ? { add: (e) => applyDemoEffectCssVars(e.target, demoEventEffect) }
          : undefined),
      [demoEventEffect],
    );
    const demoShapeKey = demoEventEffect
        ? `${demoEventEffect.effect}-${demoEventEffect.runId}-${demoEventEffect.repeat ?? 0}`
        : 'static';
    const polygonPositions = useMemo(
        () => (shape?.type === "area" && shape.geometry?.points
            ? shape.geometry.points.map((p) => [p.lat, p.lng])
            : null),
        [shape],
    );

    if (!shape || !shape.type) return null;

    const layerInteraction = isMapDrawingActive ? LAYER_NON_INTERACTIVE : undefined;
    const markerPath = resolveMediaUrl(eventItem.marker?.path);
    const icon = getEventMarkerIconCached({
        markerId: eventItem.marker?.id,
        path: markerPath,
        svg: markerSvg,
        demoEffect: demoEventEffect,
    });
    const markerPosition = getEventShapeCentroid(shape);
    const popup = <EventPopup eventItem={eventItem} />;

    if (shape.type === "point" && shape.geometry) {
        return (
            <Marker
                position={[shape.geometry.lat, shape.geometry.lng]}
                icon={icon}
                {...layerInteraction}
            >
                {popup}
            </Marker>
        );
    }

    if (shape.type === "circle" && shape.geometry) {
        return (
            <>
                <Circle
                    key={`circle-${demoShapeKey}`}
                    center={[shape.geometry.lat, shape.geometry.lng]}
                    radius={shape.geometry.radius || 0}
                    pathOptions={pathOptions}
                    eventHandlers={demoShapeHandlers}
                    {...layerInteraction}
                >
                    {popup}
                </Circle>
                {markerPosition && (
                    <Marker
                        position={markerPosition}
                        icon={icon}
                        {...layerInteraction}
                    />
                )}
            </>
        );
    }

    if (shape.type === "area" && polygonPositions?.length) {
        return (
            <>
                <Polygon
                    key={`area-${demoShapeKey}`}
                    positions={polygonPositions}
                    pathOptions={pathOptions}
                    eventHandlers={demoShapeHandlers}
                    {...layerInteraction}
                >
                    {popup}
                </Polygon>
                {markerPosition && (
                    <Marker
                        position={markerPosition}
                        icon={icon}
                        {...layerInteraction}
                    />
                )}
            </>
        );
    }

    return null;
});

export const MeasureOverlay = React.memo(function MeasureOverlay({ points }) {
    if (!points?.length) return null;
    const last = points[points.length - 1];
    const totalText = formatDistance(points.reduce((sum, p) => sum + (p.distance || 0), 0));
    return (
        <>
            {points.map((point, idx) => {
                if (idx === 0) return null;
                const prev = points[idx - 1];
                return (
                    <Polyline
                        key={`measure-line-${point.id}`}
                        positions={[[prev.lat, prev.lng], [point.lat, point.lng]]}
                        pathOptions={MEASURE_SEGMENT_STYLE}
                    />
                );
            })}
            {points.length >= 2 && (
                <>
                    <Polyline
                        key="measure-total-line"
                        positions={[[points[0].lat, points[0].lng], [last.lat, last.lng]]}
                        pathOptions={MEASURE_TOTAL_STYLE}
                    />
                    <Marker
                        key="measure-total-label"
                        position={[
                            (points[0].lat + last.lat) / 2,
                            (points[0].lng + last.lng) / 2,
                        ]}
                        icon={getMeasureTotalIcon(totalText)}
                        interactive={false}
                    />
                </>
            )}
            {points.map((point) => (
                <Marker
                    key={`measure-point-${point.id}`}
                    position={[point.lat, point.lng]}
                    icon={getMeasureIcon(point.index)}
                    interactive={false}
                />
            ))}
        </>
    );
});
