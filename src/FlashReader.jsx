import { useState, useRef, useEffect } from 'react';

const WORDS = [
  'cat','dog','run','sky','box','fire','jump','cold','rain','star',
  'moon','fast','slow','read','mind','dark','glow','path','wave','time',
];
const PHRASES = [
  'bright star','dark sky','fast car','cold night','open mind',
  'deep sea','bold move','clear path','sharp eye','quick step',
];
const SENTENCES = [
  'The sky is very blue today.',
  'She reads books every morning.',
  'Fast minds see patterns quickly.',
  'The river flows without stopping.',
  'Stars shine brightest in darkness.',
];

const SPEEDS = [500, 300, 200, 100, 50];
const MODES = ['Words', 'Phrases', 'Sentences'];

function getLib(mode) {
  if (mode === 'Words') return WORDS;
  if (mode === 'Phrases') return PHRASES;
  return SENTENCES;
}

export default function FlashReader() {
  const [speed, setSpeed] = useState(300);
  const [mode, setMode] = useState('Words');
  const [flashing, setFlashing] = useState(false);
  const [shown, setShown] = useState(false);
  const [current, setCurrent] = useState('');
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [bestSpeed, setBestSpeed] = useState(null);
  const [showHow, setShowHow] = useState(false);
  const inputRef = useRef(null);

  const flash = () => {
    const lib = getLib(mode);
    const word = lib[Math.floor(Math.random() * lib.length)];
    setCurrent(word);
    setInput('');
    setResult(null);
    setShown(true);
    setFlashing(true);
    setTimeout(() => {
      setShown(false);
      setFlashing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, speed);
  };

  const check = () => {
    if (!current) return;
    const isCorrect = input.trim().toLowerCase() === current.toLowerCase();
    setResult(isCorrect ? 'correct' : 'wrong');
    const newCorrect = isCorrect ? correct + 1 : correct;
    const newTotal = total + 1;
    setCorrect(newCorrect);
    setTotal(newTotal);
    if (isCorrect) {
      const accuracy = newCorrect / newTotal;
      if (accuracy >= 1 && (!bestSpeed || speed <= bestSpeed)) {
        setBestSpeed(speed);
      }
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      if (!flashing && current && result === null) check();
      else if (result !== null) flash();
    }
  };

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">⚡ Flash Reader</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          A word/phrase flashes briefly on screen. Type exactly what you saw and press Enter.
          Use faster speeds as you improve. Best speed tracks your fastest 100% accuracy run.
        </div>
      )}

      <div className="brain-row">
        <span className="brain-label">Mode:</span>
        {MODES.map(m => (
          <button key={m} className={`pill-btn ${mode === m ? 'pill-active' : ''}`} onClick={() => { setMode(m); setResult(null); setCurrent(''); }}>
            {m}
          </button>
        ))}
      </div>

      <div className="brain-row">
        <span className="brain-label">Speed:</span>
        {SPEEDS.map(s => (
          <button key={s} className={`pill-btn ${speed === s ? 'pill-active' : ''}`} onClick={() => setSpeed(s)}>
            {s}ms
          </button>
        ))}
      </div>

      <div className="flash-stage">
        {flashing && shown ? (
          <span className="flash-word flash-animate">{current}</span>
        ) : (
          <span className="flash-word flash-hidden">·</span>
        )}
      </div>

      <div className="flash-input-row">
        <input
          ref={inputRef}
          className="brain-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type what you saw…"
          disabled={flashing}
        />
        {result === null && !flashing && current && (
          <button className="brain-btn" onClick={check}>Check</button>
        )}
      </div>

      {result && (
        <div className={`flash-result ${result}`}>
          {result === 'correct' ? '✓ Correct!' : `✗ It was: "${current}"`}
          <button className="brain-btn small" style={{marginLeft: 12}} onClick={flash}>Next</button>
        </div>
      )}

      <button className="brain-btn primary" onClick={flash} disabled={flashing}>
        {current ? 'Flash Again' : 'Start Flash'}
      </button>

      <div className="brain-stats">
        <span>Score: <b>{correct}/{total}</b></span>
        {bestSpeed && <span>Best Speed: <b style={{color:'#7ee8a2'}}>{bestSpeed}ms</b></span>}
        {total > 0 && <span>Accuracy: <b>{Math.round(correct/total*100)}%</b></span>}
      </div>
    </div>
  );
}
