import { describe, it, expect } from 'vitest';
import { validateAction, processAction } from './chatAgent';
import type { AgentResult } from './chatAgent';
import type { AppState, SettingsCard, SegmentCard, BriefCard } from './canvasTypes';
import { canvasReducer, initialState } from './canvasReducer';

// ===== spawn_settings coercion =====

describe('spawn_settings', () => {
  it('accepts budget and timeline as strings', () => {
    const result = validateAction({
      type: 'spawn_settings',
      data: {
        name: 'Summer Campaign',
        market: 'France',
        budget: '€50,000',
        timeline: 'Q3 2026',
      },
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('spawn_settings');
    const data = (result as Extract<typeof result, { type: 'spawn_settings' }>)!.data;
    expect(data.budget).toBe('€50,000');
    expect(data.timeline).toBe('Q3 2026');
  });

  it('coerces budget object to string', () => {
    const result = validateAction({
      type: 'spawn_settings',
      data: {
        name: 'Marseille Launch',
        budget: { total: '€50,000', monthly: '€10,000' },
      },
    });
    expect(result).not.toBeNull();
    const data = (result as Extract<typeof result, { type: 'spawn_settings' }>)!.data;
    expect(typeof data.budget).toBe('string');
    expect(data.budget).toContain('total');
    expect(data.budget).toContain('€50,000');
  });

  it('coerces timeline object to string', () => {
    const result = validateAction({
      type: 'spawn_settings',
      data: {
        name: 'Marseille Launch',
        timeline: { start: '2026-06-01', end: '2026-09-30', phases: 3 },
      },
    });
    expect(result).not.toBeNull();
    const data = (result as Extract<typeof result, { type: 'spawn_settings' }>)!.data;
    expect(typeof data.timeline).toBe('string');
    expect(data.timeline).toContain('start');
    expect(data.timeline).toContain('2026-06-01');
  });

  it('coerces budget array to string', () => {
    const result = validateAction({
      type: 'spawn_settings',
      data: {
        name: 'Test',
        budget: ['€20k digital', '€10k print'],
      },
    });
    expect(result).not.toBeNull();
    const data = (result as Extract<typeof result, { type: 'spawn_settings' }>)!.data;
    expect(typeof data.budget).toBe('string');
    expect(data.budget).toContain('€20k digital');
  });
});

// ===== spawn_briefs keywords coercion =====

describe('spawn_briefs', () => {
  it('accepts keywords as an array of strings', () => {
    const result = validateAction({
      type: 'spawn_briefs',
      briefs: [
        {
          segmentId: 'seg-1',
          brief: {
            direction: 'Golden hour vibes',
            format: 'Instagram Reels (9:16)',
            keywords: ['golden hour', 'apero', 'Marseille'],
          },
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('spawn_briefs');
    const brief = (result as any).briefs[0].brief;
    expect(brief.keywords).toEqual(['golden hour', 'apero', 'Marseille']);
  });

  it('coerces keywords from comma-separated string to array', () => {
    const result = validateAction({
      type: 'spawn_briefs',
      briefs: [
        {
          segmentId: 'seg-1',
          brief: {
            direction: 'Golden hour vibes',
            format: 'Instagram Reels (9:16)',
            keywords: 'golden hour, apero, Marseille, blue accents',
          },
        },
      ],
    });
    expect(result).not.toBeNull();
    const brief = (result as any).briefs[0].brief;
    expect(Array.isArray(brief.keywords)).toBe(true);
    expect(brief.keywords).toEqual(['golden hour', 'apero', 'Marseille', 'blue accents']);
  });

  it('coerces flat keywords string (no nested brief object)', () => {
    const result = validateAction({
      type: 'spawn_briefs',
      briefs: [
        {
          segmentId: 'seg-1',
          direction: 'Street art and hidden alleys',
          format: 'IG Feed (1:1)',
          keywords: 'street art, cobblestones, pastel facade, sun flare',
        },
      ],
    });
    expect(result).not.toBeNull();
    const b = (result as any).briefs[0];
    expect(Array.isArray(b.keywords)).toBe(true);
    expect(b.keywords).toContain('street art');
    expect(b.keywords).toContain('sun flare');
  });

  it('accepts keywords as undefined (optional field)', () => {
    const result = validateAction({
      type: 'spawn_briefs',
      briefs: [
        {
          segmentId: 'seg-1',
          direction: 'Minimalist',
          format: 'Static (1080x1080)',
        },
      ],
    });
    expect(result).not.toBeNull();
  });

  it('handles the exact LLM payload from the bug report', () => {
    const result = validateAction({
      type: 'spawn_briefs',
      briefs: [
        {
          segmentId: 'seg-1775066064068-0',
          brief: {
            direction: 'Golden-hour Vieux-Port energy. Fast-cut Reels capturing apero scene.',
            format: 'Meta -- Instagram Reels/Stories (9:16), 7-12 s, sound-on',
            keywords: 'golden hour, Vieux-Port, apero, live music, street, Marseille blue accents, brand palette, FR overlay CTA',
          },
        },
        {
          segmentId: 'seg-1775066064068-0',
          brief: {
            direction: 'Street art & hidden alleys near Le Panier.',
            format: 'Meta -- IG/FB Feed (1:1 or 4:5), carousel 3-5 panels',
            keywords: 'Le Panier, street art, cobblestones, pastel facade, typographic overlay, brand font, gritty + sun flare',
          },
        },
        {
          segmentId: 'seg-1775066064068-0',
          brief: {
            direction: 'On-the-water POV from Vieux-Port.',
            format: 'Meta -- Instagram Reels/Stories (9:16), 8-10 s, sound-on',
            keywords: 'sailing, boat deck, ropes, wake, Mediterranean turquoise, POV, ripple transition, diversity, sun-kissed, brand CTA button, FR overlay',
          },
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('spawn_briefs');
    const briefs = (result as any).briefs;
    expect(briefs).toHaveLength(3);
    // All keywords should be coerced to arrays
    for (const b of briefs) {
      expect(Array.isArray(b.brief.keywords)).toBe(true);
      expect(b.brief.keywords.length).toBeGreaterThan(0);
    }
  });
});

// ===== other action types still pass =====

describe('other action types', () => {
  it('validates spawn_segments', () => {
    const result = validateAction({
      type: 'spawn_segments',
      segments: [
        { group: 'b2c', name: 'Young Professionals', channel: 'Meta', targeting: '25-35', tagline: 'Live well' },
        { group: 'b2b', name: 'HR Managers', channel: 'LinkedIn', targeting: 'HR decision makers', tagline: 'Retain talent' },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('spawn_segments');
  });

  it('validates update_card', () => {
    const result = validateAction({
      type: 'update_card',
      cardId: 'settings-123',
      updates: { name: 'Updated Campaign' },
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('update_card');
  });

  it('validates generate_creatives', () => {
    const result = validateAction({
      type: 'generate_creatives',
      creatives: [
        {
          briefId: 'brief-123',
          creative: {
            type: 'meta',
            headline: 'Live your best life',
            body: 'Discover wellness',
            cta: 'Learn More',
          },
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('generate_creatives');
  });

  it('rejects unknown action types', () => {
    const result = validateAction({
      type: 'unknown_action',
      data: {},
    });
    expect(result).toBeNull();
  });
});

// ===== Reducer: UPDATE_CARD_POSITION with height =====

function makeSegmentCard(id: string, overrides?: Partial<SegmentCard>): SegmentCard {
  return {
    id,
    cardType: 'segment',
    label: 'Test Segment',
    x: 100,
    y: 100,
    width: 260,
    height: 170,
    parentId: 'settings-1',
    data: { group: 'b2c', name: 'Test', channel: 'Meta', targeting: 'adults', tagline: 'tagline' },
    ...overrides,
  };
}

function makeBriefCard(id: string, segmentId: string, overrides?: Partial<BriefCard>): BriefCard {
  return {
    id,
    cardType: 'brief',
    label: 'Test Brief',
    x: 100,
    y: 370,
    width: 260,
    height: 200,
    parentId: segmentId,
    data: { segmentId, direction: 'test direction', format: 'Static', keywords: [] },
    ...overrides,
  };
}

function emptyResult(): AgentResult {
  return { reply: '', toolMessages: [], actions: [], generationRequests: [] };
}

describe('reducer UPDATE_CARD_POSITION with height', () => {
  it('T1: updates card height when provided', () => {
    const state: AppState = {
      ...initialState,
      cards: [makeSegmentCard('seg-1')],
    };
    const next = canvasReducer(state, {
      type: 'UPDATE_CARD_POSITION',
      cardId: 'seg-1',
      x: 100,
      y: 100,
      height: 220,
    });
    expect(next.cards[0].height).toBe(220);
  });

  it('T2: leaves height unchanged when not provided', () => {
    const state: AppState = {
      ...initialState,
      cards: [makeSegmentCard('seg-1')],
    };
    const next = canvasReducer(state, {
      type: 'UPDATE_CARD_POSITION',
      cardId: 'seg-1',
      x: 200,
      y: 200,
    });
    expect(next.cards[0].height).toBe(170);
    expect(next.cards[0].x).toBe(200);
  });
});

// ===== processAction: fallback removal =====

describe('processAction spawn_briefs without index fallback', () => {
  const stateWithSegment: AppState = {
    ...initialState,
    cards: [makeSegmentCard('seg-1')],
  };

  it('T3: skips brief without segmentId', () => {
    const action = validateAction({
      type: 'spawn_briefs',
      briefs: [{ direction: 'test direction', format: 'Static image' }],
    })!;
    const result = emptyResult();
    processAction(action, stateWithSegment, result);
    // No ADD_CARDS action should be produced
    expect(result.actions.filter((a) => a.type === 'ADD_CARDS')).toHaveLength(0);
  });

  it('T4: creates brief with valid segmentId', () => {
    const action = validateAction({
      type: 'spawn_briefs',
      briefs: [{ segmentId: 'seg-1', direction: 'test direction', format: 'Static' }],
    })!;
    const result = emptyResult();
    processAction(action, stateWithSegment, result);
    const addCards = result.actions.filter((a) => a.type === 'ADD_CARDS');
    expect(addCards).toHaveLength(1);
    expect((addCards[0] as any).cards).toHaveLength(1);
    expect((addCards[0] as any).cards[0].cardType).toBe('brief');
  });
});

describe('processAction generate_creatives without index fallback', () => {
  const stateWithBrief: AppState = {
    ...initialState,
    cards: [
      makeSegmentCard('seg-1'),
      makeBriefCard('brief-1', 'seg-1'),
    ],
  };

  it('T5: skips creative without briefId', () => {
    const action = validateAction({
      type: 'generate_creatives',
      creatives: [{
        creative: { type: 'meta', headline: 'Test', body: 'Body', cta: 'CTA' },
      }],
    })!;
    const result = emptyResult();
    processAction(action, stateWithBrief, result);
    expect(result.actions.filter((a) => a.type === 'ADD_CARDS')).toHaveLength(0);
    expect(result.generationRequests).toHaveLength(0);
  });
});

// ===== processAction spawn_segments uses buildSegmentCards =====

describe('processAction spawn_segments with buildSegmentCards', () => {
  function makeSettingsCard(): SettingsCard {
    return {
      id: 'settings-1',
      cardType: 'settings',
      label: 'Test Campaign',
      x: 200,
      y: 100,
      width: 520,
      height: 260,
      parentId: null,
      data: {
        name: 'Test Campaign',
        objectives: [],
        market: 'France',
        budget: '€50k',
        split: '',
        timeline: 'Q3',
        channels: [],
        positioning: '',
      },
    };
  }

  it('T14: spawn_segments with populated segments creates cards via buildSegmentCards', () => {
    const stateWithSettings: AppState = {
      ...initialState,
      cards: [makeSettingsCard()],
    };
    const action = validateAction({
      type: 'spawn_segments',
      segments: [
        { group: 'b2c', name: 'Young Pros', channel: 'Meta', targeting: 'Ages 25-34', tagline: 'Move more' },
        { group: 'b2b', name: 'HR Leaders', channel: 'LinkedIn', targeting: 'HR directors', tagline: 'Better teams' },
      ],
    })!;
    const result = emptyResult();
    processAction(action, stateWithSettings, result);
    const addCards = result.actions.filter((a) => a.type === 'ADD_CARDS');
    expect(addCards).toHaveLength(1);
    const cards = (addCards[0] as any).cards;
    expect(cards).toHaveLength(2);
    expect(cards[0].cardType).toBe('segment');
    expect(cards[0].parentId).toBe('settings-1');
    expect(cards[0].data.name).toBe('Young Pros');
    expect(cards[1].data.name).toBe('HR Leaders');
  });
});
