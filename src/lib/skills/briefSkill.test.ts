import { describe, it, expect, vi } from 'vitest';
import { buildBriefContext, briefResponseSchema, generateBriefs } from './briefSkill';
import type { SettingsCardData, SegmentCardData, AssetCardData, HistoricalAd } from '../canvasTypes';

// ===== Test helpers =====

function makeSettings(overrides?: Partial<SettingsCardData>): SettingsCardData {
  return {
    name: 'Test Campaign',
    objectives: [{ label: 'Drive sign-ups', type: 'b2c' }],
    campaignObjective: 'tofu',
    audienceType: 'broad',
    market: 'Germany',
    channels: [{ label: 'Meta', type: 'meta' }],
    positioning: 'Leading fitness network',
    ...overrides,
  };
}

function makeSegment(id: string, overrides?: Partial<SegmentCardData>): { id: string; data: SegmentCardData } {
  return {
    id,
    data: {
      group: 'b2c',
      name: `Segment ${id}`,
      channel: 'Meta',
      targeting: 'Fitness enthusiasts 25-35',
      tagline: 'Get moving today',
      funnelStage: 'awareness',
      ...overrides,
    },
  };
}

function makeAsset(segmentId: string, overrides?: Partial<AssetCardData>): { segmentId: string; data: AssetCardData } {
  return {
    segmentId,
    data: {
      segmentId,
      image: 'lifestyle photo of gym',
      source: 'Historical Ad Library',
      caption: 'Join 10,000+ members',
      reason: 'High reach B2C ad',
      ...overrides,
    },
  };
}

function makeHistoricalAd(overrides?: Partial<HistoricalAd>): HistoricalAd {
  return {
    adLink: 'https://example.com/ad/1',
    text: 'Discover 100+ sports near you with Wellpass',
    imageDescription: 'lifestyle photo with diverse athletes',
    imageLink: 'https://example.com/img/1.jpg',
    adDuration: '90 days',
    location: 'DE',
    ageRange: '25-45',
    gender: 'All',
    reach: 202000,
    ...overrides,
  };
}

// ===== T1: buildBriefContext includes historical ads when provided =====

describe('buildBriefContext', () => {
  it('T1: includes Historical Ad Library section when historicalAds provided', () => {
    const context = buildBriefContext(
      makeSettings(),
      'Brand guidelines here',
      'Brand positioning here',
      [makeSegment('seg-1')],
      [],
      [
        makeHistoricalAd({ reach: 202000, location: 'DE', text: 'Discover 100+ sports' }),
        makeHistoricalAd({ reach: 145000, location: 'FR', text: 'Offrez le sport' }),
      ],
    );

    expect(context).toContain('## Historical Ad Library (2 past ads)');
    expect(context).toContain('Reach: 202,000');
    expect(context).toContain('Reach: 145,000');
    expect(context).toContain('Location: DE');
    expect(context).toContain('Location: FR');
    expect(context).toContain('Discover 100+ sports');
    expect(context).toContain('Offrez le sport');
  });

  // ===== T2: omits section when historicalAds is empty =====

  it('T2: omits Historical Ad Library section when historicalAds is empty', () => {
    const context = buildBriefContext(
      makeSettings(),
      '',
      '',
      [makeSegment('seg-1')],
      [],
      [],
    );

    expect(context).not.toContain('Historical Ad Library');
  });

  it('T2b: omits Historical Ad Library section when historicalAds is omitted', () => {
    const context = buildBriefContext(
      makeSettings(),
      '',
      '',
      [makeSegment('seg-1')],
      [],
    );

    expect(context).not.toContain('Historical Ad Library');
  });

  it('includes per-segment asset inspiration alongside historical ads', () => {
    const context = buildBriefContext(
      makeSettings(),
      '',
      '',
      [makeSegment('seg-1')],
      [makeAsset('seg-1')],
      [makeHistoricalAd()],
    );

    expect(context).toContain('Inspiration ads:');
    expect(context).toContain('Join 10,000+ members');
    expect(context).toContain('## Historical Ad Library');
  });
});

// ===== T7: briefResponseSchema accepts valid brief =====

describe('briefResponseSchema', () => {
  it('T7: accepts valid brief with all fields', () => {
    const result = briefResponseSchema.safeParse({
      reasoning: 'Strategic reasoning here',
      briefs: [
        {
          segmentId: 'seg-1',
          direction: 'A bold lifestyle image showing diverse professionals mid-workout in a bright gym setting',
          format: 'Static image 1080x1080',
          keywords: ['fitness', 'corporate wellness', 'energetic'],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.briefs).toHaveLength(1);
      expect(result.data.briefs[0].segmentId).toBe('seg-1');
    }
  });

  // ===== T6: rejects briefs with missing/invalid required fields =====

  it('T6a: rejects brief with direction shorter than 20 chars', () => {
    const result = briefResponseSchema.safeParse({
      briefs: [
        {
          segmentId: 'seg-1',
          direction: 'Too short',
          format: 'Static image 1080x1080',
          keywords: ['fitness'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('T6b: rejects brief with empty keywords array', () => {
    const result = briefResponseSchema.safeParse({
      briefs: [
        {
          segmentId: 'seg-1',
          direction: 'A bold lifestyle image showing diverse professionals mid-workout in a bright gym setting',
          format: 'Static image 1080x1080',
          keywords: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('T6c: rejects brief with empty segmentId', () => {
    const result = briefResponseSchema.safeParse({
      briefs: [
        {
          segmentId: '',
          direction: 'A bold lifestyle image showing diverse professionals mid-workout in a bright gym setting',
          format: 'Static image 1080x1080',
          keywords: ['fitness'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('T6d: rejects empty briefs array', () => {
    const result = briefResponseSchema.safeParse({
      briefs: [],
    });

    expect(result.success).toBe(false);
  });
});

// ===== T4: generateBriefs — malformed JSON throws descriptive error =====

describe('generateBriefs', () => {
  it('T4: malformed JSON from LLM throws descriptive error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'not valid json {{{' }),
    });

    await expect(
      generateBriefs({
        settings: makeSettings(),
        brandGuidelines: '',
        brandPositioning: '',
        segments: [makeSegment('seg-1')],
        assets: [],
        _fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow('invalid JSON');
  });

  // ===== T5: nested {data: {briefs: [...]}} response is unwrapped =====

  it('T5: unwraps nested {data: {briefs: [...]}} response', async () => {
    const validBrief = {
      segmentId: 'seg-1',
      direction: 'A bold lifestyle image showing diverse professionals mid-workout in a bright gym setting',
      format: 'Static image 1080x1080',
      keywords: ['fitness', 'energetic'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: JSON.stringify({
            data: {
              reasoning: 'Nested reasoning',
              briefs: [validBrief],
            },
          }),
        }),
    });

    const result = await generateBriefs({
      settings: makeSettings(),
      brandGuidelines: '',
      brandPositioning: '',
      segments: [makeSegment('seg-1')],
      assets: [],
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.briefs).toHaveLength(1);
    expect(result.briefs[0].segmentId).toBe('seg-1');
    expect(result.reasoning).toBe('Nested reasoning');
  });

  it('handles valid top-level response', async () => {
    const validBrief = {
      segmentId: 'seg-1',
      direction: 'A bold lifestyle image showing diverse professionals mid-workout in a bright gym setting',
      format: 'Static image 1080x1080',
      keywords: ['fitness', 'energetic'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: JSON.stringify({
            reasoning: 'Top level reasoning',
            briefs: [validBrief],
          }),
        }),
    });

    const result = await generateBriefs({
      settings: makeSettings(),
      brandGuidelines: '',
      brandPositioning: '',
      segments: [makeSegment('seg-1')],
      assets: [],
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.briefs).toHaveLength(1);
    expect(result.briefs[0].direction).toContain('bold lifestyle');
  });

  it('throws on server error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    await expect(
      generateBriefs({
        settings: makeSettings(),
        brandGuidelines: '',
        brandPositioning: '',
        segments: [makeSegment('seg-1')],
        assets: [],
        _fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow('Internal server error');
  });

  it('passes historicalAds to context', async () => {
    const historicalAds = [makeHistoricalAd({ reach: 300000, text: 'Special historical ad text for testing' })];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: JSON.stringify({
            briefs: [{
              segmentId: 'seg-1',
              direction: 'A bold lifestyle image showing diverse professionals mid-workout in a bright gym setting',
              format: 'Static image 1080x1080',
              keywords: ['fitness'],
            }],
          }),
        }),
    });

    await generateBriefs({
      settings: makeSettings(),
      brandGuidelines: '',
      brandPositioning: '',
      segments: [makeSegment('seg-1')],
      assets: [],
      historicalAds,
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    // Verify the fetch was called with historical ad content in the user message
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    const userMessage = body.messages.find((m: any) => m.role === 'user');
    expect(userMessage.content).toContain('Historical Ad Library');
    expect(userMessage.content).toContain('300,000');
    expect(userMessage.content).toContain('Special historical ad text for testing');
  });
});
