import { useEffect, useMemo, useRef, useState } from 'react';
import { advanceScanner, createScannerState, documentLength, normalizeScanner } from '../../utils/demoScanner';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './DemoScanner.css';

const GLYPHS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789';

function DocumentText({ document, revealed, effect, tick }) {
  let offset = 0;
  const paragraph = (block, key) => {
    const start = offset;
    const runs = (block.runs || []).map((run, index) => {
      const chars = Array.from(run.text);
      const available = Math.max(0, Math.min(chars.length, Math.floor(revealed) - offset));
      const active = revealed >= offset && revealed < offset + chars.length;
      offset += chars.length;
      const tail = active && effect === 'scramble' ? Math.min(5, chars.length - available) : 0;
      return <span key={index} style={run.style}>
        {chars.slice(0, Math.max(0, available - (effect === 'letters' ? 1 : 0))).join('')}
        {effect === 'letters' && available > 0 && <span key={available} className="demo-scanner__letter">{chars[available - 1]}</span>}
        {active && <span data-scan-cursor="true" className={effect === 'typewriter' ? 'demo-scanner__caret' : ''} />}
        {tail > 0 && <span className="demo-scanner__scramble">{chars.slice(available, available + tail).map((char, i) => /\s/.test(char) ? char : GLYPHS[(Math.floor(tick / 65) + i * 7) % GLYPHS.length]).join('')}</span>}
        <span style={{ visibility: 'hidden' }}>{chars.slice(available + tail).join('')}</span>
      </span>;
    });
    return <p key={key} style={{ ...block.style, visibility: revealed > start ? 'visible' : 'hidden' }}>{runs.length ? runs : <br />}</p>;
  };
  return document.blocks.map((block, index) => block.type === 'table'
    ? <table key={index} style={{ visibility: revealed > offset ? 'visible' : 'hidden' }}><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell.map((p, n) => paragraph(p, n))}</td>)}</tr>)}</tbody></table>
    : paragraph(block, index));
}

export default function DemoScannerLayer({ scanner, playing = true }) {
  const config = useMemo(() => normalizeScanner(scanner), [scanner]);
  const [state, setState] = useState(() => createScannerState(config));
  const queueRef = useRef(null);
  const paperRef = useRef(null);
  const visibleRef = useRef(3);
  const length = useMemo(() => documentLength(config.document), [config.document]);
  const complete = state.draining && !state.cards.length;
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const queue = queueRef.current;
    const observer = new ResizeObserver(() => {
      const height = queue.clientHeight;
      visibleRef.current = Math.max(1, Math.ceil(height / (Math.max(120, height * 0.23) + 18)));
    });
    observer.observe(queue);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || complete || !length || !config.images.length) return undefined;
    let raf;
    let last = performance.now();
    const frame = (now) => {
      const delta = now - last;
      if (delta >= 32) {
        last = now;
        // Hidden tabs do not complete scans or skip the visual handoff.
        if (!document.hidden) setState((prev) => advanceScanner(prev, config, Math.min(delta, 80), visibleRef.current, length, reduced));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [complete, config, length, playing, reduced]);

  useEffect(() => {
    const paper = paperRef.current;
    const cursor = paper?.querySelector('[data-scan-cursor]');
    if (!cursor) return;
    const rect = cursor.getBoundingClientRect();
    const viewport = paper.getBoundingClientRect();
    if (rect.bottom > viewport.bottom - 70 || rect.top < viewport.top) {
      paper.scrollTo({ top: paper.scrollTop + rect.top - viewport.top - paper.clientHeight * 0.55, behavior: reduced ? 'instant' : 'smooth' });
    }
  }, [state.delivered, state.revealed, reduced]);

  return <div className={`demo-scanner ${!playing ? 'is-paused' : ''} ${reduced ? 'is-reduced' : ''}`}>
    <header className="demo-scanner__header"><span>INFOLAKE <b>/</b> ДОКУМЕНТЫ</span><span>{complete ? 'ОБРАБОТКА ЗАВЕРШЕНА' : state.draining ? 'ФИНАЛЬНЫЙ ПЕРЕНОС' : 'СИНТЕЗ ДОКУМЕНТА'}</span></header>
    <div className="demo-scanner__workspace">
      <section className="demo-scanner__source">
        <div className="demo-scanner__label">01 / ИСТОЧНИКИ <span>{state.delivered} / {config.images.length}</span></div>
        <div className="demo-scanner__queue" ref={queueRef}>
          {state.cards.map((card, index) => {
            const scanEnd = card.scanEnd || card.down + card.up;
            const progress = card.elapsed < card.down ? card.elapsed / card.down : 1 - (card.elapsed - card.down) / card.up;
            const flight = card.phase === 'fly' ? Math.min(1, (card.elapsed - scanEnd) / 900) : 0;
            const collapse = card.phase === 'collapse' ? Math.min(1, (card.elapsed - card.flyEnd) / 500) : 0;
            return <div key={card.id} className="demo-scanner__slot" style={{ '--collapse': collapse }}>
              <div className={`demo-scanner__card is-${card.phase}`} style={{ transform: flight ? `translate(${flight * 220}%, ${-flight * 35}px) scale(${1 - flight * 0.78}) rotate(${flight * 8}deg)` : undefined, opacity: card.phase === 'collapse' ? 0 : 1 - flight * 0.9 }}>
                <img src={resolveMediaUrl(card.src)} alt={card.title || 'Документ'} onError={(e) => { e.currentTarget.style.opacity = 0.15; }} />
                <div className="demo-scanner__card-caption"><span>{card.title || 'Документ'}</span><span>{card.phase === 'scan' ? 'СКАНИРОВАНИЕ' : 'ПЕРЕНОС'}</span></div>
                {card.phase === 'scan' && index < visibleRef.current && <div className="demo-scanner__beam" style={{ top: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />}
              </div>
            </div>;
          })}
        </div>
      </section>
      <section className="demo-scanner__output">
        <div className="demo-scanner__label">02 / РЕЗУЛЬТАТ <span>{Math.floor(length ? state.revealed / length * 100 : 0)}%</span></div>
        <div ref={paperRef} className="demo-scanner__paper-scroll">
          <article className="demo-scanner__paper" aria-label={config.document.name || 'Результат сканирования'}>
            <div className="demo-scanner__paper-meta">INFOLAKE / {config.document.name || 'ДОКУМЕНТ'}</div>
            <DocumentText document={config.document} revealed={state.revealed} effect={config.effect} tick={state.tick} />
          </article>
        </div>
        <div className="demo-scanner__progress"><i style={{ width: `${length ? state.revealed / length * 100 : 0}%` }} /></div>
      </section>
    </div>
    {(!length || !config.images.length) && <div className="demo-scanner__empty">Добавьте изображения и загрузите DOCX в настройках сцены.</div>}
    <footer className="demo-scanner__footer" role="status"><span>{complete ? 'Документ сформирован' : state.draining ? 'Текст сформирован · завершается перенос источников' : !playing ? 'Пауза' : 'Сканирование → перенос → заполнение'}</span><span>{config.images.length} источников · {length.toLocaleString('ru-RU')} символов</span></footer>
  </div>;
}
