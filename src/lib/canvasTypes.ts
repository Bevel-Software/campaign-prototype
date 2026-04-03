// ===== CARD SYSTEM =====

export type CardType = 'settings' | 'segment' | 'asset' | 'brief' | 'creative' | 'variation';

export interface CardBase {
  id: string;
  cardType: CardType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
}

export interface SettingsCardData {
  name: string;
  objectives: { label: string; type: 'b2c' | 'b2b' }[];
  market: string;
  budget: string;
  split: string;
  timeline: string;
  channels: { label: string; type: string }[];
  positioning: string;
}

export interface SegmentCardData {
  group: 'b2c' | 'b2b';
  name: string;
  channel: string;
  targeting: string;
  tagline: string;
  funnelStage?: 'awareness' | 'consideration' | 'conversion';
  isSelected?: boolean;
}

export interface AssetCardData {
  segmentId: string;
  image: string;
  source: string;
  caption: string;
}

export interface BriefCardData {
  segmentId: string;
  direction: string;
  format: string;
  keywords: string[];
}

export interface CreativeCardData {
  type: 'meta' | 'linkedin';
  group: 'b2c' | 'b2b';
  imageDataUrl: string | null;
  brand: string;
  body: string;
  headline: string;
  cta: string;
  prompt: string;
  tags: string[];
  isGenerating: boolean;
  error: string | null;
}

export interface SettingsCard extends CardBase {
  cardType: 'settings';
  data: SettingsCardData;
}

export interface SegmentCard extends CardBase {
  cardType: 'segment';
  data: SegmentCardData;
}

export interface AssetCard extends CardBase {
  cardType: 'asset';
  data: AssetCardData;
}

export interface BriefCard extends CardBase {
  cardType: 'brief';
  data: BriefCardData;
}

export interface CreativeCard extends CardBase {
  cardType: 'creative';
  data: CreativeCardData;
}

export interface VariationCard extends CardBase {
  cardType: 'variation';
  data: CreativeCardData;
}

export type CanvasCard = SettingsCard | SegmentCard | AssetCard | BriefCard | CreativeCard | VariationCard;

// ===== CHAT SYSTEM =====

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'tool';
  text: string;
  toolLabel?: string;
  toolResult?: string;
  timestamp: number;
}

// ===== CANVAS VIEWPORT =====

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

// ===== APP STATE =====

export interface AppState {
  apiKeys: { openai: string | null; gemini: string | null };
  brandGuidelines: string;
  brandPositioning: string;
  basePrompt: string;
  canvas: CanvasViewport;
  cards: CanvasCard[];
  selectedCardId: string | null;
  messages: ChatMessage[];
  isAgentThinking: boolean;
  generatingCardIds: string[];
  messageQueue: string[];
  error: string | null;
}

// ===== ACTIONS =====

export type Action =
  // Canvas viewport
  | { type: 'SET_CANVAS_VIEWPORT'; payload: CanvasViewport }
  // Cards
  | { type: 'ADD_CARD'; card: CanvasCard }
  | { type: 'ADD_CARDS'; cards: CanvasCard[] }
  | { type: 'UPDATE_CARD_POSITION'; cardId: string; x: number; y: number; width?: number; height?: number }
  | { type: 'UPDATE_CARD_DATA'; cardId: string; data: Partial<CanvasCard['data']> }
  | { type: 'SELECT_CARD'; cardId: string | null }
  // Chat
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'SET_AGENT_THINKING'; value: boolean }
  | { type: 'QUEUE_MESSAGE'; text: string }
  | { type: 'DEQUEUE_MESSAGE' }
  // Generation
  | { type: 'START_GENERATING'; cardId: string }
  | { type: 'FINISH_GENERATING'; cardId: string }
  // Brand context
  | { type: 'SET_BRAND_GUIDELINES'; payload: string }
  | { type: 'SET_BRAND_POSITIONING'; payload: string }
  | { type: 'SET_BASE_PROMPT'; payload: string }
  // Error
  | { type: 'SET_ERROR'; error: string | null };
