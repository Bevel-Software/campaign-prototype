import type { QuestionConfig, QuestionChoice } from '../lib/types';

interface QuestionProps {
  question: QuestionConfig;
  index: number;
  selectedChoice: QuestionChoice | null;
  isActive: boolean;
  isGenerating: boolean;
  hasApiKey: boolean;
  onSelect: (questionId: string, choice: QuestionChoice) => void;
}

export function Question({
  question,
  index,
  selectedChoice,
  isActive,
  isGenerating,
  hasApiKey,
  onSelect,
}: QuestionProps) {
  const isAnswered = !!selectedChoice;

  return (
    <div className={`question-block${isAnswered && !isActive ? ' answered' : ''}`}>
      <div className="question-number">Question {index + 1}</div>
      <div className="question-text">{question.text}</div>
      <div className="question-choices">
        {question.choices.map((choice, i) => (
          <button
            key={choice.label}
            className={`question-choice${selectedChoice?.label === choice.label ? ' selected' : ''}`}
            onClick={() => onSelect(question.id, choice)}
            disabled={!isActive || isGenerating || !hasApiKey}
            title={isActive && !isGenerating ? `Press ${i + 1} to select` : undefined}
          >
            {isActive && !isGenerating && (
              <span style={{ opacity: 0.4, marginRight: 6, fontSize: '0.7rem' }}>
                {i + 1}
              </span>
            )}
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
