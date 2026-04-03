import { useRef, useCallback } from 'react';

interface InlineEditableProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  tag?: 'div' | 'span';
}

export function InlineEditable({
  value,
  onChange,
  className = '',
  tag: Tag = 'div',
}: InlineEditableProps) {
  const elRef = useRef<HTMLElement>(null);
  const originalRef = useRef(value);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const el = elRef.current;
      if (!el) return;

      originalRef.current = el.textContent || '';
      el.contentEditable = 'true';
      el.classList.add('editing');
      el.focus();

      // Select all text
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
    [],
  );

  const finishEditing = useCallback(
    (save: boolean) => {
      const el = elRef.current;
      if (!el || el.contentEditable !== 'true') return;

      el.contentEditable = 'false';
      el.classList.remove('editing');

      if (save) {
        const newValue = (el.textContent || '').trim();
        if (newValue !== originalRef.current) {
          onChange(newValue);
        }
      } else {
        // Revert
        el.textContent = originalRef.current;
      }
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation(); // Prevent canvas shortcuts
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing(true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing(false);
      }
    },
    [finishEditing],
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow for intentional clicks elsewhere
    setTimeout(() => finishEditing(true), 100);
  }, [finishEditing]);

  // Prevent pointer events from starting card drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Tag
      ref={elRef as any}
      className={`inline-editable ${className}`}
      onDoubleClick={startEditing}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onPointerDown={handlePointerDown}
      suppressContentEditableWarning
    >
      {value}
    </Tag>
  );
}
