import { z } from 'zod';
import type {
  SettingsCardData,
  SegmentCardData,
  AssetCardData,
  BriefCard,
  BriefCardData,
  CanvasCard,
} from '../canvasTypes';
import { computeChildPositions, CARD_DIMENSIONS } from '../layoutUtils';

// ===== Zod schemas =====

const skillBriefSchema = z.object({
  segmentId: z.string().min(1),
  direction: z.string().min(20),
  format: z.string().min(3),
  keywords: z.array(z.string()).min(1),
});

export const briefResponseSchema = z.object({
  reasoning: z.string().optional(),
  briefs: z.array(skillBriefSchema).min(1).max(50),
});

export type SkillBrief = z.infer<typeof skillBriefSchema>;

// ===== Prompt =====

const BRIEF_SYSTEM_PROMPT = `You are a senior creative director writing image briefs for static advertising campaigns. You think visually — every brief must give a graphic designer enough detail to produce a compelling image without further clarification. The platform produces static image ads only (no video, carousel, or story formats).

Given campaign settings, brand context, audience segments, and inspiration from past ads, produce one image brief per segment.

## How to use brand context

The brand guidelines define the visual identity: colors, typography, logo usage, imagery style, and tone. Use these to ground every brief in the brand's look and feel. Reference specific colors, font styles, or imagery rules when describing the creative direction.

The brand positioning document is organized by user group. For each group you will find:
- A positioning statement (how the brand should be framed for this audience)
- Pain points / core needs (what motivates them)
- Messaging pillars (specific value propositions per benefit area)
- Key benefits (the proof points behind each pillar)

**Use this structure.** Each brief's creative direction should reflect the messaging pillar and pain point most relevant to that segment. If the positioning doc includes competitor analysis, use it to differentiate the visual approach.

## How to use inspiration ads

For each segment, you may receive one or more reference ads from past campaigns. These include:
- A caption (the ad copy that was used)
- A visual style description (what the image looked like)
- A reason why this ad was chosen (e.g. high reach, audience match)

**Learn from these.** Incorporate visual elements, composition styles, or color treatments that worked. Mention what to keep and what to evolve. Do not copy — improve.

## Rules

1. ONE BRIEF PER SEGMENT: Generate exactly one brief for each provided segment. Use the segment's ID as the segmentId.

2. CREATIVE DIRECTION must use this exact two-part structure separated by "---":

   FIRST PART (before "---"): The core visual concept in 2-3 sentences. Describe WHAT the image shows at a glance — the scene, the subjects, the key visual element. This is the headline summary a reviewer reads to quickly understand the creative idea.

   SECOND PART (after "---"): Detailed production notes covering ALL of the following:
   - Composition and layout guidance (e.g. "hero image left, headline right")
   - Color palette references from brand guidelines
   - Typography style (from brand guidelines)
   - Mood and tone (energetic, professional, warm, bold, etc.)
   - How the message connects to the segment's pain points
   - What to draw from the inspiration ads (if provided)
   - Copy and language notes for the market
   - Logo and legal placement

   Example direction format:
   "A square lifestyle photo showing three diverse professionals mid-workout in a bright urban gym, with a Wellpass-branded phone screen overlay in the lower-right corner displaying available classes. Natural light, candid energy, mixed ages 25-45.\n---\nComposition: Left two-thirds lifestyle action, right third phone UI mockup angled 15°. Color palette: Wellbeing White (#f7f5f2) base, Wellpass Aqua (#00a7b5) accents on phone frame and CTA. Typography: Bold sans headline in Premium Black, subtext in Grey 1. Mood: energetic, inclusive, locally proud. Pain point connection: variety and flexibility visualized through multiple activity types. Headline in French: short, benefit-led. CTA in Wellpass Orange (#fd763c)."

3. FORMAT: Only static image dimensions. Use one of:
   - "Static image 1080x1080" (feed/square)
   - "Static image 1200x628" (landscape/link ad)
   - "Static image 1080x1920" (portrait/story)
   Choose the format that best fits the segment's channel (e.g. Meta feed → 1080x1080, LinkedIn → 1200x628).

4. KEYWORDS: 3-6 descriptive tags that capture the visual theme, audience, and mood (e.g. ["corporate wellness", "energetic", "blue tones", "office setting"]).

5. MARKET ADAPTATION: If the market is non-English, write the creative direction in English but note any language-specific considerations (e.g. "headline will be in German — use short, punchy phrasing that works in German").

6. CHANNEL AWARENESS: Tailor the visual approach to the platform:
   - Meta (Instagram/Facebook): Bold visuals, minimal text overlay, scroll-stopping imagery
   - LinkedIn: Professional, clean, data-forward imagery
   - Google: Clear product focus, high contrast for small formats

## Output format
Respond with valid JSON only:
{
  "reasoning": "Explain your creative strategy: why these visual directions, how they connect to brand positioning, what you drew from the inspiration ads",
  "briefs": [
    {
      "segmentId": "seg-123",
      "direction": "Detailed creative direction describing the visual concept, composition, colors, typography, mood, and connection to the segment's pain points...",
      "format": "Static image 1080x1080",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}`;

// ===== Context builder =====

function buildBriefContext(
  settings: SettingsCardData,
  brandGuidelines: string,
  brandPositioning: string,
  segments: { id: string; data: SegmentCardData }[],
  assets: { segmentId: string; data: AssetCardData }[],
): string {
  const objectives = settings.objectives
    .map((o) => `- [${o.type.toUpperCase()}] ${o.label}`)
    .join('\n');
  const channels = settings.channels
    .map((c) => c.label)
    .join(', ');

  let context = `## Campaign Settings
Name: ${settings.name}
Objectives:
${objectives || '(none specified)'}
Campaign Objective: ${settings.campaignObjective || '(not specified)'}
Audience Type: ${settings.audienceType || '(not specified)'}
Market: ${settings.market || '(not specified)'}
Channels: ${channels || '(not specified)'}
Positioning: ${settings.positioning || '(not specified)'}`;

  if (brandGuidelines) {
    context += `\n\n## Brand Guidelines\n${brandGuidelines}`;
  }
  if (brandPositioning) {
    context += `\n\n## Brand Positioning & Messaging\n${brandPositioning}`;
  }

  // Per-segment blocks with their asset references
  context += '\n\n## Target Segments\n';
  for (const seg of segments) {
    context += `\n### Segment: ${seg.data.name} (ID: ${seg.id})
- Group: ${seg.data.group}
- Channel: ${seg.data.channel}
- Targeting: ${seg.data.targeting}
- Tagline: ${seg.data.tagline}
- Funnel stage: ${seg.data.funnelStage || 'not specified'}`;

    const segAssets = assets.filter((a) => a.segmentId === seg.id);
    if (segAssets.length > 0) {
      context += '\n- Inspiration ads:';
      for (const asset of segAssets) {
        context += `\n  - Caption: "${asset.data.caption}"`;
        if (asset.data.image) context += `\n    Visual style: ${asset.data.image}`;
        if (asset.data.reason) context += `\n    Chosen because: ${asset.data.reason}`;
      }
    }
  }

  return context;
}

// ===== generateBriefs =====

export interface GenerateBriefsParams {
  settings: SettingsCardData;
  brandGuidelines: string;
  brandPositioning: string;
  segments: { id: string; data: SegmentCardData }[];
  assets: { segmentId: string; data: AssetCardData }[];
  /** @internal — for testing only; bypasses /api/chat */
  _fetchFn?: typeof fetch;
}

export interface GenerateBriefsResult {
  briefs: (BriefCardData & { segmentId: string })[];
  reasoning?: string;
}

export async function generateBriefs(
  params: GenerateBriefsParams,
): Promise<GenerateBriefsResult> {
  const fetchFn = params._fetchFn ?? fetch;

  const userContent = buildBriefContext(
    params.settings,
    params.brandGuidelines,
    params.brandPositioning,
    params.segments,
    params.assets,
  );

  const messages = [
    { role: 'system', content: BRIEF_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  console.log('[briefSkill] generating briefs', {
    campaign: params.settings.name,
    market: params.settings.market,
    segmentCount: params.segments.length,
    assetCount: params.assets.length,
    hasBrandGuidelines: !!params.brandGuidelines,
    hasBrandPositioning: !!params.brandPositioning,
  });

  const res = await fetchFn('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'gpt-5-mini',
      reasoning_effort: 'medium',
      max_completion_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Server error ${res.status}`);
  }

  const data = await res.json();
  const rawResponse: string = data.content || '{}';
  console.log('[briefSkill] LLM response length:', rawResponse.length);

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(rawResponse);
  } catch {
    console.error('[briefSkill] JSON parse failed. Raw response:', rawResponse.slice(0, 500));
    throw new Error('Brief skill received invalid JSON from the model. Please try again.');
  }

  console.log('[briefSkill] parsed keys:', Object.keys(rawParsed as any));
  console.log('[briefSkill] brief count:', Array.isArray((rawParsed as any)?.briefs) ? (rawParsed as any).briefs.length : 'N/A');

  // If the LLM wrapped briefs inside a nested object, try to unwrap
  const toValidate = (rawParsed as any)?.briefs !== undefined
    ? rawParsed
    : (rawParsed as any)?.data?.briefs !== undefined
      ? (rawParsed as any).data
      : rawParsed;

  const result = briefResponseSchema.safeParse(toValidate);
  if (!result.success) {
    console.error('[briefSkill] validation failed:', result.error.issues);
    console.error('[briefSkill] LLM response:', JSON.stringify(rawParsed).slice(0, 1000));
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Brief generation returned invalid data (${issues}). Please try again.`);
  }

  const briefs: (BriefCardData & { segmentId: string })[] = result.data.briefs.map((b) => ({
    segmentId: b.segmentId,
    direction: b.direction,
    format: b.format,
    keywords: b.keywords,
  }));

  console.log('[briefSkill] success:', briefs.length, 'briefs generated',
    briefs.map((b) => `segment ${b.segmentId}: ${b.direction.slice(0, 60)}...`),
  );

  return {
    briefs,
    reasoning: result.data.reasoning,
  };
}

// ===== buildBriefCards (pure, positions briefs as children of asset or segment cards) =====

export function buildBriefCards(
  briefs: (BriefCardData & { segmentId: string })[],
  allCards: CanvasCard[],
): BriefCard[] {
  if (briefs.length === 0) return [];

  const now = Date.now();

  // Group briefs by parent card (prefer asset card, fall back to segment card)
  const byParent = new Map<string, { parent: CanvasCard; segmentId: string; items: typeof briefs }>();
  for (const b of briefs) {
    const segmentCard = allCards.find(
      (c) => c.id === b.segmentId && c.cardType === 'segment',
    );
    if (!segmentCard) continue;
    const assetCard = allCards.find(
      (c) => c.cardType === 'asset' && c.parentId === segmentCard.id,
    );
    const parentCard = assetCard || segmentCard;
    const group = byParent.get(parentCard.id);
    if (group) {
      group.items.push(b);
    } else {
      byParent.set(parentCard.id, { parent: parentCard, segmentId: segmentCard.id, items: [b] });
    }
  }

  const cards: BriefCard[] = [];
  let seq = 0;
  for (const [, { parent, segmentId, items }] of byParent) {
    const positions = computeChildPositions(parent, items.length, CARD_DIMENSIONS.brief.width);
    for (let i = 0; i < items.length; i++) {
      const b = items[i];
      cards.push({
        id: `brief-${now}-${seq++}`,
        cardType: 'brief',
        label: `Brief — ${parent.label?.split(' ')[0] || 'Segment'}`,
        x: positions[i]?.x || parent.x,
        y: positions[i]?.y || parent.y + parent.height + 100,
        width: CARD_DIMENSIONS.brief.width,
        height: CARD_DIMENSIONS.brief.height,
        parentId: parent.id,
        data: {
          segmentId,
          direction: b.direction,
          format: b.format,
          keywords: b.keywords,
        },
      });
    }
  }

  return cards;
}
