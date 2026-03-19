import { useState, useRef, useEffect } from 'react';
import { playDotSequence, playOneDot } from './audioEngine';
import NumberChart, { DIGIT_ORDER, DOT_COUNT } from './NumberChart';

const AUTO_CHECK_MS = 1500;

function randomDigit() {
  return DIGIT_ORDER[Math.floor(Math.random() * DIGIT_ORDER.length)];
}

// tapCount 1-9 → digit '1'-'9'; tapCount 10 → '0'; 0 → null (nothing yet)
function tapToDigit(count) {
  if (count === 0)  return null;
  if (count === 10) return '0';
  return String(count);
}

export default function NumberTest() {
  const [target, setTarget]       = useState(randomDigit);
  const [tapCount, setTapCount]   = useState(0);
  const [feedback, setFeedback]   = useState(null); // null | 'correct' | 'wrong'
  const [score, setScore]         = useState({ ok: 0, total: 0 });
  const [playingDot, setPlayingDot] = useState(-1);

  const targetRef   = useRef(target);
  const tapRef      = useRef(0);
  const feedbackRef = useRef(null);
  const autoTimer   = useRef(null);
  const playerRef   = useRef(null);

  useEffect(() => { targetRef.current = target; },   [target]);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);

  function doCheck() {
    clearTimeout(autoTimer.current);
    const guess = tapToDigit(tapRef.current);
    if (!guess) return;
    const isOk = guess === targetRef.current;
    setFeedback(isOk ? 'correct' : 'wrong');
    setScore(s => ({ ok: s.ok + (isOk ? 1 : 0), total: s.total + 1 }));
  }

  function handleTap() {
    // If feedback showing — reset and start a new attempt on same number
    if (feedbackRef.current) {
      resetAttempt();
      return;
    }
    // Already reached 0 (10 taps) — ignore until auto-check fires
    if (tapRef.current >= 10) return;

    const next = tapRef.current + 1;
    tapRef.current = next;
    setTapCount(next);
    playOneDot();

    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if (!feedbackRef.current) doCheck();
    }, AUTO_CHECK_MS);
  }

  function resetAttempt() {
    clearTimeout(autoTimer.current);
    playerRef.current?.stop();
    tapRef.current = 0;
    setTapCount(0);
    feedbackRef.current = null;
    setFeedback(null);
    setPlayingDot(-1);
  }

  function next() {
    clearTimeout(autoTimer.current);
    playerRef.current?.stop();
    const n = randomDigit();
    targetRef.current = n;
    setTarget(n);
    tapRef.current = 0;
    setTapCount(0);
    feedbackRef.current = null;
    setFeedback(null);
    setPlayingDot(-1);
  }

  function playAnswer() {
    playerRef.current?.stop();
    setPlayingDot(-1);
    playerRef.current = playDotSequence(
      DOT_COUNT[targetRef.current],
      (di) => setPlayingDot(di),
      () => setPlayingDot(-1),
    );
  }

  const guess         = tapToDigit(tapCount);
  const correctCount  = DOT_COUNT[target];

  // Chart: show guess row while entering; correct row (full) after feedback
  const chartActive   = feedback ? target : guess;
  const chartDot      = feedback
    ? (playingDot >= 0 ? playingDot : correctCount - 1)
    : (tapCount > 0 ? tapCount - 1 : -1);

  return (
    <div className="num-test">

      {/* Score */}
      <div className="test-score">{score.ok} / {score.total}</div>

      {/* Target digit */}
      <div className={`test-letter-display ${feedback === 'correct' ? 'tl-correct' : feedback === 'wrong' ? 'tl-wrong' : ''}`}>
        {target}
      </div>

      {/* Live dot display */}
      <div className="test-input-row">
        {tapCount > 0
          ? Array.from({ length: tapCount }, (_, i) => (
              <span key={i} className="ti-sym dot">·</span>
            ))
          : <span className="ti-hint">Tap the button — tap count = number</span>
        }
      </div>

      {/* Current guess label */}
      {guess && (
        <div className="num-tap-guess">
          = <strong>{guess}</strong>
          {tapCount === 10 && <span style={{ color: '#475569', fontSize: '0.8em' }}> (10 taps)</span>}
        </div>
      )}

      {/* Tap button — always visible */}
      <div className="test-controls">
        <button className="morse-key" onClick={handleTap}>
          <span className="key-icon">·</span>
          <span className="key-label">tap to count</span>
        </button>

        {!feedback && tapCount > 0 && (
          <div className="test-btn-row">
            <button className="btn btn-sm btn-clear-sm" onClick={resetAttempt}>⌫ Clear</button>
            <button className="btn btn-sm btn-check"    onClick={doCheck}>✓ Check</button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`test-feedback tf-${feedback}`}>
          <div className="tf-msg">
            {feedback === 'correct'
              ? `✓ Correct! ${target} = ${correctCount} dot${correctCount > 1 ? 's' : ''}`
              : (
                <>
                  ✗ Not quite — {target} needs {correctCount} tap{correctCount > 1 ? 's' : ''}
                  <div className="tf-answer">
                    {Array.from({ length: correctCount }, (_, i) => (
                      <span key={i} className={`tf-sym dot ${i === playingDot ? 'tf-on' : ''}`}>·</span>
                    ))}
                  </div>
                </>
              )
            }
          </div>
          <div className="tf-actions">
            <button className="btn btn-sm btn-play-ans" onClick={playAnswer}>▶ Hear</button>
            <button className="btn btn-sm btn-next"     onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {/* Reference chart — always visible, highlights current state */}
      <section className="card tree-card" style={{ marginTop: 0, width: '100%' }}>
        <label>
          Reference Chart
          {chartActive && (
            <span style={{ marginLeft: 8, color: feedback === 'correct' ? '#7ee8a2' : feedback === 'wrong' ? '#60a5fa' : '#7ee8a2', fontWeight: 700 }}>
              — {chartActive} ({DOT_COUNT[chartActive]} dot{DOT_COUNT[chartActive] > 1 ? 's' : ''})
            </span>
          )}
        </label>
        <NumberChart activeNumber={chartActive} activeDot={chartDot} />
      </section>

    </div>
  );
}
