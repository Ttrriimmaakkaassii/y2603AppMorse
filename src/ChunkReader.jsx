import { useState, useRef, useEffect, useCallback } from 'react';

const PASSAGES = [
  {
    text: `The ancient forests breathe with life. Every tree tells a story of centuries. Roots run deep beneath the soil. Light filters through the canopy above. Animals find shelter in the branches. The cycle of seasons shapes everything. Nothing in nature exists in isolation. All things connect in intricate patterns.`,
    questions: [
      { q: 'What do roots do?', a: 'Run deep beneath the soil', opts: ['Grow upward','Run deep beneath the soil','Absorb sunlight','Store water above ground'] },
      { q: 'What shapes everything in nature?', a: 'The cycle of seasons', opts: ['Rainfall','Wind patterns','The cycle of seasons','Animal movement'] },
    ],
  },
  {
    text: `Cities grow and change over time. Neighborhoods transform with each generation. Old buildings hold forgotten memories. New towers rise toward the sky. People move in and out constantly. Communities form around shared spaces. Streets connect one story to another. Urban life pulses with restless energy.`,
    questions: [
      { q: 'What do old buildings hold?', a: 'Forgotten memories', opts: ['Modern art','Forgotten memories','Business offices','Empty rooms'] },
      { q: 'What does urban life do?', a: 'Pulses with restless energy', opts: ['Grows slowly','Becomes quiet','Pulses with restless energy','Follows strict patterns'] },
    ],
  },
];

const CHUNK_SIZES = [2, 3, 4];
const WPMS = [100, 150, 200, 300, 400];

function chunkText(text, size) {
  const words = text.trim().split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks;
}

export default function ChunkReader() {
  const [chunkSize, setChunkSize] = useState(2);
  const [wpm, setWpm] = useState(200);
  const [passageIdx, setPassageIdx] = useState(0);
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentChunk, setCurrentChunk] = useState('');
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(null);
  const [showHow, setShowHow] = useState(false);
  const intervalRef = useRef(null);
  const idxRef = useRef(0);

  const getText = useCallback(() => {
    return useCustom && customText.trim() ? customText : PASSAGES[passageIdx].text;
  }, [useCustom, customText, passageIdx]);

  const start = () => {
    const ch = chunkText(getText(), chunkSize);
    setChunks(ch);
    idxRef.current = 0;
    setChunkIdx(0);
    setDone(false);
    setAnswers({});
    setShowResults(false);
    setScore(null);
    setCurrentChunk(ch[0]);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const ms = Math.round((60000 / wpm) * chunkSize);
    intervalRef.current = setInterval(() => {
      idxRef.current += 1;
      const ch = chunkText(getText(), chunkSize);
      if (idxRef.current >= ch.length) {
        clearInterval(intervalRef.current);
        setRunning(false);
        setDone(true);
        setCurrentChunk('');
      } else {
        setCurrentChunk(ch[idxRef.current]);
        setChunkIdx(idxRef.current);
      }
    }, ms);
    return () => clearInterval(intervalRef.current);
  }, [running, wpm, chunkSize, getText]);

  const pause = () => {
    if (running) { clearInterval(intervalRef.current); setRunning(false); }
    else if (!done) setRunning(true);
  };

  const submitAnswers = () => {
    if (useCustom) { setShowResults(true); return; }
    const qs = PASSAGES[passageIdx].questions;
    let correct = 0;
    qs.forEach((q, i) => { if (answers[i] === q.a) correct++; });
    setScore(correct);
    setShowResults(true);
  };

  const progress = chunks.length ? Math.round((chunkIdx / chunks.length) * 100) : 0;

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">👁 Chunk Reader</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          Multiple words flash at once in the center. Train your eyes to take in wider groups of words.
          The guide lines show your reading window. Start at 2 words and work up to 4.
        </div>
      )}

      {!running && !done && (
        <>
          <div className="brain-row">
            <span className="brain-label">Chunk:</span>
            {CHUNK_SIZES.map(s => (
              <button key={s} className={`pill-btn ${chunkSize === s ? 'pill-active' : ''}`} onClick={() => setChunkSize(s)}>
                {s} words
              </button>
            ))}
          </div>

          <div className="brain-row">
            <span className="brain-label">WPM:</span>
            {WPMS.map(w => (
              <button key={w} className={`pill-btn ${wpm === w ? 'pill-active' : ''}`} onClick={() => setWpm(w)}>{w}</button>
            ))}
          </div>

          <div className="brain-row" style={{gap:8}}>
            <button className={`pill-btn ${!useCustom ? 'pill-active' : ''}`} onClick={() => setUseCustom(false)}>Built-in</button>
            <button className={`pill-btn ${useCustom ? 'pill-active' : ''}`} onClick={() => setUseCustom(true)}>My Text</button>
          </div>

          {!useCustom && (
            <div className="brain-row">
              {PASSAGES.map((p, i) => (
                <button key={i} className={`pill-btn ${passageIdx === i ? 'pill-active' : ''}`} onClick={() => setPassageIdx(i)}>P{i+1}</button>
              ))}
            </div>
          )}

          {useCustom && (
            <textarea className="brain-textarea" rows={4} placeholder="Paste your text…" value={customText} onChange={e => setCustomText(e.target.value)} />
          )}

          <button className="brain-btn primary" onClick={start}>▶ Start</button>
        </>
      )}

      {(running || (!done && chunks.length > 0)) && (
        <>
          <div className="chunk-stage">
            <div className="chunk-guide-left" />
            <span className="chunk-word">{currentChunk}</span>
            <div className="chunk-guide-right" />
          </div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{width: `${progress}%`}} />
          </div>
          <div className="brain-stats">
            <span>Chunk {chunkIdx + 1} / {chunks.length}</span>
            <span>{wpm} WPM</span>
          </div>
          <button className="brain-btn" onClick={pause}>{running ? '⏸ Pause' : '▶ Resume'}</button>
        </>
      )}

      {done && !showResults && (
        <div className="rsvp-quiz">
          <div className="flash-result correct" style={{marginBottom:12}}>✓ Done!</div>
          {!useCustom && PASSAGES[passageIdx].questions.map((q, i) => (
            <div key={i} className="quiz-question">
              <div className="quiz-q">{q.q}</div>
              <div className="quiz-opts">
                {q.opts.map(opt => (
                  <button key={opt} className={`quiz-opt ${answers[i] === opt ? 'quiz-selected' : ''}`}
                    onClick={() => setAnswers(a => ({...a, [i]: opt}))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {useCustom && <div className="how-box">Custom text — no questions. Great work!</div>}
          <button className="brain-btn primary" onClick={submitAnswers}>Submit</button>
        </div>
      )}

      {showResults && (
        <div className="quiz-results">
          {score !== null && (
            <div className={`flash-result ${score >= 1 ? 'correct' : 'wrong'}`}>
              Score: {score} / {PASSAGES[passageIdx].questions.length}
            </div>
          )}
          {!useCustom && PASSAGES[passageIdx].questions.map((q, i) => (
            <div key={i} className="quiz-review">
              <b>{q.q}</b>
              <div style={{color: answers[i] === q.a ? '#7ee8a2' : '#f87171'}}>
                {answers[i] || 'none'} {answers[i] === q.a ? '✓' : `✗ (${q.a})`}
              </div>
            </div>
          ))}
          <button className="brain-btn primary" onClick={() => { setDone(false); setChunks([]); }}>Try Again</button>
        </div>
      )}
    </div>
  );
}
