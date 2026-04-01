import type { Creative } from '../lib/types';
import { LargePreview } from './LargePreview';
import { HistoryBar } from './HistoryBar';

interface CreativeDisplayProps {
  creative: Creative | null;
  creatives: Creative[];
  selectedIndex: number;
  isGenerating: boolean;
  error: string | null;
  onSelectCreative: (index: number) => void;
  onRetry: () => void;
}

export function CreativeDisplay({
  creative,
  creatives,
  selectedIndex,
  isGenerating,
  error,
  onSelectCreative,
  onRetry,
}: CreativeDisplayProps) {
  return (
    <div className="creative-display">
      <LargePreview
        creative={creative}
        isGenerating={isGenerating}
        error={error}
        onRetry={onRetry}
      />
      <HistoryBar
        creatives={creatives}
        selectedIndex={selectedIndex}
        onSelect={onSelectCreative}
      />
    </div>
  );
}
