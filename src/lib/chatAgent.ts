import { z } from 'zod';
import type {
  AppState,
  Action,
  ChatMessage,
  CanvasCard,
  SettingsCard,
  SegmentCard,
  AssetCard,
  BriefCard,
  CreativeCard,
  VariationCard,
  SettingsCardData,
  SegmentCardData,
  AssetCardData,
  BriefCardData,
  CreativeCardData,
} from './canvasTypes';
import { computeChildPositions, computeInitialSettingsPosition, CARD_DIMENSIONS } from './layoutUtils';
import { normalizeChannelList, normalizeObjectiveList } from './settingsData';
import { buildSegmentCards, generateSegments } from './skills/segmentSkill';
import { generateBriefs } from './skills/briefSkill';

// ===== Zod schemas for LLM response validation =====

const toolMessageSchema = z.object({
  label: z.string().optional().default('Processing'),
  result: z.string().optional().default(''),
});

// Coerce objects/arrays to a flattened string so the LLM can return either shape
const stringOrJsonField = z.union([
  z.string(),
  z.record(z.string(), z.unknown()).transform((obj) =>
    Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', '),
  ),
  z.array(z.unknown()).transform((arr) => arr.join(', ')),
]).optional();

const spawnSettingsSchema = z.object({
  type: z.literal('spawn_settings'),
  data: z.object({
    name: z.string().optional(),
    objectives: z.unknown().optional(),
    market: stringOrJsonField,
    budget: stringOrJsonField,
    split: stringOrJsonField,
    timeline: stringOrJsonField,
    channels: z.unknown().optional(),
    positioning: stringOrJsonField,
  }).passthrough(),
});

const segmentSchema = z.object({
  group: z.enum(['b2c', 'b2b']).optional(),
  name: z.string().optional(),
  channel: z.string().optional(),
  targeting: z.string().optional(),
  tagline: z.string().optional(),
}).passthrough();

const spawnSegmentsSchema = z.object({
  type: z.literal('spawn_segments'),
  segments: z.array(segmentSchema),
});

const spawnAssetsSchema = z.object({
  type: z.literal('spawn_assets'),
  assets: z.array(z.object({
    segmentId: z.string().optional(),
    segment_id: z.string().optional(),
    image: z.string().optional(),
    source: z.string().optional(),
    caption: z.string().optional(),
    reason: z.string().optional(),
  }).passthrough()),
});

const keywordsField = z.union([
  z.array(z.string()),
  z.string().transform((s) => s.split(/\s*,\s*/).filter(Boolean)),
]).optional();

const spawnBriefsSchema = z.object({
  type: z.literal('spawn_briefs'),
  briefs: z.array(z.object({
    segmentId: z.string().optional(),
    segment_id: z.string().optional(),
    brief: z.object({
      direction: z.string().optional(),
      format: z.string().optional(),
      keywords: keywordsField,
    }).passthrough().optional(),
    direction: z.string().optional(),
    format: z.string().optional(),
    keywords: keywordsField,
  }).passthrough()),
});

const generateCreativesSchema = z.object({
  type: z.literal('generate_creatives'),
  creatives: z.array(z.object({
    briefId: z.string().optional(),
    brief_id: z.string().optional(),
    creative: z.object({
      type: z.string().optional(),
      group: z.string().optional(),
      brand: z.string().optional(),
      body: z.string().optional(),
      headline: z.string().optional(),
      cta: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }).passthrough().optional(),
    type: z.string().optional(),
    group: z.string().optional(),
    brand: z.string().optional(),
    body: z.string().optional(),
    headline: z.string().optional(),
    cta: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).passthrough()),
});

const variationSpecSchema = z.object({
  parentCreativeId: z.string().optional(),
  parent_creative_id: z.string().optional(),
  editInstruction: z.string().optional(),
  edit_instruction: z.string().optional(),
  instruction: z.string().optional(),
}).passthrough();

const spawnVariationSchema = z.object({
  type: z.literal('spawn_variation'),
  parentCreativeId: z.string().optional(),
  parent_creative_id: z.string().optional(),
  editInstruction: z.string().optional(),
  edit_instruction: z.string().optional(),
});

const spawnVariationsSchema = z.object({
  type: z.literal('spawn_variations'),
  variations: z.array(variationSpecSchema).optional(),
  editInstructions: z.array(z.string()).optional(),
  edit_instructions: z.array(z.string()).optional(),
  parentCreativeId: z.string().optional(),
  parent_creative_id: z.string().optional(),
});

const updateCardSchema = z.object({
  type: z.literal('update_card'),
  cardId: z.string(),
  updates: z.record(z.string(), z.unknown()),
});

const actionSchema = z.discriminatedUnion('type', [
  spawnSettingsSchema,
  spawnSegmentsSchema,
  spawnAssetsSchema,
  spawnBriefsSchema,
  generateCreativesSchema,
  spawnVariationSchema,
  spawnVariationsSchema,
  updateCardSchema,
]);

const llmResponseSchema = z.object({
  reply: z.string().optional().default(''),
  tool_messages: z.array(toolMessageSchema).optional().default([]),
  actions: z.array(z.unknown()).optional().default([]),
});

export function validateAction(raw: unknown): z.infer<typeof actionSchema> | null {
  const result = actionSchema.safeParse(raw);
  if (result.success) return result.data;
  console.warn('Invalid LLM action, skipping:', raw, result.error.format());
  return null;
}

export interface AgentResult {
  reply: string;
  toolMessages: ChatMessage[];
  actions: Action[];
  generationRequests: { cardId: string; prompt: string; previousImageDataUrl?: string }[];
}

const SYSTEM_PROMPT = `You are a campaign strategist AI. You help marketing teams plan and execute advertising campaigns.

IMPORTANT: This platform generates STATIC IMAGE creatives only. You cannot create videos, animations, carousels, stories, reels, or any motion/multi-frame content. Every creative and variation is a single static image. When discussing formats, only reference static image dimensions (e.g., 1080x1080 feed, 1200x628 landscape, 1080x1920 portrait). If the user asks for video or non-image formats, explain that this platform specializes in static image ads and suggest image alternatives.

You have access to the company's brand guidelines and product positioning documents (provided as separate system messages). Use them to:
- Identify which company and product you are working with.
- Ground all campaign settings, segments, and creatives in the company's actual positioning, key differentiators, and competitive advantages.
- Match the correct tone and messaging pillars for each target audience as defined in the positioning document.
- Reference real stats and competitive differentiation from the positioning document when generating copy.
- Respect the brand voice, visual identity, and writing guidelines described in the brand guidelines document.

The user is working on an infinite canvas where campaign elements appear as cards. You converse naturally and output structured JSON actions to create/modify cards on the canvas.

## Available card types
- **settings**: Campaign overview (name, objectives, market, budget, timeline, channels, positioning). IMPORTANT: "objectives" and "channels" must be arrays of strings, with each objective/channel as its own separate string. Do NOT combine multiple objectives into a single string. Example: ["Drive 10,000 sign-ups in 6 months", "Increase brand awareness by 30%"] not ["1) Drive 10,000 sign-ups... 2) Increase brand awareness..."]. Channels MUST only be "Google", "Meta", or "LinkedIn" — no other platforms.
- **segment**: Audience segment (group b2c/b2b, name, channel, targeting, tagline)
- **asset**: Reference image/asset from past campaigns (segmentId, image URL, source, caption)
- **brief**: Creative brief for a segment (direction, format, keywords)
- **creative**: Ad creative (type meta/linkedin, group, headline, body, cta, tags)
- **variation**: A variation of an existing creative with edits

## Your response format
Always respond with valid JSON:
{
  "reply": "Your conversational message to the user (can include <strong>bold</strong> for emphasis)",
  "tool_messages": [
    {"label": "Tool name", "result": "Result description with <strong>highlights</strong>"}
  ],
  "actions": [
    // One or more of these action types:
    {"type": "spawn_settings", "data": {settings card data}},
    {"type": "spawn_segments", "segments": [{segment data}, ...]},
    {"type": "spawn_assets", "assets": [{"segmentId": "...", "image": "visual description", "source": "Historical Ad Library", "caption": "ad text snippet", "reason": "why this ad was picked"}, ...]},
    {"type": "spawn_briefs", "briefs": [{"segmentId": "...", "brief": {brief data}}, ...]},
    {"type": "generate_creatives", "creatives": [{"briefId": "...", "creative": {creative text data}}, ...]},
    {"type": "spawn_variation", "parentCreativeId": "...", "editInstruction": "..."},
    {"type": "spawn_variations", "variations": [{"parentCreativeId": "...", "editInstruction": "..."}, ...]},
    {"type": "update_card", "cardId": "...", "updates": {partial card data}}
  ]
}

## Two-step brief → creative workflow
Image creation follows a TWO-STEP approval flow:
1. **Briefs first**: Use "spawn_briefs" to create editable brief cards (direction, format, keywords). Tell the user to review/edit them and confirm when ready.
2. **Creatives after approval**: Only when the user explicitly approves briefs (e.g. "briefs look good", "generate creatives", "go ahead"), use "generate_creatives" with the briefId of each existing brief card on the canvas. This triggers image generation.

IMPORTANT: "spawn_briefs" creates text-only planning cards — NO images are generated. "generate_creatives" creates ad cards WITH automatic image generation. Never skip the brief review step unless the user explicitly asks to go straight to creatives.

## Four-step settings → segments → ad inspiration → briefs workflow
Campaign setup follows a FOUR-STEP approval flow:
1. **Settings first**: When the user describes a campaign, create ONLY a settings card. Tell the user to review/edit the campaign details and confirm when ready.
2. **Segments after approval**: Only when the user explicitly approves the settings, use "spawn_segments" to create audience segments. Then ask the user to review the segments and confirm.
3. **Ad inspiration after segments are confirmed**: Only when the user explicitly approves the segments, shortlist 1 historical reference ad for each segment. Use "spawn_assets" to create asset cards linked to each segment. In your reply, explain WHY you picked each ad (e.g. same persona, highest reach, matching messaging). Then ask the user to review the references and confirm before moving to briefs.
4. **Briefs after ad inspiration is confirmed**: Only when the user approves the ad references, proceed to create briefs.

IMPORTANT: Never spawn segments in the same response as spawn_settings. Wait for the user to confirm the settings card first.
IMPORTANT: Never spawn assets (ad references) in the same response as spawn_segments. Wait for the user to confirm the segments first.
IMPORTANT: Pick the best-matching ad per segment based on: audience match (B2B vs B2C), reach, messaging similarity, location relevance.

## Guidelines
- When the user describes a campaign, create ONLY a settings card — do NOT generate segments yet. Ask the user to review the settings first.
- When asked to generate segments, emit a spawn_segments action with an empty segments array: {"type": "spawn_segments", "segments": []}. The segment generation system will handle the details. Your reply should tell the user that segments are being generated. Do NOT spawn assets yet — wait for user to confirm segments first.
- When the user confirms segments, shortlist 1 historical reference ad for each segment using "spawn_assets". For each asset set: caption = ad text snippet, source = "Historical Ad Library", image = ad's image description, and reason = a short explanation of why this ad was picked (e.g. "Highest reach B2B ad at 202k, employer-benefit messaging matches this segment"). Then in your reply, ask the user whether they'd like to use these inspirations or swap any out before moving to briefs.
- When asked for briefs or image briefs, emit a spawn_briefs action with an empty briefs array: {"type": "spawn_briefs", "briefs": []}. The brief generation system will handle the details using the full brand context. ONLY do this if at least one segment is marked with ✓ (isSelected). If no segments are selected, ask the user to select segments first. Then tell the user: "Here are your image briefs. Double-click any text to edit, then tell me when you're ready to generate creatives."
- When the user approves briefs, use "generate_creatives" ONLY for briefs whose parent segment is marked with ✓ (isSelected). Set each creative's briefId to the ID of the corresponding existing brief card from the canvas state
- For Meta ads, use type "meta". For LinkedIn ads, use type "linkedin"
- B2C segments typically use Meta (Instagram/Facebook), B2B segments use LinkedIn
- Be specific with targeting, taglines, and creative direction — don't be generic
- If the user has a card selected and gives an edit instruction, create a variation
- If the user asks for multiple variants, use "spawn_variations" with one entry per requested edit
- Always include tool_messages for any "work" you're doing (loading data, generating content, etc.)
- Keep your reply concise and actionable
`;

function getAllKnownCards(state: AppState, result: AgentResult): CanvasCard[] {
  return [
    ...state.cards,
    ...result.actions
      .filter((a): a is Extract<Action, { type: 'ADD_CARD' }> => a.type === 'ADD_CARD')
      .map((a) => a.card),
    ...result.actions
      .filter((a): a is Extract<Action, { type: 'ADD_CARDS' }> => a.type === 'ADD_CARDS')
      .flatMap((a) => a.cards),
  ];
}

interface VariationSpec {
  parentCreativeId?: string;
  editInstruction: string;
}

function parseVariationSpecs(action: any, state: AppState): VariationSpec[] {
  const actionParentId = action.parentCreativeId || action.parent_creative_id || state.selectedCardId || undefined;
  const specs: VariationSpec[] = [];

  if (Array.isArray(action.variations)) {
    for (const v of action.variations) {
      const editInstruction = String(
        v?.editInstruction ?? v?.edit_instruction ?? v?.instruction ?? '',
      ).trim();
      if (!editInstruction) continue;
      specs.push({
        parentCreativeId: v?.parentCreativeId || v?.parent_creative_id || actionParentId,
        editInstruction,
      });
    }
  }

  if (Array.isArray(action.editInstructions) || Array.isArray(action.edit_instructions)) {
    const edits = (action.editInstructions || action.edit_instructions) as unknown[];
    for (const edit of edits) {
      const editInstruction = String(edit ?? '').trim();
      if (!editInstruction) continue;
      specs.push({ parentCreativeId: actionParentId, editInstruction });
    }
  }

  const singleEdit = String(
    action.editInstruction ?? action.edit_instruction ?? '',
  ).trim();
  if (singleEdit) {
    specs.push({
      parentCreativeId: actionParentId,
      editInstruction: singleEdit,
    });
  }

  return specs;
}

function spawnVariations(
  specs: VariationSpec[],
  state: AppState,
  result: AgentResult,
  now: number,
) {
  if (specs.length === 0) return;

  const allCards = getAllKnownCards(state, result);
  const byParent = new Map<string, { parentCard: CreativeCard | VariationCard; edits: string[] }>();

  for (const spec of specs) {
    const parentId = spec.parentCreativeId || state.selectedCardId || undefined;
    if (!parentId) continue;
    const parentCard = allCards.find(
      (c): c is CreativeCard | VariationCard =>
        c.id === parentId && (c.cardType === 'creative' || c.cardType === 'variation'),
    );
    if (!parentCard) continue;

    const group = byParent.get(parentId);
    if (group) {
      group.edits.push(spec.editInstruction);
    } else {
      byParent.set(parentId, { parentCard, edits: [spec.editInstruction] });
    }
  }

  const cards: VariationCard[] = [];
  const genRequests: AgentResult['generationRequests'] = [];
  let seq = 0;

  for (const [, group] of byParent) {
    const { parentCard, edits } = group;
    const positions = computeChildPositions(
      parentCard,
      edits.length,
      CARD_DIMENSIONS.variation.width,
    );
    const parentData = parentCard.data as CreativeCardData;

    for (let i = 0; i < edits.length; i++) {
      const editInstruction = edits[i];
      const basePrompt = parentData.prompt || state.basePrompt || 'Edit the image';
      const prompt = `${basePrompt}. Edit: ${editInstruction}`;
      const cardId = `var-${now}-${seq++}`;

      const data: CreativeCardData = {
        ...parentData,
        imageDataUrl: null,
        isGenerating: true,
        error: null,
        prompt,
      };

      cards.push({
        id: cardId,
        cardType: 'variation',
        label: `Variation — ${editInstruction.slice(0, 25)}`,
        x: positions[i]?.x || parentCard.x,
        y: positions[i]?.y || parentCard.y + parentCard.height + 100,
        width: CARD_DIMENSIONS.variation.width,
        height: CARD_DIMENSIONS.variation.height,
        parentId: parentCard.id,
        data,
      });

      genRequests.push({
        cardId,
        prompt,
        previousImageDataUrl: parentData.imageDataUrl || undefined,
      });
    }
  }

  if (cards.length > 0) {
    result.actions.push({ type: 'ADD_CARDS', cards });
    result.generationRequests.push(...genRequests);
  }
}

function serializeCanvasState(state: AppState): string {
  if (state.cards.length === 0) {
    return 'Canvas is empty. No cards yet.';
  }

  const cardSummaries = state.cards.map((c) => {
    switch (c.cardType) {
      case 'settings':
        return `[Settings] "${c.data.name}" — Market: ${c.data.market}, Budget: ${c.data.budget}`;
      case 'segment':
        return `[Segment: ${c.id}]${c.data.isSelected ? ' ✓' : ''} "${c.data.name}" (${c.data.group}${c.data.funnelStage ? `, ${c.data.funnelStage}` : ''}) — ${c.data.channel}, ${c.data.targeting}`;
      case 'asset':
        return `[Asset: ${c.id}] for segment ${c.data.segmentId} — "${c.data.caption}" (${c.data.source})`;
      case 'brief':
        return `[Brief: ${c.id}] for segment ${c.data.segmentId} — ${c.data.direction.slice(0, 80)}...`;
      case 'creative':
        return `[Creative: ${c.id}] ${c.data.type} ad — "${c.data.headline}" (${c.data.isGenerating ? 'generating image...' : c.data.imageDataUrl ? 'has image' : 'no image'})`;
      case 'variation':
        return `[Variation: ${c.id}] of ${c.parentId} — "${c.data.headline}"`;
      default: {
        const _exhaustive: never = c;
        return `[Unknown: ${(_exhaustive as any).id}]`;
      }
    }
  });

  const selectedInfo = state.selectedCardId
    ? `\nSelected card: ${state.selectedCardId}`
    : '\nNo card selected.';

  return cardSummaries.join('\n') + selectedInfo;
}

export async function processMessage(
  userText: string,
  state: AppState,
): Promise<AgentResult> {
  const canvasState = serializeCanvasState(state);

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Current canvas state:\n${canvasState}`,
    },
  ];

  if (state.brandGuidelines) {
    messages.push({
      role: 'system',
      content: `## Brand Guidelines\n\n${state.brandGuidelines}`,
    });
  }

  if (state.brandPositioning) {
    messages.push({
      role: 'system',
      content: `## Product Positioning & Messaging\n\n${state.brandPositioning}`,
    });
  }

  if (state.historicalAds.length > 0) {
    const adSummaries = state.historicalAds.map((ad, i) =>
      `[Ad ${i + 1}] Reach: ${ad.reach.toLocaleString()} | Duration: ${ad.adDuration} | Location: ${ad.location} | Type: ${ad.imageDescription}\nText: ${ad.text.slice(0, 200)}${ad.text.length > 200 ? '...' : ''}\nLink: ${ad.adLink}`
    ).join('\n\n');
    messages.push({
      role: 'system',
      content: `## Historical Ad Library (${state.historicalAds.length} past ads)\nUse these to shortlist reference ads for each segment after spawning segments. Pick the best match based on audience, reach, and messaging.\n\n${adSummaries}`,
    });
  }

  // Include recent chat history for context (last 10 messages)
  const recentMessages = state.messages.slice(-10);
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.text });
    } else if (msg.role === 'agent') {
      messages.push({ role: 'assistant', content: msg.text });
    }
  }

  messages.push({ role: 'user', content: userText });

  let rawResponse: string;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: 'gpt-5-mini',
        reasoning_effort: 'low',
        max_completion_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `Server error ${res.status}`);
    }

    const data = await res.json();
    rawResponse = data.content || '{}';
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : 'Failed to get response from OpenAI',
    );
  }

  // Parse response
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(rawResponse);
  } catch {
    return {
      reply: "I had trouble formatting my response. Let me try again — could you rephrase your request?",
      toolMessages: [],
      actions: [],
      generationRequests: [],
    };
  }

  // Validate top-level response shape
  const parsed = llmResponseSchema.safeParse(rawParsed);
  if (!parsed.success) {
    console.warn('LLM response failed validation:', parsed.error.format());
    return {
      reply: (rawParsed as any)?.reply || "I had trouble formatting my response. Let me try again.",
      toolMessages: [],
      actions: [],
      generationRequests: [],
    };
  }

  // Convert parsed response to AgentResult
  const result: AgentResult = {
    reply: parsed.data.reply,
    toolMessages: [],
    actions: [],
    generationRequests: [],
  };

  // Tool messages
  for (const tm of parsed.data.tool_messages) {
    result.toolMessages.push({
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'tool',
      text: '',
      toolLabel: tm.label,
      toolResult: tm.result,
      timestamp: Date.now(),
    });
  }

  // Process actions (validate each individually so one bad action doesn't block others)
  for (const rawAction of parsed.data.actions) {
    let validatedAction = validateAction(rawAction);
    if (!validatedAction) continue;

    // Intercept spawn_segments with empty array — delegate to segment skill
    if (validatedAction.type === 'spawn_segments' && (!validatedAction.segments || validatedAction.segments.length === 0)) {
      const settingsCard = state.cards.find((c): c is SettingsCard => c.cardType === 'settings');
      if (settingsCard) {
        try {
          const skillResult = await generateSegments({
            settings: settingsCard.data,
            brandGuidelines: state.brandGuidelines,
            brandPositioning: state.brandPositioning,
          });
          validatedAction = { ...validatedAction, segments: skillResult.segments as any };
        } catch (err) {
          result.reply += `\n\nSegment generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
          continue;
        }
      }
    }

    // Intercept spawn_briefs with empty array — delegate to brief skill
    if (validatedAction.type === 'spawn_briefs' && (!validatedAction.briefs || validatedAction.briefs.length === 0)) {
      const settingsCard = state.cards.find((c): c is SettingsCard => c.cardType === 'settings');
      const selectedSegments = state.cards.filter(
        (c): c is SegmentCard => c.cardType === 'segment' && !!c.data.isSelected,
      );
      if (settingsCard && selectedSegments.length > 0) {
        const assets = state.cards.filter(
          (c): c is AssetCard => c.cardType === 'asset',
        );
        try {
          const skillResult = await generateBriefs({
            settings: settingsCard.data,
            brandGuidelines: state.brandGuidelines,
            brandPositioning: state.brandPositioning,
            segments: selectedSegments.map((s) => ({ id: s.id, data: s.data })),
            assets: assets.map((a) => ({ segmentId: a.data.segmentId, data: a.data })),
          });
          validatedAction = { ...validatedAction, briefs: skillResult.briefs.map((b) => ({ segmentId: b.segmentId, brief: { direction: b.direction, format: b.format, keywords: b.keywords } as Record<string, unknown> })) } as NonNullable<typeof validatedAction>;
        } catch (err) {
          result.reply += `\n\nBrief generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
          continue;
        }
      }
    }

    processAction(validatedAction, state, result);
  }

  return result;
}

type ValidatedAction = z.infer<typeof actionSchema>;

export function processAction(action: ValidatedAction, state: AppState, result: AgentResult) {
  const now = Date.now();

  switch (action.type) {
    case 'spawn_settings': {
      const data: SettingsCardData = {
        name: action.data?.name || 'New Campaign',
        objectives: normalizeObjectiveList(action.data?.objectives),
        market: action.data?.market || '',
        budget: action.data?.budget || '',
        split: action.data?.split || '',
        timeline: action.data?.timeline || '',
        channels: normalizeChannelList(action.data?.channels),
        positioning: action.data?.positioning || '',
      };

      // Position in center of viewport
      const pos = computeInitialSettingsPosition(
        window.innerWidth - 380, // subtract chat panel
        window.innerHeight - 48, // subtract toolbar
      );

      const card: SettingsCard = {
        id: `settings-${now}`,
        cardType: 'settings',
        label: data.name,
        x: pos.x,
        y: pos.y,
        width: CARD_DIMENSIONS.settings.width,
        height: CARD_DIMENSIONS.settings.height,
        parentId: null,
        data,
      };

      result.actions.push({ type: 'ADD_CARD', card });
      break;
    }

    case 'spawn_segments': {
      const segments = action.segments || [];
      const settingsCard = (state.cards.find((c) => c.cardType === 'settings')
        || (result.actions.find((a) => a.type === 'ADD_CARD' && (a as any).card?.cardType === 'settings') as any)?.card) as SettingsCard | undefined;

      if (!settingsCard || segments.length === 0) break;

      const normalizedSegments: SegmentCardData[] = segments.map((seg: any, i: number) => ({
        group: seg.group || 'b2c',
        name: seg.name || `Segment ${i + 1}`,
        channel: seg.channel || 'Meta',
        targeting: seg.targeting || '',
        tagline: seg.tagline || '',
      }));

      const cards = buildSegmentCards(normalizedSegments, settingsCard);
      result.actions.push({ type: 'ADD_CARDS', cards });
      break;
    }

    case 'spawn_assets': {
      const assets = action.assets || [];
      const allCards = getAllKnownCards(state, result);

      // Group assets by parent segment so we can position siblings correctly
      const byParent = new Map<string, { parent: SegmentCard; items: typeof assets }>();
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const segId = a.segmentId || a.segment_id;
        const parentCard = allCards.find(
          (c): c is SegmentCard => c.id === segId && c.cardType === 'segment',
        );
        if (!parentCard) continue;
        const group = byParent.get(parentCard.id);
        if (group) { group.items.push(a); }
        else { byParent.set(parentCard.id, { parent: parentCard, items: [a] }); }
      }

      const cards: AssetCard[] = [];
      let seq = 0;
      for (const [, { parent, items }] of byParent) {
        const positions = computeChildPositions(parent, items.length, CARD_DIMENSIONS.asset.width);
        for (let i = 0; i < items.length; i++) {
          const a = items[i];
          const data: AssetCardData = {
            segmentId: parent.id,
            image: a.image || '',
            source: a.source || 'Library',
            caption: a.caption || '',
            reason: a.reason || undefined,
          };
          const isInspiration = !!data.reason;
          cards.push({
            id: `asset-${now}-${seq++}`,
            cardType: 'asset',
            label: isInspiration ? `Inspiration — ${parent.label?.split(' ')[0] || 'Segment'}` : `Reference — ${parent.label?.split(' ')[0] || 'Asset'}`,
            x: positions[i]?.x || parent.x,
            y: positions[i]?.y || parent.y + parent.height + 100,
            width: CARD_DIMENSIONS.asset.width,
            height: CARD_DIMENSIONS.asset.height,
            parentId: parent.id,
            data,
          });
        }
      }

      if (cards.length > 0) {
        result.actions.push({ type: 'ADD_CARDS', cards });
      }
      break;
    }

    case 'spawn_briefs': {
      const briefs = action.briefs || [];
      const allCards = getAllKnownCards(state, result);

      // Group briefs by parent — prefer the asset/inspiration card for the segment, fall back to segment
      const byParent = new Map<string, { parent: CanvasCard; segmentId: string; items: typeof briefs }>();
      for (let i = 0; i < briefs.length; i++) {
        const b = briefs[i];
        const segId = b.segmentId || b.segment_id;
        const segmentCard = allCards.find(
          (c): c is SegmentCard => c.id === segId && c.cardType === 'segment',
        );
        if (!segmentCard) continue;
        // Find an inspiration/asset card that is a child of this segment
        const assetCard = allCards.find(
          (c) => c.cardType === 'asset' && c.parentId === segmentCard.id,
        );
        const parentCard = assetCard || segmentCard;
        const group = byParent.get(parentCard.id);
        if (group) { group.items.push(b); }
        else { byParent.set(parentCard.id, { parent: parentCard, segmentId: segmentCard.id, items: [b] }); }
      }

      const cards: BriefCard[] = [];
      let seq = 0;
      for (const [, { parent, segmentId, items }] of byParent) {
        const positions = computeChildPositions(parent, items.length, CARD_DIMENSIONS.brief.width);
        for (let i = 0; i < items.length; i++) {
          const b = items[i];
          const data: BriefCardData = {
            segmentId,
            direction: b.brief?.direction || b.direction || '',
            format: b.brief?.format || b.format || 'Static image (1080x1080)',
            keywords: b.brief?.keywords || b.keywords || [],
          };
          cards.push({
            id: `brief-${now}-${seq++}`,
            cardType: 'brief',
            label: `Brief — ${parent.label?.split(' ')[0] || 'Segment'}`,
            x: positions[i]?.x || parent.x,
            y: positions[i]?.y || parent.y + parent.height + 100,
            width: CARD_DIMENSIONS.brief.width,
            height: CARD_DIMENSIONS.brief.height,
            parentId: parent.id,
            data,
          });
        }
      }

      if (cards.length > 0) {
        result.actions.push({ type: 'ADD_CARDS', cards });
      }
      break;
    }

    case 'generate_creatives': {
      const creatives = action.creatives || [];
      const allCards = getAllKnownCards(state, result);

      const cards: CreativeCard[] = [];
      const genRequests: AgentResult['generationRequests'] = [];

      for (let i = 0; i < creatives.length; i++) {
        const c = creatives[i];
        const briefId = c.briefId || c.brief_id;
        const parentCard = allCards.find(
          (card): card is BriefCard => card.id === briefId && card.cardType === 'brief',
        );

        if (!parentCard) continue;

        const positions = computeChildPositions(
          parentCard,
          1,
          CARD_DIMENSIONS.creative.width,
        );

        const data: CreativeCardData = {
          type: (c.creative?.type || c.type || 'meta') as CreativeCardData['type'],
          group: (c.creative?.group || c.group || 'b2c') as CreativeCardData['group'],
          imageDataUrl: null,
          brand: c.creative?.brand || c.brand || 'EGYM WELLPASS',
          body: c.creative?.body || c.body || '',
          headline: c.creative?.headline || c.headline || '',
          cta: c.creative?.cta || c.cta || 'Learn More',
          prompt: '',
          tags: c.creative?.tags || c.tags || [],
          isGenerating: true,
          error: null,
        };

        const cardId = `creative-${now}-${i}`;

        // Build the image generation prompt from the brief + segment context
        const briefData = parentCard.cardType === 'brief' ? parentCard.data : null;
        const segmentCard = briefData
          ? allCards.find((card) => card.id === (briefData as BriefCardData).segmentId)
          : null;
        const segmentData = segmentCard?.cardType === 'segment' ? segmentCard.data : null;

        let prompt = state.basePrompt || 'Create a professional advertising creative image';

        // Include settings context (campaign objectives, market, positioning)
        const settingsCard = allCards.find((card) => card.cardType === 'settings');
        if (settingsCard?.cardType === 'settings') {
          const sd = settingsCard.data;
          if (sd.market) prompt += `. Market: ${sd.market}`;
          if (sd.positioning) prompt += `. Campaign positioning: ${sd.positioning}`;
          if (sd.objectives?.length) prompt += `. Objectives: ${sd.objectives.map((o) => o.label).join(', ')}`;
        }

        if (briefData) {
          prompt += `. Creative direction: ${(briefData as BriefCardData).direction}`;
          prompt += `. Format: ${(briefData as BriefCardData).format}`;
        }
        if (segmentData) {
          prompt += `. Target audience: ${(segmentData as SegmentCardData).name} — ${(segmentData as SegmentCardData).targeting}`;
          prompt += `. Key message: ${(segmentData as SegmentCardData).tagline}`;
        }
        if (data.headline) prompt += `. Headline: ${data.headline}`;

        // Include asset/inspiration references from matching segment
        if (briefData) {
          const segId = (briefData as BriefCardData).segmentId;
          const assetCards = allCards.filter(
            (card): card is AssetCard => card.cardType === 'asset' && card.data.segmentId === segId,
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
        }

        data.prompt = prompt;

        cards.push({
          id: cardId,
          cardType: 'creative',
          label: `Creative ${i + 1} — ${data.headline.slice(0, 25)}`,
          x: positions[0]?.x || parentCard.x,
          y: positions[0]?.y || parentCard.y + parentCard.height + 100,
          width: CARD_DIMENSIONS.creative.width,
          height: CARD_DIMENSIONS.creative.height,
          parentId: parentCard.id,
          data,
        });

        genRequests.push({
          cardId,
          prompt,
        });
      }

      if (cards.length > 0) {
        result.actions.push({ type: 'ADD_CARDS', cards });
      }
      result.generationRequests.push(...genRequests);
      break;
    }

    case 'spawn_variation':
    case 'spawn_variations': {
      const specs = parseVariationSpecs(action, state);
      spawnVariations(specs, state, result, now);
      break;
    }

    case 'update_card': {
      if (action.cardId && action.updates) {
        const safeUpdates: any = { ...action.updates };
        if ('objectives' in safeUpdates) {
          safeUpdates.objectives = normalizeObjectiveList(safeUpdates.objectives);
        }
        if ('channels' in safeUpdates) {
          safeUpdates.channels = normalizeChannelList(safeUpdates.channels);
        }

        result.actions.push({
          type: 'UPDATE_CARD_DATA',
          cardId: action.cardId,
          data: safeUpdates,
        });
      }
      break;
    }
  }
}
