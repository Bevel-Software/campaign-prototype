interface ToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onCleanUp: () => void;
  onClearCanvas: () => void;
}

export function Toolbar({ scale, onZoomIn, onZoomOut, onFitAll, onCleanUp, onClearCanvas }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-logo">
          Campaign <span>Canvas</span>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-badge">AI-Powered</div>
      </div>
      <div className="toolbar-center">
        <button className="tb-btn" onClick={onZoomOut} title="Zoom out (-)">-</button>
        <span className="zoom-display">{Math.round(scale * 100)}%</span>
        <button className="tb-btn" onClick={onZoomIn} title="Zoom in (+)">+</button>
        <button className="tb-btn" onClick={onFitAll} title="Fit all (Cmd+0)">Fit</button>
      </div>
      <div className="toolbar-right">
        <button className="tb-btn" onClick={onCleanUp} title="Auto-arrange all cards">
          Clean Up
        </button>
        <button className="tb-btn danger" onClick={onClearCanvas} title="Clear all cards and chat history">
          Clear
        </button>
        <button className="tb-btn primary" onClick={onFitAll}>
          Fit All
        </button>
      </div>
    </div>
  );
}
