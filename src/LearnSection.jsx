import { useState, useRef } from 'react';
import { MORSE_CODE } from './morseCode';
import { playLetterMorse } from './audioEngine';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LearnSection() {
  const [activeLetter, setActiveLetter] = useState(null); // { letter, morse }
  const [currentStep, setCurrentStep] = useState(-1);     // symbol index being played
  const playerRef = useRef(null);

  function playLetter(letter) {
    playerRef.current?.stop();
    const morse = MORSE_CODE[letter];
    setActiveLetter({ letter, morse });
    setCurrentStep(-1);

    playerRef.current = playLetterMorse(
      morse,
      (si) => setCurrentStep(si),
      () => { setActiveLetter(null); setCurrentStep(-1); }
    );
  }

  return (
    <div className="learn-section">
      <p className="section-sub">Tap any letter to hear and see its Morse code</p>
      <div className="learn-grid">
        {ALPHABET.map(letter => {
          const morse = MORSE_CODE[letter];
          const isActive = activeLetter?.letter === letter;
          return (
            <button
              key={letter}
              className={`learn-card ${isActive ? 'learn-active' : ''}`}
              onClick={() => playLetter(letter)}
            >
              <div className="learn-letter">{letter}</div>
              <div className="learn-lights">
                {morse.split('').map((sym, si) => {
                  const isOn   = isActive && si === currentStep;
                  const isDone = isActive && si < currentStep;
                  return (
                    <span
                      key={si}
                      className={`learn-light ${sym === '.' ? 'll-dot' : 'll-dash'} ${isOn ? 'll-on' : ''} ${isDone ? 'll-done' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="learn-morse">
                {morse.split('').map(s => s === '.' ? '·' : '−').join('')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
