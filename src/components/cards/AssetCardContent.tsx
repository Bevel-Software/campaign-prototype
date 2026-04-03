import type { AssetCardData } from '../../lib/canvasTypes';

interface Props {
  data: AssetCardData;
  onFieldChange?: (field: string, value: string | boolean) => void;
}

export function AssetCardContent({ data, onFieldChange }: Props) {
  const isInspiration = !!data.reason;

  if (isInspiration) {
    return (
      <>
        <div className="asset-card-header">
          <span className="icon">&#128161;</span>
          <span className="label">Ad Inspiration</span>
          <span className="source-badge">{data.source}</span>
        </div>
        <div className="asset-inspiration-body">
          <p className="asset-inspiration-intro">This historical ad was selected as the most relevant inspiration for this segment.</p>
          <div className="asset-inspiration-reason">
            <span className="asset-inspiration-reason-label">Why this ad?</span>
            <p className="asset-inspiration-reason-text">{data.reason}</p>
          </div>
          {data.caption && (
            <div className="asset-inspiration-caption">
              <span className="asset-inspiration-reason-label">Ad copy</span>
              <p className="asset-inspiration-caption-text">{data.caption}</p>
            </div>
          )}
        </div>
        {onFieldChange && data.useForBrief === undefined && (
          <div className="asset-inspiration-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button className="inspiration-btn inspiration-btn-use" onClick={() => onFieldChange('useForBrief', true)}>
              Use for brief
            </button>
            <button className="inspiration-btn inspiration-btn-skip" onClick={() => onFieldChange('useForBrief', false)}>
              Don't use
            </button>
          </div>
        )}
        {data.useForBrief === true && (
          <div className="asset-inspiration-status used" onPointerDown={(e) => e.stopPropagation()}>
            <span>&#10003; Using for brief</span>
            {onFieldChange && <button className="inspiration-undo" onClick={() => onFieldChange('useForBrief', false)}>Undo</button>}
          </div>
        )}
        {data.useForBrief === false && (
          <div className="asset-inspiration-status skipped" onPointerDown={(e) => e.stopPropagation()}>
            <span>Skipped</span>
            {onFieldChange && <button className="inspiration-undo" onClick={() => onFieldChange('useForBrief', true)}>Undo</button>}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="asset-card-header">
        <span className="icon">&#128444;</span>
        <span className="label">Reference Asset</span>
        <span className="source-badge">{data.source}</span>
      </div>
      {data.image ? (
        <img className="asset-card-image" src={data.image} alt="Reference" draggable={false} />
      ) : (
        <div className="asset-card-image asset-card-placeholder">No image</div>
      )}
      <div className="asset-card-footer">{data.caption}</div>
    </>
  );
}
