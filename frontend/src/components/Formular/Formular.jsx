import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import axios from "axios";
import "./Formular.css";
import FilterPanel from "../FilterPanel/FilterPanel";
import ObjectsTable from "../ObjectsTable/ObjectsTable";
import EventsTable from "../Events/EventsTable";
import EventsFilterPanel from "../Events/EventsFilterPanel";
import MapComponent from "../MapComponent/MapComponent";
import Features from "../Features/Features";
import ActionZoneFilters from "../Features/ActionZoneFilters";
import FormularModal from "../FormularModal/FormularModal";
import AddTargetModal from "../AddTargetModal/AddTargetModal";
import FormularEditor from "../FormularEditor/FormularEditor";
import EditTargetModal from "../EditTargetModal/EditTargetModal";
import AddEventModal from "../Events/AddEventModal";
import { findAllIntersections } from "../../utils/circleIntersection";

import { API_URL as API_ROOT } from '../../config/api';
const API_URL = `${API_ROOT}/api/v1/targets`;
const EVENTS_API_URL = `${API_ROOT}/api/v1/events`;
const COUNTRIES_API_URL = `${API_ROOT}/api/v1/countries`;
const EVENT_TYPES_API_URL = `${API_ROOT}/api/v1/event-types`;

export default function Formular() {
    const [activeTab, setActiveTab] = useState("objects");
    const [filterCountry, setFilterCountry] = useState([]);
    const [filterType, setFilterType] = useState([]);
    const [filterTitle, setFilterTitle] = useState("");
    const [objects, setObjects] = useState([]);
    const [events, setEvents] = useState([]);
    const [selectedEvents, setSelectedEvents] = useState([]);
    const [eventsFilters, setEventsFilters] = useState({
        title: "",
        dateFrom: "",
        dateTo: "",
        timeFrom: "",
        timeTo: "",
        countries: [],
        eventTypes: []
    });
    const [countriesList, setCountriesList] = useState([]);
    const [eventTypesList, setEventTypesList] = useState([]);
    const [selectedObj, setSelectedObj] = useState([]);
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [measurePoints, setMeasurePoints] = useState([]);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [showActionRadius, setShowActionRadius] = useState(false);
    const [actionRadiusMode, setActionRadiusMode] = useState("animation");
    const [selectedIntersections, setSelectedIntersections] = useState([]);

    // Состояния для панели управления "Зона действия" (перенесены в sidebar из MapComponent)
    const [actionZoneFilters, setActionZoneFilters] = useState({}); // { [countryTitle]: Set<string action titles> }
    const [showZoneIntersections, setShowZoneIntersections] = useState(true);
    // Под-режим отображения зон в fullScreen features (только для блока "Зона измерения" / "Зоны действия")
    // "intersections" — фокус на зонах пересечения (сохранён функционал расчёта/отображения)
    // "displaySettings" — чекбоксы по странам и типам зон (Настройка отображения)
    const [actionZoneViewMode, setActionZoneViewMode] = useState("displaySettings");
    const [selectedTargetId, setSelectedTargetId] = useState(null);
    const [hoveredTargetId, setHoveredTargetId] = useState(null);
    const [isAddTargetModalOpen, setIsAddTargetModalOpen] = useState(false);
    const [formularEditorTarget, setFormularEditorTarget] = useState(null);
    const [editTargetId, setEditTargetId] = useState(null);
    const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editEventDrawMode, setEditEventDrawMode] = useState(null);
    const [editEventDrawPoints, setEditEventDrawPoints] = useState([]);
    const intersectionsInitialized = useRef(false);
    const toolsRef = useRef(null);
// Это удалить если будет жопа
    const [isFullscreen, setFullscreen] = useState(false);

    const filteredObjects = useMemo(() => {
        return objects.filter((obj) => {
            const titleMatch = filterTitle.trim().length === 0
                ? true
                : obj.title?.toLowerCase().includes(filterTitle.trim().toLowerCase());
            if (!titleMatch) return false;
            const typeMatch = filterType.length === 0
                ? true
                : filterType.includes(obj.type?.title);
            if (!typeMatch) return false;
            // Если не выбрана ни одна страна - показываем все объекты
            if (filterCountry.length === 0) {
                return true;
            }
            // Проверяем, входит ли страна объекта в выбранные страны
            return filterCountry.includes(obj.country.title);
        });
    }, [objects, filterTitle, filterType, filterCountry]);

    // Для таблицы и выбора в зонах используем все объекты (игнорируем filterCountry).
    // Это позволяет выбирать объекты и изучать их Зоны действия, даже если маркеры страны скрыты чекбоксами.
    // Поиск по названию и тип всё равно применяются.
    const tableObjects = useMemo(() => {
        return objects.filter((obj) => {
            const titleMatch = filterTitle.trim().length === 0
                ? true
                : obj.title?.toLowerCase().includes(filterTitle.trim().toLowerCase());
            if (!titleMatch) return false;
            const typeMatch = filterType.length === 0
                ? true
                : filterType.includes(obj.type?.title);
            if (!typeMatch) return false;
            // Намеренно НЕ применяем filterCountry
            return true;
        });
    }, [objects, filterTitle, filterType]);

    const mapRef = useRef(null);

    const handleObjectClick = (obj) => {
        if (mapRef.current && obj?.lat != null && obj?.lng != null) {
            // Defer flyTo so it doesn't block current render/click handling
            // Shorter duration to reduce perceived hang during animation
            requestAnimationFrame(() => {
                if (mapRef.current) {
                    mapRef.current.flyTo([obj.lat, obj.lng], 8, {
                        duration: 1.0,
                        easeLinearity: 0.3
                    });
                }
            });
        }
    }

    const handleSubordinateFlyTo = (sub) => {
        if (!sub || !sub.id) return;
        if (mapRef.current && sub.lat != null && sub.lng != null) {
            // Defer + shorter duration to prevent jank/hang during long animations
            requestAnimationFrame(() => {
                if (mapRef.current) {
                    mapRef.current.flyTo([sub.lat, sub.lng], 8, {
                        duration: 1.0,
                        easeLinearity: 0.3
                    });
                }
            });
        }
    };

    const handleSubordinateOpenDetails = (sub) => {
        if (!sub || !sub.id) return;
        setSelectedTargetId(sub.id);
    };

    const getEventCenter = (eventItem) => {
        const shape = eventItem?.shape;
        if (!shape) return null;

        if (shape.type === "point" && shape.geometry) {
            return [shape.geometry.lat, shape.geometry.lng];
        }
        if (shape.type === "circle" && shape.geometry) {
            return [shape.geometry.lat, shape.geometry.lng];
        }
        if (shape.type === "area" && Array.isArray(shape.geometry?.points) && shape.geometry.points.length > 0) {
            const sum = shape.geometry.points.reduce(
                (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
                { lat: 0, lng: 0 }
            );
            return [sum.lat / shape.geometry.points.length, sum.lng / shape.geometry.points.length];
        }
        return null;
    };

    const handleEventFlyTo = (eventItem) => {
        const center = getEventCenter(eventItem);
        if (!center || !mapRef.current) return;
        requestAnimationFrame(() => {
            if (mapRef.current) {
                mapRef.current.flyTo(center, 8, {
                    duration: 1.0,
                    easeLinearity: 0.3
                });
            }
        });
    };

    const handleCheckboxChange = (id, checked) => {
        setSelectedObj((prev) => {
            if (checked) {
                return prev.includes(id) ? prev : [...prev, id];
            }
            return prev.filter((objId) => objId !== id);
        });
    };

    const handleEventCheckboxChange = (id, checked) => {
        setSelectedEvents((prev) => {
            if (checked) {
                return prev.includes(id) ? prev : [...prev, id];
            }
            return prev.filter((eventId) => eventId !== id);
        });
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

    const buildDrawPointsFromEvent = (eventItem) => {
        const shape = eventItem?.shape;
        if (!shape) return { drawMode: null, drawPoints: [] };

        if (shape.type === "point" && shape.geometry) {
            return {
                drawMode: "point",
                drawPoints: [{ lat: shape.geometry.lat, lng: shape.geometry.lng }]
            };
        }

        if (shape.type === "circle" && shape.geometry) {
            const { lat, lng, radius } = shape.geometry;
            const deltaLat = (radius || 0) / 111139;
            return {
                drawMode: "circle",
                drawPoints: [
                    { lat, lng },
                    { lat: lat + deltaLat, lng }
                ]
            };
        }

        if (shape.type === "area" && Array.isArray(shape.geometry?.points)) {
            return {
                drawMode: "polygon",
                drawPoints: shape.geometry.points.map((p) => ({ lat: p.lat, lng: p.lng }))
            };
        }

        return { drawMode: null, drawPoints: [] };
    };

    const measurements = useMemo(() => {
        return measurePoints.map((point, idx) => {
            if (idx === 0) {
                return { ...point, index: idx + 1, distance: 0 };
            }
            const prev = measurePoints[idx - 1];
            return { ...point, index: idx + 1, distance: calcDistanceMeters(prev, point) };
        });
    }, [measurePoints]);

    // Вычисление точек пересечения зон действия
    // Теперь базируемся на полном списке объектов + selectedObj (независимо от filterCountry / видимости маркеров).
    // Зоны действия должны быть доступны для изучения даже если маркер объекта скрыт страновым чекбоксом.
    const intersections = useMemo(() => {
        if (!showActionRadius) {
            return [];
        }
        const selectedSet = new Set(selectedObj);
        const baseVisible = objects.filter(obj => selectedSet.has(obj.id));
        const visibleForIntersections = baseVisible.map(obj => {
            if (!obj.actions || obj.actions.length === 0) return { ...obj, actions: [] };
            const cTitle = obj.country?.title || 'Неизвестно';
            const enabledSet = actionZoneFilters[cTitle];
            if (enabledSet === undefined) {
                // Нет явного фильтра для страны — используем все действия объекта
                return obj;
            }
            const filteredActions = obj.actions.filter(a => {
                const t = a.action_type?.title || 'Зона действия';
                return enabledSet.has(t);
            });
            return { ...obj, actions: filteredActions };
        }).filter(obj => obj.actions && obj.actions.length > 0);

        return findAllIntersections(visibleForIntersections);
    }, [showActionRadius, objects, selectedObj, actionZoneFilters]);

    // Мемоизируем ключ для отслеживания изменений пересечений
    const intersectionsKey = useMemo(() => {
        return intersections.map(i => i.id).sort().join('|');
    }, [intersections]);

    // Инициализируем выбор точек только при первом появлении или сбросе
    useEffect(() => {
        if (!showActionRadius) {
            // При выключении инструмента сбрасываем флаг инициализации
            intersectionsInitialized.current = false;
            setSelectedIntersections([]);
            return;
        }
        
        if (intersections.length > 0 && !intersectionsInitialized.current) {
            // Первая инициализация - выбираем все точки
            setSelectedIntersections(intersections.map(i => i.id));
            intersectionsInitialized.current = true;
        } else if (intersections.length > 0 && intersectionsInitialized.current) {
            // Синхронизация: удаляем ID точек, которых больше нет
            setSelectedIntersections(prev => {
                const currentIds = intersections.map(i => i.id);
                return prev.filter(id => currentIds.includes(id));
            });
        }
    }, [showActionRadius, intersectionsKey]);

    const handleIntersectionToggle = (id) => {
        setSelectedIntersections(prev => 
            prev.includes(id) 
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleSelectAllIntersections = (checked) => {
        if (checked) {
            setSelectedIntersections(intersections.map(i => i.id));
        } else {
            setSelectedIntersections([]);
        }
    };

    // === Логика панели управления Зонами действия (перенесена в sidebar) ===
    // Используем полный список объектов (objects), а не filteredObjects.
    // Это позволяет панели наполняться странами/типами зон для выбранных объектов,
    // даже если их маркеры скрыты страновыми чекбоксами filterCountry.
    const actionZoneAvailableByCountry = useMemo(() => {
      const byCountry = {};
      objects.forEach((obj) => {
        if (!selectedObj.includes(obj.id) || !obj.actions || obj.actions.length === 0) return;
        const c = obj.country?.title || 'Неизвестно';
        if (!byCountry[c]) byCountry[c] = new Set();
        obj.actions.forEach((a) => {
          const t = a.action_type?.title || 'Зона действия';
          byCountry[c].add(t);
        });
      });
      return byCountry;
    }, [objects, selectedObj]);

    const toggleActionType = useCallback((country, actionTitle) => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        const currentSet = next[country] ? new Set(next[country]) : new Set(actionZoneAvailableByCountry[country] || []);
        if (currentSet.has(actionTitle)) currentSet.delete(actionTitle);
        else currentSet.add(actionTitle);
        next[country] = currentSet;
        return next;
      });
    }, [actionZoneAvailableByCountry]);

    const toggleAllForCountry = useCallback((country, allTypes, shouldEnable) => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        next[country] = shouldEnable ? new Set(allTypes) : new Set();
        return next;
      });
    }, []);

    const resetZoneFilters = useCallback((enableAll) => {
      const next = {};
      Object.keys(actionZoneAvailableByCountry).forEach((c) => {
        next[c] = enableAll ? new Set(actionZoneAvailableByCountry[c]) : new Set();
      });
      setActionZoneFilters(next);
    }, [actionZoneAvailableByCountry]);

    // Синхронизация фильтров (добавление новых стран/типов при изменении выбора)
    useEffect(() => {
      if (!showActionRadius) return;
      if (Object.keys(actionZoneAvailableByCountry).length === 0) return;

      setActionZoneFilters((prev) => {
        const next = { ...prev };
        let changed = false;

        Object.entries(actionZoneAvailableByCountry).forEach(([c, typesSet]) => {
          const types = Array.from(typesSet);
          if (!next[c]) {
            next[c] = new Set(types);
            changed = true;
          } else {
            const current = next[c];
            const updated = new Set(current);
            let localChanged = false;
            types.forEach((t) => {
              if (!updated.has(t)) {
                updated.add(t);
                localChanged = true;
              }
            });
            if (localChanged) {
              next[c] = updated;
              changed = true;
            }
          }
        });

        Object.keys(next).forEach((c) => {
          if (!actionZoneAvailableByCountry[c]) {
            delete next[c];
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, [showActionRadius, actionZoneAvailableByCountry]);

    // Force clean state for "Зона действия" tool in fullScreen (ensures !isMeasureMode branch in Features for map_sidebar).
    // Note: actionZoneViewMode is now user-controlled via the second radio block ("Зона пересечения" / "Настройка отображения")
    // in fs Features — do NOT force it back here (would prevent selecting "Зона пересечения").
    // Default "displaySettings" is set on tool enable in the tools-menu onClick (for fs).
    // actionRadiusMode force kept for backward (no longer drives any UI after removal of first legacy radio block).
    useEffect(() => {
      if (showActionRadius && isFullscreen) {
        if (actionRadiusMode !== "zones") {
          setActionRadiusMode("zones");
        }
        // Intentionally do not force actionZoneViewMode — user choice via radios must persist.
      }
    }, [showActionRadius, isFullscreen, actionRadiusMode]);

    const handleToggleMeasure = () => {
        setIsMeasureMode((prev) => {
            const next = !prev;
            if (!next) {
                setMeasurePoints([]);
            }
            return next;
        });
        setIsToolsOpen(false);
    };

    const handleToggleTools = () => setIsToolsOpen((prev) => !prev);

    const handleAddMeasurePoint = ({ lat, lng }) => {
        setMeasurePoints((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, lat, lng }]);
    };

    const handleRemoveMeasurePoint = (id) => {
        setMeasurePoints((prev) => prev.filter((p) => p.id !== id));
    };

    const fetchData = async () => {
        try {
            const resp = await axios.get(API_URL);
            const data = resp.data;
            const rawArr = Array.isArray(data) ? data : [];
            setObjects(rawArr);
        } catch(err) {
            console.error("Не удалось загрузить данные по объектам", err);
        }
    };

    const fetchCountries = async () => {
        try {
            const resp = await axios.get(COUNTRIES_API_URL);
            const data = Array.isArray(resp.data) ? resp.data : [];
            setCountriesList(data);
        } catch (err) {
            console.error("Не удалось загрузить список стран", err);
        }
    };

    const fetchEventTypes = async () => {
        try {
            const resp = await axios.get(EVENT_TYPES_API_URL);
            const data = Array.isArray(resp.data) ? resp.data : [];
            setEventTypesList(data);
        } catch (err) {
            console.error("Не удалось загрузить список типов событий", err);
        }
    };

    const fetchEvents = async () => {
        try {
            const params = {};
            if (eventsFilters.title?.trim()) params.title = eventsFilters.title.trim();
            if (eventsFilters.dateFrom) params.date_from = eventsFilters.dateFrom;
            if (eventsFilters.dateTo) params.date_to = eventsFilters.dateTo;
            if (eventsFilters.timeFrom) params.time_from = eventsFilters.timeFrom;
            if (eventsFilters.timeTo) params.time_to = eventsFilters.timeTo;
            if (eventsFilters.countries.length > 0) params.countries = eventsFilters.countries.join(",");
            if (eventsFilters.eventTypes.length > 0) params.event_types = eventsFilters.eventTypes.join(",");

            const resp = await axios.get(EVENTS_API_URL, { params });
            const data = Array.isArray(resp.data) ? resp.data : [];
            setEvents(data);
        } catch (err) {
            console.error("Не удалось загрузить события", err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchCountries();
        fetchEventTypes();
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [eventsFilters]);

    const handleTargetAdded = (newTarget) => {
        // Перезагружаем список объектов после добавления
        fetchData();
    };
    
    const handleTargetAddedWithFormular = (newTarget) => {
        // Перезагружаем список объектов и открываем редактор формуляра
        fetchData();
        setFormularEditorTarget(newTarget);
    };
    
    const handleFormularSaved = () => {
        // Можно добавить логику после сохранения формуляра
        fetchData();
    };

    const handleEditClick = (targetId) => {
        setEditTargetId(targetId);
    };

    const handleDeleteClick = async (targetId, targetTitle) => {
        const confirmed = window.confirm(`Вы уверены, что хотите удалить объект "${targetTitle}"?`);
        if (!confirmed) return;

        try {
            await axios.delete(`${API_URL}/${targetId}/`);
            // Обновляем список объектов
            fetchData();
            // Если удалённый объект был выбран, снимаем выделение
            setSelectedObj(prev => prev.filter(id => id !== targetId));
        } catch (err) {
            console.error("Ошибка при удалении объекта:", err);
            alert("Не удалось удалить объект. Попробуйте ещё раз.");
        }
    };

    const handleTargetUpdated = () => {
        // Перезагружаем список объектов после обновления
        fetchData();
    };

    const buildEventShape = (geometry) => {
        if (!geometry) return null;
        const { drawMode, drawPoints } = geometry;
        if (drawMode === "point" && drawPoints?.[0]) {
            return {
                type: "point",
                geometry: {
                    lat: drawPoints[0].lat,
                    lng: drawPoints[0].lng
                }
            };
        }
        if (drawMode === "circle" && drawPoints?.length >= 2) {
            return {
                type: "circle",
                geometry: {
                    lat: drawPoints[0].lat,
                    lng: drawPoints[0].lng,
                    radius: Math.round(calcDistanceMeters(drawPoints[0], drawPoints[1]))
                }
            };
        }
        if ((drawMode === "rectangle" || drawMode === "polygon") && drawPoints?.length > 0) {
            return {
                type: "area",
                geometry: {
                    points: drawPoints.map((point) => ({ lat: point.lat, lng: point.lng }))
                }
            };
        }
        return null;
    };

    const handleEventSave = async (payload) => {
        try {
            const shape = buildEventShape(payload?.geometry);
            const body = {
                title: payload.title,
                object_name: payload.object,
                description: payload.info,
                date_start: payload.dateStart || null,
                date_end: payload.dateEnd || null,
                time_start: payload.timeStart || null,
                time_end: payload.timeEnd || null,
                event_type: payload.eventType?.id || null,
                country: payload.country?.id || null,
                marker: payload.marker?.id || null,
                color: payload.color || "#2f80ed",
                shape
            };

            await axios.post(EVENTS_API_URL + "/", body);
            fetchEvents();
        } catch (err) {
            console.error("Не удалось сохранить событие", err);
        }
    };

    const handleEventUpdate = async (payload) => {
        const eventId = payload?.id || editingEvent?.id;
        if (!eventId) return;
        try {
            const shape = buildEventShape(payload?.geometry);
            const body = {
                title: payload.title,
                object_name: payload.object,
                description: payload.info,
                date_start: payload.dateStart || null,
                date_end: payload.dateEnd || null,
                time_start: payload.timeStart || null,
                time_end: payload.timeEnd || null,
                event_type: payload.eventType?.id || null,
                country: payload.country?.id || null,
                marker: payload.marker?.id || null,
                color: payload.color || "#2f80ed",
                shape
            };

            await axios.patch(`${EVENTS_API_URL}/${eventId}/`, body);
            fetchEvents();
        } catch (err) {
            console.error("Не удалось обновить событие", err);
        }
    };

    const handleEventEdit = (eventItem) => {
        const { drawMode, drawPoints } = buildDrawPointsFromEvent(eventItem);
        setEditingEvent(eventItem);
        setEditEventDrawMode(drawMode);
        setEditEventDrawPoints(drawPoints);
        setIsEditEventModalOpen(true);
    };

    const handleEventDelete = async (eventItem) => {
        const confirmed = window.confirm(`Удалить событие "${eventItem.title}"?`);
        if (!confirmed) return;
        try {
            await axios.delete(`${EVENTS_API_URL}/${eventItem.id}/`);
            fetchEvents();
        } catch (err) {
            console.error("Не удалось удалить событие", err);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!isToolsOpen) return;
            if (toolsRef.current && !toolsRef.current.contains(e.target)) {
                setIsToolsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isToolsOpen]);

    return (
        <section className="formular">
            <h1 className="visually-hidden">О</h1>
            <div className="container">
                <div className="formular__wraper">
                    <div className={`formular__content${isFullscreen ? " formular__content--map-fullscreen" : ""}`}>
                        <div className="formular__heading-wraper">
                            <h2 className="formular__title">ОР</h2>
                            <div className="formular__heading-actions">
                                <button 
                                    className="btn" 
                                    type="button" 
                                    onClick={() => setIsAddTargetModalOpen(true)}
                                    aria-label="Добавить новый объект"
                                >
                                    <svg className="formular__icon" width="24" height="24">
                                        <use href={"/sprite.svg#new-file"} />
                                    </svg>
                                </button>
                                <div className="formular__tools" ref={toolsRef}>
                                    <button
                                        className={`btn button__tools${isToolsOpen ? " button__tools--active" : ""}`}
                                        type="button"
                                        onClick={handleToggleTools}
                                        aria-label="Инструменты"
                                    >
                                        Инструменты
                                    </button>
                                    {isToolsOpen && (
                                        <div className="formular__tools-menu">
                                            <button
                                                className={`tools-menu__item${isMeasureMode ? " tools-menu__item--active" : ""}`}
                                                type="button"
                                                onClick={handleToggleMeasure}
                                            >
                                                <span className="tools-menu__label">Режим измерения</span>
                                                <svg className="formular__icon" width="20" height="20" aria-hidden="true">
                                                    <use href={"/sprite.svg#measure"} />
                                                </svg>
                                            </button>
                                            <button
                                                className={`tools-menu__item${showActionRadius ? " tools-menu__item--active" : ""}`}
                                                type="button"
                                                onClick={() => {
                                                    setShowActionRadius((prev) => {
                                                        const next = !prev;
                                                        if (next) {
                                                            // В fullScreen сразу активируем radiobutton для панели в features/map_sidebar
                                                            setActionRadiusMode(isFullscreen ? "zones" : "animation");
                                                            // Важно: при активации "Зона действия" выключаем "Режим измерения",
                                                            // чтобы в Features (в fullScreen как map_sidebar) сработала ветка !isMeasureMode
                                                            // и появилась новая radiobutton "Зоны действия" (кнопка для выбора отображаемых зон)
                                                            // + панель ActionZoneFilters с чекбоксами по государствам и типам зон.
                                                            setIsMeasureMode(false);

                                                            // Новый под-режим для блока в features: при активации "Зона измерения" в fullScreen
                                                            // показываем новый блок радиокнопок ("Зоны пересечения" / "Настройка отображения")
                                                            if (isFullscreen) {
                                                                setActionZoneViewMode("displaySettings");
                                                            }
                                                        }
                                                        return next;
                                                    });
                                                    setIsToolsOpen(false);
                                                }}
                                            >
                                                <span className="tools-menu__label">Зона действия</span>
                                                <svg className="formular__icon" width="20" height="20" aria-hidden="true">
                                                    <use href={"/sprite.svg#measure"} />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="formular__data-wraper">
                            <div className="formular__tabs">
                                <button
                                    type="button"
                                    className={`formular__tab${activeTab === "objects" ? " formular__tab--active" : ""}`}
                                    onClick={() => setActiveTab("objects")}
                                >
                                    Объекты
                                </button>
                                <button
                                    type="button"
                                    className={`formular__tab${activeTab === "events" ? " formular__tab--active" : ""}`}
                                    onClick={() => setActiveTab("events")}
                                >
                                    События
                                </button>
                            </div>
                            {activeTab === "objects" && (
                                <>
                                    <FilterPanel 
                                        objects={objects}
                                        filterCountry={filterCountry}
                                        onFilterCountryChange={setFilterCountry}
                                        filterType={filterType}
                                        onFilterTypeChange={setFilterType}
                                        filterTitle={filterTitle}
                                        onFilterTitleChange={setFilterTitle}
                                    />
                                    {/* Панель управления Зонами действия — в sidebar (обычный режим). Компонент также используется в features для fullScreen (map_sidebar). */}
                                    {showActionRadius && (
                                        <ActionZoneFilters
                                            actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                            actionZoneFilters={actionZoneFilters}
                                            showZoneIntersections={showZoneIntersections}
                                            setShowZoneIntersections={setShowZoneIntersections}
                                            toggleActionType={toggleActionType}
                                            toggleAllForCountry={toggleAllForCountry}
                                            resetZoneFilters={resetZoneFilters}
                                        />
                                    )}
                                    <ObjectsTable 
                                        data={tableObjects}
                                        selectedObj={selectedObj}
                                        onCheckboxChange={handleCheckboxChange}
                                        onObjectClick={handleObjectClick}
                                        hoveredTargetId={hoveredTargetId}
                                        onTitleClick={setSelectedTargetId}
                                        onRowHover={setHoveredTargetId}
                                        onEditClick={handleEditClick}
                                        onDeleteClick={handleDeleteClick}
                                    />
                                </>
                            )}
                            {activeTab === "events" && (
                                <>
                                    <EventsFilterPanel
                                        countries={countriesList}
                                        eventTypes={eventTypesList}
                                        filters={eventsFilters}
                                        onChange={setEventsFilters}
                                    />
                                    <EventsTable
                                        data={events}
                                        selectedEvents={selectedEvents}
                                        onCheckboxChange={handleEventCheckboxChange}
                                        onFlyTo={handleEventFlyTo}
                                        onEdit={handleEventEdit}
                                        onDelete={handleEventDelete}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                    <div className="formular__features-wraper">
                        <div className="formular__map">
                            <MapComponent 
                                objects={filteredObjects}
                                objectsAll={objects}
                                selectedObj={selectedObj}
                                events={events}
                                selectedEventIds={selectedEvents}
                                mapRef={mapRef}
                                measureMode={isMeasureMode}
                                measurements={measurements}
                                onAddMeasurePoint={handleAddMeasurePoint}
                                onCheckboxChange={handleCheckboxChange}
                                showActionRadius={showActionRadius}
                                actionRadiusMode={actionRadiusMode}
                                onActionRadiusModeChange={setActionRadiusMode}
                                intersections={intersections}
                                selectedIntersections={selectedIntersections}
                                onIntersectionToggle={handleIntersectionToggle}
                                onSelectAllIntersections={handleSelectAllIntersections}
                                isFullscreen={isFullscreen}
                                setIsFullscreen={setFullscreen}
                                // Управление зонами теперь в sidebar; передаём актуальные значения фильтров
                                actionZoneFilters={actionZoneFilters}
                                showZoneIntersections={showZoneIntersections}
                                onMeasureModeChange={setIsMeasureMode}
                                onMeasurePointsChange={setMeasurePoints}
                                onShowActionRadiusChange={setShowActionRadius}
                                onMarkerHover={setHoveredTargetId}
                                onMarkerClick={setSelectedTargetId}
                                onEditClick={handleEditClick}
                                onDeleteClick={handleDeleteClick}
                                onEventSave={handleEventSave}
                                filterCountry={filterCountry}
                                onFilterCountryChange={setFilterCountry}
                                filterType={filterType}
                                onFilterTypeChange={setFilterType}
                                filterTitle={filterTitle}
                                onFilterTitleChange={setFilterTitle}
                                countriesList={countriesList}
                                eventTypesList={eventTypesList}
                                eventsFilters={eventsFilters}
                                onEventsFiltersChange={setEventsFilters}
                                onEventCheckboxChange={handleEventCheckboxChange}
                                onEventDelete={handleEventDelete}
                                onEventFlyTo={handleEventFlyTo}
                                onEventEdit={handleEventEdit}
                                editEventDrawMode={editEventDrawMode}
                                editEventDrawPoints={editEventDrawPoints}
                                onEditEventDrawPointsChange={setEditEventDrawPoints}
                                isEditEventMode={isEditEventModalOpen}
                                tableTab={activeTab}
                                // Полные props для зоны действия / фильтров / viewMode, чтобы fs-версия Features внутри MapComponent
                                // (map_sidebar) могла рендерить суб-радио "Зоны измерения" и панель "Настройка отображения".
                                // Ранее неполная передача — основная причина, почему панель не появлялась в fullScreen.
                                actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                setShowZoneIntersections={setShowZoneIntersections}
                                toggleActionType={toggleActionType}
                                toggleAllForCountry={toggleAllForCountry}
                                resetZoneFilters={resetZoneFilters}
                                actionZoneViewMode={actionZoneViewMode}
                                onActionZoneViewModeChange={setActionZoneViewMode}
                            />
                        </div>
                        <div className="formular__features">
                            <Features 
                                isMeasureMode={isMeasureMode}
                                measurements={measurements}
                                onRemovePoint={handleRemoveMeasurePoint}
                                showActionRadius={showActionRadius}
                                actionRadiusMode={actionRadiusMode}
                                onActionRadiusModeChange={setActionRadiusMode}
                                intersections={intersections}
                                selectedIntersections={selectedIntersections}
                                onIntersectionToggle={handleIntersectionToggle}
                                onSelectAllIntersections={handleSelectAllIntersections}
                                // Для fullScreen: панель зон в features (map_sidebar) через отдельную radiobutton; state общий
                                isFullscreen={isFullscreen}
                                actionZoneFilters={actionZoneFilters}
                                actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                showZoneIntersections={showZoneIntersections}
                                setShowZoneIntersections={setShowZoneIntersections}
                                toggleActionType={toggleActionType}
                                toggleAllForCountry={toggleAllForCountry}
                                resetZoneFilters={resetZoneFilters}
                                // Новый под-режим для блока радиокнопок в features (fullScreen map_sidebar)
                                actionZoneViewMode={actionZoneViewMode}
                                onActionZoneViewModeChange={setActionZoneViewMode}
                            />
                        </div>
                    </div>
                    
                </div>
            </div>

            {/* Модальное окно формуляра */}
            {selectedTargetId && (
                <FormularModal 
                    targetId={selectedTargetId}
                    onClose={() => setSelectedTargetId(null)}
                    onEdit={handleEditClick}
                    onSubordinateFlyTo={handleSubordinateFlyTo}
                    onSubordinateOpenDetails={handleSubordinateOpenDetails}
                />
            )}

            {/* Модальное окно добавления объекта */}
            <AddTargetModal 
                isOpen={isAddTargetModalOpen}
                onClose={() => setIsAddTargetModalOpen(false)}
                onTargetAdded={handleTargetAdded}
                onTargetAddedWithFormular={handleTargetAddedWithFormular}
            />
            
            {/* Редактор формуляра */}
            <FormularEditor 
                targetId={formularEditorTarget?.id}
                targetTitle={formularEditorTarget?.title}
                isOpen={!!formularEditorTarget}
                onClose={() => setFormularEditorTarget(null)}
                onSaved={handleFormularSaved}
            />
            
            {/* Модальное окно редактирования объекта */}
            <EditTargetModal 
                targetId={editTargetId}
                isOpen={!!editTargetId}
                onClose={() => setEditTargetId(null)}
                onTargetUpdated={handleTargetUpdated}
            />

            {isEditEventModalOpen && (
                <AddEventModal
                    isOpen={isEditEventModalOpen}
                    onClose={() => {
                        setIsEditEventModalOpen(false);
                        setEditingEvent(null);
                        setEditEventDrawMode(null);
                        setEditEventDrawPoints([]);
                    }}
                    drawMode={editEventDrawMode}
                    drawPoints={editEventDrawPoints}
                    initialEvent={editingEvent}
                    onSave={handleEventUpdate}
                />
            )}
        </section>
    );
}
