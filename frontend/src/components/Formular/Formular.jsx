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
import { geoJsonToDrawPolygons, pointsToGeoJsonPolygon } from "../../utils/inundationZone";
import { buildSituationRequestBody, findSituationById, findSituationRevision, filterRevisionsForSituation, filterRevisionsForSituations, getSituationDisplayRevision, getSituationId, getSituationTitle, resolveActiveSituationId } from "../../utils/situationUtils";
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
    const canDeleteSituations = canDelete(user);
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
    const [situationDrawPolygons, setSituationDrawPolygons] = useState([]);
    const [situationDrawPoints, setSituationDrawPoints] = useState([]);
    const [situationDrawTerritoryIndex, setSituationDrawTerritoryIndex] = useState(0);
    const situationDrawTerritoryIndexRef = useRef(0);
    const situationDrawPolygonsRef = useRef([]);
    const [situationModalOpen, setSituationModalOpen] = useState(false);
    const [situationModalMode, setSituationModalMode] = useState('create');
    const [situationModalTarget, setSituationModalTarget] = useState(null);
    const [situationModalRevisionId, setSituationModalRevisionId] = useState(null);
    const [detailSituation, setDetailSituation] = useState(null);
    const [situationRevisions, setSituationRevisions] = useState([]);
    const [focusedSituationId, setFocusedSituationId] = useState(null);
    const [timelineRevisionId, setTimelineRevisionId] = useState(null);
    const [highlightedSituationId, setHighlightedSituationId] = useState(null);
    const [mapUiResetToken, setMapUiResetToken] = useState(0);

    const mapRef = useRef(null);
    const toolsRef = useRef(null);
    const revisionsLoadSeqRef = useRef(0);

    useEffect(() => {
        situationDrawTerritoryIndexRef.current = situationDrawTerritoryIndex;
    }, [situationDrawTerritoryIndex]);

    useEffect(() => {
        situationDrawPolygonsRef.current = situationDrawPolygons;
    }, [situationDrawPolygons]);

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
        loading: situationsLoading,
        error: situationsError,
        filters: situationsFilters,
        setFilters: setSituationsFilters,
        selectedSituations,
        setSelectedSituations,
        fetchRevisions,
        createSituation,
        correctSituation,
        correctSituationRevision,
        createSituationRevision,
        forkSituation,
        deleteSituation,
        deleteSituationRevision,
    } = useOperationalSituationsList(activeTab, canReadSituations);

    const activeSituationId = useMemo(
        () => resolveActiveSituationId(
            selectedSituations,
            focusedSituationId,
            highlightedSituationId,
        ),
        [selectedSituations, focusedSituationId, highlightedSituationId],
    );

    const activeSituationTimeline = useMemo(
        () => filterRevisionsForSituations(situationRevisions, selectedSituations),
        [selectedSituations, situationRevisions],
    );

    const selectedSituationsKey = useMemo(
        () => selectedSituations.map(String).sort().join('|'),
        [selectedSituations],
    );

    const loadSituationRevisions = useCallback(async (situationIds) => {
        const ids = (Array.isArray(situationIds) ? situationIds : [situationIds])
            .filter((id) => id != null);
        if (!ids.length) {
            setSituationRevisions([]);
            return [];
        }

        const seq = ++revisionsLoadSeqRef.current;
        const results = await Promise.all(
            ids.map(async (situationId) => {
                const revisions = await fetchRevisions(situationId);
                return revisions.map((revision) => ({
                    ...revision,
                    situation_id: revision.situation_id ?? situationId,
                }));
            }),
        );
        if (seq !== revisionsLoadSeqRef.current) {
            return results.flat();
        }
        const enriched = results.flat();
        setSituationRevisions(enriched);
        return enriched;
    }, [fetchRevisions]);

    useEffect(() => {
        if (!selectedSituationsKey) {
            setSituationRevisions([]);
            return undefined;
        }

        const situationIds = selectedSituationsKey.split('|');
        let cancelled = false;
        loadSituationRevisions(situationIds).catch(() => {
            if (!cancelled) setSituationRevisions([]);
        });

        return () => {
            cancelled = true;
            revisionsLoadSeqRef.current += 1;
        };
    }, [selectedSituationsKey, loadSituationRevisions]);

    const {
        actionZoneFilters,
        showZoneIntersections, setShowZoneIntersections,
        hasEnabledZones,
        actionZoneAvailableByCountry,
        globalActionTypeCatalog,
        equipmentZoneDiagnostics,
        quickSelectLeaves,
        quickSelectCountries,
        quickSelectCombo,
        intersections, selectedIntersections,
        toggleZoneLeaf, toggleAllForActionType, toggleAllForCountry, resetZoneFilters,
        toggleQuickSelectLeaf,
        toggleAllQuickSelectLeavesForType,
        setAllQuickSelectLeaves,
        toggleQuickSelectCountry,
        setAllQuickSelectCountries,
        handleIntersectionToggle, handleSelectAllIntersections,
    } = useActionZoneState(objects, { zonesActive: activeTab === "zones" });

    const zonesLayerActive = hasEnabledZones;
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
        geometryByZoneKey: losGeometryByZoneKey,
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
        if (checked) {
            setFocusedSituationId(id);
            setTimelineRevisionId(null);
            setHighlightedSituationId(id);
            const situation = situations.find((item) => String(item.id) === String(id));
            if (isFullscreen && situation) {
                setDetailSituation(situation);
            }
            if (situation) {
                const displayRevision = getSituationDisplayRevision(situation);
                flyToSituation(displayRevision || situation);
            }
            return;
        }

        if (timelineRevisionId != null) {
            const selectedRevision = findSituationRevision(situationRevisions, timelineRevisionId);
            if (selectedRevision && String(getSituationId(selectedRevision)) === String(id)) {
                setTimelineRevisionId(null);
            }
        }

        if (String(focusedSituationId) === String(id)) {
            setFocusedSituationId(null);
            setTimelineRevisionId(null);
            if (detailSituation?.id === id) {
                setDetailSituation(null);
            }
        }
    }, [
        setSelectedSituations,
        focusedSituationId,
        situations,
        isFullscreen,
        flyToSituation,
        detailSituation,
        timelineRevisionId,
        situationRevisions,
    ]);

    const handleSituationFlyTo = useCallback((situation) => {
        const situationId = situation?.id;
        if (
            situationId
            && String(activeSituationId) === String(situationId)
            && timelineRevisionId != null
        ) {
            const selected = findSituationRevision(situationRevisions, timelineRevisionId);
            if (selected) {
                flyToSituation(selected);
                return;
            }
        }
        const displayRevision = getSituationDisplayRevision(situation);
        flyToSituation(displayRevision || situation);
    }, [flyToSituation, activeSituationId, timelineRevisionId, situationRevisions]);

    const handleTimelineRevisionSelect = useCallback((revision) => {
        const situationId = getSituationId(revision);
        if (!situationId) return;

        setFocusedSituationId(situationId);
        setTimelineRevisionId(revision.id);
        setHighlightedSituationId(situationId);
        setSelectedSituations((prev) => (
            prev.some((itemId) => String(itemId) === String(situationId))
                ? prev
                : [...prev, situationId]
        ));
    }, [setSelectedSituations]);

    const openSituationModal = useCallback((mode, situation = null, revision = null) => {
        setSituationModalMode(mode);
        setSituationModalTarget(situation);

        const baseRevision = (() => {
            if (revision) return revision;
            if (!situation?.id) return null;
            if (
                timelineRevisionId != null
                && String(activeSituationId) === String(situation.id)
            ) {
                const selected = findSituationRevision(situationRevisions, timelineRevisionId);
                if (selected) return selected;
            }
            return getSituationDisplayRevision(situation) || situation.current_revision;
        })();

        setSituationModalRevisionId(baseRevision?.id ?? null);
        setSituationModalOpen(true);

        setSituationDrawTerritoryIndex(0);
        situationDrawTerritoryIndexRef.current = 0;

        if (mode === 'create' && situation?.drawPolygons) {
            setSituationDrawPolygons(situation.drawPolygons);
            setSituationDrawPoints(situation.drawPolygons[0] || []);
        } else if (situation?.drawPolygons) {
            setSituationDrawPolygons(situation.drawPolygons);
            setSituationDrawPoints(situation.drawPolygons[0] || []);
        } else if (baseRevision?.geometry) {
            const polys = geoJsonToDrawPolygons(baseRevision.geometry);
            setSituationDrawPolygons(polys);
            setSituationDrawPoints(polys[0] || []);
        } else {
            setSituationDrawPolygons([]);
            setSituationDrawPoints([]);
        }

        if (situation?.id) {
            setSelectedSituations((prev) => (
                prev.some((itemId) => String(itemId) === String(situation.id))
                    ? prev
                    : [...prev, situation.id]
            ));
            flyToSituation(baseRevision || situation);
        }
    }, [
        flyToSituation,
        setSelectedSituations,
        timelineRevisionId,
        activeSituationId,
        situationRevisions,
    ]);

    const handleSituationCreateStart = useCallback(() => {
        // Принудительный сброс возможных "залипаний" UI-состояния после удаления/сохранения:
        // если оставалась открытой модалка или активный режим рисования,
        // то кнопка "Добавить обстановку" могла визуально нажиматься, но режим не включался.
        setIsSituationDrawActive(false);
        setSituationModalOpen(false);
        setSituationModalTarget(null);
        setSituationModalMode('create');

        setSituationDrawPolygons([]);
        setSituationDrawPoints([]);
        setSituationDrawTerritoryIndex(0);
        situationDrawTerritoryIndexRef.current = 0;
        setDetailSituation(null);
        setSituationRevisions([]);
        setFocusedSituationId(null);
        setTimelineRevisionId(null);
        setHighlightedSituationId(null);

        // Обновляем состояние в 2 шага, чтобы React гарантированно перерисовал MapComponent и включил draw.
        requestAnimationFrame(() => {
            setIsSituationDrawActive(true);
        });
    }, []);

    const handleSituationDrawConfirm = useCallback((drawPolygons) => {
        const polys = drawPolygons?.length ? drawPolygons : situationDrawPolygons;
        setIsSituationDrawActive(false);
        setSituationDrawPolygons([]);
        setSituationDrawPoints([]);
        setSituationDrawTerritoryIndex(0);
        situationDrawTerritoryIndexRef.current = 0;
        openSituationModal('create', { drawPolygons: polys });
    }, [openSituationModal, situationDrawPolygons]);

    const handleSituationDrawCancel = useCallback(() => {
        setIsSituationDrawActive(false);
        setSituationDrawPolygons([]);
        setSituationDrawPoints([]);
        setSituationDrawTerritoryIndex(0);
        situationDrawTerritoryIndexRef.current = 0;
    }, []);

    const handleSituationDrawPolygonsChange = useCallback((updater) => {
        setSituationDrawPolygons((prev) => (
            typeof updater === 'function' ? updater(prev) : updater
        ));
    }, []);

    const handleSituationDrawPointsChange = useCallback((updater) => {
        setSituationDrawPoints((prevPoints) => {
            const nextPoints = typeof updater === 'function' ? updater(prevPoints) : updater;
            const activeIndex = situationDrawTerritoryIndexRef.current;
            setSituationDrawPolygons((prevPolys) => {
                const next = [...prevPolys];
                while (next.length <= activeIndex) {
                    next.push([]);
                }
                next[activeIndex] = nextPoints;
                if (!nextPoints?.length && next.every((ring) => !ring?.length)) {
                    return [];
                }
                return next;
            });
            return nextPoints;
        });
    }, []);

    const handleSituationDrawPolygonsFromModal = useCallback((polys) => {
        setSituationDrawPolygons(polys);
        const idx = situationDrawTerritoryIndexRef.current;
        const safeIdx = polys.length ? Math.min(Math.max(0, idx), polys.length - 1) : 0;
        if (safeIdx !== idx) {
            setSituationDrawTerritoryIndex(safeIdx);
            situationDrawTerritoryIndexRef.current = safeIdx;
        }
        setSituationDrawPoints(polys[safeIdx] || []);
    }, []);

    const handleActiveTerritoryIndexChange = useCallback((index) => {
        setSituationDrawTerritoryIndex(index);
        situationDrawTerritoryIndexRef.current = index;
        setSituationDrawPolygons((prev) => {
            const next = [...prev];
            while (next.length <= index) {
                next.push([]);
            }
            situationDrawPolygonsRef.current = next;
            setSituationDrawPoints(next[index] || []);
            return next;
        });
    }, []);

    const handleSituationEdit = useCallback((situation) => {
        const revision = (
            timelineRevisionId != null && String(activeSituationId) === String(situation.id)
                ? findSituationRevision(situationRevisions, timelineRevisionId)
                : null
        );
        openSituationModal('edit', situation, revision);
    }, [openSituationModal, timelineRevisionId, activeSituationId, situationRevisions]);

    const handleTimelineRevisionEdit = useCallback((revision) => {
        const situationId = getSituationId(revision);
        const situation = findSituationById(situations, situationId);
        if (!situation) return;
        setFocusedSituationId(situationId);
        setTimelineRevisionId(revision.id);
        setHighlightedSituationId(situationId);
        openSituationModal('edit', situation, revision);
    }, [situations, openSituationModal]);

    const handleTimelineRevisionDelete = useCallback(async (revision) => {
        const situationId = getSituationId(revision);
        const result = await deleteSituationRevision(revision);
        if (!result?.deleted || !situationId) return;

        if (result.situationDeleted) {
            setSelectedSituations((prev) => prev.filter((id) => String(id) !== String(situationId)));
            setSituationRevisions((prev) => prev.filter(
                (item) => String(getSituationId(item)) !== String(situationId),
            ));
            if (detailSituation?.id === situationId) {
                setDetailSituation(null);
            }
            if (String(focusedSituationId) === String(situationId)) {
                setFocusedSituationId(null);
            }
            if (String(highlightedSituationId) === String(situationId)) {
                setHighlightedSituationId(null);
            }
            if (timelineRevisionId != null && String(timelineRevisionId) === String(revision.id)) {
                setTimelineRevisionId(null);
            }
            return;
        }

        if (String(timelineRevisionId) === String(revision.id)) {
            setTimelineRevisionId(null);
        }

        const nextSelected = selectedSituations.some((id) => String(id) === String(situationId))
            ? selectedSituations
            : [...selectedSituations, situationId];
        await loadSituationRevisions(nextSelected);

        if (detailSituation?.id === situationId && result.situation) {
            setDetailSituation(result.situation);
        }
    }, [
        deleteSituationRevision,
        detailSituation,
        focusedSituationId,
        highlightedSituationId,
        loadSituationRevisions,
        selectedSituations,
        timelineRevisionId,
    ]);

    const handleSituationNewState = useCallback((situation) => {
        const revision = (
            timelineRevisionId != null && String(activeSituationId) === String(situation.id)
                ? findSituationRevision(situationRevisions, timelineRevisionId)
                : null
        );
        openSituationModal('new_state', situation, revision);
    }, [openSituationModal, timelineRevisionId, activeSituationId, situationRevisions]);

    const handleCloseSituationModal = useCallback(() => {
        setSituationModalOpen(false);
        setSituationModalTarget(null);
        setSituationModalRevisionId(null);
        setSituationDrawPolygons([]);
        setSituationDrawPoints([]);
        setSituationDrawTerritoryIndex(0);
        situationDrawTerritoryIndexRef.current = 0;
    }, []);

    const applySavedSituationPreview = useCallback(async (savedSituation, { mode, revisionId } = {}) => {
        if (!savedSituation?.id) return;
        const situationId = savedSituation.id;

        const nextSelected = selectedSituations.some((id) => String(id) === String(situationId))
            ? selectedSituations
            : [...selectedSituations, situationId];

        setSelectedSituations(nextSelected);
        setFocusedSituationId(situationId);
        setHighlightedSituationId(situationId);

        if (mode === 'new_state' && savedSituation.current_revision?.id) {
            setTimelineRevisionId(savedSituation.current_revision.id);
        } else if (revisionId) {
            setTimelineRevisionId(revisionId);
        } else {
            setTimelineRevisionId(null);
        }

        if (detailSituation?.id === situationId || isFullscreen) {
            setDetailSituation((prev) => (
                prev?.id === situationId ? { ...prev, ...savedSituation } : savedSituation
            ));
        }

        await loadSituationRevisions(nextSelected);
        const displayRevision = getSituationDisplayRevision(savedSituation);
        flyToSituation(displayRevision || savedSituation);
    }, [
        selectedSituations,
        detailSituation,
        flyToSituation,
        isFullscreen,
        loadSituationRevisions,
        setSelectedSituations,
    ]);

    const handleSituationSave = useCallback(async ({ mode, form, drawPolygons, situationId, revisionId }) => {
        const payload = buildSituationRequestBody(form, drawPolygons);
        let saved = null;
        if (mode === 'create') {
            saved = await createSituation(payload);
        } else if (mode === 'correction') {
            if (revisionId) {
                saved = await correctSituationRevision(situationId, revisionId, payload);
            } else {
                saved = await correctSituation(situationId, payload);
            }
        } else if (mode === 'new_state') {
            saved = await createSituationRevision(situationId, payload);
        } else if (mode === 'fork') {
            saved = await forkSituation(situationId, payload);
        }
        if (saved) {
            await applySavedSituationPreview(saved, { mode, revisionId });
        }
    }, [
        createSituation,
        correctSituation,
        correctSituationRevision,
        createSituationRevision,
        forkSituation,
        applySavedSituationPreview,
    ]);

    const handleSituationDelete = useCallback(async (situation) => {
        const deleted = await deleteSituation(situation);
        if (deleted) {
            setSelectedSituations((prev) => prev.filter((id) => id !== situation.id));
            if (detailSituation?.id === situation.id) {
                setDetailSituation(null);
            }

            // Сбросим связанные UI-режимы, чтобы после удаления можно было снова создать обстановку.
            setIsSituationDrawActive(false);
            setSituationModalOpen(false);
            setSituationModalTarget(null);
            setSituationDrawPolygons([]);
            setSituationDrawPoints([]);
            setSituationDrawTerritoryIndex(0);
            situationDrawTerritoryIndexRef.current = 0;
            setFocusedSituationId(null);
            setTimelineRevisionId(null);
            setHighlightedSituationId(null);
        }
    }, [deleteSituation, detailSituation, setSelectedSituations]);

    const handleSituationRowClick = useCallback(async (situation) => {
        setFocusedSituationId(situation.id);
        setTimelineRevisionId(null);
        setHighlightedSituationId(situation.id);
        setSelectedSituations((prev) => (
            prev.some((id) => String(id) === String(situation.id))
                ? prev
                : [...prev, situation.id]
        ));
        if (isFullscreen) {
            setDetailSituation(situation);
        }
        const displayRevision = getSituationDisplayRevision(situation);
        const polys = geoJsonToDrawPolygons(displayRevision?.geometry);
        setSituationDrawPolygons(polys);
        setSituationDrawPoints(polys[0] || []);
        if (!isFullscreen) {
            flyToSituation(displayRevision || situation);
        }
    }, [isFullscreen, flyToSituation, setSelectedSituations]);

    const handleSituationMapClick = useCallback((situationId, revision = null) => {
        if (!situationId) return;
        const situation = situations.find((item) => String(item.id) === String(situationId));
        if (!situation) return;

        setFocusedSituationId(situationId);
        setHighlightedSituationId(situationId);
        setSelectedSituations((prev) => (
            prev.some((id) => String(id) === String(situationId))
                ? prev
                : [...prev, situationId]
        ));

        const displayRevision = getSituationDisplayRevision(situation);
        const clickedRevision = revision || displayRevision;

        if (clickedRevision) {
            setTimelineRevisionId(revision ? revision.id : null);
        } else {
            setTimelineRevisionId(null);
        }

        setDetailSituation(situation);
    }, [
        situations,
        setSelectedSituations,
    ]);

    const handleCloseSituationDetail = useCallback(() => {
        setDetailSituation(null);
        setTimelineRevisionId(null);
    }, []);

    const handleDetailRevisionSelect = useCallback((revision) => {
        handleTimelineRevisionSelect(revision);
        const situationId = getSituationId(revision);
        if (!situationId) return;
        const situation = situations.find((item) => String(item.id) === String(situationId));
        if (isFullscreen && situation) {
            setDetailSituation(situation);
        }
    }, [handleTimelineRevisionSelect, situations, isFullscreen]);

    const handleToggleMeasure = useCallback(() => {
        toggleMeasureMode();
        setIsToolsOpen(false);
    }, [toggleMeasureMode]);

    const handleResetAllMapState = useCallback(() => {
        setSelectedObj([]);
        setFilterCountry([]);
        setFilterType([]);
        setFilterTitle('');
        resetZoneFilters(false);
        setAllQuickSelectLeaves(false);
        setAllQuickSelectCountries(false);
        setShowZoneIntersections(false);
        handleSelectAllIntersections(false);
        setEventsFilters({
            title: '',
            dateFrom: '',
            dateTo: '',
            timeFrom: '',
            timeTo: '',
            countries: [],
            eventTypes: [],
        });
        setSelectedEvents([]);
        setSituationsFilters({
            title: '',
            dateFrom: '',
            dateTo: '',
            countries: [],
        });
        setSelectedSituations([]);
        setFocusedSituationId(null);
        setTimelineRevisionId(null);
        setHighlightedSituationId(null);
        setSituationRevisions([]);
        setDetailSituation(null);
        setSelectedTargetId(null);
        setHoveredTargetId(null);
        setIsMeasureMode(false);
        setMeasurePoints([]);
        setIsSituationDrawActive(false);
        setSituationDrawPolygons([]);
        setSituationDrawPoints([]);
        setSituationDrawTerritoryIndex(0);
        situationDrawTerritoryIndexRef.current = 0;
        setMapUiResetToken((token) => token + 1);
        setIsToolsOpen(false);
    }, [
        resetZoneFilters,
        setAllQuickSelectLeaves,
        setAllQuickSelectCountries,
        setShowZoneIntersections,
        handleSelectAllIntersections,
        setEventsFilters,
        setSelectedEvents,
        setSituationsFilters,
        setSelectedSituations,
        setIsMeasureMode,
        setMeasurePoints,
    ]);

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
        setTimelineRevisionId(null);
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
                                            <button
                                                className="tools-menu__item"
                                                type="button"
                                                onClick={handleResetAllMapState}
                                            >
                                                <span className="tools-menu__label">Сбросить все</span>
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
                                        onConsiderTerrainChange={setConsiderTerrain}
                                        losComputingCount={losComputingCount}
                                        losZonesCount={losZonesCount}
                                        equipmentZoneDiagnostics={equipmentZoneDiagnostics}
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
                                <div className="formular__situations-area">
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
                                        onDelete={canEditSituations && canDeleteSituations ? handleSituationDelete : undefined}
                                        onCreate={canEditSituations ? handleSituationCreateStart : undefined}
                                        highlightedSituationId={highlightedSituationId}
                                    />
                                    <div className="formular__situations-area__timeline">
                                        {selectedSituations.length > 0 ? (
                                            <SituationsTimeline
                                                revisions={activeSituationTimeline}
                                                selectedRevisionId={timelineRevisionId}
                                                onSelectRevision={handleTimelineRevisionSelect}
                                                onEditRevision={canEditSituations ? handleTimelineRevisionEdit : undefined}
                                                onDeleteRevision={
                                                    canEditSituations && canDeleteSituations
                                                        ? handleTimelineRevisionDelete
                                                        : undefined
                                                }
                                                canEdit={canEditSituations}
                                                canDelete={canEditSituations && canDeleteSituations}
                                                sortDirection="asc"
                                                groupBySituation={selectedSituations.length > 1}
                                                title={(() => {
                                                    if (selectedSituations.length !== 1) {
                                                        return 'Таймлайн изменений';
                                                    }
                                                    const situation = situations.find(
                                                        (item) => String(item.id) === String(selectedSituations[0]),
                                                    );
                                                    return situation ? getSituationTitle(situation) : 'Таймлайн';
                                                })()}
                                            />
                                        ) : (
                                            <p className="situations-timeline__empty">
                                                Отметьте обстановку checkbox, чтобы открыть таймлайн её состояний
                                            </p>
                                        )}
                                    </div>
                                </div>
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
                                onTargetOpenDetails={handleSubordinateOpenDetails}
                                canEditCountry={canOpenReference}
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
                                toggleZoneLeaf={toggleZoneLeaf}
                                toggleAllForActionType={toggleAllForActionType}
                                toggleAllForCountry={toggleAllForCountry}
                                resetZoneFilters={resetZoneFilters}
                                globalActionTypeCatalog={globalActionTypeCatalog}
                                equipmentZoneDiagnostics={equipmentZoneDiagnostics}
                                quickSelectLeaves={quickSelectLeaves}
                                quickSelectCountries={quickSelectCountries}
                                quickSelectCombo={quickSelectCombo}
                                toggleQuickSelectLeaf={toggleQuickSelectLeaf}
                                toggleAllQuickSelectLeavesForType={toggleAllQuickSelectLeavesForType}
                                setAllQuickSelectLeaves={setAllQuickSelectLeaves}
                                toggleQuickSelectCountry={toggleQuickSelectCountry}
                                setAllQuickSelectCountries={setAllQuickSelectCountries}
                                considerTerrain={considerTerrain}
                                onConsiderTerrainChange={setConsiderTerrain}
                                losGeometryByZoneKey={losGeometryByZoneKey}
                                losComputingCount={losComputingCount}
                                losZonesCount={losZonesCount}
                                visibleZones={visibleZones}
                                mapUiResetToken={mapUiResetToken}
                                onResetAllMapState={handleResetAllMapState}
                                situations={situations}
                                selectedSituationIds={selectedSituations}
                                activeSituationId={activeSituationId}
                                timelineRevisionId={timelineRevisionId}
                                situationRevisions={situationRevisions}
                                onSituationClick={handleSituationMapClick}
                                isSituationDrawActive={isSituationDrawActive}
                                situationDrawPolygons={situationDrawPolygons}
                                onSituationDrawPolygonsChange={handleSituationDrawPolygonsChange}
                                situationDrawPoints={situationDrawPoints}
                                onSituationDrawPointsChange={handleSituationDrawPointsChange}
                                situationDrawTerritoryIndex={situationDrawTerritoryIndex}
                                onSituationDrawConfirm={handleSituationDrawConfirm}
                                onSituationDrawCancel={handleSituationDrawCancel}
                                detailSituation={detailSituation}
                                onSituationDetailClose={handleCloseSituationDetail}
                                onSituationEdit={canEditSituations ? handleSituationEdit : undefined}
                                onSituationNewState={canEditSituations ? handleSituationNewState : undefined}
                                onSituationRevisionSelect={handleDetailRevisionSelect}
                                situationsFilters={situationsFilters}
                                onSituationsFiltersChange={setSituationsFilters}
                                onSituationCheckboxChange={handleSituationCheckboxChange}
                                onSituationDelete={canEditSituations && canDeleteSituations ? handleSituationDelete : undefined}
                                onSituationFlyTo={handleSituationFlyTo}
                                onSituationCreate={canEditSituations ? handleSituationCreateStart : undefined}
                                highlightedSituationId={highlightedSituationId}
                                onSituationRowClick={handleSituationRowClick}
                                activeSituationTimeline={activeSituationTimeline}
                                onTimelineRevisionSelect={handleTimelineRevisionSelect}
                                onTimelineRevisionEdit={canEditSituations ? handleTimelineRevisionEdit : undefined}
                                onTimelineRevisionDelete={
                                    canEditSituations && canDeleteSituations
                                        ? handleTimelineRevisionDelete
                                        : undefined
                                }
                                canEditSituations={canEditSituations}
                                canDeleteSituations={canDeleteSituations}
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
                    onEdit={canEditTargets ? handleEditClick : undefined}
                    onSubordinateFlyTo={handleSubordinateFlyTo}
                    onSubordinateOpenDetails={handleSubordinateOpenDetails}
                    onEditEquipmentInCatalog={canOpenReference ? handleOpenEquipmentInCatalog : undefined}
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
                baseRevision={
                    situationModalRevisionId
                        ? findSituationRevision(situationRevisions, situationModalRevisionId)
                        : null
                }
                drawPolygons={situationDrawPolygons}
                onDrawPolygonsChange={handleSituationDrawPolygonsFromModal}
                activeTerritoryIndex={situationDrawTerritoryIndex}
                onActiveTerritoryIndexChange={handleActiveTerritoryIndexChange}
                countries={countriesList}
                onSave={handleSituationSave}
            />
        </section>
    );
}
