import { useState, useRef, useEffect, useCallback } from 'react';

const PASSAGES = [
  {
    text: `The human brain is a remarkable organ. It processes information at incredible speeds. Scientists have studied it for centuries. Yet many mysteries remain unsolved. Every thought you have originates here. Every memory is stored within its folds. Learning changes its physical structure. Reading trains the brain to focus deeply.`,
    questions: [
      { q: 'What have scientists done for centuries?', a: 'Studied the brain', opts: ['Built computers','Studied the brain','Mapped the stars','Trained athletes'] },
      { q: 'What does learning do to the brain?', a: 'Changes its physical structure', opts: ['Makes it smaller','Changes its physical structure','Speeds up reflexes','Reduces memory'] },
      { q: 'Where do thoughts originate?', a: 'The brain', opts: ['The heart','The spine','The brain','The eyes'] },
    ],
  },
  {
    text: `Speed reading is a skill anyone can develop. The key is reducing subvocalization. Most people silently say each word as they read. This limits reading speed to speaking speed. Trained readers process words visually. They see patterns and meaning directly. Practice makes this process automatic. Your brain adapts faster than you think.`,
    questions: [
      { q: 'What limits reading speed for most people?', a: 'Speaking speed', opts: ['Eye movement','Speaking speed','Page size','Word length'] },
      { q: 'What do trained readers do with words?', a: 'Process them visually', opts: ['Say them aloud','Skip them','Process them visually','Write them down'] },
      { q: 'What is key to speed reading?', a: 'Reducing subvocalization', opts: ['Reading aloud','Reducing subvocalization','Using a pointer','Blinking less'] },
    ],
  },
  {
    text: `Focus is the gateway to memory. When you pay full attention to something you remember it better. Distractions fragment your concentration. The modern world is full of interruptions. Training your focus takes daily practice. Start with five minutes of deep attention. Gradually extend this to longer sessions. Your reading comprehension will improve dramatically.`,
    questions: [
      { q: 'What is the gateway to memory?', a: 'Focus', opts: ['Sleep','Repetition','Focus','Exercise'] },
      { q: 'How should you start training focus?', a: 'Five minutes of deep attention', opts: ['One hour sessions','Five minutes of deep attention','Reading novels','Meditation apps'] },
      { q: 'What fragments your concentration?', a: 'Distractions', opts: ['Silence','Sleep','Distractions','Caffeine'] },
    ],
  },
];

const WPMS = [100, 200, 300, 400, 500, 600];

export default function RSVPTrainer() {
  const [wpm, setWpm] = useState(300);
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [passageIdx, setPassageIdx] = useState(0);
  const [words, setWords] = useState([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [score, setScore] = useState(null);
  const intervalRef = useRef(null);
  const idxRef = useRef(0);

  const getWords = useCallback(() => {
    if (useCustom && customText.trim()) return customText.trim().split(/\s+/);
    return PASSAGES[passageIdx].text.trim().split(/\s+/);
  }, [useCustom, customText, passageIdx]);

  const start = () => {
    const w = getWords();
    setWords(w);
    idxRef.current = 0;
    setWordIdx(0);
    setDone(false);
    setAnswers({});
    setShowResults(false);
    setScore(null);
    setCurrentWord(w[0]);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const ms = Math.round(60000 / wpm);
    intervalRef.current = setInterval(() => {
      idxRef.current += 1;
      const w = getWords();
      if (idxRef.current >= w.length) {
        clearInterval(intervalRef.current);
        setRunning(false);
        setDone(true);
        setCurrentWord('');
      } else {
        setCurrentWord(w[idxRef.current]);
        setWordIdx(idxRef.current);
      }
    }, ms);
    return () => clearInterval(intervalRef.current);
  }, [running, wpm, getWords]);

  const pause = () => {
    if (running) {
      clearInterval(intervalRef.current);
      setRunning(false);
    } else if (!done) {
      setRunning(true);
    }
  };

  const submitAnswers = () => {
    if (useCustom) { setShowResults(true); return; }
    const qs = PASSAGES[passageIdx].questions;
    let correct = 0;
    qs.forEach((q, i) => { if (answers[i] === q.a) correct++; });
    setScore(correct);
    setShowResults(true);
  };

  const progress = words.length ? Math.round((wordIdx / words.length) * 100) : 0;

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">📖 RSVP Trainer</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          Words from a passage flash one at a time in the center. Keep your eyes still — let the words come to you.
          After the passage ends, answer comprehension questions. Adjust WPM to challenge yourself.
        </div>
      )}

      {!running && !done && (
        <>
          <div className="brain-row">
            <span className="brain-label">WPM:</span>
            {WPMS.map(w => (
              <button key={w} className={`pill-btn ${wpm === w ? 'pill-active' : ''}`} onClick={() => setWpm(w)}>{w}</button>
            ))}
          </div>

          <div className="brain-row" style={{gap: 8}}>
            <button className={`pill-btn ${!useCustom ? 'pill-active' : ''}`} onClick={() => setUseCustom(false)}>Built-in</button>
            <button className={`pill-btn ${useCustom ? 'pill-active' : ''}`} onClick={() => setUseCustom(true)}>My Text</button>
          </div>

          {!useCustom && (
            <div className="brain-row">
              {PASSAGES.map((p, i) => (
                <button key={i} className={`pill-btn ${passageIdx === i ? 'pill-active' : ''}`} onClick={() => setPassageIdx(i)}>
                  P{i + 1}
                </button>
              ))}
            </div>
          )}

          {useCustom && (
            <textarea
              className="brain-textarea"
              rows={4}
              placeholder="Paste your text here…"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
            />
          )}

          <button className="brain-btn primary" onClick={start}>▶ Start Reading</button>
        </>
      )}

      {(running || (!done && words.length > 0)) && (
        <>
          <div className="rsvp-stage">
            <span className="rsvp-word">{currentWord}</span>
          </div>

          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{width: `${progress}%`}} />
          </div>
          <div className="brain-stats">
            <span>{wordIdx + 1} / {words.length} words</span>
            <span>{wpm} WPM</span>
          </div>

          <button className="brain-btn" onClick={pause}>
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
        </>
      )}

      {done && !showResults && (
        <div className="rsvp-quiz">
          <div className="flash-result correct" style={{marginBottom:12}}>✓ Passage complete!</div>
          {!useCustom && PASSAGES[passageIdx].questions.map((q, i) => (
            <div key={i} className="quiz-question">
              <div className="quiz-q">{q.q}</div>
              <div className="quiz-opts">
                {q.opts.map(opt => (
                  <button
                    key={opt}
                    className={`quiz-opt ${answers[i] === opt ? 'quiz-selected' : ''}`}
                    onClick={() => setAnswers(a => ({...a, [i]: opt}))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {useCustom && <div className="how-box">Custom text — no questions. Well done!</div>}
          <button className="brain-btn primary" onClick={submitAnswers}>Submit</button>
        </div>
      )}

      {showResults && (
        <div className="quiz-results">
          {score !== null && (
            <div className={`flash-result ${score >= 2 ? 'correct' : 'wrong'}`}>
              Score: {score} / {PASSAGES[passageIdx].questions.length}
            </div>
          )}
          {!useCustom && PASSAGES[passageIdx].questions.map((q, i) => (
            <div key={i} className="quiz-review">
              <b>{q.q}</b>
              <div style={{color: answers[i] === q.a ? '#7ee8a2' : '#f87171'}}>
                Your answer: {answers[i] || 'none'} {answers[i] === q.a ? '✓' : `✗ (${q.a})`}
              </div>
            </div>
          ))}
          <button className="brain-btn primary" onClick={() => { setDone(false); setWords([]); setCurrentWord(''); }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
