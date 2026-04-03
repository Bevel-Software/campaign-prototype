import type { CanvasCard, CanvasViewport } from './canvasTypes';

// Card dimension defaults by type
export const CARD_DIMENSIONS: Record<string, { width: number; height: number }> = {
  settings: { width: 340, height: 260 },
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
