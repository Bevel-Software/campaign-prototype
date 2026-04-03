import type { CreativeCardData } from '../../lib/canvasTypes';

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

  return (
    <>
      <div className="card-top-bar">
        <span className="label">{label}</span>
      </div>
      <div className="creative-image-only">
        {renderImage()}
      </div>
      {onGenerateVariations && data.imageDataUrl && !data.isGenerating && (
        <button className="brief-generate-btn" onClick={onGenerateVariations} onPointerDown={(e) => e.stopPropagation()}>
          Generate Variations &#9654;
        </button>
      )}
    </>
  );
}
