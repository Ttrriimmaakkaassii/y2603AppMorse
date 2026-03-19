import { useState } from 'react';
import NumberLearn from './NumberLearn';
import NumberTest  from './NumberTest';

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
          className={`mode-btn ${view === 'test' ? 'mode-active' : ''}`}
          onClick={() => setView('test')}
        >
          · Tap Test
        </button>
      </div>

      {view === 'learn'
        ? <NumberLearn key="learn" />
        : <NumberTest  key="test"  />
      }
    </div>
  );
}
