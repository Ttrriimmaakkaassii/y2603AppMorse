import { useState, useRef } from 'react';
import { textToMorseDetailed } from './morseCode';
import { playMorseDetailed, renderMorseToWav } from './audioEngine';
import MorseTree from './MorseTree';
import AlphabetPanel from './AlphabetPanel';
import LearnSection from './LearnSection';
import TestSection from './TestSection';
import NumberSection from './NumberSection';
import './App.css';

const TABS = [
  { id: 'converter', label: '⌨ Converter' },
  { id: 'learn',     label: 'ABC Learn' },
  { id: 'test',      label: '· − Test Me' },
  { id: 'numbers',   label: '🔢 Numbers' },
];

export default function App() {
  const [tab, setTab] = useState('converter');

  // ── Converter state ──
  const [text, setText]               = useState('');
  const [letters, setLetters]         = useState([]);
  const [playing, setPlaying]         = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeLetter, setActiveLetter] = useState(null); // {char, morse, index}
  const [currentStep, setCurrentStep] = useState(0);
  const playerRef = useRef(null);

  function handleInput(e) {
    const val = e.target.value;
    setText(val);
    setLetters(textToMorseDetailed(val));
  }

  function handlePlay() {
    if (playing) {
      playerRef.current?.stop();
      setPlaying(false);
      setActiveLetter(null);
      setCurrentStep(0);
      return;
    }
    if (!letters.length) return;
    setPlaying(true);

    playerRef.current = playMorseDetailed(
      letters,
      () => { setPlaying(false); setActiveLetter(null); setCurrentStep(0); },
      (ev) => {
        if (ev.type === 'letter') {
          setActiveLetter({ char: ev.char, morse: ev.morse, index: ev.index });
          setCurrentStep(0);
        } else if (ev.type === 'symbol') {
          setCurrentStep(ev.symbolIndex + 1);
        }
      }
    );
  }

  async function handleDownload() {
    if (!letters.length) return;
    setDownloading(true);
    try {
      const morseStr = letters.map(l => l.morse).join(' ');
      const blob = await renderMorseToWav(morseStr);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'morse_code.wav';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // Per-symbol highlighted morse display
  const morseDisplay = letters.map((item, li) => {
    if (item.morse === '/') {
      return <span key={li} className="word-gap"> / </span>;
    }
    const isActiveLetter = activeLetter?.index === li;
    return (
      <span key={li} className={`morse-letter ${isActiveLetter ? 'letter-active' : ''}`}>
        {item.morse.split('').map((sym, si) => {
          const isBeeping = isActiveLetter && si === currentStep - 1;
          const isPlayed  = isActiveLetter && si < currentStep - 1;
          return (
            <span
              key={si}
              className={`msym ${sym === '.' ? 'dot' : 'dash'} ${isBeeping ? 'beeping' : ''} ${isPlayed ? 'sym-played' : ''}`}
            >
              {sym}
            </span>
          );
        })}
      </span>
    );
  });

  const hasText = letters.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>·−− Morse Code −·−·</h1>
        <p className="subtitle">Type · Hear · Learn · Test</p>
      </header>

      {/* Tab navigation */}
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

        {/* ── CONVERTER TAB ── */}
        {tab === 'converter' && (
          <>
            {/* Input */}
            <section className="card">
              <label htmlFor="ti">Your Message</label>
              <textarea
                id="ti"
                value={text}
                onChange={handleInput}
                placeholder="Type something here…"
                rows={3}
              />
            </section>

            {/* Morse symbol display */}
            {hasText && (
              <section className="card">
                <label>Morse Code</label>
                <div className="morse-display">{morseDisplay}</div>
              </section>
            )}

            {/* Current-letter visualizer (shows when playing) */}
            {playing && activeLetter && (
              <section className="card letter-viz-card">
                <div className="letter-viz">
                  <div className="lv-char">{activeLetter.char}</div>
                  <div className="lv-symbols">
                    {activeLetter.morse.split('').map((sym, si) => {
                      const isBeeping = si === currentStep - 1;
                      const isPlayed  = si < currentStep - 1;
                      return (
                        <span
                          key={si}
                          className={`lv-sym ${sym === '.' ? 'dot' : 'dash'} ${isBeeping ? 'beeping' : ''} ${isPlayed ? 'sym-played' : ''}`}
                        >
                          {sym === '.' ? '·' : '−'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* International visual ABC panel */}
            {hasText && (
              <section className="card">
                <label>Visual Alphabet — lights follow playback</label>
                <AlphabetPanel activeLetter={activeLetter} currentStep={currentStep} />
              </section>
            )}

            {/* Morse flowchart tree */}
            <section className="card tree-card">
              <label>Morse Flowchart</label>
              <MorseTree
                activeMorse={activeLetter?.morse ?? null}
                currentStep={currentStep}
              />
            </section>

            {/* Controls */}
            <section className="controls">
              <button
                className={`btn btn-play ${playing ? 'active' : ''}`}
                onClick={handlePlay}
                disabled={!hasText}
              >
                <span className="bi">{playing ? '⏹' : '▶'}</span>
                {playing ? 'Stop' : 'Play'}
              </button>

              <button
                className="btn btn-dl"
                onClick={handleDownload}
                disabled={!hasText || downloading}
              >
                <span className={`bi ${downloading ? 'spin' : ''}`}>
                  {downloading ? '⟳' : '⬇'}
                </span>
                {downloading ? 'Rendering…' : 'Download WAV'}
              </button>
            </section>
          </>
        )}

        {/* ── LEARN TAB ── */}
        {tab === 'learn' && <LearnSection />}

        {/* ── TEST ME TAB ── */}
        {tab === 'test' && <TestSection />}

        {/* ── NUMBERS TAB ── */}
        {tab === 'numbers' && <NumberSection />}

      </main>

      <footer className="app-footer">
        · = dot &nbsp;|&nbsp; − = dash &nbsp;|&nbsp; / = word gap
      </footer>
    </div>
  );
}
