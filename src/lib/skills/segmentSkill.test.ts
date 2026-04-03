import { describe, it, expect, vi } from 'vitest';
import { buildSegmentCards, generateSegments, skillResponseSchema } from './segmentSkill';
import type { SettingsCard, SegmentCardData } from '../canvasTypes';
import { computeChildPositions, CARD_DIMENSIONS } from '../layoutUtils';
import type OpenAI from 'openai';

// ===== Test helpers =====

function makeSettingsCard(overrides?: Partial<SettingsCard>): SettingsCard {
  return {
    id: 'settings-1',
    cardType: 'settings',
    label: 'Test Campaign',
    x: 200,
    y: 100,
    width: CARD_DIMENSIONS.settings.width,
    height: CARD_DIMENSIONS.settings.height,
    parentId: null,
    data: {
      name: 'Test Campaign',
      objectives: [{ label: 'Drive sign-ups', type: 'b2c' }],
      market: 'France',
      budget: '€50,000',
      split: '',
      timeline: 'Q3 2026',
      channels: [{ label: 'Meta', type: 'meta' }],
      positioning: 'Leading fitness network',
    },
    ...overrides,
  };
}

const FUNNEL_STAGES = ['awareness', 'consideration', 'conversion'] as const;

function makeSegments(count: number): SegmentCardData[] {
  return Array.from({ length: count }, (_, i) => ({
    group: i % 2 === 0 ? 'b2c' as const : 'b2b' as const,
    name: `Segment ${i + 1} Name`,
    channel: i % 2 === 0 ? 'Meta' : 'LinkedIn',
    targeting: `Detailed targeting for segment ${i + 1} with specific criteria`,
    tagline: `Compelling tagline ${i + 1}`,
    funnelStage: FUNNEL_STAGES[i % 3],
  }));
}

// ===== buildSegmentCards tests =====

describe('buildSegmentCards', () => {
  it('T1: produces correct number of cards matching input segments', () => {
    const settings = makeSettingsCard();
    const segments = makeSegments(4);
    const cards = buildSegmentCards(segments, settings);
    expect(cards).toHaveLength(4);
  });

  it('T2: all cards have cardType segment and correct parentId', () => {
    const settings = makeSettingsCard();
    const segments = makeSegments(3);
    const cards = buildSegmentCards(segments, settings);
    for (const card of cards) {
      expect(card.cardType).toBe('segment');
      expect(card.parentId).toBe('settings-1');
    }
  });

  it('T3: positions match computeChildPositions output', () => {
    const settings = makeSettingsCard();
    const segments = makeSegments(3);
    const cards = buildSegmentCards(segments, settings);
    const expectedPositions = computeChildPositions(
      settings,
      3,
      CARD_DIMENSIONS.segment.width,
    );
    for (let i = 0; i < cards.length; i++) {
      expect(cards[i].x).toBe(expectedPositions[i].x);
      expect(cards[i].y).toBe(expectedPositions[i].y);
    }
  });

  it('T4: each card data matches input SegmentCardData', () => {
    const settings = makeSettingsCard();
    const segments = makeSegments(2);
    const cards = buildSegmentCards(segments, settings);
    for (let i = 0; i < cards.length; i++) {
      expect(cards[i].data.group).toBe(segments[i].group);
      expect(cards[i].data.name).toBe(segments[i].name);
      expect(cards[i].data.channel).toBe(segments[i].channel);
      expect(cards[i].data.targeting).toBe(segments[i].targeting);
      expect(cards[i].data.tagline).toBe(segments[i].tagline);
    }
  });

  it('T5: returns empty array for 0 segments', () => {
    const settings = makeSettingsCard();
    const cards = buildSegmentCards([], settings);
    expect(cards).toHaveLength(0);
  });

  it('T6: handles 6+ segments with correct positions', () => {
    const settings = makeSettingsCard();
    const segments = makeSegments(6);
    const cards = buildSegmentCards(segments, settings);
    expect(cards).toHaveLength(6);
    const expectedPositions = computeChildPositions(
      settings,
      6,
      CARD_DIMENSIONS.segment.width,
    );
    for (let i = 0; i < cards.length; i++) {
      expect(cards[i].x).toBe(expectedPositions[i].x);
      expect(cards[i].y).toBe(expectedPositions[i].y);
    }
    // All cards have correct dimensions
    for (const card of cards) {
      expect(card.width).toBe(CARD_DIMENSIONS.segment.width);
      expect(card.height).toBe(CARD_DIMENSIONS.segment.height);
    }
  });
});

// ===== Zod schema validation tests =====

describe('skillResponseSchema', () => {
  it('T7: accepts valid segment with all fields including funnel_stage', () => {
    const input = {
      reasoning: 'Test reasoning',
      segments: [
        {
          group: 'b2c',
          name: 'Young Professionals',
          channel: 'Meta',
          targeting: 'Ages 25-34, urban, interested in fitness and wellness apps, active on Instagram',
          tagline: 'Your gym, your rules',
          funnel_stage: 'awareness',
        },
        {
          group: 'b2b',
          name: 'HR Decision Makers',
          channel: 'LinkedIn',
          targeting: 'HR directors and benefits managers at companies with 500+ employees, interested in employee wellness',
          tagline: 'Invest in your team',
          funnel_stage: 'consideration',
        },
      ],
    };
    const result = skillResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('T8: rejects segment with short name', () => {
    const input = {
      segments: [
        { group: 'b2c', name: 'AB', channel: 'Meta', targeting: 'Detailed targeting text here for this segment', tagline: 'A tagline', funnel_stage: 'awareness' },
        { group: 'b2b', name: 'OK Name', channel: 'LinkedIn', targeting: 'Another detailed targeting for segment', tagline: 'Another tagline', funnel_stage: 'awareness' },
      ],
    };
    const result = skillResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('T9: rejects segment with short targeting', () => {
    const input = {
      segments: [
        { group: 'b2c', name: 'Good Name', channel: 'Meta', targeting: 'too short', tagline: 'A tagline', funnel_stage: 'awareness' },
        { group: 'b2b', name: 'Other Name', channel: 'LinkedIn', targeting: 'Another detailed targeting description here', tagline: 'Another tagline', funnel_stage: 'awareness' },
      ],
    };
    const result = skillResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('T10: rejects missing group field', () => {
    const input = {
      segments: [
        { name: 'No Group', channel: 'Meta', targeting: 'Detailed targeting description for this segment', tagline: 'A tagline', funnel_stage: 'awareness' },
        { group: 'b2b', name: 'Has Group', channel: 'LinkedIn', targeting: 'Another detailed targeting for segment', tagline: 'Another tagline', funnel_stage: 'awareness' },
      ],
    };
    const result = skillResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('T11: rejects response with fewer than 2 segments', () => {
    const input = {
      segments: [
        { group: 'b2c', name: 'Only One', channel: 'Meta', targeting: 'Detailed targeting description for this one segment', tagline: 'A tagline', funnel_stage: 'awareness' },
      ],
    };
    const result = skillResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('T11b: rejects missing funnel_stage', () => {
    const input = {
      segments: [
        { group: 'b2c', name: 'No Funnel', channel: 'Meta', targeting: 'Detailed targeting description for this segment', tagline: 'A tagline' },
        { group: 'b2b', name: 'Also No Funnel', channel: 'LinkedIn', targeting: 'Another detailed targeting for segment', tagline: 'Another tagline' },
      ],
    };
    const result = skillResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ===== generateSegments tests (mock OpenAI via _openaiClient) =====

function makeMockClient(createFn: (...args: any[]) => any): OpenAI {
  return { chat: { completions: { create: createFn } } } as unknown as OpenAI;
}

const baseParams = {
  settings: {
    name: 'Test',
    objectives: [{ label: 'Drive sign-ups', type: 'b2c' as const }],
    market: 'France',
    budget: '€50k',
    split: '',
    timeline: 'Q3',
    channels: [{ label: 'Meta', type: 'meta' }],
    positioning: 'Leading fitness network',
  },
  brandGuidelines: 'Use brand colors',
  brandPositioning: 'Market leader in wellness',
  apiKey: 'test-key',
};

describe('generateSegments', () => {
  it('T12: valid response returns segments array', async () => {
    const mockResponse = {
      reasoning: 'Targeting both consumers and HR',
      segments: [
        { group: 'b2c', name: 'Young Pros', channel: 'Meta', targeting: 'Ages 25-34, urban fitness enthusiasts active on Instagram', tagline: 'Move more, stress less', funnel_stage: 'awareness' },
        { group: 'b2b', name: 'HR Leaders', channel: 'LinkedIn', targeting: 'HR directors at mid-size companies seeking employee wellness solutions', tagline: 'Healthier teams, better results', funnel_stage: 'consideration' },
      ],
    };

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockResponse) } }],
    });

    const result = await generateSegments({
      ...baseParams,
      _openaiClient: makeMockClient(mockCreate),
    });

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].name).toBe('Young Pros');
    expect(result.segments[1].group).toBe('b2b');
    expect(result.reasoning).toBe('Targeting both consumers and HR');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('T13: retries once on API failure', async () => {
    const mockResponse = {
      segments: [
        { group: 'b2c', name: 'Retry Seg', channel: 'Meta', targeting: 'Ages 25-34, urban fitness enthusiasts active on Instagram', tagline: 'Worth the wait', funnel_stage: 'awareness' },
        { group: 'b2b', name: 'Second Seg', channel: 'LinkedIn', targeting: 'HR directors at companies seeking employee wellness programs', tagline: 'Better benefits', funnel_stage: 'conversion' },
      ],
    };

    const mockCreate = vi.fn()
      .mockRejectedValueOnce(new Error('API rate limit'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

    const result = await generateSegments({
      ...baseParams,
      _openaiClient: makeMockClient(mockCreate),
    });

    expect(result.segments).toHaveLength(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
