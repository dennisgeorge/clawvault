/**
 * LLM Adapter for fact extraction.
 *
 * Provides a unified interface for calling LLMs to extract facts from text.
 * Currently supports Gemini Flash as the primary adapter, with fallback to
 * the existing LLM provider infrastructure.
 */

import { requestLlmCompletion, resolveLlmProvider, type LlmProvider } from './llm-provider.js';

export type FactExtractionMode = 'off' | 'rule' | 'llm' | 'hybrid';

export interface LlmAdapterOptions {
  provider?: LlmProvider | null;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

export interface LlmAdapter {
  /**
   * Call the LLM with a prompt and return the response text.
   */
  call(prompt: string): Promise<string>;

  /**
   * Check if the adapter is available (has valid credentials).
   */
  isAvailable(): boolean;

  /**
   * Get the provider name for this adapter.
   */
  getProvider(): LlmProvider | null;
}

const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';
const OLLAMA_DEFAULT_MODEL = 'llama3.1:8b';
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/**
 * Create a Gemini Flash adapter for fact extraction.
 * Uses the Gemini API with the flash model optimized for speed.
 */
export function createGeminiFlashAdapter(options: LlmAdapterOptions = {}): LlmAdapter {
  const apiKey = process.env.GEMINI_API_KEY;

  return {
    async call(prompt: string): Promise<string> {
      if (!apiKey) {
        return '';
      }

      return requestLlmCompletion({
        prompt,
        provider: 'gemini',
        model: options.model ?? GEMINI_FLASH_MODEL,
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? 2000,
        fetchImpl: options.fetchImpl
      });
    },

    isAvailable(): boolean {
      return Boolean(apiKey);
    },

    getProvider(): LlmProvider | null {
      return apiKey ? 'gemini' : null;
    }
  };
}

/**
 * Create an Ollama adapter for fact extraction.
 * Uses local Ollama instance — always free, no API key needed.
 */
export function createOllamaAdapter(options: LlmAdapterOptions = {}): LlmAdapter {
  let _available: boolean | null = null;
  const fetchFn = options.fetchImpl ?? globalThis.fetch;

  return {
    async call(prompt: string): Promise<string> {
      const resp = await fetchFn(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model ?? OLLAMA_DEFAULT_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.1,
            num_predict: options.maxTokens ?? 2000
          }
        })
      });
      if (!resp.ok) return '';
      const data = await resp.json() as { response?: string };
      return data.response ?? '';
    },

    isAvailable(): boolean {
      if (_available !== null) return _available;
      // Synchronous check — optimistic. Actual availability confirmed on first call.
      // We check by attempting a sync XMLHttpRequest-style probe, but since we're
      // in Node with only async fetch, we optimistically return true and let call() fail gracefully.
      // For real check, use checkOllamaAvailable() async function.
      _available = true;
      return true;
    },

    getProvider(): LlmProvider | null {
      return null; // Ollama isn't a standard LlmProvider
    }
  };
}

/**
 * Async check if Ollama is running locally.
 */
export async function checkOllamaAvailable(fetchFn?: typeof fetch): Promise<boolean> {
  try {
    const f = fetchFn ?? globalThis.fetch;
    const resp = await f(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Create an LLM adapter using the default provider resolution.
 * Falls back through providers: openclaw -> anthropic -> openai -> gemini -> xai
 */
export function createDefaultAdapter(options: LlmAdapterOptions = {}): LlmAdapter {
  const resolvedProvider = options.provider !== undefined
    ? options.provider
    : resolveLlmProvider();

  return {
    async call(prompt: string): Promise<string> {
      if (!resolvedProvider) {
        return '';
      }

      return requestLlmCompletion({
        prompt,
        provider: resolvedProvider,
        model: options.model,
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? 2000,
        fetchImpl: options.fetchImpl
      });
    },

    isAvailable(): boolean {
      return resolvedProvider !== null;
    },

    getProvider(): LlmProvider | null {
      return resolvedProvider;
    }
  };
}

/**
 * Create an LLM adapter for fact extraction based on configuration.
 *
 * Priority:
 * 1. If provider is explicitly specified, use that
 * 2. If Gemini API key is available, prefer Gemini Flash for speed
 * 3. If Ollama is running locally, use Ollama (free, always available)
 * 4. Fall back to default provider resolution
 */
export function createFactExtractionAdapter(options: LlmAdapterOptions = {}): LlmAdapter {
  if (options.provider) {
    return createDefaultAdapter(options);
  }

  const geminiAdapter = createGeminiFlashAdapter(options);
  if (geminiAdapter.isAvailable()) {
    return geminiAdapter;
  }

  // Ollama is always "available" optimistically — it fails gracefully on call()
  // and extractFactsLlm falls back to rule-based extraction
  const ollamaAdapter = createOllamaAdapter(options);
  if (ollamaAdapter.isAvailable()) {
    return ollamaAdapter;
  }

  return createDefaultAdapter(options);
}

/**
 * Create an LLM function compatible with extractFactsLlm.
 * This wraps the adapter into the function signature expected by fact-extractor.ts.
 */
export function createLlmFunction(adapter: LlmAdapter): ((prompt: string) => Promise<string>) | undefined {
  if (!adapter.isAvailable()) {
    return undefined;
  }

  return (prompt: string) => adapter.call(prompt);
}

/**
 * Resolve the effective fact extraction mode based on configuration and availability.
 *
 * - 'off': Never extract facts
 * - 'rule': Only use rule-based extraction (no LLM)
 * - 'llm': Prefer LLM extraction, fall back to rules if LLM unavailable
 * - 'hybrid': Use both LLM and rules, merge results (future enhancement)
 */
export function resolveFactExtractionMode(
  configuredMode: FactExtractionMode | undefined,
  adapter?: LlmAdapter
): { mode: FactExtractionMode; useLlm: boolean } {
  const mode = configuredMode ?? 'llm';

  if (mode === 'off') {
    return { mode: 'off', useLlm: false };
  }

  if (mode === 'rule') {
    return { mode: 'rule', useLlm: false };
  }

  const llmAvailable = adapter?.isAvailable() ?? resolveLlmProvider() !== null;

  if (mode === 'llm' || mode === 'hybrid') {
    return { mode, useLlm: llmAvailable };
  }

  return { mode: 'rule', useLlm: false };
}
