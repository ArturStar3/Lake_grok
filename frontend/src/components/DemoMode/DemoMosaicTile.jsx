import { memo, useEffect, useMemo } from 'react';
import MapComponent from '../MapComponent/MapComponent';
import { useDemoStageRunner } from '../../hooks/demo/useDemoStageRunner';
import {
  DEMO_MOSAIC_SLOT_LABELS,
  DEMO_TOOL,
  findStage,
} from '../../utils/demoScenario';
import { sliceCatalogsForStage } from '../../utils/demoMosaicCatalog';
import {
  COUNTRY_SYNTHETIC_CARDS,
  FORMULAR_SYNTHETIC_CARDS,
} from '../../hooks/demo/useDemoContentCards';
import './DemoMosaic.css';

const noop = () => {};

function resolveCardTitle(tool, cardId) {
  if (cardId == null || cardId === '') return null;
  const extras = tool === DEMO_TOOL.FORMULAR ? FORMULAR_SYNTHETIC_CARDS : COUNTRY_SYNTHETIC_CARDS;
  const found = extras.find((card) => String(card.id) === String(cardId));
  return found?.title || null;
}

function DemoMosaicPeek({ contentStep, objects = [], countriesList = [] }) {
  if (!contentStep) return null;
  const tool = contentStep.tool;
  const selection = contentStep.selection || {};

  if (tool === DEMO_TOOL.FORMULAR) {
    const targetId = (selection.target_ids || [])[0];
    if (targetId == null) return null;
    const obj = (objects || []).find((item) => String(item.id) === String(targetId));
    const title = obj?.title || obj?.label || 'Объект';
    const rawCard = (selection.card_ids || [])[0];
    const cardTitle = resolveCardTitle(tool, rawCard) || (rawCard != null ? 'Пункт' : null);
    return (
      <div className="demo-mosaic-tile__peek" aria-hidden="true">
        <span className="demo-mosaic-tile__peek-kind">Формуляр</span>
        <span className="demo-mosaic-tile__peek-title">{title}</span>
        {cardTitle ? <span className="demo-mosaic-tile__peek-card">{cardTitle}</span> : null}
      </div>
    );
  }

  if (tool === DEMO_TOOL.COUNTRY) {
    const iso = String((selection.country_isos || [])[0] || '').trim().toUpperCase();
    if (!iso) return null;
    const country = (countriesList || []).find(
      (item) => String(item.iso_code || '').toUpperCase() === iso,
    );
    const title = country?.title || iso;
    const rawCard = (selection.card_ids || [])[0];
    const cardTitle = resolveCardTitle(tool, rawCard) || (rawCard != null ? 'Пункт' : null);
    return (
      <div className="demo-mosaic-tile__peek" aria-hidden="true">
        <span className="demo-mosaic-tile__peek-kind">Справка</span>
        <span className="demo-mosaic-tile__peek-title">{title}</span>
        {cardTitle ? <span className="demo-mosaic-tile__peek-card">{cardTitle}</span> : null}
      </div>
    );
  }

  return null;
}

/**
 * Плитка мультиэкрана: lite Leaflet (без MapLibre) + общий stage playback.
 */
function DemoMosaicTile({
  slotId,
  screen = null,
  stages = [],
  startDelayMs = 0,
  playing = true,
  catalogs: catalogsProp = null,
}) {
  const label = screen?.label || DEMO_MOSAIC_SLOT_LABELS[slotId] || slotId.toUpperCase();
  const loop = Boolean(screen?.loop);
  const stage = useMemo(
    () => findStage(stages, screen?.stage_id),
    [stages, screen?.stage_id],
  );
  const catalogs = useMemo(
    () => catalogsProp || sliceCatalogsForStage(stage, {}),
    [catalogsProp, stage],
  );

  const runner = useDemoStageRunner({
    stage,
    loop,
    enabled: Boolean(stage),
    paused: !playing,
    startDelayMs,
    objects: catalogs.objects,
    events: catalogs.events,
    situations: catalogs.situations,
    countriesList: catalogs.countriesList,
  });

  const activeSituationId = runner.selectedSituationIds?.[0] ?? null;

  useEffect(() => {
    if (!playing) return undefined;
    const map = runner.mapRef.current;
    if (!map) return undefined;
    const run = () => {
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        try {
          map.invalidateSize();
        } catch {
          // карта ещё без контейнера
        }
      }
    };
    run();
    const t = window.setTimeout(run, 50);
    return () => clearTimeout(t);
  }, [playing, runner.mapRef]);

  return (
    <div className={`demo-mosaic-tile demo-mosaic-tile--${slotId}`}>
      <div className="demo-mosaic-tile__map">
        {stage ? (
          <MapComponent
            embed
            embedLite
            embedPlaying={playing}
            embedOverlayLayerIds={runner.overlayLayerIds}
            mapRef={runner.mapRef}
            objects={catalogs.objects}
            zoneObjects={catalogs.zoneObjects}
            selectedObj={runner.selectedObj}
            events={catalogs.events}
            selectedEventIds={runner.selectedEventIds}
            situations={catalogs.situations}
            selectedSituationIds={runner.selectedSituationIds}
            activeSituationId={activeSituationId}
            situationRevisions={catalogs.situationRevisions}
            actionZoneFilters={runner.actionZoneFilters}
            showActionRadius={runner.hasZones}
            actionTypes={catalogs.actionTypes}
            countriesList={catalogs.countriesList}
            considerTerrain={false}
            demoPlayback={runner.playback}
            demoAnimation={runner.demoAnimation}
            demoTexts={runner.demoTexts}
            isFullscreen={false}
            setIsFullscreen={noop}
          />
        ) : (
          <div className="demo-mosaic-tile__empty">Нет этапа</div>
        )}
      </div>
      <DemoMosaicPeek
        contentStep={runner.contentStep}
        objects={catalogs.objects}
        countriesList={catalogs.countriesList}
      />
      <div className="demo-mosaic-tile__label">
        <span>{label}</span>
        {loop ? <span className="demo-mosaic-tile__loop" title="Повтор этапа">∞</span> : null}
      </div>
    </div>
  );
}

export default memo(DemoMosaicTile);
