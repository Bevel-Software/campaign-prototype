import { forwardRef, useCallback, useRef, useEffect, useState } from 'react';
import type { CanvasViewport, CanvasCard, Action } from '../../lib/canvasTypes';
import { CanvasCard as CanvasCardComponent } from './CanvasCard';
import { SvgOverlay } from './SvgOverlay';
import { Minimap } from './Minimap';
import { CanvasEmptyState } from './CanvasEmptyState';

interface CanvasAreaProps {
  canvas: CanvasViewport;
  cards: CanvasCard[];
  selectedCardId: string | null;
  dispatch: React.Dispatch<Action>;
  onGenerateCreative?: (briefCardId: string) => void;
  onGenerateVariations?: (creativeCardId: string) => void;
  onGenerateBrief?: (segmentCardId: string) => void;
}

export const CanvasArea = forwardRef<HTMLDivElement, CanvasAreaProps>(
  ({ canvas, cards, selectedCardId, dispatch, onGenerateCreative, onGenerateVariations, onGenerateBrief }, ref) => {
    const transformRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Track container size for minimap
    useEffect(() => {
      const el = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [ref]);

    const handleMinimapNavigate = useCallback(
      (x: number, y: number) => {
        dispatch({ type: 'SET_CANVAS_VIEWPORT', payload: { x, y, scale: canvas.scale } });
      },
      [canvas.scale, dispatch],
    );

    const panState = useRef({
      isPanning: false,
      startX: 0,
      startY: 0,
      startCX: 0,
      startCY: 0,
    });
    const spaceHeld = useRef(false);

    // Apply transform from state
    useEffect(() => {
      if (transformRef.current) {
        transformRef.current.style.transform =
          `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.scale})`;
      }
    }, [canvas]);

    // Update background grid to match zoom
    const gridSize = 24 * canvas.scale;
    const bgStyle = {
      backgroundSize: `${gridSize}px ${gridSize}px`,
      backgroundPosition: `${canvas.x % gridSize}px ${canvas.y % gridSize}px`,
    };

    // ===== PAN =====
    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        // Only pan on empty canvas or if space is held
        if (e.target !== e.currentTarget && !spaceHeld.current) return;
        panState.current = {
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY,
          startCX: canvas.x,
          startCY: canvas.y,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        (e.currentTarget as HTMLElement).classList.add('grabbing');
        // Deselect card when clicking empty canvas
        if (!spaceHeld.current) {
          dispatch({ type: 'SELECT_CARD', cardId: null });
        }
      },
      [canvas.x, canvas.y, dispatch],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!panState.current.isPanning) return;
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        const newX = panState.current.startCX + dx;
        const newY = panState.current.startCY + dy;
        // Update DOM directly for smooth pan
        if (transformRef.current) {
          transformRef.current.style.transform =
            `translate(${newX}px, ${newY}px) scale(${canvas.scale})`;
        }
        dispatch({ type: 'SET_CANVAS_VIEWPORT', payload: { x: newX, y: newY, scale: canvas.scale } });
      },
      [canvas.scale, dispatch],
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (!panState.current.isPanning) return;
        panState.current.isPanning = false;
        (e.currentTarget as HTMLElement).classList.remove('grabbing');
      },
      [],
    );

    // ===== ZOOM (wheel) =====
    useEffect(() => {
      const el = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (!el) return;

      function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const rect = el!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const oldScale = canvas.scale;
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const newScale = Math.min(3, Math.max(0.15, oldScale + delta));
        const newX = mouseX - (mouseX - canvas.x) * (newScale / oldScale);
        const newY = mouseY - (mouseY - canvas.y) * (newScale / oldScale);
        dispatch({
          type: 'SET_CANVAS_VIEWPORT',
          payload: { x: newX, y: newY, scale: newScale },
        });
      }

      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, [ref, canvas, dispatch]);

    // ===== SPACE KEY for pan mode =====
    useEffect(() => {
      function onKeyDown(e: KeyboardEvent) {
        if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          spaceHeld.current = true;
          (ref as React.RefObject<HTMLDivElement>)?.current?.classList.add('space-held');
        }
      }
      function onKeyUp(e: KeyboardEvent) {
        if (e.code === 'Space') {
          spaceHeld.current = false;
          (ref as React.RefObject<HTMLDivElement>)?.current?.classList.remove('space-held');
        }
      }
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }, [ref]);

    return (
      <div
        ref={ref}
        className="canvas-area"
        style={bgStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div ref={transformRef} className="canvas-transform">
          {cards.map((card) => (
            <CanvasCardComponent
              key={card.id}
              card={card}
              isSelected={card.id === selectedCardId}
              dispatch={dispatch}
              onGenerateCreative={onGenerateCreative}
              onGenerateVariations={onGenerateVariations}
              onGenerateBrief={onGenerateBrief}
            />
          ))}
        </div>
        <SvgOverlay cards={cards} canvas={canvas} selectedCardId={selectedCardId} />
        <Minimap
          cards={cards}
          canvas={canvas}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          onNavigate={handleMinimapNavigate}
        />
        {cards.length === 0 && <CanvasEmptyState />}
      </div>
    );
  },
);

CanvasArea.displayName = 'CanvasArea';
