import { useState, useRef } from 'react';
import { playDotSequence } from './audioEngine';
import NumberChart, { DIGIT_ORDER, DOT_COUNT } from './NumberChart';

export default function NumberLearn() {
  const [activeNum, setActiveNum] = useState(null);
  const [activeDot, setActiveDot] = useState(-1);
  const playerRef = useRef(null);

  function playNumber(n) {
    playerRef.current?.stop();
    setActiveNum(n);
    setActiveDot(-1);
    playerRef.current = playDotSequence(
      DOT_COUNT[n],
      (di) => setActiveDot(di),
      () => { setActiveNum(null); setActiveDot(-1); },
    );
  }

  return (
    <div className="num-learn">
      <p className="section-sub">Tap any number to see and hear its dot pattern</p>

      <div className="num-learn-grid">
        {DIGIT_ORDER.map(n => {
          const total    = DOT_COUNT[n];
          const isActive = activeNum === n;
          return (
            <button
              key={n}
              className={`num-card ${isActive ? 'num-card-active' : ''}`}
              onClick={() => playNumber(n)}
            >
              <div className="num-card-digit">{n}</div>
              <div className="num-card-dots">
                {Array.from({ length: total }, (_, i) => (
                  <span
                    key={i}
                    className={`num-dot ${isActive && i <= activeDot ? 'nd-on' : ''}`}
                  />
                ))}
              </div>
              <div className="num-card-label">
                {total === 10 ? '10 dots' : `${total} dot${total > 1 ? 's' : ''}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Reference chart — highlights active number in sync */}
      <section className="card" style={{ marginTop: '18px' }}>
        <label>
          Reference Chart
          {activeNum && (
            <span style={{ marginLeft: 8, color: '#7ee8a2', fontWeight: 700 }}>
              — {activeNum}  ({DOT_COUNT[activeNum]} dot{DOT_COUNT[activeNum] > 1 ? 's' : ''})
            </span>
          )}
        </label>
        <NumberChart activeNumber={activeNum} activeDot={activeDot} onNumberClick={playNumber} />
      </section>
    </div>
  );
}
