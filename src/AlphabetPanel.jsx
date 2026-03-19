import { MORSE_CODE } from './morseCode';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function AlphabetPanel({ activeLetter, currentStep }) {
  return (
    <div className="alphabet-panel">
      {ALPHABET.map(letter => {
        const morse = MORSE_CODE[letter];
        const isActive = activeLetter?.char === letter;
        return (
          <div key={letter} className={`alpha-card ${isActive ? 'alpha-active' : ''}`}>
            <div className="alpha-letter">{letter}</div>
            <div className="alpha-lights">
              {morse.split('').map((sym, si) => {
                const isOn  = isActive && si === currentStep - 1;
                const isDone = isActive && si < currentStep - 1;
                return (
                  <span
                    key={si}
                    className={`alpha-light ${sym === '.' ? 'al-dot' : 'al-dash'} ${isOn ? 'al-on' : ''} ${isDone ? 'al-done' : ''}`}
                  />
                );
              })}
            </div>
            <div className="alpha-morse">
              {morse.split('').map(s => s === '.' ? '·' : '−').join('')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
