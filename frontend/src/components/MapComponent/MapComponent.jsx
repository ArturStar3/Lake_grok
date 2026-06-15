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
import { ActionRadiusAnimation } from "./ActionRadiusAnimations";
import ActionRadiusLegendButton from "./ActionRadiusLegendButton";
import CountryModal from "../CountryModal/CountryModal";
import AddEventModal from "../Events/AddEventModal";
import { isFlagMarker, isNonFlagMarker } from "../../utils/markerFilters";
import { getGroupCirclePositions } from "./markerClusteringUtils";
import { TILE_RASTER_URL } from "../../config/tiles";
import "./MapComponent.css"

// delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
});

const MemoGeoJSON = React.memo(GeoJSON);

function FullscreenControl({isFullscreen, onToggle}) {
    return (
        <button
            className="map__fullscreen-btn"
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

// Линейка масштаба (топографический стиль) — числовое 1:N + двухцветная графическая шкала.
// Отображается только в полноэкранном режиме, внизу по центру.
// Адаптивно пересчитывает реальный масштаб по данным Leaflet.
function MapScaleBar({ isFullscreen }) {
    const map = useMap();
    const [scale, setScale] = useState(null);

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
        const common = [1000, 2000, 5000, 10000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000];
        let denom = common[0];
        let bestDiff = Math.abs(denomRaw - denom);
        for (const c of common) {
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
            // Небольшой debounce, чтобы не дёргалось во время зума/перемещения
            setTimeout(updateScale, 60);
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
        };
    }, [map, updateScale]);

    if (!isFullscreen || !scale) {
        return null;
    }

    const formatMilitaryScale = (d) => {
        // Военный/топографический формат: 1 : 50 000
        if (d >= 1000000) return `1 : ${Math.round(d / 1000000)} 000 000`;
        if (d >= 100000) return `1 : ${Math.floor(d / 1000)} 000`;
        if (d >= 10000) return `1 : ${Math.floor(d / 1000)} 000`;
        return `1 : ${d}`;
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
            <div className="map-scale-numeric">
                {formatMilitaryScale(scale.denom)}
            </div>
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
    // Этот компонент передаёт карту в NonFlagLabelGeneration
    return <NonFlagLabelGeneration objects={objects} onMarkersReady={onMarkersReady} selectedIds={selectedIds} />;
}

// Компонент для отображения элементов группы в круге при наведении.
// Оптимизация: React.memo + вычисления зависят только от displayGroupId + groupedObjects.
const GroupCircleDisplay = React.memo(function GroupCircleDisplay({ groupedObjects, hoveredGroupId, pinnedGroupId, onPinGroup, iconsById, onMarkerClick, measureMode, onMarkerHover }) {
    const mapInstance = useMapEvents({});
    const [circleMarkers, setCircleMarkers] = React.useState([]);
    const [circleCenter, setCircleCenter] = React.useState(null);

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
    }, [displayGroupId, groupedObjects, mapInstance]);

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
                // Используем реальную иконку объекта, если она существует
                const markerIcon = iconsById ? iconsById[marker.id] : null;

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
            onZoomChange(map.getZoom());
        }
    });
    return null;
}

function MapComponent({
    // ...existing code...
    objects,
    objectsAll = [],
    selectedObj,
    events = [],
    selectedEventIds = [],
    mapRef,
    measureMode = false,
    measurements = [],
    onAddMeasurePoint,
    onCheckboxChange = () => {},
    showActionRadius: externalShowActionRadius = false,
    actionRadiusMode = "animation",
    onActionRadiusModeChange,
    intersections = [],
    selectedIntersections = [],
    onIntersectionToggle,
    onSelectAllIntersections,
    isFullscreen,
    setIsFullscreen,
    // ...existing code...
    onMeasureModeChange,
    onMeasurePointsChange,
    onShowActionRadiusChange,
    onMarkerClick,
    onMarkerHover,
    onEditClick,
    onDeleteClick,
    onEventSave,
    filterCountry = [],
    onFilterCountryChange,
    filterType = [],
    onFilterTypeChange,
    filterTitle = "",
    onFilterTitleChange,
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
    tableTab
}) {
    const [hoveredMarkerId, setHoveredMarkerId] = useState(null);
    // const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [isMeasureMenuOpen, setIsMeasureMenuOpen] = useState(false);
    const [measurePoints, setMeasurePoints] = useState([]);
    const [internalShowActionRadius, setInternalShowActionRadius] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(4);
    const [geoData, setGeoData] = useState(null);
    const [markerData, setMarkerData] = useState({ iconsById: {}, clusteredObjects: [] });
    const [nonFlagData, setNonFlagData] = useState({ iconsById: {}, groupedObjects: [] });
    const [hoveredGroupId, setHoveredGroupId] = useState(null);
    const [pinnedGroupId, setPinnedGroupId] = useState(null);
    const [selectedCountryIso, setSelectedCountryIso] = useState(null);
    const [eventContextMenu, setEventContextMenu] = useState(null);
    const [selectedEventShape, setSelectedEventShape] = useState(null);
    const [eventDrawMode, setEventDrawMode] = useState(null);
    const [eventDrawPoints, setEventDrawPoints] = useState([]);
    const [polygonContextMenu, setPolygonContextMenu] = useState(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [cursorLatLng, setCursorLatLng] = useState(null);
    const [hoveredTargetId, setHoveredTargetId] = useState(null);
    const [markerVersion, setMarkerVersion] = useState(0);
    const [fullscreenTab, setFullscreenTab] = useState("objects");
    const [eventMarkerSvgs, setEventMarkerSvgs] = useState(new Map());
    const eventMarkerFetchRef = useRef(new Set());
    const hoverTimeoutRef = useRef(null);
    const isEventPointDraggingRef = useRef(false);
    const isEventPointPointerDownRef = useRef(false);
    const cursorRafRef = useRef(null);
    const cursorLatLngRef = useRef(null);
    const cursorLastUpdateRef = useRef(0);
    const cursorLastValueRef = useRef(null);
    const prevIsFullscreenRef = useRef(false);
    const center = [51.1833, 71.4167];
    const containerRef = useRef(null);
    const sidebarRef = useRef(null);
    const measureMenuRef = useRef(null);

    const isEventEditModeActive = isEditEventMode && !!editEventDrawMode;
    const activeEventDrawMode = isEventEditModeActive ? editEventDrawMode : eventDrawMode;
    const activeEventDrawPoints = isEventEditModeActive ? editEventDrawPoints : eventDrawPoints;
    const updateActiveEventDrawPoints = useCallback((updater) => {
        if (isEventEditModeActive) {
            onEditEventDrawPointsChange((prev) =>
                typeof updater === "function" ? updater(prev) : updater
            );
            return;
        }
        setEventDrawPoints((prev) =>
            typeof updater === "function" ? updater(prev) : updater
        );
    }, [isEventEditModeActive, onEditEventDrawPointsChange]);

    // Отслеживаем изменения в объектах и инкрементируем версию
    useEffect(() => {
        setMarkerVersion(prev => prev + 1);
        // Сбрасываем данные маркеров, чтобы принудительно очистить старые
        setMarkerData({ iconsById: {}, clusteredObjects: [] });
        setNonFlagData({ iconsById: {}, groupedObjects: [] });
    }, [objects]);

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
            // При входе в полноэкранный режим - копируем все внешние состояния
            setInternalShowActionRadius(externalShowActionRadius);
            setIsMeasureMode(measureMode);
            setMeasurePoints(measurements);
        } else if (!isFullscreen && prevIsFullscreenRef.current) {
            // При выходе из полноэкранного режима - синхронизируем обратно
            if (onMeasureModeChange) {
                onMeasureModeChange(isMeasureMode);
            }
            if (onMeasurePointsChange) {
                onMeasurePointsChange(measurePoints);
            }
            if (onShowActionRadiusChange) {
                onShowActionRadiusChange(internalShowActionRadius);
            }
        }
        prevIsFullscreenRef.current = isFullscreen;
    }, [isFullscreen, externalShowActionRadius, measureMode, measurements, isMeasureMode, measurePoints, internalShowActionRadius, onMeasureModeChange, onMeasurePointsChange, onShowActionRadiusChange]);

    useEffect(() => {
        if (isFullscreen) {
            setInternalShowActionRadius(externalShowActionRadius);
        }
    }, [isFullscreen, externalShowActionRadius]);

    useEffect(() => {
        if (isFullscreen && tableTab) {
            setFullscreenTab(tableTab);
        }
    }, [isFullscreen, tableTab]);

    // Используем внешнее значение для миниатюры, внутреннее для fullscreen
    const showActionRadius = isFullscreen ? internalShowActionRadius : externalShowActionRadius;
    const effectiveMeasureMode = isFullscreen ? isMeasureMode : measureMode;
    const effectiveMeasurePoints = isFullscreen ? measurePoints : measurements;
    const isActionRadiusCoordsMode = showActionRadius && actionRadiusMode === "coords";
    const isActionRadiusAnimationMode = showActionRadius && actionRadiusMode === "animation";

    const displayedObjects = objects.filter(obj => selectedObj.includes(obj.id));

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                if (pinnedGroupId) {
                    setPinnedGroupId(null);
                } else if (isFullscreen) {
                    setIsFullscreen(false);
                }
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc)
    }, [isFullscreen, pinnedGroupId]);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (mapRef.current) {
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.invalidateSize();
                        }
                    }, 0)
                }
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
            .then(res => res.json())
            .then(setGeoData)
    }, []);

    const onEachCountry = useCallback((feature, layer) => {
        const featureId = feature.id || feature.prperties?.id;
        const countryIso = feature.properties?.ISO_A2 || feature.properties?.iso_a2 || feature.id;

        layer.on({
            click: (e) => {
                if (e.originalEvent?.altKey) {
                    return;
                }
                // Не открываем модальное окно если нажат Ctrl (в режиме измерения для добавления точки)
                if (e.originalEvent.ctrlKey) {
                    return;
                }
                setSelectedCountryIso(countryIso);
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

    const getOrderedPolygonPoints = (points) => {
        if (!points || points.length < 3) return points;
        const center = points.reduce(
            (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
            { lat: 0, lng: 0 }
        );
        const c = { lat: center.lat / points.length, lng: center.lng / points.length };
        return [...points].sort((a, b) => {
            const angleA = Math.atan2(a.lat - c.lat, a.lng - c.lng);
            const angleB = Math.atan2(b.lat - c.lat, b.lng - c.lng);
            return angleA - angleB;
        });
    };

    const orientation = (p, q, r) => {
        const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
        if (Math.abs(val) < 1e-12) return 0;
        return val > 0 ? 1 : 2;
    };

    const onSegment = (p, q, r) => {
        return (
            q.lng <= Math.max(p.lng, r.lng) &&
            q.lng >= Math.min(p.lng, r.lng) &&
            q.lat <= Math.max(p.lat, r.lat) &&
            q.lat >= Math.min(p.lat, r.lat)
        );
    };

    const segmentsIntersect = (p1, q1, p2, q2) => {
        const o1 = orientation(p1, q1, p2);
        const o2 = orientation(p1, q1, q2);
        const o3 = orientation(p2, q2, p1);
        const o4 = orientation(p2, q2, q1);

        if (o1 !== o2 && o3 !== o4) return true;

        if (o1 === 0 && onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && onSegment(p2, q1, q2)) return true;

        return false;
    };

    const isSelfIntersecting = (points) => {
        if (!points || points.length < 4) return false;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const a1 = points[i];
            const a2 = points[(i + 1) % n];
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(i - j) <= 1) continue;
                if (i === 0 && j === n - 1) continue;
                const b1 = points[j];
                const b2 = points[(j + 1) % n];
                if (segmentsIntersect(a1, a2, b1, b2)) return true;
            }
        }
        return false;
    };

    const normalizePolygonPoints = (points) => {
        if (!points || points.length < 3) return points;
        if (isSelfIntersecting(points)) {
            return getOrderedPolygonPoints(points);
        }
        return points;
    };

    const isEventReady = () => {
        if (!activeEventDrawMode) return false;
        if (activeEventDrawMode === "point") return activeEventDrawPoints.length >= 1;
        if (activeEventDrawMode === "circle") return activeEventDrawPoints.length >= 2;
        if (activeEventDrawMode === "rectangle") return activeEventDrawPoints.length >= 4;
        if (activeEventDrawMode === "polygon") return activeEventDrawPoints.length >= 3;
        return false;
    };

    const clearEventDraft = () => {
        setEventDrawMode(null);
        setEventDrawPoints([]);
        setSelectedEventShape(null);
        setPolygonContextMenu(null);
    };

    const getMenuPosition = (evt) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) {
            return { x: evt.clientX, y: evt.clientY };
        }
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    };

    const isPointInPolygon = (point, polygon) => {
        if (!polygon || polygon.length < 3) return false;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lng;
            const yi = polygon[i].lat;
            const xj = polygon[j].lng;
            const yj = polygon[j].lat;

            const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
                (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const initEventPoints = (shape, anchor) => {
        if (!anchor) return [];
        const baseLat = anchor.lat;
        const baseLng = anchor.lng;
        const delta = 0.05;

        if (shape === "point") {
            return [{ lat: baseLat, lng: baseLng }];
        }
        if (shape === "circle") {
            return [
                { lat: baseLat, lng: baseLng },
                { lat: baseLat, lng: baseLng + delta }
            ];
        }
        if (shape === "rectangle") {
            return [
                { lat: baseLat + delta, lng: baseLng - delta },
                { lat: baseLat + delta, lng: baseLng + delta },
                { lat: baseLat - delta, lng: baseLng + delta },
                { lat: baseLat - delta, lng: baseLng - delta }
            ];
        }
        if (shape === "polygon") {
            return [
                { lat: baseLat + delta, lng: baseLng - delta },
                { lat: baseLat + delta, lng: baseLng + delta },
                { lat: baseLat - delta, lng: baseLng }
            ];
        }
        return [];
    };

    const updateEventPoint = (index, latlng) => {
        updateActiveEventDrawPoints((prev) => {
            const next = [...prev];
            next[index] = { lat: latlng.lat, lng: latlng.lng };
            return next;
        });
    };

    const getMarkerKey = (o, i) => {
        // Включаем marker.id в ключ, чтобы при изменении маркера объект перерисовывался
        const markerId = o.marker?.id ?? 'no-marker';
        return `${o.id}-${markerId}`;
    }

    // Используем clusteredObjects для отображения маркеров (с примененными офсетами)
    // Исключаем non-flag объекты - они будут отображаться отдельно
    const displayedObjectsForMarkers = markerData.clusteredObjects.filter(obj => 
        selectedObj.includes(obj.id) && isFlagMarker(obj)
    );

    // Компонент для обработки кликов на карту и закрытия группы
    function MapClickHandler({ onMapClick }) {
        useMapEvents({
            click: () => {
                if (polygonContextMenu) {
                    setPolygonContextMenu(null);
                }
                if (pinnedGroupId) {
                    setPinnedGroupId(null);
                    setHoveredGroupId(null); // Очищаем наведённую группу тоже
                }
            }
        });
        return null;
    }

    function CursorTracker() {
        useMapEvents({
            mousemove: (e) => {
                // Можно добавить условия для отключения в спец. режимах, если нужно
                if (isEventPointDraggingRef.current) return;
                if (isEventPointPointerDownRef.current) return;
                cursorLatLngRef.current = { lat: e.latlng.lat, lng: e.latlng.lng };
                if (cursorRafRef.current) return;
                cursorRafRef.current = requestAnimationFrame(() => {
                    cursorRafRef.current = null;
                    if (!cursorLatLngRef.current) return;
                    if (
                        cursorLastValueRef.current &&
                        Math.abs(cursorLastValueRef.current.lat - cursorLatLngRef.current.lat) < 1e-6 &&
                        Math.abs(cursorLastValueRef.current.lng - cursorLatLngRef.current.lng) < 1e-6
                    ) {
                        return;
                    }
                    cursorLastValueRef.current = cursorLatLngRef.current;
                    setCursorLatLng(cursorLatLngRef.current);
                });
            }
        });
        return null;
    }

    function PolygonContextMenuHandler() {
        useMapEvents({});
        return null;
    }

    function MeasureHandler({ isActive, onAddPoint }) {
        useMapEvents({
            click: (e) => {
                if (!isActive || !onAddPoint) return;
                if (!e.originalEvent || !e.originalEvent.ctrlKey) return;
                const { lat, lng } = e.latlng;
                onAddPoint({ lat, lng });
            }
        });
        return null;
    }

    function EventContextMenuHandler() {
        const map = useMapEvents({
            click: (e) => {
                if (isEventEditModeActive) {
                    if (eventContextMenu) {
                        setEventContextMenu(null);
                    }
                    return;
                }
                if (e.originalEvent?.altKey) {
                    const point = map.mouseEventToContainerPoint(e.originalEvent);
                    setEventContextMenu({
                        x: point.x,
                        y: point.y,
                        lat: e.latlng.lat,
                        lng: e.latlng.lng
                    });
                    return;
                }

                if (eventContextMenu) {
                    setEventContextMenu(null);
                }
            }
        });
        return null;
    }

    const handleMeasureAddPoint = ({ lat, lng }) => {
        setMeasurePoints((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, lat, lng }]);
    };

    // Новый обработчик hover: только меняет hoveredMarkerId
    const handleMarkerHover = (targetId) => {
        setHoveredMarkerId(targetId);
        // Выделение строки в таблице можно реализовать через hoveredMarkerId
    };
        // Логируем изменение hoveredMarkerId
        useEffect(() => {
            if (hoveredMarkerId !== null) {
            }
        }, [hoveredMarkerId]);

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

    const getTotalDistance = () => {
        if (effectiveMeasurePoints.length === 0) return 0;
        return effectiveMeasurePoints.reduce((sum, point) => sum + point.distance, 0);
    };

    const toRadians = (deg) => (deg * Math.PI) / 180;
    const calcDistanceMeters = (from, to) => {
        const R = 6371e3;
        const phi1 = toRadians(from.lat);
        const phi2 = toRadians(to.lat);
        const deltaPhi = toRadians(to.lat - from.lat);
        const deltaLambda = toRadians(to.lng - from.lng);

        const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const renderEventShape = (eventItem) => {
        const shape = eventItem?.shape;
        if (!shape || !shape.type) return null;

        const dateLabel = eventItem.date_start
            ? `с ${eventItem.date_start}${eventItem.date_end ? ` по ${eventItem.date_end}` : ""}`
            : "—";
        const timeLabel = eventItem.time_start
            ? `с ${eventItem.time_start}${eventItem.time_end ? ` по ${eventItem.time_end}` : ""}`
            : "—";
        const countryTitle = eventItem.country?.title || "—";
        const objectName = eventItem.object_name || "—";
        const description = eventItem.description || "—";
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
                    Доп. информация: {description}
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
                    >
                        {popupContent}
                    </Circle>
                    {markerPosition && (
                        <Marker
                            key={`event-circle-marker-${eventItem.id}`}
                            position={markerPosition}
                            icon={icon}
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
                    >
                        {popupContent}
                    </Polygon>
                    {markerPosition && (
                        <Marker
                            key={`event-area-marker-${eventItem.id}`}
                            position={markerPosition}
                            icon={icon}
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

    const handleMapContextMenu = (e) => {
        if (isEventEditModeActive) return;
        if (activeEventDrawMode !== "polygon") return;
        if (!mapRef?.current) return;
        if (activeEventDrawPoints.length < 3) return;

        e.preventDefault();

        const { x, y } = getMenuPosition(e);
        const latlng = mapRef.current.mouseEventToLatLng(e);

        const clickPoint = mapRef.current.latLngToContainerPoint(latlng);
        const hitIndex = activeEventDrawPoints.findIndex((p) => {
            const pPoint = mapRef.current.latLngToContainerPoint(p);
            return clickPoint.distanceTo(pPoint) <= 12;
        });

        if (hitIndex >= 0) {
            setPolygonContextMenu({ x, y, lat: latlng.lat, lng: latlng.lng, targetIndex: hitIndex });
            return;
        }

        const normalizedPoints = normalizePolygonPoints(activeEventDrawPoints);
        if (isPointInPolygon({ lat: latlng.lat, lng: latlng.lng }, normalizedPoints)) {
            setPolygonContextMenu({ x, y, lat: latlng.lat, lng: latlng.lng, targetIndex: null });
        }
    };

    const getSegmentLabels = (points) => {
        if (!points || points.length < 2) return [];
        const segments = [];
        for (let i = 0; i < points.length; i += 1) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            if (!current || !next) continue;
            const midLat = (current.lat + next.lat) / 2;
            const midLng = (current.lng + next.lng) / 2;
            const distanceKm = calcDistanceMeters(current, next) / 1000;
            segments.push({
                key: `segment-${i}`,
                lat: midLat,
                lng: midLng,
                label: `${distanceKm.toFixed(2)} км`
            });
        }
        return segments;
    };

    return (
        <div
            className={`map ${isFullscreen ? "map--fullscreen": ""}`}
            ref={containerRef}
            onContextMenu={handleMapContextMenu}
        >
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
                                    <button
                                        type="button"
                                        className="map__measure-menu-item"
                                        onClick={() => {
                                            setInternalShowActionRadius((prev) => !prev);
                                            setIsMeasureMenuOpen(false);
                                        }}
                                    >
                                        {internalShowActionRadius ? '✓ ' : ''}Зона действия
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="map__sidebar-section map__objects-section">
                        <div className="formular__tabs">
                            <button
                                type="button"
                                className={`formular__tab${fullscreenTab === "objects" ? " formular__tab--active" : ""}`}
                                onClick={() => setFullscreenTab("objects")}
                            >
                                Объекты
                            </button>
                            <button
                                type="button"
                                className={`formular__tab${fullscreenTab === "events" ? " formular__tab--active" : ""}`}
                                onClick={() => setFullscreenTab("events")}
                            >
                                События
                            </button>
                        </div>

                        {fullscreenTab === "objects" && (
                            <>
                                <FilterPanel
                                    objects={objectsAll}
                                    filterCountry={filterCountry}
                                    onFilterCountryChange={onFilterCountryChange}
                                    filterType={filterType}
                                    onFilterTypeChange={onFilterTypeChange}
                                    filterTitle={filterTitle}
                                    onFilterTitleChange={onFilterTitleChange}
                                />
                                <ObjectsTable
                                    data={objects}
                                    selectedObj={selectedObj}
                                    onCheckboxChange={onCheckboxChange}
                                    onTitleClick={onMarkerClick}
                                    hoveredTargetId={hoveredTargetId}
                                    onRowHover={setHoveredTargetId}
                                    onObjectClick={(obj) => {
                                        if (mapRef.current) {
                                            mapRef.current.flyTo([obj.lat, obj.lng], 8, {
                                                duration: 2.0,
                                                easeLinearity: 0.2
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
                    </div>

                    <div className="map__sidebar-section map__features-section">
                        <Features 
                            isMeasureMode={effectiveMeasureMode}
                            measurements={fullscreenMeasurements}
                            onRemovePoint={(id) => {
                                setMeasurePoints((prev) => prev.filter((p) => p.id !== id));
                            }}
                            showActionRadius={internalShowActionRadius}
                            actionRadiusMode={actionRadiusMode}
                            onActionRadiusModeChange={onActionRadiusModeChange}
                            intersections={intersections}
                            selectedIntersections={selectedIntersections}
                            onIntersectionToggle={onIntersectionToggle}
                            onSelectAllIntersections={onSelectAllIntersections}
                        />
                    </div>
                </div>
            )}
            
            {isFullscreen && (
                <>
                    <FullscreenControl isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
                    {!isSidebarOpen && (
                        <button
                            className="map__sidebar-toggle"
                            onClick={() => setIsSidebarOpen(true)}
                            aria-label="Открыть панель"
                        >
                            ☰
                        </button>
                    )}
                </>
            )}
            
            <MapContainer
                ref={mapRef}
                center={center}
                zoom={4}
                style={{height: "100%", width: "100%"}}
                className={isFullscreen ? "map--fullscreen" : ""}
            >
                <ZoomTracker onZoomChange={setCurrentZoom} />
                <MapScaleBar isFullscreen={isFullscreen} />
                <MapClickHandler onMapClick={() => setPinnedGroupId(null)} />
                <MeasureHandler isActive={effectiveMeasureMode} onAddPoint={isFullscreen ? handleMeasureAddPoint : onAddMeasurePoint} />
                <EventContextMenuHandler />
                <PolygonContextMenuHandler />
                {/* <CursorTracker /> */}
                <MarkerInitializer 
                    key={`markers-v${markerVersion}`}
                    objects={objects} 
                    selectedIds={selectedObj} 
                    onMarkersReady={handleMarkersReady} 
                />
                <NonFlagMarkerInitializer 
                    key={`nonflag-v${markerVersion}`}
                    objects={objects} 
                    onMarkersReady={handleNonFlagMarkersReady} 
                    selectedIds={selectedObj} 
                />
                <GroupCircleDisplay 
                    groupedObjects={nonFlagData.groupedObjects} 
                    hoveredGroupId={hoveredGroupId} 
                    pinnedGroupId={pinnedGroupId}
                    onPinGroup={setPinnedGroupId}
                    iconsById={nonFlagData.iconsById}
                    onMarkerClick={onMarkerClick}
                    measureMode={effectiveMeasureMode}
                    onMarkerHover={handleMarkerHover}
                />
                <TileLayer
                    url={TILE_RASTER_URL}
                    minZoom={5}
                    maxZoom={14}
                    attribution='&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
                />
                {geoData && (
                        <MemoGeoJSON
                            data={geoData}
                            onEachFeature={onEachCountry}
                            style={countryStyle}
                        />
                )}
                {activeEventDrawMode && activeEventDrawPoints.length > 0 && (
                    <>
                        {activeEventDrawMode === "point" && activeEventDrawPoints[0] && (
                            <CircleMarker
                                center={[activeEventDrawPoints[0].lat, activeEventDrawPoints[0].lng]}
                                radius={6}
                                pathOptions={{ color: "#ff9800", fillColor: "#ffcc80", fillOpacity: 0.9 }}
                            />
                        )}
                        {activeEventDrawMode === "circle" && activeEventDrawPoints.length >= 2 && (
                            <Circle
                                center={[activeEventDrawPoints[0].lat, activeEventDrawPoints[0].lng]}
                                radius={calcDistanceMeters(activeEventDrawPoints[0], activeEventDrawPoints[1])}
                                pathOptions={{ color: "#ff9800", fillColor: "#ffcc80", fillOpacity: 0.2, weight: 1, interactive: false }}
                            />
                        )}
                        {activeEventDrawMode === "circle" && activeEventDrawPoints.length >= 2 && (
                            <Polyline
                                positions={[
                                    [activeEventDrawPoints[0].lat, activeEventDrawPoints[0].lng],
                                    [activeEventDrawPoints[1].lat, activeEventDrawPoints[1].lng]
                                ]}
                                pathOptions={{ color: "#ff9800", weight: 1, dashArray: "4 6", interactive: false }}
                                interactive={false}
                                bubblingMouseEvents={false}
                            />
                        )}
                        {activeEventDrawMode === "circle" && activeEventDrawPoints.length >= 2 && (
                            <Marker
                                position={[
                                    activeEventDrawPoints[0].lat + (activeEventDrawPoints[1].lat - activeEventDrawPoints[0].lat) * 0.35,
                                    activeEventDrawPoints[0].lng + (activeEventDrawPoints[1].lng - activeEventDrawPoints[0].lng) * 0.35
                                ]}
                                icon={L.divIcon({
                                    className: "event-radius-label",
                                    html: `<div class='event-radius-label__inner'>${(calcDistanceMeters(activeEventDrawPoints[0], activeEventDrawPoints[1]) / 1000).toFixed(2)} км</div>`
                                })}
                                interactive={false}
                                bubblingMouseEvents={false}
                                zIndexOffset={900}
                            />
                        )}
                        {activeEventDrawMode === "rectangle" && activeEventDrawPoints.length === 4 && (
                            <>
                                <Polygon
                                    positions={normalizePolygonPoints(activeEventDrawPoints).map((p) => [p.lat, p.lng])}
                                    pathOptions={{ color: "#ff9800", fillColor: "#ffcc80", fillOpacity: 0.2, weight: 1, interactive: false }}
                                />
                                {getSegmentLabels(normalizePolygonPoints(activeEventDrawPoints)).map((segment) => (
                                    <Marker
                                        key={segment.key}
                                        position={[segment.lat, segment.lng]}
                                        icon={L.divIcon({
                                            className: "event-segment-label",
                                            html: `<div class='event-segment-label__inner'>${segment.label}</div>`
                                        })}
                                        interactive={false}
                                        bubblingMouseEvents={false}
                                        zIndexOffset={900}
                                    />
                                ))}
                            </>
                        )}
                        {activeEventDrawMode === "polygon" && activeEventDrawPoints.length >= 3 && (
                            <>
                                <Polygon
                                    positions={normalizePolygonPoints(activeEventDrawPoints).map((p) => [p.lat, p.lng])}
                                    pathOptions={{ color: "#ff9800", fillColor: "#ffcc80", fillOpacity: 0.2, weight: 1, interactive: false }}
                                />
                                {getSegmentLabels(normalizePolygonPoints(activeEventDrawPoints)).map((segment) => (
                                    <Marker
                                        key={segment.key}
                                        position={[segment.lat, segment.lng]}
                                        icon={L.divIcon({
                                            className: "event-segment-label",
                                            html: `<div class='event-segment-label__inner'>${segment.label}</div>`
                                        })}
                                        interactive={false}
                                        bubblingMouseEvents={false}
                                        zIndexOffset={900}
                                    />
                                ))}
                            </>
                        )}
                        {activeEventDrawPoints.map((point, index) => (
                            <Marker
                                key={`event-point-${index}`}
                                position={[point.lat, point.lng]}
                                draggable
                                interactive
                                bubblingMouseEvents={false}
                                autoPan
                                zIndexOffset={1000}
                                icon={L.divIcon({
                                    className: "event-point-icon",
                                    html: "<div class='event-point-handle'></div>",
                                    iconSize: [14, 14],
                                    iconAnchor: [7, 7]
                                })}
                                eventHandlers={{
                                    mousedown: () => {
                                        isEventPointPointerDownRef.current = true;
                                    },
                                    mouseup: () => {
                                        isEventPointPointerDownRef.current = false;
                                    },
                                    contextmenu: (e) => {
                                        if (isEventEditModeActive) return;
                                        if (activeEventDrawMode !== "polygon") return;
                                        e.originalEvent?.preventDefault?.();
                                        const { x, y } = getMenuPosition(e.originalEvent);
                                        setPolygonContextMenu({
                                            x,
                                            y,
                                            lat: point.lat,
                                            lng: point.lng,
                                            targetIndex: index
                                        });
                                    },
                                    dragstart: () => {
                                        isEventPointDraggingRef.current = true;
                                        if (mapRef?.current?.dragging) {
                                            mapRef.current.dragging.disable();
                                        }
                                    },
                                    dragend: (e) => {
                                        const { lat, lng } = e.target.getLatLng();
                                        updateEventPoint(index, { lat, lng });
                                        isEventPointDraggingRef.current = false;
                                        isEventPointPointerDownRef.current = false;
                                        if (mapRef?.current?.dragging) {
                                            mapRef.current.dragging.enable();
                                        }
                                    }
                                }}
                            />
                        ))}
                    </>
                )}
                {events
                    .filter((item) => selectedEventIds.includes(item.id))
                    .map((item) => renderEventShape(item))}
                {displayedObjectsForMarkers.map((obj, idx) => (
                    <Marker
                        key={getMarkerKey(obj, idx)}
                        position={[obj.lat, obj.lng]}
                        icon={markerData.iconsById[obj.id]}
                        draggable={false}
                        eventHandlers={{
                            click: (e) => {
                                // Не открываем формуляр в режиме измерения с Ctrl
                                if (effectiveMeasureMode && e.originalEvent?.ctrlKey) {
                                    return;
                                }
                                // Открываем формуляр при клике на маркер
                                if (onMarkerClick && obj.id) {
                                    onMarkerClick(obj.id);
                                }
                            },
                            mouseover: () => {
                                if (obj.id) {
                                    handleMarkerHover(obj.id);
                                }
                            },
                            mouseout: () => {
                                handleMarkerHover(null);
                            }
                        }}
                    />
                ))}
                {nonFlagData.groupedObjects && (() => {
                    const allNonFlags = nonFlagData.groupedObjects;
                    const visibleNonFlags = allNonFlags.filter(obj => !obj.isHidden && selectedObj.includes(obj.id));
                    return visibleNonFlags.map((obj, idx) => {
                        const markerId = obj.marker?.id ?? 'no-marker';
                        const key = obj.isGroupIcon 
                            ? `non-flag-group-${obj.groupId}`
                            : `non-flag-${obj.id}-${markerId}`;
                        
                        return (
                            <Marker
                                key={key}
                                position={[obj.lat, obj.lng]}
                                icon={nonFlagData.iconsById[obj.isGroupIcon ? obj.groupId : obj.id]}
                                draggable={false}
                                eventHandlers={{
                                mouseover: () => {
                                    if (obj.isGroupIcon) {
                                        setHoveredGroupId(obj.groupId);
                                    } else {
                                        // Обычный non-flag маркер
                                        if (obj.id) {
                                            handleMarkerHover(obj.id);
                                        }
                                    }
                                },
                                mouseout: () => {
                                    if (obj.isGroupIcon) {
                                        // Сбрасываем hover только если группа не закреплена
                                        if (pinnedGroupId !== obj.groupId) {
                                            setHoveredGroupId(null);
                                        }
                                    } else {
                                        // Обычный non-flag маркер
                                        handleMarkerHover(null);
                                    }
                                },
                                click: (e) => {
                                    if (obj.isGroupIcon) {
                                        e.originalEvent.stopPropagation();
                                        // Если уже закреплена - закрываем, если нет - закрепляем
                                        if (pinnedGroupId === obj.groupId) {
                                            setPinnedGroupId(null);
                                            setHoveredGroupId(null);
                                        } else {
                                            setPinnedGroupId(obj.groupId);
                                        }
                                    } else {
                                        // Клик по обычному non-flag маркеру
                                        // Не открываем формуляр в режиме измерения с Ctrl
                                        if (effectiveMeasureMode && e.originalEvent?.ctrlKey) {
                                            return;
                                        }
                                        // Открываем формуляр при клике на маркер
                                        if (onMarkerClick && obj.id) {
                                            onMarkerClick(obj.id);
                                        }
                                    }
                                }
                            }}
                        />
                        );
                    });
                })()}
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
                {showActionRadius && intersections
                    .filter(point => selectedIntersections.includes(point.id))
                    .map((point) => (
                    <Marker
                        key={`intersection-point-${point.id}`}
                        position={[point.lat, point.lng]}
                        icon={createMeasureIcon(point.id)}
                        interactive={false}
                    />
                ))}
                {showActionRadius && (() => {
                    // Используем кластеризованные объекты для правильного отображения радиусов
                    const flagObjects = markerData.clusteredObjects.length > 0 
                        ? markerData.clusteredObjects 
                        : displayedObjects.filter(obj => isFlagMarker(obj));
                    
                    // Для non-flag объектов берём координаты маркера группы
                    const nonFlagObjects = nonFlagData.groupedObjects.filter(obj => 
                        selectedObj.includes(obj.id) && isNonFlagMarker(obj)
                    );
                    
                    const allObjectsForRadius = [...flagObjects, ...nonFlagObjects];

                    const animationColors = {
                        gradient: '#8B0000',
                        radar: '#00CED1',
                        wave: '#FF8C00',
                        pulse: '#9370DB',
                        rings: '#32CD32',
                        sector: '#4682B4',
                        alert: '#DC143C',
                        dashed_rotate: '#FFD700'
                    };

                    const isObjectHovered = (obj) => {
                        if (isNonFlagMarker(obj) && obj.groupId) {
                            return hoveredGroupId === obj.groupId;
                        }
                        return hoveredMarkerId === obj.id;
                    };

                    // Сначала собираем информацию о центрах для подсветки (по одному кругу на центр)
                    const centerMap = new Map();

                    allObjectsForRadius
                        .filter(obj => selectedObj.includes(obj.id) && obj.actions && obj.actions.length > 0)
                        .forEach((obj) => {
                            let centerLat = obj.lat;
                            let centerLng = obj.lng;

                            if (isNonFlagMarker(obj) && obj.isGrouped && obj.groupId) {
                                const groupMarker = nonFlagData.groupedObjects.find(g => 
                                    g.groupId === obj.groupId && g.isGroupIcon
                                );
                                if (groupMarker) {
                                    centerLat = groupMarker.lat;
                                    centerLng = groupMarker.lng;
                                }
                            }

                            const key = `${centerLat.toFixed(6)},${centerLng.toFixed(6)}`;
                            const hovered = isObjectHovered(obj);

                            // Цвет подсветки берём из первой зоны объекта (по типу анимации)
                            const firstAction = obj.actions[0];
                            const animationType = firstAction?.action_type?.animation || 'wave';
                            const baseColor = animationColors[animationType] || '#3388ff';

                            const existing = centerMap.get(key);
                            if (!existing) {
                                centerMap.set(key, {
                                    lat: centerLat,
                                    lng: centerLng,
                                    color: baseColor,
                                    hovered
                                });
                            } else {
                                // Если хоть один объект на этом центре в hover, считаем центр подсвеченным ярко
                                if (hovered) {
                                    existing.hovered = true;
                                }
                            }
                        });

                    const highlightCircles = Array.from(centerMap.entries()).map(([key, info]) => {
                        const { lat, lng, color, hovered } = info;
                        return (
                            <CircleMarker
                                key={`zone-highlight-${key}`}
                                center={[lat, lng]}
                                radius={11}
                                pathOptions={{
                                    color: hovered ? color : `${color}`,
                                    fillColor: hovered ? color : color,
                                    fillOpacity: hovered ? 0.28 : 0.18,
                                    weight: hovered ? 4 : 2,
                                    opacity: 0.9,
                                    className: 'action-radius-marker-highlight',
                                    interactive: false
                                }}
                            />
                        );
                    });

                    const radiusCircles = allObjectsForRadius
                        .filter(obj => selectedObj.includes(obj.id))
                        .map((obj) => {
                            if (!obj.actions || obj.actions.length === 0) return null;
                            
                            let centerLat = obj.lat;
                            let centerLng = obj.lng;
                            
                            // Для non-flag объектов: если есть группировка, используем координаты группы
                            if (isNonFlagMarker(obj) && obj.isGrouped && obj.groupId) {
                                const groupMarker = nonFlagData.groupedObjects.find(g => 
                                    g.groupId === obj.groupId && g.isGroupIcon
                                );
                                if (groupMarker) {
                                    centerLat = groupMarker.lat;
                                    centerLng = groupMarker.lng;
                                }
                            }

                            const hovered = isObjectHovered(obj);
                            
                            // Отображаем все зоны действия для объекта
                            return obj.actions.map((action, actionIndex) => {
                                const radiusMeters = action.radius * 1000;
                                const animationType = action.action_type?.animation || 'wave';
                                const actionTitle = action.action_type?.title || 'Зона действия';
                                const circleColor = animationColors[animationType] || '#3388ff';
                                
                                return (
                                    <React.Fragment key={`action-radius-${obj.id}-${actionIndex}`}>
                                        {/* Анимированные круги зоны действия */}
                                        {isActionRadiusAnimationMode && (
                                            <ActionRadiusAnimation 
                                                center={[centerLat, centerLng]}
                                                radius={radiusMeters}
                                                color={circleColor}
                                                animationType={animationType}
                                            />
                                        )}
                                        
                                        {/* Основной круг зоны действия */}
                                        <Circle
                                            center={[centerLat, centerLng]}
                                            radius={radiusMeters}
                                            pathOptions={{
                                                color: circleColor,
                                                fillColor: circleColor,
                                                fillOpacity: 0.1,
                                                weight: hovered ? 4 : 2,
                                                opacity: hovered ? 1 : 0.6,
                                                dashArray: '5, 10',
                                                className: 'action-radius-circle',
                                                interactive: false
                                            }}
                                        >
                                            <Popup>
                                                <div>
                                                    <strong>{obj.label || obj.title}</strong>
                                                    <br />
                                                    Тип зоны: {actionTitle}
                                                    <br />
                                                    Радиус: {action.radius} км
                                                    <br />
                                                    Анимация: {animationType}
                                                </div>
                                            </Popup>
                                        </Circle>
                                    </React.Fragment>
                                );
                            });
                        });

                    return (
                        <>
                            {highlightCircles}
                            {radiusCircles}
                        </>
                    );
                })()}
                <CursorTracker />
            </MapContainer>
            {showActionRadius && <ActionRadiusLegendButton />}
            <FullscreenControl isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            {isEventReady() && !isEventModalOpen && !isEventEditModeActive && (
                <div className="map__event-actions">
                    <button
                        className="map__event-action map__event-action--confirm"
                        onClick={() => setIsEventModalOpen(true)}
                        aria-label="Открыть регистрацию события"
                    >
                        ✓
                    </button>
                    <button
                        className="map__event-action map__event-action--cancel"
                        onClick={clearEventDraft}
                        aria-label="Удалить событие"
                    >
                        ✕
                    </button>
                </div>
            )}
            {isFullscreen && (
                <button
                    className="map__objects-btn"
                    onClick={() => setIsObjectsPanelOpen(!isObjectsPanelOpen)}
                    aria-label="Показать/скрыть объекты"
                >
                    📋
                </button>
            )}
            {selectedCountryIso && (
                <CountryModal 
                    countryIso={selectedCountryIso}
                    onClose={() => setSelectedCountryIso(null)}
                />
            )}
            {isEventModalOpen && (
                <AddEventModal
                    isOpen={isEventModalOpen}
                    onClose={() => {
                        setIsEventModalOpen(false);
                        clearEventDraft();
                    }}
                    drawMode={eventDrawMode}
                    drawPoints={eventDrawPoints}
                    onSave={onEventSave}
                />
            )}
            {!isEventEditModeActive && eventContextMenu && (
                <div
                    className="map__event-menu"
                    style={{ left: eventContextMenu.x, top: eventContextMenu.y }}
                >
                    <div className="map__event-menu-title">Форма события</div>
                    <button
                        type="button"
                        className="map__event-menu-item"
                        onClick={() => {
                            setEventDrawMode("point");
                            setEventDrawPoints(initEventPoints("point", eventContextMenu));
                            setSelectedEventShape("point");
                            setEventContextMenu(null);
                        }}
                    >
                        Точка
                    </button>
                    <button
                        type="button"
                        className="map__event-menu-item"
                        onClick={() => {
                            setEventDrawMode("circle");
                            setEventDrawPoints(initEventPoints("circle", eventContextMenu));
                            setSelectedEventShape("circle");
                            setEventContextMenu(null);
                        }}
                    >
                        Окружность
                    </button>
                    <button
                        type="button"
                        className="map__event-menu-item"
                        onClick={() => {
                            setEventDrawMode("rectangle");
                            setEventDrawPoints(initEventPoints("rectangle", eventContextMenu));
                            setSelectedEventShape("rectangle");
                            setEventContextMenu(null);
                        }}
                    >
                        Территория (4 точки)
                    </button>
                    <button
                        type="button"
                        className="map__event-menu-item"
                        onClick={() => {
                            setEventDrawMode("polygon");
                            setEventDrawPoints(initEventPoints("polygon", eventContextMenu));
                            setSelectedEventShape("polygon");
                            setEventContextMenu(null);
                        }}
                    >
                        Произвольная форма
                    </button>
                </div>
            )}
            {!isEventEditModeActive && polygonContextMenu && (
                <div
                    className="map__event-menu map__event-menu--polygon"
                    style={{ left: polygonContextMenu.x, top: polygonContextMenu.y }}
                >
                    <div className="map__event-menu-title">Произвольная форма</div>
                    <button
                        type="button"
                        className="map__event-menu-item"
                        onClick={() => {
                            setEventDrawPoints((prev) => [...prev, { lat: polygonContextMenu.lat, lng: polygonContextMenu.lng }]);
                            setPolygonContextMenu(null);
                        }}
                    >
                        Добавить точку
                    </button>
                    <button
                        type="button"
                        className="map__event-menu-item"
                        disabled={polygonContextMenu.targetIndex === null || eventDrawPoints.length <= 3}
                        onClick={() => {
                            if (polygonContextMenu.targetIndex === null) return;
                            if (eventDrawPoints.length <= 3) return;
                            setEventDrawPoints((prev) => prev.filter((_, idx) => idx !== polygonContextMenu.targetIndex));
                            setPolygonContextMenu(null);
                        }}
                    >
                        Удалить точку
                    </button>
                </div>
            )}
            {(cursorLatLng && (!showActionRadius || isActionRadiusCoordsMode)) && (
                <div className="map__cursor-coords">
                    {cursorLatLng.lat.toFixed(6)}, {cursorLatLng.lng.toFixed(6)}
                </div>
            )}
        </div>
    );
}

export default React.memo(MapComponent);