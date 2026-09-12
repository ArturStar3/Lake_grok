import { memo, useEffect, useMemo, useRef } from 'react';
import MapComponent from '../MapComponent/MapComponent';
import { useDemoStageRunner } from '../../hooks/demo/useDemoStageRunner';
import {
  DEMO_MOSAIC_SLOT_LABELS,
  DEMO_MOSAIC_CONTENT,
  DEMO_TOOL,
  findStage,
  mosaicScreenHasVideo,
} from '../../utils/demoScenario';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { sliceCatalogsForStage } from '../../utils/demoMosaicCatalog';
import { buildVisibleZones } from '../../utils/buildVisibleZones';
import {
  COUNTRY_SYNTHETIC_CARDS,
  FORMULAR_SYNTHETIC_CARDS,
} from '../../hooks/demo/useDemoContentCards';
import DemoCueMark from './DemoCueMark';
import DemoMosaicScreenText from './DemoMosaicScreenText';
import './DemoMosaic.css';

const noop = () => {};
const EMPTY_ZONES = [];

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
  onPainted = null,
}) {
  const label = screen?.label || DEMO_MOSAIC_SLOT_LABELS[slotId] || slotId.toUpperCase();
  const isVideo = mosaicScreenHasVideo(screen);
  const isImage = screen?.content_type === DEMO_MOSAIC_CONTENT.IMAGE;
  const videoUrl = isVideo ? resolveMediaUrl(screen.video_url) : null;
  const loop = Boolean(screen?.loop);
  const stage = useMemo(
    () => (isVideo || isImage ? null : findStage(stages, screen?.stage_id)),
    [isVideo, isImage, stages, screen?.stage_id],
  );
  const catalogs = useMemo(
    () => catalogsProp || sliceCatalogsForStage(stage, {}),
    [catalogsProp, stage],
  );

  const runner = useDemoStageRunner({
    stage,
    loop,
    enabled: Boolean(stage) && !isVideo,
    paused: !playing || isVideo,
    startDelayMs,
    objects: catalogs.objects,
    events: catalogs.events,
    situations: catalogs.situations,
    countriesList: catalogs.countriesList,
  });

  const visibleZones = useMemo(() => {
    if (!runner.hasZones) return EMPTY_ZONES;
    const source = catalogs.zoneObjects?.length ? catalogs.zoneObjects : catalogs.objects;
    return buildVisibleZones(source, runner.actionZoneFilters);
  }, [catalogs.objects, catalogs.zoneObjects, runner.actionZoneFilters, runner.hasZones]);

  const lastInvalidateSizeRef = useRef({ x: 0, y: 0 });
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const onPaintedRef = useRef(onPainted);
  onPaintedRef.current = onPainted;
  const paintedRef = useRef(false);
  const activeSituationId = runner.selectedSituationIds?.[0] ?? null;

  useEffect(() => {
    paintedRef.current = false;
    let cancelled = false;
    let raf = 0;
    let fallbackId = 0;
    let tries = 0;

    const done = () => {
      if (cancelled || paintedRef.current) return;
      paintedRef.current = true;
      onPaintedRef.current?.(slotId);
    };

    if (isImage) {
      const image = imageRef.current;
      const decoded = () => {
        if (image?.decode) image.decode().catch(() => null).then(done);
        else done();
      };
      if (!image || image.complete) {
        decoded();
        return () => { cancelled = true; };
      }
      image.addEventListener('load', decoded, { once: true });
      image.addEventListener('error', done, { once: true });
      fallbackId = window.setTimeout(done, 4000);
      return () => {
        cancelled = true;
        image.removeEventListener('load', decoded);
        image.removeEventListener('error', done);
        window.clearTimeout(fallbackId);
      };
    }
    if (isVideo) {
      const video = videoRef.current;
      if (!video || video.readyState >= 2) {
        done();
        return undefined;
      }
      video.addEventListener('loadeddata', done, { once: true });
      video.addEventListener('canplay', done, { once: true });
      fallbackId = window.setTimeout(done, 4000);
      return () => {
        cancelled = true;
        video.removeEventListener('loadeddata', done);
        video.removeEventListener('canplay', done);
        if (fallbackId) window.clearTimeout(fallbackId);
      };
    }

    if (!stage) {
      done();
      return undefined;
    }

    const attach = () => {
      if (cancelled) return;
      const map = runner.mapRef.current;
      if (map?.whenReady) {
        map.whenReady(() => {
          try {
            map.invalidateSize({ animate: false, pan: false });
            map.fire('viewreset');
          } catch {
            // контейнер ещё без размера
          }
          raf = requestAnimationFrame(() => {
            if (!cancelled) done();
          });
        });
        return;
      }
      tries += 1;
      if (tries > 90) {
        done();
        return;
      }
      raf = requestAnimationFrame(attach);
    };

    raf = requestAnimationFrame(attach);
    fallbackId = window.setTimeout(done, 4000);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (fallbackId) window.clearTimeout(fallbackId);
    };
  }, [isVideo, isImage, screen?.image_url, videoUrl, runner.mapRef, slotId, stage]);

  useEffect(() => {
    if (!playing || paintedRef.current) return undefined;
    const map = runner.mapRef.current;
    if (!map) return undefined;
    const size = map.getSize?.() || map._size;
    const hasSize = size && size.x > 0 && size.y > 0;
    if (
      hasSize
      && size.x === lastInvalidateSizeRef.current.x
      && size.y === lastInvalidateSizeRef.current.y
    ) {
      return undefined;
    }
    try {
      map.invalidateSize({ animate: false, pan: false });
    } catch {
      try {
        map.invalidateSize();
      } catch {
        // карта ещё без контейнера
      }
    }
    const nextSize = map.getSize?.() || map._size;
    if (nextSize && nextSize.x > 0 && nextSize.y > 0) {
      lastInvalidateSizeRef.current = { x: nextSize.x, y: nextSize.y };
      try {
        map.fire('viewreset');
      } catch {
        // слой зон обновится на следующем кадре
      }
    }
    return undefined;
  }, [playing, runner.mapRef]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !isVideo) return undefined;
    if (playing) {
      const play = node.play();
      if (play?.catch) play.catch(() => null);
    } else {
      node.pause();
    }
    return undefined;
  }, [isVideo, playing, videoUrl]);

  return (
    <div className={`demo-mosaic-tile demo-mosaic-tile--${slotId}${isVideo ? ' demo-mosaic-tile--video' : ''}`}>
      <DemoCueMark value={screen?.cue} size="sm" />
      <div className="demo-mosaic-tile__map">
        {isImage ? (
          screen.image_url
            ? <img ref={imageRef} className="demo-mosaic-tile__image" src={resolveMediaUrl(screen.image_url)} alt={screen.label || 'Фотография'} style={{ objectFit: screen.image_fit || 'contain' }} />
            : <div className="demo-mosaic-tile__empty">Фотография не выбрана</div>
        ) : isVideo && videoUrl ? (
          <video
            ref={videoRef}
            className="demo-mosaic-tile__video"
            src={videoUrl}
            muted
            loop
            playsInline
            autoPlay={playing}
            preload="auto"
          />
        ) : isVideo ? (
          <div className="demo-mosaic-tile__empty">Нет видео</div>
        ) : stage ? (
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
            visibleZones={visibleZones}
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
      {isVideo || isImage ? null : (
        <DemoMosaicPeek
          contentStep={runner.contentStep}
          objects={catalogs.objects}
          countriesList={catalogs.countriesList}
        />
      )}
      <div className="demo-mosaic-tile__label">
        <span>{label}</span>
        {loop ? <span className="demo-mosaic-tile__loop" title="Повтор этапа">∞</span> : null}
      </div>
      <DemoMosaicScreenText text={screen?.text} />
    </div>
  );
}

export default memo(DemoMosaicTile);
