export interface QuestionChoice {
  label: string;
  promptFragment: string;
}

export interface QuestionConfig {
  id: string;
  text: string;
  choices: QuestionChoice[];
}

export interface QuestionsFile {
  brand: string;
  basePrompt: string;
  questions: QuestionConfig[];
}

export interface Creative {
  id: string;
  imageDataUrl: string;
  prompt: string;
  timestamp: number;
  vote: 'up' | 'down' | null;
  downvoteReason: string;
  annotation: string;
}

export interface AppState {
  apiKey: string | null;
  brandGuidelines: string;
  brandPositioning: string;
  questions: QuestionConfig[];
  basePrompt: string;
  currentQuestionIndex: number;
  answers: Record<string, QuestionChoice>;
  creatives: Creative[];
  selectedCreativeIndex: number;
  isGenerating: boolean;
  customEditText: string;
  error: string | null;
}

export type Action =
  | { type: 'SET_QUESTIONS'; payload: QuestionsFile }
  | { type: 'SELECT_ANSWER'; questionId: string; choice: QuestionChoice }
  | { type: 'START_GENERATING' }
  | { type: 'GENERATION_SUCCESS'; creative: Creative; fromQuestion: boolean }
  | { type: 'GENERATION_ERROR'; error: string }
  | { type: 'VOTE'; creativeId: string; direction: 'up' | 'down' }
  | { type: 'SET_DOWNVOTE_REASON'; creativeId: string; reason: string }
  | { type: 'SELECT_CREATIVE'; index: number }
  | { type: 'SET_CUSTOM_EDIT'; text: string }
  | { type: 'CLEAR_ERROR' };
