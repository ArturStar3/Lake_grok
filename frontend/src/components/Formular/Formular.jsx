import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import "./Formular.css";
import FilterPanel from "../FilterPanel/FilterPanel";
import ObjectsTable from "../ObjectsTable/ObjectsTable";
import EventsTable from "../Events/EventsTable";
import EventsFilterPanel from "../Events/EventsFilterPanel";
import MapComponent from "../MapComponent/MapComponent";
import Features from "../Features/Features";
import ActionZoneFilters from "../Features/ActionZoneFilters";
import IntersectionTable from "../IntersectionTable/IntersectionTable";
import FormularModal from "../FormularModal/FormularModal";
import AddTargetModal from "../AddTargetModal/AddTargetModal";
import EditTargetModal from "../EditTargetModal/EditTargetModal";
import AddEventModal from "../Events/AddEventModal";
import { buildDrawPointsFromEvent, getEventCenter } from "../../utils/eventGeometry";
import { toggleIdInList } from "../../utils/selectionUtils";
import { useTargetsList } from "../../hooks/formular/useTargetsList";
import { useFormularReferenceLists } from "../../hooks/formular/useFormularReferenceLists";
import { useReferenceData } from "../../hooks/useReferenceData";
import { useEventsList } from "../../hooks/formular/useEventsList";
import { useActionZoneState } from "../../hooks/formular/useActionZoneState";
import { useTerrainZoneTypes } from "../../hooks/formular/useTerrainZoneTypes";
import { useAutoLosZoneGeometries } from "../../hooks/formular/useAutoLosZoneGeometries";
import { useMeasurePoints } from "../../hooks/formular/useMeasurePoints";
import { useObjectFilters } from "../../hooks/formular/useObjectFilters";
import { useMapFlyTo } from "../../hooks/formular/useMapFlyTo";

const FormularEditor = lazy(() => import("../FormularEditor/FormularEditor"));
const ReferenceDataModal = lazy(() => import("../ReferenceData/ReferenceDataModal"));

export default function Formular() {
    const [activeTab, setActiveTab] = useState("objects");
    const [selectedObj, setSelectedObj] = useState([]);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [actionRadiusMode, setActionRadiusMode] = useState("animation");
    const [actionZoneViewMode, setActionZoneViewMode] = useState("displaySettings");
    const [selectedTargetId, setSelectedTargetId] = useState(null);
    const [hoveredTargetId, setHoveredTargetId] = useState(null);
    const [isAddTargetModalOpen, setIsAddTargetModalOpen] = useState(false);
    const [addTargetDraft, setAddTargetDraft] = useState(null);
    const [formularEditorTarget, setFormularEditorTarget] = useState(null);
    const [editTargetId, setEditTargetId] = useState(null);
    const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editEventDrawMode, setEditEventDrawMode] = useState(null);
    const [editEventDrawPoints, setEditEventDrawPoints] = useState([]);
    const [isFullscreen, setFullscreen] = useState(false);
    const [isReferenceDataOpen, setReferenceDataOpen] = useState(false);
    const [referenceEquipmentId, setReferenceEquipmentId] = useState(null);

    const mapRef = useRef(null);
    const toolsRef = useRef(null);

    const { objects, loading: objectsLoading, error: objectsError, refresh: refreshTargets, deleteTarget } = useTargetsList();
    const { countriesList, eventTypesList, actionTypesList, reloadReferenceLists } = useFormularReferenceLists();
    const {
        terrainTypeIds,
        isTerrainEnabled,
        toggleTerrainType,
        setAllTerrainTypes,
    } = useTerrainZoneTypes(actionTypesList);
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
        actionZoneFilters,
        showZoneIntersections, setShowZoneIntersections,
        hasEnabledZones,
        actionZoneAvailableByCountry,
        intersections, selectedIntersections,
        toggleActionType, toggleAllForCountry, resetZoneFilters,
        handleIntersectionToggle, handleSelectAllIntersections,
    } = useActionZoneState(objects);

    const {
        geometryByActionId: losGeometryByActionId,
        computingCount: losComputingCount,
        losZonesCount,
    } = useAutoLosZoneGeometries({
        zoneObjects: objects,
        actionZoneFilters,
        terrainTypeIds,
        enabled: hasEnabledZones,
    });

    const {
        isMeasureMode, setIsMeasureMode,
        measurePoints, setMeasurePoints,
        measurements, toggleMeasureMode,
        addMeasurePoint, removeMeasurePoint,
    } = useMeasurePoints();

    const flyTo = useMapFlyTo(mapRef);

    const handleMarkerHoverFromMap = useCallback((targetId) => {
        setHoveredTargetId((prev) => (prev === targetId ? prev : targetId));
    }, []);

    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
        if (tab === "zones") {
            setIsMeasureMode(false);
            if (isFullscreen) {
                setActionRadiusMode("zones");
                setActionZoneViewMode("displaySettings");
            }
        }
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
                                    onClick={handleOpenAddTargetModal}
                                    aria-label="Добавить новый объект"
                                >
                                    <svg className="formular__icon" width="24" height="24">
                                        <use href={"/sprite.svg#new-file"} />
                                    </svg>
                                </button>
                                <button
                                    className="btn button__tools"
                                    type="button"
                                    onClick={() => setReferenceDataOpen(true)}
                                >
                                    Справочники
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
                                        onEditClick={handleEditClick}
                                        onDeleteClick={handleDeleteClick}
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
                                showActionRadius={hasEnabledZones}
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
                                tableTab={activeTab}
                                actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                setShowZoneIntersections={setShowZoneIntersections}
                                toggleActionType={toggleActionType}
                                toggleAllForCountry={toggleAllForCountry}
                                resetZoneFilters={resetZoneFilters}
                                actionZoneViewMode={actionZoneViewMode}
                                onActionZoneViewModeChange={setActionZoneViewMode}
                                terrainTypeIds={terrainTypeIds}
                                isTerrainEnabled={isTerrainEnabled}
                                onTerrainTypeToggle={toggleTerrainType}
                                onEnableAllTerrainTypes={() => setAllTerrainTypes(true)}
                                onDisableAllTerrainTypes={() => setAllTerrainTypes(false)}
                                losGeometryByActionId={losGeometryByActionId}
                                losComputingCount={losComputingCount}
                                losZonesCount={losZonesCount}
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
                isOpen={!!editTargetId}
                onClose={() => setEditTargetId(null)}
                onTargetUpdated={handleTargetUpdated}
                cachedTargets={objects}
            />

            {isEditEventModalOpen && (
                <AddEventModal
                    isOpen={isEditEventModalOpen}
                    onClose={handleCloseEditEventModal}
                    drawMode={editEventDrawMode}
                    drawPoints={editEventDrawPoints}
                    initialEvent={editingEvent}
                    onSave={handleEventUpdate}
                />
            )}

            <Suspense fallback={null}>
                <ReferenceDataModal
                    isOpen={isReferenceDataOpen}
                    onClose={handleCloseReferenceData}
                    onActionTypesChanged={reloadReferenceLists}
                    onTargetTypesChanged={() => {}}
                    initialEquipmentId={referenceEquipmentId}
                />
            </Suspense>
        </section>
    );
}
