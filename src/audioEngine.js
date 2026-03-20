// Morse code timing (standard: 1 unit = dotDuration ms)
const DOT_DURATION = 80;      // ms
const DASH_DURATION = 240;    // ms (3x dot)
const SYMBOL_GAP = 80;        // gap between symbols in a letter
const LETTER_GAP = 240;       // gap between letters
const WORD_GAP = 560;         // gap between words (7x dot)
const FREQUENCY = 700;        // Hz

function buildSchedule(morseString) {
  const schedule = [];
  let time = 0;

  for (const char of morseString) {
    if (char === '.') {
      schedule.push({ type: 'tone', start: time, duration: DOT_DURATION });
      time += DOT_DURATION + SYMBOL_GAP;
    } else if (char === '-') {
      schedule.push({ type: 'tone', start: time, duration: DASH_DURATION });
      time += DASH_DURATION + SYMBOL_GAP;
    } else if (char === ' ') {
      // gap between letters (already have symbol gap, add difference)
      time += LETTER_GAP - SYMBOL_GAP;
    } else if (char === '/') {
      // word gap
      time += WORD_GAP - SYMBOL_GAP;
    }
  }

  return { schedule, totalDuration: time };
}

export function playMorse(morseString, onEnd) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const { schedule, totalDuration } = buildSchedule(morseString);
  const startTime = ctx.currentTime + 0.1;

  for (const { start, duration } of schedule) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = FREQUENCY;
    osc.type = 'sine';

    const s = startTime + start / 1000;
    const d = duration / 1000;
    gain.gain.setValueAtTime(0, s);
    gain.gain.linearRampToValueAtTime(0.8, s + 0.005);
    gain.gain.setValueAtTime(0.8, s + d - 0.005);
    gain.gain.linearRampToValueAtTime(0, s + d);

    osc.start(s);
    osc.stop(s + d + 0.01);
  }

  const timeout = setTimeout(() => {
    ctx.close();
    if (onEnd) onEnd();
  }, totalDuration + 300);

  return {
    stop: () => {
      clearTimeout(timeout);
      ctx.close();
      if (onEnd) onEnd();
    },
  };
}

export async function renderMorseToWav(morseString) {
  const { schedule, totalDuration } = buildSchedule(morseString);
  const sampleRate = 44100;
  const totalSamples = Math.ceil(((totalDuration + 500) / 1000) * sampleRate);

  const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);

  for (const { start, duration } of schedule) {
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.frequency.value = FREQUENCY;
    osc.type = 'sine';

    const s = start / 1000 + 0.05;
    const d = duration / 1000;
    gain.gain.setValueAtTime(0, s);
    gain.gain.linearRampToValueAtTime(0.8, s + 0.005);
    gain.gain.setValueAtTime(0.8, s + d - 0.005);
    gain.gain.linearRampToValueAtTime(0, s + d);

    osc.start(s);
    osc.stop(s + d + 0.01);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

// Detailed playback with per-letter / per-symbol callbacks for visual sync.
// letters: [{char, morse}] from textToMorseDetailed
// onEvent: ({ type:'letter'|'symbol'|'done', index, char, morse, symbolIndex })
export function playMorseDetailed(letters, onEnd, onEvent) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const ctxStart = ctx.currentTime + 0.1; // 100 ms lookahead
  const START_MS = 100;

  let timeMs = 0;
  let stopped = false;
  const timers = [];

  const fire = (fn, delayMs) => {
    timers.push(setTimeout(() => { if (!stopped) fn(); }, delayMs));
  };

  for (let li = 0; li < letters.length; li++) {
    const { char, morse } = letters[li];

    if (morse === '/') {
      timeMs += WORD_GAP;
      continue;
    }
    if (!morse) continue;

    const letterStartMs = timeMs;
    fire(() => onEvent?.({ type: 'letter', index: li, char, morse }), START_MS + letterStartMs);

    for (let si = 0; si < morse.length; si++) {
      const sym = morse[si];
      const dur = sym === '.' ? DOT_DURATION : DASH_DURATION;
      const symStartMs = timeMs;

      // Schedule audio tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = FREQUENCY;
      osc.type = 'sine';
      const s = ctxStart + symStartMs / 1000;
      const d = dur / 1000;
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.8, s + 0.005);
      gain.gain.setValueAtTime(0.8, s + d - 0.005);
      gain.gain.linearRampToValueAtTime(0, s + d);
      osc.start(s);
      osc.stop(s + d + 0.01);

      fire(() => onEvent?.({ type: 'symbol', letterIndex: li, symbolIndex: si }), START_MS + symStartMs);

      timeMs += dur + SYMBOL_GAP;
    }

    // Add extra letter gap before next non-space letter
    if (li < letters.length - 1) {
      const next = letters[li + 1];
      if (next.morse && next.morse !== '/') {
        timeMs += LETTER_GAP - SYMBOL_GAP;
      }
    }
  }

  fire(() => {
    ctx.close();
    onEnd?.();
    onEvent?.({ type: 'done' });
  }, START_MS + timeMs + 300);

  return {
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
      ctx.close();
      onEnd?.();
    },
  };
}

// Single-letter playback with per-symbol callback (used by Learn & Test sections)
export function playLetterMorse(morse, onSymbol, onEnd) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const ctxStart = ctx.currentTime + 0.05;
  const START_MS = 50;
  let timeMs = 0;
  let stopped = false;
  const timers = [];

  const fire = (fn, delayMs) => {
    timers.push(setTimeout(() => { if (!stopped) fn(); }, delayMs));
  };

  for (let si = 0; si < morse.length; si++) {
    const sym = morse[si];
    const dur = sym === '.' ? DOT_DURATION : DASH_DURATION;
    const symStartMs = timeMs;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = FREQUENCY;
    osc.type = 'sine';
    const s = ctxStart + symStartMs / 1000;
    const d = dur / 1000;
    gain.gain.setValueAtTime(0, s);
    gain.gain.linearRampToValueAtTime(0.8, s + 0.005);
    gain.gain.setValueAtTime(0.8, s + d - 0.005);
    gain.gain.linearRampToValueAtTime(0, s + d);
    osc.start(s);
    osc.stop(s + d + 0.01);

    const capturedSi = si;
    fire(() => onSymbol?.(capturedSi), START_MS + symStartMs);
    timeMs += dur + SYMBOL_GAP;
  }

  fire(() => {
    ctx.close();
    onEnd?.();
  }, START_MS + timeMs + 200);

  return {
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
      ctx.close();
    },
  };
}

// Play N dot-beeps sequentially; fires onDot(index) per beep, onEnd when done.
export function playDotSequence(count, onDot, onEnd) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const ctxStart = ctx.currentTime + 0.05;
  const START_MS = 50;
  let timeMs = 0;
  let stopped = false;
  const timers = [];
  const fire = (fn, ms) => timers.push(setTimeout(() => { if (!stopped) fn(); }, ms));

  for (let i = 0; i < count; i++) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = FREQUENCY; osc.type = 'sine';
    const s = ctxStart + timeMs / 1000, d = DOT_DURATION / 1000;
    gain.gain.setValueAtTime(0, s);
    gain.gain.linearRampToValueAtTime(0.7, s + 0.005);
    gain.gain.setValueAtTime(0.7, s + d - 0.005);
    gain.gain.linearRampToValueAtTime(0, s + d);
    osc.start(s); osc.stop(s + d + 0.01);
    const ci = i;
    fire(() => onDot?.(ci), START_MS + timeMs);
    timeMs += DOT_DURATION + SYMBOL_GAP;
  }
  fire(() => { ctx.close(); onEnd?.(); }, START_MS + timeMs + 200);
  return { stop: () => { stopped = true; timers.forEach(clearTimeout); ctx.close(); } };
}

// Play a single instant dot-beep (tap feedback in test mode).
export function playOneDot() {
  const ctx  = new (window.AudioContext || window.webkitAudioContext)();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.value = FREQUENCY; osc.type = 'sine';
  const s = ctx.currentTime, d = DOT_DURATION / 1000;
  gain.gain.setValueAtTime(0, s);
  gain.gain.linearRampToValueAtTime(0.65, s + 0.005);
  gain.gain.setValueAtTime(0.65, s + d - 0.005);
  gain.gain.linearRampToValueAtTime(0, s + d);
  osc.start(s); osc.stop(s + d + 0.01);
  setTimeout(() => ctx.close(), DOT_DURATION + 80);
}

// Live key tone — plays continuously while the morse key is held down.
// Call stop() on release to cut the tone cleanly.
export function startKeyTone() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = FREQUENCY;
  osc.type = 'sine';
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.7, now + 0.006);
  osc.start(now);
  return {
    stop: () => {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.008);
      osc.stop(t + 0.015);
      setTimeout(() => ctx.close(), 80);
    },
  };
}

// Configurable playback: speed (5-100, default 36 = 1×), pitch Hz, volume 0-100.
// Callbacks: onFlash(isOn) for light sync, onVibrate(durationMs) for haptic sync.
// startIndex: letter index to start from (for resume-after-pause).
export function playMorseConfigured(letters, settings, onEnd, onEvent) {
  const {
    speed = 36, pitch = 550, volume = 75,
    soundOn = true, onFlash, onVibrate, startIndex = 0,
  } = settings;

  const scale   = 36 / Math.max(5, speed);
  const dotDur  = Math.round(80  * scale);
  const dashDur = Math.round(240 * scale);
  const symGap  = Math.round(80  * scale);
  const letGap  = Math.round(240 * scale);
  const wordGap = Math.round(560 * scale);
  const vol     = soundOn ? Math.max(0, Math.min(1, volume / 100)) * 0.9 : 0;

  const ctx      = new (window.AudioContext || window.webkitAudioContext)();
  const ctxStart = ctx.currentTime + 0.1;
  const START_MS = 100;

  let timeMs  = 0;
  let stopped = false;
  const timers = [];
  const fire = (fn, ms) => timers.push(setTimeout(() => { if (!stopped) fn(); }, ms));

  const subset = letters.slice(startIndex);

  for (let li = 0; li < subset.length; li++) {
    const { char, morse } = subset[li];
    const realIndex = li + startIndex;

    if (morse === '/') { timeMs += wordGap; continue; }
    if (!morse) continue;

    const letterStartMs = timeMs;
    fire(() => onEvent?.({ type: 'letter', index: realIndex, char, morse }), START_MS + letterStartMs);

    for (let si = 0; si < morse.length; si++) {
      const sym = morse[si];
      const dur = sym === '.' ? dotDur : dashDur;
      const symStartMs = timeMs;

      if (vol > 0) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = pitch; osc.type = 'sine';
        const s = ctxStart + symStartMs / 1000;
        const d = dur / 1000;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(vol, s + 0.005);
        gain.gain.setValueAtTime(vol, s + d - 0.005);
        gain.gain.linearRampToValueAtTime(0, s + d);
        osc.start(s); osc.stop(s + d + 0.01);
      }

      const capturedDur = dur;
      fire(() => {
        onFlash?.(true);
        onVibrate?.(capturedDur);
        onEvent?.({ type: 'symbol', letterIndex: realIndex, symbolIndex: si });
      }, START_MS + symStartMs);
      fire(() => onFlash?.(false), START_MS + symStartMs + dur);

      timeMs += dur + symGap;
    }

    if (li < subset.length - 1) {
      const next = subset[li + 1];
      if (next.morse && next.morse !== '/') timeMs += letGap - symGap;
    }
  }

  fire(() => { ctx.close(); onEnd?.(); onEvent?.({ type: 'done' }); }, START_MS + timeMs + 300);

  return {
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
      ctx.close();
      onFlash?.(false);
    },
  };
}

function audioBufferToWav(buffer) {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const numSamples = samples.length;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = numSamples * 2;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
