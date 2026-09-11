import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './DemoNetwork.css';

const POSITIONS = ['top', 'left', 'right'];
const VERTICES = [[50, 18], [19, 76], [81, 76]];
// Use the same coordinates for logos and arrows, with room for visible arrowheads.
const FLOWS = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]].map(([from, to]) => {
  const a = VERTICES[from];
  const b = VERTICES[to];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length;
  const dy = (b[1] - a[1]) / length;
  const start = [a[0] + dx * 11 - dy * 1.8, a[1] + dy * 11 + dx * 1.8];
  const end = [b[0] - dx * 11 - dy * 1.8, b[1] - dy * 11 + dx * 1.8];
  return { id: `${from}-${to}`, path: `M${start.join(' ')} L${end.join(' ')}` };
});

export default function DemoNetworkLayer({ logos = [], playing = true }) {
  const svgRef = useRef(null);
  const id = useId().replace(/:/g, '');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const visibleLogos = useMemo(() => Array.from({ length: 3 }, (_, index) => logos[index] || null), [logos]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (playing && !reduced) svgRef.current?.unpauseAnimations();
    else svgRef.current?.pauseAnimations();
  }, [playing, reduced]);

  return <div className={`demo-network ${!playing ? 'is-paused' : ''} ${reduced ? 'is-reduced' : ''}`}>
    <div className="demo-network__stage">
      <div className="demo-network__scene">
      <svg ref={svgRef} className="demo-network__links" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <filter id={`${id}-glow`} x="-100%" y="-300%" width="300%" height="700%"><feGaussianBlur stdDeviation=".45" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <linearGradient id={`${id}-trail`} gradientUnits="userSpaceOnUse" x1="-7" y1="0" x2="0" y2="0"><stop stopColor="#57ddfa" stopOpacity="0" /><stop offset=".65" stopColor="#74f5dc" stopOpacity=".6" /><stop offset="1" stopColor="#fff" /></linearGradient>
          {[0, 1].map((tone) => <marker key={tone} id={`${id}-arrow-${tone}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="2.4" markerHeight="2.4" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 L8 4 L0 8 L2 4 Z" fill={tone ? '#6fc8fb' : '#77ead5'} /></marker>)}
        </defs>
        {FLOWS.map((flow, index) => <path key={flow.id} className={`demo-network__edge ${index % 2 ? 'demo-network__edge--alt' : ''}`} d={flow.path} markerEnd={`url(#${id}-arrow-${index % 2})`} />)}
        {!reduced && FLOWS.map((flow, index) => <g key={`spark-${flow.id}`}>
          <animateMotion dur={`${2.2 + (index % 3) * .25}s`} begin={`${-index * .43}s`} repeatCount="indefinite" path={flow.path} rotate="auto" />
          <g className="demo-network__spark" style={{ animationDelay: `${-index * .17}s` }} filter={`url(#${id}-glow)`}>
            <path d="M-7 0 L0 0" stroke={`url(#${id}-trail)`} strokeWidth=".7" strokeLinecap="round" />
            <path d="M-5 -.5 L-2 -.22 M-4 .6 L-1 .25" stroke="#82eaff" strokeWidth=".16" />
            <ellipse rx=".85" ry=".38" fill="#9df9ec" />
            <circle r=".32" fill="#fff" />
            <path d="M-.9 0 H.9 M0 -.9 V.9" stroke="#fff" strokeWidth=".12" />
            <circle className="demo-network__ember" cx="-2.5" cy=".8" r=".18" fill="#b2f5ff" />
            <circle className="demo-network__ember demo-network__ember--alt" cx="-4" cy="-.65" r=".15" fill="#77f5d6" />
          </g>
        </g>)}
      </svg>
      {visibleLogos.map((logo, index) => <article key={index} className={`demo-network__node demo-network__node--${POSITIONS[index]} ${logo?.src ? '' : 'is-empty'}`} style={{ left: `${VERTICES[index][0]}%`, top: `${VERTICES[index][1]}%` }}>
        <div className="demo-network__node-ring" />
        {logo?.src ? <img src={resolveMediaUrl(logo.src)} alt={logo.title || `Логотип ${index + 1}`} /> : <span>ЛОГОТИП<br />{index + 1}</span>}
      </article>)}
      </div>
    </div>
  </div>;
}
