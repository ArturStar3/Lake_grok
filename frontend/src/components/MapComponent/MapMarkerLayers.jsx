import React, { useEffect, useMemo, useRef } from "react";
import { Circle, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useMapViewportMarkers } from "../../hooks/useMapViewportMarkers";
import { getGroupCirclePositions } from "./markerClusteringUtils";
import { ensureNonFlagIconsForObjects } from "../../utils/markerIconFactory";
import { getCountryMarkerPalette } from "../../utils/markerPalette";
import { applyObjectDemoEffect, objectDemoMarkerKeySuffix, resolveObjectDemoEffect } from "./demo/objectDemoAnimations";
import { getCircleFallbackIcon } from "./MapDrawingLayers";

const FlagMapMarker = React.memo(function FlagMapMarker({
    obj,
    icon,
    measureMode,
    eventDrawingActive,
    altAddTargetActive,
    onEventMapClick,
    onAltClickAddTarget,
    onMarkerClick,
    onMarkerHover,
    demoEffect = null,
}) {
    const markerRef = useRef(null);

    useEffect(() => {
        applyObjectDemoEffect(markerRef.current, demoEffect);
    }, [demoEffect]);

    const eventHandlers = useMemo(() => ({
        add: (e) => {
            applyObjectDemoEffect(e.target, demoEffect);
        },
        click: (e) => {
            if (eventDrawingActive) {
                onEventMapClick?.(e.latlng, e.target._map);
                return;
            }
            if (altAddTargetActive && e.originalEvent?.altKey) {
                onAltClickAddTarget?.({
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                });
                return;
            }
            if (measureMode && e.originalEvent?.ctrlKey) return;
            if (onMarkerClick && obj.id) onMarkerClick(obj.id);
        },
        mouseover: () => {
            if (obj.id) onMarkerHover(obj.id);
        },
        mouseout: () => onMarkerHover(null),
    }), [obj.id, measureMode, eventDrawingActive, altAddTargetActive, onEventMapClick, onAltClickAddTarget, onMarkerClick, onMarkerHover, demoEffect]);

    if (!icon) return null;

    return (
        <Marker
            ref={markerRef}
            position={[obj.lat, obj.lng]}
            icon={icon}
            draggable={false}
            eventHandlers={eventHandlers}
        />
    );
});

function getFlagMarkerKey(o, demoEffect) {
    const markerId = o.marker?.id ?? 'no-marker';
    return `${o.id}-${markerId}${objectDemoMarkerKeySuffix(demoEffect)}`;
}

export const FlagMarkersLayer = React.memo(function FlagMarkersLayer({
    markers,
    iconsById,
    measureMode,
    eventDrawingActive,
    altAddTargetActive,
    onEventMapClick,
    onAltClickAddTarget,
    onMarkerClick,
    onMarkerHover,
    demoAnimation = null,
}) {
    const visible = useMapViewportMarkers(markers);
    return visible.map((obj) => {
        const demoEffect = resolveObjectDemoEffect(obj, demoAnimation);
        return (
            <FlagMapMarker
                key={getFlagMarkerKey(obj, demoEffect)}
                obj={obj}
                icon={iconsById[obj.id]}
                measureMode={measureMode}
                eventDrawingActive={eventDrawingActive}
                altAddTargetActive={altAddTargetActive}
                onEventMapClick={onEventMapClick}
                onAltClickAddTarget={onAltClickAddTarget}
                onMarkerClick={onMarkerClick}
                onMarkerHover={onMarkerHover}
                demoEffect={demoEffect}
            />
        );
    });
});

const NonFlagMapMarker = React.memo(function NonFlagMapMarker({
    obj,
    icon,
    measureMode,
    eventDrawingActive,
    altAddTargetActive,
    onEventMapClick,
    onAltClickAddTarget,
    pinnedGroupId,
    onMarkerClick,
    onMarkerHover,
    onGroupHover,
    onPinGroup,
    demoEffect = null,
}) {
    const markerRef = useRef(null);

    useEffect(() => {
        applyObjectDemoEffect(markerRef.current, demoEffect);
    }, [demoEffect]);

    const eventHandlers = useMemo(() => ({
        add: (e) => {
            applyObjectDemoEffect(e.target, demoEffect);
        },
        mouseover: () => {
            if (obj.isGroupIcon) {
                onGroupHover(obj.groupId);
            } else if (obj.id) {
                onMarkerHover(obj.id);
            }
        },
        mouseout: () => {
            if (obj.isGroupIcon) {
                if (pinnedGroupId !== obj.groupId) onGroupHover(null);
            } else {
                onMarkerHover(null);
            }
        },
        click: (e) => {
            if (eventDrawingActive) {
                onEventMapClick?.(e.latlng, e.target._map);
                return;
            }
            if (altAddTargetActive && e.originalEvent?.altKey) {
                onAltClickAddTarget?.({
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                });
                return;
            }
            if (obj.isGroupIcon) {
                e.originalEvent.stopPropagation();
                if (pinnedGroupId === obj.groupId) {
                    onPinGroup(null);
                    onGroupHover(null);
                } else {
                    onPinGroup(obj.groupId);
                }
            } else {
                if (measureMode && e.originalEvent?.ctrlKey) return;
                if (onMarkerClick && obj.id) onMarkerClick(obj.id);
            }
        },
    }), [
        obj.id,
        obj.isGroupIcon,
        obj.groupId,
        measureMode,
        eventDrawingActive,
        altAddTargetActive,
        onEventMapClick,
        onAltClickAddTarget,
        pinnedGroupId,
        onMarkerClick,
        onMarkerHover,
        onGroupHover,
        onPinGroup,
        demoEffect,
    ]);

    if (!icon) return null;

    return (
        <Marker
            ref={markerRef}
            position={[obj.lat, obj.lng]}
            icon={icon}
            draggable={false}
            eventHandlers={eventHandlers}
        />
    );
});

export const NonFlagMarkersLayer = React.memo(function NonFlagMarkersLayer({
    groupedObjects,
    iconsById,
    selectedIds,
    currentZoom,
    forceShowAllMarkers = false,
    pinnedGroupId,
    measureMode,
    eventDrawingActive,
    altAddTargetActive,
    onEventMapClick,
    onAltClickAddTarget,
    onMarkerClick,
    onMarkerHover,
    onGroupHover,
    onPinGroup,
    demoAnimation = null,
}) {
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const candidates = useMemo(() => {
        if (!forceShowAllMarkers && currentZoom < 6) return [];
        return (groupedObjects || []).filter((obj) => !obj.isHidden && selectedSet.has(obj.id));
    }, [groupedObjects, selectedSet, currentZoom, forceShowAllMarkers]);

    const visible = useMapViewportMarkers(candidates);

    return visible.map((obj) => {
        const demoEffect = resolveObjectDemoEffect(obj, demoAnimation);
        const markerId = obj.marker?.id ?? 'no-marker';
        const key = obj.isGroupIcon
            ? `non-flag-group-${obj.groupId}${objectDemoMarkerKeySuffix(demoEffect)}`
            : `non-flag-${obj.id}-${markerId}${objectDemoMarkerKeySuffix(demoEffect)}`;
        return (
            <NonFlagMapMarker
                key={key}
                obj={obj}
                icon={iconsById[obj.isGroupIcon ? obj.groupId : obj.id]}
                measureMode={measureMode}
                eventDrawingActive={eventDrawingActive}
                altAddTargetActive={altAddTargetActive}
                onEventMapClick={onEventMapClick}
                onAltClickAddTarget={onAltClickAddTarget}
                pinnedGroupId={pinnedGroupId}
                onMarkerClick={onMarkerClick}
                onMarkerHover={onMarkerHover}
                onGroupHover={onGroupHover}
                onPinGroup={onPinGroup}
                demoEffect={demoEffect}
            />
        );
    });
});

// Компонент для отображения элементов группы в круге при наведении.
// Оптимизация: React.memo + вычисления зависят только от displayGroupId + groupedObjects.
export const GroupCircleDisplay = React.memo(function GroupCircleDisplay({ groupedObjects, hoveredGroupId, pinnedGroupId, onPinGroup, iconsById, svgCache, onMarkerClick, measureMode, eventDrawingActive, altAddTargetActive, onEventMapClick, onAltClickAddTarget, onMarkerHover }) {
    const [mapRevision, setMapRevision] = React.useState(0);
    const mapInstance = useMapEvents({
        zoomend: () => setMapRevision((v) => v + 1),
        moveend: () => setMapRevision((v) => v + 1),
    });
    const [circleMarkers, setCircleMarkers] = React.useState([]);
    const [circleCenter, setCircleCenter] = React.useState(null);
    const [circleIcons, setCircleIcons] = React.useState({});

    // Показываем круг если группа наведена ИЛИ закреплена
    const displayGroupId = pinnedGroupId || hoveredGroupId;

    React.useEffect(() => {
        if (!displayGroupId || !groupedObjects.length || !mapInstance) {
            setCircleMarkers([]);
            return;
        }

        // Находим группу. Для центра окружности ВСЕГДА используем запись с isGroupIcon —
        // у неё координаты первого объекта кластера (см. processNonFlagClustering).
        // Это гарантирует, что иконка группировки находится на позиции первого объекта (требование 1),
        // и центр круга будет совпадать с визуальным положением маркера группировки (требование 2).
        const groupIconEntry = groupedObjects.find(g => g.groupId === displayGroupId && g.isGroupIcon);
        const group = groupIconEntry || groupedObjects.find(g => g.groupId === displayGroupId);

        if (!group || !group.isGrouped || !group.groupObjects) {
            setCircleMarkers([]);
            return;
        }

        // Центр окружности = позиция групповой иконки (lat/lng первого объекта группы).
        const centerLat = group.lat;
        const centerLng = group.lng;

        // Получаем относительные позиции через общую утилиту (меньше дублирования кода, единый источник радиуса).
        // Радиус компактный (32px по умолчанию) — элементы располагаются плотно ВОКРУГ маркера группировки.
        // Центр окружности = точная позиция групповой иконки (требование 2).
        const relativePositions = getGroupCirclePositions(group.groupObjects, 40);

        // Небольшой вертикальный bias, чтобы круг лучше визуально центрировался на группе.
        // Групповая иконка (35px) визуально "сидит" иначе, чем 50px non-flag иконки.
        // Положительное значение смещает членов круга вниз (по layer Y), чтобы группа не казалась ниже.
        const circleVerticalBias = 8;

        const positionsWithCircle = relativePositions.map((rel) => {
            // При необходимости слегка масштабируем радиус под размер иконки члена группы,
            // но сохраняем общий компактный характер (не как раньше 60+).
            const markerScale = parseFloat(rel.marker?.scale) || 1;
            const scaleFactor = 1 + Math.min((markerScale - 1) * 0.1, 0.2);
            const x = rel.circleX * scaleFactor;
            const y = rel.circleY * scaleFactor + circleVerticalBias;

            // Преобразуем пиксельное смещение относительно экранной позиции центра
            // (latLng группы) в новые lat/lng для временных маркеров круга.
            const point = mapInstance.latLngToLayerPoint([centerLat, centerLng]);
            const newPoint = L.point(point.x + x, point.y + y);
            const newLatLng = mapInstance.layerPointToLatLng(newPoint);

            return {
                ...rel,
                lat: newLatLng.lat,
                lng: newLatLng.lng,
                originalLat: centerLat,
                originalLng: centerLng
            };
        });

        setCircleMarkers(positionsWithCircle);
        setCircleCenter({ lat: centerLat, lng: centerLng });
    }, [displayGroupId, groupedObjects, mapInstance, mapRevision]);

    React.useEffect(() => {
        if (!displayGroupId || !groupedObjects.length) {
            setCircleIcons({});
            return;
        }
        const groupIconEntry = groupedObjects.find(g => g.groupId === displayGroupId && g.isGroupIcon);
        const group = groupIconEntry || groupedObjects.find(g => g.groupId === displayGroupId);
        if (!group?.groupObjects || !svgCache?.size) {
            setCircleIcons({});
            return;
        }
        setCircleIcons(ensureNonFlagIconsForObjects(group.groupObjects, svgCache, iconsById ?? {}));
    }, [displayGroupId, groupedObjects, svgCache, iconsById]);

    if (!circleCenter || circleMarkers.length === 0 || !displayGroupId) return null;

    const handleCloseCircle = () => {
        onPinGroup(null);
    };

    return (
        <>
            {/* Маркеры элементов в круге */}
            {circleMarkers.map((marker, idx) => {
                const markerIcon = circleIcons[marker.id] || (iconsById ? iconsById[marker.id] : null);
                const circleFill = getCountryMarkerPalette(marker.country).color_first;

                return (
                    <Marker
                        key={`circle-marker-${displayGroupId}-${idx}`}
                        position={[marker.lat, marker.lng]}
                        icon={markerIcon || getCircleFallbackIcon(circleFill)}
                        draggable={false}
                        eventHandlers={{
                            mouseover: () => {
                                if (marker.id && onMarkerHover) {
                                    onMarkerHover(marker.id);
                                }
                            },
                            mouseout: () => {
                                if (onMarkerHover) onMarkerHover(null);
                            },
                            click: (e) => {
                                e.originalEvent.stopPropagation();

                                if (eventDrawingActive) {
                                    onEventMapClick?.(e.latlng, e.target._map);
                                    return;
                                }

                                if (altAddTargetActive && e.originalEvent?.altKey) {
                                    onAltClickAddTarget?.({
                                        lat: e.latlng.lat,
                                        lng: e.latlng.lng,
                                    });
                                    return;
                                }

                                handleCloseCircle();
                                if (measureMode && e.originalEvent?.ctrlKey) {
                                    return;
                                }
                                if (onMarkerClick && marker.id) {
                                    onMarkerClick(marker.id);
                                }
                            }
                        }}
                    />
                );
            })}
        </>
    );
});
