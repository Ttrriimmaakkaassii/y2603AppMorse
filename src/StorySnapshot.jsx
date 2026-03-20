import { useState, useEffect } from 'react';

const PARAGRAPHS = [
  {
    text: `Maria arrived at the old library at exactly half past three. She wore a red coat and carried a blue leather bag. The librarian, a tall man named Mr. Chen, handed her a sealed envelope. Inside was a single photograph of a lighthouse standing on rocky cliffs. On the back, in faded ink, someone had written the number 47.`,
    questions: [
      { q: 'What time did Maria arrive?', opts: ['Two o\'clock','Half past three','Noon','Four fifteen'], a: 'Half past three' },
      { q: 'What color was Maria\'s coat?', opts: ['Blue','Green','Red','Black'], a: 'Red' },
      { q: 'What did the librarian give her?', opts: ['A book','A key','A sealed envelope','A map'], a: 'A sealed envelope' },
      { q: 'What was in the envelope?', opts: ['A letter','A photograph','Money','A ticket'], a: 'A photograph' },
      { q: 'What number was written on the back?', opts: ['12','47','99','33'], a: '47' },
    ],
  },
  {
    text: `The expedition team set up camp beside a frozen river at dusk. There were five members: two geologists, one photographer, and twin brothers who served as guides. They had traveled north for six days. Their main goal was to document a rare mineral deposit reported three years earlier by a local farmer named Osei.`,
    questions: [
      { q: 'Where did the team camp?', opts: ['A mountain peak','A frozen river','A forest clearing','A beach'], a: 'A frozen river' },
      { q: 'How many team members were there?', opts: ['Three','Four','Five','Six'], a: 'Five' },
      { q: 'How many days had they traveled?', opts: ['Three','Six','Ten','Two'], a: 'Six' },
      { q: 'What was their main goal?', opts: ['Find water','Document a mineral deposit','Build a shelter','Map a river'], a: 'Document a mineral deposit' },
      { q: 'Who first reported the deposit?', opts: ['A scientist','A guide','A local farmer','A geologist'], a: 'A local farmer' },
    ],
  },
  {
    text: `The small bakery on Elm Street opened at six each morning. Its owner, a woman named Petra, baked exactly twelve types of bread. Her most popular item was a sourdough loaf flavored with rosemary and sea salt. Every Thursday, she donated twenty loaves to the community shelter two blocks away. She had done this for eleven years without missing a single week.`,
    questions: [
      { q: 'What street was the bakery on?', opts: ['Oak Street','Maple Avenue','Elm Street','Pine Road'], a: 'Elm Street' },
      { q: 'What time did it open?', opts: ['Seven','Six','Eight','Five'], a: 'Six' },
      { q: 'How many bread types did Petra bake?', opts: ['Eight','Ten','Twelve','Fifteen'], a: 'Twelve' },
      { q: 'What flavored the sourdough?', opts: ['Garlic and butter','Rosemary and sea salt','Honey and oats','Thyme and olive oil'], a: 'Rosemary and sea salt' },
      { q: 'How many years had she donated?', opts: ['Five','Seven','Eleven','Twenty'], a: 'Eleven' },
    ],
  },
  {
    text: `Detective Ramos found the missing painting in an abandoned warehouse on the eastern docks. It had been wrapped in brown paper and tied with green string. A small label on the back identified the artist as someone born in 1892. The painting depicted three children playing near a stone fountain. Ramos photographed everything before calling her partner.`,
    questions: [
      { q: 'Where was the painting found?', opts: ['A museum basement','An abandoned warehouse','A private home','A gallery storage'], a: 'An abandoned warehouse' },
      { q: 'What was it wrapped in?', opts: ['Plastic','White cloth','Brown paper','Black fabric'], a: 'Brown paper' },
      { q: 'What color was the string?', opts: ['Red','Blue','Yellow','Green'], a: 'Green' },
      { q: 'When was the artist born?', opts: ['1872','1892','1912','1932'], a: '1892' },
      { q: 'What did the painting depict?', opts: ['A sunset','Three children near a fountain','A mountain village','Horses in a field'], a: 'Three children near a fountain' },
    ],
  },
];

const READ_TIMES = [3000, 5000, 8000, 10000];

export default function StorySnapshot() {
  const [paraIdx, setParaIdx] = useState(0);
  const [readTime, setReadTime] = useState(5000);
  const [phase, setPhase] = useState('idle'); // idle | reading | answering | result
  const [countdown, setCountdown] = useState(0);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [totalGames, setTotalGames] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [showHow, setShowHow] = useState(false);

  const start = () => {
    setAnswers({});
    setScore(null);
    setCountdown(readTime / 1000);
    setPhase('reading');
  };

  useEffect(() => {
    if (phase !== 'reading') return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase('answering');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const submit = () => {
    const qs = PARAGRAPHS[paraIdx].questions;
    let correct = 0;
    qs.forEach((q, i) => { if (answers[i] === q.a) correct++; });
    setScore(correct);
    setTotalGames(t => t + 1);
    if (correct > bestScore) setBestScore(correct);
    setPhase('result');
  };

  const next = () => {
    setParaIdx(i => (i + 1) % PARAGRAPHS.length);
    setPhase('idle');
  };

  const current = PARAGRAPHS[paraIdx];

  return (
    <div className="brain-game">
      <div className="brain-game-header">
        <span className="brain-game-title">📝 Story Snapshot</span>
        <button className="how-btn" onClick={() => setShowHow(v => !v)}>? How to Play</button>
      </div>

      {showHow && (
        <div className="how-box">
          A paragraph appears for a limited time. Read it carefully, then answer 5 questions about the details.
          After answering, the original text is shown with correct answers highlighted.
        </div>
      )}

      {phase === 'idle' && (
        <>
          <div className="brain-row">
            <span className="brain-label">Read Time:</span>
            {READ_TIMES.map(t => (
              <button key={t} className={`pill-btn ${readTime === t ? 'pill-active' : ''}`} onClick={() => setReadTime(t)}>{t/1000}s</button>
            ))}
          </div>
          <div className="brain-row">
            <span className="brain-label">Paragraph:</span>
            {PARAGRAPHS.map((_, i) => (
              <button key={i} className={`pill-btn ${paraIdx === i ? 'pill-active' : ''}`} onClick={() => setParaIdx(i)}>P{i+1}</button>
            ))}
          </div>
          {totalGames > 0 && (
            <div className="brain-stats">
              <span>Best: <b style={{color:'#7ee8a2'}}>{bestScore}/5</b></span>
              <span>Games: <b>{totalGames}</b></span>
            </div>
          )}
          <button className="brain-btn primary" onClick={start}>▶ Start Reading</button>
        </>
      )}

      {phase === 'reading' && (
        <div className="snapshot-reading-wrap">
          <div className="matrix-countdown">{countdown}s</div>
          <div className="snapshot-paragraph">{current.text}</div>
        </div>
      )}

      {phase === 'answering' && (
        <div className="rsvp-quiz">
          <div className="how-box" style={{color:'#f6c90e', marginBottom:12}}>Paragraph hidden — answer from memory!</div>
          {current.questions.map((q, i) => (
            <div key={i} className="quiz-question">
              <div className="quiz-q">{i + 1}. {q.q}</div>
              <div className="quiz-opts">
                {q.opts.map(opt => (
                  <button
                    key={opt}
                    className={`quiz-opt ${answers[i] === opt ? 'quiz-selected' : ''}`}
                    onClick={() => setAnswers(a => ({...a, [i]: opt}))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="brain-btn primary"
            onClick={submit}
            disabled={Object.keys(answers).length < current.questions.length}
          >
            Submit Answers
          </button>
        </div>
      )}

      {phase === 'result' && score !== null && (
        <div className="quiz-results">
          <div className={`flash-result ${score >= 4 ? 'correct' : score >= 2 ? '' : 'wrong'}`} style={{fontSize:'1.3rem', marginBottom:12}}>
            {score} / 5 correct
          </div>

          <div className="snapshot-paragraph" style={{marginBottom:16, opacity:0.85}}>
            {current.text}
          </div>

          {current.questions.map((q, i) => (
            <div key={i} className="quiz-review">
              <b>{i+1}. {q.q}</b>
              <div style={{color: answers[i] === q.a ? '#7ee8a2' : '#f87171', marginTop:4}}>
                Your answer: {answers[i]} {answers[i] === q.a ? '✓' : `✗`}
              </div>
              {answers[i] !== q.a && <div style={{color:'#7ee8a2', fontSize:'0.9rem'}}>Correct: {q.a}</div>}
            </div>
          ))}

          <div style={{display:'flex', gap:10, marginTop:16}}>
            <button className="brain-btn primary" onClick={next}>Next Paragraph</button>
            <button className="brain-btn" onClick={start}>Try Again</button>
          </div>
        </div>
      )}
    </div>
  );
}
