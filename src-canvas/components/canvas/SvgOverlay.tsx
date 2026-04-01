import type { CanvasCard, CanvasViewport } from '../../lib/canvasTypes';

interface SvgOverlayProps {
  cards: CanvasCard[];
  canvas: CanvasViewport;
  selectedCardId: string | null;
}

export function SvgOverlay({ cards, canvas, selectedCardId }: SvgOverlayProps) {
  // Compute flow lines between parent-child cards
  const flowLines: { d: string; colorClass: string }[] = [];

  for (const card of cards) {
    if (!card.parentId) continue;
    const parent = cards.find((c) => c.id === card.parentId);
    if (!parent) continue;

    const px = canvas.x + (parent.x + parent.width / 2) * canvas.scale;
    const py = canvas.y + (parent.y + parent.height) * canvas.scale;
    const cx = canvas.x + (card.x + card.width / 2) * canvas.scale;
    const cy = canvas.y + card.y * canvas.scale;

    const midY = (py + cy) / 2;
    const d = `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`;

    let colorClass = '';
    if ('data' in card && 'group' in (card.data as any)) {
      const group = (card.data as any).group;
      if (group === 'b2c') colorClass = 'teal';
      else if (group === 'b2b') colorClass = 'blue';
    }

    flowLines.push({ d, colorClass });
  }

  // Connection line from selected card to chat panel edge
  let connectionPath = '';
  if (selectedCardId) {
    const card = cards.find((c) => c.id === selectedCardId);
    if (card) {
      const cardRight = canvas.x + (card.x + card.width) * canvas.scale;
      const cardCenterY = canvas.y + (card.y + card.height / 2) * canvas.scale;
      // Line goes to the right edge of the canvas area (chat panel border)
      const chatLeft = window.innerWidth - 380; // chat-width
      const chatCenterY = window.innerHeight / 2;
      connectionPath = `M ${cardRight} ${cardCenterY} C ${cardRight + 60} ${cardCenterY}, ${chatLeft - 60} ${chatCenterY}, ${chatLeft} ${chatCenterY}`;
    }
  }

  return (
    <svg className="svg-overlay">
      <g>
        {flowLines.map((line, i) => (
          <path key={i} d={line.d} className={`flow-line ${line.colorClass}`} />
        ))}
      </g>
      {connectionPath && (
        <path
          d={connectionPath}
          className={`connection-line ${selectedCardId ? 'visible' : ''}`}
        />
      )}
    </svg>
  );
}
