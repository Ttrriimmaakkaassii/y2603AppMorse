import { useState, useRef, useEffect, useMemo } from 'react';

// ── Orbit colour palette (changes with each nested repeat) ────────────────────
const ORBIT_COLORS = ['#7ee8a2', '#5eead4', '#67e8f9', '#93c5fd'];

// ── Size-config factory — keeps geometry self-contained ───────────────────────
function makeSize(bw, bh, gap) {
  const pw = 3 * bw + 2 * gap;
  const ph = 4 * bh + 3 * gap;
  const bpos = {};
  [['1','2','3'],['4','5','6'],['7','8','9'],['*','0','#']].forEach((row, r) =>
    row.forEach((k, c) => { bpos[k] = { x: c*(bw+gap)+bw/2, y: r*(bh+gap)+bh/2 }; })
  );
  return { bw, bh, gap, pw, ph, bpos };
}

const WATCH = makeSize(56, 48, 7);   // small watch pad
const INPUT = makeSize(76, 66, 10);  // full input pad

const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

// ── Predefined shapes (Practice mode) ────────────────────────────────────────
const SHAPES = [
  { id:'13',      seq:'13',      name:'1→3',  desc:'Top horiz'  },
  { id:'79',      seq:'79',      name:'7→9',  desc:'Bot horiz'  },
  { id:'28',      seq:'28',      name:'2→8',  desc:'Center ↓'   },
  { id:'19',      seq:'19',      name:'1→9',  desc:'Diag ↘'     },
  { id:'37',      seq:'37',      name:'3→7',  desc:'Diag ↙'     },
  { id:'123',     seq:'123',     name:'123',  desc:'Top row →'  },
  { id:'789',     seq:'789',     name:'789',  desc:'Bot row →'  },
  { id:'147',     seq:'147',     name:'147',  desc:'Left col ↓' },
  { id:'258',     seq:'258',     name:'258',  desc:'Mid col ↓'  },
  { id:'369',     seq:'369',     name:'369',  desc:'Right col ↓'},
  { id:'159',     seq:'159',     name:'1↘9',  desc:'Diagonal'   },
  { id:'357',     seq:'357',     name:'3↙7',  desc:'Diagonal'   },
  { id:'1379',    seq:'1379',    name:'Z',    desc:'Z shape'    },
  { id:'7913',    seq:'7913',    name:'S',    desc:'S shape'    },
  { id:'1593',    seq:'1593',    name:'X',    desc:'Cross'      },
  { id:'1236789', seq:'1236789', name:'U',    desc:'U shape'    },
  { id:'9874123', seq:'9874123', name:'U↑',   desc:'U reverse'  },
  { id:'1478963', seq:'1478963', name:'□',    desc:'Square loop'},
  { id:'12369',   seq:'12369',   name:'L',    desc:'L shape'    },
  { id:'14789',   seq:'14789',   name:'Γ',    desc:'Reverse L'  },
  // Repeat demos
  { id:'133',     seq:'133',     name:'133',  desc:'1 orbit'    },
  { id:'1133',    seq:'1133',    name:'1133', desc:'2 orbits'   },
  { id:'1333',    seq:'1333',    name:'1333', desc:'2 orbits'   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

function randSeq(maxLen) {
  const len = 3 + Math.floor(Math.random() * (maxLen - 2));
  const pool = '123456789';
  let seq = '', prev = '';
  for (let i = 0; i < len; i++) {
    let d;
    do { d = pool[Math.floor(Math.random() * pool.length)]; } while (d === prev);
    seq += d; prev = d;
  }
  return seq;
}

// ── Core: sequence → animation steps ─────────────────────────────────────────
// Returns [{type:'move', from, to, fromDigit, toDigit}
//         |{type:'orbit', center, digit, r, color}]
function parseSteps(seq, bpos, bw) {
  if (!seq) return [];
  // Group into runs of consecutive identical chars
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

    // Line from previous run to this one (skip if first)
    if (ri > 0) {
      const prev = runs[ri - 1];
      const prevPos = bpos[prev.d];
      if (prevPos) {
        steps.push({ type: 'move', from: prevPos, to: pos,
          fromDigit: prev.d, toDigit: d });
      }
    }

    // Each extra occurrence beyond first → concentric orbit
    for (let oi = 0; oi < n - 1; oi++) {
      steps.push({
        type:   'orbit',
        center: pos,
        digit:  d,
        r:      (bw / 2) + 6 + oi * 12,        // radius grows with each orbit
        color:  ORBIT_COLORS[oi % ORBIT_COLORS.length],
      });
    }
  }
  return steps;
}

// ── SVG element renderer ──────────────────────────────────────────────────────
// elems    – completed steps  (lines drawn solid, orbits drawn full circles)
// animCur  – step in progress (null if nothing animating)
// lineColor– colour for line segments
// monoColor– if true, use lineColor for orbits too (user path); else use step.color
function renderElems(elems, animCur, lineColor, monoColor = false) {
  const glow = lineColor + '28';
  const out  = [];

  function oc(step) { return monoColor ? lineColor : step.color; }
  function og(step) { return monoColor ? glow      : step.color + '28'; }

  // Completed line
  function addLine(key, x1, y1, x2, y2) {
    const pts = `${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    out.push(
      <polyline key={`${key}g`} points={pts} fill="none" stroke={glow}
        strokeWidth="16" strokeLinecap="round" />,
      <polyline key={`${key}l`} points={pts} fill="none" stroke={lineColor}
        strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
    );
  }

  // Orbit (full or partial via frac 0–1)
  function addOrbit(key, step, frac) {
    const { center: { x: cx, y: cy }, r } = step;
    const circ   = 2 * Math.PI * r;
    const drawn  = circ * frac;
    const full   = drawn >= circ - 0.1;
    const dash   = full ? undefined : `${drawn.toFixed(2)} ${(circ - drawn).toFixed(2)}`;
    const offset = circ * 0.25;          // start arc from 12 o'clock
    const extra  = dash ? { strokeDasharray: dash, strokeDashoffset: offset } : {};
    out.push(
      <circle key={`${key}g`} cx={cx} cy={cy} r={r} fill="none"
        stroke={og(step)} strokeWidth="10" {...extra} />,
      <circle key={`${key}l`} cx={cx} cy={cy} r={r} fill="none"
        stroke={oc(step)} strokeWidth="2.5" opacity="0.88" {...extra} />
    );
  }

  // Completed elements
  elems.forEach((e, i) => {
    if (e.type === 'move')  addLine(`e${i}m`, e.from.x, e.from.y, e.to.x, e.to.y);
    if (e.type === 'orbit') addOrbit(`e${i}o`, e, 1);
  });

  // Animating element
  if (animCur) {
    if (animCur.type === 'move') {
      const { from, to, progress: p } = animCur;
      addLine('ac', from.x, from.y, from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p);
    }
    if (animCur.type === 'orbit') {
      addOrbit('ao', animCur, animCur.progress);
    }
  }

  return out;
}

// ── Mini SVG for shapes-panel previews ───────────────────────────────────────
const PREV_BPOS = {
  '1':{x:7,y:7},'2':{x:21,y:7},'3':{x:35,y:7},
  '4':{x:7,y:21},'5':{x:21,y:21},'6':{x:35,y:21},
  '7':{x:7,y:35},'8':{x:21,y:35},'9':{x:35,y:35},
  '*':{x:7,y:49},'0':{x:21,y:49},'#':{x:35,y:49},
};
const PREV_BW = 12;

function ShapePreview({ seq }) {
  const steps   = parseSteps(seq, PREV_BPOS, PREV_BW);
  const firstPos = PREV_BPOS[seq[0]];
  const has4     = /[*0#]/.test(seq);
  return (
    <svg viewBox={`0 0 42 ${has4?56:42}`} width={24} height={has4?32:24} className="shape-prev-svg">
      {renderElems(steps, null, '#7ee8a2', false)}
      {firstPos && <circle cx={firstPos.x} cy={firstPos.y} r="2.5" fill="#7ee8a2" opacity="0.9" />}
    </svg>
  );
}

// ── Keypad component ──────────────────────────────────────────────────────────
// layers: [{elems, animCur, lineColor, monoColor, lit}]
//   – each layer is an independent path drawn on the same SVG overlay
// onTap       – key tap handler (omit for read-only)
// dim         – render dimmed style (watch pad)
// firstDigit  – if set, draws a start-dot at that button
function Keypad({ sz, layers = [], onTap, dim, firstDigit }) {
  const { bw, bh, gap, pw, ph, bpos } = sz;

  // Which buttons glow, and in which color (first layer wins per key)
  const litMap = new Map();
  layers.forEach(layer => {
    (layer.lit || new Set()).forEach(k => {
      if (!litMap.has(k)) litMap.set(k, layer.lineColor);
    });
  });

  function btnCls(key) {
    const c = ['pad-btn'];
    if (bw < 70)                     c.push('pad-btn-sm');
    if (key === '*' || key === '#')   c.push('pad-btn-sym');
    if (dim)                          c.push('pad-btn-dim');
    if (litMap.has(key)) {
      const col = litMap.get(key);
      if (col === '#7ee8a2') c.push('btn-demo-lit');
      else if (col === '#60a5fa') c.push('btn-user-lit');
      else c.push('btn-user-wrong');
    }
    return c.join(' ');
  }

  const startPos = firstDigit ? bpos[firstDigit] : null;
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
        {/* Button highlight rings */}
        {[...litMap.entries()].map(([d, col]) => {
          const p = bpos[d];
          return p ? (
            <circle key={`r-${d}`} cx={p.x} cy={p.y} r={bw/2-4}
              fill={col+'18'} stroke={col} strokeWidth={bw<70?1.5:2} />
          ) : null;
        })}

        {/* Path layers (demo first, user on top) */}
        {layers.map((layer, li) => (
          <g key={`ly${li}`}>
            {renderElems(layer.elems, layer.animCur, layer.lineColor, layer.monoColor ?? false)}
          </g>
        ))}

        {/* Start dot */}
        {startPos && (
          <circle cx={startPos.x} cy={startPos.y} r={bw<70?4:6}
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

  // Demo animation state
  const [demoElems,   setDemoElems]   = useState([]);
  const [demoAnimCur, setDemoAnimCur] = useState(null);
  const [demoLit,     setDemoLit]     = useState(new Set());

  // User path derived from input string — no separate state needed
  const userElems = useMemo(
    () => parseSteps(userInput, INPUT.bpos, INPUT.bw),
    [userInput]
  );
  const userLit = useMemo(
    () => new Set(userInput.split('').filter(Boolean)),
    [userInput]
  );

  const animId  = useRef(null);
  const autoRef = useRef({});
  const newRound = useRef(null);

  useEffect(() => () => {
    if (animId.current) cancelAnimationFrame(animId.current);
    clearTimeout(autoRef.current.t1);
    clearTimeout(autoRef.current.t2);
  }, []);

  // Auto-advance in game mode
  useEffect(() => {
    if (phase !== 'result' || gameMode !== 'game') return;
    setResultFade(false);
    const t1 = setTimeout(() => setResultFade(true), 1500);
    const t2 = setTimeout(() => newRound.current?.(), 2200);
    autoRef.current = { t1, t2 };
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, gameMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animation engine ───────────────────────────────────────────────────────
  function stopAnim() {
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
  }

  // sz = WATCH (game) or INPUT (practice)
  function runDemoAnim(seq, sz, onDone) {
    stopAnim();
    const steps = parseSteps(seq, sz.bpos, sz.bw);
    const fd    = seq[0];

    setDemoElems([]);
    setDemoAnimCur(null);
    setDemoLit(fd ? new Set([fd]) : new Set());

    if (steps.length === 0) { setTimeout(onDone, 300); return; }

    let si = 0, startTs = null;
    const SPEED = 420;

    function frame(ts) {
      if (!startTs) startTs = ts;
      const t  = Math.min((ts - startTs) / SPEED, 1);
      const et = easeInOut(t);
      const step = steps[si];

      setDemoAnimCur({ ...step, progress: et });

      // Light up destination button when move is > halfway
      if (step.type === 'move' && t >= 0.55) {
        setDemoLit(prev =>
          prev.has(step.toDigit) ? prev : new Set([...prev, step.toDigit])
        );
      }

      if (t < 1) { animId.current = requestAnimationFrame(frame); return; }

      // Step complete
      setDemoElems(prev => [...prev, { ...step }]);
      setDemoAnimCur(null);
      si++; startTs = null;

      if (si >= steps.length) {
        animId.current = null;
        setTimeout(onDone, 420);
        return;
      }
      animId.current = requestAnimationFrame(frame);
    }
    animId.current = requestAnimationFrame(frame);
  }

  // ── Game actions ────────────────────────────────────────────────────────────
  function clearUser()  { setUserInput(''); }
  function clearDemo()  { stopAnim(); setDemoElems([]); setDemoAnimCur(null); setDemoLit(new Set()); }
  function clearAll()   { clearDemo(); clearUser(); setFeedback(null); setResultFade(false); }

  // sz: which pad geometry to animate on (WATCH in game, INPUT in practice)
  function startWatch(seq, sz) {
    clearUser(); setFeedback(null); setResultFade(false);
    setPhase('watching');
    runDemoAnim(seq ?? targetSeq, sz ?? INPUT, () => setPhase('playing'));
  }

  function watchAgain(sz) {
    clearTimeout(autoRef.current.t1); clearTimeout(autoRef.current.t2);
    clearUser(); setFeedback(null); setResultFade(false);
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
    }
  }

  function startNewRound() {
    clearAll();
    const seq = randSeq(maxLen);
    setTargetSeq(seq); setActiveId('');
    setPhase('watching');
    setTimeout(() => runDemoAnim(seq, WATCH, () => setPhase('playing')), 80);
  }
  newRound.current = startNewRound;

  function launchGame() {
    clearTimeout(autoRef.current.t1); clearTimeout(autoRef.current.t2);
    clearAll();
    setGameMode('game');
    startNewRound();
  }

  function launchPractice() {
    clearTimeout(autoRef.current.t1); clearTimeout(autoRef.current.t2);
    clearAll();
    setGameMode('practice');
    setActiveId(SHAPES[0].id); setTargetSeq(SHAPES[0].seq);
    setPhase('idle');
  }

  function selectShape(shape) {
    clearTimeout(autoRef.current.t1); clearTimeout(autoRef.current.t2);
    clearAll();
    setActiveId(shape.id); setTargetSeq(shape.seq);
    setPhase('idle');
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const userColor = feedback === 'correct' ? '#7ee8a2' : feedback === 'wrong' ? '#f87171' : '#60a5fa';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="numpad-wrap">

      {/* Mode toggle */}
      <div className="mode-toggle" style={{ maxWidth: '100%' }}>
        <button className={`mode-btn ${gameMode === 'practice' ? 'mode-active' : ''}`}
          onClick={launchPractice}>📱 Practice</button>
        <button className={`mode-btn ${gameMode === 'game' ? 'mode-active' : ''}`}
          onClick={launchGame}>🎮 Game</button>
      </div>

      {/* ════════ GAME MODE ════════ */}
      {gameMode === 'game' && (
        <>
          {/* Score + max-length picker */}
          <div className="game-topbar">
            <div className="test-score" style={{ alignSelf:'center' }}>{score.ok} / {score.total}</div>
            <div className="maxlen-picker">
              <span className="maxlen-label">Max</span>
              {[3,4,5,6,7,8,9].map(n => (
                <button key={n} className={`maxlen-btn ${maxLen===n?'maxlen-active':''}`}
                  onClick={() => setMaxLen(n)}>{n}</button>
              ))}
            </div>
          </div>

          {/* Target sequence */}
          <div className="numpad-target">
            <span className="numpad-target-label">Path:</span>
            <span className="numpad-target-seq">
              {targetSeq.split('').map((d, i) => {
                let cls = 'numpad-tdigit';
                if (userInput[i]) cls += userInput[i] === d ? ' td-ok' : ' td-err';
                return <span key={i} className={cls}>{d}</span>;
              })}
            </span>
            <span className="seq-len-badge">{targetSeq.length} digit{targetSeq.length>1?'s':''}</span>
          </div>

          {/* Result flash */}
          {phase === 'result' && (
            <div className={`game-result-flash ${feedback} ${resultFade?'fading':''}`}>
              {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
              <span className="result-auto-hint">Next in 2s…</span>
            </div>
          )}

          {/* Phase hint */}
          {phase !== 'result' && (
            <div className="numpad-phase">
              {phase === 'watching' && <span className="phase-watch">◆ Memorise the path…</span>}
              {phase === 'playing'  && <span className="phase-play">▶ Tap the numbers below in order</span>}
            </div>
          )}

          {/* Watch keypad (collapsible) */}
          <div className="watch-section">
            <div className="watch-section-header">
              <span className="watch-label">👁 Watch</span>
              <button className="watch-toggle-btn" onClick={() => setShowWatch(s => !s)}>
                {showWatch ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className={`watch-collapsible ${showWatch?'':'collapsed'}`}>
              <Keypad
                sz={WATCH}
                layers={[{ elems: demoElems, animCur: demoAnimCur,
                           lineColor: '#7ee8a2', monoColor: false, lit: demoLit }]}
                dim
                firstDigit={demoElems.length > 0 || demoAnimCur ? targetSeq[0] : null}
              />
            </div>
          </div>

          {/* Input keypad */}
          <div className="input-section">
            <div className="input-section-header">
              <span className="input-label">Your Input</span>
              {phase === 'playing' && userInput.length > 0 && (
                <button className="btn btn-sm btn-clear-sm"
                  style={{ padding:'4px 12px', fontSize:'0.75rem' }}
                  onClick={clearUser}>⌫ Clear</button>
              )}
            </div>
            <Keypad
              sz={INPUT}
              layers={[{ elems: userElems, animCur: null,
                         lineColor: userColor, monoColor: true, lit: userLit }]}
              onTap={handleKeyTap}
              firstDigit={userInput.length > 0 ? userInput[0] : null}
            />
          </div>

          {/* Watch-again */}
          {(phase === 'playing' || phase === 'result') && (
            <button className="btn btn-play-ans btn-sm"
              onClick={() => watchAgain(WATCH)}>↺ Watch again</button>
          )}
        </>
      )}

      {/* ════════ PRACTICE MODE ════════ */}
      {gameMode === 'practice' && (
        <>
          <div className="numpad-target">
            <span className="numpad-target-label">Path:</span>
            <span className="numpad-target-seq">
              {targetSeq.split('').map((d, i) => {
                let cls = 'numpad-tdigit';
                if (userInput[i]) cls += userInput[i] === d ? ' td-ok' : ' td-err';
                return <span key={i} className={cls}>{d}</span>;
              })}
            </span>
          </div>

          <div className="numpad-phase">
            {phase === 'idle'    && <span>Select a shape, then tap ▶ Watch</span>}
            {phase === 'watching'&& <span className="phase-watch">◆ Memorise the path…</span>}
            {phase === 'playing' && <span className="phase-play">▶ Tap the numbers in order</span>}
            {phase === 'result'  && (
              <span className={`phase-result phase-${feedback}`}>
                {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong — watch again?'}
              </span>
            )}
          </div>

          <div className="numpad-layout">
            {/* Shapes list */}
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

            {/* Single combined keypad: demo (green) + user (blue) overlaid */}
            <div className="keypad-outer">
              <Keypad
                sz={INPUT}
                layers={[
                  { elems: demoElems, animCur: demoAnimCur,
                    lineColor: '#7ee8a2', monoColor: false, lit: demoLit },
                  { elems: userElems, animCur: null,
                    lineColor: userColor, monoColor: true,  lit: userLit },
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
                {phase === 'watching' && <span className="pad-ctrl-hint">◆ Watching…</span>}
                {phase === 'playing' && <>
                  <button className="btn btn-sm btn-clear-sm" onClick={clearUser}>⌫ Clear</button>
                  <button className="btn btn-sm btn-play-ans"
                    onClick={() => watchAgain(INPUT)}>↺ Watch again</button>
                </>}
                {phase === 'result' && <>
                  <button className="btn btn-sm btn-play-ans"
                    onClick={() => watchAgain(INPUT)}>↺ Watch again</button>
                  <button className="btn btn-sm btn-next"
                    onClick={() => { clearAll(); setPhase('idle'); }}>Retry →</button>
                </>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
