import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, startTransition, useDeferredValue } from "react";
import { useAuth } from "../../context/AuthContext";
import { canDelete, canManageReference, canReadModule, canWriteModule } from "../../utils/permissions";
import UsersAdminPanel from "../Admin/UsersAdminPanel";
import "./Formular.css";
import FilterPanel from "../FilterPanel/FilterPanel";
import ObjectsTable from "../ObjectsTable/ObjectsTable";
import EventsTable from "../Events/EventsTable";
import EventsFilterPanel from "../Events/EventsFilterPanel";
import SituationsFilterPanel from "../OperationalSituation/SituationsFilterPanel";
import SituationsTable from "../OperationalSituation/SituationsTable";
import SituationsTimeline from "../OperationalSituation/SituationsTimeline";
import SituationModal from "../OperationalSituation/SituationModal";
import MapComponent from "../MapComponent/MapComponent";
import Features from "../Features/Features";
import ActionZoneFilters from "../Features/ActionZoneFilters";
import IntersectionTable from "../IntersectionTable/IntersectionTable";
import FormularModal from "../FormularModal/FormularModal";
import AddTargetModal from "../AddTargetModal/AddTargetModal";
import EditTargetModal from "../EditTargetModal/EditTargetModal";
import AddEventModal from "../Events/AddEventModal";
import { buildDrawPointsFromEvent, getEventCenter } from "../../utils/eventGeometry";
import { geoJsonPolygonToDrawPoints, pointsToGeoJsonPolygon } from "../../utils/inundationZone";
import { buildSituationRequestBody, getSituationDisplayRevision, getSituationId } from "../../utils/situationUtils";
import { toggleIdInList } from "../../utils/selectionUtils";
import { useTargetsList } from "../../hooks/formular/useTargetsList";
import { useFormularReferenceLists } from "../../hooks/formular/useFormularReferenceLists";
import { useReferenceData } from "../../hooks/useReferenceData";
import { useEventsList } from "../../hooks/formular/useEventsList";
import { useOperationalSituationsList } from "../../hooks/formular/useOperationalSituationsList";
import { useActionZoneState } from "../../hooks/formular/useActionZoneState";
import { useConsiderTerrain } from "../../hooks/formular/useConsiderTerrain";
import { useAutoLosZoneGeometries } from "../../hooks/formular/useAutoLosZoneGeometries";
import { useMeasurePoints } from "../../hooks/formular/useMeasurePoints";
import { useObjectFilters } from "../../hooks/formular/useObjectFilters";
import { useMapFlyTo } from "../../hooks/formular/useMapFlyTo";
import { buildVisibleZones } from "../../utils/buildVisibleZones";
import { isLosRadarZoneMode } from "../../utils/computeLosZone";

const FormularEditor = lazy(() => import("../FormularEditor/FormularEditor"));
const ReferenceDataModal = lazy(() => import("../ReferenceData/ReferenceDataModal"));

export default function Formular() {
    const { user } = useAuth();
    const canEditTargets = canWriteModule(user, 'targets');
    const canReadSituations = canReadModule(user, 'operational_situations');
    const canEditSituations = canWriteModule(user, 'operational_situations');
    const canRemoveTargets = canDelete(user);
    const canOpenReference = canManageReference(user);
    const [usersAdminOpen, setUsersAdminOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("objects");
    const [selectedObj, setSelectedObj] = useState([]);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [actionRadiusMode, setActionRadiusMode] = useState("animation");
    const [selectedTargetId, setSelectedTargetId] = useState(null);
    const [hoveredTargetId, setHoveredTargetId] = useState(null);
    const [isAddTargetModalOpen, setIsAddTargetModalOpen] = useState(false);
    const [addTargetDraft, setAddTargetDraft] = useState(null);
    const [formularEditorTarget, setFormularEditorTarget] = useState(null);
    const [editTargetId, setEditTargetId] = useState(null);
    const [editTargetFormPatch, setEditTargetFormPatch] = useState(null);
    const [polygonDrawSession, setPolygonDrawSession] = useState(null);
    const polygonDrawSessionRef = useRef(null);
    const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editEventDrawMode, setEditEventDrawMode] = useState(null);
    const [editEventDrawPoints, setEditEventDrawPoints] = useState([]);
    const [isFullscreen, setFullscreen] = useState(false);
    const [isReferenceDataOpen, setReferenceDataOpen] = useState(false);
    const [referenceEquipmentId, setReferenceEquipmentId] = useState(null);
    const [isSituationDrawActive, setIsSituationDrawActive] = useState(false);
    const [situationDrawPoints, setSituationDrawPoints] = useState([]);
    const [situationModalOpen, setSituationModalOpen] = useState(false);
    const [situationModalMode, setSituationModalMode] = useState('create');
    const [situationModalTarget, setSituationModalTarget] = useState(null);
    const [detailSituation, setDetailSituation] = useState(null);
    const [situationRevisions, setSituationRevisions] = useState([]);
    const [selectedRevisionId, setSelectedRevisionId] = useState(null);
    const [previewRevision, setPreviewRevision] = useState(null);
    const [highlightedSituationId, setHighlightedSituationId] = useState(null);

    const mapRef = useRef(null);
    const toolsRef = useRef(null);

    const { objects, loading: objectsLoading, error: objectsError, refresh: refreshTargets, deleteTarget } = useTargetsList();
    const { countriesList, eventTypesList, actionTypesList, reloadReferenceLists } = useFormularReferenceLists();
    const { considerTerrain, setConsiderTerrain } = useConsiderTerrain();
    const { targetTypes } = useReferenceData(true);
    const {
        filterCountry, setFilterCountry,
        filterType, setFilterType,
        filterTitle, setFilterTitle,
        filteredObjects, tableObjects,
    } = useObjectFilters(objects);
    const {
        events, loading: eventsLoading, error: eventsError,
        filters: eventsFilters, setFilters: setEventsFilters,
        selectedEvents, setSelectedEvents,
        saveEvent, updateEvent, deleteEvent,
    } = useEventsList(activeTab);
    const {
        situations,
        timeline,
        loading: situationsLoading,
        error: situationsError,
        filters: situationsFilters,
        setFilters: setSituationsFilters,
        selectedSituations,
        setSelectedSituations,
        fetchRevisions,
        createSituation,
        correctSituation,
        createSituationRevision,
        forkSituation,
        deleteSituation,
    } = useOperationalSituationsList(activeTab, canReadSituations);

    const {
        actionZoneFilters,
        showZoneIntersections, setShowZoneIntersections,
        hasEnabledZones,
        actionZoneAvailableByCountry,
        intersections, selectedIntersections,
        toggleActionType, toggleAllForCountry, resetZoneFilters,
        handleIntersectionToggle, handleSelectAllIntersections,
    } = useActionZoneState(objects, { zonesActive: activeTab === "zones" });

    const zonesLayerActive = activeTab === "zones" && hasEnabledZones;
    const deferredZoneFilters = useDeferredValue(actionZoneFilters);

    const visibleZones = useMemo(() => {
        if (!zonesLayerActive) return [];
        return buildVisibleZones(objects, deferredZoneFilters);
    }, [zonesLayerActive, objects, deferredZoneFilters]);

    const terrainZones = useMemo(() => {
        if (!zonesLayerActive || !considerTerrain) return [];
        return visibleZones.filter((zone) => isLosRadarZoneMode(zone.zoneMode));
    }, [visibleZones, zonesLayerActive, considerTerrain]);

    const {
        geometryByActionId: losGeometryByActionId,
        computingCount: losComputingCount,
        losZonesCount,
    } = useAutoLosZoneGeometries({
        terrainZones,
        considerTerrain,
        enabled: zonesLayerActive,
    });

    const {
        isMeasureMode, setIsMeasureMode,
        setMeasurePoints,
        measurements, toggleMeasureMode,
        addMeasurePoint, removeMeasurePoint,
    } = useMeasurePoints();

    const { flyTo, flyToSituation } = useMapFlyTo(mapRef);

    const handleMarkerHoverFromMap = useCallback((targetId) => {
        setHoveredTargetId((prev) => (prev === targetId ? prev : targetId));
    }, []);

    const handleTabChange = useCallback((tab) => {
        startTransition(() => {
            setActiveTab(tab);
            if (tab === "zones") {
                setIsMeasureMode(false);
                if (isFullscreen) {
                    setActionRadiusMode("zones");
                }
            }
        });
    }, [isFullscreen, setIsMeasureMode]);

    const handleShowActionRadiusChange = useCallback((enabled) => {
        if (enabled) handleTabChange("zones");
    }, [handleTabChange]);

    const handleObjectClick = useCallback((obj) => {
        flyTo(obj?.lat, obj?.lng);
    }, [flyTo]);

    const handleSubordinateFlyTo = useCallback((sub) => {
        if (!sub?.id) return;
        flyTo(sub.lat, sub.lng);
    }, [flyTo]);

    const handleSubordinateOpenDetails = useCallback((sub) => {
        if (sub?.id) setSelectedTargetId(sub.id);
    }, []);

    const handleOpenEquipmentInCatalog = useCallback((equipmentId) => {
        if (!equipmentId) return;
        setReferenceEquipmentId(equipmentId);
        setReferenceDataOpen(true);
        setSelectedTargetId(null);
    }, []);

    const handleCloseReferenceData = useCallback(() => {
        setReferenceDataOpen(false);
        setReferenceEquipmentId(null);
    }, []);

    const handleEventFlyTo = useCallback((eventItem) => {
        const center = getEventCenter(eventItem);
        if (center) flyTo(center[0], center[1]);
    }, [flyTo]);

    const handleCheckboxChange = useCallback((id, checked) => {
        setSelectedObj((prev) => toggleIdInList(prev, id, checked));
    }, []);

    const handleEventCheckboxChange = useCallback((id, checked) => {
        setSelectedEvents((prev) => toggleIdInList(prev, id, checked));
    }, [setSelectedEvents]);

    const handleSituationCheckboxChange = useCallback((id, checked) => {
        setSelectedSituations((prev) => toggleIdInList(prev, id, checked));
    }, [setSelectedSituations]);

    const handleSituationFlyTo = useCallback((situation) => {
        const displayRevision = getSituationDisplayRevision(situation);
        flyToSituation(displayRevision || situation);
    }, [flyToSituation]);

    const openSituationModal = useCallback((mode, situation = null) => {
        setSituationModalMode(mode);
        setSituationModalTarget(situation);
        setSituationModalOpen(true);
        if (mode === 'create' && situation?.drawPoints) {
            setSituationDrawPoints(situation.drawPoints);
        } else if (situation?.current_revision || situation?.drawPoints) {
            const rev = situation.current_revision;
            setSituationDrawPoints(
                situation.drawPoints || geoJsonPolygonToDrawPoints(rev?.geometry),
            );
        }
        if (situation?.id) {
            setSelectedSituations((prev) => (
                prev.includes(situation.id) ? prev : [...prev, situation.id]
            ));
            flyToSituation(situation);
        }
    }, [flyToSituation, setSelectedSituations]);

    const handleSituationCreateStart = useCallback(() => {
        // Принудительный сброс возможных "залипаний" UI-состояния после удаления/сохранения:
        // если оставалась открытой модалка или активный режим рисования,
        // то кнопка "Добавить обстановку" могла визуально нажиматься, но режим не включался.
        setIsSituationDrawActive(false);
        setSituationModalOpen(false);
        setSituationModalTarget(null);
        setSituationModalMode('create');

        setSituationDrawPoints([]);
        setDetailSituation(null);
        setSituationRevisions([]);
        setSelectedRevisionId(null);
        setPreviewRevision(null);
        setHighlightedSituationId(null);

        // Обновляем состояние в 2 шага, чтобы React гарантированно перерисовал MapComponent и включил draw.
        requestAnimationFrame(() => {
            setIsSituationDrawActive(true);
        });
    }, []);

    const handleSituationDrawConfirm = useCallback((points) => {
        const nextPoints = points || situationDrawPoints;
        setIsSituationDrawActive(false);
        setSituationDrawPoints(nextPoints);
        openSituationModal('create', { drawPoints: nextPoints });
    }, [openSituationModal, situationDrawPoints]);

    const handleSituationDrawCancel = useCallback(() => {
        setIsSituationDrawActive(false);
        setSituationDrawPoints([]);
    }, []);

    const handleSituationEdit = useCallback((situation) => {
        openSituationModal('edit', situation);
    }, [openSituationModal]);

    const handleSituationNewState = useCallback((situation) => {
        openSituationModal('new_state', situation);
    }, [openSituationModal]);

    const handleSituationFork = useCallback((situation) => {
        openSituationModal('fork', situation);
    }, [openSituationModal]);

    const handleCloseSituationModal = useCallback(() => {
        setSituationModalOpen(false);
        setSituationModalTarget(null);
        setSituationDrawPoints([]);
    }, []);

    const handleSituationSave = useCallback(async ({ mode, form, drawPoints, situationId }) => {
        const payload = buildSituationRequestBody(form, drawPoints);
        if (mode === 'create') {
            await createSituation(payload);
        } else if (mode === 'correction') {
            await correctSituation(situationId, payload);
        } else if (mode === 'new_state') {
            await createSituationRevision(situationId, payload);
        } else if (mode === 'fork') {
            await forkSituation(situationId, payload);
        }
        if (situationId && detailSituation?.id === situationId) {
            const revisions = await fetchRevisions(situationId);
            setSituationRevisions(revisions.map((revision) => ({
                ...revision,
                situation_id: situationId,
            })));
            setSelectedRevisionId(null);
            setPreviewRevision(null);
        }
    }, [createSituation, correctSituation, createSituationRevision, forkSituation, detailSituation, fetchRevisions]);

    const handleSituationDelete = useCallback(async (situation) => {
        const deleted = await deleteSituation(situation);
        if (deleted) {
            setSelectedSituations((prev) => prev.filter((id) => id !== situation.id));
            if (detailSituation?.id === situation.id) {
                setDetailSituation(null);
                setSituationRevisions([]);
                setPreviewRevision(null);
            }

            // Сбросим связанные UI-режимы, чтобы после удаления можно было снова создать обстановку.
            setIsSituationDrawActive(false);
            setSituationModalOpen(false);
            setSituationModalTarget(null);
            setSituationDrawPoints([]);
            setSelectedRevisionId(null);
            setPreviewRevision(null);
            setHighlightedSituationId(null);
        }
    }, [deleteSituation, detailSituation, setSelectedSituations]);

    const handleSituationRowClick = useCallback((situation) => {
        setHighlightedSituationId(situation.id);
        setPreviewRevision(null);
        setSelectedRevisionId(null);
        if (!isFullscreen) {
            const displayRevision = getSituationDisplayRevision(situation);
            flyToSituation(displayRevision || situation);
        }
    }, [isFullscreen, flyToSituation]);

    const handleSituationMapClick = useCallback(async (situationId) => {
        if (!situationId) return;
        const situation = situations.find((item) => item.id === situationId);
        if (!situation) return;
        setHighlightedSituationId(situationId);
        setSelectedRevisionId(null);
        setPreviewRevision(null);
        if (isFullscreen) {
            setDetailSituation(situation);
            setSelectedRevisionId(situation.current_revision?.id || null);
            const revisions = await fetchRevisions(situationId);
            setSituationRevisions(revisions.map((revision) => ({
                ...revision,
                situation_id: situationId,
            })));
        } else {
            setDetailSituation(null);
            setSituationRevisions([]);
        }
        if (!selectedSituations.includes(situationId)) {
            setSelectedSituations((prev) => [...prev, situationId]);
        }
        const displayRevision = getSituationDisplayRevision(situation);
        flyToSituation(displayRevision || situation);
    }, [
        situations,
        fetchRevisions,
        selectedSituations,
        setSelectedSituations,
        flyToSituation,
        isFullscreen,
    ]);

    const handleCloseSituationDetail = useCallback(() => {
        setDetailSituation(null);
        setSituationRevisions([]);
        setSelectedRevisionId(null);
        setPreviewRevision(null);
    }, []);

    const handleDetailRevisionSelect = useCallback((revision) => {
        const situationId = getSituationId(revision) || getSituationId(detailSituation);
        const enriched = situationId ? { ...revision, situation_id: situationId } : revision;
        setSelectedRevisionId(enriched.id);
        setPreviewRevision(enriched);
        if (situationId) {
            setHighlightedSituationId(situationId);
            setSelectedSituations((prev) => (
                prev.includes(situationId) ? prev : [...prev, situationId]
            ));
        }
        flyToSituation(enriched);
    }, [flyToSituation, setSelectedSituations, detailSituation]);

    const handleGlobalTimelineSelect = useCallback((revision) => {
        const situationId = getSituationId(revision);
        if (!situationId) return;
        handleDetailRevisionSelect({ ...revision, situation_id: situationId });
        if (!isFullscreen) return;
        const situation = situations.find((item) => item.id === situationId);
        if (situation) {
            setDetailSituation(situation);
            fetchRevisions(situationId).then((revisions) => {
                setSituationRevisions(revisions.map((item) => ({
                    ...item,
                    situation_id: situationId,
                })));
            });
        }
    }, [handleDetailRevisionSelect, situations, fetchRevisions, isFullscreen]);

    const handleToggleMeasure = useCallback(() => {
        toggleMeasureMode();
        setIsToolsOpen(false);
    }, [toggleMeasureMode]);

    const handleToggleTools = useCallback(() => setIsToolsOpen((prev) => !prev), []);

    const handleMapAltClickAddTarget = useCallback(({ lat, lng, countryIso }) => {
        setAddTargetDraft({
            lat,
            lng,
            countryIso: countryIso || null,
        });
        setIsAddTargetModalOpen(true);
    }, []);

    const handleOpenAddTargetModal = useCallback(() => {
        setAddTargetDraft(null);
        setIsAddTargetModalOpen(true);
    }, []);

    const handleCloseAddTargetModal = useCallback(() => {
        setIsAddTargetModalOpen(false);
        setAddTargetDraft(null);
    }, []);

    const handleStartPolygonDraw = useCallback((payload) => {
        const session = {
            actionIndex: payload.actionIndex,
            points: payload.initialPoints || [],
            formSnapshot: payload.formData,
            formularSnapshot: payload.formularData,
            isInundation: Boolean(payload.isInundation),
        };
        polygonDrawSessionRef.current = session;
        setPolygonDrawSession(session);
    }, []);

    useEffect(() => {
        polygonDrawSessionRef.current = polygonDrawSession;
    }, [polygonDrawSession]);

    const handlePolygonDrawPointsChange = useCallback((updater) => {
        setPolygonDrawSession((prev) => {
            if (!prev) return prev;
            const nextPoints = typeof updater === 'function' ? updater(prev.points) : updater;
            return { ...prev, points: nextPoints };
        });
    }, []);

    const handlePolygonDrawComplete = useCallback((points) => {
        const geometry = pointsToGeoJsonPolygon(points);
        const prev = polygonDrawSessionRef.current;
        if (!geometry || !prev?.formSnapshot) return;

        const nextFormData = { ...prev.formSnapshot };
        const nextActions = [...(nextFormData.actions || [])];
        nextActions[prev.actionIndex] = {
            ...nextActions[prev.actionIndex],
            zone_geometry: geometry,
            ...(prev.isInundation ? { inundation_scenario: true } : { polygon_scenario: true }),
        };
        nextFormData.actions = nextActions;

        setEditTargetFormPatch(nextFormData);
        polygonDrawSessionRef.current = null;
        setPolygonDrawSession(null);
    }, []);

    const handlePolygonDrawCancel = useCallback(() => {
        const prev = polygonDrawSessionRef.current;
        if (prev?.formSnapshot) {
            setEditTargetFormPatch(prev.formSnapshot);
        }
        polygonDrawSessionRef.current = null;
        setPolygonDrawSession(null);
    }, []);

    const handleTargetAdded = useCallback(() => refreshTargets(), [refreshTargets]);

    const handleTargetAddedWithFormular = useCallback((newTarget) => {
        refreshTargets();
        setFormularEditorTarget(newTarget);
    }, [refreshTargets]);

    const handleFormularSaved = useCallback(() => refreshTargets(), [refreshTargets]);

    const handleEditClick = useCallback((targetId) => setEditTargetId(targetId), []);

    const handleDeleteClick = useCallback(async (targetId, targetTitle) => {
        const deleted = await deleteTarget(targetId, targetTitle);
        if (deleted) {
            setSelectedObj((prev) => prev.filter((id) => id !== targetId));
        }
    }, [deleteTarget]);

    const handleTargetUpdated = useCallback(() => refreshTargets(), [refreshTargets]);

    const handleEventSave = useCallback(async (payload) => {
        await saveEvent(payload);
    }, [saveEvent]);

    const handleEventUpdate = useCallback(async (payload) => {
        await updateEvent(payload, payload?.id || editingEvent?.id);
    }, [updateEvent, editingEvent]);

    const handleEventEdit = useCallback((eventItem) => {
        const { drawMode, drawPoints } = buildDrawPointsFromEvent(eventItem);
        setEditingEvent(eventItem);
        setEditEventDrawMode(drawMode);
        setEditEventDrawPoints(drawPoints);
        setIsEditEventModalOpen(true);
    }, []);

    const handleEventDelete = useCallback(async (eventItem) => {
        await deleteEvent(eventItem);
    }, [deleteEvent]);

    const handleCloseEditEventModal = useCallback(() => {
        setIsEditEventModalOpen(false);
        setEditingEvent(null);
        setEditEventDrawMode(null);
        setEditEventDrawPoints([]);
    }, []);

    useEffect(() => {
        if (activeTab === "zones" && isFullscreen && actionRadiusMode !== "zones") {
            setActionRadiusMode("zones");
        }
    }, [activeTab, isFullscreen, actionRadiusMode]);

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

    useEffect(() => {
        const openUsersAdmin = () => setUsersAdminOpen(true);
        window.addEventListener('infolake:open-users-admin', openUsersAdmin);
        return () => window.removeEventListener('infolake:open-users-admin', openUsersAdmin);
    }, []);

    useEffect(() => {
        if (isFullscreen) return;
        setDetailSituation(null);
        setSituationRevisions([]);
        setSelectedRevisionId(null);
    }, [isFullscreen]);

    return (
        <section className="formular">
            <h1 className="visually-hidden">О</h1>
            <div className="container">
                <div className="formular__wraper">
                    <div className={`formular__content${isFullscreen ? " formular__content--map-fullscreen" : ""}`}>
                        <div className="formular__heading-wraper">
                            <h2 className="formular__title">ОР</h2>
                            <div className="formular__heading-actions">
                                {canEditTargets && (
                                <button
                                    className="btn"
                                    type="button"
                                    onClick={handleOpenAddTargetModal}
                                    aria-label="Добавить новый объект"
                                >
                                    <svg className="formular__icon" width="24" height="24">
                                        <use href={"/sprite.svg#new-file"} />
                                    </svg>
                                </button>
                                )}
                                {canOpenReference && (
                                <button
                                    className="btn button__tools"
                                    type="button"
                                    onClick={() => setReferenceDataOpen(true)}
                                >
                                    Справочники
                                </button>
                                )}
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
                                    onClick={() => handleTabChange("objects")}
                                >
                                    Объекты
                                </button>
                                <button
                                    type="button"
                                    className={`formular__tab${activeTab === "events" ? " formular__tab--active" : ""}`}
                                    onClick={() => handleTabChange("events")}
                                >
                                    События
                                </button>
                                <button
                                    type="button"
                                    className={`formular__tab${activeTab === "zones" ? " formular__tab--active" : ""}`}
                                    onClick={() => handleTabChange("zones")}
                                >
                                    Зоны действия
                                </button>
                                {canReadSituations && (
                                <button
                                    type="button"
                                    className={`formular__tab${activeTab === "situations" ? " formular__tab--active" : ""}`}
                                    onClick={() => handleTabChange("situations")}
                                >
                                    Оперативная обстановка
                                </button>
                                )}
                            </div>
                            {activeTab === "objects" && (
                                <>
                                    {objectsLoading && (
                                        <p className="formular__status formular__status--loading">Загрузка объектов…</p>
                                    )}
                                    {objectsError && (
                                        <p className="formular__status formular__status--error">{objectsError}</p>
                                    )}
                                    <FilterPanel
                                        objects={objects}
                                        targetTypes={targetTypes}
                                        filterCountry={filterCountry}
                                        onFilterCountryChange={setFilterCountry}
                                        filterType={filterType}
                                        onFilterTypeChange={setFilterType}
                                        filterTitle={filterTitle}
                                        onFilterTitleChange={setFilterTitle}
                                    />
                                    <ObjectsTable
                                        data={tableObjects}
                                        targetTypes={targetTypes}
                                        selectedObj={selectedObj}
                                        onCheckboxChange={handleCheckboxChange}
                                        onObjectClick={handleObjectClick}
                                        hoveredTargetId={hoveredTargetId}
                                        onTitleClick={setSelectedTargetId}
                                        onRowHover={setHoveredTargetId}
                                        onEditClick={canEditTargets ? handleEditClick : undefined}
                                        onDeleteClick={canRemoveTargets ? handleDeleteClick : undefined}
                                        canEditTargets={canEditTargets}
                                        canDeleteTargets={canRemoveTargets}
                                    />
                                </>
                            )}
                            {activeTab === "zones" && (
                                <>
                                    <ActionZoneFilters
                                        actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                        actionZoneFilters={actionZoneFilters}
                                        showZoneIntersections={showZoneIntersections}
                                        setShowZoneIntersections={setShowZoneIntersections}
                                        hasEnabledZones={hasEnabledZones}
                                        toggleActionType={toggleActionType}
                                        toggleAllForCountry={toggleAllForCountry}
                                        resetZoneFilters={resetZoneFilters}
                                        considerTerrain={considerTerrain}
                                        onConsiderTerrainChange={setConsiderTerrain}
                                        losComputingCount={losComputingCount}
                                        losZonesCount={losZonesCount}
                                        variant="tab"
                                    />
                                    {showZoneIntersections && (
                                        <IntersectionTable
                                            intersections={intersections}
                                            selectedIntersections={selectedIntersections}
                                            onIntersectionToggle={handleIntersectionToggle}
                                            onSelectAllIntersections={handleSelectAllIntersections}
                                        />
                                    )}
                                </>
                            )}
                            {activeTab === "events" && (
                                <>
                                    {eventsLoading && (
                                        <p className="formular__status formular__status--loading">Загрузка событий…</p>
                                    )}
                                    {eventsError && (
                                        <p className="formular__status formular__status--error">{eventsError}</p>
                                    )}
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
                            {activeTab === "situations" && (
                                <>
                                    {situationsLoading && (
                                        <p className="formular__status formular__status--loading">Загрузка обстановки…</p>
                                    )}
                                    {situationsError && (
                                        <p className="formular__status formular__status--error">{situationsError}</p>
                                    )}
                                    <SituationsFilterPanel
                                        countries={countriesList}
                                        filters={situationsFilters}
                                        onChange={setSituationsFilters}
                                    />
                                    <SituationsTable
                                        data={situations}
                                        selectedSituations={selectedSituations}
                                        onCheckboxChange={handleSituationCheckboxChange}
                                        onRowClick={handleSituationRowClick}
                                        onFlyTo={handleSituationFlyTo}
                                        onEdit={canEditSituations ? handleSituationEdit : undefined}
                                        onDelete={canEditSituations ? handleSituationDelete : undefined}
                                        onCreate={canEditSituations ? handleSituationCreateStart : undefined}
                                        highlightedSituationId={highlightedSituationId}
                                    />
                                    <SituationsTimeline
                                        revisions={timeline}
                                        selectedRevisionId={previewRevision?.id}
                                        onSelectRevision={handleGlobalTimelineSelect}
                                        groupBySituation
                                    />
                                </>
                            )}
                        </div>
                    </div>
                    <div className="formular__features-wraper">
                        <div className="formular__map">
                            <MapComponent
                                objects={filteredObjects}
                                zoneObjects={objects}
                                selectedObj={selectedObj}
                                events={events}
                                selectedEventIds={selectedEvents}
                                mapRef={mapRef}
                                measureMode={isMeasureMode}
                                measurements={measurements}
                                onAddMeasurePoint={addMeasurePoint}
                                onCheckboxChange={handleCheckboxChange}
                                showActionRadius={zonesLayerActive}
                                actionTypes={actionTypesList}
                                actionRadiusMode={actionRadiusMode}
                                onActionRadiusModeChange={setActionRadiusMode}
                                intersections={intersections}
                                selectedIntersections={selectedIntersections}
                                onIntersectionToggle={handleIntersectionToggle}
                                onSelectAllIntersections={handleSelectAllIntersections}
                                isFullscreen={isFullscreen}
                                setIsFullscreen={setFullscreen}
                                actionZoneFilters={actionZoneFilters}
                                showZoneIntersections={showZoneIntersections}
                                onMeasureModeChange={setIsMeasureMode}
                                onMeasurePointsChange={setMeasurePoints}
                                onShowActionRadiusChange={handleShowActionRadiusChange}
                                onTableTabChange={handleTabChange}
                                onMarkerHover={handleMarkerHoverFromMap}
                                onMarkerClick={setSelectedTargetId}
                                onAltClickAddTarget={handleMapAltClickAddTarget}
                                onEditClick={handleEditClick}
                                onDeleteClick={handleDeleteClick}
                                onEventSave={handleEventSave}
                                filterCountry={filterCountry}
                                onFilterCountryChange={setFilterCountry}
                                filterType={filterType}
                                onFilterTypeChange={setFilterType}
                                filterTitle={filterTitle}
                                onFilterTitleChange={setFilterTitle}
                                targetTypes={targetTypes}
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
                                polygonDrawSession={polygonDrawSession}
                                onPolygonDrawPointsChange={handlePolygonDrawPointsChange}
                                onPolygonDrawComplete={handlePolygonDrawComplete}
                                onPolygonDrawCancel={handlePolygonDrawCancel}
                                tableTab={activeTab}
                                actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                setShowZoneIntersections={setShowZoneIntersections}
                                toggleActionType={toggleActionType}
                                toggleAllForCountry={toggleAllForCountry}
                                resetZoneFilters={resetZoneFilters}
                                considerTerrain={considerTerrain}
                                onConsiderTerrainChange={setConsiderTerrain}
                                losGeometryByActionId={losGeometryByActionId}
                                losComputingCount={losComputingCount}
                                losZonesCount={losZonesCount}
                                visibleZones={visibleZones}
                                situations={situations}
                                selectedSituationIds={selectedSituations}
                                previewRevision={previewRevision}
                                onSituationClick={handleSituationMapClick}
                                isSituationDrawActive={isSituationDrawActive}
                                situationDrawPoints={situationDrawPoints}
                                onSituationDrawPointsChange={setSituationDrawPoints}
                                onSituationDrawConfirm={handleSituationDrawConfirm}
                                onSituationDrawCancel={handleSituationDrawCancel}
                                detailSituation={detailSituation}
                                situationRevisions={situationRevisions}
                                selectedRevisionId={selectedRevisionId}
                                onSituationDetailClose={handleCloseSituationDetail}
                                onSituationEdit={canEditSituations ? handleSituationEdit : undefined}
                                onSituationNewState={canEditSituations ? handleSituationNewState : undefined}
                                onSituationFork={canEditSituations ? handleSituationFork : undefined}
                                onSituationRevisionSelect={handleDetailRevisionSelect}
                                situationsFilters={situationsFilters}
                                onSituationsFiltersChange={setSituationsFilters}
                                onSituationCheckboxChange={handleSituationCheckboxChange}
                                onSituationDelete={canEditSituations ? handleSituationDelete : undefined}
                                onSituationFlyTo={handleSituationFlyTo}
                                onSituationCreate={canEditSituations ? handleSituationCreateStart : undefined}
                                highlightedSituationId={highlightedSituationId}
                                onSituationRowClick={handleSituationRowClick}
                                situationsTimeline={timeline}
                                onGlobalTimelineSelect={handleGlobalTimelineSelect}
                                canReadSituations={canReadSituations}
                                isSituationModalOpen={situationModalOpen}
                                editingSituationId={situationModalOpen ? situationModalTarget?.id : null}
                            />
                        </div>
                        <div className="formular__features">
                            <Features
                                isMeasureMode={isMeasureMode}
                                measurements={measurements}
                                onRemovePoint={removeMeasurePoint}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {selectedTargetId && (
                <FormularModal
                    targetId={selectedTargetId}
                    onClose={() => setSelectedTargetId(null)}
                    onEdit={handleEditClick}
                    onSubordinateFlyTo={handleSubordinateFlyTo}
                    onSubordinateOpenDetails={handleSubordinateOpenDetails}
                    onEditEquipmentInCatalog={handleOpenEquipmentInCatalog}
                />
            )}

            <AddTargetModal
                isOpen={isAddTargetModalOpen}
                onClose={handleCloseAddTargetModal}
                initialCoords={addTargetDraft}
                onTargetAdded={handleTargetAdded}
                onTargetAddedWithFormular={handleTargetAddedWithFormular}
                cachedTargets={objects}
            />

            <Suspense fallback={null}>
                <FormularEditor
                    targetId={formularEditorTarget?.id}
                    targetTitle={formularEditorTarget?.title}
                    isOpen={!!formularEditorTarget}
                    onClose={() => setFormularEditorTarget(null)}
                    onSaved={handleFormularSaved}
                />
            </Suspense>

            <EditTargetModal
                targetId={editTargetId}
                isOpen={!!editTargetId && !polygonDrawSession}
                onClose={() => {
                    setEditTargetId(null);
                    setEditTargetFormPatch(null);
                }}
                onTargetUpdated={handleTargetUpdated}
                cachedTargets={objects}
                onStartPolygonDraw={handleStartPolygonDraw}
                formPatch={editTargetFormPatch}
                onFormPatchApplied={() => setEditTargetFormPatch(null)}
            />

            {isEditEventModalOpen && (
                <AddEventModal
                    isOpen={isEditEventModalOpen}
                    onClose={handleCloseEditEventModal}
                    drawMode={editEventDrawMode}
                    drawPoints={editEventDrawPoints}
                    onDrawPointsChange={setEditEventDrawPoints}
                    initialEvent={editingEvent}
                    onSave={handleEventUpdate}
                />
            )}

            <Suspense fallback={null}>
                {canOpenReference && (
                <ReferenceDataModal
                    isOpen={isReferenceDataOpen}
                    onClose={handleCloseReferenceData}
                    onActionTypesChanged={reloadReferenceLists}
                    onTargetTypesChanged={() => {}}
                    initialEquipmentId={referenceEquipmentId}
                />
                )}
            </Suspense>

            <UsersAdminPanel
                isOpen={usersAdminOpen}
                onClose={() => setUsersAdminOpen(false)}
            />

            <SituationModal
                isOpen={situationModalOpen}
                onClose={handleCloseSituationModal}
                mode={situationModalMode}
                situation={situationModalTarget}
                drawPoints={situationDrawPoints}
                onDrawPointsChange={setSituationDrawPoints}
                countries={countriesList}
                onSave={handleSituationSave}
            />
        </section>
    );
}
