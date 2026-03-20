import { useState, useRef } from 'react';
import { MORSE_CODE } from './morseCode';

// Build reverse lookup: morse pattern → character
const REVERSE = Object.fromEntries(
  Object.entries(MORSE_CODE)
    .filter(([k]) => k !== ' ')
    .map(([char, morse]) => [morse, char])
);

const AUTO_MS = 1500;

function decode(seq) {
  if (!seq) return '';
  return REVERSE[seq] ?? '?';
}

export default function ReverseMorse() {
  const [current, setCurrent]   = useState(''); // symbol being built e.g. ".-"
  const [decoded, setDecoded]   = useState(''); // accumulated text
  const currentRef = useRef('');
  const decodedRef = useRef('');
  const autoTimer  = useRef(null);

  function commitCurrent() {
    clearTimeout(autoTimer.current);
    const seq = currentRef.current;
    if (!seq) return;
    const ch = decode(seq);
    const next = decodedRef.current + ch;
    decodedRef.current = next;
    currentRef.current = '';
    setDecoded(next);
    setCurrent('');
  }

  function addSymbol(sym) {
    clearTimeout(autoTimer.current);
    const next = currentRef.current + sym;
    currentRef.current = next;
    setCurrent(next);
    autoTimer.current = setTimeout(commitCurrent, AUTO_MS);
  }

  function addWordSpace() {
    commitCurrent();
    if (decodedRef.current && !decodedRef.current.endsWith(' ')) {
      const next = decodedRef.current + ' ';
      decodedRef.current = next;
      setDecoded(next);
    }
  }

  function handleBackspace() {
    clearTimeout(autoTimer.current);
    if (currentRef.current) {
      const next = currentRef.current.slice(0, -1);
      currentRef.current = next;
      setCurrent(next);
    } else if (decodedRef.current) {
      const next = decodedRef.current.slice(0, -1);
      decodedRef.current = next;
      setDecoded(next);
    }
  }

  function handleClear() {
    clearTimeout(autoTimer.current);
    currentRef.current = '';
    decodedRef.current = '';
    setCurrent('');
    setDecoded('');
  }

  const preview = current ? decode(current) : '';

  return (
    <div className="rm-wrap">
      {/* Output display */}
      <div className="rm-output">
        {decoded
          ? <span className="rm-text">{decoded}</span>
          : <span className="rm-placeholder">decoded text appears here…</span>
        }
        {preview && <span className="rm-preview">{preview}</span>}
      </div>

      {/* Current symbol being built */}
      <div className="rm-current">
        {current
          ? current.split('').map((s, i) => (
              <span key={i} className={`rm-sym ${s === '.' ? 'rm-dot' : 'rm-dash'}`}>{s}</span>
            ))
          : <span className="rm-hint">tap · or − to enter a symbol</span>
        }
      </div>

      {/* Input buttons */}
      <div className="rm-buttons">
        <button className="rm-btn rm-btn-dot"   onClick={() => addSymbol('.')}>·</button>
        <button className="rm-btn rm-btn-dash"  onClick={() => addSymbol('-')}>−</button>
        <button className="rm-btn rm-btn-space" onClick={addWordSpace}>/ Word</button>
        <button className="rm-btn rm-btn-del"   onClick={handleBackspace}>⌫</button>
        <button className="rm-btn rm-btn-clear" onClick={handleClear}>✕ Clear</button>
      </div>

      {current && (
        <div className="rm-auto-hint">auto-commit in 1.5 s — or tap / Word</div>
      )}
    </div>
  );
}
