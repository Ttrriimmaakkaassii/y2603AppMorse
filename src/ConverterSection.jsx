import { useState, useRef } from 'react';
import { textToMorseDetailed } from './morseCode';
import { playMorseConfigured, renderMorseToWav } from './audioEngine';
import MorseTree     from './MorseTree';
import AlphabetPanel from './AlphabetPanel';
import ReverseMorse  from './ReverseMorse';

export default function ConverterSection() {
  const [text, setText]               = useState('');
  const [letters, setLetters]         = useState([]);
  const [playState, setPlayState]     = useState('idle'); // 'idle'|'playing'|'paused'
  const [downloading, setDownloading] = useState(false);
  const [activeLetter, setActiveLetter] = useState(null);
  const [currentStep, setCurrentStep]   = useState(0);
  const [screenFlash, setScreenFlash]   = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed]   = useState(36);
  const [pitch, setPitch]   = useState(550);
  const [volume, setVolume] = useState(75);

  // Feature toggles
  const [soundOn,   setSoundOn]   = useState(true);
  const [torchOn,   setTorchOn]   = useState(false); // 📸 camera torch
  const [screenOn,  setScreenOn]  = useState(false); // 🌟 screen flash
  const [vibrateOn, setVibrateOn] = useState(false);
  const [repeatOn,  setRepeatOn]  = useState(false); // 🔁 loop toggle

  const playerRef        = useRef(null);
  const pauseAtRef       = useRef(0);
  const currentLetterRef = useRef(0);
  const lettersRef       = useRef([]);
  const speedRef         = useRef(36);
  const pitchRef         = useRef(550);
  const volumeRef        = useRef(75);
  const soundOnRef       = useRef(true);
  const torchOnRef       = useRef(false);
  const screenOnRef      = useRef(false);
  const vibrateOnRef     = useRef(false);
  const repeatOnRef      = useRef(false);
  const torchTrackRef    = useRef(null);

  // Keep refs in sync with state on every render
  lettersRef.current   = letters;
  speedRef.current     = speed;
  pitchRef.current     = pitch;
  volumeRef.current    = volume;
  soundOnRef.current   = soundOn;
  torchOnRef.current   = torchOn;
  screenOnRef.current  = screenOn;
  vibrateOnRef.current = vibrateOn;
  repeatOnRef.current  = repeatOn;

  function handleInput(e) {
    const val = e.target.value;
    setText(val);
    setLetters(textToMorseDetailed(val));
    if (playState !== 'idle') stopAll();
  }

  // ── Torch helpers ──────────────────────────────────────────────────────────
  async function openTorch() {
    if (torchTrackRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      torchTrackRef.current = stream.getVideoTracks()[0];
    } catch { /* not supported */ }
  }

  function setTorch(on) {
    torchTrackRef.current?.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
  }

  function closeTorch() {
    setTorch(false);
    torchTrackRef.current?.stop();
    torchTrackRef.current = null;
  }

  function handleTorchToggle() {
    if (torchOn) {
      setTorchOn(false);
      closeTorch();
    } else {
      setTorchOn(true);
      openTorch(); // pre-acquire permission
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  function doPlay(fromIndex) {
    const ls = lettersRef.current;
    if (!ls.length) return;

    playerRef.current = playMorseConfigured(
      ls,
      {
        speed:      speedRef.current,
        pitch:      pitchRef.current,
        volume:     volumeRef.current,
        soundOn:    soundOnRef.current,
        startIndex: fromIndex,
        onFlash: (isOn) => {
          if (screenOnRef.current) setScreenFlash(isOn);
          if (torchOnRef.current)  setTorch(isOn);
        },
        onVibrate: (dur) => {
          if (vibrateOnRef.current) navigator.vibrate?.(dur);
        },
      },
      () => { // onEnd — check repeat before going idle
        if (repeatOnRef.current) {
          setActiveLetter(null);
          setCurrentStep(0);
          doPlay(0); // loop from start
          return;
        }
        setPlayState('idle');
        setActiveLetter(null);
        setCurrentStep(0);
        setScreenFlash(false);
        if (!torchOnRef.current) closeTorch();
      },
      (ev) => { // onEvent
        if (ev.type === 'letter') {
          currentLetterRef.current = ev.index;
          setActiveLetter({ char: ev.char, morse: ev.morse, index: ev.index });
          setCurrentStep(0);
        } else if (ev.type === 'symbol') {
          setCurrentStep(ev.symbolIndex + 1);
        }
      },
    );
    setPlayState('playing');
  }

  function stopAll() {
    playerRef.current?.stop();
    setPlayState('idle');
    setActiveLetter(null);
    setCurrentStep(0);
    setScreenFlash(false);
    pauseAtRef.current = 0;
    // Only close torch if torch toggle is off
    if (!torchOnRef.current) closeTorch();
  }

  function handlePlayPause() {
    if (!letters.length && playState === 'idle') return;

    if (playState === 'playing') {
      pauseAtRef.current = currentLetterRef.current;
      playerRef.current?.stop();
      setPlayState('paused');
      setActiveLetter(null);
      setScreenFlash(false);
    } else if (playState === 'paused') {
      doPlay(pauseAtRef.current);
    } else {
      pauseAtRef.current = 0;
      doPlay(0);
    }
  }

  function handleStop() {
    stopAll();
  }

  // 🔁 is now a toggle — auto-repeat when on
  function handleRepeatToggle() {
    setRepeatOn(v => !v);
  }

  async function handleDownload() {
    if (!letters.length) return;
    setDownloading(true);
    try {
      const morseStr = letters.map(l => l.morse).join(' ');
      const blob = await renderMorseToWav(morseStr);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'morse_code.wav'; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    if (!letters.length) return;
    const morseStr = letters.map(l => l.morse).join(' ');
    try {
      await navigator.share({ title: 'Morse Code', text: `${text}\n\n${morseStr}` });
    } catch { /* cancelled or not supported */ }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const playing = playState === 'playing';
  const hasText = letters.length > 0;

  const morseDisplay = letters.map((item, li) => {
    if (item.morse === '/') return <span key={li} className="word-gap"> / </span>;
    const isActive = activeLetter?.index === li;
    return (
      <span key={li} className={`morse-letter ${isActive ? 'letter-active' : ''}`}>
        {item.morse.split('').map((sym, si) => {
          const isBeeping = isActive && si === currentStep - 1;
          const isPlayed  = isActive && si < currentStep - 1;
          return (
            <span key={si} className={`msym ${sym === '.' ? 'dot' : 'dash'} ${isBeeping ? 'beeping' : ''} ${isPlayed ? 'sym-played' : ''}`}>
              {sym}
            </span>
          );
        })}
      </span>
    );
  });

  const playIcon  = playing ? '⏸' : '▶';
  const playLabel = playing ? 'Pause' : playState === 'paused' ? 'Resume' : 'Play';

  return (
    <div className="converter-section">

      {/* Full-screen white flash overlay */}
      {screenFlash && <div className="flash-overlay" />}

      {/* ── Text input ── */}
      <section className="card">
        <label htmlFor="conv-ti">Your Message</label>
        <textarea
          id="conv-ti"
          value={text}
          onChange={handleInput}
          placeholder="Type something here…"
          rows={3}
        />
      </section>

      {hasText && (
        <section className="card">
          <label>Morse Code</label>
          <div className="morse-display">{morseDisplay}</div>
        </section>
      )}

      {playing && activeLetter && (
        <section className="card letter-viz-card">
          <div className="letter-viz">
            <div className="lv-char">{activeLetter.char}</div>
            <div className="lv-symbols">
              {activeLetter.morse.split('').map((sym, si) => {
                const isBeeping = si === currentStep - 1;
                const isPlayed  = si < currentStep - 1;
                return (
                  <span key={si} className={`lv-sym ${sym === '.' ? 'dot' : 'dash'} ${isBeeping ? 'beeping' : ''} ${isPlayed ? 'sym-played' : ''}`}>
                    {sym === '.' ? '·' : '−'}
                  </span>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {hasText && (
        <section className="card">
          <label>Visual Alphabet — lights follow playback</label>
          <AlphabetPanel activeLetter={activeLetter} currentStep={currentStep} />
        </section>
      )}

      <section className="card tree-card">
        <label>Morse Flowchart</label>
        <MorseTree activeMorse={activeLetter?.morse ?? null} currentStep={currentStep} />
      </section>

      {/* ══ CONTROL BAR ══ */}
      <div className="ctrl-bar">

        {/* Playback group */}
        <div className="ctrl-group ctrl-group-play">
          <button
            className={`ctrl-btn ctrl-play ${playing ? 'ctrl-play-active' : ''}`}
            onClick={handlePlayPause}
            disabled={!hasText && playState === 'idle'}
          >
            <span className="ctrl-icon">{playIcon}</span>
            <span className="ctrl-label">{playLabel}</span>
          </button>
          <button
            className="ctrl-btn ctrl-play"
            onClick={handleStop}
            disabled={playState === 'idle'}
          >
            <span className="ctrl-icon">⏹</span>
            <span className="ctrl-label">Stop</span>
          </button>
          <button
            className={`ctrl-btn ctrl-play ${repeatOn ? 'ctrl-play-repeat' : ''}`}
            onClick={handleRepeatToggle}
            disabled={!hasText}
          >
            <span className="ctrl-icon">🔁</span>
            <span className="ctrl-label">Repeat</span>
          </button>
        </div>

        {/* Toggle group */}
        <div className="ctrl-group ctrl-group-toggle">
          <button
            className={`ctrl-btn ctrl-toggle ${soundOn ? 'ctrl-toggle-sound' : ''}`}
            onClick={() => setSoundOn(v => !v)}
          >
            <span className="ctrl-icon">{soundOn ? '🔊' : '🔇'}</span>
            <span className="ctrl-label">Sound</span>
          </button>
          <button
            className={`ctrl-btn ctrl-toggle ${torchOn ? 'ctrl-toggle-torch' : ''}`}
            onClick={handleTorchToggle}
          >
            <span className="ctrl-icon">📸</span>
            <span className="ctrl-label">Flash</span>
          </button>
          <button
            className={`ctrl-btn ctrl-toggle ${screenOn ? 'ctrl-toggle-screen' : ''}`}
            onClick={() => setScreenOn(v => !v)}
          >
            <span className="ctrl-icon">🌟</span>
            <span className="ctrl-label">Screen</span>
          </button>
          <button
            className={`ctrl-btn ctrl-toggle ${vibrateOn ? 'ctrl-toggle-vib' : ''}`}
            onClick={() => setVibrateOn(v => !v)}
          >
            <span className="ctrl-icon">📳</span>
            <span className="ctrl-label">Vibrate</span>
          </button>
        </div>

        {/* Utility group */}
        <div className="ctrl-group ctrl-group-util">
          <button
            className={`ctrl-btn ctrl-util ${showSettings ? 'ctrl-util-on' : ''}`}
            onClick={() => setShowSettings(v => !v)}
          >
            <span className="ctrl-icon">⚙</span>
            <span className="ctrl-label">Settings</span>
          </button>
          <button
            className="ctrl-btn ctrl-util"
            onClick={handleDownload}
            disabled={!hasText || downloading}
          >
            <span className={`ctrl-icon ${downloading ? 'spin' : ''}`}>
              {downloading ? '⟳' : '💾'}
            </span>
            <span className="ctrl-label">{downloading ? 'Saving…' : 'Save'}</span>
          </button>
          <button
            className="ctrl-btn ctrl-util"
            onClick={handleShare}
            disabled={!hasText}
          >
            <span className="ctrl-icon">📤</span>
            <span className="ctrl-label">Share</span>
          </button>
        </div>

      </div>

      {/* ══ SETTINGS PANEL ══ */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-row">
            <div className="setting-item">
              <span className="setting-label">Speed</span>
              <span className="setting-value">{speed}</span>
              <input type="range" min="5" max="100" value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="setting-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
              <span className="setting-range">5–100</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Pitch</span>
              <span className="setting-value">{pitch} Hz</span>
              <input type="range" min="200" max="1000" value={pitch}
                onChange={e => setPitch(Number(e.target.value))}
                className="setting-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
              <span className="setting-range">200–1000</span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Volume</span>
              <span className="setting-value">{volume}%</span>
              <input type="range" min="0" max="100" value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="setting-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
              <span className="setting-range">0–100</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ MORSE → TEXT ══ */}
      <section className="card">
        <label>Morse → Text</label>
        <ReverseMorse />
      </section>

    </div>
  );
}
