import { useState } from 'react';

interface PromptPreviewProps {
  prompt: string;
}

export function PromptPreview({ prompt }: PromptPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="prompt-preview">
      <button
        className="prompt-preview-toggle"
        onClick={() => setOpen(!open)}
      >
        {open ? '\u25BC' : '\u25B6'} Show prompt
      </button>
      {open && (
        <div className="prompt-preview-content">
          {prompt || 'No prompt composed yet. Answer a question to see the prompt.'}
        </div>
      )}
    </div>
  );
}
