export class GeminiError extends Error {
  constructor(
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export async function generateCreative(
  prompt: string,
  brandContext: { guidelines: string; positioning: string },
  previousImageDataUrl?: string,
): Promise<{ imageDataUrl: string; textResponse?: string }> {
  let response: Response;
  try {
    response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, brandContext, previousImageDataUrl }),
    });
  } catch {
    throw new GeminiError('No internet connection.', true);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new GeminiError(data.error || 'Image generation failed', data.retryable ?? true);
  }

  return { imageDataUrl: data.imageDataUrl, textResponse: data.textResponse };
}
