interface CustomEditsProps {
  text: string;
  isGenerating: boolean;
  hasApiKey: boolean;
  hasCreatives: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
}

export function CustomEdits({
  text,
  isGenerating,
  hasApiKey,
  hasCreatives,
  onChange,
  onSubmit,
}: CustomEditsProps) {
  return (
    <div className="custom-edits">
      <div className="custom-edits-label">Custom edits</div>
      <textarea
        className="custom-edits-textarea"
        placeholder="e.g., make the background darker, add more people..."
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={!hasApiKey || isGenerating}
      />
      <button
        className="btn-regenerate"
        onClick={onSubmit}
        disabled={!text.trim() || isGenerating || !hasApiKey || !hasCreatives}
      >
        {isGenerating ? 'Generating...' : 'Regenerate'}
      </button>
    </div>
  );
}
