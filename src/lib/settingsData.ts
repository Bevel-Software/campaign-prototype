import type { SettingsCardData } from './canvasTypes';

type Objective = SettingsCardData['objectives'][number];
type Channel = SettingsCardData['channels'][number];

function splitListLikeString(value: string): string[] {
  // Split on newlines, semicolons, or numbered-list patterns (e.g. "1) ..., 2) ...")
  // Avoid splitting on commas inside numbers (e.g. "10,000") or natural prose
  return value
    .split(/\s*(?:;|\n)\s*|\s*(?=\d+[.)]\s)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferObjectiveType(label: string): Objective['type'] {
  const lower = label.toLowerCase();
  if (/\b(b2b|lead|demo|pipeline|enterprise|employer|company|hr)\b/.test(lower)) {
    return 'b2b';
  }
  return 'b2c';
}

function normalizeObjective(value: unknown): Objective | null {
  if (typeof value === 'string') {
    const label = value.trim();
    if (!label) return null;
    return { label, type: inferObjectiveType(label) };
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const labelCandidate = typeof obj.label === 'string'
      ? obj.label
      : typeof obj.name === 'string'
        ? obj.name
        : typeof obj.objective === 'string'
          ? obj.objective
          : '';
    const label = labelCandidate.trim();
    if (!label) return null;

    const providedType = obj.type;
    const type: Objective['type'] = providedType === 'b2b' || providedType === 'b2c'
      ? providedType
      : inferObjectiveType(label);

    return { label, type };
  }

  return null;
}

function normalizeChannel(value: unknown): Channel | null {
  if (typeof value === 'string') {
    const label = value.trim();
    if (!label) return null;
    return { label, type: label.toLowerCase() };
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const labelCandidate = typeof obj.label === 'string'
      ? obj.label
      : typeof obj.name === 'string'
        ? obj.name
        : '';
    const label = labelCandidate.trim();
    if (!label) return null;

    const type = typeof obj.type === 'string' && obj.type.trim()
      ? obj.type.trim()
      : label.toLowerCase();

    return { label, type };
  }

  return null;
}

export function normalizeObjectiveList(value: unknown): SettingsCardData['objectives'] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeObjective)
      .filter((item): item is Objective => item !== null);
  }

  if (typeof value === 'string') {
    return splitListLikeString(value)
      .map(normalizeObjective)
      .filter((item): item is Objective => item !== null);
  }

  return [];
}

export function normalizeChannelList(value: unknown): SettingsCardData['channels'] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeChannel)
      .filter((item): item is Channel => item !== null);
  }

  if (typeof value === 'string') {
    return splitListLikeString(value)
      .map(normalizeChannel)
      .filter((item): item is Channel => item !== null);
  }

  return [];
}
