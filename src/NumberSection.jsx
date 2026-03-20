import { useState } from 'react';
import NumberLearn from './NumberLearn';
import NumberPad   from './NumberPad';

export default function NumberSection() {
  const [view, setView] = useState('learn');

  return (
    <div className="number-section">
      <div className="mode-toggle">
        <button
          className={`mode-btn ${view === 'learn' ? 'mode-active' : ''}`}
          onClick={() => setView('learn')}
        >
          123 Learn
        </button>
        <button
          className={`mode-btn ${view === 'pad' ? 'mode-active' : ''}`}
          onClick={() => setView('pad')}
        >
          🔢 Keypad Game
        </button>
      </div>

      {view === 'learn'
        ? <NumberLearn key="learn" />
        : <NumberPad   key="pad"   />
      }
    </div>
  );
}
