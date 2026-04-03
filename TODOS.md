# TODOs

## Blob URL image cache

**What:** Move base64-encoded images out of React state into a `Map<cardId, string>` (blob URLs) or IndexedDB store.

**Why:** `CreativeCardData.imageDataUrl` stores 200KB-1MB base64 strings directly in `AppState.cards[].data`. Every `dispatch()` copies these through the reducer spread. With 5+ creatives, this causes noticeable lag on card drags and viewport pans.

**Where to start:**
- Create `src-canvas/lib/imageStore.ts` with `set(cardId, dataUrl)` → converts to blob URL, `get(cardId)` → returns blob URL
- Update `src-canvas/CanvasApp.tsx` `triggerImageGeneration` to store image in the external cache instead of card data
- Update `CreativeCardContent.tsx` and card rendering to read from the cache (via context or hook)
- `canvasTypes.ts` `CreativeCardData.imageDataUrl` becomes a boolean flag (`hasImage`) or is removed

**Depends on:** Nothing — can be done independently.

## Unit tests for chatAgent processAction

**What:** Add vitest + unit tests for `processAction()` in `src-canvas/lib/chatAgent.ts`.

**Why:** `processAction` is a pure function that converts LLM JSON into Redux-style Actions + generationRequests. It's the most testable code in the app and where the brief→creative flow bug lived. Tests catch regressions when the SYSTEM_PROMPT or action handling changes.

**Where to start:**
- `npm install -D vitest` and add a `test` script to `package.json`
- Create `src-canvas/lib/chatAgent.test.ts`
- Test each action type: `spawn_settings`, `spawn_segments`, `spawn_briefs`, `generate_creatives`, `spawn_variation/s`, `update_card`
- Mock `AppState` with existing cards to test ID-based lookups (e.g., generate_creatives finding BriefCards by briefId)
- Test Zod validation: malformed actions are skipped, well-formed actions pass through

**Depends on:** Nothing — can be done independently.

## Center-anchored keyboard/toolbar zoom

**What:** Keyboard zoom (`+`/`-`) and toolbar zoom buttons should anchor to viewport center instead of world origin.

**Why:** Currently pressing `+`/`-` or clicking zoom buttons changes scale without adjusting `x`/`y`, causing a visual jump. Users expect zoom to feel anchored to the center of what they're looking at.

**Where to start:**
- `src-canvas/CanvasApp.tsx` lines 239-251 (keyboard handlers)
- `src-canvas/CanvasApp.tsx` lines 307-318 (toolbar `onZoomIn`/`onZoomOut`)
- Reuse the same math as the wheel zoom in `src-canvas/components/canvas/CanvasArea.tsx` lines 120-133, substituting `mouseX`/`mouseY` with `containerWidth/2` and `containerHeight/2`.

## Brief skill extraction

**What:** Extract brief generation into a dedicated skill module (same pattern as `src/lib/skills/segmentSkill.ts`).

**Why:** Brief generation currently relies on the generic chat agent prompt, which gives minimal guidance on format-specific direction, channel-aware copy, and keyword relevance. A dedicated skill would allow specialized prompting for higher-quality briefs, stricter Zod validation, and brand context injection — the same improvements segment generation got.

**Where to start:**
- Create `src/lib/skills/briefSkill.ts` following `segmentSkill.ts` pattern
- Extract `buildBriefCards()` from `processAction` `spawn_briefs` case in `chatAgent.ts`
- Add `generateBriefs(segmentData, settings, brandContext)` with specialized prompt
- Wire into `processMessage()` (same intercept pattern) and context menu
- Add unit tests matching `segmentSkill.test.ts` structure

**Depends on:** Nothing — can be done independently.

## Server-side LLM calls

**What:** Move LLM calls (chatAgent + skills) to a server-side API route.

**Why:** Currently using `dangerouslyAllowBrowser: true` — API keys are exposed in the browser. Acceptable for prototype but blocks any production deployment. Every LLM call (chat agent, segment skill, future skills) should go through a server-side endpoint.

**Where to start:**
- Add API routes in `vite.config.ts` middleware (or migrate to a proper backend)
- Move `processMessage()` and `generateSegments()` OpenAI calls behind `/api/chat` and `/api/segments` endpoints
- Client sends settings/brand context, server makes LLM call and returns result
- Remove `dangerouslyAllowBrowser: true` from all OpenAI client instantiations

**Depends on:** Nothing — can be done independently.
