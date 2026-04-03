import { useState } from 'react';
import type { BriefCardData } from '../../lib/canvasTypes';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: BriefCardData;
  onFieldChange?: (field: string, value: string) => void;
  onGenerateCreative?: () => void;
}

function splitDirection(direction: string): { concept: string; details: string | null } {
  const sep = direction.indexOf('---');
  if (sep === -1) return { concept: direction, details: null };
  return {
    concept: direction.slice(0, sep).trim(),
    details: direction.slice(sep + 3).trim() || null,
  };
}

export function BriefCardContent({ data, onFieldChange, onGenerateCreative }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { concept, details } = splitDirection(data.direction);

  return (
    <>
      <div className="brief-card-header">
        <span className="icon">&#9998;</span>
        <span className="label">Image Brief</span>
      </div>
      <div className="brief-card-body">
        <div className="brief-card-field">
          <div className="brief-label">Visual Concept</div>
          {onFieldChange ? (
            <InlineEditable className="brief-value" value={concept} onChange={(v) => {
              const newDirection = details ? `${v}\n---\n${details}` : v;
              onFieldChange('direction', newDirection);
            }} />
          ) : (
            <div className="brief-value">{concept}</div>
          )}
        </div>
        {details && (
          <>
            <button
              className="brief-details-toggle"
              onClick={() => setExpanded(!expanded)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {expanded ? 'Hide details \u25B2' : 'Show details \u25BC'}
            </button>
            {expanded && (
              <div className="brief-card-field brief-details">
                <div className="brief-label">Production Notes</div>
                {onFieldChange ? (
                  <InlineEditable className="brief-value" value={details} onChange={(v) => {
                    onFieldChange('direction', `${concept}\n---\n${v}`);
                  }} />
                ) : (
                  <div className="brief-value">{details}</div>
                )}
              </div>
            )}
          </>
        )}
        <div className="brief-card-field">
          <div className="brief-label">Format</div>
          <div className="brief-value">{data.format}</div>
        </div>
        <div className="brief-card-keywords">
          {data.keywords.map((k, i) => (
            <span key={i} className="brief-keyword">
              {k}
            </span>
          ))}
        </div>
      </div>
      {onGenerateCreative && (
        <button className="brief-generate-btn" onClick={onGenerateCreative} onPointerDown={(e) => e.stopPropagation()}>
          Generate Creative &#9654;
        </button>
      )}
    </>
  );
}
