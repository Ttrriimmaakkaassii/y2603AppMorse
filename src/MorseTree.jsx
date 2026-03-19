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

export default function MorseTree({ activeMorse, currentStep }) {
  // Build set of paths that are highlighted (traversed so far)
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

  return (
    <div className="tree-wrap">
      <div className="tree-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="tree-svg" aria-label="Morse code decision tree">

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
      <p className="tree-legend">◂ left = · (dot) &nbsp;|&nbsp; right = − (dash) ▸</p>
    </div>
  );
}
