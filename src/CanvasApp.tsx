import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { canvasReducer, initialState } from './lib/canvasReducer';
import type { AppState, ChatMessage } from './lib/canvasTypes';
import { generateCreative, GeminiError } from './lib/gemini';
import { processMessage } from './lib/chatAgent';
import { buildCreativeFromBrief } from './lib/creativeFromBrief';
import type { BriefCard, SegmentCard } from './lib/canvasTypes';
import { computeFitAllViewport } from './lib/layoutUtils';
import { Toolbar } from './components/Toolbar';
import { CanvasArea } from './components/canvas/CanvasArea';
import { ChatPanel } from './components/chat/ChatPanel';
import { ContextMenu } from './components/ContextMenu';

export default function CanvasApp() {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Stable refs to avoid stale closures in executeAgentTurn and handleSendMessage
  const stateRef = useRef(state);
  stateRef.current = state;

  // Check which API keys are configured on the server
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { openai: boolean; gemini: boolean }) => {
        dispatch({ type: 'SET_API_KEYS', payload: data });
      })
      .catch(() => {});
  }, []);

  // Load brand context files
  useEffect(() => {
    fetch('/questions.json')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => dispatch({ type: 'SET_BASE_PROMPT', payload: data.basePrompt || '' }))
      .catch(() => {});

    fetch('/brand_guidelines.md')
      .then((r) => r.ok ? r.text() : Promise.reject())
      .then((text) => dispatch({ type: 'SET_BRAND_GUIDELINES', payload: text }))
      .catch(() => console.warn('brand_guidelines.md not found'));

    fetch('/positioning.md')
      .then((r) => r.ok ? r.text() : Promise.reject())
      .then((text) => dispatch({ type: 'SET_BRAND_POSITIONING', payload: text }))
      .catch(() => console.warn('positioning.md not found'));
  }, []);

  // ===== SESSION PERSISTENCE =====
  const sessionLoaded = useRef(false);
  useEffect(() => {
    if (sessionLoaded.current) return;
    sessionLoaded.current = true;
    fetch('/api/canvas-session')
      .then((r) => {
        if (!r.ok) throw new Error('No session');
        return r.json();
      })
      .then((data) => {
        if (data.cards?.length > 0) {
          for (const card of data.cards) {
            dispatch({ type: 'ADD_CARD', card });
          }
        }
        if (data.messages?.length > 0) {
          for (const msg of data.messages) {
            dispatch({ type: 'ADD_MESSAGE', message: msg });
          }
        }
        if (data.canvas) {
          dispatch({ type: 'SET_CANVAS_VIEWPORT', payload: data.canvas });
        }
      })
      .catch(() => {});
  }, []);

  // Auto-save session (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (state.cards.length === 0 && state.messages.length === 0) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const session = {
        cards: state.cards,
        messages: state.messages,
        canvas: state.canvas,
      };
      fetch('/api/canvas-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      }).catch(() => {});
    }, 1000);
  }, [state.cards, state.messages, state.canvas]);

  // Flush session on tab close so the last second of work isn't lost
  useEffect(() => {
    function handleBeforeUnload() {
      const s = stateRef.current;
      if (s.cards.length === 0 && s.messages.length === 0) return;
      const body = JSON.stringify({ cards: s.cards, messages: s.messages, canvas: s.canvas });
      navigator.sendBeacon('/api/canvas-session', body);
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ===== CHAT AGENT =====
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const s = stateRef.current;

      // Add user message
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        text: text.trim(),
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', message: userMsg });

      // If agent is already thinking, queue the message
      if (s.isAgentThinking) {
        dispatch({ type: 'QUEUE_MESSAGE', text: text.trim() });
        return;
      }

      await executeAgentTurn(text.trim(), s);
    },
    [],
  );

  const executeAgentTurn = useCallback(
    async (text: string, currentState: AppState) => {
      if (!currentState.apiKeys.openai) {
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'agent',
          text: 'OpenAI API key not configured. Set OPENAI_API_KEY on the server.',
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: errMsg });
        return;
      }

      dispatch({ type: 'SET_AGENT_THINKING', value: true });

      try {
        const result = await processMessage(
          text,
          currentState,
        );

        // Add tool messages if any
        for (const toolMsg of result.toolMessages) {
          dispatch({ type: 'ADD_MESSAGE', message: toolMsg });
        }

        // Add agent reply
        if (result.reply) {
          const agentMsg: ChatMessage = {
            id: `msg-${Date.now()}-reply`,
            role: 'agent',
            text: result.reply,
            timestamp: Date.now(),
          };
          dispatch({ type: 'ADD_MESSAGE', message: agentMsg });
        }

        // Execute canvas actions (spawn cards, etc.)
        for (const action of result.actions) {
          dispatch(action);
        }

        // Trigger image generation for creative cards (staggered by 300ms)
        for (let i = 0; i < result.generationRequests.length; i++) {
          const genReq = result.generationRequests[i];
          setTimeout(
            () => triggerRef.current(genReq.cardId, genReq.prompt, genReq.previousImageDataUrl),
            i * 300,
          );
        }

        // Auto fit-all after spawning cards
        if (result.actions.some((a) => a.type === 'ADD_CARD' || a.type === 'ADD_CARDS')) {
          setTimeout(() => fitAllRef.current(), 600);
        }
      } catch (err) {
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'agent',
          text: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Try again.`,
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: errMsg });
      } finally {
        dispatch({ type: 'SET_AGENT_THINKING', value: false });
      }
    },
    [],
  );

  // Process queued messages after agent finishes
  useEffect(() => {
    if (!state.isAgentThinking && state.messageQueue.length > 0) {
      const nextMessage = state.messageQueue[0];
      dispatch({ type: 'DEQUEUE_MESSAGE' });
      executeAgentTurn(nextMessage, stateRef.current);
    }
  }, [state.isAgentThinking, state.messageQueue, executeAgentTurn]);

  // ===== IMAGE GENERATION =====
  const triggerImageGeneration = useCallback(
    async (cardId: string, prompt: string, previousImageDataUrl?: string) => {
      if (!state.apiKeys.gemini) {
        dispatch({
          type: 'UPDATE_CARD_DATA',
          cardId,
          data: { isGenerating: false, error: 'Gemini API key not configured. Set GEMINI_API_KEY on the server.' },
        });
        return;
      }

      dispatch({ type: 'START_GENERATING', cardId });

      try {
        const result = await generateCreative(
          prompt,
          { guidelines: state.brandGuidelines, positioning: state.brandPositioning },
          previousImageDataUrl,
        );

        dispatch({
          type: 'UPDATE_CARD_DATA',
          cardId,
          data: { imageDataUrl: result.imageDataUrl, isGenerating: false, error: null },
        });
      } catch (err) {
        const errorMsg = err instanceof GeminiError ? err.message : 'Image generation failed';
        dispatch({
          type: 'UPDATE_CARD_DATA',
          cardId,
          data: { isGenerating: false, error: errorMsg },
        });
      } finally {
        dispatch({ type: 'FINISH_GENERATING', cardId });
      }
    },
    [state.apiKeys.gemini, state.brandGuidelines, state.brandPositioning], // gemini bool used for early return check
  );

  // ===== GENERATE CREATIVE FROM BRIEF =====
  const handleGenerateCreative = useCallback(
    (briefCardId: string) => {
      const briefCard = state.cards.find(
        (c): c is BriefCard => c.id === briefCardId && c.cardType === 'brief',
      );
      if (!briefCard) return;

      const { card, prompt } = buildCreativeFromBrief(
        briefCard,
        state.cards,
        state.basePrompt,
      );

      dispatch({ type: 'ADD_CARD', card });
      triggerImageGeneration(card.id, prompt);
    },
    [state.cards, state.basePrompt, triggerImageGeneration],
  );

  // ===== FIT ALL =====
  const fitAll = useCallback(() => {
    const container = canvasAreaRef.current;
    if (!container || state.cards.length === 0) return;
    const rect = container.getBoundingClientRect();
    const viewport = computeFitAllViewport(state.cards, rect.width, rect.height);
    dispatch({ type: 'SET_CANVAS_VIEWPORT', payload: viewport });
  }, [state.cards]);

  // Stable refs for callbacks used inside executeAgentTurn's setTimeout
  const triggerRef = useRef(triggerImageGeneration);
  triggerRef.current = triggerImageGeneration;
  const fitAllRef = useRef(fitAll);
  fitAllRef.current = fitAll;

  // ===== KEYBOARD SHORTCUTS =====
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Cmd+0 or Ctrl+0: fit all
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        fitAll();
      }
      // +/= : zoom in
      if (e.key === '+' || e.key === '=') {
        dispatch({
          type: 'SET_CANVAS_VIEWPORT',
          payload: { ...state.canvas, scale: Math.min(3, state.canvas.scale + 0.15) },
        });
      }
      // - : zoom out
      if (e.key === '-') {
        dispatch({
          type: 'SET_CANVAS_VIEWPORT',
          payload: { ...state.canvas, scale: Math.max(0.15, state.canvas.scale - 0.15) },
        });
      }
      // Escape: deselect card + close context menu
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_CARD', cardId: null });
        setContextMenu(null);
      }
      // Delete/Backspace: remove selected card (disabled for now - could be dangerous)
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitAll, state.canvas]);

  // ===== CONTEXT MENU =====
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: { icon: string; label: string; action: () => void }[] } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const items: { icon: string; label: string; action: () => void }[] = [];

      const hasSettings = state.cards.some((c) => c.cardType === 'settings');
      const segmentCards = state.cards.filter(
        (c): c is SegmentCard => c.cardType === 'segment',
      );
      const hasSegments = segmentCards.length > 0;
      const hasBriefs = state.cards.some((c) => c.cardType === 'brief');
      const hasCreatives = state.cards.some((c) => c.cardType === 'creative');

      // Determine which segments are targeted for generation
      const checkedSegments = segmentCards.filter((c) => c.data.isSelected);
      const selectedSegment = segmentCards.find((c) => c.id === state.selectedCardId);

      if (hasSettings && !hasSegments) {
        items.push({ icon: '&#9783;', label: 'Generate Segments', action: () => handleSendMessage('Generate audience segments for this campaign') });
      }
      if (hasSegments && !hasBriefs) {
        let briefMsg: string;
        if (checkedSegments.length > 0) {
          const ids = checkedSegments.map((s) => `${s.id} ("${s.data.name}")`).join(', ');
          briefMsg = `Generate creative briefs for these segments: ${ids}`;
        } else if (selectedSegment) {
          briefMsg = `Generate a creative brief for segment ${selectedSegment.id} ("${selectedSegment.data.name}")`;
        } else {
          briefMsg = 'Generate creative briefs for each segment';
        }
        const briefLabel = checkedSegments.length > 0
          ? `Generate Briefs (${checkedSegments.length} selected)`
          : selectedSegment
            ? `Generate Brief (${selectedSegment.data.name})`
            : 'Generate Briefs';
        items.push({ icon: '&#9998;', label: briefLabel, action: () => handleSendMessage(briefMsg) });
      }
      if (hasBriefs && !hasCreatives) {
        // Filter briefs to those whose parent segment is selected/checked
        let creativeMsg: string;
        if (checkedSegments.length > 0) {
          const segIds = new Set(checkedSegments.map((s) => s.id));
          const targetBriefs = state.cards.filter(
            (c) => c.cardType === 'brief' && segIds.has(c.data.segmentId),
          );
          if (targetBriefs.length > 0) {
            const ids = targetBriefs.map((b) => b.id).join(', ');
            creativeMsg = `Generate creatives for these briefs: ${ids}`;
          } else {
            creativeMsg = 'Generate creatives for each brief';
          }
        } else {
          creativeMsg = 'Generate creatives for each brief';
        }
        items.push({ icon: '&#127912;', label: 'Generate Creatives', action: () => handleSendMessage(creativeMsg) });
      }

      // Select / Deselect All Segments
      if (hasSegments) {
        const allSelected = segmentCards.every((c) => c.data.isSelected);
        if (allSelected) {
          items.push({
            icon: '&#9744;',
            label: 'Deselect All Segments',
            action: () => {
              for (const seg of segmentCards) {
                dispatch({ type: 'UPDATE_CARD_DATA', cardId: seg.id, data: { isSelected: false } });
              }
            },
          });
        } else {
          items.push({
            icon: '&#9745;',
            label: 'Select All Segments',
            action: () => {
              for (const seg of segmentCards) {
                dispatch({ type: 'UPDATE_CARD_DATA', cardId: seg.id, data: { isSelected: true } });
              }
            },
          });
        }
      }

      if (state.cards.length > 0) {
        items.push({ icon: '&#128269;', label: 'Fit All', action: fitAll });
      }

      if (items.length > 0) {
        setContextMenu({ x: e.clientX, y: e.clientY, items });
      }
    },
    [state.cards, handleSendMessage, fitAll],
  );

  // Missing API key banners
  const missingKeys: string[] = [];
  if (!state.apiKeys.openai) missingKeys.push('OPENAI_API_KEY');
  if (!state.apiKeys.gemini) missingKeys.push('GEMINI_API_KEY');

  const selectedCard = state.cards.find((c) => c.id === state.selectedCardId) || null;

  return (
    <>
      <Toolbar
        scale={state.canvas.scale}
        onZoomIn={() => {
          dispatch({
            type: 'SET_CANVAS_VIEWPORT',
            payload: { ...state.canvas, scale: Math.min(3, state.canvas.scale + 0.15) },
          });
        }}
        onZoomOut={() => {
          dispatch({
            type: 'SET_CANVAS_VIEWPORT',
            payload: { ...state.canvas, scale: Math.max(0.15, state.canvas.scale - 0.15) },
          });
        }}
        onFitAll={fitAll}
      />
      {missingKeys.length > 0 && (
        <div className="api-key-banner">
          Missing server env vars: {missingKeys.map((k) => <code key={k}>{k}</code>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
        </div>
      )}
      <div className="app-layout" onContextMenu={handleContextMenu}>
        <CanvasArea
          ref={canvasAreaRef}
          canvas={state.canvas}
          cards={state.cards}
          selectedCardId={state.selectedCardId}
          dispatch={dispatch}
          onGenerateCreative={handleGenerateCreative}
        />
        <ChatPanel
          messages={state.messages}
          isAgentThinking={state.isAgentThinking}
          selectedCard={selectedCard}
          onSendMessage={handleSendMessage}
          onDeselectCard={() => dispatch({ type: 'SELECT_CARD', cardId: null })}
        />
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
