import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LlmProvider = 'anthropic' | 'openai' | 'gemini' | 'xai' | 'openclaw';

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: 'claude-3-5-haiku-latest',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  xai: 'grok-2-latest',
  openclaw: 'gpt-4o-mini'
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

export interface OpenClawProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
  defaultModel: string;
}

type OpenClawConfigFile = {
  agents?: {
    defaults?: {
      model?: string;
    };
  };
  gateway?: {
    port?: number;
    bind?: string;
    auth?: {
      token?: string;
    };
    http?: {
      endpoints?: {
        chatCompletions?: {
          enabled?: boolean;
        };
      };
    };
  };
};

export interface LlmCompletionOptions {
  prompt: string;
  provider?: LlmProvider | null;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Resolve the local OpenClaw home directory.
 */
function resolveOpenClawHome(): string {
  return process.env.OPENCLAW_HOME?.trim()
    || path.join(os.homedir(), '.openclaw');
}

/**
 * Resolve an OpenClaw provider via the local gateway's OpenAI-compatible
 * `/v1/chat/completions` endpoint when it is enabled.
 */
function resolveOpenClawGatewayProvider(): OpenClawProviderConfig | null {
  try {
    const configPath = path.join(resolveOpenClawHome(), 'openclaw.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as OpenClawConfigFile;
    const enabled = raw.gateway?.http?.endpoints?.chatCompletions?.enabled === true;
    const apiKey = raw.gateway?.auth?.token?.trim();
    const port = raw.gateway?.port;
    if (!enabled || !apiKey || typeof port !== 'number' || !Number.isFinite(port) || port <= 0) {
      return null;
    }

    const defaultModel = raw.agents?.defaults?.model?.trim() || DEFAULT_MODELS.openclaw;
    const host = raw.gateway?.bind === 'loopback' ? '127.0.0.1' : '127.0.0.1';
    return {
      baseUrl: `http://${host}:${port}/v1`,
      apiKey,
      api: 'openai-completions',
      defaultModel
    };
  } catch {
    return null;
  }
}

/**
 * Resolve an OpenClaw model provider.
 *
 * Priority:
 * 1. Local OpenClaw gateway `/v1/chat/completions` when enabled
 * 2. `~/.openclaw/agents/main/agent/models.json` custom provider config
 */
export function resolveOpenClawProvider(): OpenClawProviderConfig | null {
  const gatewayProvider = resolveOpenClawGatewayProvider();
  if (gatewayProvider) {
    return gatewayProvider;
  }

  try {
    const modelsPath = path.join(resolveOpenClawHome(), 'agents', 'main', 'agent', 'models.json');

    if (!fs.existsSync(modelsPath)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(modelsPath, 'utf-8')) as {
      providers?: Record<string, {
        baseUrl?: string;
        apiKey?: string;
        api?: string;
        models?: Array<{ id: string; name?: string }>;
      }>;
    };

    if (!raw.providers || typeof raw.providers !== 'object') {
      return null;
    }

    for (const [, provider] of Object.entries(raw.providers)) {
      if (provider.baseUrl && provider.apiKey) {
        const defaultModel = provider.models?.[0]?.id ?? 'gpt-4o-mini';
        return {
          baseUrl: provider.baseUrl.replace(/\/+$/, ''),
          apiKey: provider.apiKey,
          api: provider.api ?? 'openai-completions',
          defaultModel
        };
      }
    }
  } catch {
    // Config not available or malformed — fall through
  }
  return null;
}

export function resolveLlmProvider(): LlmProvider | null {
  if (process.env.CLAWVAULT_NO_LLM) {
    return null;
  }
  // Prefer OpenClaw provider config if available
  if (resolveOpenClawProvider()) {
    return 'openclaw';
  }
  // Fall back to direct env-key providers
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  if (process.env.GEMINI_API_KEY) {
    return 'gemini';
  }
  if (process.env.XAI_API_KEY) {
    return 'xai';
  }
  return null;
}

export async function requestLlmCompletion(options: LlmCompletionOptions): Promise<string> {
  const provider = options.provider ?? resolveLlmProvider();
  if (!provider) {
    return '';
  }

  if (provider === 'openclaw') {
    return callOpenClaw(options);
  }
  if (provider === 'anthropic') {
    return callAnthropic(options, provider);
  }
  if (provider === 'gemini') {
    return callGemini(options, provider);
  }
  if (provider === 'xai') {
    return callXAI(options, provider);
  }
  return callOpenAI(options, provider);
}

async function callAnthropic(options: LlmCompletionOptions, provider: LlmProvider): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return '';
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODELS[provider],
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 1200,
      messages: [{ role: 'user', content: options.prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status})`);
  }

  const payload = await response.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  return payload.content
    ?.filter((entry) => entry.type === 'text' && entry.text)
    .map((entry) => entry.text as string)
    .join('\n')
    .trim() ?? '';
}

async function callOpenAI(options: LlmCompletionOptions, provider: LlmProvider): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return '';
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (options.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: options.systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: options.prompt });

  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODELS[provider],
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 1200,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status})`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callXAI(options: LlmCompletionOptions, provider: LlmProvider): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return '';
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (options.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: options.systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: options.prompt });

  const response = await fetchImpl(`${XAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODELS[provider],
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 1200,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`xAI request failed (${response.status})`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callGemini(options: LlmCompletionOptions, provider: LlmProvider): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return '';
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_MODELS[provider];
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: options.maxTokens ?? 1200
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status})`);
  }

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

/**
 * Route LLM requests through an OpenClaw model provider.
 * Uses the OpenAI-compatible chat completions API format,
 * which is the standard for OpenClaw provider routing.
 */
async function callOpenClaw(options: LlmCompletionOptions): Promise<string> {
  const config = resolveOpenClawProvider();
  if (!config) {
    return '';
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (options.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: options.systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: options.prompt });

  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: options.model ?? config.defaultModel,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 1200,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`OpenClaw provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}
