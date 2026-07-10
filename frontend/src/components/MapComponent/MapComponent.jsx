// ...existing code...
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents, Polyline, Circle, CircleMarker, useMap, Polygon } from "react-leaflet";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


import LabelGeneration from "./MapUtils";
import NonFlagLabelGeneration from "./NonFlagMarkerUtils";
import ObjectsTable from "../ObjectsTable/ObjectsTable";
import EventsTable from "../Events/EventsTable";
import EventsFilterPanel from "../Events/EventsFilterPanel";
import FilterPanel from "../FilterPanel/FilterPanel";
import Features from "../Features/Features";
import ActionZoneFilters from "../Features/ActionZoneFilters";
import IntersectionTable from "../IntersectionTable/IntersectionTable";
import ActionRadiusLegendButton from "./ActionRadiusLegendButton";
import ActionZonesLayer from "./ActionZonesLayer";
import MapVectorBaseLayer from "./MapVectorBaseLayer";
import MapOverlayLayers from "./MapOverlayLayers";
import MapLayerPanel from "./MapLayerPanel";
import { useMapOverlayLayers } from "../../hooks/useMapOverlayLayers";
import ZoneHoverListPanel from "./ZoneHoverListPanel";
import ZoneActionPopupManager, { buildZonePopupPayload } from "./ZoneActionPopupManager";
import { createZoneHoverController } from "../../utils/zoneHoverController";
import CountryModal from "../CountryModal/CountryModal";
import AddEventModal from "../Events/AddEventModal";
import MarkdownContent from "../common/MarkdownEditor/MarkdownContent";
import EventDrawingToolbar from "./EventDrawingToolbar";
import SituationDrawingToolbar from "./SituationDrawingToolbar";
import OperationalSituationLayer from "./OperationalSituationLayer";
import SituationDetailPanel from "../OperationalSituation/SituationDetailPanel";
import SituationsFilterPanel from "../OperationalSituation/SituationsFilterPanel";
import SituationsTable from "../OperationalSituation/SituationsTable";
import SituationsTimeline from "../OperationalSituation/SituationsTimeline";
import { filterRevisionsForSituation } from "../../utils/situationUtils";
import InundationDrawBanner from "./InundationDrawBanner";
import EventDraftLayer from "./EventDraftLayer";
import { useEventDrawing } from "../../hooks/map/useEventDrawing";
import { drawPointsToEditable, editablePointsKey, drawPointsKey, EMPTY_DRAW_POINTS, parseLatLngPoints, validateEditablePolygonPoints } from "../../utils/polygonDrawUtils";
import { calcDistanceMeters } from "../../utils/geoUtils";
import { isFlagMarker } from "../../utils/markerFilters";
import { getGroupCirclePositions } from "./markerClusteringUtils";
import { TILE_RASTER_URL, USE_VECTOR_MAP } from "../../config/tiles";
import { useMapViewportMarkers } from "../../hooks/useMapViewportMarkers";
import { clearMarkerIconCache } from "../../utils/markerIconCache";
import { clearEnrichSvgCache } from "../../utils/svgUtils";
import { ensureNonFlagIconsForObjects } from "../../utils/markerIconFactory";
import "./MapComponent.css"

// delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
});

const MemoGeoJSON = React.memo(GeoJSON);

function FullscreenControl({ isFullscreen, onToggle, sidebarOpen = false }) {
    return (
        <button
            type="button"
            className={`map__fullscreen-btn${sidebarOpen ? ' map__fullscreen-btn--sidebar-open' : ''}`}
            onClick={onToggle}
            aria-label={isFullscreen ? "Выход из полноэкранного режима" : "Перейти в полноэкранный режим"}
        >
            {isFullscreen ? (
                <svg width="25" height="25">
                    <use href={"/sprite.svg#arrow-in"} />
                </svg>
            ) : (
                <svg width="25" height="25">
                    <use href={"/sprite.svg#arrow-out"} />
                </svg>
            )}
        </button>
    )
}

// Стандартные топографические / военные масштабы для дропдауна выбора и снаппинга.
// Убраны масштабы детальнее 1:10 000 (по требованию пользователя).
const AVAILABLE_DENOMINATORS = [25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 3000000];

// Линейка масштаба (топографический стиль) — числовое 1:N + двухцветная графическая шкала.
// Отображается только в полноэкранном режиме, внизу по центру.
// Адаптивно пересчитывает реальный масштаб по данным Leaflet.
// По клику на числовое значение открывает выпадающий список для выбора масштаба (меняет зум карты).
function MapScaleBar({ isFullscreen }) {
    const map = useMap();
    const [scale, setScale] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const numericRef = useRef(null);
    const dropdownRef = useRef(null);
    const scaleTimeoutRef = useRef(null);

    // Обратный расчёт зума для заданного знаменателя масштаба (1:N).
    // Использует ту же константу Web Mercator и приближение, что и updateScale.
    const getZoomForDenominator = useCallback((denominator, lat) => {
        if (!denominator || typeof lat !== "number") return null;
        const latRad = (lat * Math.PI) / 180;
        const mpp0 = 156543.03392 * Math.cos(latRad);
        // targetMpp согласован с формулой denomRaw = niceMeters / (barWidth * 0.000264583333)
        const targetMpp = denominator * 0.000264583333;
        const z = Math.log2(mpp0 / targetMpp);
        return Math.max(0, Math.min(19, Math.round(z)));
    }, []);

    const updateScale = useCallback(() => {
        if (!map || !isFullscreen) {
            setScale(null);
            return;
        }

        const center = map.getCenter();
        const zoom = map.getZoom();

        // Метров на пиксель (Web Mercator, с учётом широты)
        const metersPerPx = 156543.03392 * Math.cos((center.lat * Math.PI) / 180) / Math.pow(2, zoom);

        // Целевая визуальная ширина линейки (px). Подбирается под типичный размер контрола.
        const targetPx = 170;

        let groundMeters = targetPx * metersPerPx;

        // Округление до "красивого" картографического расстояния (ряд 1, 2, 5)
        const exp = Math.floor(Math.log10(Math.max(groundMeters, 1)));
        const base = Math.pow(10, exp);
        const coeff = groundMeters / base;

        let niceCoeff;
        if (coeff < 1.4) niceCoeff = 1;
        else if (coeff < 2.8) niceCoeff = 2;
        else if (coeff < 7) niceCoeff = 5;
        else niceCoeff = 10;

        let niceMeters = niceCoeff * base;

        // Реальная ширина бара в пикселях для выбранного расстояния
        let barWidth = Math.round(niceMeters / metersPerPx);
        barWidth = Math.max(80, Math.min(260, barWidth));

        // Вычисляем Representative Fraction (1 : N) — военный/топо формат
        // Используем стандартное приближение для 96 DPI
        const denomRaw = Math.round(niceMeters / (barWidth * 0.000264583333));
        // Используем общий список доступных масштабов
        let denom = AVAILABLE_DENOMINATORS[0];
        let bestDiff = Math.abs(denomRaw - denom);
        for (const c of AVAILABLE_DENOMINATORS) {
            const diff = Math.abs(denomRaw - c);
            if (diff < bestDiff) {
                bestDiff = diff;
                denom = c;
            }
        }

        // Форматируем подпись расстояния на линейке
        let distLabel;
        let unit;
        if (niceMeters >= 1000) {
            distLabel = niceMeters >= 10000 ? Math.round(niceMeters / 1000) : (niceMeters / 1000).toFixed(1);
            unit = "км";
        } else {
            distLabel = Math.round(niceMeters);
            unit = "м";
        }

        // 4 сегмента — классика топографических карт (чередование двух цветов)
        const numSegments = 4;
        const segmentWidth = Math.floor(barWidth / numSegments);

        setScale({
            denom,
            barWidth,
            distLabel,
            unit,
            numSegments,
            segmentWidth
        });
    }, [map, isFullscreen]);

    useEffect(() => {
        if (!map) return undefined;

        const scheduleUpdate = () => {
            // Небольшой debounce, чтобы не дёргалось во время зума/перемещения.
            // Отменяем предыдущий таймер, иначе при быстром зуме/пане они копятся.
            if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
            scaleTimeoutRef.current = setTimeout(updateScale, 60);
        };

        map.on("zoomend", scheduleUpdate);
        map.on("moveend", scheduleUpdate);
        map.on("resize", scheduleUpdate);

        // Первоначальный расчёт
        updateScale();

        return () => {
            map.off("zoomend", scheduleUpdate);
            map.off("moveend", scheduleUpdate);
            map.off("resize", scheduleUpdate);
            if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
        };
    }, [map, updateScale]);

    // Закрываем дропдаун при выходе из fullscreen или при потере карты
    useEffect(() => {
        if (!isFullscreen) {
            setIsDropdownOpen(false);
        }
    }, [isFullscreen]);

    // Закрытие по клику вне + Escape
    useEffect(() => {
        if (!isDropdownOpen) return undefined;

        const handleOutside = (e) => {
            const target = e.target;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(target) &&
                numericRef.current &&
                !numericRef.current.contains(target)
            ) {
                setIsDropdownOpen(false);
            }
        };

        const handleKey = (e) => {
            if (e.key === "Escape") {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("keydown", handleKey);
        };
    }, [isDropdownOpen]);

    const handleNumericClick = (e) => {
        e.stopPropagation();
        if (!isFullscreen) return;
        setIsDropdownOpen((prev) => !prev);
    };

    const handleScaleSelect = (newDenom) => {
        if (!map || !scale || newDenom === scale.denom) {
            setIsDropdownOpen(false);
            return;
        }

        const center = map.getCenter();
        const targetZoom = getZoomForDenominator(newDenom, center.lat);

        if (targetZoom !== null && typeof targetZoom === "number") {
            // Сохраняем центр, меняем зум. Используем flyTo для приятной анимации (короткая).
            map.flyTo(center, targetZoom, { duration: 0.25 });
        }

        setIsDropdownOpen(false);
    };

    if (!isFullscreen || !scale) {
        return null;
    }

    const formatMilitaryScale = (d) => {
        // Военный/топографический формат: 1 : 50 000
        // Поддержка крупных масштабов до 1:3 000 000
        const str = d.toString();
        // Вставляем пробелы каждые 3 цифры справа налево
        const withSpaces = str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return `1 : ${withSpaces}`;
    };

    const segments = [];
    for (let i = 0; i < scale.numSegments; i += 1) {
        const isDark = i % 2 === 0;
        segments.push(
            <div
                key={i}
                style={{
                    width: `${scale.segmentWidth}px`,
                    height: "7px",
                    backgroundColor: isDark ? "#1f2a38" : "#f4f6f7",
                    // Рамка только на контейнере .map-scale-ruler; здесь только разделительные линии
                    borderRight: i < scale.numSegments - 1 ? "1px solid #3a4654" : "none",
                    boxSizing: "border-box"
                }}
            />
        );
    }

    return (
        <div className="map-scale-bar">
            <div
                className="map-scale-numeric"
                ref={numericRef}
                onClick={handleNumericClick}
                title="Выбрать масштаб"
            >
                {formatMilitaryScale(scale.denom)}
            </div>

            {isDropdownOpen && (
                <div className="map-scale-dropdown" ref={dropdownRef}>
                    {AVAILABLE_DENOMINATORS.map((d) => {
                        const isActive = d === scale.denom;
                        return (
                            <div
                                key={d}
                                className={`map-scale-option${isActive ? " map-scale-option--active" : ""}`}
                                onClick={() => handleScaleSelect(d)}
                            >
                                {formatMilitaryScale(d)}
                            </div>
                        );
                    })}
                </div>
            )}

            <div
                className="map-scale-ruler"
                style={{ width: `${scale.barWidth}px` }}
            >
                {segments}
            </div>
            <div className="map-scale-labels">
                <span>0</span>
                <span>{scale.distLabel}&nbsp;{scale.unit}</span>
            </div>
        </div>
    );
}

// Компонент для инициализации маркеров ВНУТРИ MapContainer
function MarkerInitializer({ objects, selectedIds, onMarkersReady }) {
    // Этот компонент передаёт карту в LabelGeneration
    // LabelGeneration - компонент-обёртка, которая всю кластеризацию делает
    return <LabelGeneration objects={objects} selectedIds={selectedIds} onMarkersReady={onMarkersReady} />;
}

// Компонент для инициализации non-flag маркеров ВНУТРИ MapContainer
function NonFlagMarkerInitializer({ objects, onMarkersReady, selectedIds }) {
    return <NonFlagLabelGeneration objects={objects} onMarkersReady={onMarkersReady} selectedIds={selectedIds} />;
}

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
}) {
    const eventHandlers = useMemo(() => ({
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
    }), [obj.id, measureMode, eventDrawingActive, altAddTargetActive, onEventMapClick, onAltClickAddTarget, onMarkerClick, onMarkerHover]);

    if (!icon) return null;

    return (
        <Marker
            position={[obj.lat, obj.lng]}
            icon={icon}
            draggable={false}
            eventHandlers={eventHandlers}
        />
    );
});

function getFlagMarkerKey(o) {
    const markerId = o.marker?.id ?? 'no-marker';
    return `${o.id}-${markerId}`;
}

function FlagMarkersLayer({ markers, iconsById, measureMode, eventDrawingActive, altAddTargetActive, onEventMapClick, onAltClickAddTarget, onMarkerClick, onMarkerHover }) {
    const visible = useMapViewportMarkers(markers);
    return visible.map((obj) => (
        <FlagMapMarker
            key={getFlagMarkerKey(obj)}
            obj={obj}
            icon={iconsById[obj.id]}
            measureMode={measureMode}
            eventDrawingActive={eventDrawingActive}
            altAddTargetActive={altAddTargetActive}
            onEventMapClick={onEventMapClick}
            onAltClickAddTarget={onAltClickAddTarget}
            onMarkerClick={onMarkerClick}
            onMarkerHover={onMarkerHover}
        />
    ));
}

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
}) {
    const eventHandlers = useMemo(() => ({
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
    ]);

    if (!icon) return null;

    return (
        <Marker
            position={[obj.lat, obj.lng]}
            icon={icon}
            draggable={false}
            eventHandlers={eventHandlers}
        />
    );
});

function NonFlagMarkersLayer({
    groupedObjects,
    iconsById,
    selectedIds,
    currentZoom,
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
}) {
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const candidates = useMemo(() => {
        if (currentZoom < 6) return [];
        return (groupedObjects || []).filter((obj) => !obj.isHidden && selectedSet.has(obj.id));
    }, [groupedObjects, selectedSet, currentZoom]);

    const visible = useMapViewportMarkers(candidates);

    return visible.map((obj) => {
        const markerId = obj.marker?.id ?? 'no-marker';
        const key = obj.isGroupIcon
            ? `non-flag-group-${obj.groupId}`
            : `non-flag-${obj.id}-${markerId}`;
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
            />
        );
    });
}

// Компонент для отображения элементов группы в круге при наведении.
// Оптимизация: React.memo + вычисления зависят только от displayGroupId + groupedObjects.
const GroupCircleDisplay = React.memo(function GroupCircleDisplay({ groupedObjects, hoveredGroupId, pinnedGroupId, onPinGroup, iconsById, svgCache, onMarkerClick, measureMode, eventDrawingActive, altAddTargetActive, onEventMapClick, onAltClickAddTarget, onMarkerHover }) {
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

    // Не рендерим, если нет активной группы или центра
    if (!circleCenter || circleMarkers.length === 0 || !displayGroupId) return null;

    return (
        <>
            {/* Маркеры элементов в круге */}
            {circleMarkers.map((marker, idx) => {
                const markerIcon = circleIcons[marker.id] || (iconsById ? iconsById[marker.id] : null);

                return (
                    <Marker
                        key={`circle-marker-${displayGroupId}-${idx}`}
                        position={[marker.lat, marker.lng]}
                        icon={markerIcon || L.divIcon({
                            html: `<div class="circle-item-marker" style="cursor: pointer; opacity: 0.9;"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${marker.country?.color || '#4CAF50'}" stroke="#FFFFFF" stroke-width="2"/></svg></div>`,
                            className: "circle-item-div-icon",
                            iconSize: [40, 40],
                            iconAnchor: [20, 20]
                        })}
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

 // Компонент для отслеживания изменений зума
function ZoomTracker({ onZoomChange }) {
    const map = useMapEvents({
        zoomend: () => {
            const zoom = map.getZoom();
            onZoomChange(zoom);

            // Debug: значение масштаба (zoom), используемое в текущий момент для запроса тайлов
            const center = map.getCenter();
            const metersPerPx = 156543.03392 * Math.cos((center.lat * Math.PI) / 180) / Math.pow(2, zoom);

            // Простой расчёт Representative Fraction (аналогично MapScaleBar)
            const denomRaw = Math.round(metersPerPx / 0.000264583333);
            let denom = AVAILABLE_DENOMINATORS[0];
            let bestDiff = Math.abs(denomRaw - denom);
            for (const c of AVAILABLE_DENOMINATORS) {
                const diff = Math.abs(denomRaw - c);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    denom = c;
                }
            }
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
function MapEventBridge({ apiRef }) {
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

function MapComponent({
    // ...existing code...
    objects,
    zoneObjects = [],
    selectedObj,
    events = [],
    selectedEventIds = [],
    mapRef,
    measureMode = false,
    measurements = [],
    onAddMeasurePoint,
    onCheckboxChange = () => {},
    showActionRadius: externalShowActionRadius = false,
    actionTypes = [],
    actionRadiusMode: _actionRadiusMode = "animation",
    onActionRadiusModeChange: _onActionRadiusModeChange,
    intersections = [],
    selectedIntersections = [],
    onIntersectionToggle,
    onSelectAllIntersections,
    isFullscreen,
    setIsFullscreen,
    // Подняты в Formular (sidebar панель управления)
    actionZoneFilters = {},
    showZoneIntersections = false,
    // Дополнительные для полной поддержки панели "Настройка отображения" в fs map_sidebar (Features)
    // (раньше не передавались в fs-ветку — слабое место, из-за которого панель не появлялась).
    actionZoneAvailableByCountry = {},
    setShowZoneIntersections,
    toggleZoneLeaf,
    toggleAllForActionType,
    toggleAllForCountry,
    resetZoneFilters,
    globalActionTypeCatalog = [],
    equipmentZoneDiagnostics = [],
    quickSelectLeaves = new Set(),
    quickSelectCountries = new Set(),
    quickSelectCombo = new Set(),
    toggleQuickSelectLeaf,
    toggleAllQuickSelectLeavesForType,
    setAllQuickSelectLeaves,
    toggleQuickSelectCountry,
    setAllQuickSelectCountries,
    considerTerrain = true,
    onConsiderTerrainChange,
    losGeometryByZoneKey = {},
    losComputingCount = 0,
    losZonesCount = 0,
    visibleZones = null,
    // ...existing code...
    onMeasureModeChange,
    onMeasurePointsChange,
    onShowActionRadiusChange: _onShowActionRadiusChange,
    onTableTabChange,
    onMarkerClick,
    onMarkerHover,
    onAltClickAddTarget,
    onEditClick,
    onTargetOpenDetails,
    canEditCountry = false,
    onDeleteClick,
    onEventSave,
    filterCountry = [],
    onFilterCountryChange,
    filterType = [],
    onFilterTypeChange,
    filterTitle = "",
    onFilterTitleChange,
    targetTypes = [],
    countriesList = [],
    eventTypesList = [],
    eventsFilters = { title: "", dateFrom: "", dateTo: "", timeFrom: "", timeTo: "", countries: [], eventTypes: [] },
    onEventsFiltersChange = () => {},
    onEventCheckboxChange,
    onEventDelete,
    onEventFlyTo,
    onEventEdit = () => {},
    editEventDrawMode = null,
    editEventDrawPoints = [],
    onEditEventDrawPointsChange = () => {},
    isEditEventMode = false,
    polygonDrawSession = null,
    onPolygonDrawPointsChange = () => {},
    onPolygonDrawComplete = () => {},
    onPolygonDrawCancel = () => {},
    tableTab,
    situations = [],
    selectedSituationIds = [],
    activeSituationId = null,
    timelineRevisionId = null,
    situationRevisions = [],
    onSituationClick = () => {},
    isSituationDrawActive = false,
    situationDrawPoints = [],
    onSituationDrawPointsChange = () => {},
    onSituationDrawConfirm = () => {},
    onSituationDrawCancel = () => {},
    detailSituation = null,
    onSituationDetailClose = () => {},
    onSituationEdit,
    onSituationNewState,
    onSituationRevisionSelect = () => {},
    situationsFilters = { title: '', dateFrom: '', dateTo: '', countries: [] },
    onSituationsFiltersChange = () => {},
    onSituationCheckboxChange,
    onSituationDelete,
    onSituationFlyTo,
    onSituationCreate,
    highlightedSituationId = null,
    onSituationRowClick,
    activeSituationTimeline = [],
    onTimelineRevisionSelect = () => {},
    onTimelineRevisionEdit,
    onTimelineRevisionDelete,
    canEditSituations = false,
    canDeleteSituations = false,
    isSituationModalOpen = false,
    editingSituationId = null,
    canReadSituations = true,
}) {
    const zoneObjectsSource = zoneObjects.length > 0 ? zoneObjects : objects;

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const maplibreMapRef = useRef(null);
    const [maplibreReady, setMaplibreReady] = useState(false);
    const [vectorMapError, setVectorMapError] = useState(null);
    const { enabledById: overlayEnabledById, toggleLayer: toggleOverlayLayer, setAllLayers: setAllOverlayLayers, activeLayers: activeOverlayLayers } = useMapOverlayLayers(maplibreMapRef, maplibreReady);
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [isMeasureMenuOpen, setIsMeasureMenuOpen] = useState(false);
    const [measurePoints, setMeasurePoints] = useState([]);
    const [currentZoom, setCurrentZoom] = useState(4);
    const [hoveredZoneList, setHoveredZoneList] = useState([]);
    const [pinnedZonePanel, setPinnedZonePanel] = useState(null);
    const [selectedZoneEntryId, setSelectedZoneEntryId] = useState(null);
    const [activeZonePopup, setActiveZonePopup] = useState(null);
    const [activeZonePopupVersion, setActiveZonePopupVersion] = useState(0);
    const [geoData, setGeoData] = useState(null);
    const [markerData, setMarkerData] = useState({ iconsById: {}, clusteredObjects: [] });
    const [nonFlagData, setNonFlagData] = useState({ iconsById: {}, groupedObjects: [], svgCache: new Map() });
    const [hoveredGroupId, setHoveredGroupId] = useState(null);
    const [pinnedGroupId, setPinnedGroupId] = useState(null);
    const [selectedCountryIso, setSelectedCountryIso] = useState(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [hoveredTargetId, setHoveredTargetId] = useState(null);
    const [markerVersion, setMarkerVersion] = useState(0);

    const handleMaplibreReady = useCallback((map) => {
        maplibreMapRef.current = map;
        setVectorMapError(null);
        setMaplibreReady(true);
    }, []);

    const handleMaplibreError = useCallback((message) => {
        setVectorMapError(message);
    }, []);

    // Stable Set for O(1) lookups in heavy filters / renders (avoids .includes on every item during flyTo re-renders etc)
    const [fullscreenTab, setFullscreenTab] = useState("objects");
    const handleFullscreenTabChange = useCallback((tab) => {
        setFullscreenTab(tab);
        onTableTabChange?.(tab);
    }, [onTableTabChange]);

    const selectedSet = useMemo(() => new Set(selectedObj), [selectedObj]);
    const selectedEventIdSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds]);
    const visibleMapEvents = useMemo(
        () => events.filter((item) => selectedEventIdSet.has(item.id)),
        [events, selectedEventIdSet],
    );
    const [eventMarkerSvgs, setEventMarkerSvgs] = useState(new Map());
    const eventMarkerFetchRef = useRef(new Set());
    const isEventPointDraggingRef = useRef(false);
    const isEventPointPointerDownRef = useRef(false);
    const cursorCoordsRef = useRef(null);
    const skipZoneHoverUpdatesRef = useRef(false);
    const suppressNextMapClickRef = useRef(false);
    const mapEventApiRef = useRef({});
    const countryClickApiRef = useRef({});
    const altAddTargetApiRef = useRef({});
    const zoneHoverControllerRef = useRef(null);
    if (!zoneHoverControllerRef.current) {
        zoneHoverControllerRef.current = createZoneHoverController();
    }
    const lastMarkerHoverRef = useRef(null);
    const prevIsFullscreenRef = useRef(false);
    const center = [51.1833, 71.4167];
    const containerRef = useRef(null);
    const sidebarRef = useRef(null);
    const measureMenuRef = useRef(null);

    useEffect(() => {
        skipZoneHoverUpdatesRef.current = Boolean(pinnedZonePanel);
    }, [pinnedZonePanel]);

    // Ограничение движения карты по оси Y (чтобы нельзя было уехать за полюса)
    const mapMaxBounds = [[-85.0511287798, -180], [85.0511287798, 180]];

    const isEventEditModeActive = isEditEventMode && !!editEventDrawMode;
    const eventsTabActive = tableTab === 'events';
    const eventsDrawingEnabled = eventsTabActive || isEventEditModeActive;

    const eventDrawing = useEventDrawing({
        enabled: eventsDrawingEnabled,
        isEditMode: isEventEditModeActive,
        drawMode: editEventDrawMode,
        drawPoints: editEventDrawPoints,
        onDrawPointsChange: onEditEventDrawPointsChange,
    });

    const isPolygonDrawActive = Boolean(polygonDrawSession);
    const isSituationPolygonEditEnabled = isSituationDrawActive || isSituationModalOpen;
    const isSituationDrawingActive = isSituationPolygonEditEnabled
        && (tableTab === 'situations' || isSituationModalOpen);
    const polygonSessionPoints = polygonDrawSession?.points ?? EMPTY_DRAW_POINTS;
    const situationSessionPoints = situationDrawPoints ?? EMPTY_DRAW_POINTS;
    const polygonDrawing = useEventDrawing({
        enabled: isPolygonDrawActive,
        isEditMode: true,
        drawMode: 'polygon',
        drawPoints: polygonSessionPoints,
        onDrawPointsChange: onPolygonDrawPointsChange,
    });
    const situationDrawing = useEventDrawing({
        enabled: isSituationDrawingActive,
        isEditMode: true,
        drawMode: 'polygon',
        drawPoints: situationSessionPoints,
        onDrawPointsChange: onSituationDrawPointsChange,
        // While creating a new contour (before modal opens), keep drawing open-ended
        // like Events "Произвольная форма" until user finishes explicitly.
        autoClosePolygon: isSituationModalOpen,
    });

    const [eventPolygonEditable, setEventPolygonEditable] = useState([]);
    const [zonePolygonEditable, setZonePolygonEditable] = useState([]);
    const [situationPolygonEditable, setSituationPolygonEditable] = useState([]);
    const skipEventPolygonSyncRef = useRef(false);
    const skipZonePolygonSyncRef = useRef(false);
    const skipSituationPolygonSyncRef = useRef(false);

    const eventDrawPointsKey = drawPointsKey(eventDrawing.drawPoints);
    const zoneDrawPointsKey = drawPointsKey(polygonDrawing.drawPoints);
    const situationDrawPointsKey = drawPointsKey(situationDrawing.drawPoints);

    useEffect(() => {
        if (eventDrawing.drawMode !== 'polygon') {
            setEventPolygonEditable((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        if (skipEventPolygonSyncRef.current) {
            skipEventPolygonSyncRef.current = false;
            return;
        }
        const next = drawPointsToEditable(eventDrawing.drawPoints);
        const nextKey = editablePointsKey(next);
        setEventPolygonEditable((prev) => (
            editablePointsKey(prev) === nextKey ? prev : next
        ));
    }, [eventDrawing.drawMode, eventDrawPointsKey, eventDrawing.drawPoints]);

    useEffect(() => {
        if (!isPolygonDrawActive) {
            setZonePolygonEditable((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        if (skipZonePolygonSyncRef.current) {
            skipZonePolygonSyncRef.current = false;
            return;
        }
        const next = drawPointsToEditable(polygonDrawing.drawPoints);
        const nextKey = editablePointsKey(next);
        setZonePolygonEditable((prev) => (
            editablePointsKey(prev) === nextKey ? prev : next
        ));
    }, [isPolygonDrawActive, zoneDrawPointsKey, polygonDrawing.drawPoints]);

    useEffect(() => {
        if (!isSituationDrawingActive) {
            setSituationPolygonEditable((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        if (skipSituationPolygonSyncRef.current) {
            skipSituationPolygonSyncRef.current = false;
            return;
        }
        const next = drawPointsToEditable(situationDrawing.drawPoints);
        const nextKey = editablePointsKey(next);
        setSituationPolygonEditable((prev) => (
            editablePointsKey(prev) === nextKey ? prev : next
        ));
    }, [isSituationDrawingActive, situationDrawPointsKey, situationDrawing.drawPoints]);

    const replaceEventDrawPointsRef = useRef(eventDrawing.replaceDrawPoints);
    replaceEventDrawPointsRef.current = eventDrawing.replaceDrawPoints;
    const replaceZoneDrawPointsRef = useRef(polygonDrawing.replaceDrawPoints);
    replaceZoneDrawPointsRef.current = polygonDrawing.replaceDrawPoints;
    const replaceSituationDrawPointsRef = useRef(situationDrawing.replaceDrawPoints);
    replaceSituationDrawPointsRef.current = situationDrawing.replaceDrawPoints;

    const handleEventPolygonCoordChange = useCallback((editable) => {
        setEventPolygonEditable(editable);
        skipEventPolygonSyncRef.current = true;
        replaceEventDrawPointsRef.current(parseLatLngPoints(editable) || []);
    }, []);

    const handleZonePolygonCoordChange = useCallback((editable) => {
        setZonePolygonEditable(editable);
        skipZonePolygonSyncRef.current = true;
        replaceZoneDrawPointsRef.current(parseLatLngPoints(editable) || []);
    }, []);

    const handleSituationPolygonCoordChange = useCallback((editable) => {
        setSituationPolygonEditable(editable);
        skipSituationPolygonSyncRef.current = true;
        replaceSituationDrawPointsRef.current(parseLatLngPoints(editable) || []);
    }, []);

    const eventPolygonCoordError = useMemo(() => {
        if (eventDrawing.drawMode !== 'polygon' || !eventPolygonEditable.length) return null;
        return validateEditablePolygonPoints(eventPolygonEditable);
    }, [eventDrawing.drawMode, eventPolygonEditable]);

    const zonePolygonCoordError = useMemo(() => {
        if (!isPolygonDrawActive || !zonePolygonEditable.length) return null;
        return validateEditablePolygonPoints(zonePolygonEditable);
    }, [isPolygonDrawActive, zonePolygonEditable]);

    const situationPolygonCoordError = useMemo(() => {
        if (!isSituationDrawingActive || !situationPolygonEditable.length) return null;
        return validateEditablePolygonPoints(situationPolygonEditable);
    }, [isSituationDrawingActive, situationPolygonEditable]);

    // Пересоздаём маркеры только при изменении полного набора объектов, а не при filterCountry на карте
    const objectsDataKey = useMemo(() => {
        const source = zoneObjects.length > 0 ? zoneObjects : objects;
        return source
            .map((o) => `${o.id}:${o.marker?.id ?? ''}:${o.lat}:${o.lng}`)
            .join('|');
    }, [zoneObjects, objects]);

    useEffect(() => {
        clearMarkerIconCache();
        clearEnrichSvgCache();
        setMarkerVersion(prev => prev + 1);
        setMarkerData({ iconsById: {}, clusteredObjects: [] });
        setNonFlagData({ iconsById: {}, groupedObjects: [], svgCache: new Map() });
    }, [objectsDataKey]);

    useEffect(() => {
        const markersToFetch = new Map();

        events.forEach((eventItem) => {
            const marker = eventItem?.marker;
            if (!marker?.id || !marker.path) return;
            if (eventMarkerFetchRef.current.has(marker.id)) return;
            markersToFetch.set(marker.id, marker.path);
            eventMarkerFetchRef.current.add(marker.id);
        });

        markersToFetch.forEach((path, id) => {
            fetch(path)
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Failed to load marker svg: ${path}`);
                    }
                    return res.text();
                })
                .then((svgText) => {
                    setEventMarkerSvgs((prev) => {
                        const next = new Map(prev);
                        next.set(id, svgText);
                        return next;
                    });
                })
                .catch(() => {
                    eventMarkerFetchRef.current.delete(id);
                });
        });
    }, [events]);

    // Синхронизация состояний при переключении режимов
    useEffect(() => {
        if (isFullscreen && !prevIsFullscreenRef.current) {
            setIsMeasureMode(measureMode);
            setMeasurePoints(measurements);
        } else if (!isFullscreen && prevIsFullscreenRef.current) {
            if (onMeasureModeChange) {
                onMeasureModeChange(isMeasureMode);
            }
            if (onMeasurePointsChange) {
                onMeasurePointsChange(measurePoints);
            }
        }
        prevIsFullscreenRef.current = isFullscreen;
    }, [isFullscreen, measureMode, measurements, isMeasureMode, measurePoints, onMeasureModeChange, onMeasurePointsChange]);

    useEffect(() => {
        if (isFullscreen && tableTab) {
            setFullscreenTab(tableTab);
        }
    }, [isFullscreen, tableTab]);

    const showActionRadius = externalShowActionRadius;
    const effectiveMeasureMode = isFullscreen ? isMeasureMode : measureMode;
    const effectiveMeasurePoints = isFullscreen ? measurePoints : measurements;

    const handleSelectEventTool = useCallback((tool) => {
        if (effectiveMeasureMode) {
            if (isFullscreen) {
                setIsMeasureMode(false);
            }
            onMeasureModeChange?.(false);
        }
        eventDrawing.selectTool(tool);
    }, [effectiveMeasureMode, isFullscreen, onMeasureModeChange, eventDrawing]);

    const handleEventConfirm = useCallback(() => {
        if (eventDrawing.validateBeforeSave()) return;
        setIsEventModalOpen(true);
    }, [eventDrawing]);

    const handleEventCancel = useCallback(() => {
        eventDrawing.clearDraft();
        setIsEventModalOpen(false);
    }, [eventDrawing]);

    const isEventDrawingActive = eventsDrawingEnabled && Boolean(eventDrawing.drawMode);
    const isMapDrawingActive = isEventDrawingActive || isPolygonDrawActive || isSituationDrawingActive;
    const activeMapDrawing = isPolygonDrawActive
        ? polygonDrawing
        : isSituationDrawingActive
            ? situationDrawing
            : eventDrawing;

    const handleEventMapClick = useCallback((latlng, map) => {
        if (!isMapDrawingActive) return;
        if (isEventPointDraggingRef.current || isEventPointPointerDownRef.current) return;
        activeMapDrawing.handleMapClick(latlng, map || mapRef.current);
    }, [isMapDrawingActive, activeMapDrawing]);

    const handleEventMapDblClick = useCallback((latlng, map) => {
        if (!isMapDrawingActive) return false;
        if (isEventPointDraggingRef.current || isEventPointPointerDownRef.current) return false;
        return activeMapDrawing.handleMapDblClick(latlng, map || mapRef.current);
    }, [isMapDrawingActive, activeMapDrawing]);

    const handleMarkerClickGuarded = useCallback((id) => {
        if (isMapDrawingActive) return;
        onMarkerClick?.(id);
    }, [isMapDrawingActive, onMarkerClick]);

    const handleAltClickAddTarget = useCallback((payload) => {
        setSelectedCountryIso(null);
        onAltClickAddTarget?.(payload);
    }, [onAltClickAddTarget]);

    const isAltAddTargetActive = !isMapDrawingActive && Boolean(onAltClickAddTarget);

    countryClickApiRef.current.isEventDrawingActive = isMapDrawingActive;
    countryClickApiRef.current.handleEventMapClick = handleEventMapClick;
    countryClickApiRef.current.setSelectedCountryIso = setSelectedCountryIso;
    countryClickApiRef.current.onAltClickAddTarget = handleAltClickAddTarget;

    altAddTargetApiRef.current.isEventDrawingActive = isMapDrawingActive;
    altAddTargetApiRef.current.onAltClickAddTarget = handleAltClickAddTarget;

    useEffect(() => {
        if (isMapDrawingActive) {
            setSelectedCountryIso(null);
        }
    }, [isMapDrawingActive]);

    // Cleanup zone panel when the "Зона действия" tool is turned off
    useEffect(() => {
        if (!showActionRadius) {
            setPinnedZonePanel(null);
            setSelectedZoneEntryId(null);
            setHoveredZoneList([]);
            setActiveZonePopup(null);
            zoneHoverControllerRef.current?.clear();
        }
    }, [showActionRadius]);

    // Zoom-based marker filtering (supplemented):
    // - For flag markers: graduated by zoom
    //   <=5 : only order <=2
    //   <=7 : order <=7
    //   >7  : all
    // - For non-flag markers: always all (no zoom/order restriction)
    const flagObjectsForMap = useMemo(() => {
      if (currentZoom > 7) {
        return objects;
      }
      const maxOrder = currentZoom <= 5 ? 2 : 7;
      return objects.filter((obj) => {
        const ord = parseInt(obj.marker?.order ?? 999, 10);
        return ord <= maxOrder;
      });
    }, [objects, currentZoom]);

    // non-flag markers should be visible only starting from zoom 6 (inclusive)
    // hide when decreasing zoom below 6
    const nonFlagObjectsForMap = useMemo(() => {
      if (currentZoom < 6) {
        return [];
      }
      return objects;  // all non-flag markers from 6+
    }, [objects, currentZoom]);

    // Force-clear nonFlagData when zooming out below 6.
    // The NonFlagMarkerInitializer may not emit a "clear" when its objects prop shrinks,
    // so we ensure the rendered non-flag markers (and GroupCircle) disappear.
    useEffect(() => {
      if (currentZoom < 6) {
        setNonFlagData({ iconsById: {}, groupedObjects: [], svgCache: new Map() });
      }
    }, [currentZoom]);

    // Зоны действия: состояния фильтров (actionZoneFilters, showZoneIntersections) и UI панели
    // теперь живут в Formular (sidebar). Здесь только потребление переданных props для рендера зон и точек.
    // (логика toggle/синхронизации и доступные типы — в родителе)

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                if (pinnedZonePanel) {
                    setPinnedZonePanel(null);
                    setSelectedZoneEntryId(null);
                    setHoveredZoneList([]);
                    setActiveZonePopup(null);
                    zoneHoverControllerRef.current?.clear();
                } else if (pinnedGroupId) {
                    setPinnedGroupId(null);
                }
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc)
    }, [pinnedGroupId, pinnedZonePanel]);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (mapRef.current) {
                setTimeout(() => {
                    if (mapRef.current) {
                        mapRef.current.invalidateSize();
                    }
                }, 0);
            }
        });
        if (containerRef.current) {
            observer.observe(containerRef.current)
        }
        return () => {
            observer.disconnect();
        }
    }, []);

    useEffect(() => {
        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }
    }, [isFullscreen]);

    useEffect(() => {
        // Click outside sidebar detection
        const handleClickOutside = (e) => {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
                setIsSidebarOpen(false);
            }
        };
        
        if (isFullscreen && isSidebarOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isFullscreen, isSidebarOpen]);

    useEffect(() => {
        // Click outside measure menu detection
        const handleClickOutside = (e) => {
            if (measureMenuRef.current && !measureMenuRef.current.contains(e.target)) {
                setIsMeasureMenuOpen(false);
            }
        };
        
        if (isMeasureMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isMeasureMenuOpen]);

    useEffect(() => {
        fetch("/geo/custom.geo.json")
            .then((res) => {
                if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`);
                return res.json();
            })
            .then(setGeoData)
            .catch((err) => console.warn("Не удалось загрузить границы стран:", err));
    }, []);

    const onEachCountry = useCallback((feature, layer) => {
        const featureId = feature.id || feature.prperties?.id;
        const countryIso = feature.properties?.ISO_A2 || feature.properties?.iso_a2 || feature.id;

        layer.on({
            click: (e) => {
                const api = countryClickApiRef.current;
                if (api.isEventDrawingActive) {
                    L.DomEvent.stopPropagation(e);
                    api.handleEventMapClick?.(e.latlng, e.target._map);
                    return;
                }
                if (e.originalEvent?.altKey && api.onAltClickAddTarget) {
                    L.DomEvent.stopPropagation(e);
                    api.onAltClickAddTarget({
                        lat: e.latlng.lat,
                        lng: e.latlng.lng,
                        countryIso,
                    });
                    return;
                }
                // Не открываем модальное окно если нажат Ctrl (в режиме измерения для добавления точки)
                if (e.originalEvent.ctrlKey) {
                    return;
                }
                api.setSelectedCountryIso?.(countryIso);
            }
        })
        layer.on({
            mouseover: (e) => e.target.setStyle({fillOpacity: 0.1, color: "#85d5f5"}),
            mouseout: (e) => e.target.setStyle({fillOpacity: 0, color: "#FFFFFF"})  
        });
        layer.featureId = featureId;
    }, []);

    const countryStyle = useMemo(() => ({
        color: "#FFFFFF",
        weight: 0,
        fillOpacity: 0
    }), []);
    
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    }

    const handleMarkersReady = useCallback((data) => {
        setMarkerData(data);
    }, []);

    const handleNonFlagMarkersReady = useCallback((data) => {
        setNonFlagData(data);
    }, []);

    // Используем clusteredObjects для отображения маркеров (с примененными офсетами)
    // Исключаем non-flag объекты - они будут отображаться отдельно
    // Memoized + use a Set for O(1) selected check to reduce work on re-renders
    const displayedObjectsForMarkers = useMemo(() => {
        return (markerData.clusteredObjects || []).filter(obj => 
            selectedSet.has(obj.id) && isFlagMarker(obj)
        );
    }, [markerData.clusteredObjects, selectedSet]);

    const handleMeasureAddPoint = ({ lat, lng }) => {
        setMeasurePoints((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, lat, lng }]);
    };

    // Единый обработчик клика по карте для MapEventBridge.
    // Сохраняем в ref (переприсваивание дёшево и не вызывает перемонтирования
    // моста). Три независимых блока полностью повторяют прежние отдельные
    // обработчики (клик по карте, режим измерения, контекст события) и порядок
    // их срабатывания — каждый блок изолирован своим замыканием, чтобы `return`
    // прерывал только свою секцию, как это было у отдельных useMapEvents.
    mapEventApiRef.current.onClick = (e, map) => {
        // 1) Клик по карте: закрытие меню группы / панели зон
        (() => {
            if (suppressNextMapClickRef.current) {
                suppressNextMapClickRef.current = false;
                return;
            }
            if (pinnedGroupId) {
                setPinnedGroupId(null);
                setHoveredGroupId(null);
            }
            setPinnedGroupId(null);
            handleZonePanelClose();
        })();

        // 2) Режим измерения: Ctrl+клик добавляет точку
        (() => {
            const isActive = effectiveMeasureMode;
            const onAddPoint = isFullscreen ? handleMeasureAddPoint : onAddMeasurePoint;
            if (!isActive || !onAddPoint) return;
            if (!e.originalEvent || !e.originalEvent.ctrlKey) return;
            const { lat, lng } = e.latlng;
            onAddPoint({ lat, lng });
        })();

        // 3) Рисование события: клик по карте при выбранном инструменте
        (() => {
            handleEventMapClick(e.latlng, map);
        })();

        // 4) Alt+клик: добавление объекта
        (() => {
            const api = altAddTargetApiRef.current;
            if (!e.originalEvent?.altKey || api.isEventDrawingActive || !api.onAltClickAddTarget) return;
            api.onAltClickAddTarget({
                lat: e.latlng.lat,
                lng: e.latlng.lng,
            });
        })();
    };

    mapEventApiRef.current.onDblClick = (e, map) => {
        if (e.originalEvent?.altKey) return false;
        return handleEventMapDblClick(e.latlng, map);
    };

    // Трекер координат курсора (обновляет DOM напрямую, без ре-рендера React).
    mapEventApiRef.current.onMouseMove = (e) => {
        if (isEventPointDraggingRef.current) return;
        if (isEventPointPointerDownRef.current) return;
        if (eventsDrawingEnabled && eventDrawing.drawMode) {
            eventDrawing.handleMapMove(e.latlng);
        }
        if (isPolygonDrawActive) {
            polygonDrawing.handleMapMove(e.latlng);
        }
        if (isSituationDrawingActive) {
            situationDrawing.handleMapMove(e.latlng);
        }
        const el = cursorCoordsRef.current;
        if (!el) return;
        el.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        el.style.display = 'block';
    };
    mapEventApiRef.current.onMouseOut = () => {
        const el = cursorCoordsRef.current;
        if (el) el.style.display = 'none';
    };

    // Новый обработчик hover: синхронизирует локальное состояние и родительский callback
    const handleMarkerHover = useCallback((targetId) => {
        if (isMapDrawingActive) return;
        if (skipZoneHoverUpdatesRef.current) return;
        if (lastMarkerHoverRef.current === targetId) return;
        lastMarkerHoverRef.current = targetId;
        zoneHoverControllerRef.current?.setHovered(targetId ? [targetId] : []);
        onMarkerHover?.(targetId);
    }, [onMarkerHover, isMapDrawingActive]);

    const updateGroupHover = useCallback((groupId) => {
        if (isMapDrawingActive) return;
        if (skipZoneHoverUpdatesRef.current) return;
        setHoveredGroupId(groupId);
        if (!groupId) {
            zoneHoverControllerRef.current?.clear();
            return;
        }
        const memberIds = (nonFlagData.groupedObjects || [])
            .filter((o) => o.groupId === groupId && !o.isGroupIcon && o.id)
            .map((o) => o.id);
        zoneHoverControllerRef.current?.setHovered(memberIds);
    }, [nonFlagData.groupedObjects, isMapDrawingActive]);

    const handleZonePanelClose = useCallback(() => {
        setPinnedZonePanel(null);
        setSelectedZoneEntryId(null);
        setHoveredZoneList([]);
        setActiveZonePopup(null);
        zoneHoverControllerRef.current?.clear();
    }, []);

    const handleZonePopupClose = useCallback(() => {
        setActiveZonePopup(null);
    }, []);

    const handleZoneHoverChange = useCallback((candidates) => {
        if (!isFullscreen || pinnedZonePanel) {
            if (!pinnedZonePanel) setHoveredZoneList([]);
            return;
        }
        const list = candidates || [];
        setHoveredZoneList((prev) => {
            if (prev.length === list.length && prev.every((z, i) => z.entryId === list[i]?.entryId)) {
                return prev;
            }
            return list;
        });
    }, [isFullscreen, pinnedZonePanel]);

    useEffect(() => {
        if (!isFullscreen) {
            setHoveredZoneList([]);
            setPinnedZonePanel(null);
            setSelectedZoneEntryId(null);
            setActiveZonePopup(null);
            zoneHoverControllerRef.current?.clear();
        }
    }, [isFullscreen]);

    const handleZonePanelSelect = useCallback((entryId) => {
        setSelectedZoneEntryId(entryId);
        zoneHoverControllerRef.current?.setHoveredEntries([entryId]);
        const zone = pinnedZonePanel?.zones?.find((z) => z.entryId === entryId);
        const payload = buildZonePopupPayload(zone);
        if (payload) {
            setActiveZonePopup(payload);
            setActiveZonePopupVersion((v) => v + 1);
        }
    }, [pinnedZonePanel]);

    const handleZoneClickAt = useCallback((e, candidates) => {
        if (isMapDrawingActive) {
            handleEventMapClick(e.latlng, e.target?._map);
            return;
        }
        if (!candidates?.length || !isFullscreen) return;

        suppressNextMapClickRef.current = true;

        const chosen = candidates[0];
        // Клик по зоне должен ВЫДЕЛИТЬ объект (checked=true). Ранее вызывалось
        // без второго аргумента, из-за чего toggleIdInList трактовал checked как
        // false и пытался снять выделение — объект не выбирался.
        if (onCheckboxChange && !selectedSet.has(chosen.obj.id)) {
            onCheckboxChange(chosen.obj.id, true);
        }

        setPinnedZonePanel({ zones: candidates });
        setHoveredZoneList(candidates);
        setSelectedZoneEntryId(null);
        setActiveZonePopup(null);
        zoneHoverControllerRef.current?.setHoveredEntries(candidates.map((z) => z.entryId));
    }, [isFullscreen, onCheckboxChange, selectedSet, isMapDrawingActive, handleEventMapClick]);

    const createMeasureIcon = (label) => L.divIcon({
        className: "measure-marker",
        html: `<div class="measure-marker__circle">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const formatDistance = (meters) => {
        if (!meters) return "0 м";
        return meters >= 1000 ? `${(meters / 1000).toFixed(2)} км` : `${meters.toFixed(0)} м`;
    };

    const renderEventShape = (eventItem) => {
        const shape = eventItem?.shape;
        if (!shape || !shape.type) return null;

        const layerInteraction = isMapDrawingActive
            ? { interactive: false, bubblingMouseEvents: false }
            : {};

        const dateLabel = eventItem.date_start
            ? `с ${eventItem.date_start}${eventItem.date_end ? ` по ${eventItem.date_end}` : ""}`
            : "—";
        const timeLabel = eventItem.time_start
            ? `с ${eventItem.time_start}${eventItem.time_end ? ` по ${eventItem.time_end}` : ""}`
            : "—";
        const countryTitle = eventItem.country?.title || "—";
        const objectName = eventItem.object_name || "—";
        const description = eventItem.description?.trim() || "";
        const markerPath = eventItem.marker?.path;
        const markerSvg = eventItem.marker?.id ? eventMarkerSvgs.get(eventItem.marker.id) : null;
        const eventColor = eventItem.color || "#2f80ed";
        const popupContent = (
            <Popup
                autoPan={false}
                closeOnClick={false}
                className="event-popup"
                eventHandlers={{
                    click: (e) => e.originalEvent?.stopPropagation(),
                    mousedown: (e) => e.originalEvent?.stopPropagation()
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <strong>{eventItem.title || "Событие"}</strong>
                    <br />
                    Объект: {objectName}
                    <br />
                    Страна: {countryTitle}
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

        const getEventMarkerIcon = (path, svg) => {
            const content = svg
                ? `<div class="event-marker-icon__wrap event-marker-icon__svg">${svg}</div>`
                : path
                    ? `<div class="event-marker-icon__wrap"><img src="${path}" alt="event-marker" /></div>`
                    : `<div class="event-marker-icon__fallback"></div>`;
            return L.divIcon({
                className: "event-marker-icon",
                html: content,
                iconSize: [28, 28],
                iconAnchor: [14, 28]
            });
        };

        const getEventMarkerPosition = () => {
            if (shape.type === "point" && shape.geometry) {
                return [shape.geometry.lat, shape.geometry.lng];
            }
            if (shape.type === "circle" && shape.geometry) {
                return [shape.geometry.lat, shape.geometry.lng];
            }
            if (shape.type === "area" && shape.geometry?.points?.length > 0) {
                const sum = shape.geometry.points.reduce(
                    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
                    { lat: 0, lng: 0 }
                );
                return [sum.lat / shape.geometry.points.length, sum.lng / shape.geometry.points.length];
            }
            return null;
        };

        if (shape.type === "point" && shape.geometry) {
            const icon = getEventMarkerIcon(markerPath, markerSvg);
            return (
                <Marker
                    key={`event-point-${eventItem.id}`}
                    position={[shape.geometry.lat, shape.geometry.lng]}
                    icon={icon}
                    {...layerInteraction}
                >
                    {popupContent}
                </Marker>
            );
        }

        if (shape.type === "circle" && shape.geometry) {
            const icon = getEventMarkerIcon(markerPath, markerSvg);
            const markerPosition = getEventMarkerPosition();
            return (
                <React.Fragment key={`event-circle-${eventItem.id}`}>
                    <Circle
                        center={[shape.geometry.lat, shape.geometry.lng]}
                        radius={shape.geometry.radius || 0}
                        pathOptions={{ color: eventColor, fillColor: eventColor, fillOpacity: 0.2, weight: 1 }}
                        {...layerInteraction}
                    >
                        {popupContent}
                    </Circle>
                    {markerPosition && (
                        <Marker
                            key={`event-circle-marker-${eventItem.id}`}
                            position={markerPosition}
                            icon={icon}
                            {...layerInteraction}
                        />
                    )}
                </React.Fragment>
            );
        }

        if (shape.type === "area" && shape.geometry?.points?.length > 0) {
            const icon = getEventMarkerIcon(markerPath, markerSvg);
            const markerPosition = getEventMarkerPosition();
            return (
                <React.Fragment key={`event-area-${eventItem.id}`}>
                    <Polygon
                        positions={shape.geometry.points.map((p) => [p.lat, p.lng])}
                        pathOptions={{ color: eventColor, fillColor: eventColor, fillOpacity: 0.2, weight: 1 }}
                        {...layerInteraction}
                    >
                        {popupContent}
                    </Polygon>
                    {markerPosition && (
                        <Marker
                            key={`event-area-marker-${eventItem.id}`}
                            position={markerPosition}
                            icon={icon}
                            {...layerInteraction}
                        />
                    )}
                </React.Fragment>
            );
        }

        return null;
    };


    const fullscreenMeasurements = useMemo(() => {
        return measurePoints.map((point, idx) => {
            if (idx === 0) {
                return { ...point, index: idx + 1, distance: 0 };
            }
            const prev = measurePoints[idx - 1];
            return { ...point, index: idx + 1, distance: calcDistanceMeters(prev, point) };
        });
    }, [measurePoints]);

    const handlePolygonDrawConfirm = useCallback(() => {
        if (!polygonDrawing.isReady()) {
            polygonDrawing.validateBeforeSave();
            return;
        }
        onPolygonDrawComplete?.(polygonDrawing.drawPoints);
    }, [polygonDrawing, onPolygonDrawComplete]);

    const handleSituationDrawConfirm = useCallback(() => {
        if (!situationDrawing.isReady()) {
            situationDrawing.validateBeforeSave();
            return;
        }
        onSituationDrawConfirm?.(situationDrawing.drawPoints);
    }, [situationDrawing, onSituationDrawConfirm]);

    const isMapDrawingEvent = isMapDrawingActive;

    return (
        <div
            className={`map ${isFullscreen ? "map--fullscreen": ""}${isMapDrawingEvent ? " map--drawing-event" : ""}`}
            ref={containerRef}
        >
            {vectorMapError && USE_VECTOR_MAP && (
                <div className="map__vector-error" role="alert">
                    Ошибка загрузки векторной карты: {vectorMapError}
                </div>
            )}
            {isFullscreen && isSidebarOpen && (
                <div className="map__sidebar" ref={sidebarRef}>
                    <div className="map__sidebar-header">
                        <h2 className="map__sidebar-title">Инструменты</h2>
                        <button
                            type="button"
                            className="map__sidebar-close"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label="Закрыть"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="map__sidebar-section">
                        <div className="map__measure-menu-wrapper" ref={measureMenuRef}>
                            <button
                                type="button"
                                className={`map__measure-btn${effectiveMeasureMode ? " map__measure-btn--active" : ""}`}
                                onClick={() => setIsMeasureMenuOpen(!isMeasureMenuOpen)}
                            >
                                Инструменты
                                <span className={`map__measure-menu-arrow${isMeasureMenuOpen ? " map__measure-menu-arrow--open" : ""}`}>▼</span>
                            </button>
                            {isMeasureMenuOpen && (
                                <div className="map__measure-menu">
                                    <button
                                        type="button"
                                        className="map__measure-menu-item"
                                        onClick={() => {
                                            setIsMeasureMode((prev) => {
                                                const next = !prev;
                                                if (!next) {
                                                    setMeasurePoints([]);
                                                }
                                                return next;
                                            });
                                            setIsMeasureMenuOpen(false);
                                        }}
                                    >
                                        {effectiveMeasureMode ? '✓ ' : ''}Режим измерения
                                    </button>
                                    <button
                                        type="button"
                                        className="map__measure-menu-item"
                                        onClick={() => {
                                            setMeasurePoints([]);
                                            setIsMeasureMenuOpen(false);
                                        }}
                                        disabled={measurePoints.length === 0}
                                    >
                                        Очистить измерения
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="map__sidebar-section">
                        <MapLayerPanel
                            enabledById={overlayEnabledById}
                            currentZoom={currentZoom}
                            onToggle={toggleOverlayLayer}
                            onSetAll={setAllOverlayLayers}
                        />
                    </div>

                    <div className="map__sidebar-section map__objects-section">
                        <div className="formular__tabs">
                            <button
                                type="button"
                                className={`formular__tab${fullscreenTab === "objects" ? " formular__tab--active" : ""}`}
                                onClick={() => handleFullscreenTabChange("objects")}
                            >
                                Объекты
                            </button>
                            <button
                                type="button"
                                className={`formular__tab${fullscreenTab === "events" ? " formular__tab--active" : ""}`}
                                onClick={() => handleFullscreenTabChange("events")}
                            >
                                События
                            </button>
                            <button
                                type="button"
                                className={`formular__tab${fullscreenTab === "zones" ? " formular__tab--active" : ""}`}
                                onClick={() => handleFullscreenTabChange("zones")}
                            >
                                Зоны действия
                            </button>
                            {canReadSituations && (
                            <button
                                type="button"
                                className={`formular__tab${fullscreenTab === "situations" ? " formular__tab--active" : ""}`}
                                onClick={() => handleFullscreenTabChange("situations")}
                            >
                                Обстановка
                            </button>
                            )}
                        </div>

                        {fullscreenTab === "objects" && (
                            <>
                                <FilterPanel
                                    objects={zoneObjects.length > 0 ? zoneObjects : objects}
                                    targetTypes={targetTypes}
                                    filterCountry={filterCountry}
                                    onFilterCountryChange={onFilterCountryChange}
                                    filterType={filterType}
                                    onFilterTypeChange={onFilterTypeChange}
                                    filterTitle={filterTitle}
                                    onFilterTitleChange={onFilterTitleChange}
                                />
                                <ObjectsTable
                                    data={objects}
                                    targetTypes={targetTypes}
                                    selectedObj={selectedObj}
                                    onCheckboxChange={onCheckboxChange}
                                    onTitleClick={handleMarkerClickGuarded}
                                    hoveredTargetId={hoveredTargetId}
                                    onRowHover={setHoveredTargetId}
                                    onObjectClick={(obj) => {
                                        if (mapRef.current && obj?.lat != null && obj?.lng != null) {
                                            requestAnimationFrame(() => {
                                                if (mapRef.current) {
                                                    mapRef.current.flyTo([obj.lat, obj.lng], 8, {
                                                        duration: 1.0,
                                                        easeLinearity: 0.3
                                                    });
                                                }
                                            });
                                        }
                                    }}
                                    onEditClick={onEditClick}
                                    onDeleteClick={onDeleteClick}
                                />
                            </>
                        )}

                        {fullscreenTab === "events" && (
                            <>
                                <EventsFilterPanel
                                    countries={countriesList}
                                    eventTypes={eventTypesList}
                                    filters={eventsFilters}
                                    onChange={onEventsFiltersChange}
                                />
                                <EventsTable
                                    data={events}
                                    selectedEvents={selectedEventIds}
                                    onCheckboxChange={onEventCheckboxChange}
                                    onFlyTo={onEventFlyTo}
                                    onEdit={onEventEdit}
                                    onDelete={onEventDelete}
                                />
                            </>
                        )}

                        {fullscreenTab === "zones" && (
                            <>
                                <ActionZoneFilters
                                    actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                    actionZoneFilters={actionZoneFilters}
                                    showZoneIntersections={showZoneIntersections}
                                    setShowZoneIntersections={setShowZoneIntersections}
                                    hasEnabledZones={showActionRadius}
                                    toggleZoneLeaf={toggleZoneLeaf}
                                    toggleAllForActionType={toggleAllForActionType}
                                    toggleAllForCountry={toggleAllForCountry}
                                    resetZoneFilters={resetZoneFilters}
                                    globalActionTypeCatalog={globalActionTypeCatalog}
                                    quickSelectLeaves={quickSelectLeaves}
                                    quickSelectCountries={quickSelectCountries}
                                    quickSelectCombo={quickSelectCombo}
                                    toggleQuickSelectLeaf={toggleQuickSelectLeaf}
                                    toggleAllQuickSelectLeavesForType={toggleAllQuickSelectLeavesForType}
                                    setAllQuickSelectLeaves={setAllQuickSelectLeaves}
                                    toggleQuickSelectCountry={toggleQuickSelectCountry}
                                    setAllQuickSelectCountries={setAllQuickSelectCountries}
                                    considerTerrain={considerTerrain}
                                    onConsiderTerrainChange={onConsiderTerrainChange}
                                    losComputingCount={losComputingCount}
                                    losZonesCount={losZonesCount}
                                    equipmentZoneDiagnostics={equipmentZoneDiagnostics}
                                    variant="tab"
                                />
                                {showZoneIntersections && (
                                    <IntersectionTable
                                        intersections={intersections}
                                        selectedIntersections={selectedIntersections}
                                        onIntersectionToggle={onIntersectionToggle}
                                        onSelectAllIntersections={onSelectAllIntersections}
                                    />
                                )}
                            </>
                        )}

                        {fullscreenTab === "situations" && (
                            <>
                                <SituationsFilterPanel
                                    countries={countriesList}
                                    filters={situationsFilters}
                                    onChange={onSituationsFiltersChange}
                                />
                                <SituationsTable
                                    data={situations}
                                    selectedSituations={selectedSituationIds}
                                    onCheckboxChange={onSituationCheckboxChange}
                                    onRowClick={onSituationRowClick}
                                    onFlyTo={onSituationFlyTo}
                                    onEdit={onSituationEdit}
                                    onDelete={onSituationDelete}
                                    onCreate={onSituationCreate}
                                    highlightedSituationId={highlightedSituationId}
                                />
                                {selectedSituationIds.length > 0 ? (
                                    <SituationsTimeline
                                        revisions={activeSituationTimeline}
                                        selectedRevisionId={timelineRevisionId}
                                        onSelectRevision={onTimelineRevisionSelect}
                                        onEditRevision={canEditSituations ? onTimelineRevisionEdit : undefined}
                                        onDeleteRevision={
                                            canEditSituations && canDeleteSituations
                                                ? onTimelineRevisionDelete
                                                : undefined
                                        }
                                        canEdit={canEditSituations}
                                        canDelete={canEditSituations && canDeleteSituations}
                                        sortDirection="asc"
                                        groupBySituation={selectedSituationIds.length > 1}
                                    />
                                ) : (
                                    <p className="situations-timeline__empty">
                                        Выберите обстановку checkbox в таблице
                                    </p>
                                )}
                            </>
                        )}

                    </div>

                    <div className="map__sidebar-section map__features-section">
                        <Features 
                            isMeasureMode={effectiveMeasureMode}
                            measurements={fullscreenMeasurements}
                            onRemovePoint={(id) => {
                                setMeasurePoints((prev) => prev.filter((p) => p.id !== id));
                            }}
                        />
                    </div>
                </div>
            )}
            
            <MapContainer
                ref={mapRef}
                center={center}
                zoom={4}
                minZoom={2}
                maxZoom={19}
                style={{height: "100%", width: "100%"}}
                className={isFullscreen ? "map--fullscreen" : ""}
                maxBounds={mapMaxBounds}
                maxBoundsViscosity={1}
            >
                <ZoomTracker onZoomChange={setCurrentZoom} />
                <MapScaleBar isFullscreen={isFullscreen} />
                <MapEventBridge apiRef={mapEventApiRef} />
                {USE_VECTOR_MAP ? (
                    <MapVectorBaseLayer
                        onMapReady={handleMaplibreReady}
                        onError={handleMaplibreError}
                    />
                ) : (
                    <>
                        <TileLayer
                            url={TILE_RASTER_URL}
                            minZoom={2}
                            maxZoom={19}
                            attribution='&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
                        />
                        <MapOverlayLayers activeLayers={activeOverlayLayers} />
                    </>
                )}
                <MarkerInitializer 
                    key={`markers-v${markerVersion}`}
                    objects={flagObjectsForMap} 
                    selectedIds={selectedObj} 
                    onMarkersReady={handleMarkersReady} 
                />
                <NonFlagMarkerInitializer 
                    key={`nonflag-v${markerVersion}`}
                    objects={nonFlagObjectsForMap} 
                    onMarkersReady={handleNonFlagMarkersReady} 
                    selectedIds={selectedObj} 
                />
                <GroupCircleDisplay 
                    groupedObjects={nonFlagData.groupedObjects} 
                    hoveredGroupId={hoveredGroupId} 
                    pinnedGroupId={pinnedGroupId}
                    onPinGroup={setPinnedGroupId}
                    iconsById={nonFlagData.iconsById}
                    svgCache={nonFlagData.svgCache}
                    onMarkerClick={handleMarkerClickGuarded}
                    measureMode={effectiveMeasureMode}
                    eventDrawingActive={isMapDrawingEvent}
                    altAddTargetActive={isAltAddTargetActive}
                    onEventMapClick={handleEventMapClick}
                    onAltClickAddTarget={handleAltClickAddTarget}
                    onMarkerHover={handleMarkerHover}
                />
                {geoData && (
                        <MemoGeoJSON
                            data={geoData}
                            onEachFeature={onEachCountry}
                            style={countryStyle}
                        />
                )}
                {isMapDrawingEvent && (
                    <EventDraftLayer
                        drawMode={
                            isPolygonDrawActive
                                ? polygonDrawing.drawMode
                                : isSituationDrawingActive
                                    ? situationDrawing.drawMode
                                    : eventDrawing.drawMode
                        }
                        drawPoints={
                            isPolygonDrawActive
                                ? polygonDrawing.drawPoints
                                : isSituationDrawingActive
                                    ? situationDrawing.drawPoints
                                    : eventDrawing.drawPoints
                        }
                        previewPoint={
                            isPolygonDrawActive
                                ? polygonDrawing.previewPoint
                                : isSituationDrawingActive
                                    ? situationDrawing.previewPoint
                                    : eventDrawing.previewPoint
                        }
                        previewRectangle={
                            isPolygonDrawActive
                                ? polygonDrawing.previewRectangle
                                : isSituationDrawingActive
                                    ? situationDrawing.previewRectangle
                                    : eventDrawing.previewRectangle
                        }
                        previewPolygonPositions={
                            isPolygonDrawActive
                                ? polygonDrawing.previewPolygonPositions
                                : isSituationDrawingActive
                                    ? situationDrawing.previewPolygonPositions
                                    : eventDrawing.previewPolygonPositions
                        }
                        polygonClosed={
                            isPolygonDrawActive
                                ? polygonDrawing.polygonClosed
                                : isSituationDrawingActive
                                    ? situationDrawing.polygonClosed
                                    : eventDrawing.polygonClosed
                        }
                        mapRef={mapRef}
                        isEventPointDraggingRef={isEventPointDraggingRef}
                        isEventPointPointerDownRef={isEventPointPointerDownRef}
                        onUpdatePoint={
                            isPolygonDrawActive
                                ? polygonDrawing.updatePoint
                                : isSituationDrawingActive
                                    ? situationDrawing.updatePoint
                                    : eventDrawing.updatePoint
                        }
                        onRemoveVertex={
                            isPolygonDrawActive
                                ? polygonDrawing.removeVertexAt
                                : isSituationDrawingActive
                                    ? situationDrawing.removeVertexAt
                                    : eventDrawing.removeVertexAt
                        }
                        onInsertVertexOnEdge={
                            isPolygonDrawActive
                                ? polygonDrawing.insertVertexAtEdge
                                : isSituationDrawingActive
                                    ? situationDrawing.insertVertexAtEdge
                                    : eventDrawing.insertVertexAtEdge
                        }
                    />
                )}
                {visibleMapEvents.map((item) => renderEventShape(item))}
                <OperationalSituationLayer
                    situations={situations}
                    selectedSituationIds={selectedSituationIds}
                    activeSituationId={activeSituationId}
                    timelineRevisionId={timelineRevisionId}
                    situationRevisions={situationRevisions}
                    editingSituationId={editingSituationId}
                    onSituationClick={onSituationClick}
                />
                <FlagMarkersLayer
                    markers={displayedObjectsForMarkers}
                    iconsById={markerData.iconsById}
                    measureMode={effectiveMeasureMode}
                    eventDrawingActive={isMapDrawingEvent}
                    altAddTargetActive={isAltAddTargetActive}
                    onEventMapClick={handleEventMapClick}
                    onAltClickAddTarget={handleAltClickAddTarget}
                    onMarkerClick={handleMarkerClickGuarded}
                    onMarkerHover={handleMarkerHover}
                />
                <NonFlagMarkersLayer
                    groupedObjects={nonFlagData.groupedObjects}
                    iconsById={nonFlagData.iconsById}
                    selectedIds={selectedObj}
                    currentZoom={currentZoom}
                    pinnedGroupId={pinnedGroupId}
                    measureMode={effectiveMeasureMode}
                    eventDrawingActive={isMapDrawingEvent}
                    altAddTargetActive={isAltAddTargetActive}
                    onEventMapClick={handleEventMapClick}
                    onAltClickAddTarget={handleAltClickAddTarget}
                    onMarkerClick={handleMarkerClickGuarded}
                    onMarkerHover={handleMarkerHover}
                    onGroupHover={updateGroupHover}
                    onPinGroup={setPinnedGroupId}
                />
                {(() => {
                    const arr = isFullscreen ? fullscreenMeasurements : effectiveMeasurePoints;
                    return arr.length > 0 && arr.map((point, idx) => {
                        if (idx === 0) return null;
                        const prev = arr[idx - 1];
                        return (
                            <Polyline
                                key={`measure-line-${point.id}`}
                                positions={[[prev.lat, prev.lng], [point.lat, point.lng]]}
                                pathOptions={{ color: "#008DD2", weight: 2, dashArray: "6,4" }}
                            />
                        );
                    });
                })()}
                {(() => {
                    const arr = isFullscreen ? fullscreenMeasurements : effectiveMeasurePoints;
                    if (arr.length < 2) return null;
                    return (
                        <>
                            <Polyline
                                key="measure-total-line"
                                positions={[[arr[0].lat, arr[0].lng], [arr[arr.length - 1].lat, arr[arr.length - 1].lng]]}
                                pathOptions={{ color: "#FF6B6B", weight: 1, opacity: 0.6 }}
                            />
                            <Marker
                                key="measure-total-label"
                                position={[
                                    (arr[0].lat + arr[arr.length - 1].lat) / 2,
                                    (arr[0].lng + arr[arr.length - 1].lng) / 2
                                ]}
                                icon={L.divIcon({
                                    className: "measure-total-label",
                                    html: `<div class="measure-total-label__text">${formatDistance(arr.reduce((sum, p) => sum + p.distance, 0))}</div>`,
                                    iconSize: [60, 24],
                                    iconAnchor: [30, 12]
                                })}
                                interactive={false}
                            />
                        </>
                    );
                })()}
                {(isFullscreen ? fullscreenMeasurements : effectiveMeasurePoints).map((point) => (
                    <Marker
                        key={`measure-point-${point.id}`}
                        position={[point.lat, point.lng]}
                        icon={createMeasureIcon(point.index)}
                        interactive={false}
                    />
                ))}
                {showActionRadius && showZoneIntersections && intersections
                    .filter(point => selectedIntersections.includes(point.id))
                    .map((point) => (
                    <Marker
                        key={`intersection-point-${point.id}`}
                        position={[point.lat, point.lng]}
                        icon={createMeasureIcon(point.id)}
                        interactive={false}
                    />
                ))}
                {showActionRadius && (
                    <ActionZonesLayer
                        zoneObjects={zoneObjectsSource}
                        actionZoneFilters={actionZoneFilters}
                        visibleZones={visibleZones}
                        hoverController={zoneHoverControllerRef.current}
                        skipHoverRef={skipZoneHoverUpdatesRef}
                        isZonePanelPinned={Boolean(pinnedZonePanel)}
                        onZoneClickAt={handleZoneClickAt}
                        onZoneHoverChange={handleZoneHoverChange}
                        considerTerrain={considerTerrain}
                        losGeometryByZoneKey={losGeometryByZoneKey}
                    />
                )}

                {showActionRadius && activeZonePopup && activeZonePopup.centerLat != null && (
                    <ZoneActionPopupManager
                        popup={activeZonePopup}
                        version={activeZonePopupVersion}
                        onClose={handleZonePopupClose}
                    />
                )}
            </MapContainer>
            {showActionRadius && <ActionRadiusLegendButton actionTypes={actionTypes} />}
            {isFullscreen && showActionRadius && (pinnedZonePanel || hoveredZoneList.length > 0) && (
                <ZoneHoverListPanel
                    zones={pinnedZonePanel?.zones ?? hoveredZoneList}
                    isPinned={Boolean(pinnedZonePanel)}
                    selectedEntryId={selectedZoneEntryId}
                    onSelectZone={handleZonePanelSelect}
                    onClose={handleZonePanelClose}
                    considerTerrain={considerTerrain}
                />
            )}

            <FullscreenControl
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                sidebarOpen={isFullscreen && isSidebarOpen}
            />
            {isFullscreen && !isSidebarOpen && (
                <button
                    type="button"
                    className="map__sidebar-toggle"
                    onClick={() => setIsSidebarOpen(true)}
                    aria-label="Открыть панель инструментов"
                >
                    ☰
                </button>
            )}
            <EventDrawingToolbar
                visible={eventsDrawingEnabled && !isEventModalOpen && !isPolygonDrawActive && !isSituationDrawingActive}
                isEditMode={isEventEditModeActive}
                activeTool={eventDrawing.selectedTool}
                drawMode={eventDrawing.drawMode}
                hint={eventDrawing.getHint()}
                validationError={eventDrawing.validationError}
                polygonClosed={eventDrawing.polygonClosed}
                canFinishPolygon={eventDrawing.drawMode === 'polygon' && eventDrawing.drawPoints.length >= 3 && !eventDrawing.polygonClosed}
                canUndoPoint={eventDrawing.drawMode === 'polygon' && eventDrawing.drawPoints.length >= 1 && !eventDrawing.polygonClosed}
                isReady={eventDrawing.isReady()}
                onSelectTool={handleSelectEventTool}
                onFinishPolygon={eventDrawing.finishPolygon}
                onUndoPoint={eventDrawing.undoLastPoint}
                onConfirm={handleEventConfirm}
                onCancel={handleEventCancel}
                polygonCoordPoints={eventPolygonEditable}
                onPolygonCoordChange={handleEventPolygonCoordChange}
                polygonCoordError={eventPolygonCoordError}
            />
            {isPolygonDrawActive && (
                <InundationDrawBanner
                    hint={polygonDrawing.getHint()}
                    validationError={polygonDrawing.validationError}
                    polygonClosed={polygonDrawing.polygonClosed}
                    canFinishPolygon={polygonDrawing.drawMode === 'polygon' && polygonDrawing.drawPoints.length >= 3 && !polygonDrawing.polygonClosed}
                    canUndoPoint={polygonDrawing.drawMode === 'polygon' && polygonDrawing.drawPoints.length >= 1 && !polygonDrawing.polygonClosed}
                    isReady={polygonDrawing.isReady()}
                    onFinishPolygon={polygonDrawing.finishPolygon}
                    onUndoPoint={polygonDrawing.undoLastPoint}
                    onConfirm={handlePolygonDrawConfirm}
                    onCancel={onPolygonDrawCancel}
                    title={polygonDrawSession?.isInundation ? 'Зона затопления' : 'Полигон зоны'}
                    polygonCoordPoints={zonePolygonEditable}
                    onPolygonCoordChange={handleZonePolygonCoordChange}
                    polygonCoordError={zonePolygonCoordError}
                />
            )}
            {isSituationDrawingActive && isSituationModalOpen && (
                <div className="situation-map-edit-hint" role="status">
                    Редактируйте контур на карте: перетаскивайте вершины, кликайте по ребру для новой точки
                </div>
            )}
            {isSituationDrawingActive && !isSituationModalOpen && (
                <SituationDrawingToolbar
                    visible
                    hint={situationDrawing.getHint()}
                    validationError={situationDrawing.validationError}
                    polygonClosed={situationDrawing.polygonClosed}
                    canFinishPolygon={situationDrawing.drawMode === 'polygon' && situationDrawing.drawPoints.length >= 3 && !situationDrawing.polygonClosed}
                    canUndoPoint={situationDrawing.drawMode === 'polygon' && situationDrawing.drawPoints.length >= 1 && !situationDrawing.polygonClosed}
                    isReady={situationDrawing.isReady()}
                    onFinishPolygon={situationDrawing.finishPolygon}
                    onUndoPoint={situationDrawing.undoLastPoint}
                    onConfirm={handleSituationDrawConfirm}
                    onCancel={onSituationDrawCancel}
                    polygonCoordPoints={situationPolygonEditable}
                    onPolygonCoordChange={handleSituationPolygonCoordChange}
                    polygonCoordError={situationPolygonCoordError}
                />
            )}
            {detailSituation && (
                <SituationDetailPanel
                    situation={detailSituation}
                    revisions={filterRevisionsForSituation(situationRevisions, detailSituation.id)}
                    timelineRevisionId={timelineRevisionId}
                    onSelectRevision={onSituationRevisionSelect}
                    onClose={onSituationDetailClose}
                    onEdit={onSituationEdit}
                    onEditRevision={canEditSituations ? onTimelineRevisionEdit : undefined}
                    onDeleteRevision={
                        canEditSituations && canDeleteSituations
                            ? onTimelineRevisionDelete
                            : undefined
                    }
                    onNewState={onSituationNewState}
                />
            )}
            {selectedCountryIso && (
                <CountryModal 
                    countryIso={selectedCountryIso}
                    onClose={() => setSelectedCountryIso(null)}
                    onTargetEdit={(targetId) => {
                        setSelectedCountryIso(null);
                        onEditClick?.(targetId);
                    }}
                    onTargetOpenDetails={onTargetOpenDetails}
                    canEditCountry={canEditCountry}
                />
            )}
            {isEventModalOpen && (
                <AddEventModal
                    isOpen={isEventModalOpen}
                    onClose={() => {
                        setIsEventModalOpen(false);
                        handleEventCancel();
                    }}
                    drawMode={eventDrawing.drawMode}
                    drawPoints={eventDrawing.drawPoints}
                    onDrawPointsChange={eventDrawing.replaceDrawPoints}
                    onSave={onEventSave}
                />
            )}
            {/* Координаты курсора отображаются всегда (когда доступны), как было реализовано до введения
                радио "Считывание координат" в контексте инструмента "Зона действия".
                Ранее при активном showActionRadius координаты скрывались, если не был выбран специальный режим "coords". */}
            <div ref={cursorCoordsRef} className="map__cursor-coords" style={{ display: 'none' }} />
        </div>
    );
}

export default React.memo(MapComponent);