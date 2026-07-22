import MapLayerPanel from './MapLayerPanel';
import FilterPanel from '../FilterPanel/FilterPanel';
import ObjectsTable from '../ObjectsTable/ObjectsTable';
import EventsFilterPanel from '../Events/EventsFilterPanel';
import EventsTable from '../Events/EventsTable';
import ActionZoneFilters from '../Features/ActionZoneFilters';
import IntersectionTable from '../IntersectionTable/IntersectionTable';
import SituationsFilterPanel from '../OperationalSituation/SituationsFilterPanel';
import SituationsTable from '../OperationalSituation/SituationsTable';
import SituationsTimeline from '../OperationalSituation/SituationsTimeline';
import Features from '../Features/Features';

export default function MapFullscreenPanelBody({
  dockTab,
  showActionRadius,
  overlayEnabledById,
  currentZoom,
  toggleOverlayLayer,
  setAllOverlayLayers,
  objects,
  zoneObjects,
  targetTypes,
  filterCountry,
  onFilterCountryChange,
  filterType,
  onFilterTypeChange,
  filterTitle,
  onFilterTitleChange,
  selectedObj,
  onCheckboxChange,
  handleMarkerClickGuarded,
  hoveredTargetId,
  setHoveredTargetId,
  mapRef,
  onEditClick,
  onDeleteClick,
  eventsLoading,
  eventsError,
  countriesList,
  eventTypesList,
  eventsFilters,
  onEventsFiltersChange,
  events,
  selectedEventIds,
  onEventCheckboxChange,
  onEventFlyTo,
  onEventEdit,
  onEventDelete,
  actionZoneAvailableByCountry,
  actionZoneFilters,
  showZoneIntersections,
  setShowZoneIntersections,
  toggleZoneLeaf,
  toggleAllForActionType,
  toggleAllForCountry,
  resetZoneFilters,
  globalActionTypeCatalog,
  quickSelectLeaves,
  quickSelectCountries,
  quickSelectCombo,
  toggleQuickSelectLeaf,
  toggleAllQuickSelectLeavesForType,
  setAllQuickSelectLeaves,
  toggleQuickSelectCountry,
  setAllQuickSelectCountries,
  considerTerrain,
  onConsiderTerrainChange,
  losComputingCount,
  losZonesCount,
  equipmentZoneDiagnostics,
  intersections,
  selectedIntersections,
  onIntersectionToggle,
  onSelectAllIntersections,
  situationsLoading,
  situationsError,
  situationsFilters,
  onSituationsFiltersChange,
  situations,
  selectedSituationIds,
  onSituationCheckboxChange,
  onSituationRowClick,
  onSituationFlyTo,
  onSituationEdit,
  onSituationDelete,
  onSituationCreate,
  highlightedSituationId,
  activeSituationTimeline,
  timelineRevisionId,
  onTimelineRevisionSelect,
  onTimelineRevisionEdit,
  onTimelineRevisionDelete,
  canEditSituations,
  canDeleteSituations,
  canEditTargets = false,
  onOpenAddTarget,
  onSelectEventTool,
}) {
  if (dockTab === 'layers') {
    return (
      <MapLayerPanel
        layout="flat"
        enabledById={overlayEnabledById}
        currentZoom={currentZoom}
        onToggle={toggleOverlayLayer}
        onSetAll={setAllOverlayLayers}
      />
    );
  }

  if (dockTab === 'objects') {
    return (
      <>
        {canEditTargets && onOpenAddTarget && (
          <button type="button" className="map-fs-panel__add-btn" onClick={onOpenAddTarget}>
            + Добавить объект
          </button>
        )}
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
                mapRef.current?.flyTo([obj.lat, obj.lng], 8, { duration: 1.0, easeLinearity: 0.3 });
              });
            }
          }}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
        />
      </>
    );
  }

  if (dockTab === 'events') {
    return (
      <>
        {onSelectEventTool && (
          <button
            type="button"
            className="map-fs-panel__add-btn"
            onClick={() => onSelectEventTool('point')}
          >
            + Добавить событие
          </button>
        )}
        {eventsLoading && <p className="formular__status formular__status--loading">Загрузка событий…</p>}
        {eventsError && <p className="formular__status formular__status--error">{eventsError}</p>}
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
    );
  }

  if (dockTab === 'zones') {
    return (
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
    );
  }

  if (dockTab === 'situations') {
    return (
      <>
        {situationsLoading && <p className="formular__status formular__status--loading">Загрузка обстановки…</p>}
        {situationsError && <p className="formular__status formular__status--error">{situationsError}</p>}
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
            onDeleteRevision={canEditSituations && canDeleteSituations ? onTimelineRevisionDelete : undefined}
            canEdit={canEditSituations}
            canDelete={canEditSituations && canDeleteSituations}
            sortDirection="asc"
            groupBySituation={selectedSituationIds.length > 1}
          />
        ) : (
          <p className="situations-timeline__empty">Выберите обстановку checkbox в таблице</p>
        )}
      </>
    );
  }

  return null;
}

export function MapFullscreenPanelFeatures({
  effectiveMeasureMode,
  fullscreenMeasurements,
  onRemoveMeasurePoint,
}) {
  if (!effectiveMeasureMode) return null;
  return (
    <div className="map-fs-panel__features">
      <Features
        isMeasureMode={effectiveMeasureMode}
        measurements={fullscreenMeasurements}
        onRemovePoint={onRemoveMeasurePoint}
      />
    </div>
  );
}
