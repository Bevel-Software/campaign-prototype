import type { AppState, Action, CanvasCard } from './canvasTypes';
import { computeChildPositions, computeCleanLayout, CARD_DIMENSIONS } from './layoutUtils';

export const initialState: AppState = {
  apiKeys: {
    openai: false,
    gemini: false,
  },
  brandGuidelines: '',
  brandPositioning: '',
  historicalAds: [],
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

/**
 * When a card's height changes, reposition its children (and recursively their
 * descendants) so nothing overlaps.
 */
function cascadeRelayout(cards: CanvasCard[], parentId: string): CanvasCard[] {
  const parent = cards.find((c) => c.id === parentId);
  if (!parent) return cards;

  const children = cards.filter((c) => c.parentId === parentId);
  if (children.length === 0) return cards;

  const childType = children[0].cardType;
  const childWidth = CARD_DIMENSIONS[childType]?.width || 260;
  const positions = computeChildPositions(parent, children.length, childWidth);

  let updated = cards.map((c) => {
    if (c.parentId !== parentId) return c;
    const idx = children.findIndex((ch) => ch.id === c.id);
    const pos = positions[idx];
    if (!pos || (c.x === pos.x && c.y === pos.y)) return c;
    return { ...c, x: pos.x, y: pos.y };
  });

  for (const child of children) {
    updated = cascadeRelayout(updated, child.id);
  }

  return updated;
}

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

    case 'UPDATE_CARD_POSITION': {
      const oldCard = state.cards.find((c) => c.id === action.cardId);
      const heightChanged =
        action.height != null && oldCard != null && Math.abs(oldCard.height - action.height) > 1;

      let newCards = state.cards.map((c) =>
        c.id === action.cardId
          ? {
              ...c,
              x: action.x,
              y: action.y,
              ...(action.width != null && { width: action.width }),
              ...(action.height != null && { height: action.height }),
            }
          : c,
      );

      if (heightChanged) {
        newCards = cascadeRelayout(newCards, action.cardId);
      }

      return { ...state, cards: newCards };
    }

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

    case 'DELETE_CARD': {
      // Remove the card and all its descendants
      const toRemove = new Set<string>();
      toRemove.add(action.cardId);
      let added = true;
      while (added) {
        added = false;
        for (const c of state.cards) {
          if (c.parentId && toRemove.has(c.parentId) && !toRemove.has(c.id)) {
            toRemove.add(c.id);
            added = true;
          }
        }
      }
      return {
        ...state,
        cards: state.cards.filter((c) => !toRemove.has(c.id)),
        selectedCardId: toRemove.has(state.selectedCardId ?? '') ? null : state.selectedCardId,
      };
    }

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

    case 'SET_HISTORICAL_ADS':
      return { ...state, historicalAds: action.payload };

    case 'SET_BASE_PROMPT':
      return { ...state, basePrompt: action.payload };

    // ===== API KEYS =====
    case 'SET_API_KEYS':
      return { ...state, apiKeys: action.payload };

    // ===== LAYOUT =====
    case 'AUTO_LAYOUT':
      return { ...state, cards: computeCleanLayout(state.cards) };

    // ===== RESET =====
    case 'RESET_CANVAS':
      return {
        ...initialState,
        apiKeys: state.apiKeys,
        brandGuidelines: state.brandGuidelines,
        brandPositioning: state.brandPositioning,
        basePrompt: state.basePrompt,
      };

    // ===== ERROR =====
    case 'SET_ERROR':
      return { ...state, error: action.error };

    default:
      return state;
  }
}
