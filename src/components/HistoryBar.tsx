import type { Creative } from '../lib/types';

interface HistoryBarProps {
  creatives: Creative[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function HistoryBar({
  creatives,
  selectedIndex,
  onSelect,
}: HistoryBarProps) {
  return (
    <div className="history-bar">
      {[...creatives].reverse().map((c) => {
        const i = creatives.indexOf(c);
        return (
          <div
            key={c.id}
            className={`history-item${i === selectedIndex ? ' active' : ''}`}
            onClick={() => onSelect(i)}
            title={c.annotation}
          >
            <img
              src={c.imageDataUrl}
              alt={c.annotation}
              className="history-thumb"
            />
            <span className="history-annotation">
              {c.vote && (
                <span className="history-vote-badge">
                  {c.vote === 'up' ? '\u2191 ' : '\u2193 '}
                </span>
              )}
              {c.annotation}
            </span>
          </div>
        );
      })}
    </div>
  );
}
