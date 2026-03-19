// NumberChart — visual pin-code style reference chart for 0-9
// Props:
//   activeNumber  – '0'–'9' or null
//   activeDot     – 0-based index of last lit dot (-1 = none)
//   onNumberClick – optional; called with digit string when a row is tapped

export const DIGIT_ORDER = ['1','2','3','4','5','6','7','8','9','0'];
export const DOT_COUNT   = { '1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'0':10 };

export default function NumberChart({ activeNumber = null, activeDot = -1, onNumberClick }) {
  return (
    <div className="num-chart">
      {DIGIT_ORDER.map(n => {
        const total   = DOT_COUNT[n];
        const isActive = activeNumber === n;
        const litUp   = isActive ? activeDot : -1;

        return (
          <div
            key={n}
            className={`num-row ${isActive ? 'num-row-active' : ''} ${onNumberClick ? 'num-row-clickable' : ''}`}
            onClick={() => onNumberClick?.(n)}
          >
            <span className="num-row-digit">{n}</span>
            <div className="num-row-dots">
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={`num-dot ${i <= litUp ? 'nd-on' : ''}`}
                />
              ))}
            </div>
            <span className="num-row-count">{total}</span>
          </div>
        );
      })}
    </div>
  );
}
