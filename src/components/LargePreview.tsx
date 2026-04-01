import { useState, useEffect, useRef, useCallback } from 'react';
import type { Creative } from '../lib/types';

interface LargePreviewProps {
  creative: Creative | null;
  isGenerating: boolean;
  error: string | null;
  onRetry: () => void;
}

const LOADING_MESSAGES = [
  'Composing prompt...',
  'Generating creative...',
  'Rendering image...',
  'Almost there...',
];

export function LargePreview({
  creative,
  isGenerating,
  error,
  onRetry,
}: LargePreviewProps) {
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [fading, setFading] = useState(false);
  const prevCreativeRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle loading messages
  useEffect(() => {
    if (isGenerating) {
      setLoadingMsg(0);
      intervalRef.current = setInterval(() => {
        setLoadingMsg((i) => (i + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGenerating]);

  // Crossfade on new creative
  useEffect(() => {
    if (
      creative &&
      prevCreativeRef.current &&
      creative.imageDataUrl !== prevCreativeRef.current
    ) {
      setFading(true);
      const t = setTimeout(() => setFading(false), 50);
      return () => clearTimeout(t);
    }
    prevCreativeRef.current = creative?.imageDataUrl || null;
  }, [creative]);

  const handleDownload = useCallback(() => {
    if (!creative) return;
    const a = document.createElement('a');
    a.href = creative.imageDataUrl;
    a.download = `creative-${creative.id}.png`;
    a.click();
  }, [creative]);

  // Loading state
  if (isGenerating) {
    return (
      <div className="large-preview">
        <div className="shimmer-container">
          <div className="shimmer-bg" />
          <div className="shimmer-text">{LOADING_MESSAGES[loadingMsg]}</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="large-preview">
        <div className="error-state">
          <div className="error-message">{error}</div>
          <button className="btn-retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!creative) {
    return (
      <div className="large-preview">
        <div className="large-preview-empty">
          <div className="large-preview-empty-icon">*</div>
          <div className="large-preview-empty-text">No creative yet</div>
          <div className="large-preview-empty-sub">
            Answer the first question to generate a creative
          </div>
        </div>
      </div>
    );
  }

  // Image display
  return (
    <div className="large-preview">
      <img
        src={creative.imageDataUrl}
        alt={creative.annotation}
        className={`large-preview-img${fading ? ' fading' : ''}`}
      />
      <button
        className="download-btn"
        onClick={handleDownload}
        title="Download creative"
      >
        &#8681;
      </button>
    </div>
  );
}
