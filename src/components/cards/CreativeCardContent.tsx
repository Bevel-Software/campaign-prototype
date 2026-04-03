import { useState, useEffect, useRef } from 'react';
import type { CreativeCardData } from '../../lib/canvasTypes';

const META_AD_FORMATS = [
  { id: 'square', label: 'Square (1:1)', dimensions: '1080 × 1080' },
  { id: 'portrait', label: 'Portrait (4:5)', dimensions: '1080 × 1350' },
  { id: 'landscape', label: 'Landscape (1.91:1)', dimensions: '1200 × 628' },
  { id: 'fullscreen', label: 'Full Screen (9:16)', dimensions: '1080 × 1920' },
];

interface Props {
  data: CreativeCardData;
  label: string;
  onFieldChange?: (field: string, value: string) => void;
  onGenerateVariations?: (format?: string) => void;
}

export function CreativeCardContent({ data, label, onGenerateVariations }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [dropdownOpen]);

  const handleDownload = () => {
    if (!data.imageDataUrl) return;
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const ts = new Date().toISOString().slice(0, 16).replace(':', '');
    const filename = `${slug}-${ts}.png`;
    const a = document.createElement('a');
    a.href = data.imageDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
        <div ref={wrapperRef} className="variation-dropdown-wrapper" onPointerDown={(e) => e.stopPropagation()}>
          <div className="creative-actions-row">
            <div className="split-btn">
              <button
                className="split-btn-main"
                onClick={() => onGenerateVariations()}
              >
                Generate Variations
              </button>
              <button
                className="split-btn-toggle"
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                {dropdownOpen ? '\u25B2' : '\u25BC'}
              </button>
            </div>
            <button
              className="download-btn"
              onClick={handleDownload}
              title="Download PNG"
            >
              {'\u21E9'}
            </button>
          </div>
          {dropdownOpen && (
            <div className="variation-dropdown">
              {META_AD_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  className="variation-dropdown-item"
                  onClick={() => {
                    onGenerateVariations(`Static image ${fmt.dimensions}`);
                    setDropdownOpen(false);
                  }}
                >
                  <span>{fmt.label}</span>
                  <span className="format-dims">{fmt.dimensions}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
