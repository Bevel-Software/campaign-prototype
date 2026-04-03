import type { CreativeCardData } from '../../lib/canvasTypes';
import { InlineEditable } from './InlineEditable';

interface Props {
  data: CreativeCardData;
  label: string;
  onFieldChange?: (field: string, value: string) => void;
  onGenerateVariations?: () => void;
}

export function CreativeCardContent({ data, label, onFieldChange, onGenerateVariations }: Props) {
  const renderImage = () => {
    if (data.isGenerating) {
      return <div className="creative-loading" />;
    }
    if (data.error) {
      return (
        <div className="creative-error">
          <span>{data.error}</span>
          <button>Retry</button>
        </div>
      );
    }
    if (data.imageDataUrl) {
      return <img src={data.imageDataUrl} alt="Creative" draggable={false} />;
    }
    return <div className="creative-loading" />;
  };

  if (data.type === 'meta') {
    return (
      <>
        <div className="card-top-bar">
          <span className="label">{label}</span>
        </div>
        <div className="meta-ad">
          {renderImage()}
          <div className="meta-ad-content">
            <div className="meta-ad-brand">{data.brand}</div>
            {onFieldChange ? (
              <InlineEditable className="meta-ad-text" value={data.body} onChange={(v) => onFieldChange('body', v)} />
            ) : (
              <div className="meta-ad-text">{data.body}</div>
            )}
          </div>
          <div className="meta-ad-bottom">
            {onFieldChange ? (
              <InlineEditable className="headline" tag="span" value={data.headline} onChange={(v) => onFieldChange('headline', v)} />
            ) : (
              <span className="headline">{data.headline}</span>
            )}
            <span className="meta-ad-cta">{data.cta}</span>
          </div>
        </div>
        {data.tags.length > 0 && (
          <div className="card-footer">
            {data.tags.map((t, i) => (
              <span key={i} className="card-tag">
                {t}
              </span>
            ))}
          </div>
        )}
        {onGenerateVariations && data.imageDataUrl && !data.isGenerating && (
          <button className="brief-generate-btn" onClick={onGenerateVariations} onPointerDown={(e) => e.stopPropagation()}>
            Generate Variations &#9654;
          </button>
        )}
      </>
    );
  }

  // LinkedIn ad
  return (
    <>
      <div className="card-top-bar">
        <span className="label">{label}</span>
      </div>
      <div className="linkedin-ad">
        <div className="linkedin-ad-header">
          <div className="company-logo">EGYM</div>
          <div className="company-info">
            <div className="name">EGYM Wellpass</div>
            <div className="meta">Sponsored</div>
          </div>
        </div>
        {onFieldChange ? (
          <InlineEditable className="linkedin-ad-body" value={data.body} onChange={(v) => onFieldChange('body', v)} />
        ) : (
          <div className="linkedin-ad-body">{data.body}</div>
        )}
        <div className={`linkedin-ad-image ${data.imageDataUrl ? '' : 'placeholder'}`}>
          {data.isGenerating ? (
            <div className="creative-loading" style={{ height: '100%', borderRadius: 'var(--radius-sm)' }} />
          ) : data.imageDataUrl ? (
            <img src={data.imageDataUrl} alt="Creative" draggable={false} />
          ) : data.error ? (
            <span>{data.error}</span>
          ) : (
            <span>Generating...</span>
          )}
        </div>
        {onFieldChange ? (
          <InlineEditable className="linkedin-ad-headline" value={data.headline} onChange={(v) => onFieldChange('headline', v)} />
        ) : (
          <div className="linkedin-ad-headline">{data.headline}</div>
        )}
        <span className="linkedin-ad-cta">{data.cta}</span>
      </div>
      {data.tags.length > 0 && (
        <div className="card-footer">
          {data.tags.map((t, i) => (
            <span key={i} className="card-tag">
              {t}
            </span>
          ))}
        </div>
      )}
      {onGenerateVariations && data.imageDataUrl && !data.isGenerating && (
        <button className="brief-generate-btn" onClick={onGenerateVariations} onPointerDown={(e) => e.stopPropagation()}>
          Generate Variations &#9654;
        </button>
      )}
    </>
  );
}
