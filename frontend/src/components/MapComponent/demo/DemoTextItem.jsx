import { memo, useEffect, useMemo, useRef } from 'react';
import {
  buildDemoTextAnimation,
  buildDemoTextStyles,
} from '../../../utils/demoTextStyle';
import { registerDemoAnimation, unregisterDemoAnimation } from './demoRafDriver';

let typewriterSeq = 0;

/**
 * Отрисовка одного текстового блока демонстрации.
 *
 * Слои разнесены намеренно: позиционирование, анимация входа/выхода и поворот
 * используют `transform`, поэтому каждому нужен собственный элемент — иначе
 * ключевые кадры затирали бы положение на карте.
 *
 * Печатная машинка идёт через общий rAF-цикл и правит textContent напрямую:
 * рендер React на каждый кадр перерисовывал бы всё поддерево текста, включая
 * дублирующий слой обводки.
 */
function DemoTextItem({
  text,
  fontScale = 1,
  phase = 'enter',
  anchorStyle = null,
  className = '',
  anchorRef = null,
  onPointerDown,
}) {
  const styles = useMemo(() => buildDemoTextStyles(text, { fontScale }), [text, fontScale]);
  const enter = useMemo(() => buildDemoTextAnimation(text?.enter, 'enter'), [text]);
  const exit = useMemo(() => buildDemoTextAnimation(text?.exit, 'exit'), [text]);

  const content = text?.content || '';
  const isTypewriter = phase !== 'exit' && text?.enter?.effect === 'typewriter';

  const fillTextRef = useRef(null);
  const strokeTextRef = useRef(null);
  const caretRef = useRef(null);

  useEffect(() => {
    const paint = (value, caretVisible) => {
      if (fillTextRef.current) fillTextRef.current.textContent = value;
      if (strokeTextRef.current) strokeTextRef.current.textContent = value;
      if (caretRef.current) caretRef.current.style.display = caretVisible ? '' : 'none';
    };

    if (!isTypewriter) {
      paint(content, false);
      return undefined;
    }

    const total = content.length;
    const duration = Math.max(1, text?.enter?.duration_ms ?? 600);
    const delay = Math.max(0, text?.enter?.delay_ms ?? 0);
    const key = `demo-typewriter-${(typewriterSeq += 1)}`;

    let painted = -1;
    // Перерисовываем, только когда реально прибавился символ: при 20 знаках
    // за 600 мс это 20 обновлений DOM вместо ~36 кадров.
    const paintChars = (chars) => {
      if (chars === painted) return;
      painted = chars;
      paint(content.slice(0, chars), chars < total);
    };

    paintChars(0);

    registerDemoAnimation(key, {
      update: (elapsed) => {
        const progress = Math.min(1, Math.max(0, (elapsed - delay) / duration));
        paintChars(Math.round(total * progress));
        if (progress >= 1) unregisterDemoAnimation(key);
      },
    });

    return () => unregisterDemoAnimation(key);
  }, [content, isTypewriter, text]);

  const animation = phase === 'exit' ? exit : enter;
  const animationVars = phase === 'exit' ? { ...enter.vars, ...exit.vars } : enter.vars;
  const animKey = `${phase}-${text?.enter?.effect || 'none'}-${text?.exit?.effect || 'none'}`;

  return (
    <div
      ref={anchorRef}
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
                  <span ref={strokeTextRef}>{isTypewriter ? '' : content}</span>
                </span>
              )}
              <span className="demo-text__layer" style={styles.fill}>
                <span ref={fillTextRef}>{isTypewriter ? '' : content}</span>
                {isTypewriter && (
                  <span ref={caretRef} className="demo-text__caret" aria-hidden="true" />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(DemoTextItem);
