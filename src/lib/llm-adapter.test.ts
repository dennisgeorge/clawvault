import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createGeminiFlashAdapter,
  createDefaultAdapter,
  createFactExtractionAdapter,
  createLlmFunction,
  resolveFactExtractionMode,
  type LlmAdapter,
  type FactExtractionMode
} from './llm-adapter.js';

describe('createGeminiFlashAdapter', () => {
  let savedGeminiKey: string | undefined;

  beforeEach(() => {
    savedGeminiKey = process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (savedGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = savedGeminiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('returns unavailable adapter when no API key', () => {
    delete process.env.GEMINI_API_KEY;
    const adapter = createGeminiFlashAdapter();
    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getProvider()).toBeNull();
  });

  it('returns available adapter when API key is set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const adapter = createGeminiFlashAdapter();
    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getProvider()).toBe('gemini');
  });

  it('returns empty string when calling unavailable adapter', async () => {
    delete process.env.GEMINI_API_KEY;
    const adapter = createGeminiFlashAdapter();
    const result = await adapter.call('test prompt');
    expect(result).toBe('');
  });

  it('calls Gemini API with correct parameters', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      expect(url).toContain('gemini-2.0-flash:generateContent');
      const body = JSON.parse(init?.body as string);
      expect(body.contents[0].parts[0].text).toBe('test prompt');
      expect(body.generationConfig.temperature).toBe(0.1);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response text' }] } }]
        })
      } as Response;
    };

    const adapter = createGeminiFlashAdapter({ fetchImpl });
    const result = await adapter.call('test prompt');
    expect(result).toBe('response text');
  });
});

describe('createDefaultAdapter', () => {
  let savedKeys: Record<string, string | undefined>;

  beforeEach(() => {
    savedKeys = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      XAI_API_KEY: process.env.XAI_API_KEY,
      OPENCLAW_HOME: process.env.OPENCLAW_HOME
    };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    process.env.OPENCLAW_HOME = '/nonexistent';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedKeys)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  it('returns unavailable adapter when no providers configured', () => {
    const adapter = createDefaultAdapter();
    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getProvider()).toBeNull();
  });

  it('uses explicit provider when specified', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const adapter = createDefaultAdapter({ provider: 'gemini' });
    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getProvider()).toBe('gemini');
  });

  it('returns unavailable when explicit provider is null', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const adapter = createDefaultAdapter({ provider: null });
    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getProvider()).toBeNull();
  });
});

describe('createFactExtractionAdapter', () => {
  let savedKeys: Record<string, string | undefined>;

  beforeEach(() => {
    savedKeys = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      XAI_API_KEY: process.env.XAI_API_KEY,
      OPENCLAW_HOME: process.env.OPENCLAW_HOME
    };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    process.env.OPENCLAW_HOME = '/nonexistent';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedKeys)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  it('prefers Gemini Flash when available', () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    const adapter = createFactExtractionAdapter();
    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getProvider()).toBe('gemini');
  });

  it('falls back to Ollama when Gemini unavailable', () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    const adapter = createFactExtractionAdapter();
    expect(adapter.isAvailable()).toBe(true);
    // Ollama adapter intercepts before default provider (getProvider returns null for Ollama)
    expect(adapter.getProvider()).toBe(null);
  });

  it('uses explicit provider when specified', () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    const adapter = createFactExtractionAdapter({ provider: 'anthropic' });
    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getProvider()).toBe('anthropic');
  });
});

describe('createLlmFunction', () => {
  it('returns undefined for unavailable adapter', () => {
    const adapter: LlmAdapter = {
      call: async () => '',
      isAvailable: () => false,
      getProvider: () => null
    };
    const fn = createLlmFunction(adapter);
    expect(fn).toBeUndefined();
  });

  it('returns function for available adapter', () => {
    const adapter: LlmAdapter = {
      call: async (prompt) => `response: ${prompt}`,
      isAvailable: () => true,
      getProvider: () => 'gemini'
    };
    const fn = createLlmFunction(adapter);
    expect(fn).toBeDefined();
  });

  it('returned function calls adapter', async () => {
    const adapter: LlmAdapter = {
      call: async (prompt) => `response: ${prompt}`,
      isAvailable: () => true,
      getProvider: () => 'gemini'
    };
    const fn = createLlmFunction(adapter)!;
    const result = await fn('test');
    expect(result).toBe('response: test');
  });
});

describe('resolveFactExtractionMode', () => {
  it('returns off mode when configured as off', () => {
    const result = resolveFactExtractionMode('off');
    expect(result.mode).toBe('off');
    expect(result.useLlm).toBe(false);
  });

  it('returns rule mode when configured as rule', () => {
    const result = resolveFactExtractionMode('rule');
    expect(result.mode).toBe('rule');
    expect(result.useLlm).toBe(false);
  });

  it('returns llm mode with useLlm true when adapter available', () => {
    const adapter: LlmAdapter = {
      call: async () => '',
      isAvailable: () => true,
      getProvider: () => 'gemini'
    };
    const result = resolveFactExtractionMode('llm', adapter);
    expect(result.mode).toBe('llm');
    expect(result.useLlm).toBe(true);
  });

  it('returns llm mode with useLlm false when adapter unavailable', () => {
    const adapter: LlmAdapter = {
      call: async () => '',
      isAvailable: () => false,
      getProvider: () => null
    };
    const result = resolveFactExtractionMode('llm', adapter);
    expect(result.mode).toBe('llm');
    expect(result.useLlm).toBe(false);
  });

  it('returns hybrid mode when configured as hybrid', () => {
    const adapter: LlmAdapter = {
      call: async () => '',
      isAvailable: () => true,
      getProvider: () => 'gemini'
    };
    const result = resolveFactExtractionMode('hybrid', adapter);
    expect(result.mode).toBe('hybrid');
    expect(result.useLlm).toBe(true);
  });

  it('defaults to llm mode when undefined', () => {
    const adapter: LlmAdapter = {
      call: async () => '',
      isAvailable: () => true,
      getProvider: () => 'gemini'
    };
    const result = resolveFactExtractionMode(undefined, adapter);
    expect(result.mode).toBe('llm');
    expect(result.useLlm).toBe(true);
  });
});
