import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEMO_DEFAULT_TABLEAU_BORDER_RADIUS,
  DEMO_DEFAULT_TABLEAU_CAPTION,
  DEMO_DEFAULT_TABLEAU_CAMERA,
  DEMO_DEFAULT_TABLEAU_GALLERY,
  DEMO_DEFAULT_TABLEAU_NETWORK,
  DEMO_DEFAULT_TABLEAU_VIDEO,
  DEMO_DEFAULT_TABLEAU_MAP_REVEAL,
  DEMO_DEFAULT_TABLEAU_OVERLAY,
  DEMO_DEFAULT_TABLEAU_TILT,
  DEMO_DEFAULT_TABLEAU_TILT_MS,
  DEMO_DEFAULT_TABLEAU_UNTILT_MS,
  DEMO_CAMERA_MODE,
  DEMO_TABLEAU_ARROW_HEADS,
  DEMO_TABLEAU_ARROW_LINES,
  DEMO_TABLEAU_CELL_ALIGNS,
  DEMO_TABLEAU_GALLERY_ENTER_EFFECTS,
  DEMO_TABLEAU_GALLERY_EXIT_EFFECTS,
  DEMO_TABLEAU_GALLERY_MAX_IMAGES,
  DEMO_TABLEAU_GALLERY_SETTLE,
  DEMO_TABLEAU_GALLERY_SETTLES,
  DEMO_TABLEAU_MAP_FRAME,
  DEMO_TABLEAU_VARIANT,
  DEMO_TABLEAU_VARIANTS,
  DEMO_CUE_MAX,
  DEMO_CUE_MIN,
  DEMO_TEXT_FONTS,
  DEMO_TEXT_WEIGHTS,
  normalizeCue,
  bridgeSpacerPercent,
  buildTableauOverlayArrows,
  cellAlignStyle,
  composeStateForStage,
  createDefaultTableauPreset,
  findStage,
  findTableauBlock,
  findTableauPreset,
  isTableauGalleryPreset,
  normalizeScenarioTableau,
  normalizeTableauGallery,
  normalizeTableauOverlay,
  normalizeTableauPreset,
  normalizeTableauRowHeights,
  overlayGridStyle,
} from '../../utils/demoScenario';
import {
  bakeGalleryLayoutIntoRest,
  computeGallerySettleRects,
} from '../../utils/demoTableauGalleryLayout';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { uploadDemoMosaicMedia, uploadDemoTableauMedia } from '../../api/demoScenarios';
import DemoScannerEditor from './DemoScannerEditor';
import DemoScannerLayer from './DemoScannerLayer';
import DemoNetworkEditor from './DemoNetworkEditor';
import DemoNetworkLayer from './DemoNetworkLayer';
import ZoneColorPicker from '../ReferenceData/ZoneColorPicker';
import DemoTableauBlockView from './DemoTableauBlockView';
import DemoTableauBlockStudioModal from './DemoTableauBlockStudioModal';
import DemoCueMark from './DemoCueMark';
import DemoStudioSaveActions from './DemoStudioSaveActions';
import './DemoTableauBlockView.css';
import './DemoTableauStudioModal.css';

const ARROW_DASH = {
  solid: 'none',
  dashed: '6 5',
  dotted: '2 3',
};

const ARROW_HEAD_LEN = 1.4;

function resolveArrowDash(line) {
  if (line === 'solid') return 'none';
  return ARROW_DASH[line] || ARROW_DASH.dashed;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shortenPolylineForHead(points, headLen = ARROW_HEAD_LEN) {
  if (!points?.length || points.length < 2) return points || [];
  const out = points.map((p) => ({ ...p }));
  const last = out.length - 1;
  const a = out[last - 1];
  const b = out[last];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const trim = Math.min(headLen, len * 0.35);
  out[last] = {
    x: b.x - (dx / len) * trim,
    y: b.y - (dy / len) * trim,
  };
  return out;
}

function arrowHeadPoints(xTip, yTip, xBase, yBase, halfWidth = ARROW_HEAD_LEN * 0.45) {
  const dx = xTip - xBase;
  const dy = yTip - yBase;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * halfWidth;
  const py = (dx / len) * halfWidth;
  return [
    `${xTip},${yTip}`,
    `${xBase + px},${yBase + py}`,
    `${xBase - px},${yBase - py}`,
  ].join(' ');
}

function pointsToSvg(points) {
  return (points || []).map((p) => `${p.x},${p.y}`).join(' ');
}

function cellCovers(cell, row, col) {
  if (!cell || cell.row !== row) return false;
  const span = Math.max(1, cell.col_span || 1);
  return col >= cell.col && col < cell.col + span;
}

function makeCellId(row, col) {
  return `cell-${row}-${col}`;
}

/** Пересобрать ячейки при смене cols/rows. */
function rebuildOverlayCells(prevCells, cols, rows) {
  const kept = [];
  (Array.isArray(prevCells) ? prevCells : []).forEach((cell) => {
    if (!cell) return;
    if (cell.row < 0 || cell.row >= rows) return;
    if (cell.col < 0 || cell.col >= cols) return;
    const maxSpan = Math.max(1, cols - cell.col);
    const colSpan = clamp(cell.col_span || 1, 1, maxSpan);
    kept.push({
      ...cell,
      col_span: colSpan,
      role: cell.role === 'bridge' ? 'bridge' : 'card',
    });
  });

  // Один мост максимум
  let bridgeSeen = false;
  const cells = kept.map((cell) => {
    if (cell.role !== 'bridge') return cell;
    if (bridgeSeen) {
      return { ...cell, role: 'card', col_span: 1 };
    }
    bridgeSeen = true;
    return cell;
  });

  // Заполнить пустые слоты ряда 0 карточками
  for (let col = 0; col < cols; col += 1) {
    if (cells.some((c) => cellCovers(c, 0, col))) continue;
    cells.push({
      id: makeCellId(0, col),
      row: 0,
      col,
      col_span: 1,
      role: 'card',
      block_id: null,
      content_width: 100,
      content_height: 100,
      align_x: 'center',
      align_y: 'center',
      offset_top: 0,
    });
  }

  const hasBridge = cells.some((c) => c.role === 'bridge');
  if (rows >= 2 && !hasBridge) {
    const bridgeRow = rows - 1;
    let bridgeCol = 0;
    let bridgeSpan = cols;
    if (cols >= 3) {
      bridgeCol = 1;
      bridgeSpan = cols - 2;
    }
    const filtered = cells.filter((c) => {
      if (c.row !== bridgeRow) return true;
      const end = c.col + Math.max(1, c.col_span || 1);
      return end <= bridgeCol || c.col >= bridgeCol + bridgeSpan;
    });
    filtered.push({
      id: makeCellId(bridgeRow, bridgeCol),
      row: bridgeRow,
      col: bridgeCol,
      col_span: bridgeSpan,
      role: 'bridge',
      block_id: null,
      content_width: 100,
      content_height: 100,
      align_x: 'center',
      align_y: 'center',
      offset_top: 0,
    });
    return filtered;
  }

  if (rows < 2) {
    return cells
      .filter((c) => c.role !== 'bridge')
      .map((c) => ({ ...c, role: 'card', col_span: Math.min(c.col_span || 1, cols - c.col) }));
  }

  return cells;
}

function mergeSelectionToBridge(cells, selectedIds) {
  const selected = (cells || []).filter((c) => selectedIds.has(c.id));
  if (!selected.length) return null;
  const row = selected[0].row;
  if (!selected.every((c) => c.row === row)) return null;

  const covered = new Set();
  selected.forEach((c) => {
    const span = Math.max(1, c.col_span || 1);
    for (let i = 0; i < span; i += 1) covered.add(c.col + i);
  });
  const sorted = [...covered].sort((a, b) => a - b);
  if (!sorted.length) return null;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return null;
  }

  const bridgeCol = sorted[0];
  const bridgeSpan = sorted.length;
  const bridgeEnd = bridgeCol + bridgeSpan;
  const keepBlock = selected.find((c) => c.block_id)?.block_id || null;

  const next = (cells || []).filter((c) => {
    if (c.role === 'bridge') return false;
    if (selectedIds.has(c.id)) return false;
    if (c.row === row) {
      const end = c.col + Math.max(1, c.col_span || 1);
      if (!(end <= bridgeCol || c.col >= bridgeEnd)) return false;
    }
    return true;
  });

  next.push({
    id: selected[0].id,
    row,
    col: bridgeCol,
    col_span: bridgeSpan,
    role: 'bridge',
    block_id: keepBlock,
    content_width: selected[0].content_width ?? 100,
    content_height: selected[0].content_height ?? 100,
    align_x: selected[0].align_x || 'center',
    align_y: selected[0].align_y || 'center',
    offset_top: selected[0].offset_top ?? 0,
  });
  return next;
}

function unmergeBridge(cells, bridgeId) {
  const bridge = (cells || []).find((c) => c.id === bridgeId && c.role === 'bridge');
  if (!bridge) return null;
  const next = (cells || []).filter((c) => c.id !== bridgeId);
  const span = Math.max(1, bridge.col_span || 1);
  for (let col = bridge.col; col < bridge.col + span; col += 1) {
    next.push({
      id: makeCellId(bridge.row, col),
      row: bridge.row,
      col,
      col_span: 1,
      role: 'card',
      block_id: null,
      content_width: 100,
      content_height: 100,
      align_x: 'center',
      align_y: 'center',
      offset_top: 0,
    });
  }
  return next;
}

/**
 * Конструктор художественного режима: сетка overlay и стрелки к карте.
 */
export default function DemoTableauStudioModal({
  tableau,
  stages = [],
  objects = [],
  onChange,
  onClose,
  onOpenStages,
  onPreviewTableau,
  onOpenBlocks,
  getMapView,
  readOnly = false,
  canWrite = false,
  onSave,
  saveBusy = false,
  saveNotice = '',
  saveDisabled = false,
}) {
  const library = useMemo(() => normalizeScenarioTableau(tableau), [tableau]);
  const [presetId, setPresetId] = useState(library.active_preset_id || library.presets[0]?.id || null);
  const [selection, setSelection] = useState({ type: null, id: null });
  const [selectedCellIds, setSelectedCellIds] = useState(() => new Set());
  const [blockStudioOpen, setBlockStudioOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryTargetCountry, setGalleryTargetCountry] = useState('');
  const [galleryTargetQuery, setGalleryTargetQuery] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [monitorAspect, setMonitorAspect] = useState(() => {
    if (typeof window === 'undefined') return 16 / 9;
    const w = window.innerWidth || 16;
    const h = window.innerHeight || 9;
    return w / Math.max(h, 1);
  });
  const [monitorSize, setMonitorSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }));

  const sceneRef = useRef(null);
  const paletteRef = useRef(null);
  const galleryFileRef = useRef(null);
  const videoFileRef = useRef(null);
  const galleryRef = useRef(null);
  const libraryRef = useRef(library);

  const preset = findTableauPreset(library, presetId) || library.presets[0] || null;
  const tilt = preset?.tilt || DEMO_DEFAULT_TABLEAU_TILT;
  const caption = preset?.caption || DEMO_DEFAULT_TABLEAU_CAPTION;
  const borderRadius = preset?.border_radius_px ?? DEMO_DEFAULT_TABLEAU_BORDER_RADIUS;
  const camera = preset?.camera || DEMO_DEFAULT_TABLEAU_CAMERA;
  const mapReveal = preset?.map_reveal || DEMO_DEFAULT_TABLEAU_MAP_REVEAL;
  const assignedStage = findStage(stages, preset?.stage_id);
  const overlay = preset?.overlay || DEMO_DEFAULT_TABLEAU_OVERLAY;
  const mapArrow = overlay.map_arrow || DEMO_DEFAULT_TABLEAU_OVERLAY.map_arrow;
  const cells = overlay.cells || [];
  const isGallery = isTableauGalleryPreset(preset);
  const isVideo = preset?.variant === DEMO_TABLEAU_VARIANT.VIDEO;
  const isScanner = preset?.variant === DEMO_TABLEAU_VARIANT.SCANNER;
  const isNetwork = preset?.variant === DEMO_TABLEAU_VARIANT.NETWORK;
  const gallery = preset?.gallery || DEMO_DEFAULT_TABLEAU_GALLERY;
  const network = preset?.network || DEMO_DEFAULT_TABLEAU_NETWORK;
  const video = preset?.video || DEMO_DEFAULT_TABLEAU_VIDEO;
  galleryRef.current = gallery;
  libraryRef.current = library;

  const galleryTargetOptions = useMemo(() => {
    if (!assignedStage) return [];
    const ids = composeStateForStage(assignedStage).target_ids || [];
    return ids.map((id) => {
      const obj = (objects || []).find((item) => String(item.id) === String(id));
      return {
        id: String(id),
        label: obj?.title || obj?.label || String(id),
        country: obj?.country?.title || '',
      };
    });
  }, [assignedStage, objects]);

  const galleryTargetCountries = useMemo(() => (
    [...new Set(galleryTargetOptions.map((item) => item.country).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ru'))
  ), [galleryTargetOptions]);

  const filteredGalleryTargetOptions = useMemo(() => {
    const query = galleryTargetQuery.trim().toLocaleLowerCase('ru');
    return galleryTargetOptions.filter((item) => (
      (!galleryTargetCountry || item.country === galleryTargetCountry)
      && (!query || item.label.toLocaleLowerCase('ru').includes(query))
    ));
  }, [galleryTargetCountry, galleryTargetOptions, galleryTargetQuery]);

  const allowedBlockIds = useMemo(
    () => new Set((library.blocks || []).map((b) => b.id)),
    [library.blocks],
  );

  const mapFrame = useMemo(() => ({
    ...DEMO_TABLEAU_MAP_FRAME,
    top: DEMO_TABLEAU_MAP_FRAME.top + (tilt.offset_y ?? 0),
  }), [tilt.offset_y]);

  const previewArrows = useMemo(
    () => buildTableauOverlayArrows(overlay, mapFrame),
    [overlay, mapFrame],
  );

  const selectedCell = selection.type === 'cell'
    ? cells.find((item) => item.id === selection.id) || null
    : null;
  const selectedCellBlock = selectedCell
    ? findTableauBlock(library.blocks, selectedCell.block_id)
    : null;
  const selectedGalleryImage = selection.type === 'gallery-image'
    ? (gallery.images || []).find((item) => item.id === selection.id) || null
    : null;
  const selectedGalleryRectIndex = selectedGalleryImage
    ? (gallery.images || []).findIndex((item) => item.id === selectedGalleryImage.id)
    : -1;
  const visibleGalleryTargetOptions = useMemo(() => {
    const selectedId = selectedGalleryImage?.target_id != null
      ? String(selectedGalleryImage.target_id)
      : '';
    if (!selectedId || filteredGalleryTargetOptions.some((item) => item.id === selectedId)) {
      return filteredGalleryTargetOptions;
    }
    const selected = galleryTargetOptions.find((item) => item.id === selectedId);
    return selected ? [selected, ...filteredGalleryTargetOptions] : filteredGalleryTargetOptions;
  }, [filteredGalleryTargetOptions, galleryTargetOptions, selectedGalleryImage]);
  const bridgeCell = cells.find((c) => c.role === 'bridge') || null;

  const canMakeBridge = useMemo(() => {
    if (readOnly || selectedCellIds.size < 1) return false;
    const selected = cells.filter((c) => selectedCellIds.has(c.id));
    if (selected.length < 1) return false;
    const row = selected[0].row;
    if (!selected.every((c) => c.row === row)) return false;
    const covered = new Set();
    selected.forEach((c) => {
      const span = Math.max(1, c.col_span || 1);
      for (let i = 0; i < span; i += 1) covered.add(c.col + i);
    });
    const sorted = [...covered].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return sorted.length >= 1;
  }, [cells, selectedCellIds, readOnly]);

  const clearCellSelection = () => {
    setSelection({ type: null, id: null });
    setSelectedCellIds(new Set());
  };

  const patchLibrary = (partial) => {
    const nextLibrary = normalizeScenarioTableau({ ...libraryRef.current, ...partial });
    // Save can be clicked before the parent has rendered the latest onChange.
    // Keep the current tableau snapshot locally so the last edited field is not lost.
    libraryRef.current = nextLibrary;
    onChange(nextLibrary);
  };

  const handleSaveCurrentTableau = () => onSave?.(libraryRef.current);

  const patchPreset = (partial) => {
    if (!preset) return;
    const next = normalizeTableauPreset(
      { ...preset, ...partial },
      allowedBlockIds,
    );
    delete next._migrated_blocks;
    const presets = library.presets.map((item) => (item.id === preset.id ? next : item));
    patchLibrary({ presets, active_preset_id: next.id });
    setPresetId(next.id);
  };

  const patchOverlay = (partial) => {
    if (!preset) return;
    const nextOverlay = normalizeTableauOverlay(
      { ...overlay, ...partial },
      allowedBlockIds,
    );
    patchPreset({ overlay: nextOverlay });
  };

  const patchOverlayCells = (nextCells) => {
    patchOverlay({ cells: nextCells });
  };

  const patchGallery = (partial) => {
    if (!preset) return;
    patchPreset({
      gallery: normalizeTableauGallery({
        ...(preset.gallery || {}),
        ...partial,
      }),
    });
  };

  const patchVideo = (partial) => {
    if (!preset) return;
    patchPreset({ video: { ...video, ...partial } });
  };

  const handleAddPreset = () => {
    const next = createDefaultTableauPreset({
      title: `Планшет ${library.presets.length + 1}`,
      stage_id: stages[0]?.id || stages[0]?.key || null,
    });
    patchLibrary({
      presets: [...library.presets, next],
      active_preset_id: next.id,
    });
    setPresetId(next.id);
    clearCellSelection();
  };

  const handleDeletePreset = () => {
    if (!preset) return;
    const presets = library.presets.filter((item) => item.id !== preset.id);
    const active = presets[0]?.id || null;
    patchLibrary({ presets, active_preset_id: active });
    setPresetId(active);
    clearCellSelection();
  };

  const handleGridSizeChange = (nextCols, nextRows) => {
    const cols = clamp(Math.round(nextCols), 1, 8);
    const rows = clamp(Math.round(nextRows), 1, 4);
    const rebuilt = rebuildOverlayCells(cells, cols, rows);
    patchOverlay({
      cols,
      rows,
      cells: rebuilt,
      row_heights: normalizeTableauRowHeights(overlay.row_heights, rows),
    });
    clearCellSelection();
  };

  const handleCellClick = (event, cell) => {
    event.stopPropagation();
    if (readOnly) {
      setSelection({ type: 'cell', id: cell.id });
      setSelectedCellIds(new Set([cell.id]));
      return;
    }
    const multi = event.ctrlKey || event.metaKey;
    if (multi) {
      setSelectedCellIds((prev) => {
        const next = new Set(prev);
        if (next.has(cell.id)) next.delete(cell.id);
        else {
          if (next.size) {
            const existing = cells.find((c) => next.has(c.id));
            if (existing && existing.row !== cell.row) {
              next.clear();
            }
          }
          next.add(cell.id);
        }
        const ids = [...next];
        setSelection(ids.length === 1
          ? { type: 'cell', id: ids[0] }
          : ids.length
            ? { type: 'cell', id: cell.id }
            : { type: null, id: null });
        return next;
      });
      return;
    }
    setSelection({ type: 'cell', id: cell.id });
    setSelectedCellIds(new Set([cell.id]));
  };

  const handleMakeBridge = () => {
    if (!canMakeBridge) return;
    const next = mergeSelectionToBridge(cells, selectedCellIds);
    if (!next) return;
    const bridge = next.find((c) => c.role === 'bridge');
    patchOverlayCells(next);
    if (bridge) {
      setSelection({ type: 'cell', id: bridge.id });
      setSelectedCellIds(new Set([bridge.id]));
    } else {
      clearCellSelection();
    }
  };

  const handleRemoveBridge = () => {
    if (readOnly || !bridgeCell) return;
    const next = unmergeBridge(cells, bridgeCell.id);
    if (!next) return;
    patchOverlayCells(next);
    clearCellSelection();
  };

  const handleAssignBlock = (block) => {
    if (readOnly || !block || !selectedCell) return;
    const next = cells.map((c) => (
      c.id === selectedCell.id ? { ...c, block_id: block.id } : c
    ));
    patchOverlayCells(next);
    setPaletteOpen(false);
  };

  const handleClearBlock = () => {
    if (readOnly || !selectedCell) return;
    const next = cells.map((c) => (
      c.id === selectedCell.id ? { ...c, block_id: null } : c
    ));
    patchOverlayCells(next);
  };

  const patchSelectedCell = (patch) => {
    if (readOnly || !selectedCell) return;
    const next = cells.map((c) => (
      c.id === selectedCell.id ? { ...c, ...patch } : c
    ));
    patchOverlayCells(next);
  };

  const handleOpenBlocks = () => {
    if (onOpenBlocks) {
      onOpenBlocks();
      return;
    }
    setBlockStudioOpen(true);
  };

  const handleGalleryFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !preset || readOnly) return;
    const current = gallery.images || [];
    if (current.length >= DEMO_TABLEAU_GALLERY_MAX_IMAGES) return;
    setGalleryBusy(true);
    try {
      const data = await uploadDemoTableauMedia(file);
      const src = data?.url || '';
      if (!src) return;
      patchGallery({
        images: [
          ...current,
          {
            src,
            title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
          },
        ],
      });
    } catch {
      // ошибка загрузки — оставляем текущий список
    } finally {
      setGalleryBusy(false);
    }
  };

  const handleVideoFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !preset || readOnly) return;
    setGalleryBusy(true);
    try {
      const data = await uploadDemoMosaicMedia(file);
      if (!data?.url) return;
      patchVideo({ video_url: data.url, video_media_id: data.id || null });
    } finally {
      setGalleryBusy(false);
    }
  };

  const galleryRects = useMemo(
    () => computeGallerySettleRects(gallery.images || [], gallery),
    [gallery],
  );
  const selectedGalleryRect = selectedGalleryRectIndex >= 0
    ? galleryRects[selectedGalleryRectIndex]
    : null;

  const patchGalleryImageRest = (imageId, restPartial) => {
    const images = (gallery.images || []).map((item) => (
      item.id === imageId
        ? { ...item, rest: { ...item.rest, ...restPartial } }
        : item
    ));
    patchGallery({
      settle: DEMO_TABLEAU_GALLERY_SETTLE.FREE,
      images,
    });
  };

  const patchGalleryImage = (imageId, partial) => {
    const images = (gallery.images || []).map((item) => (
      item.id === imageId ? { ...item, ...partial } : item
    ));
    patchGallery({ images });
  };

  const startGalleryPointerEdit = (mode, image, event, rect = null) => {
    if (readOnly || !image || !preset) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelection({ type: 'gallery-image', id: image.id });
    setSelectedCellIds(new Set());

    const scene = sceneRef.current;
    if (!scene) return;
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const originX = event.clientX;
    const originY = event.clientY;
    const orig = {
      x: Number(rect?.x ?? image.rest?.x) || 0,
      y: Number(rect?.y ?? image.rest?.y) || 0,
      w: Number(rect?.w ?? image.rest?.w) || 22,
      h: Number(rect?.h ?? image.rest?.h) || 28,
    };
    const presetKey = preset.id;

    const onMove = (ev) => {
      const dx = ((ev.clientX - originX) / bounds.width) * 100;
      const dy = ((ev.clientY - originY) / bounds.height) * 100;
      let nextRest;
      if (mode === 'resize') {
        nextRest = {
          ...orig,
          w: clamp(orig.w + dx, 4, 100 - orig.x),
          h: clamp(orig.h + dy, 4, 100 - orig.y),
        };
      } else {
        nextRest = {
          ...orig,
          x: clamp(orig.x + dx, 0, 100 - orig.w),
          y: clamp(orig.y + dy, 0, 100 - orig.h),
        };
      }
      const currentLibrary = libraryRef.current;
      const currentPreset = findTableauPreset(currentLibrary, presetKey);
      if (!currentPreset) return;
      const currentGallery = currentPreset.gallery || {};
      const images = (currentGallery.images || []).map((item) => (
        item.id === image.id ? { ...item, rest: nextRest } : item
      ));
      const nextPreset = normalizeTableauPreset(
        {
          ...currentPreset,
          gallery: normalizeTableauGallery({
            ...currentGallery,
            settle: DEMO_TABLEAU_GALLERY_SETTLE.FREE,
            images,
          }),
        },
        allowedBlockIds,
      );
      delete nextPreset._migrated_blocks;
      const presets = currentLibrary.presets.map((item) => (
        item.id === presetKey ? nextPreset : item
      ));
      onChange(normalizeScenarioTableau({
        ...currentLibrary,
        presets,
        active_preset_id: nextPreset.id,
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    const updateScale = () => {
      const width = scene.getBoundingClientRect().width;
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : width;
      const viewportH = typeof window !== 'undefined' ? window.innerHeight : 1;
      if (viewportW > 0 && viewportH > 0) {
        setMonitorAspect(viewportW / viewportH);
        setMonitorSize({ w: Math.round(viewportW), h: Math.round(viewportH) });
      }
      if (!width || !viewportW) {
        setPreviewScale(1);
        return;
      }
      setPreviewScale(clamp(width / viewportW, 0.05, 1));
    };
    updateScale();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScale)
      : null;
    ro?.observe(scene);
    window.addEventListener('resize', updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [preset?.id, tilt.perspective, tilt.rotate_x, tilt.rotate_z, tilt.scale, tilt.offset_y, borderRadius]);

  useEffect(() => {
    if (!paletteOpen) return undefined;
    const onDocDown = (event) => {
      const root = paletteRef.current;
      if (root && !root.contains(event.target)) {
        setPaletteOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [paletteOpen]);

  const stageOptions = [
    { id: '', label: 'Не выбран' },
    ...stages.map((stage) => ({
      id: stage.id || stage.key,
      label: stage.title || 'Этап',
    })),
  ];

  const gridStyle = overlayGridStyle(overlay);

  return (
    <div className="demo-tableau-studio-modal" role="dialog" aria-modal="true">
      <div className="demo-tableau-studio-modal__panel">
        <header className="demo-tableau-studio-modal__header">
          <div>
            <h2>Художественный режим</h2>
            <p className="demo-tableau-studio-modal__hint">
              {isScanner ? 'Сканирование изображений и заполнение документа из DOCX.' : isNetwork
                ? 'Три логотипа образуют сеть взаимного обмена данными.' : isGallery
                ? 'Галерея: кадры проявляются в центре и садятся на заданные места. Карту можно скрыть.'
                : isVideo
                  ? 'Видео показывается на весь экран; при необходимости добавьте надпись в инспекторе.'
                : 'Планшетный режим: сетка блоков и стрелки к карте. Вид карты — из этапа.'}
            </p>
          </div>
          <div className="demo-tableau-studio-modal__header-actions">
            {onOpenStages ? (
              <button type="button" className="demo-btn demo-btn--ghost" onClick={onOpenStages}>
                Этапы…
              </button>
            ) : null}
            {!isGallery && !isVideo && !isScanner && !isNetwork ? (
              <button type="button" className="demo-btn demo-btn--ghost" onClick={handleOpenBlocks}>
                Блоки…
              </button>
            ) : null}
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              disabled={!preset}
              onClick={() => onPreviewTableau?.(preset, stages, library.blocks || [])}
            >
              Просмотр
            </button>
            <DemoStudioSaveActions
              canWrite={canWrite}
              onSave={handleSaveCurrentTableau}
              busy={saveBusy}
              notice={saveNotice}
              disabled={saveDisabled}
            />
            <button type="button" className="demo-btn" onClick={onClose}>
              Готово
            </button>
          </div>
        </header>

        <div className={[
          'demo-tableau-studio-modal__body',
          (isGallery || isNetwork) ? 'is-gallery' : '',
        ].filter(Boolean).join(' ')}>
          <aside className="demo-tableau-studio-modal__presets">
            <div className="demo-tableau-studio-modal__presets-head">
              <h3>Пресеты</h3>
              {!readOnly && (
                <button type="button" className="demo-btn demo-btn--ghost" onClick={handleAddPreset}>
                  + Пресет
                </button>
              )}
            </div>
            {library.presets.length ? (
              <ul>
                {library.presets.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === preset?.id ? 'is-active' : ''}
                      onClick={() => {
                        setPresetId(item.id);
                        clearCellSelection();
                      }}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="demo-tableau-studio-modal__empty">Пресеты ещё не созданы.</p>
            )}
            {!readOnly && preset ? (
              <button type="button" className="demo-btn demo-btn--ghost" onClick={handleDeletePreset}>
                Удалить пресет
              </button>
            ) : null}

            {preset ? (
              <fieldset className="demo-inspector__group" disabled={readOnly}>
                <legend>Пресет</legend>
                <label className="demo-field">
                  <span className="demo-field__label">Название</span>
                  <input
                    type="text"
                    value={preset.title}
                    onChange={(e) => patchPreset({ title: e.target.value })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Номер слайда</span>
                  <input
                    type="number"
                    min={DEMO_CUE_MIN}
                    max={DEMO_CUE_MAX}
                    placeholder="нет"
                    value={preset.cue ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      patchPreset({ cue: raw === '' ? null : normalizeCue(raw) });
                    }}
                  />
                  <span className="demo-field__hint">
                    Номер в правом верхнем углу на показе ({DEMO_CUE_MIN}–{DEMO_CUE_MAX}). Пусто — не показывать.
                  </span>
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Этап (вид карты)</span>
                  <select
                    value={preset.stage_id || ''}
                    onChange={(e) => patchPreset({ stage_id: e.target.value || null })}
                  >
                    {stageOptions.map((opt) => (
                      <option key={opt.id || 'none'} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                {assignedStage ? (
                  <p className="demo-tableau-studio-modal__hint">
                    Этап: {assignedStage.title || 'без названия'}
                  </p>
                ) : (
                  <p className="demo-tableau-studio-modal__hint">
                    {(isScanner || isNetwork) ? 'Для этого режима этап карты не требуется.' : 'Выберите этап — иначе карта будет пустой.'}
                  </p>
                )}

                <label className="demo-field">
                  <span className="demo-field__label">Вариант оформления</span>
                  <select
                    value={preset.variant || DEMO_TABLEAU_VARIANT.TABLET}
                    onChange={(e) => patchPreset({ variant: e.target.value })}
                  >
                    {DEMO_TABLEAU_VARIANTS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>

                {!isScanner && !isNetwork && <>
                {!isGallery ? (
                  <>
                <label className="demo-field">
                  <span className="demo-field__label">Перспектива ({tilt.perspective})</span>
                  <input
                    type="range"
                    min={400}
                    max={4000}
                    step={50}
                    value={tilt.perspective}
                    onChange={(e) => patchPreset({
                      tilt: { ...tilt, perspective: Number(e.target.value) },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Наклон X ({tilt.rotate_x}°)</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={1}
                    value={tilt.rotate_x}
                    onChange={(e) => patchPreset({
                      tilt: { ...tilt, rotate_x: Number(e.target.value) },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Поворот Z ({tilt.rotate_z}°)</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={tilt.rotate_z}
                    onChange={(e) => patchPreset({
                      tilt: { ...tilt, rotate_z: Number(e.target.value) },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Масштаб ({tilt.scale})</span>
                  <input
                    type="range"
                    min={0.4}
                    max={1.2}
                    step={0.01}
                    value={tilt.scale}
                    onChange={(e) => patchPreset({
                      tilt: { ...tilt, scale: Number(e.target.value) },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">
                    Смещение по высоте ({tilt.offset_y ?? 0}%)
                  </span>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={tilt.offset_y ?? 0}
                    onChange={(e) => patchPreset({
                      tilt: { ...tilt, offset_y: Number(e.target.value) },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Скругление карты ({borderRadius}px)</span>
                  <input
                    type="range"
                    min={0}
                    max={48}
                    step={1}
                    value={borderRadius}
                    onChange={(e) => patchPreset({
                      border_radius_px: Number(e.target.value),
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">
                    Наклон, мс ({preset.tilt_ms ?? DEMO_DEFAULT_TABLEAU_TILT_MS})
                  </span>
                  <input
                    type="number"
                    min={200}
                    max={5000}
                    step={50}
                    value={preset.tilt_ms ?? DEMO_DEFAULT_TABLEAU_TILT_MS}
                    onChange={(e) => patchPreset({ tilt_ms: Number(e.target.value) })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">
                    Возврат, мс ({preset.untilt_ms ?? DEMO_DEFAULT_TABLEAU_UNTILT_MS})
                  </span>
                  <input
                    type="number"
                    min={200}
                    max={5000}
                    step={50}
                    value={preset.untilt_ms ?? DEMO_DEFAULT_TABLEAU_UNTILT_MS}
                    onChange={(e) => patchPreset({ untilt_ms: Number(e.target.value) })}
                  />
                </label>
                  </>
                ) : null}

                <fieldset className="demo-inspector__group" disabled={readOnly}>
                  <legend>Карта / камера</legend>
                  <div className="demo-inspector__row">
                    <label className="demo-field">
                      <span className="demo-field__label">Широта</span>
                      <input
                        type="number"
                        min={-90}
                        max={90}
                        step={0.001}
                        value={camera.lat ?? ''}
                        onChange={(e) => patchPreset({
                          camera: {
                            ...camera,
                            mode: DEMO_CAMERA_MODE.FLY_TO,
                            lat: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })}
                      />
                    </label>
                    <label className="demo-field">
                      <span className="demo-field__label">Долгота</span>
                      <input
                        type="number"
                        min={-180}
                        max={180}
                        step={0.001}
                        value={camera.lng ?? ''}
                        onChange={(e) => patchPreset({
                          camera: {
                            ...camera,
                            mode: DEMO_CAMERA_MODE.FLY_TO,
                            lng: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })}
                      />
                    </label>
                  </div>
                  <label className="demo-field">
                    <span className="demo-field__label">Масштаб ({camera.zoom})</span>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={camera.zoom ?? 8}
                      onChange={(e) => patchPreset({
                        camera: {
                          ...camera,
                          mode: DEMO_CAMERA_MODE.FLY_TO,
                          zoom: Number(e.target.value),
                        },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">
                      Длительность камеры, мс ({camera.duration_ms})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={60000}
                      step={100}
                      value={camera.duration_ms ?? 1500}
                      onChange={(e) => patchPreset({
                        camera: {
                          ...camera,
                          mode: DEMO_CAMERA_MODE.FLY_TO,
                          duration_ms: Number(e.target.value),
                        },
                      })}
                    />
                  </label>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="demo-btn demo-btn--ghost"
                      onClick={() => {
                        const view = getMapView?.();
                        if (!view) return;
                        patchPreset({
                          camera: {
                            ...camera,
                            mode: DEMO_CAMERA_MODE.FLY_TO,
                            lat: view.lat,
                            lng: view.lng,
                            zoom: view.zoom,
                          },
                        });
                      }}
                    >
                      Взять с карты
                    </button>
                  ) : null}
                </fieldset>

                <fieldset className="demo-inspector__group" disabled={readOnly}>
                  <legend>Появление объектов</legend>
                  <label className="demo-field">
                    <span className="demo-field__label">
                      Время жизни, мс ({mapReveal.lifetime_ms})
                    </span>
                    <input
                      type="range"
                      min={500}
                      max={15000}
                      step={100}
                      value={mapReveal.lifetime_ms}
                      onChange={(e) => patchPreset({
                        map_reveal: {
                          ...mapReveal,
                          lifetime_ms: Number(e.target.value),
                        },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">
                      Пауза между появлениями, макс. мс ({mapReveal.spawn_gap_max_ms})
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={50}
                      value={mapReveal.spawn_gap_max_ms}
                      onChange={(e) => patchPreset({
                        map_reveal: {
                          ...mapReveal,
                          spawn_gap_min_ms: 0,
                          spawn_gap_max_ms: Number(e.target.value),
                        },
                      })}
                    />
                  </label>
                  <p className="demo-tableau-studio-modal__hint">
                    Объекты, события и зоны этапа появляются случайно с паузой до указанного
                    максимума и исчезают через время жизни.
                  </p>
                </fieldset>

                <label className="demo-field">
                  <span className="demo-field__label">Надпись</span>
                  <input
                    type="text"
                    value={caption.content || ''}
                    onChange={(e) => patchPreset({
                      caption: { ...caption, content: e.target.value },
                    })}
                    placeholder="Источники информации"
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Шрифт надписи</span>
                  <select
                    value={caption.font_family || DEMO_DEFAULT_TABLEAU_CAPTION.font_family}
                    onChange={(e) => patchPreset({
                      caption: { ...caption, font_family: e.target.value },
                    })}
                  >
                    {DEMO_TEXT_FONTS.map((font) => (
                      <option key={font.id} value={font.id}>{font.label}</option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Размер надписи</span>
                  <input
                    type="number"
                    min={10}
                    max={96}
                    step={1}
                    value={caption.font_size ?? DEMO_DEFAULT_TABLEAU_CAPTION.font_size}
                    onChange={(e) => patchPreset({
                      caption: { ...caption, font_size: Number(e.target.value) },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Толщина надписи</span>
                  <select
                    value={String(caption.font_weight ?? DEMO_DEFAULT_TABLEAU_CAPTION.font_weight)}
                    onChange={(e) => patchPreset({
                      caption: { ...caption, font_weight: Number(e.target.value) },
                    })}
                  >
                    {DEMO_TEXT_WEIGHTS.map((weight) => (
                      <option key={weight.id} value={weight.id}>{weight.label}</option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Цвет надписи</span>
                  <input
                    type="text"
                    value={caption.color || DEMO_DEFAULT_TABLEAU_CAPTION.color}
                    onChange={(e) => patchPreset({
                      caption: { ...caption, color: e.target.value },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Фон надписи</span>
                  <input
                    type="text"
                    value={caption.background || DEMO_DEFAULT_TABLEAU_CAPTION.background}
                    onChange={(e) => patchPreset({
                      caption: { ...caption, background: e.target.value },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Цвет рамки надписи</span>
                  <input
                    type="text"
                    value={caption.border?.color || DEMO_DEFAULT_TABLEAU_CAPTION.border.color}
                    onChange={(e) => patchPreset({
                      caption: {
                        ...caption,
                        border: { ...(caption.border || {}), color: e.target.value },
                      },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Толщина рамки</span>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={caption.border?.width ?? DEMO_DEFAULT_TABLEAU_CAPTION.border.width}
                    onChange={(e) => patchPreset({
                      caption: {
                        ...caption,
                        border: {
                          ...(caption.border || {}),
                          width: Number(e.target.value),
                        },
                      },
                    })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Пауза блоков, мс</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={50}
                    value={preset.card_stagger_ms}
                    onChange={(e) => patchPreset({ card_stagger_ms: Number(e.target.value) })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Отрисовка стрелки, мс</span>
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    step={50}
                    value={preset.arrow_draw_ms}
                    onChange={(e) => patchPreset({ arrow_draw_ms: Number(e.target.value) })}
                  />
                </label>
                </>}
              </fieldset>
            ) : null}
          </aside>

          <section className="demo-tableau-studio-modal__main">
            {!preset ? (
              <p className="demo-tableau-studio-modal__empty">Создайте пресет слева.</p>
            ) : isScanner ? (
              <div className="demo-scanner-preview">
                <DemoScannerLayer key={`${preset.id}-${JSON.stringify(preset.scanner)}`} scanner={preset.scanner} />
              </div>
            ) : isNetwork ? (
              <>
                <div className="demo-network-preview">
                  <DemoNetworkLayer key={`${preset.id}-${JSON.stringify(network.logos)}`} logos={network.logos} />
                </div>
                <DemoNetworkEditor
                  key={preset.id}
                  value={network}
                  onChange={(nextNetwork) => patchPreset({ network: nextNetwork })}
                  readOnly={readOnly}
                />
              </>
            ) : isVideo ? (
              <div className="demo-tableau-studio-modal__video-preview">
                {video.video_url ? (
                  <video
                    src={resolveMediaUrl(video.video_url)}
                    muted
                    controls
                    loop={video.loop !== false}
                    playsInline
                    style={{ objectFit: video.object_fit || 'cover' }}
                  />
                ) : (
                  <p className="demo-tableau-studio-modal__empty">Загрузите видео в инспекторе.</p>
                )}
                {caption.content ? <div className="demo-tableau-studio-modal__video-caption" style={{
                  left: `${caption.x}%`,
                  top: `${caption.y}%`,
                  fontFamily: caption.font_family || 'Roboto',
                  fontSize: `${caption.font_size ?? 17}px`,
                  fontWeight: caption.font_weight ?? 700,
                  color: caption.color || '#f8fafc',
                  background: caption.background || 'rgba(15, 23, 42, 0.82)',
                  border: `${caption.border?.width ?? 1}px solid ${caption.border?.color || 'rgba(255, 255, 255, 0.28)'}`,
                }}>{caption.content}</div> : null}
              </div>
            ) : (
              <>
                <div
                  ref={sceneRef}
                  className={[
                    'demo-tableau-studio-modal__scene',
                    isGallery && gallery.show_map === false ? 'is-gallery-nomap' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    perspective: `${tilt.perspective}px`,
                    aspectRatio: `${monitorAspect}`,
                  }}
                  onPointerDown={() => clearCellSelection()}
                >
                  <div className="demo-tableau-studio-modal__monitor-label" aria-hidden="true">
                    {`Граница экрана · ${monitorSize.w}×${monitorSize.h}`}
                  </div>
                  <div
                    className={[
                      'demo-tableau-studio-modal__map-guide',
                      isGallery && gallery.show_map === false ? 'is-nomap' : '',
                    ].filter(Boolean).join(' ')}
                    style={isGallery
                      ? {
                        left: '0%',
                        top: '0%',
                        width: '100%',
                        height: '100%',
                        borderRadius: 0,
                      }
                      : {
                        left: `${DEMO_TABLEAU_MAP_FRAME.left}%`,
                        top: `${DEMO_TABLEAU_MAP_FRAME.top + (tilt.offset_y ?? 0)}%`,
                        width: `${DEMO_TABLEAU_MAP_FRAME.width}%`,
                        height: `${DEMO_TABLEAU_MAP_FRAME.height}%`,
                        transform: `rotateX(${tilt.rotate_x}deg) rotateZ(${tilt.rotate_z}deg) scale(${tilt.scale})`,
                        borderRadius: `${borderRadius}px`,
                      }}
                    aria-hidden="true"
                  />

                  {caption.content ? (
                    <div
                      className="demo-tableau-studio-modal__caption"
                      style={{
                        left: `${caption.x}%`,
                        top: `${caption.y}%`,
                        fontFamily: caption.font_family || DEMO_DEFAULT_TABLEAU_CAPTION.font_family,
                        fontSize: `${(caption.font_size ?? DEMO_DEFAULT_TABLEAU_CAPTION.font_size) * previewScale}px`,
                        fontWeight: caption.font_weight ?? DEMO_DEFAULT_TABLEAU_CAPTION.font_weight,
                        color: caption.color || DEMO_DEFAULT_TABLEAU_CAPTION.color,
                        background: caption.background || DEMO_DEFAULT_TABLEAU_CAPTION.background,
                        border: `${(caption.border?.width ?? 1) * previewScale}px solid ${caption.border?.color || DEMO_DEFAULT_TABLEAU_CAPTION.border.color}`,
                        padding: `${10 * previewScale}px ${16 * previewScale}px`,
                        borderRadius: `${10 * previewScale}px`,
                      }}
                    >
                      {caption.content}
                    </div>
                  ) : null}

                  {isGallery ? (
                    <>
                      {(gallery.images || []).map((image, index) => {
                        const rect = galleryRects[index];
                        if (!rect) return null;
                        const src = resolveMediaUrl(image.src);
                        if (!src) return null;
                        const selected = selectedGalleryImage?.id === image.id;
                        return (
                          <figure
                            key={image.id}
                            className={[
                              'demo-tableau-studio-modal__gallery-frame',
                              selected ? 'is-selected' : '',
                              readOnly ? 'is-readonly' : '',
                            ].filter(Boolean).join(' ')}
                            style={{
                              left: `${rect.x}%`,
                              top: `${rect.y}%`,
                              width: `${rect.w}%`,
                              height: `${rect.h}%`,
                              zIndex: selected ? 20 : (rect.z ?? 0) + 1,
                              transform: `rotate(${rect.rotate || 0}deg)`,
                            }}
                            onPointerDown={(event) => {
                              if (readOnly) {
                                event.stopPropagation();
                                setSelection({ type: 'gallery-image', id: image.id });
                                return;
                              }
                              startGalleryPointerEdit('move', image, event, rect);
                            }}
                          >
                            <img src={src} alt={image.title || ''} draggable={false} />
                            {selected && !readOnly ? (
                              <span
                                className="demo-tableau-studio-modal__gallery-resize"
                                onPointerDown={(event) => startGalleryPointerEdit('resize', image, event, rect)}
                                title="Изменить размер"
                              />
                            ) : null}
                          </figure>
                        );
                      })}
                    </>
                  ) : (
                    <>
                  <div className="demo-tableau-studio-modal__grid" style={gridStyle}>
                    {cells.map((cell) => {
                      const block = cell.block_id
                        ? findTableauBlock(library.blocks, cell.block_id)
                        : null;
                      const isSelected = selectedCellIds.has(cell.id)
                        || (selection.type === 'cell' && selection.id === cell.id);
                      const isEmpty = !cell.block_id;
                      const isBridge = cell.role === 'bridge';
                      const spacerPct = isBridge ? bridgeSpacerPercent(overlay, cell) : 0;
                      const align = cellAlignStyle(cell);
                      const inner = block ? (
                        <DemoTableauBlockView
                          block={block}
                          style={{
                            width: `${cell.content_width ?? 100}%`,
                            height: '100%',
                          }}
                        />
                      ) : (
                        <div
                          className="demo-tableau-studio-modal__placement-missing"
                          style={{
                            width: `${cell.content_width ?? 100}%`,
                            height: '100%',
                          }}
                        >
                          {isBridge ? 'Мост' : 'Пусто'}
                        </div>
                      );
                      return (
                        <div
                          key={cell.id}
                          role="button"
                          tabIndex={0}
                          className={[
                            'demo-tableau-studio-modal__grid-cell',
                            isSelected ? 'is-selected' : '',
                            isBridge ? 'is-bridge' : '',
                            isEmpty ? 'is-empty' : '',
                          ].filter(Boolean).join(' ')}
                          style={{
                            gridColumn: `${cell.col + 1} / span ${cell.col_span || 1}`,
                            gridRow: `${cell.row + 1}`,
                            ...(spacerPct > 0
                              ? { flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch' }
                              : align),
                          }}
                          onPointerDown={(event) => handleCellClick(event, cell)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleCellClick(event, cell);
                            }
                          }}
                        >
                          {spacerPct > 0 ? (
                            <>
                              <div
                                className="demo-tableau-studio-modal__bridge-spacer"
                                style={{ height: `${spacerPct}%`, flexShrink: 0, width: '100%' }}
                                aria-hidden="true"
                              />
                              <div
                                className="demo-tableau-studio-modal__bridge-body"
                                style={{
                                  flex: 1,
                                  minHeight: 0,
                                  width: '100%',
                                  display: 'flex',
                                  ...align,
                                }}
                              >
                                {inner}
                              </div>
                            </>
                          ) : inner}
                        </div>
                      );
                    })}
                  </div>

                  <svg
                    className="demo-tableau-studio-modal__arrows"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {previewArrows.map((arrow) => {
                      const pts = arrow.points || [];
                      if (pts.length < 2) return null;
                      const drawn = arrow.head === 'end' || arrow.head === 'both'
                        ? shortenPolylineForHead(pts)
                        : pts;
                      const tip = pts[pts.length - 1];
                      const base = drawn[drawn.length - 1];
                      const dash = resolveArrowDash(arrow.line);
                      return (
                        <g key={arrow.id}>
                          <polyline
                            points={pointsToSvg(drawn)}
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            stroke={arrow.color}
                            strokeWidth={arrow.width ?? 1.5}
                            strokeDasharray={dash}
                          />
                          {(arrow.head === 'end' || arrow.head === 'both') ? (
                            <polygon
                              points={arrowHeadPoints(tip.x, tip.y, base.x, base.y)}
                              fill={arrow.color}
                            />
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                    </>
                  )}
                  <DemoCueMark value={preset.cue} size="sm" />
                </div>

                {!isGallery ? (
                <div className="demo-tableau-studio-modal__used" ref={paletteRef}>
                  <div className="demo-tableau-studio-modal__presets-head">
                    <h3>Ячейки сетки</h3>
                    {!readOnly ? (
                      <div className="demo-tableau-studio-modal__used-actions">
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          disabled={!canMakeBridge}
                          onClick={handleMakeBridge}
                          title="Объединить выбранные ячейки одного ряда в мост"
                        >
                          Сделать мостом
                        </button>
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          disabled={!bridgeCell}
                          onClick={handleRemoveBridge}
                        >
                          Убрать мост
                        </button>
                        <div className="demo-tableau-studio-modal__add-wrap">
                          <button
                            type="button"
                            className="demo-btn demo-btn--ghost"
                            onClick={() => setPaletteOpen((open) => !open)}
                            disabled={!selectedCell || !library.blocks.length}
                            title={
                              !selectedCell
                                ? 'Выберите ячейку'
                                : library.blocks.length
                                  ? undefined
                                  : 'Сначала создайте шаблоны в «Блоки…»'
                            }
                          >
                            Назначить блок
                          </button>
                          {paletteOpen && selectedCell ? (
                            <div
                              className="demo-tableau-studio-modal__palette-popover"
                              role="listbox"
                              aria-label="Палитра блоков"
                            >
                              {library.blocks.map((block) => (
                                <button
                                  key={block.id}
                                  type="button"
                                  className="demo-tableau-studio-modal__palette-item"
                                  role="option"
                                  onClick={() => handleAssignBlock(block)}
                                  title={block.title}
                                >
                                  <span className="demo-tableau-studio-modal__palette-thumb">
                                    <DemoTableauBlockView
                                      block={block}
                                      style={{ width: '100%', height: '100%' }}
                                    />
                                  </span>
                                  <span>{block.title}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          disabled={!selectedCell?.block_id}
                          onClick={handleClearBlock}
                        >
                          Очистить блок
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="demo-tableau-studio-modal__hint">
                    Клик — выбрать ячейку. Ctrl/Cmd+клик — несколько ячеек одного ряда для моста.
                  </p>
                </div>
                ) : null}
              </>
            )}
          </section>

          <aside className="demo-tableau-studio-modal__inspector">
            <h3>Инспектор</h3>
            {!preset ? (
              <p className="demo-tableau-studio-modal__empty">Создайте пресет слева.</p>
            ) : isScanner ? (
              <DemoScannerEditor key={preset.id} value={preset.scanner} onChange={(scanner) => patchPreset({ scanner })} readOnly={readOnly} />
            ) : isNetwork ? (
              <p className="demo-tableau-studio-modal__hint">
                Кнопки выбора логотипов находятся под превью.
              </p>
            ) : isVideo ? (
              <fieldset className="demo-inspector__group" disabled={readOnly}>
                <legend>Полноэкранное видео</legend>
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  hidden
                  onChange={handleVideoFile}
                />
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost"
                  disabled={galleryBusy}
                  onClick={() => videoFileRef.current?.click()}
                >
                  {galleryBusy ? 'Загрузка…' : (video.video_url ? 'Заменить видео' : 'Загрузить видео')}
                </button>
                {video.video_url ? (
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    onClick={() => patchVideo({ video_url: null, video_media_id: null })}
                  >
                    Убрать видео
                  </button>
                ) : null}
                <p className="demo-tableau-studio-modal__hint">MP4 или WebM, до 80 МБ. Надпись задаётся в общих настройках пресета.</p>
                <label className="demo-field">
                  <span className="demo-field__label">Заполнение экрана</span>
                  <select value={video.object_fit || 'cover'} onChange={(e) => patchVideo({ object_fit: e.target.value })}>
                    <option value="cover">Заполнить с обрезкой</option>
                    <option value="contain">Целиком, без обрезки</option>
                  </select>
                </label>
                <label className="demo-checkbox">
                  <input type="checkbox" checked={video.loop !== false} onChange={(e) => patchVideo({ loop: e.target.checked })} />
                  <span className="demo-checkbox__text">Повторять видео</span>
                </label>
              </fieldset>
            ) : isGallery ? (
              <fieldset className="demo-inspector__group" disabled={readOnly}>
                <legend>Галерея</legend>
                <input
                  ref={galleryFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handleGalleryFile}
                />
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost"
                  disabled={galleryBusy || (gallery.images || []).length >= DEMO_TABLEAU_GALLERY_MAX_IMAGES}
                  onClick={() => galleryFileRef.current?.click()}
                >
                  {galleryBusy ? 'Загрузка…' : 'Добавить изображение'}
                </button>
                <p className="demo-tableau-studio-modal__hint">
                  До {DEMO_TABLEAU_GALLERY_MAX_IMAGES} кадров. JPEG, PNG или WebP.
                  Перетаскивайте кадры на превью и меняйте размер за угол.
                </p>
                <label className="demo-checkbox">
                  <input
                    type="checkbox"
                    checked={gallery.show_map !== false}
                    onChange={(e) => patchGallery({ show_map: e.target.checked })}
                  />
                  <span className="demo-checkbox__text">Показывать карту</span>
                </label>
                <ul className="demo-tableau-gallery-studio__list">
                  {(gallery.images || []).map((image, index) => (
                    <li
                      key={image.id}
                      className={[
                        'demo-tableau-gallery-studio__item',
                        selectedGalleryImage?.id === image.id ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        setSelection({ type: 'gallery-image', id: image.id });
                        setSelectedCellIds(new Set());
                      }}
                    >
                      <img src={resolveMediaUrl(image.src)} alt="" />
                      <input
                        type="text"
                        value={image.title || ''}
                        placeholder="Подпись"
                        onChange={(e) => {
                          const images = (gallery.images || []).map((item) => (
                            item.id === image.id ? { ...item, title: e.target.value } : item
                          ));
                          patchGallery({ images });
                        }}
                      />
                      <div className="demo-tableau-gallery-studio__move">
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            const images = [...(gallery.images || [])];
                            [images[index - 1], images[index]] = [images[index], images[index - 1]];
                            patchGallery({ images });
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          disabled={index === (gallery.images || []).length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            const images = [...(gallery.images || [])];
                            [images[index + 1], images[index]] = [images[index], images[index + 1]];
                            patchGallery({ images });
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selection.id === image.id) {
                              setSelection({ type: null, id: null });
                            }
                            patchGallery({
                              images: (gallery.images || []).filter((item) => item.id !== image.id),
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {selectedGalleryImage ? (
                  <>
                    <p className="demo-tableau-studio-modal__hint">
                      Конечная позиция на экране. Можно также перетащить кадр на превью.
                    </p>
                    <div className="demo-tableau-gallery-studio__rest">
                      {['x', 'y', 'w', 'h'].map((key) => {
                        const labels = {
                          x: 'X (%)',
                          y: 'Y (%)',
                          w: 'Ширина (%)',
                          h: 'Высота (%)',
                        };
                        return (
                          <label key={key} className="demo-field">
                            <span className="demo-field__label">{labels[key]}</span>
                            <input
                              type="number"
                              min={key === 'w' || key === 'h' ? 4 : 0}
                              max={100}
                              step={0.5}
                              value={Number(
                                (selectedGalleryRect || selectedGalleryImage.rest)?.[key]
                              ) || 0}
                              onChange={(e) => {
                                const base = selectedGalleryRect || selectedGalleryImage.rest || {};
                                patchGalleryImageRest(selectedGalleryImage.id, {
                                  x: base.x,
                                  y: base.y,
                                  w: base.w,
                                  h: base.h,
                                  [key]: Number(e.target.value),
                                });
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                    {!assignedStage ? (
                      <p className="demo-tableau-studio-modal__hint">
                        Выберите этап слева, чтобы привязать кадр к объекту на карте.
                      </p>
                    ) : galleryTargetOptions.length === 0 ? (
                      <p className="demo-tableau-studio-modal__hint">
                        На выбранном этапе нет объектов. Добавьте шаг «Объекты» в этапе.
                      </p>
                    ) : (
                      <>
                        {galleryTargetCountries.length > 1 ? (
                          <label className="demo-field">
                            <span className="demo-field__label">Страна объекта</span>
                            <select
                              value={galleryTargetCountry}
                              onChange={(e) => setGalleryTargetCountry(e.target.value)}
                            >
                              <option value="">Все страны</option>
                              {galleryTargetCountries.map((country) => (
                                <option key={country} value={country}>{country}</option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className="demo-field">
                          <span className="demo-field__label">Поиск объекта</span>
                          <input
                            type="search"
                            value={galleryTargetQuery}
                            placeholder="Название объекта"
                            onChange={(e) => setGalleryTargetQuery(e.target.value)}
                          />
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Объект на карте</span>
                          <select
                            value={selectedGalleryImage.target_id || ''}
                            onChange={(e) => patchGalleryImage(
                              selectedGalleryImage.id,
                              { target_id: e.target.value || null },
                            )}
                          >
                            <option value="">Не выбран</option>
                            {visibleGalleryTargetOptions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.country ? `${item.label} · ${item.country}` : item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!filteredGalleryTargetOptions.length ? (
                          <p className="demo-tableau-studio-modal__hint">По заданным фильтрам объекты не найдены.</p>
                        ) : null}
                      </>
                    )}
                  </>
                ) : (
                  <p className="demo-tableau-studio-modal__hint">
                    Выберите кадр на превью или в списке, чтобы задать
                    конечные координаты и размер.
                  </p>
                )}
                <label className="demo-field">
                  <span className="demo-field__label">Вход</span>
                  <select
                    value={gallery.enter_effect}
                    onChange={(e) => patchGallery({ enter_effect: e.target.value })}
                  >
                    {DEMO_TABLEAU_GALLERY_ENTER_EFFECTS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Выход</span>
                  <select
                    value={gallery.exit_effect}
                    onChange={(e) => patchGallery({ exit_effect: e.target.value })}
                  >
                    {DEMO_TABLEAU_GALLERY_EXIT_EFFECTS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Раскладка после входа</span>
                  <select
                    value={gallery.settle}
                    onChange={(e) => {
                      const settle = e.target.value;
                      patchGallery({
                        settle,
                        images: bakeGalleryLayoutIntoRest(
                          gallery.images || [],
                          gallery,
                          settle,
                        ),
                      });
                    }}
                  >
                    {DEMO_TABLEAU_GALLERY_SETTLES.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Пауза между появлениями, мс</span>
                  <input
                    type="number"
                    min={0}
                    max={8000}
                    step={20}
                    value={gallery.stagger_ms}
                    onChange={(e) => patchGallery({ stagger_ms: Number(e.target.value) })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Длительность проявления, мс</span>
                  <input
                    type="number"
                    min={120}
                    max={2000}
                    step={20}
                    value={gallery.enter_ms}
                    onChange={(e) => patchGallery({ enter_ms: Number(e.target.value) })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Пауза в центре, мс</span>
                  <input
                    type="number"
                    min={0}
                    max={8000}
                    step={20}
                    value={gallery.hold_ms ?? 800}
                    onChange={(e) => patchGallery({ hold_ms: Number(e.target.value) })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Выход на позицию, мс</span>
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    step={20}
                    value={gallery.settle_ms}
                    onChange={(e) => patchGallery({ settle_ms: Number(e.target.value) })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Выход, мс</span>
                  <input
                    type="number"
                    min={80}
                    max={2000}
                    step={20}
                    value={gallery.exit_ms}
                    onChange={(e) => patchGallery({ exit_ms: Number(e.target.value) })}
                  />
                </label>
                {gallery.settle !== DEMO_TABLEAU_GALLERY_SETTLE.FREE ? (
                  ['x', 'y', 'width', 'height'].map((key) => {
                    const labels = {
                      x: 'Зона X (%)',
                      y: 'Зона Y (%)',
                      width: 'Ширина зоны (%)',
                      height: 'Высота зоны (%)',
                    };
                    return (
                      <label key={key} className="demo-field">
                        <span className="demo-field__label">{labels[key]}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={gallery.band?.[key] ?? 0}
                          onChange={(e) => patchGallery({
                            band: { ...gallery.band, [key]: Number(e.target.value) },
                          })}
                        />
                      </label>
                    );
                  })
                ) : null}
              </fieldset>
            ) : (
              <>
                <fieldset className="demo-inspector__group" disabled={readOnly}>
                  <legend>Сетка</legend>
                  <label className="demo-field">
                    <span className="demo-field__label">Столбцы ({overlay.cols})</span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={overlay.cols}
                      onChange={(e) => handleGridSizeChange(Number(e.target.value), overlay.rows)}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Ряды ({overlay.rows})</span>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={1}
                      value={overlay.rows}
                      onChange={(e) => handleGridSizeChange(overlay.cols, Number(e.target.value))}
                    />
                  </label>
                  {['x', 'width', 'height'].map((key) => {
                    const limits = {
                      x: [0, 100],
                      width: [10, 100],
                      height: [8, 95],
                    };
                    const [min, max] = limits[key];
                    const labels = {
                      x: 'X (%)',
                      width: 'Ширина (%)',
                      height: 'Высота (%)',
                    };
                    return (
                      <label key={key} className="demo-field">
                        <span className="demo-field__label">{labels[key]}</span>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={0.1}
                          value={overlay[key]}
                          onChange={(e) => patchOverlay({ [key]: Number(e.target.value) })}
                        />
                      </label>
                    );
                  })}
                  <label className="demo-field">
                    <span className="demo-field__label">
                      Отступ от верха экрана ({Number(overlay.y).toFixed(1)}%)
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={0.5}
                      value={overlay.y}
                      onChange={(e) => patchOverlay({ y: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Отступ от верха экрана (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      step={0.1}
                      value={overlay.y}
                      onChange={(e) => patchOverlay({ y: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Зазор столбцов (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      step={0.1}
                      value={overlay.column_gap ?? overlay.gap ?? 0}
                      onChange={(e) => patchOverlay({ column_gap: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Зазор рядов (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      step={0.1}
                      value={overlay.row_gap ?? overlay.gap ?? 0}
                      onChange={(e) => patchOverlay({ row_gap: Number(e.target.value) })}
                    />
                  </label>
                  {(overlay.row_heights || []).map((weight, index) => (
                    <label key={`row-h-${index}`} className="demo-field">
                      <span className="demo-field__label">
                        Высота ряда {index + 1} ({Number(weight).toFixed(1)})
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={10}
                        step={0.1}
                        value={weight}
                        onChange={(e) => {
                          const next = [...(overlay.row_heights || [])];
                          next[index] = Number(e.target.value);
                          patchOverlay({
                            row_heights: normalizeTableauRowHeights(next, overlay.rows),
                          });
                        }}
                      />
                    </label>
                  ))}
                  <label className="demo-field">
                    <span className="demo-field__label">
                      Отступ стрелки к карте ({mapArrow.inset})
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={mapArrow.inset}
                      onChange={(e) => patchOverlay({
                        map_arrow: { ...mapArrow, inset: Number(e.target.value) },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Линия</span>
                    <select
                      value={mapArrow.line}
                      onChange={(e) => patchOverlay({
                        map_arrow: { ...mapArrow, line: e.target.value },
                      })}
                    >
                      {DEMO_TABLEAU_ARROW_LINES.map((line) => (
                        <option key={line} value={line}>{line}</option>
                      ))}
                    </select>
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Толщина</span>
                    <input
                      type="number"
                      min={0.5}
                      max={8}
                      step={0.5}
                      value={mapArrow.width}
                      onChange={(e) => patchOverlay({
                        map_arrow: { ...mapArrow, width: Number(e.target.value) },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Цвет</span>
                    <ZoneColorPicker
                      value={mapArrow.color}
                      fallback="#f8fafc"
                      disabled={readOnly}
                      onChange={(color) => patchOverlay({
                        map_arrow: { ...mapArrow, color },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Наконечник</span>
                    <select
                      value={mapArrow.head}
                      onChange={(e) => patchOverlay({
                        map_arrow: { ...mapArrow, head: e.target.value },
                      })}
                    >
                      {DEMO_TABLEAU_ARROW_HEADS.map((head) => (
                        <option key={head} value={head}>{head}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>

                {selectedCell ? (
                  <fieldset className="demo-inspector__group" disabled={readOnly}>
                    <legend>
                      {selectedCell.role === 'bridge' ? 'Мост' : 'Ячейка'}
                    </legend>
                    <p className="demo-tableau-studio-modal__hint">
                      Ряд {selectedCell.row}, столбец {selectedCell.col}
                      {selectedCell.col_span > 1 ? ` · span ${selectedCell.col_span}` : ''}
                    </p>
                    <p className="demo-tableau-studio-modal__hint">
                      Блок: {selectedCellBlock?.title || (selectedCell.block_id ? 'не найден' : 'не назначен')}
                    </p>
                    <p className="demo-tableau-studio-modal__hint">
                      Блок выравнивается внутри ячейки сетки.
                    </p>
                    <label className="demo-field">
                      <span className="demo-field__label">По горизонтали</span>
                      <select
                        value={selectedCell.align_x || 'center'}
                        onChange={(e) => patchSelectedCell({ align_x: e.target.value })}
                      >
                        {DEMO_TABLEAU_CELL_ALIGNS.map((align) => (
                          <option key={align} value={align}>
                            {align === 'start' ? 'Начало' : align === 'end' ? 'Конец' : 'Центр'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="demo-field">
                      <span className="demo-field__label">По вертикали</span>
                      <select
                        value={selectedCell.align_y || 'center'}
                        onChange={(e) => patchSelectedCell({ align_y: e.target.value })}
                      >
                        {DEMO_TABLEAU_CELL_ALIGNS.map((align) => (
                          <option key={align} value={align}>
                            {align === 'start' ? 'Начало' : align === 'end' ? 'Конец' : 'Центр'}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedCell.role === 'bridge' ? (
                      <label className="demo-field">
                        <span className="demo-field__label">
                          Отступ сверху ({Math.round(selectedCell.offset_top ?? 0)}%)
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={40}
                          step={0.5}
                          value={selectedCell.offset_top ?? 0}
                          onChange={(e) => patchSelectedCell({
                            offset_top: Number(e.target.value),
                          })}
                        />
                      </label>
                    ) : null}
                    <label className="demo-field">
                      <span className="demo-field__label">
                        Ширина блока ({Math.round(selectedCell.content_width ?? 100)}%)
                      </span>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        step={1}
                        value={selectedCell.content_width ?? 100}
                        onChange={(e) => patchSelectedCell({
                          content_width: Number(e.target.value),
                        })}
                      />
                    </label>
                    <p className="demo-tableau-studio-modal__hint">
                      Высота рамки равна высоте ряда. Положение текста и изображений
                      внутри рамки задаётся в конструкторе блока.
                    </p>
                    {selectedCellIds.size > 1 ? (
                      <p className="demo-tableau-studio-modal__hint">
                        Выбрано ячеек: {selectedCellIds.size}
                      </p>
                    ) : null}
                    {!readOnly && selectedCell.block_id ? (
                      <button
                        type="button"
                        className="demo-btn demo-btn--ghost"
                        onClick={handleClearBlock}
                      >
                        Очистить блок
                      </button>
                    ) : null}
                  </fieldset>
                ) : (
                  <p className="demo-tableau-studio-modal__empty">
                    Выберите ячейку на сцене.
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
      </div>

      {blockStudioOpen && (
        <DemoTableauBlockStudioModal
          blocks={library.blocks}
          onChange={(blocks) => patchLibrary({ blocks })}
          onClose={() => setBlockStudioOpen(false)}
          readOnly={readOnly}
          canWrite={canWrite}
          onSave={handleSaveCurrentTableau}
          saveBusy={saveBusy}
          saveNotice={saveNotice}
          saveDisabled={saveDisabled}
        />
      )}
    </div>
  );
}
