import { useState, useRef, useEffect } from 'react';
import { MORSE_CODE } from './morseCode';
import { playLetterMorse, startKeyTone } from './audioEngine';
import MorseTree from './MorseTree';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HOLD_MS       = 350;   // hold longer than this → dash
const AUTO_CHECK_MS = 1300;  // silence after last symbol → auto-check

function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

// ─────────────────────────────────────────────
//  Normal mode: see letter → enter morse
// ─────────────────────────────────────────────
function NormalTest({ score, onScore }) {
  const [letter, setLetter]         = useState(randomLetter);
  const [input, setInput]           = useState('');
  const [holding, setHolding]       = useState(false);
  const [feedback, setFeedback]     = useState(null);
  const [playingSym, setPlayingSym] = useState(-1);

  const inputRef    = useRef('');
  const letterRef   = useRef(letter);
  const feedbackRef = useRef(null);
  const holdRef     = useRef(null);
  const autoTimer   = useRef(null);
  const playerRef   = useRef(null);
  const keyToneRef  = useRef(null);

  useEffect(() => { letterRef.current = letter; },   [letter]);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);

  function addSym(sym) {
    const next = inputRef.current + sym;
    inputRef.current = next;
    setInput(next);
    scheduleAutoCheck();
  }

  function scheduleAutoCheck() {
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if (!feedbackRef.current) doCheck();
    }, AUTO_CHECK_MS);
  }

  function doCheck() {
    clearTimeout(autoTimer.current);
    const correct = MORSE_CODE[letterRef.current];
    const isOk = inputRef.current === correct;
    setFeedback(isOk ? 'correct' : 'wrong');
    onScore(isOk);
  }

  function resetAttempt() {
    clearTimeout(autoTimer.current);
    playerRef.current?.stop();
    inputRef.current = '';
    setInput('');
    feedbackRef.current = null;
    setFeedback(null);
    setPlayingSym(-1);
  }

  function handleDown(e) {
    e.preventDefault();
    if (feedbackRef.current) resetAttempt();
    clearTimeout(autoTimer.current);
    holdRef.current = Date.now();
    setHolding(true);
    keyToneRef.current = startKeyTone();
  }

  function handleUp(e) {
    e.preventDefault();
    keyToneRef.current?.stop();
    keyToneRef.current = null;
    if (!holdRef.current) return;
    const dur = Date.now() - holdRef.current;
    holdRef.current = null;
    setHolding(false);
    addSym(dur >= HOLD_MS ? '-' : '.');
  }

  function handleCancel(e) {
    e.preventDefault();
    keyToneRef.current?.stop();
    keyToneRef.current = null;
    if (!holdRef.current) return;
    holdRef.current = null;
    setHolding(false);
    scheduleAutoCheck();
  }

  function clearInput() {
    clearTimeout(autoTimer.current);
    inputRef.current = '';
    setInput('');
  }

  function next() {
    clearTimeout(autoTimer.current);
    playerRef.current?.stop();
    keyToneRef.current?.stop();
    keyToneRef.current = null;
    const l = randomLetter();
    letterRef.current = l;
    setLetter(l);
    inputRef.current = '';
    setInput('');
    feedbackRef.current = null;
    setFeedback(null);
    setPlayingSym(-1);
  }

  function playAnswer() {
    playerRef.current?.stop();
    setPlayingSym(-1);
    playerRef.current = playLetterMorse(
      MORSE_CODE[letterRef.current],
      (si) => setPlayingSym(si),
      () => setPlayingSym(-1),
    );
  }

  const correctMorse = MORSE_CODE[letter];

  const treeMorse = feedback ? correctMorse : (input || null);
  const treeStep  = feedback
    ? (playingSym >= 0 ? playingSym + 1 : correctMorse.length + 1)
    : input.length;

  return (
    <>
      {/* Score */}
      <div className="test-score">{score.ok} / {score.total}</div>

      {/* Letter to identify */}
      <div className={`test-letter-display ${feedback === 'correct' ? 'tl-correct' : feedback === 'wrong' ? 'tl-wrong' : ''}`}>
        {letter}
      </div>

      {/* User's entered symbols */}
      <div className="test-input-row">
        {input.length > 0
          ? input.split('').map((s, i) => (
              <span key={i} className={`ti-sym ${s === '.' ? 'dot' : 'dash'}`}>
                {s === '.' ? '·' : '−'}
              </span>
            ))
          : <span className="ti-hint">Tap · or hold − the button below</span>
        }
      </div>

      {/* Morse key — always visible */}
      <div className="test-controls">
        <button
          className={`morse-key ${holding ? 'key-held' : ''}`}
          onPointerDown={handleDown}
          onPointerUp={handleUp}
          onPointerLeave={handleCancel}
          onPointerCancel={handleCancel}
          onContextMenu={e => e.preventDefault()}
        >
          <span className="key-icon">{holding ? '−' : '·'}</span>
          <span className="key-label">tap · &nbsp; hold −</span>
        </button>

        {!feedback && (
          <div className="test-btn-row">
            {input && <button className="btn btn-sm btn-clear-sm" onClick={clearInput}>⌫ Clear</button>}
            {input && <button className="btn btn-sm btn-check" onClick={doCheck}>✓ Check</button>}
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`test-feedback tf-${feedback}`}>
          <div className="tf-msg">
            {feedback === 'correct'
              ? '✓ Correct!'
              : (
                <>
                  ✗ Not quite — answer:
                  <div className="tf-answer">
                    {correctMorse.split('').map((s, i) => (
                      <span key={i} className={`tf-sym ${s === '.' ? 'dot' : 'dash'} ${i === playingSym ? 'tf-on' : ''}`}>
                        {s === '.' ? '·' : '−'}
                      </span>
                    ))}
                  </div>
                </>
              )
            }
          </div>
          <div className="tf-actions">
            <button className="btn btn-sm btn-play-ans" onClick={playAnswer}>▶ Hear</button>
            <button className="btn btn-sm btn-next" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {/* Flowchart */}
      <section className="card tree-card" style={{ marginTop: 0, width: '100%' }}>
        <label>
          Morse Flowchart
          {feedback && (
            <span style={{ marginLeft: 8, color: feedback === 'correct' ? '#7ee8a2' : '#60a5fa', fontWeight: 700 }}>
              — {letter} ({correctMorse.split('').map(s => s === '.' ? '·' : '−').join('')})
            </span>
          )}
          {!feedback && input && (
            <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, fontSize: '0.8em' }}>
              your path so far
            </span>
          )}
        </label>
        <MorseTree activeMorse={treeMorse} currentStep={treeStep} />
      </section>
    </>
  );
}

// ─────────────────────────────────────────────
//  Reverse mode: hear morse → pick the letter
// ─────────────────────────────────────────────
function ReverseTest({ score, onScore }) {
  const [letter, setLetter]     = useState(randomLetter);
  const [guess, setGuess]       = useState(null);
  const [playing, setPlaying]   = useState(false);
  const [revStep, setRevStep]   = useState(-1);

  const letterRef   = useRef(letter);
  const playerRef   = useRef(null);

  // Auto-play when the letter changes
  useEffect(() => {
    letterRef.current = letter;
    playMorse(letter);
    return () => playerRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);

  function playMorse(l) {
    playerRef.current?.stop();
    setPlaying(true);
    setRevStep(-1);
    playerRef.current = playLetterMorse(
      MORSE_CODE[l],
      (si) => setRevStep(si),
      () => { setPlaying(false); setRevStep(-1); },
    );
  }

  function handleGuess(g) {
    if (guess || playing) return;
    const isOk = g === letterRef.current;
    setGuess(g);
    onScore(isOk);
  }

  function next() {
    playerRef.current?.stop();
    const l = randomLetter();
    letterRef.current = l;
    setLetter(l);
    setGuess(null);
    setRevStep(-1);
  }

  const correctMorse = MORSE_CODE[letter];
  const feedback = guess ? (guess === letter ? 'correct' : 'wrong') : null;

  // Flowchart: show correct path after guess, animate during replay
  const treeMorse = guess ? correctMorse : null;
  const treeStep  = guess
    ? (revStep >= 0 ? revStep + 1 : correctMorse.length + 1)
    : 0;

  return (
    <>
      {/* Score */}
      <div className="test-score">{score.ok} / {score.total}</div>

      {/* Mystery display */}
      <div className={`test-letter-display ${feedback === 'correct' ? 'tl-correct' : feedback === 'wrong' ? 'tl-wrong' : ''}`}>
        {guess ? letter : '?'}
      </div>

      {/* Morse symbols playing */}
      <div className="test-input-row">
        {correctMorse.split('').map((s, i) => {
          const isOn   = i === revStep;
          const isDone = guess && i < correctMorse.length;
          return (
            <span key={i}
              className={`ti-sym ${s === '.' ? 'dot' : 'dash'} ${isOn ? 'ti-playing' : ''} ${isDone && !isOn ? 'ti-done' : ''}`}
            >
              {s === '.' ? '·' : '−'}
            </span>
          );
        })}
      </div>

      {/* Replay button */}
      <button
        className={`btn btn-play-ans btn-sm ${playing ? 'playing' : ''}`}
        onClick={() => playMorse(letter)}
        disabled={playing}
        style={{ alignSelf: 'center' }}
      >
        {playing ? '▶ Playing…' : '▶ Replay'}
      </button>

      {/* Feedback banner */}
      {feedback && (
        <div className={`test-feedback tf-${feedback}`}>
          <div className="tf-msg">
            {feedback === 'correct'
              ? `✓ Correct! It's ${letter}`
              : `✗ Wrong — it was ${letter} (${correctMorse.split('').map(s => s === '.' ? '·' : '−').join('')})`
            }
          </div>
          <div className="tf-actions">
            <button className="btn btn-sm btn-play-ans" onClick={() => playMorse(letter)}>▶ Hear again</button>
            <button className="btn btn-sm btn-next" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {/* Letter picker A–Z */}
      <div className="rev-picker">
        {LETTERS.map(l => {
          let cls = 'rev-letter-btn';
          if (guess) {
            if (l === letter)    cls += ' rev-correct';
            else if (l === guess) cls += ' rev-wrong';
            else                 cls += ' rev-dim';
          }
          return (
            <button
              key={l}
              className={cls}
              onClick={() => handleGuess(l)}
              disabled={!!guess || playing}
            >
              {l}
            </button>
          );
        })}
      </div>

      {/* Flowchart */}
      <section className="card tree-card" style={{ marginTop: 0, width: '100%' }}>
        <label>
          Morse Flowchart
          {guess && (
            <span style={{ marginLeft: 8, color: feedback === 'correct' ? '#7ee8a2' : '#60a5fa', fontWeight: 700 }}>
              — {letter} ({correctMorse.split('').map(s => s === '.' ? '·' : '−').join('')})
            </span>
          )}
          {!guess && <span style={{ marginLeft: 8, color: '#334155', fontWeight: 400, fontSize: '0.8em' }}>revealed after your guess</span>}
        </label>
        <MorseTree activeMorse={treeMorse} currentStep={treeStep} />
      </section>
    </>
  );
}

// ─────────────────────────────────────────────
//  Container — mode toggle + shared score
// ─────────────────────────────────────────────
export default function TestSection() {
  const [mode, setMode] = useState('normal');
  const [normalScore, setNormalScore] = useState({ ok: 0, total: 0 });
  const [revScore,    setRevScore]    = useState({ ok: 0, total: 0 });

  function addNormal(isOk) { setNormalScore(s => ({ ok: s.ok + (isOk ? 1 : 0), total: s.total + 1 })); }
  function addRev(isOk)    { setRevScore   (s => ({ ok: s.ok + (isOk ? 1 : 0), total: s.total + 1 })); }

  return (
    <div className="test-section">

      {/* Mode toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'normal' ? 'mode-active' : ''}`}
          onClick={() => setMode('normal')}
        >
          · − Enter Morse
        </button>
        <button
          className={`mode-btn ${mode === 'reverse' ? 'mode-active' : ''}`}
          onClick={() => setMode('reverse')}
        >
          ? Hear &amp; Guess
        </button>
      </div>

      {mode === 'normal'
        ? <NormalTest  key="normal"  score={normalScore} onScore={addNormal} />
        : <ReverseTest key="reverse" score={revScore}    onScore={addRev}    />
      }
    </div>
  );
}
