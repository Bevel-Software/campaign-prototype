import type { BriefCardData } from '../../lib/canvasTypes';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: BriefCardData;
  onFieldChange?: (field: string, value: string) => void;
  onGenerateCreative?: () => void;
}

export function BriefCardContent({ data, onFieldChange, onGenerateCreative }: Props) {
  return (
    <>
      <div className="brief-card-header">
        <span className="icon">&#9998;</span>
        <span className="label">Image Brief</span>
      </div>
      <div className="brief-card-body">
        <div className="brief-card-field">
          <div className="brief-label">Direction</div>
          {onFieldChange ? (
            <InlineEditable className="brief-value" value={data.direction} onChange={(v) => onFieldChange('direction', v)} />
          ) : (
            <div className="brief-value">{data.direction}</div>
          )}
        </div>
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
        <button className="brief-generate-btn" onClick={onGenerateCreative}>
          Generate Creative &#9654;
        </button>
      )}
    </>
  );
}
