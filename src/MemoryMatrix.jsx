import { useState, useEffect, useCallback } from 'react';

const CONTENT_TYPES = ['Numbers', 'Letters', 'Symbols', 'Mixed'];
const TIMES = [1000, 2000, 3000, 5000];
const SYMBOLS = ['@','#','$','%','&','*','!','?','+','='];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = '0123456789'.split('');

function getPool(type) {
  if (type === 'Numbers') return NUMBERS;
  if (type === 'Letters') return LETTERS;
  if (type === 'Symbols') return SYMBOLS;
  return [...NUMBERS, ...LETTERS.slice(0,10), ...SYMBOLS.slice(0,6)];
}

function makeGrid(size, type) {
  const pool = getPool(type);
  return Array.from({length: size * size}, () => pool[Math.floor(Math.random() * pool.length)]);
}

export default function MemoryMatrix() {
  const [gridSize, setGridSize] = useState(3);
  const [contentType, setContentType] = useState('Numbers');
  const [memorizeTime, setMemorizeTime] = useState(2000);
  const [phase, setPhase] = useState('idle'); // idle | memorize | recall | result
  const [grid, setGrid] = useState([]);
  const [userGrid, setUserGrid] = useState([]);
  const [score, setScore] = useState(null);
  const [bestScore, setBestScore] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [showHow, setShowHow] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startGame = useCallback(() => {
    const g = makeGrid(gridSize, contentType);
    setGrid(g);
    setUserGrid(Array(gridSize * gridSize).fill(''));
    setScore(null);
    setPhase('memorize');
    setCountdown(memorizeTime / 1000);
  }, [gridSize, contentType, memorizeTime]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase('recall');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleCellInput = (i, val) => {
    setUserGrid(g => { const n = [...g]; n[i] = val.slice(-1).toUpperCase(); return n; });
  };

  const submit = () => {
    let correct = 0;
    grid.forEach((v, i) => { if (userGrid[i] === v) correct++; });
    const total = grid.length;
    setScore({ correct, total });
    setTotalGames(t => t + 1);
    if (correct > bestScore) setBestScore(correct);
    setPhase('result');
    // Auto adjust difficulty
    const pct = correct / total;
    if (pct === 1 && gridSize < 9) setGridSize(s => Math.min(s + 1, 9));
    if (pct < 0.5 && gridSize > 3) setGridSize(s => Math.max(s - 1, 3));
  };

  const cellSize = gridSize <= 4 ? 56 : gridSize <= 6 ? 44 : 36;
  const fontSize = gridSize <= 4 ? '1.3rem' : gridSize <= 6 ? '1rem' : '0.85rem';

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">🔲 Memory Matrix</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          A grid of symbols appears for a set time. Memorize it, then recreate it by typing each cell.
          Green = correct, Red = wrong. The grid grows when you score 100% and shrinks when below 50%.
        </div>
      )}

      {phase === 'idle' && (
        <>
          <div className="brain-row">
            <span className="brain-label">Grid:</span>
            {[3,4,5,6,7,8,9].map(s => (
              <button key={s} className={`pill-btn ${gridSize === s ? 'pill-active' : ''}`} onClick={() => setGridSize(s)}>{s}×{s}</button>
            ))}
          </div>
          <div className="brain-row">
            <span className="brain-label">Type:</span>
            {CONTENT_TYPES.map(t => (
              <button key={t} className={`pill-btn ${contentType === t ? 'pill-active' : ''}`} onClick={() => setContentType(t)}>{t}</button>
            ))}
          </div>
          <div className="brain-row">
            <span className="brain-label">Time:</span>
            {TIMES.map(t => (
              <button key={t} className={`pill-btn ${memorizeTime === t ? 'pill-active' : ''}`} onClick={() => setMemorizeTime(t)}>{t/1000}s</button>
            ))}
          </div>
          <button className="brain-btn primary" onClick={startGame}>▶ Start</button>
          {totalGames > 0 && <div className="brain-stats"><span>Best: <b style={{color:'#7ee8a2'}}>{bestScore}</b> cells</span><span>Games: <b>{totalGames}</b></span></div>}
        </>
      )}

      {phase === 'memorize' && (
        <>
          <div className="matrix-countdown">{countdown}s</div>
          <div className="matrix-grid" style={{gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`}}>
            {grid.map((v, i) => (
              <div key={i} className="matrix-cell" style={{width: cellSize, height: cellSize, fontSize}}>{v}</div>
            ))}
          </div>
          <div className="how-box" style={{textAlign:'center'}}>Memorize the grid!</div>
        </>
      )}

      {phase === 'recall' && (
        <>
          <div className="how-box" style={{textAlign:'center', color:'#f6c90e'}}>Now recreate the grid!</div>
          <div className="matrix-grid" style={{gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`}}>
            {userGrid.map((v, i) => (
              <input
                key={i}
                className="matrix-input-cell"
                style={{width: cellSize, height: cellSize, fontSize}}
                maxLength={1}
                value={v}
                onChange={e => handleCellInput(i, e.target.value)}
              />
            ))}
          </div>
          <button className="brain-btn primary" onClick={submit} style={{marginTop:16}}>Submit</button>
        </>
      )}

      {phase === 'result' && score && (
        <>
          <div className={`flash-result ${score.correct === score.total ? 'correct' : score.correct >= score.total/2 ? '' : 'wrong'}`}>
            {score.correct} / {score.total} correct
          </div>
          <div className="matrix-grid" style={{gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`}}>
            {grid.map((v, i) => (
              <div
                key={i}
                className="matrix-cell"
                style={{
                  width: cellSize, height: cellSize, fontSize,
                  background: userGrid[i] === v ? '#1a4a2e' : '#4a1a1a',
                  border: `2px solid ${userGrid[i] === v ? '#7ee8a2' : '#f87171'}`,
                }}
              >
                {v}
                {userGrid[i] !== v && <span className="matrix-user-val">{userGrid[i]}</span>}
              </div>
            ))}
          </div>
          <div className="brain-stats">
            <span>Best: <b style={{color:'#7ee8a2'}}>{bestScore}</b></span>
            <span>Next: <b>{gridSize}×{gridSize}</b></span>
          </div>
          <button className="brain-btn primary" onClick={startGame}>Next Round</button>
          <button className="brain-btn" onClick={() => setPhase('idle')}>Settings</button>
        </>
      )}
    </div>
  );
}
