import type { AppState, Action } from './canvasTypes';

export const initialState: AppState = {
  apiKeys: {
    openai: import.meta.env.VITE_OPENAI_API_KEY || null,
    gemini: import.meta.env.VITE_GEMINI_API_KEY || null,
  },
  brandGuidelines: '',
  brandPositioning: '',
  basePrompt: '',
  canvas: { x: 0, y: 0, scale: 1 },
  cards: [],
  selectedCardId: null,
  messages: [],
  isAgentThinking: false,
  generatingCardIds: [],
  messageQueue: [],
  error: null,
};

export function canvasReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // ===== CANVAS VIEWPORT =====
    case 'SET_CANVAS_VIEWPORT':
      return { ...state, canvas: action.payload };

    // ===== CARDS =====
    case 'ADD_CARD':
      return { ...state, cards: [...state.cards, action.card] };

    case 'ADD_CARDS':
      return { ...state, cards: [...state.cards, ...action.cards] };

    case 'UPDATE_CARD_POSITION':
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.cardId ? { ...c, x: action.x, y: action.y } : c,
        ),
      };

    case 'UPDATE_CARD_DATA':
      return {
        ...state,
        cards: state.cards.map((c) => {
          if (c.id !== action.cardId) return c;
          // Use type assertion to merge data — safe because callers know the card type
          return { ...c, data: { ...c.data, ...action.data } } as typeof c;
        }),
      };

    case 'SELECT_CARD':
      return { ...state, selectedCardId: action.cardId };

    // ===== CHAT =====
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'SET_AGENT_THINKING':
      return { ...state, isAgentThinking: action.value };

    case 'QUEUE_MESSAGE':
      return { ...state, messageQueue: [...state.messageQueue, action.text] };

    case 'DEQUEUE_MESSAGE':
      return { ...state, messageQueue: state.messageQueue.slice(1) };

    // ===== GENERATION =====
    case 'START_GENERATING':
      return {
        ...state,
        generatingCardIds: [...state.generatingCardIds, action.cardId],
      };

    case 'FINISH_GENERATING':
      return {
        ...state,
        generatingCardIds: state.generatingCardIds.filter((id) => id !== action.cardId),
      };

    // ===== BRAND CONTEXT =====
    case 'SET_BRAND_GUIDELINES':
      return { ...state, brandGuidelines: action.payload };

    case 'SET_BRAND_POSITIONING':
      return { ...state, brandPositioning: action.payload };

    case 'SET_BASE_PROMPT':
      return { ...state, basePrompt: action.payload };

    // ===== ERROR =====
    case 'SET_ERROR':
      return { ...state, error: action.error };

    default:
      return state;
  }
}
