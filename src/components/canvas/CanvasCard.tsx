import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CanvasCard as CanvasCardType, Action } from '../../lib/canvasTypes';
import { SettingsCardContent } from '../cards/SettingsCardContent';
import { SegmentCardContent } from '../cards/SegmentCardContent';
import { AssetCardContent } from '../cards/AssetCardContent';
import { BriefCardContent } from '../cards/BriefCardContent';
import { CreativeCardContent } from '../cards/CreativeCardContent';

interface CanvasCardProps {
  card: CanvasCardType;
  isSelected: boolean;
  dispatch: React.Dispatch<Action>;
  onGenerateCreative?: (briefCardId: string) => void;
  onGenerateVariations?: (creativeCardId: string, format?: string) => void;
  onGenerateBrief?: (segmentCardId: string) => void;
}

export function CanvasCard({ card, isSelected, dispatch, onGenerateCreative, onGenerateVariations, onGenerateBrief }: CanvasCardProps) {
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    cardX: 0,
    cardY: 0,
    moved: false,
  });
  const elRef = useRef<HTMLDivElement>(null);

  // Track actual rendered height via ResizeObserver
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      const w = Math.round(entry.contentRect.width);
      if (Math.abs(h - card.height) > 5 || Math.abs(w - card.width) > 5) {
        dispatch({
          type: 'UPDATE_CARD_POSITION',
          cardId: card.id,
          x: card.x,
          y: card.y,
          width: w,
          height: h,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [card.id, card.x, card.y, card.width, card.height, dispatch]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        cardX: card.x,
        cardY: card.y,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [card.x, card.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current.isDragging) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;

      if (!dragState.current.moved && Math.abs(dx) + Math.abs(dy) > 4) {
        dragState.current.moved = true;
        elRef.current?.classList.add('dragging', 'grabbing');
      }

      if (dragState.current.moved) {
        // Get canvas scale from parent transform
        const transform = elRef.current?.parentElement;
        const scale = transform
          ? parseFloat(transform.style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1')
          : 1;

        const newX = dragState.current.cardX + dx / scale;
        const newY = dragState.current.cardY + dy / scale;

        // Update DOM directly for smooth dragging
        if (elRef.current) {
          elRef.current.style.left = `${newX}px`;
          elRef.current.style.top = `${newY}px`;
        }
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current.isDragging) return;

      elRef.current?.classList.remove('dragging', 'grabbing');

      if (dragState.current.moved) {
        // Get canvas scale
        const transform = elRef.current?.parentElement;
        const scale = transform
          ? parseFloat(transform.style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1')
          : 1;

        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        const newX = dragState.current.cardX + dx / scale;
        const newY = dragState.current.cardY + dy / scale;

        dispatch({ type: 'UPDATE_CARD_POSITION', cardId: card.id, x: newX, y: newY });
      } else {
        // Click without drag = select
        dispatch({ type: 'SELECT_CARD', cardId: card.id });
      }

      dragState.current.isDragging = false;
      dragState.current.moved = false;
    },
    [card.id, dispatch],
  );

  const handleFieldChange = useMemo(
    () => (field: string, value: string | boolean) => {
      dispatch({ type: 'UPDATE_CARD_DATA', cardId: card.id, data: { [field]: value } });
    },
    [card.id, dispatch],
  );

  const className = [
    'canvas-card',
    `card-${card.cardType}`,
    'visible',
    isSelected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isNewCard = Date.now() - (card as any)._spawnTime < 1000;

  return (
    <div
      ref={elRef}
      className={className}
      data-card-id={card.id}
      style={{
        left: card.x,
        top: card.y,
        animation: isNewCard ? 'cardSpawnIn 0.5s var(--spring-bounce) forwards' : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {card.cardType === 'settings' && <SettingsCardContent data={card.data} onFieldChange={handleFieldChange} />}
      {card.cardType === 'segment' && (
        <SegmentCardContent
          data={card.data}
          onFieldChange={handleFieldChange}
          onGenerateBrief={onGenerateBrief ? () => onGenerateBrief(card.id) : undefined}
        />
      )}
      {card.cardType === 'asset' && <AssetCardContent data={card.data} />}
      {card.cardType === 'brief' && (
        <BriefCardContent
          data={card.data}
          onFieldChange={handleFieldChange}
          onGenerateCreative={onGenerateCreative ? () => onGenerateCreative(card.id) : undefined}
        />
      )}
      {(card.cardType === 'creative' || card.cardType === 'variation') && (
        <CreativeCardContent
          data={card.data}
          label={card.label}
          onFieldChange={handleFieldChange}
          onGenerateVariations={onGenerateVariations ? (format?: string) => onGenerateVariations(card.id, format) : undefined}
        />
      )}
    </div>
  );
}
