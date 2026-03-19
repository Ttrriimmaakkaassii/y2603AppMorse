import { useState, useRef, useEffect } from 'react';
import './MorseTree.css';

const TREE_MAP = {
  '.': 'E',   '-': 'T',
  '..': 'I',  '.-': 'A',  '-.': 'N',  '--': 'M',
  '...': 'S', '..-': 'U', '.-.': 'R', '.--': 'W',
  '-..': 'D', '-.-': 'K', '--.': 'G', '---': 'O',
  '....': 'H', '...-': 'V', '..-.': 'F', '.-..': 'L',
  '.--.': 'P', '.---': 'J', '-...': 'B', '-..-': 'X',
  '-.-.': 'C', '-.--': 'Y', '--..': 'Z', '--.-': 'Q',
};

const W = 960, H = 330;
const LEVEL_Y  = [30, 100, 170, 240, 305];
const NODE_R   = [19, 17,  15,  13,  11];
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

function toBinaryPath(index, level) {
  let p = '';
  for (let bit = level - 1; bit >= 0; bit--) p += ((index >> bit) & 1) ? '-' : '.';
  return p;
}

// Pre-build all nodes + edges once
const NODES = (() => {
  const list = [{ path: '', level: 0, letter: '', x: W / 2, y: LEVEL_Y[0] }];
  for (let lv = 1; lv <= 4; lv++) {
    const count = 1 << lv;
    const step = W / count;
    for (let i = 0; i < count; i++) {
      const path = toBinaryPath(i, lv);
      list.push({
        path,
        level: lv,
        letter: TREE_MAP[path] || '',
        x: step / 2 + i * step,
        y: LEVEL_Y[lv],
      });
    }
  }
  return list;
})();

const NODE_MAP = new Map(NODES.map(n => [n.path, n]));

const EDGES = NODES.filter(n => n.level > 0).map(n => ({
  from: NODE_MAP.get(n.path.slice(0, -1)),
  to: n,
  isDot: n.path[n.path.length - 1] === '.',
}));

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export default function MorseTree({ activeMorse, currentStep }) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef(null);
  const lastDist  = useRef(null);

  // Auto-fit on mount so the full tree is visible
  useEffect(() => {
    if (scrollRef.current) {
      const w = scrollRef.current.clientWidth || 360;
      setZoom(clampZoom(w / W));
    }
  }, []);

  // Wheel zoom + pinch-to-zoom via native listeners (need passive:false)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      setZoom(z => clampZoom(z * (e.deltaY > 0 ? 0.92 : 1.09)));
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        lastDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || lastDist.current === null) return;
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      setZoom(z => clampZoom(z * d / lastDist.current));
      lastDist.current = d;
    };

    const onTouchEnd = () => { lastDist.current = null; };

    el.addEventListener('wheel',      onWheel,      { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true  });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);

    return () => {
      el.removeEventListener('wheel',      onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  // Build set of paths highlighted (traversed so far)
  const reached = new Set();
  if (activeMorse) {
    reached.add('');
    for (let i = 1; i <= Math.min(currentStep, activeMorse.length); i++) {
      reached.add(activeMorse.slice(0, i));
    }
  }

  const currentNodePath = activeMorse
    ? activeMorse.slice(0, Math.min(currentStep, activeMorse.length))
    : null;
  const isDone = activeMorse && currentStep >= activeMorse.length;

  const svgW = Math.round(W * zoom);
  const svgH = Math.round(H * zoom);

  return (
    <div className="tree-wrap">

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" title="Zoom out"
          onClick={() => setZoom(z => clampZoom(z * 0.8))}>−</button>
        <button className="zoom-reset" title="Reset zoom"
          onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button className="zoom-btn" title="Zoom in"
          onClick={() => setZoom(z => clampZoom(z * 1.25))}>+</button>
        <button className="zoom-btn zoom-fit" title="Fit to screen"
          onClick={() => {
            if (scrollRef.current) {
              const w = scrollRef.current.clientWidth || 360;
              setZoom(clampZoom(w / W));
            }
          }}>⊞</button>
      </div>

      {/* Scrollable + zoomable SVG container */}
      <div className="tree-scroll" ref={scrollRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={svgW}
          height={svgH}
          className="tree-svg"
          aria-label="Morse code decision tree"
        >
          {/* Edges */}
          {EDGES.map(({ from, to, isDot }) => {
            const active = activeMorse && reached.has(to.path);
            return (
              <line
                key={to.path}
                x1={from.x} y1={from.y}
                x2={to.x}   y2={to.y}
                className={`t-edge ${active ? (isDot ? 'e-dot' : 'e-dash') : ''}`}
              />
            );
          })}

          {/* Branch legend on first fork */}
          <text x={330} y={68} className="branch-lbl">· dot</text>
          <text x={588} y={68} className="branch-lbl">dash −</text>

          {/* Nodes */}
          {NODES.map(({ path, level, letter, x, y }) => {
            const r = NODE_R[level];
            const isReached  = activeMorse && reached.has(path);
            const isCurrent  = path === currentNodePath && activeMorse;
            const isFinal    = isDone && path === activeMorse;

            let cls = 't-node';
            if (isFinal)        cls += ' t-final';
            else if (isCurrent) cls += ' t-current';
            else if (isReached) cls += ' t-reached';

            return (
              <g key={path || 'root'}>
                <circle cx={x} cy={y} r={r} className={cls} />
                {level === 0 ? (
                  <text x={x} y={y + 5} className="nl nl-root">▶</text>
                ) : letter ? (
                  <text x={x} y={y + 4}
                    className={`nl nl-${level} ${isReached ? 'nl-active' : ''}`}>
                    {letter}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="tree-legend">◂ left = · (dot) &nbsp;|&nbsp; right = − (dash) ▸ &nbsp;·&nbsp; pinch or scroll to zoom</p>
    </div>
  );
}
