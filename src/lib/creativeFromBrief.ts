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

  // Include settings context (campaign objectives, market, positioning)
  const settingsCard = allCards.find((c) => c.cardType === 'settings');
  if (settingsCard?.cardType === 'settings') {
    const sd = settingsCard.data;
    if (sd.market) prompt += `. Market: ${sd.market}`;
    if (sd.positioning) prompt += `. Campaign positioning: ${sd.positioning}`;
    if (sd.objectives?.length) prompt += `. Objectives: ${sd.objectives.map((o: { label: string }) => o.label).join(', ')}`;
  }

  prompt += `. Creative direction: ${briefData.direction}`;
  prompt += `. Format: ${briefData.format}`;

  // Platform context — tell the image generator what platform this is for
  const platformContext = adType === 'meta'
    ? 'Platform: Meta (Instagram/Facebook) — this image will be viewed on mobile phones in a social feed. Use bold, scroll-stopping visuals. Any text in the image must be very large and minimal (maximum 5-6 words). Prefer letting the visual do the work over text overlays.'
    : 'Platform: LinkedIn — this image will appear in a professional feed. Use clean, data-forward imagery. Text overlays should be large, readable, and professional.';
  prompt += `. ${platformContext}`;

  // Format-specific placement context
  const formatContext = briefData.format.includes('1080x1080')
    ? 'This is a square feed image (1080x1080) for Instagram/Facebook feed placement.'
    : briefData.format.includes('1200x628')
    ? 'This is a landscape image (1200x628) for link ads or LinkedIn feed placement.'
    : briefData.format.includes('1080x1920')
    ? 'This is a portrait/story image (1080x1920) for Instagram/Facebook Stories — full vertical screen.'
    : '';
  if (formatContext) prompt += ` ${formatContext}`;

  if (segmentData) {
    prompt += `. Target audience: ${segmentData.name} — ${segmentData.targeting}`;
    prompt += `. Key message: ${segmentData.tagline}`;
  }

  // Include asset/inspiration references from matching segment
  const assetCards = allCards.filter(
    (c): c is AssetCard => c.cardType === 'asset' && c.data.segmentId === briefData.segmentId,
  );
  if (assetCards.length > 0) {
    const refs = assetCards.map((a) => {
      let ref = a.data.caption;
      if (a.data.image) ref += `. Visual style: ${a.data.image}`;
      if (a.data.reason) ref += `. Chosen because: ${a.data.reason}`;
      return ref;
    }).join(' | ');
    prompt += `. Inspiration from past ads: ${refs}`;
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
