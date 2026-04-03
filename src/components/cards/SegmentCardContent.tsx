import type { SegmentCardData } from '../../lib/canvasTypes';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: SegmentCardData;
  onFieldChange?: (field: string, value: string | boolean) => void;
  onGenerateBrief?: () => void;
}

export function SegmentCardContent({ data, onFieldChange, onGenerateBrief }: Props) {
  return (
    <>
      <div className={`segment-card-accent ${data.group}`} />
      <div className="segment-card-top">
        <div className={`segment-card-icon ${data.group}`}>
          {data.channel === 'Meta' ? 'M' : 'in'}
        </div>
        {onFieldChange ? (
          <InlineEditable className="segment-card-name" value={data.name} onChange={(v) => onFieldChange('name', v)} />
        ) : (
          <div className="segment-card-name">{data.name}</div>
        )}
        {onFieldChange && (
          <label
            className={`segment-checkbox${data.isSelected ? ' checked' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={!!data.isSelected}
              onChange={() => onFieldChange('isSelected', !data.isSelected)}
            />
          </label>
        )}
      </div>
      <div className="segment-card-body">
        <div className="segment-card-detail">
          <span className="detail-label">Channel</span>
          <span>{data.channel}{data.funnelStage ? ` · ${data.funnelStage}` : ''}</span>
        </div>
        <div className="segment-card-detail targeting-structured">
          <span className="detail-label">Targeting</span>
          <div className="targeting-lines">
            {data.targeting.split('\n').map((line, i) => {
              const colonIdx = line.indexOf(':');
              if (colonIdx > 0 && colonIdx < 15) {
                return (
                  <div key={i} className="targeting-line">
                    <span className="targeting-line-label">{line.slice(0, colonIdx)}</span>
                    <span>{line.slice(colonIdx + 1).trim()}</span>
                  </div>
                );
              }
              return <div key={i}>{line}</div>;
            })}
          </div>
        </div>
      </div>
      {onFieldChange ? (
        <InlineEditable className="segment-card-tagline" value={data.tagline} onChange={(v) => onFieldChange('tagline', v)} />
      ) : (
        <div className="segment-card-tagline">{data.tagline}</div>
      )}
      {onGenerateBrief && (
        <button className="brief-generate-btn" onClick={onGenerateBrief} onPointerDown={(e) => e.stopPropagation()}>
          Generate Image Brief &#9654;
        </button>
      )}
    </>
  );
}
