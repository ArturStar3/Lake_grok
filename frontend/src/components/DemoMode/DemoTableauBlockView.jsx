import { useLayoutEffect, useRef, useState } from 'react';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './DemoTableauBlockView.css';

/**
 * Визуализация шаблона блока (элементы в % внутри блока).
 * Единый холст 1920×1080: размеры блока заданы в процентах от него.
 * Холст целиком вписывается в доступную рамку без изменения пропорций.
 * enableBlur — backdrop-filter (студия); в показе выключать: blur поверх 3D-карты дорог.
 */
export default function DemoTableauBlockView({
  block,
  className = '',
  style,
  enableBlur = true,
  children,
}) {
  const hostRef = useRef(null);
  const hasBlock = Boolean(block);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hasBlock]);
  if (!block) return null;
  const designWidth = (block.width || 22) * 19.2;
  const designHeight = (block.height || 28) * 10.8;
  const fit = Math.min(size.width / designWidth, size.height / designHeight);
  const scale = 1;
  const fill = block.fill || {};
  const border = block.border || {};
  const bg = fill.color || (enableBlur ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.82)');
  const borderColor = border.color || 'rgba(255,255,255,0.28)';
  const radiusPx = (block.border_radius_px ?? 12) * scale;
  const borderWidth = (border.width ?? 1) * scale;

  return (
    <div ref={hostRef} className={className} style={{ position: 'relative', ...style }}>
    <div
      className="demo-tableau-block"
      style={{
        borderRadius: `${radiusPx}px`,
        background: bg,
        opacity: fill.opacity == null ? 1 : fill.opacity,
        border: `${borderWidth}px solid ${borderColor}`,
        boxShadow: `0 ${12 * scale}px ${32 * scale}px rgba(0,0,0,0.35)`,
        ...(enableBlur ? { backdropFilter: 'blur(10px)' } : null),
        overflow: 'visible',
        position: 'absolute',
        width: `${designWidth}px`,
        height: `${designHeight}px`,
        left: `${(size.width - designWidth * fit) / 2}px`,
        top: `${(size.height - designHeight * fit) / 2}px`,
        transform: `scale(${fit})`,
        transformOrigin: 'top left',
      }}
    >
      {(block.elements || []).map((el) => {
        if (el.type === 'image') {
          const src = resolveMediaUrl(el.src);
          return (
            <div
              key={el.id}
              className="demo-tableau-block__el demo-tableau-block__el--image"
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.w}%`,
                height: `${el.h}%`,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                transformOrigin: 'center center',
              }}
            >
              {src ? (
                <img src={src} alt="" draggable={false} />
              ) : (
                <div className="demo-tableau-block__img-placeholder">Нет файла</div>
              )}
            </div>
          );
        }
        const styleObj = el.style || {};
        const fontSize = (styleObj.font_size ?? 14) * scale;
        const letterSpacing = (styleObj.letter_spacing ?? 0) * scale;
        const textStyle = {
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.w}%`,
          height: `${el.h}%`,
          fontFamily: styleObj.font_family || 'Roboto',
          fontSize: `${fontSize}px`,
          fontWeight: styleObj.font_weight ?? 600,
          fontStyle: styleObj.italic ? 'italic' : 'normal',
          textDecoration: styleObj.underline ? 'underline' : 'none',
          lineHeight: styleObj.line_height ?? 1.3,
          letterSpacing: `${letterSpacing}px`,
          textAlign: styleObj.text_align || 'left',
          color: styleObj.color || '#f8fafc',
          opacity: styleObj.opacity == null ? 1 : styleObj.opacity,
          transform: styleObj.rotation ? `rotate(${styleObj.rotation}deg)` : undefined,
          textShadow: styleObj.shadow?.enabled
            ? `${(styleObj.shadow.x || 0) * scale}px ${(styleObj.shadow.y || 0) * scale}px ${(styleObj.shadow.blur || 0) * scale}px ${styleObj.shadow.color || '#000'}`
            : undefined,
          WebkitTextStroke: styleObj.stroke?.enabled
            ? `${(styleObj.stroke.width || 1) * scale}px ${styleObj.stroke.color || '#000'}`
            : undefined,
        };
        return (
          <div
            key={el.id}
            className="demo-tableau-block__el demo-tableau-block__el--text"
            style={textStyle}
          >
            {(el.content || '').split('\n').map((line, i) => (
              <div key={`${el.id}-l${i}`}>{line || '\u00a0'}</div>
            ))}
          </div>
        );
      })}
      {children}
    </div>
    </div>
  );
}
