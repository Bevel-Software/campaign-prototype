import type { Creative } from '../lib/types';

interface VotingPanelProps {
  creative: Creative | null;
  onVote: (direction: 'up' | 'down') => void;
  disabled: boolean;
}

export function VotingPanel({ creative, onVote, disabled }: VotingPanelProps) {
  return (
    <div className="voting-panel">
      <button
        className={`vote-btn${creative?.vote === 'up' ? ' voted-up' : ''}`}
        onClick={() => onVote('up')}
        disabled={disabled}
        title="Upvote (Arrow Up)"
      >
        &#8593;
      </button>
      <div className="vote-label">
        Do you feel this version would perform better?
      </div>
      <button
        className={`vote-btn${creative?.vote === 'down' ? ' voted-down' : ''}`}
        onClick={() => onVote('down')}
        disabled={disabled}
        title="Downvote (Arrow Down)"
      >
        &#8595;
      </button>
    </div>
  );
}
