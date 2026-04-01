import { useRef, useEffect, useCallback } from 'react';
import type { CanvasCard, CanvasViewport } from '../../lib/canvasTypes';

const WIDTH = 180;
const HEIGHT = 110;
const PADDING = 40;

const TYPE_COLORS: Record<string, string> = {
  settings: '#135E69',
  segment: '#1a7a87',
  asset: '#86868b',
  brief: '#aeaeb2',
  creative: '#135E69',
  variation: '#FF8F3D',
};

const TYPE_OPACITY: Record<string, number> = {
  brief: 0.4,
  variation: 0.7,
};

interface MinimapProps {
  cards: CanvasCard[];
  canvas: CanvasViewport;
  containerWidth: number;
  containerHeight: number;
  onNavigate: (x: number, y: number) => void;
}

export function Minimap({ cards, canvas, containerWidth, containerHeight, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || cards.length === 0) return;

    const ctx = el.getContext('2d');
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    el.width = WIDTH * dpr;
    el.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Compute bounding box of all cards
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cards) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    }

    const contentW = maxX - minX + PADDING * 2;
    const contentH = maxY - minY + PADDING * 2;
    const scale = Math.min(WIDTH / contentW, HEIGHT / contentH);
    const offsetX = (WIDTH - contentW * scale) / 2 - (minX - PADDING) * scale;
    const offsetY = (HEIGHT - contentH * scale) / 2 - (minY - PADDING) * scale;

    // Draw parent→child connection lines
    ctx.strokeStyle = 'rgba(19, 94, 105, 0.25)';
    ctx.lineWidth = 0.5;
    for (const card of cards) {
      if (!card.parentId) continue;
      const parent = cards.find((c) => c.id === card.parentId);
      if (!parent) continue;

      const px = offsetX + (parent.x + parent.width / 2) * scale;
      const py = offsetY + (parent.y + parent.height) * scale;
      const cx = offsetX + (card.x + card.width / 2) * scale;
      const cy = offsetY + card.y * scale;

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }

    // Draw card rectangles
    for (const card of cards) {
      const rx = offsetX + card.x * scale;
      const ry = offsetY + card.y * scale;
      const rw = card.width * scale;
      const rh = card.height * scale;

      const color = TYPE_COLORS[card.cardType] || '#86868b';
      const opacity = TYPE_OPACITY[card.cardType] || 1.0;

      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 2);
      ctx.fill();
    }

    // Draw viewport rectangle
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#FF8F3D';
    ctx.lineWidth = 1.5;

    const vpX = offsetX + (-canvas.x / canvas.scale) * scale;
    const vpY = offsetY + (-canvas.y / canvas.scale) * scale;
    const vpW = (containerWidth / canvas.scale) * scale;
    const vpH = (containerHeight / canvas.scale) * scale;

    ctx.beginPath();
    ctx.roundRect(vpX, vpY, vpW, vpH, 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }, [cards, canvas, containerWidth, containerHeight]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (cards.length === 0) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Reverse the minimap coordinate transform to get world coords
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of cards) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.width);
        maxY = Math.max(maxY, c.y + c.height);
      }

      const contentW = maxX - minX + PADDING * 2;
      const contentH = maxY - minY + PADDING * 2;
      const scale = Math.min(WIDTH / contentW, HEIGHT / contentH);
      const offsetX = (WIDTH - contentW * scale) / 2 - (minX - PADDING) * scale;
      const offsetY = (HEIGHT - contentH * scale) / 2 - (minY - PADDING) * scale;

      // Convert click to world coordinates
      const worldX = (clickX - offsetX) / scale;
      const worldY = (clickY - offsetY) / scale;

      // Center the viewport on this world position
      const newX = containerWidth / 2 - worldX * canvas.scale;
      const newY = containerHeight / 2 - worldY * canvas.scale;

      onNavigate(newX, newY);
    },
    [cards, canvas.scale, containerWidth, containerHeight, onNavigate],
  );

  if (cards.length === 0) return null;

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        style={{ width: WIDTH, height: HEIGHT }}
        onClick={handleClick}
      />
    </div>
  );
}
