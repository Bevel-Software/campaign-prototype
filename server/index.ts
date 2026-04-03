import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { GoogleGenAI, type Part } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const app = express();
app.use(express.json({ limit: '25mb' }));

// ===== Health check (tells frontend which keys are configured) =====
app.get('/api/health', (_req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  });
});

// ===== OpenAI chat proxy =====
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
    return;
  }

  const { messages, model, reasoning_effort, max_completion_tokens } = req.body;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-5-mini',
      reasoning_effort: reasoning_effort || 'low',
      messages,
      response_format: { type: 'json_object' },
      max_completion_tokens: max_completion_tokens || 4000,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    res.json({ content });
  } catch (err) {
    // Retry once
    try {
      const retryMessages = [
        ...messages,
        { role: 'user', content: 'Please respond with valid JSON.' },
      ];
      const completion = await openai.chat.completions.create({
        model: model || 'gpt-5-mini',
        reasoning_effort: reasoning_effort || 'low',
        messages: retryMessages,
        response_format: { type: 'json_object' },
        max_completion_tokens: max_completion_tokens || 4000,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      res.json({ content });
    } catch (retryErr) {
      const message = retryErr instanceof Error ? retryErr.message : 'Failed to get response from OpenAI';
      res.status(502).json({ error: message });
    }
  }
});

// ===== Gemini image generation proxy =====
app.post('/api/generate-image', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    return;
  }

  const { prompt, brandContext, previousImageDataUrl } = req.body;
  const ai = new GoogleGenAI({ apiKey });

  // Build content parts — reframe as a graphic design task to avoid mockup generation
  const parts: Part[] = [];

  // Rewrite the prompt: strip "ad creative" framing, focus on the image itself
  const reframedPrompt = prompt
    .replace(/\bad(vertising)?\s*creative\b/gi, 'marketing graphic')
    .replace(/\bad\s*image\b/gi, 'marketing image')
    .replace(/\bsocial media ad\b/gi, 'social media graphic')
    .replace(/\bad platform\b/gi, 'platform');

  const contextParts = [
    'You are a graphic designer. Generate a single flat graphic image.',
    'RULES:',
    '- Output ONLY the raw image — the actual graphic itself.',
    '- NEVER render a phone, laptop, browser, app window, social media feed, device frame, or any UI around the image.',
    '- NEVER render the image as if it is being viewed inside an app or platform.',
    '- NEVER include "Sponsored" labels, Like/Comment/Share buttons, profile pictures, or any social media UI elements.',
    '- The output should be a clean, flat, standalone graphic that could be directly uploaded as-is.',
    '',
    reframedPrompt,
  ];

  // Only send visual brand guidelines (colors, fonts, logo rules) — NOT positioning/messaging docs
  // The positioning doc talks about ads/competition which causes the model to render mockups
  if (brandContext?.guidelines) {
    contextParts.push('', 'Visual brand guidelines (colors, typography, logo):', brandContext.guidelines);
  }

  const fullPrompt = contextParts.join('\n');
  parts.push({ text: fullPrompt });

  if (previousImageDataUrl) {
    const match = previousImageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      parts[0] = {
        text: `Edit the provided image based on the following instructions. ${fullPrompt}`,
      };
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: parts,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (!responseParts) {
      res.status(502).json({ error: 'No response from model. Try different options.', retryable: true });
      return;
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
      res.status(502).json({ error: 'No image generated. Try different options.', retryable: true });
      return;
    }

    res.json({ imageDataUrl, textResponse });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let retryable = true;
    if (message.includes('403') || message.includes('API_KEY')) {
      retryable = false;
    }
    res.status(502).json({ error: message, retryable });
  }
});

// ===== Session persistence =====
function makeSessionHandler(filePath: string) {
  return (req: express.Request, res: express.Response) => {
    if (req.method === 'GET') {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
      } else {
        res.json({});
      }
      return;
    }

    if (req.method === 'POST') {
      if (!req.body) {
        res.status(400).json({ error: 'Empty body' });
        return;
      }
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(req.body), 'utf-8');
      res.json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  };
}

const sessionHandler = makeSessionHandler(path.join(DATA_DIR, 'session.json'));
const canvasSessionHandler = makeSessionHandler(path.join(DATA_DIR, 'canvas-session.json'));

app.get('/api/session', sessionHandler);
app.post('/api/session', sessionHandler);
app.get('/api/canvas-session', canvasSessionHandler);
app.post('/api/canvas-session', canvasSessionHandler);

// ===== Static files (production) =====
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
