import { useEffect, useRef, useState } from 'react';
import { uploadDemoTableauMedia } from '../../api/demoScenarios';
import {
  DEMO_TEXT_ALIGNS,
  DEMO_TEXT_FONTS,
  DEMO_TEXT_WEIGHTS,
  createDefaultTableauBlock,
  createDefaultTableauImageElement,
  createDefaultTableauTextElement,
  findTableauBlock,
  normalizeTableauBlock,
} from '../../utils/demoScenario';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import DemoTableauBlockView from './DemoTableauBlockView.jsx';
import DemoStudioSaveActions from './DemoStudioSaveActions';
import './DemoTableauBlockStudioModal.css';

const MIN_SIZE = 4;

function clampPct(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function wrapRotation(deg) {
  let n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  while (n > 180) n -= 360;
  while (n < -180) n += 360;
  return Math.max(-180, Math.min(180, n));
}

/**
 * Вложенный редактор шаблонов блоков художественного режима.
 */
export default function DemoTableauBlockStudioModal({
  blocks = [],
  onChange,
  onClose,
  readOnly = false,
  canWrite = false,
  onSave,
  saveBusy = false,
  saveNotice = '',
  saveDisabled = false,
}) {
  const [blockId, setBlockId] = useState(blocks[0]?.id || null);
  const [elementId, setElementId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const blocksRef = useRef(blocks);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    if (blockId && findTableauBlock(blocks, blockId)) return;
    setBlockId(blocks[0]?.id || null);
    setElementId(null);
  }, [blocks, blockId]);

  const block = findTableauBlock(blocks, blockId) || blocks[0] || null;
  const element = (block?.elements || []).find((item) => item.id === elementId) || null;

  const emitBlocks = (nextBlocks) => {
    blocksRef.current = nextBlocks;
    onChange?.(nextBlocks);
  };

  const patchBlock = (partial) => {
    if (!block || readOnly) return;
    const next = normalizeTableauBlock({ ...block, ...partial });
    emitBlocks(blocks.map((item) => (item.id === block.id ? next : item)));
    setBlockId(next.id);
  };

  const patchElement = (partial) => {
    if (!block || !element || readOnly) return;
    const elements = (block.elements || []).map((item) => {
      if (item.id !== element.id) return item;
      if (partial.style && item.type === 'text') {
        return {
          ...item,
          ...partial,
          style: { ...(item.style || {}), ...partial.style },
        };
      }
      return { ...item, ...partial };
    });
    patchBlock({ elements });
  };

  const handleAddBlock = () => {
    if (readOnly) return;
    const next = createDefaultTableauBlock({
      title: `Блок ${blocks.length + 1}`,
    });
    emitBlocks([...blocks, next]);
    setBlockId(next.id);
    setElementId(null);
    setError(null);
  };

  const handleDeleteBlock = () => {
    if (!block || readOnly) return;
    const next = blocks.filter((item) => item.id !== block.id);
    emitBlocks(next);
    const first = next[0] || null;
    setBlockId(first?.id || null);
    setElementId(null);
  };

  const handleAddText = () => {
    if (!block || readOnly) return;
    const next = createDefaultTableauTextElement({
      content: 'Текст',
      y: 8 + ((block.elements?.length || 0) % 5) * 12,
    });
    patchBlock({ elements: [...(block.elements || []), next] });
    setElementId(next.id);
  };

  const handleAddImageClick = () => {
    if (!block || readOnly || uploading) return;
    fileInputRef.current?.click();
  };

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !block || readOnly) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadDemoTableauMedia(file);
      const src = data?.url || '';
      const next = createDefaultTableauImageElement({
        src,
        y: 8 + ((block.elements?.length || 0) % 4) * 14,
      });
      const currentBlocks = blocksRef.current || [];
      const currentBlock = findTableauBlock(currentBlocks, block.id) || block;
      const elements = [...(currentBlock.elements || []), next];
      const normalized = normalizeTableauBlock({ ...currentBlock, elements });
      emitBlocks(currentBlocks.map((item) => (item.id === currentBlock.id ? normalized : item)));
      setElementId(next.id);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось загрузить изображение');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteElement = () => {
    if (!block || !element || readOnly) return;
    const elements = (block.elements || []).filter((item) => item.id !== element.id);
    patchBlock({ elements });
    setElementId(null);
  };

  const startPointerEdit = (mode, targetElement, event) => {
    if (readOnly || !block || !targetElement) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setElementId(targetElement.id);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const originX = event.clientX;
    const originY = event.clientY;
    const orig = {
      x: targetElement.x,
      y: targetElement.y,
      w: targetElement.w,
      h: targetElement.h,
      rotation: targetElement.rotation || 0,
    };

    const blockKey = block.id;
    const centerX = rect.left + ((orig.x + orig.w / 2) / 100) * rect.width;
    const centerY = rect.top + ((orig.y + orig.h / 2) / 100) * rect.height;
    const startAngle = Math.atan2(originY - centerY, originX - centerX);

    const onMove = (ev) => {
      let next;
      if (mode === 'rotate') {
        const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
        let deg = orig.rotation + ((angle - startAngle) * 180) / Math.PI;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        next = { rotation: wrapRotation(deg) };
      } else if (mode === 'resize') {
        const dx = ((ev.clientX - originX) / rect.width) * 100;
        const dy = ((ev.clientY - originY) / rect.height) * 100;
        next = {
          w: clampPct(orig.w + dx, MIN_SIZE, 100 - orig.x),
          h: clampPct(orig.h + dy, MIN_SIZE, 100 - orig.y),
        };
      } else {
        const dx = ((ev.clientX - originX) / rect.width) * 100;
        const dy = ((ev.clientY - originY) / rect.height) * 100;
        next = {
          x: clampPct(orig.x + dx, 0, 100 - orig.w),
          y: clampPct(orig.y + dy, 0, 100 - orig.h),
        };
      }
      const currentBlocks = blocksRef.current || [];
      const currentBlock = findTableauBlock(currentBlocks, blockKey);
      if (!currentBlock) return;
      const elements = (currentBlock.elements || []).map((item) => (
        item.id === targetElement.id ? { ...item, ...next } : item
      ));
      const normalized = normalizeTableauBlock({ ...currentBlock, elements });
      emitBlocks(currentBlocks.map((item) => (item.id === blockKey ? normalized : item)));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const fill = block?.fill || {};
  const border = block?.border || {};
  const textStyle = element?.type === 'text' ? (element.style || {}) : {};
  const aspectW = block?.width || 22;
  const aspectH = block?.height || 28;

  return (
    <div className="demo-tableau-block-studio-modal" role="dialog" aria-modal="true">
      <div className="demo-tableau-block-studio-modal__panel">
        <header className="demo-tableau-block-studio-modal__header">
          <div>
            <h2>Конструктор блоков</h2>
            <p className="demo-tableau-block-studio-modal__hint">
              Шаблоны блоков: текст и картинки с перетаскиванием на холсте.
            </p>
          </div>
          <div className="demo-tableau-block-studio-modal__header-actions">
            <DemoStudioSaveActions
              canWrite={canWrite}
              onSave={onSave}
              busy={saveBusy}
              notice={saveNotice}
              disabled={saveDisabled}
            />
            <button type="button" className="demo-btn" onClick={onClose}>
              Готово
            </button>
          </div>
        </header>

        {error ? (
          <div className="demo-tableau-block-studio-modal__error" role="alert">
            {error}
            <button type="button" className="demo-btn demo-btn--ghost" onClick={() => setError(null)}>
              Закрыть
            </button>
          </div>
        ) : null}

        <div className="demo-tableau-block-studio-modal__body">
          <aside className="demo-tableau-block-studio-modal__list">
            <div className="demo-tableau-block-studio-modal__list-head">
              <h3>Блоки</h3>
              {!readOnly ? (
                <button type="button" className="demo-btn demo-btn--ghost" onClick={handleAddBlock}>
                  + Блок
                </button>
              ) : null}
            </div>
            {blocks.length ? (
              <ul>
                {blocks.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === block?.id ? 'is-active' : ''}
                      onClick={() => {
                        setBlockId(item.id);
                        setElementId(null);
                      }}
                    >
                      {item.title || 'Блок'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="demo-tableau-block-studio-modal__empty">Библиотека пуста — добавьте блок.</p>
            )}
            {!readOnly && block ? (
              <button type="button" className="demo-btn demo-btn--ghost" onClick={handleDeleteBlock}>
                Удалить блок
              </button>
            ) : null}
          </aside>

          <section className="demo-tableau-block-studio-modal__canvas">
            {!block ? (
              <p className="demo-tableau-block-studio-modal__empty">Создайте блок слева.</p>
            ) : (
              <div className="demo-tableau-block-studio-modal__artboard">
                <div
                  ref={canvasRef}
                  className="demo-tableau-block-studio-modal__artboard-inner"
                  style={{
                    aspectRatio: `${aspectW} / ${aspectH}`,
                    ['--block-w']: aspectW,
                    ['--block-h']: aspectH,
                  }}
                  onPointerDown={() => setElementId(null)}
                >
                  <DemoTableauBlockView
                    block={block}
                    className="demo-tableau-block-studio-modal__block"
                    style={{ width: '100%', height: '100%' }}
                  >
                    {(block.elements || []).map((el) => {
                      const selected = el.id === element?.id;
                      return (
                        <div
                          key={`hit-${el.id}`}
                          className={[
                            'demo-tableau-block-studio-modal__hit',
                            selected ? 'is-selected' : '',
                            readOnly ? 'is-readonly' : '',
                          ].filter(Boolean).join(' ')}
                          style={{
                            left: `${el.x}%`,
                            top: `${el.y}%`,
                            width: `${el.w}%`,
                            height: `${el.h}%`,
                            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                            transformOrigin: 'center center',
                          }}
                          onPointerDown={(event) => {
                            if (readOnly) {
                              event.stopPropagation();
                              setElementId(el.id);
                              return;
                            }
                            startPointerEdit('move', el, event);
                          }}
                        >
                          {selected && !readOnly ? (
                            <>
                              {el.type === 'image' ? (
                                <span
                                  className="demo-tableau-block-studio-modal__rotate"
                                  onPointerDown={(event) => startPointerEdit('rotate', el, event)}
                                  title="Повернуть"
                                />
                              ) : null}
                              <span
                                className="demo-tableau-block-studio-modal__resize"
                                onPointerDown={(event) => startPointerEdit('resize', el, event)}
                                title="Изменить размер"
                              />
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </DemoTableauBlockView>
                </div>
              </div>
            )}
          </section>

          <aside className="demo-tableau-block-studio-modal__inspector">
            {block ? (
              <>
                <fieldset className="demo-inspector__group" disabled={readOnly}>
                  <legend>Блок</legend>
                  <label className="demo-field">
                    <span className="demo-field__label">Название</span>
                    <input
                      type="text"
                      value={block.title || ''}
                      onChange={(e) => patchBlock({ title: e.target.value })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Ширина ({Math.round(block.width)}%)</span>
                    <input
                      type="range"
                      min={8}
                      max={80}
                      step={0.5}
                      value={block.width}
                      onChange={(e) => patchBlock({ width: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Высота ({Math.round(block.height)}%)</span>
                    <input
                      type="range"
                      min={8}
                      max={70}
                      step={0.5}
                      value={block.height}
                      onChange={(e) => patchBlock({ height: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Скругление ({block.border_radius_px ?? 12}px)</span>
                    <input
                      type="range"
                      min={0}
                      max={48}
                      step={1}
                      value={block.border_radius_px ?? 12}
                      onChange={(e) => patchBlock({ border_radius_px: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Заливка</span>
                    <input
                      type="text"
                      value={fill.color || ''}
                      onChange={(e) => patchBlock({ fill: { ...fill, color: e.target.value } })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Непрозрачность заливки ({fill.opacity ?? 1})</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={fill.opacity ?? 1}
                      onChange={(e) => patchBlock({
                        fill: { ...fill, opacity: Number(e.target.value) },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Цвет рамки</span>
                    <input
                      type="text"
                      value={border.color || ''}
                      onChange={(e) => patchBlock({ border: { ...border, color: e.target.value } })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Толщина рамки ({border.width ?? 1}px)</span>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={0.5}
                      value={border.width ?? 1}
                      onChange={(e) => patchBlock({
                        border: { ...border, width: Number(e.target.value) },
                      })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Непрозрачность рамки ({border.opacity ?? 1})</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={border.opacity ?? 1}
                      onChange={(e) => patchBlock({
                        border: { ...border, opacity: Number(e.target.value) },
                      })}
                    />
                  </label>
                </fieldset>

                {!readOnly ? (
                  <div className="demo-tableau-block-studio-modal__add-row">
                    <button type="button" className="demo-btn demo-btn--ghost" onClick={handleAddText}>
                      + Текст
                    </button>
                    <button
                      type="button"
                      className="demo-btn demo-btn--ghost"
                      disabled={uploading}
                      onClick={handleAddImageClick}
                    >
                      {uploading ? 'Загрузка…' : '+ Картинка'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImageFile}
                    />
                  </div>
                ) : null}

                {element ? (
                  <fieldset className="demo-inspector__group" disabled={readOnly}>
                    <legend>
                      {element.type === 'image' ? 'Картинка' : 'Текст'}
                    </legend>
                    {element.type === 'text' ? (
                      <>
                        <label className="demo-field">
                          <span className="demo-field__label">Содержимое</span>
                          <textarea
                            rows={4}
                            value={element.content || ''}
                            onChange={(e) => patchElement({ content: e.target.value })}
                          />
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Шрифт</span>
                          <select
                            value={textStyle.font_family || 'Roboto'}
                            onChange={(e) => patchElement({
                              style: { font_family: e.target.value },
                            })}
                          >
                            {DEMO_TEXT_FONTS.map((font) => (
                              <option key={font.id} value={font.id}>{font.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Размер ({textStyle.font_size ?? 14}px)</span>
                          <input
                            type="range"
                            min={8}
                            max={72}
                            step={1}
                            value={textStyle.font_size ?? 14}
                            onChange={(e) => patchElement({
                              style: { font_size: Number(e.target.value) },
                            })}
                          />
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Начертание</span>
                          <select
                            value={textStyle.font_weight ?? 600}
                            onChange={(e) => patchElement({
                              style: { font_weight: Number(e.target.value) },
                            })}
                          >
                            {DEMO_TEXT_WEIGHTS.map((weight) => (
                              <option key={weight.id} value={weight.id}>{weight.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Выравнивание</span>
                          <select
                            value={textStyle.text_align || 'left'}
                            onChange={(e) => patchElement({
                              style: { text_align: e.target.value },
                            })}
                          >
                            {DEMO_TEXT_ALIGNS.map((align) => (
                              <option key={align.id} value={align.id}>{align.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Цвет</span>
                          <input
                            type="text"
                            value={textStyle.color || ''}
                            onChange={(e) => patchElement({
                              style: { color: e.target.value },
                            })}
                          />
                        </label>
                        <label className="demo-field demo-field--check">
                          <input
                            type="checkbox"
                            checked={Boolean(textStyle.italic)}
                            onChange={(e) => patchElement({
                              style: { italic: e.target.checked },
                            })}
                          />
                          <span>Курсив</span>
                        </label>
                        <label className="demo-field demo-field--check">
                          <input
                            type="checkbox"
                            checked={Boolean(textStyle.underline)}
                            onChange={(e) => patchElement({
                              style: { underline: e.target.checked },
                            })}
                          />
                          <span>Подчёркивание</span>
                        </label>
                        <label className="demo-field demo-field--check">
                          <input
                            type="checkbox"
                            checked={Boolean(textStyle.stroke?.enabled)}
                            onChange={(e) => patchElement({
                              style: {
                                stroke: {
                                  ...(textStyle.stroke || {}),
                                  enabled: e.target.checked,
                                },
                              },
                            })}
                          />
                          <span>Обводка</span>
                        </label>
                        <label className="demo-field demo-field--check">
                          <input
                            type="checkbox"
                            checked={Boolean(textStyle.shadow?.enabled)}
                            onChange={(e) => patchElement({
                              style: {
                                shadow: {
                                  ...(textStyle.shadow || {}),
                                  enabled: e.target.checked,
                                },
                              },
                            })}
                          />
                          <span>Тень</span>
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="demo-field">
                          <span className="demo-field__label">Источник</span>
                          <input
                            type="text"
                            readOnly
                            value={element.src || ''}
                            title={resolveMediaUrl(element.src) || ''}
                          />
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">
                            Поворот ({Math.round(element.rotation || 0)}°)
                          </span>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            step={1}
                            value={element.rotation || 0}
                            onChange={(e) => patchElement({
                              rotation: wrapRotation(Number(e.target.value)),
                            })}
                          />
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Ширина ({Math.round(element.w)}%)</span>
                          <input
                            type="range"
                            min={MIN_SIZE}
                            max={100}
                            step={0.5}
                            value={element.w}
                            onChange={(e) => patchElement({
                              w: clampPct(Number(e.target.value), MIN_SIZE, 100 - element.x),
                            })}
                          />
                        </label>
                        <label className="demo-field">
                          <span className="demo-field__label">Высота ({Math.round(element.h)}%)</span>
                          <input
                            type="range"
                            min={MIN_SIZE}
                            max={100}
                            step={0.5}
                            value={element.h}
                            onChange={(e) => patchElement({
                              h: clampPct(Number(e.target.value), MIN_SIZE, 100 - element.y),
                            })}
                          />
                        </label>
                      </>
                    )}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="demo-btn demo-btn--ghost"
                        onClick={handleDeleteElement}
                      >
                        Удалить элемент
                      </button>
                    ) : null}
                  </fieldset>
                ) : (
                  <p className="demo-tableau-block-studio-modal__empty">
                    Выберите элемент на холсте или добавьте текст/картинку.
                  </p>
                )}
              </>
            ) : (
              <p className="demo-tableau-block-studio-modal__empty">Выберите блок.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
