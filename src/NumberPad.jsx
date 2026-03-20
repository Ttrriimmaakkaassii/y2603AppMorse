import { useState, useRef, useEffect } from 'react';

// ── Keypad geometry — fixed px so SVG overlay aligns perfectly ──────────────
const BTN_W = 76, BTN_H = 66, GAP = 10;
const PAD_W = 3 * BTN_W + 2 * GAP;  // 248
const PAD_H = 4 * BTN_H + 3 * GAP;  // 294

const cx = c => c * (BTN_W + GAP) + BTN_W / 2;
const cy = r => r * (BTN_H + GAP) + BTN_H / 2;

const BUTTON_POS = {
  '1': { x: cx(0), y: cy(0) }, '2': { x: cx(1), y: cy(0) }, '3': { x: cx(2), y: cy(0) },
  '4': { x: cx(0), y: cy(1) }, '5': { x: cx(1), y: cy(1) }, '6': { x: cx(2), y: cy(1) },
  '7': { x: cx(0), y: cy(2) }, '8': { x: cx(1), y: cy(2) }, '9': { x: cx(2), y: cy(2) },
  '*': { x: cx(0), y: cy(3) }, '0': { x: cx(1), y: cy(3) }, '#': { x: cx(2), y: cy(3) },
};

const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

// ── Predefined shapes ────────────────────────────────────────────────────────
const SHAPES = [
  { id: '13',      seq: '13',      name: '1→3',    desc: 'Top horiz' },
  { id: '79',      seq: '79',      name: '7→9',    desc: 'Bot horiz' },
  { id: '28',      seq: '28',      name: '2→8',    desc: 'Center ↓' },
  { id: '19',      seq: '19',      name: '1→9',    desc: 'Diag ↘' },
  { id: '37',      seq: '37',      name: '3→7',    desc: 'Diag ↙' },
  { id: '123',     seq: '123',     name: '123',    desc: 'Top row →' },
  { id: '789',     seq: '789',     name: '789',    desc: 'Bot row →' },
  { id: '147',     seq: '147',     name: '147',    desc: 'Left col ↓' },
  { id: '258',     seq: '258',     name: '258',    desc: 'Mid col ↓' },
  { id: '369',     seq: '369',     name: '369',    desc: 'Right col ↓' },
  { id: '159',     seq: '159',     name: '1↘9',    desc: 'Diagonal' },
  { id: '357',     seq: '357',     name: '3↙7',    desc: 'Diagonal' },
  { id: '1379',    seq: '1379',    name: 'Z',      desc: 'Z shape' },
  { id: '7913',    seq: '7913',    name: 'S',      desc: 'S shape' },
  { id: '1593',    seq: '1593',    name: 'X',      desc: 'Cross' },
  { id: '1236789', seq: '1236789', name: 'U',      desc: 'U shape' },
  { id: '9874123', seq: '9874123', name: 'U↑',     desc: 'U reverse' },
  { id: '1478963', seq: '1478963', name: '□',      desc: 'Square loop' },
  { id: '12369',   seq: '12369',   name: 'L',      desc: 'L shape' },
  { id: '14789',   seq: '14789',   name: 'Γ',      desc: 'Reverse L' },
];

// ── Easing ───────────────────────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Mini SVG preview of a shape (shows the path on a 3×4 micro-grid) ────────
function ShapePreview({ seq }) {
  const PREV = {
    '1':[7,7],  '2':[21,7],  '3':[35,7],
    '4':[7,21], '5':[21,21], '6':[35,21],
    '7':[7,35], '8':[21,35], '9':[35,35],
    '*':[7,49], '0':[21,49], '#':[35,49],
  };
  const has4 = /[*0#]/.test(seq);
  const pts  = seq.split('').map(d => PREV[d]).filter(Boolean);
  const pstr = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const vH   = has4 ? 56 : 42;
  return (
    <svg viewBox={`0 0 42 ${vH}`} width={24} height={has4 ? 32 : 24} className="shape-prev-svg">
      {pts.length > 1 && (
        <polyline points={pstr} fill="none" stroke="#7ee8a2"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3"
          fill={i === 0 ? '#7ee8a2' : '#4a9e6a'} />
      ))}
    </svg>
  );
}

// ── Points → SVG string ───────────────────────────────────────────────────────
function toSVGStr(pts, tip) {
  const all = tip ? [...pts, tip] : pts;
  return all.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NumberPad() {
  const [gameMode,   setGameMode]   = useState('practice'); // 'practice' | 'game'
  const [activeId,   setActiveId]   = useState(SHAPES[0].id);
  const [targetSeq,  setTargetSeq]  = useState(SHAPES[0].seq);
  const [phase,      setPhase]      = useState('idle');     // 'idle'|'watching'|'playing'|'result'
  const [userInput,  setUserInput]  = useState('');
  const [feedback,   setFeedback]   = useState(null);       // null|'correct'|'wrong'
  const [score,      setScore]      = useState({ ok: 0, total: 0 });

  // Demo (correct-path) line
  const [demoPts,  setDemoPts]  = useState([]);
  const [demoTip,  setDemoTip]  = useState(null);
  const [demoLit,  setDemoLit]  = useState(new Set());

  // User input line
  const [userPts,  setUserPts]  = useState([]);
  const [userLit,  setUserLit]  = useState(new Set());

  const animId = useRef(null);

  // Cleanup on unmount
  useEffect(() => () => { if (animId.current) cancelAnimationFrame(animId.current); }, []);

  // ── Animation helpers ──────────────────────────────────────────────────────
  function stopAnim() {
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
  }

  function clearUser() {
    setUserInput(''); setUserPts([]); setUserLit(new Set());
  }

  function runDemoAnim(seq, onDone) {
    stopAnim();
    const digits = seq.split('').filter(d => BUTTON_POS[d]);
    const points = digits.map(d => BUTTON_POS[d]);

    // Seed first button immediately
    setDemoPts([points[0]]);
    setDemoTip(null);
    setDemoLit(new Set([digits[0]]));

    if (points.length < 2) { setTimeout(onDone, 300); return; }

    let seg = 0, startTs = null;
    const SPEED = 420; // ms per segment

    function frame(ts) {
      if (!startTs) startTs = ts;
      const t  = Math.min((ts - startTs) / SPEED, 1);
      const et = easeInOut(t);
      const from = points[seg], to = points[seg + 1];
      const tip  = { x: from.x + (to.x - from.x) * et, y: from.y + (to.y - from.y) * et };

      setDemoPts(points.slice(0, seg + 1));
      setDemoTip(t < 1 ? tip : null);
      setDemoLit(new Set(digits.slice(0, seg + (t >= 0.55 ? 2 : 1))));

      if (t >= 1) {
        seg++; startTs = null;
        if (seg >= points.length - 1) {
          setDemoPts(points);
          setDemoTip(null);
          setDemoLit(new Set(digits));
          animId.current = null;
          setTimeout(onDone, 420);
          return;
        }
      }
      animId.current = requestAnimationFrame(frame);
    }
    animId.current = requestAnimationFrame(frame);
  }

  // ── Game actions ───────────────────────────────────────────────────────────
  function selectShape(shape) {
    stopAnim();
    setDemoPts([]); setDemoTip(null); setDemoLit(new Set());
    clearUser(); setFeedback(null);
    setActiveId(shape.id); setTargetSeq(shape.seq);
    setPhase('idle');
  }

  function startWatch(seq) {
    clearUser(); setFeedback(null);
    setPhase('watching');
    runDemoAnim(seq ?? targetSeq, () => setPhase('playing'));
  }

  function watchAgain() {
    clearUser(); setFeedback(null);
    setPhase('watching');
    runDemoAnim(targetSeq, () => setPhase('playing'));
  }

  function handleKeyTap(key) {
    if (phase !== 'playing') return;
    const newInput = userInput + key;
    const pos = BUTTON_POS[key];
    setUserInput(newInput);
    setUserLit(s => new Set([...s, key]));
    if (pos) setUserPts(pts => [...pts, pos]);

    if (newInput.length >= targetSeq.length) {
      const isOk = newInput === targetSeq;
      setFeedback(isOk ? 'correct' : 'wrong');
      setPhase('result');
      setScore(s => ({ ok: s.ok + (isOk ? 1 : 0), total: s.total + 1 }));
    }
  }

  function nextRound() {
    stopAnim();
    setDemoPts([]); setDemoTip(null); setDemoLit(new Set());
    clearUser(); setFeedback(null);
    if (gameMode === 'game') {
      const next = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      setActiveId(next.id); setTargetSeq(next.seq);
      setTimeout(() => startWatch(next.seq), 80);
    } else {
      setPhase('idle');
    }
  }

  function launchGame() {
    stopAnim();
    setDemoPts([]); setDemoTip(null); setDemoLit(new Set());
    clearUser(); setFeedback(null);
    setGameMode('game');
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    setActiveId(shape.id); setTargetSeq(shape.seq);
    setTimeout(() => startWatch(shape.seq), 80);
  }

  function launchPractice() {
    stopAnim();
    setDemoPts([]); setDemoTip(null); setDemoLit(new Set());
    clearUser(); setFeedback(null);
    setGameMode('practice');
    setActiveId(SHAPES[0].id); setTargetSeq(SHAPES[0].seq);
    setPhase('idle');
  }

  // ── SVG rendering helpers ──────────────────────────────────────────────────
  const demoAllPts = demoTip ? [...demoPts, demoTip] : demoPts;
  const demoStr    = toSVGStr(demoPts, demoTip);
  const userColor  = feedback === 'wrong' ? '#f87171' : '#60a5fa';
  const userGlow   = feedback === 'wrong' ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)';

  function btnClass(key) {
    const cls = ['pad-btn'];
    if (key === '*' || key === '#') cls.push('pad-btn-sym');
    if (demoLit.has(key)) cls.push('btn-demo-lit');
    if (userLit.has(key)) cls.push(feedback === 'wrong' ? 'btn-user-wrong' : 'btn-user-lit');
    return cls.join(' ');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="numpad-wrap">

      {/* Mode toggle */}
      <div className="mode-toggle" style={{ maxWidth: '100%' }}>
        <button className={`mode-btn ${gameMode === 'practice' ? 'mode-active' : ''}`}
          onClick={launchPractice}>📱 Practice</button>
        <button className={`mode-btn ${gameMode === 'game' ? 'mode-active' : ''}`}
          onClick={launchGame}>🎮 Game</button>
      </div>

      {/* Score — game mode only */}
      {gameMode === 'game' && (
        <div className="test-score">{score.ok} / {score.total}</div>
      )}

      {/* Target sequence + user progress */}
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

      {/* Phase hint */}
      <div className="numpad-phase">
        {phase === 'idle'     && <span>Tap ▶ Watch to see the path, then replicate it</span>}
        {phase === 'watching' && <span className="phase-watch">◆ Memorise the path…</span>}
        {phase === 'playing'  && <span className="phase-play">▶ Tap the numbers in order</span>}
        {phase === 'result'   && (
          <span className={`phase-result phase-${feedback}`}>
            {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong — watch it again?'}
          </span>
        )}
      </div>

      {/* Main layout: shapes panel + keypad */}
      <div className="numpad-layout">

        {/* Shapes panel (Practice mode only) */}
        {gameMode === 'practice' && (
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
        )}

        {/* Keypad + controls */}
        <div className="keypad-outer">
          <div className="keypad-container" style={{ width: PAD_W, height: PAD_H }}>

            {/* Buttons */}
            <div className="keypad-grid"
              style={{ gridTemplateColumns: `repeat(3, ${BTN_W}px)`, gap: GAP }}>
              {KEYS.map(key => (
                <button key={key} className={btnClass(key)} onClick={() => handleKeyTap(key)}>
                  {key}
                </button>
              ))}
            </div>

            {/* SVG path overlay */}
            <svg className="pad-overlay"
              viewBox={`0 0 ${PAD_W} ${PAD_H}`} width={PAD_W} height={PAD_H}>

              {/* Demo glow */}
              {demoAllPts.length >= 2 && (
                <>
                  <polyline points={demoStr} fill="none" strokeWidth="20"
                    stroke="rgba(126,232,162,0.18)" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={demoStr} fill="none" strokeWidth="3"
                    stroke="#7ee8a2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                </>
              )}

              {/* User glow */}
              {userPts.length >= 2 && (
                <>
                  <polyline points={toSVGStr(userPts, null)} fill="none" strokeWidth="20"
                    stroke={userGlow} strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={toSVGStr(userPts, null)} fill="none" strokeWidth="3"
                    stroke={userColor} strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                </>
              )}

              {/* Demo button highlights (green rings) */}
              {[...demoLit].map(d => {
                const p = BUTTON_POS[d];
                return p ? (
                  <circle key={`dl-${d}`} cx={p.x} cy={p.y} r={BTN_W / 2 - 4}
                    fill="rgba(126,232,162,0.1)" stroke="#7ee8a2" strokeWidth="2" />
                ) : null;
              })}

              {/* User button highlights */}
              {[...userLit].map(d => {
                const p = BUTTON_POS[d];
                return p ? (
                  <circle key={`ul-${d}`} cx={p.x} cy={p.y} r={BTN_W / 2 - 4}
                    fill={userGlow} stroke={userColor} strokeWidth="1.5" />
                ) : null;
              })}

              {/* Start dot marker (first button of path) */}
              {demoPts.length > 0 && (
                <circle cx={demoPts[0].x} cy={demoPts[0].y} r={6}
                  fill="#7ee8a2" opacity="0.95" />
              )}
            </svg>
          </div>

          {/* Controls under keypad */}
          <div className="pad-controls">
            {phase === 'idle' && (
              <button className="btn btn-play-ans btn-sm" onClick={() => startWatch()}>▶ Watch path</button>
            )}
            {phase === 'watching' && (
              <span className="pad-ctrl-hint">◆ Watching…</span>
            )}
            {phase === 'playing' && (
              <>
                <button className="btn btn-sm btn-clear-sm" onClick={clearUser}>⌫ Clear</button>
                <button className="btn btn-sm btn-play-ans" onClick={watchAgain}>↺ Watch again</button>
              </>
            )}
            {phase === 'result' && (
              <>
                <button className="btn btn-sm btn-play-ans" onClick={watchAgain}>↺ Watch again</button>
                <button className="btn btn-sm btn-next" onClick={nextRound}>
                  {gameMode === 'game' ? 'Next →' : 'Retry →'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
