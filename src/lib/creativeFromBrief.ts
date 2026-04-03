import type {
  CanvasCard,
  BriefCard,
  AssetCard,
  CreativeCard,
  CreativeCardData,
  SegmentCardData,
} from './canvasTypes';
import { computeChildPositions, CARD_DIMENSIONS } from './layoutUtils';

/**
 * Builds a CreativeCard + generation request from a BriefCard.
 * Shared between the chat agent (generate_creatives action) and the
 * "Generate Creative" button on BriefCardContent.
 */
export function buildCreativeFromBrief(
  briefCard: BriefCard,
  allCards: CanvasCard[],
  basePrompt: string,
  index: number = 0,
): { card: CreativeCard; prompt: string } {
  const now = Date.now();
  const briefData = briefCard.data;

  // Find parent segment for context
  const segmentCard = allCards.find((c) => c.id === briefData.segmentId);
  const segmentData = segmentCard?.cardType === 'segment' ? segmentCard.data as SegmentCardData : null;

  // Determine ad type from segment
  const isB2B = segmentData?.group === 'b2b';
  const adType: CreativeCardData['type'] = isB2B ? 'linkedin' : 'meta';

  // Build image generation prompt
  let prompt = basePrompt || 'Create a professional static image ad creative';
  prompt += `. Creative direction: ${briefData.direction}`;
  prompt += `. Format: ${briefData.format}`;
  if (segmentData) {
    prompt += `. Target audience: ${segmentData.name} — ${segmentData.targeting}`;
    prompt += `. Key message: ${segmentData.tagline}`;
  }

  // Include asset references from matching segment
  const assetCards = allCards.filter(
    (c): c is AssetCard => c.cardType === 'asset' && c.data.segmentId === briefData.segmentId,
  );
  if (assetCards.length > 0) {
    const refs = assetCards.map((a) => `${a.data.caption} (${a.data.source})`).join(', ');
    prompt += `. Reference assets: ${refs}`;
  }

  const positions = computeChildPositions(briefCard, 1, CARD_DIMENSIONS.creative.width);

  const data: CreativeCardData = {
    type: adType,
    group: segmentData?.group || 'b2c',
    imageDataUrl: null,
    brand: 'EGYM WELLPASS',
    body: '',
    headline: segmentData?.tagline || '',
    cta: 'Learn More',
    prompt,
    tags: briefData.keywords || [],
    isGenerating: true,
    error: null,
  };

  const cardId = `creative-${now}-${index}`;

  const card: CreativeCard = {
    id: cardId,
    cardType: 'creative',
    label: `Creative — ${briefData.direction.slice(0, 25)}`,
    x: positions[0]?.x || briefCard.x,
    y: positions[0]?.y || briefCard.y + briefCard.height + 100,
    width: CARD_DIMENSIONS.creative.width,
    height: CARD_DIMENSIONS.creative.height,
    parentId: briefCard.id,
    data,
  };

  return { card, prompt };
}
