import { useState, useRef, useEffect, useMemo } from 'react';

// ── Orbit colour palette ───────────────────────────────────────────────────────
const ORBIT_COLORS = ['#7ee8a2', '#5eead4', '#67e8f9', '#93c5fd'];

// ── Size-config factory ───────────────────────────────────────────────────────
function makeSize(bw, bh, gap) {
  const pw = 3 * bw + 2 * gap;
  const ph = 4 * bh + 3 * gap;
  const bpos = {};
  [['1','2','3'],['4','5','6'],['7','8','9'],['*','0','#']].forEach((row, r) =>
    row.forEach((k, c) => {
      bpos[k] = { x: c * (bw + gap) + bw / 2, y: r * (bh + gap) + bh / 2 };
    })
  );
  return { bw, bh, gap, pw, ph, bpos };
}

const WATCH      = makeSize(56, 48, 7);   // practice demo pad
const INPUT      = makeSize(76, 66, 10);  // practice input pad
const GAME_WATCH = makeSize(46, 40, 5);   // game watch pad (side-by-side)
const GAME_INPUT = makeSize(54, 47, 6);   // game input pad (side-by-side)

const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

// ── Predefined shapes ─────────────────────────────────────────────────────────
const SHAPES = [
  { id:'13',      seq:'13',      name:'1→3',  desc:'Top horiz'   },
  { id:'79',      seq:'79',      name:'7→9',  desc:'Bot horiz'   },
  { id:'28',      seq:'28',      name:'2→8',  desc:'Center ↓'    },
  { id:'19',      seq:'19',      name:'1→9',  desc:'Diag ↘'      },
  { id:'37',      seq:'37',      name:'3→7',  desc:'Diag ↙'      },
  { id:'123',     seq:'123',     name:'123',  desc:'Top row →'   },
  { id:'789',     seq:'789',     name:'789',  desc:'Bot row →'   },
  { id:'147',     seq:'147',     name:'147',  desc:'Left col ↓'  },
  { id:'258',     seq:'258',     name:'258',  desc:'Mid col ↓'   },
  { id:'369',     seq:'369',     name:'369',  desc:'Right col ↓' },
  { id:'159',     seq:'159',     name:'1↘9',  desc:'Diagonal'    },
  { id:'357',     seq:'357',     name:'3↙7',  desc:'Diagonal'    },
  { id:'1379',    seq:'1379',    name:'Z',    desc:'Z shape'     },
  { id:'7913',    seq:'7913',    name:'S',    desc:'S shape'     },
  { id:'1593',    seq:'1593',    name:'X',    desc:'Cross'       },
  { id:'1236789', seq:'1236789', name:'U',    desc:'U shape'     },
  { id:'9874123', seq:'9874123', name:'U↑',   desc:'U reverse'   },
  { id:'1478963', seq:'1478963', name:'□',    desc:'Square loop' },
  { id:'12369',   seq:'12369',   name:'L',    desc:'L shape'     },
  { id:'14789',   seq:'14789',   name:'Γ',    desc:'Reverse L'   },
  { id:'133',     seq:'133',     name:'133',  desc:'1 orbit'     },
  { id:'1133',    seq:'1133',    name:'1133', desc:'2 orbits'    },
  { id:'1333',    seq:'1333',    name:'1333', desc:'2 orbits'    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function randSeq(maxLen) {
  const safeMax = Math.max(maxLen, 3);
  const len     = 3 + Math.floor(Math.random() * Math.max(safeMax - 2, 1));
  const pool    = '123456789';
  let seq = '', prev = '';
  for (let i = 0; i < len; i++) {
    let d, attempts = 0;
    do {
      d = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (d === prev && attempts < 20);
    seq += d;
    prev = d;
  }
  return seq || '123'; // absolute fallback — should never be empty
}

// ── Sequence → animation steps ────────────────────────────────────────────────
function parseSteps(seq, bpos, bw) {
  if (!seq || !bpos) return [];
  // Group consecutive identical digits into runs
  const runs = [];
  let i = 0;
  while (i < seq.length) {
    const d = seq[i];
    let n = 1;
    while (i + n < seq.length && seq[i + n] === d) n++;
    runs.push({ d, n });
    i += n;
  }
  const steps = [];
  for (let ri = 0; ri < runs.length; ri++) {
    const { d, n } = runs[ri];
    const pos = bpos[d];
    if (!pos) continue;
    // Move line from previous run to this one
    if (ri > 0) {
      const prev    = runs[ri - 1];
      const prevPos = bpos[prev.d];
      if (prevPos) {
        steps.push({ type: 'move', from: prevPos, to: pos,
          fromDigit: prev.d, toDigit: d });
      }
    }
    // Each extra repeat → concentric orbit circle
    for (let oi = 0; oi < n - 1; oi++) {
      steps.push({
        type:   'orbit',
        center: pos,
        digit:  d,
        r:      (bw / 2) + 6 + oi * 12,
        color:  ORBIT_COLORS[oi % ORBIT_COLORS.length],
      });
    }
  }
  return steps;
}

// ── SVG renderer ──────────────────────────────────────────────────────────────
// FIX: strokeDasharray "0.00 X" can corrupt some Chromium SVG renderers.
//      We clamp the dash length to a minimum of 0.5 so we never write "0.00".
function renderElems(elems, animCur, lineColor, monoColor = false) {
  if (!lineColor) return [];
  const glow = lineColor + '28';
  const out  = [];

  function oc(step) { return monoColor ? lineColor : (step?.color ?? lineColor); }
  function og(step) { return monoColor ? glow      : ((step?.color ?? lineColor) + '28'); }

  function addLine(key, x1, y1, x2, y2) {
    // Guard against NaN coordinates
    if ([x1, y1, x2, y2].some(v => !Number.isFinite(v))) return;
    const pts = `${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    out.push(
      <polyline key={`${key}g`} points={pts} fill="none" stroke={glow}
        strokeWidth="16" strokeLinecap="round" />,
      <polyline key={`${key}l`} points={pts} fill="none" stroke={lineColor}
        strokeWidth="3.5"  strokeLinecap="round" opacity="0.9" />
    );
  }

  function addOrbit(key, step, frac) {
    if (!step?.center || !Number.isFinite(step.r) || step.r <= 0) return;
    const { center: { x: cx, y: cy }, r } = step;
    const circ  = 2 * Math.PI * r;
    // FIX: clamp drawn length — never write "0.00" which breaks some SVG renderers
    const drawn = Math.max(circ * frac, 0.5);
    const full  = drawn >= circ - 0.1;
    const dash  = full ? undefined
      : `${drawn.toFixed(2)} ${Math.max(circ - drawn, 0.01).toFixed(2)}`;
    const offset = circ * 0.25;
    const extra  = dash ? { strokeDasharray: dash, strokeDashoffset: offset } : {};
    out.push(
      <circle key={`${key}g`} cx={cx} cy={cy} r={r} fill="none"
        stroke={og(step)} strokeWidth="10" {...extra} />,
      <circle key={`${key}l`} cx={cx} cy={cy} r={r} fill="none"
        stroke={oc(step)} strokeWidth="2.5" opacity="0.88" {...extra} />
    );
  }

  // Completed steps
  (elems || []).forEach((e, i) => {
    if (!e) return;
    if (e.type === 'move')  addLine(`e${i}m`, e.from?.x, e.from?.y, e.to?.x, e.to?.y);
    if (e.type === 'orbit') addOrbit(`e${i}o`, e, 1);
  });

  // Currently-animating step
  if (animCur) {
    const p = animCur.progress ?? 0;
    if (animCur.type === 'move') {
      const { from, to } = animCur;
      if (from && to) {
        addLine('ac',
          from.x, from.y,
          from.x + (to.x - from.x) * p,
          from.y + (to.y - from.y) * p
        );
      }
    }
    if (animCur.type === 'orbit') addOrbit('ao', animCur, p);
  }

  return out;
}

// ── Picto coordinates (mini 3×3 grid) ────────────────────────────────────────
const PREV_BPOS = {
  '1':{x:7,y:7},'2':{x:21,y:7},'3':{x:35,y:7},
  '4':{x:7,y:21},'5':{x:21,y:21},'6':{x:35,y:21},
  '7':{x:7,y:35},'8':{x:21,y:35},'9':{x:35,y:35},
  '*':{x:7,y:49},'0':{x:21,y:49},'#':{x:35,y:49},
};
const PREV_BW          = 12;
const PREV_GRID_3X3    = ['1','2','3','4','5','6','7','8','9'];
const PREV_GRID_FULL   = ['1','2','3','4','5','6','7','8','9','*','0','#'];

// ── Animated picto thumbnail ─────────────────────────────────────────────────
function PictoPreview({ seq, size = 40, animate = false }) {
  const [elems,   setElems]   = useState([]);
  const [animCur, setAnimCur] = useState(null);
  // FIX: isMounted prevents setState after unmount (avoids React 17 warnings
  //      and potential state corruption in React 19 strict mode)
  const isMounted = useRef(true);
  const rafRef    = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Cancel any running animation
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    if (!seq) { setElems([]); setAnimCur(null); return; }

    const steps = parseSteps(seq, PREV_BPOS, PREV_BW);

    if (!animate || steps.length === 0) {
      setElems(steps);
      setAnimCur(null);
      return;
    }

    // Animated draw
    if (isMounted.current) { setElems([]); setAnimCur(null); }
    let si = 0, startTs = null;
    const SPEED = 280;

    function frame(ts) {
      if (!isMounted.current) return;
      try {
        if (!startTs) startTs = ts;
        const t  = Math.min((ts - startTs) / SPEED, 1);
        const et = easeInOut(t);
        const step = steps[si];
        if (!step) { rafRef.current = null; return; } // safety guard

        setAnimCur({ ...step, progress: et });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
        // Step complete
        setElems(prev => [...prev, { ...step }]);
        setAnimCur(null);
        si++;
        startTs = null;
        if (si < steps.length) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          rafRef.current = null;
        }
      } catch (err) {
        console.error('[PictoPreview] Animation frame error:', err);
        rafRef.current = null;
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, animate]);

  if (!seq) return null;

  const has4     = /[*0#]/.test(seq);
  const vH       = has4 ? 56 : 42;
  const gridKeys = has4 ? PREV_GRID_FULL : PREV_GRID_3X3;
  const firstCh  = seq[0];
  const firstPos = firstCh ? PREV_BPOS[firstCh] : null;
  const svgH     = Math.round(size * vH / 42);

  return (
    <svg viewBox={`0 0 42 ${vH}`} width={size} height={svgH}
      className="picto-preview-svg">
      {gridKeys.map(k => {
        const p = PREV_BPOS[k];
        return p
          ? <circle key={k} cx={p.x} cy={p.y} r="1.8" fill="#1e2535" />
          : null;
      })}
      {renderElems(elems, animCur, '#7ee8a2', false)}
      {firstPos && (
        <circle cx={firstPos.x} cy={firstPos.y} r="2.5" fill="#7ee8a2" opacity="0.9" />
      )}
    </svg>
  );
}

// ── Static mini SVG for shape-chip thumbnails ─────────────────────────────────
function ShapePreview({ seq }) {
  if (!seq) return null;
  const steps    = parseSteps(seq, PREV_BPOS, PREV_BW);
  const firstPos = seq[0] ? PREV_BPOS[seq[0]] : null;
  const has4     = /[*0#]/.test(seq);
  return (
    <svg viewBox={`0 0 42 ${has4 ? 56 : 42}`} width={24} height={has4 ? 32 : 24}
      className="shape-prev-svg">
      {renderElems(steps, null, '#7ee8a2', false)}
      {firstPos && (
        <circle cx={firstPos.x} cy={firstPos.y} r="2.5" fill="#7ee8a2" opacity="0.9" />
      )}
    </svg>
  );
}

// ── Keypad ────────────────────────────────────────────────────────────────────
function Keypad({ sz, layers = [], onTap, dim, firstDigit }) {
  if (!sz) return null;
  const { bw, bh, gap, pw, ph, bpos } = sz;

  const litMap = new Map();
  layers.forEach(layer => {
    if (!layer) return;
    (layer.lit instanceof Set ? layer.lit : new Set()).forEach(k => {
      if (!litMap.has(k)) litMap.set(k, layer.lineColor ?? '#7ee8a2');
    });
  });

  function btnCls(key) {
    const c = ['pad-btn'];
    if (bw < 70)                   c.push('pad-btn-sm');
    if (key === '*' || key === '#') c.push('pad-btn-sym');
    if (dim)                        c.push('pad-btn-dim');
    if (litMap.has(key)) {
      const col = litMap.get(key);
      if (col === '#7ee8a2')      c.push('btn-demo-lit');
      else if (col === '#60a5fa') c.push('btn-user-lit');
      else                        c.push('btn-user-wrong');
    }
    return c.join(' ');
  }

  const startPos   = (firstDigit && bpos[firstDigit]) ? bpos[firstDigit] : null;
  const startColor = layers[0]?.lineColor ?? '#7ee8a2';

  return (
    <div className="keypad-container" style={{ width: pw, height: ph }}>
      <div className="keypad-grid"
        style={{ gridTemplateColumns: `repeat(3, ${bw}px)`, gap }}>
        {KEYS.map(key => (
          <button key={key} className={btnCls(key)}
            style={{ width: bw, height: bh }}
            onClick={() => onTap?.(key)}>
            {key}
          </button>
        ))}
      </div>

      <svg className="pad-overlay" viewBox={`0 0 ${pw} ${ph}`} width={pw} height={ph}>
        {[...litMap.entries()].map(([d, col]) => {
          const p = bpos[d];
          return p ? (
            <circle key={`r-${d}`} cx={p.x} cy={p.y} r={bw / 2 - 4}
              fill={col + '18'} stroke={col} strokeWidth={bw < 70 ? 1.5 : 2} />
          ) : null;
        })}
        {layers.map((layer, li) => {
          if (!layer) return null;
          return (
            <g key={`ly${li}`}>
              {renderElems(
                layer.elems  ?? [],
                layer.animCur ?? null,
                layer.lineColor ?? '#7ee8a2',
                layer.monoColor ?? false
              )}
            </g>
          );
        })}
        {startPos && (
          <circle cx={startPos.x} cy={startPos.y} r={bw < 70 ? 4 : 6}
            fill={startColor} opacity="0.95" />
        )}
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NumberPad() {
  const [gameMode,   setGameMode]   = useState('practice');
  const [activeId,   setActiveId]   = useState(SHAPES[0].id);
  const [targetSeq,  setTargetSeq]  = useState(SHAPES[0].seq);
  const [phase,      setPhase]      = useState('idle');
  const [userInput,  setUserInput]  = useState('');
  const [feedback,   setFeedback]   = useState(null);
  const [score,      setScore]      = useState({ ok: 0, total: 0 });
  const [showWatch,  setShowWatch]  = useState(true);
  const [maxLen,     setMaxLen]     = useState(5);
  const [resultFade, setResultFade] = useState(false);
  const [history,    setHistory]    = useState([]);
  const [roundKey,   setRoundKey]   = useState(1);

  // Demo animation state
  const [demoElems,   setDemoElems]   = useState([]);
  const [demoAnimCur, setDemoAnimCur] = useState(null);
  const [demoLit,     setDemoLit]     = useState(new Set());

  // Input pad geometry changes with mode
  const activeInputSz = gameMode === 'game' ? GAME_INPUT : INPUT;

  // User path derived from input string (no separate state)
  const userElems = useMemo(
    () => parseSteps(userInput, activeInputSz.bpos, activeInputSz.bw),
    [userInput, activeInputSz]
  );
  const userLit = useMemo(
    () => new Set(userInput.split('').filter(Boolean)),
    [userInput]
  );

  // FIX: track ALL timer IDs so every timeout can be cleared on unmount
  const animId     = useRef(null);
  const autoRef    = useRef({ t1: null, t2: null });
  const roundTimer = useRef(null); // the 80 ms "start demo" timeout
  const newRound   = useRef(null);

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      if (animId.current)     cancelAnimationFrame(animId.current);
      clearTimeout(autoRef.current.t1);
      clearTimeout(autoRef.current.t2);
      clearTimeout(roundTimer.current);
    };
  }, []);

  // Auto-advance in game mode after result
  useEffect(() => {
    if (phase !== 'result' || gameMode !== 'game') return;
    setResultFade(false);
    const t1 = setTimeout(() => setResultFade(true), 1500);
    const t2 = setTimeout(() => { newRound.current?.(); }, 2200);
    autoRef.current = { t1, t2 };
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, gameMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animation engine ─────────────────────────────────────────────────────
  function stopAnim() {
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
  }

  function runDemoAnim(seq, sz, onDone) {
    if (!seq || !sz) return;
    stopAnim();
    const steps = parseSteps(seq, sz.bpos, sz.bw);
    const fd    = seq[0] ?? '';

    setDemoElems([]);
    setDemoAnimCur(null);
    setDemoLit(fd ? new Set([fd]) : new Set());

    if (steps.length === 0) {
      setTimeout(onDone, 300);
      return;
    }

    let si = 0, startTs = null;
    const SPEED = 420;

    function frame(ts) {
      try {
        if (!startTs) startTs = ts;
        const t    = Math.min((ts - startTs) / SPEED, 1);
        const et   = easeInOut(t);
        const step = steps[si];

        if (!step) { animId.current = null; return; } // safety guard

        setDemoAnimCur({ ...step, progress: et });

        if (step.type === 'move' && t >= 0.55) {
          setDemoLit(prev =>
            prev.has(step.toDigit) ? prev : new Set([...prev, step.toDigit])
          );
        }

        if (t < 1) { animId.current = requestAnimationFrame(frame); return; }

        setDemoElems(prev => [...prev, { ...step }]);
        setDemoAnimCur(null);
        si++;
        startTs = null;

        if (si >= steps.length) {
          animId.current = null;
          setTimeout(onDone, 420);
          return;
        }
        animId.current = requestAnimationFrame(frame);
      } catch (err) {
        console.error('[runDemoAnim] frame error:', err);
        animId.current = null;
      }
    }
    animId.current = requestAnimationFrame(frame);
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  function clearUser() { setUserInput(''); }

  function clearDemo() {
    stopAnim();
    clearTimeout(roundTimer.current);
    roundTimer.current = null;
    setDemoElems([]);
    setDemoAnimCur(null);
    setDemoLit(new Set());
  }

  function clearAll() {
    clearDemo();
    clearUser();
    setFeedback(null);
    setResultFade(false);
  }

  function stopAutoTimers() {
    clearTimeout(autoRef.current.t1);
    clearTimeout(autoRef.current.t2);
    autoRef.current = { t1: null, t2: null };
  }

  // FIX: startNewRound no longer calls clearAll internally — caller is
  //      responsible so we don't get double state-clears that confuse React.
  function startNewRound() {
    const seq = randSeq(maxLen);
    setTargetSeq(seq);
    setActiveId('');
    setRoundKey(k => k + 1);
    setPhase('watching');
    // FIX: store the timeout ID so it can be cleared on unmount
    roundTimer.current = setTimeout(
      () => { runDemoAnim(seq, GAME_WATCH, () => setPhase('playing')); },
      80
    );
  }
  newRound.current = startNewRound;

  function launchGame() {
    stopAutoTimers();
    clearAll(); // single clear here, startNewRound does NOT clear
    setGameMode('game');
    setHistory([]);
    setScore({ ok: 0, total: 0 });
    // Kick off first round synchronously
    startNewRound();
  }

  function launchPractice() {
    stopAutoTimers();
    clearAll();
    setGameMode('practice');
    setActiveId(SHAPES[0].id);
    setTargetSeq(SHAPES[0].seq);
    setPhase('idle');
  }

  function selectShape(shape) {
    stopAutoTimers();
    clearAll();
    setActiveId(shape.id);
    setTargetSeq(shape.seq);
    setPhase('idle');
  }

  function startWatch(seq, sz) {
    clearUser();
    setFeedback(null);
    setResultFade(false);
    setPhase('watching');
    runDemoAnim(seq ?? targetSeq, sz ?? INPUT, () => setPhase('playing'));
  }

  function watchAgain(sz) {
    stopAutoTimers();
    clearUser();
    setFeedback(null);
    setResultFade(false);
    setPhase('watching');
    runDemoAnim(targetSeq, sz ?? INPUT, () => setPhase('playing'));
  }

  function handleKeyTap(key) {
    if (phase !== 'playing') return;
    const next = userInput + key;
    setUserInput(next);
    if (next.length >= targetSeq.length) {
      const isOk = next === targetSeq;
      setFeedback(isOk ? 'correct' : 'wrong');
      setPhase('result');
      setScore(s => ({ ok: s.ok + (isOk ? 1 : 0), total: s.total + 1 }));
      if (gameMode === 'game') {
        setHistory(prev =>
          [{ seq: targetSeq, correct: isOk }, ...prev].slice(0, 8)
        );
      }
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const userColor = feedback === 'correct' ? '#7ee8a2'
    : feedback === 'wrong' ? '#f87171'
    : '#60a5fa';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="numpad-wrap">

      {/* Mode toggle */}
      <div className="mode-toggle" style={{ maxWidth: '100%' }}>
        <button
          className={`mode-btn ${gameMode === 'practice' ? 'mode-active' : ''}`}
          onClick={launchPractice}>📱 Practice</button>
        <button
          className={`mode-btn ${gameMode === 'game' ? 'mode-active' : ''}`}
          onClick={launchGame}>🎮 Game</button>
      </div>

      {/* ════ GAME MODE ════ */}
      {gameMode === 'game' && (
        <>
          {/* Score + length picker */}
          <div className="game-topbar">
            <div className="test-score" style={{ alignSelf: 'center' }}>
              {score.ok} / {score.total}
            </div>
            <div className="maxlen-picker">
              <span className="maxlen-label">Max</span>
              {[3,4,5,6,7,8,9].map(n => (
                <button key={n}
                  className={`maxlen-btn ${maxLen === n ? 'maxlen-active' : ''}`}
                  onClick={() => setMaxLen(n)}>{n}</button>
              ))}
            </div>
          </div>

          {/* PATH display with animated picto */}
          <div className="numpad-target">
            <PictoPreview key={roundKey} seq={targetSeq} size={42} animate />
            <span className="numpad-target-label">Path:</span>
            <span className="numpad-target-seq">
              {(targetSeq || '').split('').map((d, i) => {
                let cls = 'numpad-tdigit';
                if (userInput[i]) cls += userInput[i] === d ? ' td-ok' : ' td-err';
                return <span key={i} className={cls}>{d}</span>;
              })}
            </span>
            <span className="seq-len-badge">{targetSeq.length}d</span>
          </div>

          {/* Result flash */}
          {phase === 'result' && (
            <div className={`game-result-flash ${feedback ?? ''} ${resultFade ? 'fading' : ''}`}>
              {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
              <span className="result-auto-hint">Next in 2s…</span>
            </div>
          )}

          {/* Phase hint */}
          {phase !== 'result' && (
            <div className="numpad-phase">
              {phase === 'watching' && (
                <span className="phase-watch">◆ Memorise the path…</span>
              )}
              {phase === 'playing' && (
                <span className="phase-play">▶ Tap the path on the right</span>
              )}
            </div>
          )}

          {/* ── Side-by-side keypads ── */}
          <div className="game-keypads-row">

            {/* LEFT: Watch */}
            <div className="game-watch-col">
              <div className="watch-section-header">
                <span className="watch-label">👁 Watch</span>
                <button className="watch-toggle-btn"
                  onClick={() => setShowWatch(s => !s)}>
                  {showWatch ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className={`watch-collapsible ${showWatch ? '' : 'collapsed'}`}>
                <Keypad
                  sz={GAME_WATCH}
                  layers={[{
                    elems:     demoElems,
                    animCur:   demoAnimCur,
                    lineColor: '#7ee8a2',
                    monoColor: false,
                    lit:       demoLit,
                  }]}
                  dim
                  firstDigit={
                    (demoElems.length > 0 || demoAnimCur) ? targetSeq[0] : null
                  }
                />
              </div>
            </div>

            {/* RIGHT: Input */}
            <div className="game-input-col">
              <div className="input-section-header">
                <span className="input-label">✋ Input</span>
                {phase === 'playing' && userInput.length > 0 && (
                  <button className="btn btn-sm btn-clear-sm"
                    style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                    onClick={clearUser}>⌫</button>
                )}
              </div>
              <Keypad
                sz={GAME_INPUT}
                layers={[{
                  elems:     userElems,
                  animCur:   null,
                  lineColor: userColor,
                  monoColor: true,
                  lit:       userLit,
                }]}
                onTap={handleKeyTap}
                firstDigit={userInput.length > 0 ? userInput[0] : null}
              />
            </div>

          </div>

          {/* Watch-again */}
          {(phase === 'playing' || phase === 'result') && (
            <button className="btn btn-play-ans btn-sm"
              onClick={() => watchAgain(GAME_WATCH)}>↺ Watch again</button>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="game-history">
              <div className="game-history-label">History</div>
              {history.map((h, i) => (
                <div key={i} className={`history-item ${h.correct ? 'hi-ok' : 'hi-err'}`}>
                  <PictoPreview seq={h.seq} size={24} animate={false} />
                  <span className="hi-seq">{h.seq}</span>
                  <span className="hi-result">{h.correct ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════ PRACTICE MODE ════ */}
      {gameMode === 'practice' && (
        <>
          <div className="numpad-target">
            <span className="numpad-target-label">Path:</span>
            <span className="numpad-target-seq">
              {(targetSeq || '').split('').map((d, i) => {
                let cls = 'numpad-tdigit';
                if (userInput[i]) cls += userInput[i] === d ? ' td-ok' : ' td-err';
                return <span key={i} className={cls}>{d}</span>;
              })}
            </span>
          </div>

          <div className="numpad-phase">
            {phase === 'idle'     && <span>Select a shape, then tap ▶ Watch</span>}
            {phase === 'watching' && <span className="phase-watch">◆ Memorise the path…</span>}
            {phase === 'playing'  && <span className="phase-play">▶ Tap the numbers in order</span>}
            {phase === 'result'   && (
              <span className={`phase-result phase-${feedback ?? ''}`}>
                {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong — watch again?'}
              </span>
            )}
          </div>

          <div className="numpad-layout">
            <div className="shapes-panel">
              {SHAPES.map(s => (
                <button key={s.id}
                  className={`shape-chip ${activeId === s.id ? 'chip-active' : ''}`}
                  onClick={() => selectShape(s)}>
                  <ShapePreview seq={s.seq} />
                  <div className="chip-text">
                    <span className="chip-name">{s.name}</span>
                    <span className="chip-desc">{s.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="keypad-outer">
              <Keypad
                sz={INPUT}
                layers={[
                  {
                    elems:     demoElems,
                    animCur:   demoAnimCur,
                    lineColor: '#7ee8a2',
                    monoColor: false,
                    lit:       demoLit,
                  },
                  {
                    elems:     userElems,
                    animCur:   null,
                    lineColor: userColor,
                    monoColor: true,
                    lit:       userLit,
                  },
                ]}
                onTap={handleKeyTap}
                firstDigit={
                  (demoElems.length > 0 || demoAnimCur) ? targetSeq[0] : null
                }
              />

              <div className="pad-controls">
                {phase === 'idle' && (
                  <button className="btn btn-play-ans btn-sm"
                    onClick={() => startWatch(targetSeq, INPUT)}>▶ Watch path</button>
                )}
                {phase === 'watching' && (
                  <span className="pad-ctrl-hint">◆ Watching…</span>
                )}
                {phase === 'playing' && (
                  <>
                    <button className="btn btn-sm btn-clear-sm"
                      onClick={clearUser}>⌫ Clear</button>
                    <button className="btn btn-sm btn-play-ans"
                      onClick={() => watchAgain(INPUT)}>↺ Watch again</button>
                  </>
                )}
                {phase === 'result' && (
                  <>
                    <button className="btn btn-sm btn-play-ans"
                      onClick={() => watchAgain(INPUT)}>↺ Watch again</button>
                    <button className="btn btn-sm btn-next"
                      onClick={() => { clearAll(); setPhase('idle'); }}>Retry →</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
