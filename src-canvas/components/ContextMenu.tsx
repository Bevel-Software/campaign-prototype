import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface MenuItem {
  icon: string;
  label: string;
  action: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Flip if near edge
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="context-menu-item"
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          <span className="icon" dangerouslySetInnerHTML={{ __html: item.icon }} />
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
