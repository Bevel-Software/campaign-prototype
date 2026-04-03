import { z } from 'zod';
import type {
  SettingsCard,
  SettingsCardData,
  SegmentCard,
  SegmentCardData,
} from '../canvasTypes';
import { computeChildPositions, CARD_DIMENSIONS } from '../layoutUtils';

// ===== Zod schemas (stricter than chatAgent's permissive segmentSchema) =====

const funnelStageEnum = z.enum(['awareness', 'consideration', 'conversion']);

const skillSegmentSchema = z.object({
  group: z.enum(['b2c', 'b2b']),
  name: z.string().min(3),
  channel: z.string().min(2),
  targeting: z.string().min(20),
  tagline: z.string().min(5),
  funnel_stage: funnelStageEnum,
});

export const skillResponseSchema = z.object({
  reasoning: z.string().optional(),
  segments: z.array(skillSegmentSchema).min(2).max(50),
});

export type SkillSegment = z.infer<typeof skillSegmentSchema>;

// ===== Prompt =====

const SEGMENT_SYSTEM_PROMPT = `You are a senior media strategist who builds audience segments for paid advertising campaigns. You think like a media buyer — every segment must be specific enough to set up in an ad platform. The platform produces static image ads only (no video, carousel, or story formats).

Given campaign settings and brand context, produce an exhaustive, goal-aligned set of audience segments.

## How to use brand context

The brand positioning document is organized by user group (e.g., HR/Decision Makers, Employees, Partners). For each group you will find:
- A positioning statement (how the brand should be framed for this audience)
- Pain points / core needs (what motivates them)
- Messaging pillars (specific value propositions per benefit area)
- Key benefits (the proof points behind each pillar)

**Mine this structure.** Build segments that map to specific user-group pain points. Use the messaging pillars to inform your taglines. If the positioning doc includes competitor analysis, use it — taglines for B2B segments should address the specific weakness of the competitor that audience is most likely evaluating.

Follow the headline patterns and voice registers described in the brand guidelines (e.g., tu vs. vous, contrast/paradox vs. question hooks). If the market is non-English, write taglines in the appropriate language.

## Rules

1. EXHAUSTIVENESS: Generate segments that collectively cover ALL campaign objectives. For each objective, at least one segment must address it. If objectives span both B2C and B2B, include both types.

2. GOAL ALIGNMENT: Each segment MUST map to at least one campaign objective. Reference which objective this segment serves in the targeting description.

3. SPECIFICITY — each field must be actionable:
   - "name": A short, vivid label describing ONLY who the person is (e.g. "Burned-Out HR Directors", "Career-Switching Millennials"). Do NOT include the channel, funnel stage, or ad format — those are separate fields.
   - "channel": The specific platform from the campaign's channel list. Do not use channels that aren't listed in the settings unless the list is empty.
   - "targeting": Use this exact 4-line format with labels and newlines:
     Demographics: age, location, job role
     Interests: platform interests, behavioral signals
     Platform: lookalikes, custom audiences, retargeting pools
     Objective: which campaign objective this segment addresses
     Each line should be concise (under 15 words). No prose paragraphs.
   - "tagline": A message that resonates with THIS audience's specific pain points, using the brand's voice register and headline patterns. If competitor analysis is available, address competitor weaknesses. Always include a concrete number or proof point.

4. COUNT: Generate as many segments as needed to exhaustively cover all objectives and channels. Let the campaign settings drive the count — do not artificially limit. Do not pad with low-value segments, but do not hold back if more segments are warranted.

5. FUNNEL STAGE: Each segment must specify a funnel stage:
   - "awareness" — broad targeting, brand message, reach-optimized
   - "consideration" — interest-based targeting, value propositions, engagement-optimized
   - "conversion" — narrow targeting (retargeting, lookalikes), CTA-focused, conversion-optimized
   A complete campaign should include at least one awareness and one consideration or conversion segment.

6. MARKET ADAPTATION: Adapt to the market specified in the campaign settings. Use market-specific stats, competitive positioning, and language from the brand context. If the market is France, write taglines in French. If Germany, in German.

7. NO OVERLAP: Each segment must target a distinct audience. If two segments share >50% targeting criteria, merge them or differentiate by funnel stage.

## Output format
Respond with valid JSON only:
{
  "reasoning": "Explain: (1) your segmentation strategy, (2) which segments serve which objectives, (3) any coverage gaps you see, (4) suggested budget allocation across segments (as rough percentages)",
  "segments": [
    {
      "group": "b2b",
      "name": "Burned-Out HR Directors",
      "channel": "Meta",
      "targeting": "Demographics: 35-55, urban, HR director/VP\\nInterests: employee wellness, retention strategies\\nPlatform: lookalike 1-2% of existing clients\\nObjective: drive demo requests from HR decision-makers",
      "tagline": "string",
      "funnel_stage": "consideration"
    }
  ]
}`;

function buildCampaignContext(
  settings: SettingsCardData,
  brandGuidelines: string,
  brandPositioning: string,
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
Market: ${settings.market || '(not specified)'}
Budget: ${settings.budget || '(not specified)'}
Timeline: ${settings.timeline || '(not specified)'}
Channels: ${channels || '(not specified)'}
Positioning: ${settings.positioning || '(not specified)'}`;

  if (brandGuidelines) {
    context += `\n\n## Brand Guidelines\n${brandGuidelines}`;
  }
  if (brandPositioning) {
    context += `\n\n## Brand Positioning & Messaging\n${brandPositioning}`;
  }

  return context;
}

// ===== generateSegments =====

export interface GenerateSegmentsParams {
  settings: SettingsCardData;
  brandGuidelines: string;
  brandPositioning: string;
  /** @internal — for testing only; bypasses /api/chat */
  _fetchFn?: typeof fetch;
}

export interface GenerateSegmentsResult {
  segments: SegmentCardData[];
  reasoning?: string;
}

export async function generateSegments(
  params: GenerateSegmentsParams,
): Promise<GenerateSegmentsResult> {
  const fetchFn = params._fetchFn ?? fetch;

  const userContent = buildCampaignContext(
    params.settings,
    params.brandGuidelines,
    params.brandPositioning,
  );

  const messages = [
    { role: 'system', content: SEGMENT_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  console.log('[segmentSkill] generating segments', {
    campaign: params.settings.name,
    market: params.settings.market,
    objectives: params.settings.objectives.length,
    channels: params.settings.channels.map((c) => c.label),
    hasBrandGuidelines: !!params.brandGuidelines,
    hasBrandPositioning: !!params.brandPositioning,
  });

  let rawResponse: string;
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
  rawResponse = data.content || '{}';
  console.log('[segmentSkill] LLM response length:', rawResponse.length);

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(rawResponse);
  } catch {
    console.error('[segmentSkill] JSON parse failed. Raw response:', rawResponse.slice(0, 500));
    throw new Error('Segment skill received invalid JSON from the model. Please try again.');
  }

  console.log('[segmentSkill] parsed keys:', Object.keys(rawParsed as any));
  console.log('[segmentSkill] segment count:', Array.isArray((rawParsed as any)?.segments) ? (rawParsed as any).segments.length : 'N/A');

  // If the LLM wrapped segments inside a nested object, try to unwrap
  const toValidate = (rawParsed as any)?.segments !== undefined
    ? rawParsed
    : (rawParsed as any)?.data?.segments !== undefined
      ? (rawParsed as any).data
      : rawParsed;

  const result = skillResponseSchema.safeParse(toValidate);
  if (!result.success) {
    console.error('[segmentSkill] validation failed:', result.error.issues);
    console.error('[segmentSkill] LLM response:', JSON.stringify(rawParsed).slice(0, 1000));
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Segment generation returned invalid data (${issues}). Please try again.`);
  }

  const segments: SegmentCardData[] = result.data.segments.map((seg) => ({
    group: seg.group,
    name: seg.name,
    channel: seg.channel,
    targeting: seg.targeting,
    tagline: seg.tagline,
    funnelStage: seg.funnel_stage,
  }));

  console.log('[segmentSkill] success:', segments.length, 'segments generated',
    segments.map((s) => `${s.name} (${s.group}, ${s.funnelStage})`),
  );

  return {
    segments,
    reasoning: result.data.reasoning,
  };
}

// ===== buildSegmentCards (pure, extracted from processAction) =====

export function buildSegmentCards(
  segments: SegmentCardData[],
  settingsCard: SettingsCard,
): SegmentCard[] {
  if (segments.length === 0) return [];

  const now = Date.now();
  const positions = computeChildPositions(
    settingsCard,
    segments.length,
    CARD_DIMENSIONS.segment.width,
  );

  return segments.map((seg, i) => ({
    id: `seg-${now}-${i}`,
    cardType: 'segment' as const,
    label: seg.name,
    x: positions[i]?.x || 0,
    y: positions[i]?.y || 0,
    width: CARD_DIMENSIONS.segment.width,
    height: CARD_DIMENSIONS.segment.height,
    parentId: settingsCard.id,
    data: seg,
  }));
}
