import { useReducer, useEffect, useCallback, useRef } from 'react';
import type { AppState, Action, Creative, QuestionsFile, QuestionChoice } from './lib/types';
import { generateCreative, GeminiError } from './lib/gemini';
import { composePrompt, getAnnotation } from './lib/prompt';
import { Header } from './components/Header';
import { QuestionPanel } from './components/QuestionPanel';
import { CreativeDisplay } from './components/CreativeDisplay';
import { VotingPanel } from './components/VotingPanel';
import { PromptPreview } from './components/PromptPreview';

const FALLBACK_QUESTIONS: QuestionsFile = {
  brand: 'Brand',
  basePrompt: 'Create a professional advertising creative image',
  questions: [
    {
      id: 'audience',
      text: 'Who is this ad for?',
      choices: [
        { label: 'Young professionals', promptFragment: 'targeting young urban professionals aged 25-34' },
        { label: 'Fitness enthusiasts', promptFragment: 'targeting fitness enthusiasts who love diverse workouts' },
        { label: 'Corporate HR', promptFragment: 'targeting HR Directors at enterprise companies' },
      ],
    },
    {
      id: 'tone',
      text: 'What tone should it have?',
      choices: [
        { label: 'Energetic', promptFragment: 'with an energetic, high-energy, motivating tone' },
        { label: 'Calm & mindful', promptFragment: 'with a calm, mindful, wellness-focused tone' },
        { label: 'Professional', promptFragment: 'with a professional, data-driven, corporate tone' },
      ],
    },
    {
      id: 'visual',
      text: 'What should the visual focus on?',
      choices: [
        { label: 'Person exercising', promptFragment: 'showing a person actively exercising in a modern gym' },
        { label: 'Lifestyle moment', promptFragment: 'showing a lifestyle moment of someone enjoying wellness after work' },
        { label: 'Data & metrics', promptFragment: 'showing clean data visualizations and business metrics' },
      ],
    },
  ],
};

const initialState: AppState = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || null,
  brandGuidelines: '',
  brandPositioning: '',
  questions: [],
  basePrompt: '',
  currentQuestionIndex: 0,
  answers: {},
  creatives: [],
  selectedCreativeIndex: -1,
  isGenerating: false,
  customEditText: '',
  error: null,
};

interface SessionData {
  creatives: Creative[];
  answers: Record<string, QuestionChoice>;
}

type FullAction =
  | Action
  | { type: 'SET_BRAND_GUIDELINES'; payload: string }
  | { type: 'SET_BRAND_POSITIONING'; payload: string }
  | { type: 'RESTORE_SESSION'; payload: SessionData };

function reducer(state: AppState, action: FullAction): AppState {
  switch (action.type) {
    case 'SET_QUESTIONS':
      return {
        ...state,
        questions: action.payload.questions,
        basePrompt: action.payload.basePrompt,
      };
    case 'SET_BRAND_GUIDELINES':
      return { ...state, brandGuidelines: action.payload };
    case 'SET_BRAND_POSITIONING':
      return { ...state, brandPositioning: action.payload };
    case 'RESTORE_SESSION': {
      const answeredCount = Object.keys(action.payload.answers).length;
      return {
        ...state,
        creatives: action.payload.creatives,
        answers: action.payload.answers,
        currentQuestionIndex: Math.min(answeredCount, state.questions.length),
        selectedCreativeIndex: action.payload.creatives.length > 0
          ? action.payload.creatives.length - 1
          : -1,
      };
    }
    case 'SELECT_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.choice },
      };
    case 'START_GENERATING':
      return { ...state, isGenerating: true, error: null };
    case 'GENERATION_SUCCESS': {
      const creatives = [...state.creatives, action.creative];
      return {
        ...state,
        isGenerating: false,
        creatives,
        selectedCreativeIndex: creatives.length - 1,
        // Only advance question index if this was triggered by a question answer
        currentQuestionIndex: action.fromQuestion
          ? Math.min(state.currentQuestionIndex + 1, state.questions.length)
          : state.currentQuestionIndex,
        error: null,
      };
    }
    case 'GENERATION_ERROR':
      return { ...state, isGenerating: false, error: action.error };
    case 'VOTE':
      return {
        ...state,
        creatives: state.creatives.map((c) =>
          c.id === action.creativeId ? { ...c, vote: action.direction } : c,
        ),
      };
    case 'SELECT_CREATIVE':
      return { ...state, selectedCreativeIndex: action.index };
    case 'SET_CUSTOM_EDIT':
      return { ...state, customEditText: action.text };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load questions.json
  useEffect(() => {
    fetch('/questions.json')
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: QuestionsFile) => {
        dispatch({ type: 'SET_QUESTIONS', payload: data });
      })
      .catch(() => {
        dispatch({ type: 'SET_QUESTIONS', payload: FALLBACK_QUESTIONS });
      });
  }, []);

  // Load brand context files
  useEffect(() => {
    fetch('/brand_guidelines.md')
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.text();
      })
      .then((text) => {
        dispatch({ type: 'SET_BRAND_GUIDELINES', payload: text });
      })
      .catch(() => {
        console.warn('brand_guidelines.md not found');
      });

    fetch('/positioning.md')
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.text();
      })
      .then((text) => {
        dispatch({ type: 'SET_BRAND_POSITIONING', payload: text });
      })
      .catch(() => {
        console.warn('positioning.md not found');
      });
  }, []);

  // Restore session from server on mount
  const sessionLoaded = useRef(false);
  useEffect(() => {
    if (sessionLoaded.current) return;
    sessionLoaded.current = true;
    fetch('/api/session')
      .then((r) => {
        if (!r.ok) throw new Error('No session');
        return r.json() as Promise<SessionData>;
      })
      .then((data) => {
        if (data.creatives?.length > 0) {
          dispatch({ type: 'RESTORE_SESSION', payload: data });
        }
      })
      .catch(() => {});
  }, []);

  // Auto-save session whenever creatives or answers change
  useEffect(() => {
    if (state.creatives.length === 0) return;
    const session: SessionData = {
      creatives: state.creatives,
      answers: state.answers,
    };
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    }).catch(() => {});
  }, [state.creatives, state.answers]);

  // For prompt preview: show what the next call would send
  const answeredQs = state.questions.filter((q) => state.answers[q.id]);
  const lastAnsweredQ = answeredQs[answeredQs.length - 1] || null;
  const previewFragment = state.customEditText?.trim()
    || lastAnsweredQ?.id && state.answers[lastAnsweredQ.id]?.promptFragment
    || '';
  const currentPrompt = previewFragment
    ? composePrompt(state.basePrompt, previewFragment)
    : state.basePrompt;

  const handleGenerate = useCallback(
    async (prompt: string, annotation: string, fromQuestion: boolean) => {
      if (!state.apiKey || state.isGenerating) return;

      dispatch({ type: 'START_GENERATING' });

      // Pass the currently selected creative as input for iterative editing
      const previousImage =
        state.selectedCreativeIndex >= 0
          ? state.creatives[state.selectedCreativeIndex].imageDataUrl
          : undefined;

      try {
        const result = await generateCreative(
          state.apiKey,
          prompt,
          { guidelines: state.brandGuidelines, positioning: state.brandPositioning },
          previousImage,
        );

        const creative: Creative = {
          id: `c-${Date.now()}`,
          imageDataUrl: result.imageDataUrl,
          prompt,
          timestamp: Date.now(),
          vote: null,
          annotation,
        };
        dispatch({ type: 'GENERATION_SUCCESS', creative, fromQuestion });
      } catch (err) {
        if (err instanceof GeminiError) {
          dispatch({ type: 'GENERATION_ERROR', error: err.message });
        } else {
          dispatch({
            type: 'GENERATION_ERROR',
            error: 'Unexpected error. Try again.',
          });
        }
      }
    },
    [state.apiKey, state.isGenerating, state.brandGuidelines, state.brandPositioning, state.creatives],
  );

  const handleSelectAnswer = useCallback(
    (questionId: string, choice: { label: string; promptFragment: string }) => {
      dispatch({ type: 'SELECT_ANSWER', questionId, choice });

      const question = state.questions.find((q) => q.id === questionId) || null;
      const annotation = getAnnotation(question, choice);

      // Always: basePrompt + this answer's fragment
      const prompt = composePrompt(state.basePrompt, choice.promptFragment);

      setTimeout(() => {
        handleGenerate(prompt, annotation, true);
      }, 0);
    },
    [state.questions, state.basePrompt, handleGenerate],
  );

  const handleCustomEdit = useCallback(() => {
    if (!state.customEditText.trim()) return;
    const annotation = getAnnotation(null, null, state.customEditText);
    const prompt = composePrompt(state.basePrompt, state.customEditText.trim());
    handleGenerate(prompt, annotation, false);
  }, [state.customEditText, state.basePrompt, handleGenerate]);

  const handleVote = useCallback(
    (direction: 'up' | 'down') => {
      const creative = state.creatives[state.selectedCreativeIndex];
      if (creative) {
        dispatch({ type: 'VOTE', creativeId: creative.id, direction });
      }
    },
    [state.creatives, state.selectedCreativeIndex],
  );

  const handleSelectCreative = useCallback((index: number) => {
    dispatch({ type: 'SELECT_CREATIVE', index });
  }, []);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
    const question = state.questions[state.currentQuestionIndex - 1];
    const choice = question ? state.answers[question.id] : null;

    if (state.customEditText.trim()) {
      const annotation = getAnnotation(null, null, state.customEditText);
      const prompt = composePrompt(state.basePrompt, state.customEditText.trim());
      handleGenerate(prompt, annotation, false);
    } else if (question && choice) {
      const annotation = getAnnotation(question, choice);
      const prompt = composePrompt(state.basePrompt, choice.promptFragment);
      handleGenerate(prompt, annotation, true);
    }
  }, [state.questions, state.currentQuestionIndex, state.answers, state.customEditText, state.basePrompt, handleGenerate]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;

      const currentQ = state.questions[state.currentQuestionIndex];
      if (currentQ && !state.isGenerating) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= currentQ.choices.length) {
          handleSelectAnswer(currentQ.id, currentQ.choices[num - 1]);
          return;
        }
      }

      if (e.key === 'ArrowUp' && state.selectedCreativeIndex >= 0) {
        e.preventDefault();
        handleVote('up');
      }
      if (e.key === 'ArrowDown' && state.selectedCreativeIndex >= 0) {
        e.preventDefault();
        handleVote('down');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.questions, state.currentQuestionIndex, state.isGenerating, state.selectedCreativeIndex, handleSelectAnswer, handleVote]);

  const selectedCreative =
    state.selectedCreativeIndex >= 0
      ? state.creatives[state.selectedCreativeIndex]
      : null;

  const fullPromptPreview = [
    currentPrompt,
    state.brandGuidelines ? '\n\n[Brand guidelines loaded]' : '\n\n[No brand guidelines]',
    state.brandPositioning ? '[Positioning & messaging loaded]' : '[No positioning doc]',
    state.creatives.length > 0 ? '[Previous image will be sent for refinement]' : '[First generation — no previous image]',
  ].join('\n');

  return (
    <>
      <Header apiKey={state.apiKey} />
      {!state.apiKey && (
        <div className="no-key-banner">
          No API key found. Add <code>VITE_GEMINI_API_KEY=your_key</code> to your{' '}
          <code>.env</code> file and restart the dev server.
        </div>
      )}
      <div className="main-layout">
        <QuestionPanel
          questions={state.questions}
          currentQuestionIndex={state.currentQuestionIndex}
          answers={state.answers}
          isGenerating={state.isGenerating}
          customEditText={state.customEditText}
          onSelectAnswer={handleSelectAnswer}
          onCustomEditChange={(text) =>
            dispatch({ type: 'SET_CUSTOM_EDIT', text })
          }
          onCustomEditSubmit={handleCustomEdit}
          hasApiKey={!!state.apiKey}
        />
        <CreativeDisplay
          creative={selectedCreative}
          creatives={state.creatives}
          selectedIndex={state.selectedCreativeIndex}
          isGenerating={state.isGenerating}
          error={state.error}
          onSelectCreative={handleSelectCreative}
          onRetry={handleRetry}
        />
        <VotingPanel
          creative={selectedCreative}
          onVote={handleVote}
          disabled={!selectedCreative || state.isGenerating}
        />
      </div>
      <PromptPreview prompt={fullPromptPreview} />
    </>
  );
}
