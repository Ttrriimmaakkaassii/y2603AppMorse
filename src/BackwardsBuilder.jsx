import { useState, useRef } from 'react';

const SENTENCE_BANK = [
  'The cat sat on the mat',
  'She runs every single morning',
  'The sun rose over the hill',
  'He found a key in the door',
  'Blue waves crash on the shore',
  'They left before the storm arrived',
  'The bird sang from a high branch',
  'She wrote three letters that evening',
  'The engine roared down the empty road',
  'He placed the book on the shelf',
  'Light fades when the clouds roll in',
  'They crossed the bridge at dawn',
  'Her voice echoed through the empty hall',
  'The child laughed and ran away fast',
  'Stars appear when the sun goes down',
  'A cold wind swept across the open field',
  'The old man walked slowly past the gate',
  'She mixed the paint with careful strokes',
  'He noticed a shadow behind the curtain',
  'The train departed three minutes ahead of schedule',
  'They found the note hidden beneath a loose stone',
  'She had never seen so many birds in one tree',
];

function getSentenceForLevel(level) {
  // level 1 = 3 words, level up to 13 = 15 words
  const targetWords = Math.min(3 + (level - 1), 15);
  const candidates = SENTENCE_BANK.filter(s => {
    const wc = s.split(' ').length;
    return wc >= targetWords - 1 && wc <= targetWords + 1;
  });
  const pool = candidates.length > 0 ? candidates : SENTENCE_BANK;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function BackwardsBuilder() {
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState('idle'); // idle | memorize | type | result
  const [sentence, setSentence] = useState('');
  const [reversed, setReversed] = useState([]);
  const [typedWords, setTypedWords] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showHow, setShowHow] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const SHOW_TIME = 3000;

  const startRound = () => {
    const s = getSentenceForLevel(level);
    setSentence(s);
    const words = s.split(' ');
    setReversed([...words].reverse());
    setTypedWords([]);
    setWordIdx(0);
    setInputVal('');
    setCountdown(3);
    setPhase('memorize');

    let c = 3;
    timerRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(timerRef.current);
        setPhase('type');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }, 1000);
  };

  const submitWord = () => {
    const expected = reversed[wordIdx];
    const typed = inputVal.trim();
    const isCorrect = typed.toLowerCase() === expected.toLowerCase();
    const newTyped = [...typedWords, { word: typed, correct: isCorrect, expected }];
    setTypedWords(newTyped);
    setInputVal('');

    if (wordIdx + 1 >= reversed.length) {
      // done
      const allCorrect = newTyped.every(w => w.correct);
      const newStreak = allCorrect ? streak + 1 : 0;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setTotal(t => t + 1);
      if (allCorrect) {
        setCorrect(c => c + 1);
        if (level < 13) setLevel(l => l + 1);
      } else {
        if (level > 1) setLevel(l => Math.max(l - 1, 1));
      }
      setPhase('result');
    } else {
      setWordIdx(wordIdx + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      if (phase === 'type') submitWord();
      else if (phase === 'result') startRound();
    }
  };

  const allCorrect = typedWords.length > 0 && typedWords.every(w => w.correct);
  const wordCount = sentence.split(' ').length;

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">🔄 Reverse Builder</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          A sentence flashes for 3 seconds. Then type it BACKWARDS word by word.
          If the sentence is "The cat ran", type "ran", then "cat", then "The".
          Score 100% to advance a level. Level determines sentence length (3–15 words).
        </div>
      )}

      <div className="brain-stats" style={{marginBottom: 8}}>
        <span>Level: <b style={{color:'#7ee8a2'}}>{level}</b></span>
        <span>Words: ~<b>{Math.min(3 + level - 1, 15)}</b></span>
        <span>Score: <b>{correct}/{total}</b></span>
        <span>Streak: <b style={{color: streak > 0 ? '#f6c90e' : 'inherit'}}>{streak}</b></span>
      </div>

      {phase === 'idle' && (
        <button className="brain-btn primary" onClick={startRound}>▶ Start</button>
      )}

      {phase === 'memorize' && (
        <div className="snapshot-reading-wrap">
          <div className="matrix-countdown">{countdown}s</div>
          <div className="backwards-sentence">{sentence}</div>
          <div style={{color:'#64748b', fontSize:'0.85rem', textAlign:'center', marginTop:8}}>Memorize — then type it backwards!</div>
        </div>
      )}

      {phase === 'type' && (
        <>
          <div className="how-box" style={{color:'#f6c90e', textAlign:'center'}}>
            Type word {wordIdx + 1} of {reversed.length} backwards
          </div>
          <div className="backwards-progress">
            {reversed.map((w, i) => (
              <div key={i} className={`bk-slot ${i < wordIdx ? (typedWords[i]?.correct ? 'bk-correct' : 'bk-wrong') : i === wordIdx ? 'bk-current' : 'bk-empty'}`}>
                {i < wordIdx ? typedWords[i]?.word : i === wordIdx ? '?' : '·'}
              </div>
            ))}
          </div>
          <div className="flash-input-row">
            <input
              ref={inputRef}
              className="brain-input"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Word #${wordIdx + 1}…`}
            />
            <button className="brain-btn" onClick={submitWord}>→</button>
          </div>
        </>
      )}

      {phase === 'result' && (
        <>
          <div className={`flash-result ${allCorrect ? 'correct' : 'wrong'}`}>
            {allCorrect ? `✓ Perfect! Level up!` : `✗ Keep practicing`}
          </div>
          <div style={{color:'#94a3b8', fontSize:'0.85rem', marginBottom:8}}>Original: <em>{sentence}</em></div>
          <div className="backwards-progress">
            {reversed.map((w, i) => (
              <div key={i} className={`bk-slot ${typedWords[i]?.correct ? 'bk-correct' : 'bk-wrong'}`} title={`Expected: ${w}`}>
                {typedWords[i]?.word || '?'}
              </div>
            ))}
          </div>
          <div style={{color:'#64748b', fontSize:'0.82rem', marginTop:4}}>
            Correct order: {reversed.join(' → ')}
          </div>
          <div style={{display:'flex', gap:10, marginTop:12}}>
            <button className="brain-btn primary" onClick={startRound}>Next Round</button>
            <button className="brain-btn" onClick={() => setPhase('idle')}>Menu</button>
          </div>
          <div className="brain-stats">
            <span>Best Streak: <b>{bestStreak}</b></span>
          </div>
        </>
      )}
    </div>
  );
}
