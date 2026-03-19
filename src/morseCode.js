export const MORSE_CODE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
  '$': '...-..-', '@': '.--.-.', ' ': '/',
};

export function textToMorse(text) {
  return text
    .toUpperCase()
    .split('')
    .map((char) => MORSE_CODE[char] || '')
    .filter((code) => code !== '')
    .join(' ');
}

// Returns [{char, morse}] — includes spaces as {char:' ', morse:'/'}
export function textToMorseDetailed(text) {
  return text
    .toUpperCase()
    .split('')
    .map((char) => ({ char, morse: MORSE_CODE[char] ?? null }))
    .filter((item) => item.morse !== null);
}
