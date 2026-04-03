import type { SegmentCardData } from '../../lib/canvasTypes';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: SegmentCardData;
  onFieldChange?: (field: string, value: string) => void;
}

export function SegmentCardContent({ data, onFieldChange }: Props) {
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
      </div>
      <div className="segment-card-body">
        <div className="segment-card-detail">
          <span className="detail-label">Channel</span>
          <span>{data.channel}</span>
        </div>
        <div className="segment-card-detail">
          <span className="detail-label">Targeting</span>
          <span>{data.targeting}</span>
        </div>
      </div>
      {onFieldChange ? (
        <InlineEditable className="segment-card-tagline" value={data.tagline} onChange={(v) => onFieldChange('tagline', v)} />
      ) : (
        <div className="segment-card-tagline">{data.tagline}</div>
      )}
    </>
  );
}
