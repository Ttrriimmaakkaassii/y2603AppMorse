import { useState, useRef, useEffect, useCallback } from 'react';
import { MORSE_CODE } from './morseCode';
import { playMorse }  from './audioEngine';

// ── Reverse lookup: morse pattern → character ──────────────────────────────
const REVERSE = Object.fromEntries(
  Object.entries(MORSE_CODE)
    .filter(([k]) => k !== ' ')
    .map(([char, morse]) => [morse, char])
);

function decodeSym(seq) { return seq ? (REVERSE[seq] ?? '?') : ''; }

function textToMorseStr(text) {
  return text.toUpperCase().split('').map(c => MORSE_CODE[c] ?? '').filter(Boolean).join(' ');
}

const RM_TABS = [
  { id: 'manual', icon: '✋', label: 'Manual'     },
  { id: 'audio',  icon: '🎵', label: 'Audio File' },
  { id: 'mic',    icon: '🎤', label: 'Microphone' },
  { id: 'camera', icon: '📷', label: 'Camera'     },
];

// ── Morse timing state machine (hook) ──────────────────────────────────────
// Used by both Mic and Camera tabs.
function useMorseDetector({ onAppend, dashThresholdMs = 250 }) {
  const stateRef      = useRef('idle'); // 'idle' | 'sounding'
  const beepStartRef  = useRef(0);
  const curSymRef     = useRef('');
  const letterTRef    = useRef(null);
  const wordTRef      = useRef(null);
  const onAppendRef   = useRef(onAppend);
  onAppendRef.current = onAppend;

  const LETTER_GAP = dashThresholdMs * 3;
  const WORD_GAP   = dashThresholdMs * 7;

  const onHigh = useCallback((now) => {
    clearTimeout(letterTRef.current);
    clearTimeout(wordTRef.current);
    if (stateRef.current !== 'sounding') {
      stateRef.current = 'sounding';
      beepStartRef.current = now;
    }
  }, []);

  const onLow = useCallback((now) => {
    if (stateRef.current !== 'sounding') return;
    const dur = now - beepStartRef.current;
    curSymRef.current += dur >= dashThresholdMs ? '-' : '.';
    stateRef.current = 'silent';

    letterTRef.current = setTimeout(() => {
      const s = curSymRef.current;
      if (s) {
        onAppendRef.current?.({ char: decodeSym(s), morse: s });
        curSymRef.current = '';
      }
      wordTRef.current = setTimeout(() => {
        onAppendRef.current?.({ char: ' ', morse: '' });
      }, WORD_GAP - LETTER_GAP);
    }, LETTER_GAP);
  }, [dashThresholdMs, LETTER_GAP, WORD_GAP]);

  const reset = useCallback(() => {
    clearTimeout(letterTRef.current);
    clearTimeout(wordTRef.current);
    stateRef.current = 'idle';
    curSymRef.current = '';
  }, []);

  const getCurrentMorse = useCallback(() => curSymRef.current, []);

  return { onHigh, onLow, reset, getCurrentMorse };
}

// ── Audio file analysis ────────────────────────────────────────────────────
function analyzeAudioBuffer(samples, sampleRate) {
  const WIN_MS   = 10;
  const winSize  = Math.max(1, Math.floor(sampleRate * WIN_MS / 1000));
  const numWins  = Math.floor(samples.length / winSize);
  if (numWins === 0) return null;

  const rms = new Float32Array(numWins);
  for (let i = 0; i < numWins; i++) {
    let sum = 0;
    for (let j = 0; j < winSize; j++) sum += (samples[i * winSize + j] || 0) ** 2;
    rms[i] = Math.sqrt(sum / winSize);
  }

  const sorted     = Float32Array.from(rms).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const peak       = sorted[sorted.length - 1] || 0;
  if (peak - noiseFloor < 0.005) return null; // silent file

  const threshold = noiseFloor + (peak - noiseFloor) * 0.25;

  // Detect on/off segments
  const segs = [];
  let isOn = rms[0] > threshold, start = 0;
  for (let i = 1; i < numWins; i++) {
    const on = rms[i] > threshold;
    if (on !== isOn) {
      segs.push({ type: isOn ? 'on' : 'off', ms: (i - start) * WIN_MS });
      start = i; isOn = on;
    }
  }
  segs.push({ type: isOn ? 'on' : 'off', ms: (numWins - start) * WIN_MS });

  // Filter glitches < 20 ms
  const filtered = segs.filter(s => s.ms >= 20);

  const onDurs = filtered.filter(s => s.type === 'on').map(s => s.ms).sort((a, b) => a - b);
  if (!onDurs.length) return null;

  const dotUnit      = onDurs[Math.floor(onDurs.length * 0.3)] || 80;
  const dashThresh   = dotUnit * 2;
  const letterThresh = dotUnit * 2.5;
  const wordThresh   = dotUnit * 5;

  let tokens = [], cur = '';
  for (const seg of filtered) {
    if (seg.type === 'on') {
      cur += seg.ms < dashThresh ? '.' : '-';
    } else {
      if (seg.ms >= wordThresh)   { if (cur) { tokens.push(cur); cur = ''; } tokens.push('/'); }
      else if (seg.ms >= letterThresh) { if (cur) { tokens.push(cur); cur = ''; } }
    }
  }
  if (cur) tokens.push(cur);

  const morse = tokens.join(' ');
  const text  = tokens.map(t => t === '/' ? ' ' : (REVERSE[t] || '?')).join('');
  return { morse, text, rms: Array.from(rms), segs: filtered, dotUnit };
}

// ── Tab 1: Manual ──────────────────────────────────────────────────────────
function ManualTab({ onAppend, onPreviewChange }) {
  const curRef   = useRef('');
  const [cur, setCur] = useState('');
  const timer    = useRef(null);

  function commit() {
    clearTimeout(timer.current);
    const s = curRef.current;
    if (!s) return;
    onAppend({ char: decodeSym(s), morse: s });
    curRef.current = ''; setCur(''); onPreviewChange('');
  }

  function addSym(sym) {
    clearTimeout(timer.current);
    const next = curRef.current + sym;
    curRef.current = next; setCur(next); onPreviewChange(next);
    timer.current = setTimeout(commit, 1500);
  }

  function wordSpace() { commit(); onAppend({ char: ' ', morse: '' }); }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="rm-tab-body">
      <div className="rm-cur-sym">
        {cur
          ? cur.split('').map((s, i) => (
              <span key={i} className={`rm-sym ${s === '.' ? 'rm-dot' : 'rm-dash'}`}>{s}</span>
            ))
          : <span className="rm-hint">tap · or − to build a symbol</span>
        }
        {cur && <span className="rm-cur-preview"> = {decodeSym(cur)}</span>}
      </div>
      <div className="rm-buttons">
        <button className="rm-btn rm-btn-dot"   onClick={() => addSym('.')}>·</button>
        <button className="rm-btn rm-btn-dash"  onClick={() => addSym('-')}>−</button>
        <button className="rm-btn rm-btn-space" onClick={wordSpace}>/ Word</button>
      </div>
      {cur && <div className="rm-auto-hint">auto-commit in 1.5 s — or tap / Word</div>}
    </div>
  );
}

// ── Tab 2: Audio File ──────────────────────────────────────────────────────
function AudioFileTab({ onResult }) {
  const [status,   setStatus]   = useState('idle'); // idle|loading|done|error
  const [progress, setProgress] = useState(0);
  const [result,   setResult]   = useState(null);
  const [fileName, setFileName] = useState('');
  const fileRef    = useRef(null);
  const canvasRef  = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name); setStatus('loading'); setProgress(10); setResult(null);
    try {
      const buf = await file.arrayBuffer();
      setProgress(35);
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const abuf = await ctx.decodeAudioData(buf);
      ctx.close();
      setProgress(65);
      const samples = abuf.getChannelData(0);
      const analysis = analyzeAudioBuffer(samples, abuf.sampleRate);
      setProgress(100);
      if (!analysis) { setStatus('error'); return; }
      // Downsample for waveform display (max 4000 pts)
      const step = Math.max(1, Math.floor(samples.length / 2000));
      const wave = [];
      for (let i = 0; i < samples.length; i += step) wave.push(samples[i]);
      setResult({ ...analysis, wave });
      setStatus('done');
      if (analysis.text) onResult(analysis.text);
    } catch (e) {
      console.error('Audio analysis:', e);
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!result?.wave || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const W = canvas.width  = canvas.offsetWidth  || 300;
    const H = canvas.height = 72;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);

    // Draw on-segment highlights
    if (result.segs?.length) {
      const totalMs = result.segs.reduce((a, s) => a + s.ms, 0);
      let x = 0;
      for (const seg of result.segs) {
        const w = (seg.ms / totalMs) * W;
        if (seg.type === 'on') {
          ctx.fillStyle = 'rgba(126,232,162,0.18)';
          ctx.fillRect(x, 0, w, H);
        }
        x += w;
      }
    }

    // Waveform
    const wave = result.wave;
    ctx.strokeStyle = '#7ee8a2'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x2 = 0; x2 < W; x2++) {
      const idx = Math.floor((x2 / W) * wave.length);
      const y   = H / 2 - wave[idx] * (H * 0.42);
      x2 === 0 ? ctx.moveTo(x2, y) : ctx.lineTo(x2, y);
    }
    ctx.stroke();
  }, [result]);

  return (
    <div className="rm-tab-body">
      <input ref={fileRef} type="file" accept=".mp3,.wav,.ogg,audio/*"
        style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

      <button className="rm-upload-btn"
        onClick={() => fileRef.current?.click()}
        disabled={status === 'loading'}>
        {status === 'loading' ? '⟳ Processing…' : '📂 Choose Audio File'}
      </button>

      {fileName && <div className="rm-file-name">{fileName}</div>}

      {status === 'loading' && (
        <div className="rm-progress-wrap">
          <div className="rm-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {status === 'error' && (
        <div className="rm-error">No morse detected — try a cleaner recording with clear beeps.</div>
      )}

      {status === 'done' && result && (
        <>
          <canvas ref={canvasRef} className="rm-waveform" />
          {result.morse && <div className="rm-file-morse">{result.morse}</div>}
        </>
      )}

      {status === 'idle' && (
        <div className="rm-tab-hint">
          Upload a .wav / .mp3 recording of morse code beeps.
          Short beeps = dots, long beeps = dashes.
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Microphone ──────────────────────────────────────────────────────
function MicTab({ onAppend }) {
  const [active,   setActive]  = useState(false);
  const [level,    setLevel]   = useState(0);
  const [preview,  setPreview] = useState('');
  const [error,    setError]   = useState('');

  const streamRef  = useRef(null);
  const ctxRef     = useRef(null);
  const rafRef     = useRef(null);
  const activeRef  = useRef(false);
  const isHighRef  = useRef(false);

  function handleAppend(ev) { onAppend(ev); setPreview(''); }

  const { onHigh, onLow, reset, getCurrentMorse } = useMorseDetector({
    onAppend: handleAppend,
    dashThresholdMs: 250,
  });

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      activeRef.current = true;
      setActive(true);

      const buf = new Float32Array(analyser.fftSize);
      function frame() {
        if (!activeRef.current) return;
        rafRef.current = requestAnimationFrame(frame);
        analyser.getFloatTimeDomainData(buf);
        let rms = 0;
        for (const v of buf) rms += v * v;
        rms = Math.sqrt(rms / buf.length);
        setLevel(Math.min(1, rms / 0.25));
        const now = performance.now();
        if (rms > 0.03) {
          if (!isHighRef.current) { isHighRef.current = true;  onHigh(now); }
        } else {
          if (isHighRef.current)  { isHighRef.current = false; onLow(now);  }
        }
        setPreview(getCurrentMorse());
      }
      rafRef.current = requestAnimationFrame(frame);
    } catch {
      setError('Microphone access denied.');
    }
  }

  function stop() {
    activeRef.current = false;
    isHighRef.current = false;
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close(); ctxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    reset(); setActive(false); setLevel(0); setPreview('');
  }

  useEffect(() => () => { activeRef.current = false; stop(); }, []); // eslint-disable-line

  return (
    <div className="rm-tab-body">
      {error && <div className="rm-error">{error}</div>}
      <div className="rm-live-row">
        <button className={`rm-toggle-btn ${active ? 'rm-toggle-on' : ''}`}
          onClick={active ? stop : start}>
          {active ? '⏹ Stop' : '🎤 Start Listening'}
        </button>
        {active && (
          <div className="rm-level-wrap">
            <div className="rm-level-bar" style={{ width: `${level * 100}%` }} />
          </div>
        )}
      </div>
      {active && (
        <div className="rm-live-morse">
          {preview
            ? preview.split('').map((s, i) => (
                <span key={i} className={`rm-sym ${s === '.' ? 'rm-dot' : 'rm-dash'}`}>{s}</span>
              ))
            : <span className="rm-hint">listening…</span>
          }
        </div>
      )}
      {!active && !error && (
        <div className="rm-tab-hint">
          Tap Start, then beep short for · and long for −.<br />
          Silence between beeps commits letters automatically.
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Camera ──────────────────────────────────────────────────────────
function CameraTab({ onAppend }) {
  const [active,      setActive]      = useState(false);
  const [brightness,  setBrightness]  = useState(0);
  const [sensitivity, setSensitivity] = useState(55);
  const [preview,     setPreview]     = useState('');
  const [error,       setError]       = useState('');

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const activeRef  = useRef(false);
  const sensRef    = useRef(55);
  const isHighRef  = useRef(false);
  sensRef.current  = sensitivity;

  function handleAppend(ev) { onAppend(ev); setPreview(''); }

  const { onHigh, onLow, reset, getCurrentMorse } = useMorseDetector({
    onAppend: handleAppend,
    dashThresholdMs: 250,
  });

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: 320, height: 240 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      activeRef.current = true;
      setActive(true);
      const canvas = canvasRef.current;
      const ctx2d  = canvas?.getContext('2d');

      function frame() {
        if (!activeRef.current) return;
        rafRef.current = requestAnimationFrame(frame);
        if (!videoRef.current || !canvas || !ctx2d) return;
        const vw = videoRef.current.videoWidth  || 64;
        const vh = videoRef.current.videoHeight || 64;
        canvas.width = 64; canvas.height = 64;
        ctx2d.drawImage(videoRef.current, (vw-64)/2, (vh-64)/2, 64, 64, 0, 0, 64, 64);
        const data = ctx2d.getImageData(0, 0, 64, 64).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i+1] + data[i+2]) / 3;
        const norm = sum / (64 * 64 * 255);
        setBrightness(norm);
        const now       = performance.now();
        const threshold = sensRef.current / 100;
        if (norm > threshold) {
          if (!isHighRef.current) { isHighRef.current = true;  onHigh(now); }
        } else {
          if (isHighRef.current)  { isHighRef.current = false; onLow(now);  }
        }
        setPreview(getCurrentMorse());
      }
      rafRef.current = requestAnimationFrame(frame);
    } catch {
      setError('Camera access denied.');
    }
  }

  function stop() {
    activeRef.current = false;
    isHighRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    reset(); setActive(false); setBrightness(0); setPreview('');
  }

  useEffect(() => () => { activeRef.current = false; stop(); }, []); // eslint-disable-line

  return (
    <div className="rm-tab-body">
      {error && <div className="rm-error">{error}</div>}

      <div className="rm-live-row">
        <button className={`rm-toggle-btn ${active ? 'rm-toggle-on' : ''}`}
          onClick={active ? stop : start}>
          {active ? '⏹ Stop' : '📷 Start Camera'}
        </button>
      </div>

      {active && (
        <div className="rm-camera-layout">
          <video ref={videoRef} className="rm-video-preview" muted playsInline autoPlay />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Brightness meter + threshold marker */}
          <div className="rm-bri-row">
            <span className="rm-bri-label">Brightness</span>
            <div className="rm-bri-bar-wrap">
              <div className="rm-bri-fill" style={{ width: `${brightness * 100}%` }} />
              <div className="rm-bri-thresh" style={{ left: `${sensitivity}%` }} />
            </div>
          </div>

          <div className="rm-sens-row">
            <span className="rm-sens-label">Threshold: {sensitivity}%</span>
            <input type="range" min="10" max="90" value={sensitivity}
              onChange={e => setSensitivity(Number(e.target.value))}
              className="rm-sens-slider" />
          </div>
        </div>
      )}

      {active && (
        <div className="rm-live-morse">
          {preview
            ? preview.split('').map((s, i) => (
                <span key={i} className={`rm-sym ${s === '.' ? 'rm-dot' : 'rm-dash'}`}>{s}</span>
              ))
            : <span className="rm-hint">point at flashing light…</span>
          }
        </div>
      )}

      {!active && !error && (
        <div className="rm-tab-hint">
          Point camera at a flashing light source.<br />
          Short flash = · &nbsp; Long flash = −
        </div>
      )}
    </div>
  );
}

// ── Main ReverseMorse component ────────────────────────────────────────────
export default function ReverseMorse() {
  const [activeTab, setActiveTab] = useState('manual');
  const [decoded,   setDecoded]   = useState('');
  const [preview,   setPreview]   = useState('');
  const playerRef = useRef(null);

  function append({ char }) {
    if (char) setDecoded(d => d + char);
  }

  function setFull(text) {
    setDecoded(text);
    setPreview('');
  }

  function backspace() {
    setDecoded(d => d.slice(0, -1));
  }

  function clear() {
    setDecoded('');
    setPreview('');
  }

  function handleTabChange(id) {
    setActiveTab(id);
    setPreview('');
  }

  function playDecoded() {
    if (!decoded.trim()) return;
    playerRef.current?.stop();
    const morseStr = textToMorseStr(decoded.trim());
    if (morseStr) playerRef.current = playMorse(morseStr, () => {});
  }

  const previewChar = preview ? decodeSym(preview) : '';

  return (
    <div className="rm-wrap">

      {/* ── Shared output box ── */}
      <div className="rm-output">
        {decoded
          ? <span className="rm-text">{decoded}</span>
          : <span className="rm-placeholder">decoded text appears here…</span>
        }
        {previewChar && <span className="rm-preview"> {previewChar}</span>}
      </div>

      {/* ── Shared controls ── */}
      <div className="rm-shared-controls">
        <button className="rm-ctrl-btn rm-ctrl-play"
          onClick={playDecoded} disabled={!decoded.trim()}>
          ▶ Play
        </button>
        <button className="rm-ctrl-btn rm-ctrl-back"
          onClick={backspace} disabled={!decoded}>
          ⌫
        </button>
        <button className="rm-ctrl-btn rm-ctrl-clear"
          onClick={clear} disabled={!decoded && !preview}>
          ✕ Clear
        </button>
      </div>

      {/* ── Tab navigation ── */}
      <div className="rm-tabs">
        {RM_TABS.map(t => (
          <button key={t.id}
            className={`rm-tab-btn ${activeTab === t.id ? 'rm-tab-active' : ''}`}
            onClick={() => handleTabChange(t.id)}>
            <span className="rm-tab-icon">{t.icon}</span>
            <span className="rm-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="rm-tab-content">
        {activeTab === 'manual' && (
          <ManualTab
            onAppend={append}
            onPreviewChange={setPreview}
          />
        )}
        {activeTab === 'audio' && (
          <AudioFileTab onResult={setFull} />
        )}
        {activeTab === 'mic' && (
          <MicTab onAppend={append} />
        )}
        {activeTab === 'camera' && (
          <CameraTab onAppend={append} />
        )}
      </div>

    </div>
  );
}
