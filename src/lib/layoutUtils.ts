import type { CanvasCard, CanvasViewport } from './canvasTypes';

// Card dimension defaults by type
export const CARD_DIMENSIONS: Record<string, { width: number; height: number }> = {
  settings: { width: 520, height: 260 },
  segment: { width: 260, height: 170 },
  asset: { width: 260, height: 210 },
  brief: { width: 260, height: 200 },
  creative: { width: 280, height: 380 },
  variation: { width: 252, height: 340 },
};

const GAP = 30;
const Y_OFFSET = 100;

/**
 * Compute positions for child cards centered below a parent card.
 */
export function computeChildPositions(
  parent: CanvasCard,
  childCount: number,
  childWidth: number,
  gap: number = GAP,
  yOffset: number = Y_OFFSET,
): { x: number; y: number }[] {
  const totalWidth = childCount * childWidth + (childCount - 1) * gap;
  const startX = parent.x + parent.width / 2 - totalWidth / 2;
  const y = parent.y + parent.height + yOffset;
  return Array.from({ length: childCount }, (_, i) => ({
    x: startX + i * (childWidth + gap),
    y,
  }));
}

/**
 * Compute a "fit all" viewport that shows all cards with padding.
 */
export function computeFitAllViewport(
  cards: CanvasCard[],
  containerWidth: number,
  containerHeight: number,
  padding: number = 80,
): CanvasViewport {
  if (cards.length === 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const c of cards) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const scaleX = (containerWidth - padding * 2) / contentW;
  const scaleY = (containerHeight - padding * 2) / contentH;
  const scale = Math.min(scaleX, scaleY, 1.2);
  const clampedScale = Math.max(0.15, Math.min(3, scale));

  return {
    scale: clampedScale,
    x: (containerWidth - contentW * clampedScale) / 2 - minX * clampedScale,
    y: (containerHeight - contentH * clampedScale) / 2 - minY * clampedScale,
  };
}

/**
 * Compute a clean auto-layout for all cards, organizing them into a hierarchical
 * tree: roots across the top, children centered below their parents.
 */
export function computeCleanLayout(cards: CanvasCard[]): CanvasCard[] {
  if (cards.length === 0) return cards;

  const byId = new Map(cards.map((c) => [c.id, { ...c }]));
  const roots = cards.filter((c) => c.parentId === null);

  if (roots.length === 0) return cards;

  // Measure the full width of a subtree so we can space roots apart
  function subtreeWidth(card: CanvasCard): number {
    const children = cards.filter((c) => c.parentId === card.id);
    if (children.length === 0) return card.width;
    const childW = children.map(subtreeWidth);
    return Math.max(card.width, childW.reduce((sum, w) => sum + w, 0) + (children.length - 1) * GAP);
  }

  // Recursively position a card and its descendants
  function layoutSubtree(cardId: string, x: number, y: number) {
    const card = byId.get(cardId);
    if (!card) return;

    const children = cards.filter((c) => c.parentId === cardId);
    const stWidth = subtreeWidth(card);

    // Center the card within its subtree allocation
    card.x = x + stWidth / 2 - card.width / 2;
    card.y = y;

    if (children.length === 0) return;

    const childY = y + card.height + Y_OFFSET;
    let childX = x + stWidth / 2;

    // Total width of children's subtrees
    const childSubtreeWidths = children.map(subtreeWidth);
    const totalChildWidth = childSubtreeWidths.reduce((s, w) => s + w, 0) + (children.length - 1) * GAP;
    childX = childX - totalChildWidth / 2;

    for (let i = 0; i < children.length; i++) {
      layoutSubtree(children[i].id, childX, childY);
      childX += childSubtreeWidths[i] + GAP;
    }
  }

  // Lay out each root tree side by side
  const ROOT_GAP = 100;
  let cursorX = 200;
  for (const root of roots) {
    const sw = subtreeWidth(root);
    layoutSubtree(root.id, cursorX, 80);
    cursorX += sw + ROOT_GAP;
  }

  return cards.map((c) => byId.get(c.id) || c);
}

/**
 * Compute the initial position for the first settings card, centered in the viewport.
 */
export function computeInitialSettingsPosition(
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  const w = CARD_DIMENSIONS.settings.width;
  const h = CARD_DIMENSIONS.settings.height;
  return {
    x: containerWidth / 2 - w / 2,
    y: Math.max(80, containerHeight * 0.15 - h / 2),
  };
}
