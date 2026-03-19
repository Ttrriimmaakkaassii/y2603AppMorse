import { useState, useRef, useEffect } from 'react';
import { MORSE_CODE } from './morseCode';
import { playLetterMorse } from './audioEngine';
import MorseTree from './MorseTree';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HOLD_MS       = 350;   // hold longer than this → dash
const AUTO_CHECK_MS = 1300;  // silence after last symbol → auto-check

function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

export default function TestSection() {
  const [letter, setLetter]         = useState(randomLetter);
  const [input, setInput]           = useState('');   // string of '.' and '-'
  const [holding, setHolding]       = useState(false);
  const [feedback, setFeedback]     = useState(null); // null | 'correct' | 'wrong'
  const [score, setScore]           = useState({ ok: 0, total: 0 });
  const [playingSym, setPlayingSym] = useState(-1);

  // refs so timeouts always see latest values
  const inputRef    = useRef('');
  const letterRef   = useRef(letter);
  const feedbackRef = useRef(null);
  const holdRef     = useRef(null);
  const autoTimer   = useRef(null);
  const playerRef   = useRef(null);

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
    setScore(s => ({ ok: s.ok + (isOk ? 1 : 0), total: s.total + 1 }));
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
    // If feedback is showing, pressing the key starts a fresh attempt on the same letter
    if (feedbackRef.current) resetAttempt();
    clearTimeout(autoTimer.current);
    holdRef.current = Date.now();
    setHolding(true);
  }

  function handleUp(e) {
    e.preventDefault();
    if (!holdRef.current) return;
    const dur = Date.now() - holdRef.current;
    holdRef.current = null;
    setHolding(false);
    addSym(dur >= HOLD_MS ? '-' : '.');
  }

  function handleCancel(e) {
    e.preventDefault();
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
      () => setPlayingSym(-1)
    );
  }

  const correctMorse = MORSE_CODE[letter];

  // Compute what the flowchart should highlight:
  // - No feedback + entering: show the user's traced path
  // - Feedback shown: show the correct answer path (animated during playAnswer)
  const treeMorse = feedback
    ? correctMorse
    : (input || null);

  const treeStep = feedback
    ? (playingSym >= 0 ? playingSym + 1 : correctMorse.length + 1) // full or animating
    : input.length; // how many symbols user has entered

  return (
    <div className="test-section">

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
            {input && (
              <button className="btn btn-sm btn-clear-sm" onClick={clearInput}>⌫ Clear</button>
            )}
            {input && (
              <button className="btn btn-sm btn-check" onClick={doCheck}>✓ Check</button>
            )}
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
                    {correctMorse.split('').map((s, i) => {
                      const isOn = i === playingSym;
                      return (
                        <span key={i} className={`tf-sym ${s === '.' ? 'dot' : 'dash'} ${isOn ? 'tf-on' : ''}`}>
                          {s === '.' ? '·' : '−'}
                        </span>
                      );
                    })}
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

      {/* Morse flowchart — always visible */}
      <section className="card tree-card" style={{ marginTop: '16px' }}>
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

    </div>
  );
}
