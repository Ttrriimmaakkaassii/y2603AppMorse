import { useState, useRef } from 'react';
import { textToMorseDetailed } from './morseCode';
import { playMorseConfigured, renderMorseToWav } from './audioEngine';
import MorseTree    from './MorseTree';
import AlphabetPanel from './AlphabetPanel';
import ReverseMorse  from './ReverseMorse';

export default function ConverterSection() {
  const [text, setText]               = useState('');
  const [letters, setLetters]         = useState([]);
  const [playState, setPlayState]     = useState('idle'); // 'idle'|'playing'|'paused'
  const [downloading, setDownloading] = useState(false);
  const [activeLetter, setActiveLetter] = useState(null);
  const [currentStep, setCurrentStep]   = useState(0);
  const [flashOn, setFlashOn]           = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed]   = useState(36);
  const [pitch, setPitch]   = useState(550);
  const [volume, setVolume] = useState(75);

  // Feature toggles
  const [soundOn,   setSoundOn]   = useState(true);
  const [lightOn,   setLightOn]   = useState(false);
  const [vibrateOn, setVibrateOn] = useState(false);

  const playerRef        = useRef(null);
  const pauseAtRef       = useRef(0);
  const currentLetterRef = useRef(0);
  const lettersRef       = useRef([]);
  const speedRef         = useRef(36);
  const pitchRef         = useRef(550);
  const volumeRef        = useRef(75);
  const soundOnRef       = useRef(true);
  const lightOnRef       = useRef(false);
  const vibrateOnRef     = useRef(false);
  const torchTrackRef    = useRef(null);

  // Keep refs in sync
  lettersRef.current  = letters;
  speedRef.current    = speed;
  pitchRef.current    = pitch;
  volumeRef.current   = volume;
  soundOnRef.current  = soundOn;
  lightOnRef.current  = lightOn;
  vibrateOnRef.current = vibrateOn;

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
      const track  = stream.getVideoTracks()[0];
      torchTrackRef.current = track;
    } catch { /* torch not supported, ignore */ }
  }

  function setTorch(on) {
    torchTrackRef.current?.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
  }

  function closeTorch() {
    setTorch(false);
    torchTrackRef.current?.stop();
    torchTrackRef.current = null;
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  function doPlay(fromIndex) {
    const ls = lettersRef.current;
    if (!ls.length) return;

    playerRef.current = playMorseConfigured(
      ls,
      {
        speed:    speedRef.current,
        pitch:    pitchRef.current,
        volume:   volumeRef.current,
        soundOn:  soundOnRef.current,
        startIndex: fromIndex,
        onFlash: (isOn) => {
          if (!lightOnRef.current) return;
          setFlashOn(isOn);
          setTorch(isOn);
        },
        onVibrate: (dur) => {
          if (!vibrateOnRef.current) return;
          navigator.vibrate?.(dur);
        },
      },
      () => { // onEnd
        setPlayState('idle');
        setActiveLetter(null);
        setCurrentStep(0);
        setFlashOn(false);
        closeTorch();
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
    setFlashOn(false);
    closeTorch();
    pauseAtRef.current = 0;
  }

  function handlePlayPause() {
    const ls = lettersRef.current;
    if (!ls.length && playState === 'idle') return;

    if (playState === 'playing') {
      // Pause
      pauseAtRef.current = currentLetterRef.current;
      playerRef.current?.stop();
      setPlayState('paused');
      setActiveLetter(null);
      setFlashOn(false);
    } else if (playState === 'paused') {
      // Resume from saved letter
      if (lightOnRef.current) openTorch();
      doPlay(pauseAtRef.current);
    } else {
      // Start from beginning
      pauseAtRef.current = 0;
      if (lightOnRef.current) openTorch();
      doPlay(0);
    }
  }

  function handleStop() {
    stopAll();
  }

  function handleRepeat() {
    playerRef.current?.stop();
    setActiveLetter(null);
    setCurrentStep(0);
    setFlashOn(false);
    pauseAtRef.current = 0;
    if (lightOnRef.current) openTorch();
    doPlay(0);
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

  // ── Derived display ────────────────────────────────────────────────────────
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

      {/* Full-screen flash overlay */}
      {flashOn && <div className="flash-overlay" />}

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

      {/* ── Morse code display ── */}
      {hasText && (
        <section className="card">
          <label>Morse Code</label>
          <div className="morse-display">{morseDisplay}</div>
        </section>
      )}

      {/* ── Letter visualizer (while playing) ── */}
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

      {/* ── Alphabet panel ── */}
      {hasText && (
        <section className="card">
          <label>Visual Alphabet — lights follow playback</label>
          <AlphabetPanel activeLetter={activeLetter} currentStep={currentStep} />
        </section>
      )}

      {/* ── Morse flowchart ── */}
      <section className="card tree-card">
        <label>Morse Flowchart</label>
        <MorseTree activeMorse={activeLetter?.morse ?? null} currentStep={currentStep} />
      </section>

      {/* ══════════════════════════════════════════
          CONTROL BAR
          ══════════════════════════════════════════ */}
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
            className="ctrl-btn ctrl-play"
            onClick={handleRepeat}
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
            className={`ctrl-btn ctrl-toggle ${lightOn ? 'ctrl-toggle-light' : ''}`}
            onClick={() => setLightOn(v => !v)}
          >
            <span className="ctrl-icon">💡</span>
            <span className="ctrl-label">Light</span>
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

      {/* ══════════════════════════════════════════
          SETTINGS PANEL (collapsible)
          ══════════════════════════════════════════ */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-row">

            <div className="setting-item">
              <span className="setting-label">Speed</span>
              <span className="setting-value">{speed}</span>
              <input
                type="range" min="5" max="100" value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="setting-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <span className="setting-range">5–100</span>
            </div>

            <div className="setting-item">
              <span className="setting-label">Pitch</span>
              <span className="setting-value">{pitch} Hz</span>
              <input
                type="range" min="200" max="1000" value={pitch}
                onChange={e => setPitch(Number(e.target.value))}
                className="setting-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <span className="setting-range">200–1000</span>
            </div>

            <div className="setting-item">
              <span className="setting-label">Volume</span>
              <span className="setting-value">{volume}%</span>
              <input
                type="range" min="0" max="100" value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="setting-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <span className="setting-range">0–100</span>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          REVERSE MORSE (Morse → Text)
          ══════════════════════════════════════════ */}
      <section className="card">
        <label>Morse → Text</label>
        <ReverseMorse />
      </section>

    </div>
  );
}
