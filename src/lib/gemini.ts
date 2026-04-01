import { GoogleGenAI, type Part } from '@google/genai';

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';

export class GeminiError extends Error {
  constructor(
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** Parse a data URL into { mimeType, base64 } */
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');
  return { mimeType: match[1], data: match[2] };
}

export async function generateCreative(
  apiKey: string,
  prompt: string,
  brandContext: { guidelines: string; positioning: string },
  previousImageDataUrl?: string,
): Promise<{ imageDataUrl: string; textResponse?: string }> {
  const ai = new GoogleGenAI({ apiKey });

  // Build content parts: text prompt (with brand context) + optional previous image
  const parts: Part[] = [];

  // Always include brand guidelines + positioning as context
  const contextParts = [prompt];
  if (brandContext.guidelines) {
    contextParts.push('', 'Brand guidelines to follow:', brandContext.guidelines);
  }
  if (brandContext.positioning) {
    contextParts.push('', 'Product positioning & messaging:', brandContext.positioning);
  }
  const fullPrompt = contextParts.join('\n');

  parts.push({ text: fullPrompt });

  // If we have a previous image, send it for iterative refinement
  if (previousImageDataUrl) {
    const { mimeType, data } = parseDataUrl(previousImageDataUrl);
    parts.push({
      inlineData: { mimeType, data },
    });
    // Prepend editing instruction so the model knows to refine
    parts[0] = {
      text: `Edit the provided image based on the following instructions. ${fullPrompt}`,
    };
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: parts,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('403') || message.includes('API_KEY')) {
      throw new GeminiError(
        'Invalid API key. Check your VITE_GEMINI_API_KEY in .env.',
      );
    }
    if (message.includes('429') || message.includes('RATE')) {
      throw new GeminiError('Rate limited. Please wait a moment.', true);
    }
    if (message.includes('fetch') || message.includes('network') || message.includes('Failed')) {
      throw new GeminiError('No internet connection.', true);
    }
    throw new GeminiError(message || 'Unexpected error. Try again.', true);
  }

  const responseParts = response.candidates?.[0]?.content?.parts;
  if (!responseParts) {
    throw new GeminiError('No response from model. Try different options.', true);
  }

  let imageDataUrl: string | null = null;
  let textResponse: string | undefined;

  for (const part of responseParts) {
    if (part.text) {
      textResponse = part.text;
    } else if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      imageDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }

  if (!imageDataUrl) {
    throw new GeminiError(
      'No image generated. Try different options.',
      true,
    );
  }

  return { imageDataUrl, textResponse };
}
