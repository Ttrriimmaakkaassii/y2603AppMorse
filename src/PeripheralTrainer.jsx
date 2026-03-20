import { useState, useRef, useEffect } from 'react';

const WORD_SETS = [
  ['cat', 'sun', 'run'],
  ['blue', 'fast', 'cold'],
  ['tree', 'move', 'rock'],
  ['ship', 'glow', 'step'],
  ['fire', 'calm', 'jump'],
  ['dark', 'open', 'wide'],
  ['star', 'flow', 'deep'],
  ['mind', 'race', 'high'],
  ['gold', 'wave', 'soft'],
  ['bold', 'true', 'free'],
  ['rain', 'push', 'grey'],
  ['wind', 'stop', 'long'],
  ['peak', 'down', 'warm'],
  ['road', 'near', 'glad'],
  ['note', 'hear', 'spin'],
];

const SPREADS = [
  { label: 'Narrow', gap: 120 },
  { label: 'Medium', gap: 200 },
  { label: 'Wide',   gap: 290 },
  { label: 'Extreme',gap: 380 },
];

export default function PeripheralTrainer() {
  const [spreadIdx, setSpreadIdx] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | show | type | result
  const [current, setCurrent] = useState(null); // {left, center, right}
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showHow, setShowHow] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const SHOW_DURATION = 2000;

  const getTriple = () => {
    const set = WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)];
    return { left: set[0], center: set[1], right: set[2] };
  };

  const next = () => {
    const triple = getTriple();
    setCurrent(triple);
    setInput('');
    setResult(null);
    setPhase('show');
    timerRef.current = setTimeout(() => {
      setPhase('type');
      setTimeout(() => inputRef.current?.focus(), 50);
    }, SHOW_DURATION);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const check = () => {
    if (!current) return;
    const parts = input.trim().toLowerCase().split(/\s+/);
    const expected = [current.left, current.center, current.right].map(w => w.toLowerCase());
    const allCorrect = parts.length === 3 && parts.every((p, i) => p === expected[i]);
    setResult(allCorrect ? 'correct' : 'wrong');
    const newTotal = total + 1;
    const newStreak = allCorrect ? streak + 1 : 0;
    setCorrect(c => allCorrect ? c + 1 : c);
    setTotal(newTotal);
    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);
    setPhase('result');
    // auto advance spread
    if (allCorrect && spreadIdx < SPREADS.length - 1 && newStreak > 0 && newStreak % 5 === 0) {
      setSpreadIdx(s => Math.min(s + 1, SPREADS.length - 1));
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      if (phase === 'type') check();
      else if (phase === 'result') next();
    }
  };

  const spread = SPREADS[spreadIdx].gap;

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">↔ Peripheral Trainer</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          Three words appear simultaneously: one in the center and one on each side.
          Keep your eyes fixed on the center dot. Read all three without moving your eyes.
          Type all three words separated by spaces. Spread increases automatically every 5 in a row.
        </div>
      )}

      <div className="brain-row">
        <span className="brain-label">Spread:</span>
        {SPREADS.map((s, i) => (
          <button key={s.label} className={`pill-btn ${spreadIdx === i ? 'pill-active' : ''}`} onClick={() => setSpreadIdx(i)}>
            {s.label}
          </button>
        ))}
      </div>

      {phase === 'idle' && (
        <button className="brain-btn primary" onClick={next}>▶ Start</button>
      )}

      {(phase === 'show' || phase === 'type' || phase === 'result') && (
        <div className="peripheral-stage">
          {phase === 'show' && current && (
            <>
              <span className="periph-side" style={{left: `calc(50% - ${spread}px - 60px)`}}>{current.left}</span>
              <div className="periph-center-dot" />
              <span className="periph-side" style={{right: `calc(50% - ${spread}px - 60px)`}}>{current.right}</span>
              <span className="periph-center-word">{current.center}</span>
            </>
          )}
          {(phase === 'type' || phase === 'result') && (
            <>
              <div className="periph-center-dot-fixed" />
              <div style={{fontSize:'0.85rem', color:'#64748b', marginTop: 80}}>
                {phase === 'type' ? 'Type all 3 words you saw:' : ''}
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'type' && (
        <div className="flash-input-row">
          <input
            ref={inputRef}
            className="brain-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="left center right"
          />
          <button className="brain-btn" onClick={check}>Check</button>
        </div>
      )}

      {phase === 'result' && result && current && (
        <>
          <div className={`flash-result ${result}`}>
            {result === 'correct'
              ? `✓ Correct! "${current.left} ${current.center} ${current.right}"`
              : `✗ Was: "${current.left} ${current.center} ${current.right}"  You: "${input.trim()}"`}
          </div>
          <button className="brain-btn primary" onClick={next}>Next →</button>
        </>
      )}

      <div className="brain-stats">
        <span>Score: <b>{correct}/{total}</b></span>
        <span>Streak: <b style={{color: streak > 0 ? '#7ee8a2' : 'inherit'}}>{streak}</b></span>
        <span>Best Streak: <b>{bestStreak}</b></span>
        <span>Spread: <b>{SPREADS[spreadIdx].label}</b></span>
      </div>
    </div>
  );
}
