import type { QuestionConfig, QuestionChoice } from '../lib/types';
import { Question } from './Question';
import { CustomEdits } from './CustomEdits';

interface QuestionPanelProps {
  questions: QuestionConfig[];
  currentQuestionIndex: number;
  answers: Record<string, QuestionChoice>;
  isGenerating: boolean;
  customEditText: string;
  hasApiKey: boolean;
  onSelectAnswer: (questionId: string, choice: QuestionChoice) => void;
  onCustomEditChange: (text: string) => void;
  onCustomEditSubmit: () => void;
}

export function QuestionPanel({
  questions,
  currentQuestionIndex,
  answers,
  isGenerating,
  customEditText,
  hasApiKey,
  onSelectAnswer,
  onCustomEditChange,
  onCustomEditSubmit,
}: QuestionPanelProps) {
  return (
    <div className="question-panel">
      <div className="question-panel-scroll">
        {questions.map((q, i) => {
          if (i > currentQuestionIndex) return null;
          return (
            <div key={q.id}>
              <Question
                question={q}
                index={i}
                selectedChoice={answers[q.id] || null}
                isActive={i === currentQuestionIndex}
                isGenerating={isGenerating}
                hasApiKey={hasApiKey}
                onSelect={onSelectAnswer}
              />
              {i < currentQuestionIndex && <div className="question-divider" />}
            </div>
          );
        })}
        {currentQuestionIndex >= questions.length && questions.length > 0 && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--gray-500)',
              fontWeight: 500,
              padding: '8px 0',
            }}
          >
            All questions answered. Use custom edits to refine further.
          </div>
        )}
      </div>
      <CustomEdits
        text={customEditText}
        isGenerating={isGenerating}
        hasApiKey={hasApiKey}
        hasCreatives={currentQuestionIndex > 0}
        onChange={onCustomEditChange}
        onSubmit={onCustomEditSubmit}
      />
    </div>
  );
}
