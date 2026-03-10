import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveOpenClawProvider, resolveLlmProvider, requestLlmCompletion, type LlmProvider } from './llm-provider.js';

describe('OpenClaw provider integration', () => {
  let tmpDir: string;
  let origHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-oc-'));
    origHome = process.env.OPENCLAW_HOME;
    process.env.OPENCLAW_HOME = tmpDir;
  });

  afterEach(() => {
    if (origHome !== undefined) process.env.OPENCLAW_HOME = origHome;
    else delete process.env.OPENCLAW_HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeModelsJson(providers: Record<string, unknown>) {
    const dir = path.join(tmpDir, 'agents', 'main', 'agent');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'models.json'), JSON.stringify({ providers }));
  }

  function writeOpenClawConfig(config: Record<string, unknown>) {
    fs.writeFileSync(path.join(tmpDir, 'openclaw.json'), JSON.stringify(config));
  }

  describe('resolveOpenClawProvider', () => {
    it('returns null when no models.json exists', () => {
      expect(resolveOpenClawProvider()).toBeNull();
    });

    it('returns null when providers have no apiKey', () => {
      writeModelsJson({ test: { baseUrl: 'http://localhost:8080/v1', models: [{ id: 'gpt-4o' }] } });
      expect(resolveOpenClawProvider()).toBeNull();
    });

    it('resolves first provider with baseUrl and apiKey', () => {
      writeModelsJson({
        myProxy: {
          baseUrl: 'http://proxy.local:8317/v1/',
          apiKey: 'sk-test-123',
          api: 'openai-completions',
          models: [{ id: 'claude-opus-4-6', name: 'Claude Opus' }]
        }
      });
      const result = resolveOpenClawProvider();
      expect(result).not.toBeNull();
      expect(result!.baseUrl).toBe('http://proxy.local:8317/v1');
      expect(result!.apiKey).toBe('sk-test-123');
      expect(result!.defaultModel).toBe('claude-opus-4-6');
    });

    it('prefers local OpenClaw gateway when chat completions are enabled', () => {
      writeOpenClawConfig({
        agents: {
          defaults: {
            model: 'openai-codex/gpt-5.2'
          }
        },
        gateway: {
          port: 18789,
          bind: 'loopback',
          auth: {
            token: 'gateway-secret'
          },
          http: {
            endpoints: {
              chatCompletions: {
                enabled: true
              }
            }
          }
        }
      });
      writeModelsJson({
        myProxy: {
          baseUrl: 'http://proxy.local:8317/v1/',
          apiKey: 'sk-test-123',
          api: 'openai-completions',
          models: [{ id: 'claude-opus-4-6' }]
        }
      });
      const result = resolveOpenClawProvider();
      expect(result).not.toBeNull();
      expect(result!.baseUrl).toBe('http://127.0.0.1:18789/v1');
      expect(result!.apiKey).toBe('gateway-secret');
      expect(result!.defaultModel).toBe('openai-codex/gpt-5.2');
    });
  });

  describe('resolveLlmProvider', () => {
    it('returns openclaw when config is available', () => {
      writeModelsJson({
        p: { baseUrl: 'http://x/v1', apiKey: 'k', models: [{ id: 'm' }] }
      });
      // Clear other env keys
      const saved = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY };
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
        expect(resolveLlmProvider()).toBe('openclaw');
      } finally {
        if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
        if (saved.o) process.env.OPENAI_API_KEY = saved.o;
        if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      }
    });
  });

  describe('requestLlmCompletion with openclaw', () => {
    it('calls OpenAI-compatible endpoint and returns content', async () => {
      writeOpenClawConfig({
        agents: {
          defaults: {
            model: 'test-model'
          }
        },
        gateway: {
          port: 18789,
          bind: 'loopback',
          auth: {
            token: 'test-key'
          },
          http: {
            endpoints: {
              chatCompletions: {
                enabled: true
              }
            }
          }
        }
      });

      const fetchImpl: typeof fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        expect(url).toBe('http://127.0.0.1:18789/v1/chat/completions');
        const headers = init?.headers as Record<string, string>;
        expect(headers.authorization).toBe('Bearer test-key');
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe('test-model');
        expect(body.messages).toHaveLength(2); // system + user
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'test response' } }]
          })
        } as Response;
      };

      const result = await requestLlmCompletion({
        prompt: 'hello',
        systemPrompt: 'you are helpful',
        provider: 'openclaw',
        fetchImpl
      });
      expect(result).toBe('test response');
    });
  });
});

describe('xAI (Grok) provider integration', () => {
  let savedXaiKey: string | undefined;
  let savedAnthropicKey: string | undefined;
  let savedOpenaiKey: string | undefined;
  let savedGeminiKey: string | undefined;
  let savedOpenclawHome: string | undefined;

  beforeEach(() => {
    savedXaiKey = process.env.XAI_API_KEY;
    savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    savedOpenaiKey = process.env.OPENAI_API_KEY;
    savedGeminiKey = process.env.GEMINI_API_KEY;
    savedOpenclawHome = process.env.OPENCLAW_HOME;
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENCLAW_HOME = '/nonexistent';
  });

  afterEach(() => {
    if (savedXaiKey !== undefined) process.env.XAI_API_KEY = savedXaiKey;
    else delete process.env.XAI_API_KEY;
    if (savedAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    else delete process.env.ANTHROPIC_API_KEY;
    if (savedOpenaiKey !== undefined) process.env.OPENAI_API_KEY = savedOpenaiKey;
    else delete process.env.OPENAI_API_KEY;
    if (savedGeminiKey !== undefined) process.env.GEMINI_API_KEY = savedGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (savedOpenclawHome !== undefined) process.env.OPENCLAW_HOME = savedOpenclawHome;
    else delete process.env.OPENCLAW_HOME;
  });

  describe('resolveLlmProvider', () => {
    it('returns xai when XAI_API_KEY is set', () => {
      process.env.XAI_API_KEY = 'xai-test-key';
      expect(resolveLlmProvider()).toBe('xai');
    });

    it('prefers anthropic over xai when both keys are set', () => {
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.XAI_API_KEY = 'xai-key';
      expect(resolveLlmProvider()).toBe('anthropic');
    });

    it('prefers openai over xai when both keys are set', () => {
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.XAI_API_KEY = 'xai-key';
      expect(resolveLlmProvider()).toBe('openai');
    });

    it('prefers gemini over xai when both keys are set', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.XAI_API_KEY = 'xai-key';
      expect(resolveLlmProvider()).toBe('gemini');
    });
  });

  describe('requestLlmCompletion with xai', () => {
    it('calls xAI endpoint with correct URL and returns content', async () => {
      process.env.XAI_API_KEY = 'xai-test-key';

      const fetchImpl: typeof fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        expect(url).toBe('https://api.x.ai/v1/chat/completions');
        const headers = init?.headers as Record<string, string>;
        expect(headers.authorization).toBe('Bearer xai-test-key');
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe('grok-2-latest');
        expect(body.messages).toHaveLength(2);
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[1].role).toBe('user');
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'grok response' } }]
          })
        } as Response;
      };

      const result = await requestLlmCompletion({
        prompt: 'hello',
        systemPrompt: 'you are helpful',
        provider: 'xai',
        fetchImpl
      });
      expect(result).toBe('grok response');
    });

    it('uses custom model when specified', async () => {
      process.env.XAI_API_KEY = 'xai-test-key';

      const fetchImpl: typeof fetch = async (input, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.model).toBe('grok-3-custom');
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'custom model response' } }]
          })
        } as Response;
      };

      const result = await requestLlmCompletion({
        prompt: 'hello',
        provider: 'xai',
        model: 'grok-3-custom',
        fetchImpl
      });
      expect(result).toBe('custom model response');
    });

    it('returns empty string when XAI_API_KEY is not set', async () => {
      delete process.env.XAI_API_KEY;

      const fetchImpl: typeof fetch = async () => {
        throw new Error('fetch should not be called');
      };

      const result = await requestLlmCompletion({
        prompt: 'hello',
        provider: 'xai',
        fetchImpl
      });
      expect(result).toBe('');
    });

    it('throws error on non-ok response', async () => {
      process.env.XAI_API_KEY = 'xai-test-key';

      const fetchImpl: typeof fetch = async () => {
        return {
          ok: false,
          status: 401
        } as Response;
      };

      await expect(requestLlmCompletion({
        prompt: 'hello',
        provider: 'xai',
        fetchImpl
      })).rejects.toThrow('xAI request failed (401)');
    });
  });

  describe('LlmProvider type', () => {
    it('includes xai in the provider union', () => {
      const providers: LlmProvider[] = ['anthropic', 'openai', 'gemini', 'xai', 'openclaw'];
      expect(providers).toContain('xai');
    });
  });
});
