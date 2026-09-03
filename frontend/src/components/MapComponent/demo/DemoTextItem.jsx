import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDemoTextAnimation,
  buildDemoTextStyles,
} from '../../../utils/demoTextStyle';

/**
 * Отрисовка одного текстового блока демонстрации.
 *
 * Слои разнесены намеренно: позиционирование, анимация входа/выхода и поворот
 * используют `transform`, поэтому каждому нужен собственный элемент — иначе
 * ключевые кадры затирали бы положение на карте.
 */
export default function DemoTextItem({
  text,
  fontScale = 1,
  phase = 'enter',
  anchorStyle = null,
  className = '',
  onPointerDown,
}) {
  const styles = useMemo(() => buildDemoTextStyles(text, { fontScale }), [text, fontScale]);
  const enter = useMemo(() => buildDemoTextAnimation(text?.enter, 'enter'), [text]);
  const exit = useMemo(() => buildDemoTextAnimation(text?.exit, 'exit'), [text]);

  const content = text?.content || '';
  const isTypewriter = phase !== 'exit' && text?.enter?.effect === 'typewriter';
  const [typedChars, setTypedChars] = useState(isTypewriter ? 0 : content.length);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isTypewriter) {
      setTypedChars(content.length);
      return undefined;
    }
    const total = content.length;
    const duration = Math.max(1, text?.enter?.duration_ms ?? 600);
    const delay = text?.enter?.delay_ms ?? 0;
    const startAt = performance.now() + delay;
    setTypedChars(0);

    const tick = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startAt) / duration));
      setTypedChars(Math.round(total * progress));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [content, isTypewriter, text]);

  const visibleContent = isTypewriter ? content.slice(0, typedChars) : content;
  const animation = phase === 'exit' ? exit : enter;
  const animationVars = phase === 'exit' ? { ...enter.vars, ...exit.vars } : enter.vars;
  const animKey = `${phase}-${text?.enter?.effect || 'none'}-${text?.exit?.effect || 'none'}`;

  return (
    <div
      className={`demo-text__anchor ${className}`.trim()}
      style={anchorStyle || undefined}
      onPointerDown={onPointerDown}
    >
      <div
        key={animKey}
        className={`demo-text__anim ${animation.className}`.trim()}
        style={animationVars}
      >
        <div
          className="demo-text__rotor"
          style={styles.rotation ? { transform: `rotate(${styles.rotation}deg)` } : undefined}
        >
          <div className="demo-text__box" style={styles.box}>
            <div className="demo-text__stack">
              {styles.useStrokeLayer && (
                <span className="demo-text__layer" style={styles.strokeLayer} aria-hidden="true">
                  {visibleContent}
                </span>
              )}
              <span className="demo-text__layer" style={styles.fill}>
                {visibleContent}
                {isTypewriter && typedChars < content.length && (
                  <span className="demo-text__caret" aria-hidden="true" />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
