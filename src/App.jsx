import { useState } from 'react';
import ConverterSection from './ConverterSection';
import LearnSection from './LearnSection';
import TestSection from './TestSection';
import NumberSection from './NumberSection';
import BrainSection from './BrainSection';
import './App.css';

const TABS = [
  { id: 'converter', label: '⌨ Converter' },
  { id: 'learn',     label: 'ABC Learn' },
  { id: 'test',      label: '· − Test Me' },
  { id: 'numbers',   label: '🔢 Numbers' },
  { id: 'brain',     label: '🧠 Brain' },
];

export default function App() {
  const [tab, setTab] = useState('converter');

  return (
    <div className="app">
      <header className="app-header">
        <h1>·−− Morse Code −·−·</h1>
        <p className="subtitle">Type · Hear · Learn · Test</p>
      </header>

      <nav className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'converter' && <ConverterSection />}
        {tab === 'learn'     && <LearnSection />}
        {tab === 'test'      && <TestSection />}
        {tab === 'numbers'   && <NumberSection />}
        {tab === 'brain'     && <BrainSection />}
      </main>

      <footer className="app-footer">
        · = dot &nbsp;|&nbsp; − = dash &nbsp;|&nbsp; / = word gap
      </footer>
    </div>
  );
}
