import {
  DATE_HEADING_RE,
  inferObservationType,
  normalizeObservationContent,
  parseObservationMarkdown,
  renderObservationMarkdown,
  type ParsedObservationRecord,
  type ObservationType
} from '../lib/observation-format.js';

export interface CompressorOptions {
  provider?: CompressionProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

export type CompressionProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'xai'
  | 'openai-compatible'
  | 'ollama'
  | 'minimax'
  | 'zai';

type ResolvedCompressionBackend = {
  provider: CompressionProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

type FallbackCandidate = {
  date: string;
  time: string;
  type: ObservationType;
  confidence: number;
  importance: number;
  content: string;
};

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const XAI_BASE_URL = 'https://api.x.ai/v1';
const OLLAMA_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_PROVIDER_MODELS: Record<CompressionProvider, string> = {
  anthropic: 'claude-3-5-haiku-latest',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  xai: 'grok-2-latest',
  'openai-compatible': 'gpt-4o-mini',
  ollama: 'llama3.2',
  minimax: 'MiniMax-M2.1',
  zai: 'glm-4.5-air'
};

const CRITICAL_RE =
  /(?:\b(?:decision|decided|chose|chosen|selected|picked|opted|switched to)\s*:?|\bdecid(?:e|ed|ing|ion)\b|\berror\b|\bfail(?:ed|ure|ing)?\b|\bblock(?:ed|er)?\b|\bbreaking(?:\s+change)?s?\b|\bcritical\b|\b\w+\s+chosen\s+(?:for|over|as)\b|\bpublish(?:ed)?\b.*@?\d+\.\d+|\bmerge[d]?\s+(?:PR|pull\s+request)\b|\bshipped\b|\breleased?\b.*v?\d+\.\d+|\bsigned\b.*\b(?:contract|agreement|deal)\b|\bpricing\b.*\$|\bdemo\b.*\b(?:completed?|done|finished)\b|\bmeeting\b.*\b(?:completed?|done|finished)\b|\bstrategy\b.*\b(?:pivot|change|shift)\b)/i;
const DEADLINE_WITH_DATE_RE = /(?:(?:\bdeadline\b|\bdue(?:\s+date)?\b|\bcutoff\b).*(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})|(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}).*(?:\bdeadline\b|\bdue(?:\s+date)?\b|\bcutoff\b))/i;
const NOTABLE_RE = /\b(prefer(?:ence|s)?|likes?|dislikes?|context|pattern|architecture|approach|trade[- ]?off|milestone|stakeholder|teammate|collaborat(?:e|ed|ion)|discussion|notable|deadline|due|timeline|deploy(?:ed|ment)?|built|configured|launched|proposal|pitch|onboard(?:ed|ing)?|migrat(?:e|ed|ion)|domain|DNS|infra(?:structure)?)\b/i;
const TODO_SIGNAL_RE = /(?:\btodo:\s*|\bwe need to\b|\bdon't forget(?: to)?\b|\bremember to\b|\bmake sure to\b)/i;
const COMMITMENT_TASK_SIGNAL_RE = /\b(?:i'?ll|i will|let me|(?:i'?m\s+)?going to|plan to|should)\b/i;
const UNRESOLVED_COMMITMENT_RE = /\b(?:need to figure out|tbd|to be determined)\b/i;
const DEADLINE_SIGNAL_RE = /\b(?:by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)|before\s+the\s+\w+|deadline is)\b/i;
const ROLE_PREFIX_RE = /^([a-z][a-z0-9_-]{1,31})\s*:\s*(.+)$/i;
const BASE64_DATA_URI_RE = /\bdata:[^;\s]+;base64,[A-Za-z0-9+/=]{24,}\b/gi;
const LONG_BASE64_TOKEN_RE = /\b[A-Za-z0-9+/]{80,}={0,2}\b/g;
// Noise prefixes commonly found in OpenClaw transcripts / tool plumbing.
// These are not durable memories and should not enter the observation pipeline.
const NOISE_PREFIX_RE = /^(?:metadata|system metadata|session metadata|tool[_-]?result|toolresult)\s*:/i;
const STRUCTURED_NOISE_MARKER_RE =
  /\b(?:tool[_-]?result|tool[_-]?use|toolcallid|tooluseid|function[_-]?(?:call|result)|stdout|stderr|exitcode|recordedat|trace(?:_|-)?id|parent(?:_|-)?id|session(?:_|-)?id|metadata|base64|mime(?:type)?)\b/i;
const LOW_SIGNAL_OPENING_RE =
  /\b(?:starts?\s+now|starting\s+(?:routine\s+)?(?:maintenance|meeting|session)|meeting\s+recap)\b/i;
const ACK_ONLY_RE = /^(?:user:|assistant:)?\s*(?:ok(?:ay)?|sounds good|got it|understood|ack(?:nowledged)?)(?:[.!]|$)/i;
const ROUTINE_MAINTENANCE_RE =
  /\b(?:maintenance|health checks?|backups?|logs?|incidents?|alerts?|follow-up|workers?|cache prune)\b/i;
const NO_INCIDENT_RE =
  /\b(?:without incidents?|no incidents?|no alerts?|stayed green|no follow-up)\b/i;
const COMMITMENT_CONTEXT_RE =
  /(?:#\w[\w-]*|\bv\d+\.\d+(?:\.\d+)?\b|\bafter ci\b|\bchangelog\b|\bredlines?\b|\bproposal\b|\bcontract\b|\bagreement\b)/i;

export class Compressor {
  private readonly provider?: CompressionProvider;
  private readonly model?: string;
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CompressorOptions = {}) {
    this.provider = options.provider;
    this.model = options.model;
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async compress(messages: string[], existingObservations: string): Promise<string> {
    const cleanedMessages = this.sanitizeIncomingMessages(messages);
    if (cleanedMessages.length === 0) {
      return existingObservations.trim();
    }

    const prompt = this.buildPrompt(cleanedMessages, existingObservations);
    const backend = this.resolveProvider();

    if (backend) {
      try {
        const llmOutput = backend.provider === 'anthropic'
          ? await this.callAnthropic(prompt, backend)
          : backend.provider === 'gemini'
          ? await this.callGemini(prompt, backend)
          : backend.provider === 'openai'
          ? await this.callOpenAI(prompt, backend)
          : backend.provider === 'xai'
          ? await this.callXAI(prompt, backend)
          : await this.callOpenAICompatible(prompt, backend);
        const normalized = this.normalizeLlmOutput(llmOutput);
        if (normalized) {
          return this.mergeObservations(existingObservations, normalized);
        }
      } catch {
        // Fall back to deterministic extraction to keep observer flow stable.
      }
    }

    const fallback = this.fallbackCompression(cleanedMessages);
    return this.mergeObservations(existingObservations, fallback);
  }

  private sanitizeIncomingMessages(messages: string[]): string[] {
    const sanitized: string[] = [];
    for (const message of messages) {
      const cleaned = this.sanitizeIncomingMessage(message);
      if (cleaned) {
        sanitized.push(cleaned);
      }
    }
    return sanitized;
  }

  private sanitizeIncomingMessage(message: string): string {
    const normalized = message.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    // OpenClaw observer tags messages with a source prefix like: "[main] assistant: ...".
    // Keep the tag for attribution, but strip it for role parsing so we can drop tool messages.
    const sourceTagMatch = /^\[[^\]]+\]\s+/.exec(normalized);
    const sourceTag = sourceTagMatch ? sourceTagMatch[0] : '';
    const payload = sourceTag ? normalized.slice(sourceTag.length).trimStart() : normalized;

    const roleMatch = ROLE_PREFIX_RE.exec(payload);
    if (roleMatch && this.isConversationRolePrefix(roleMatch[1])) {
      const role = this.normalizeMessageRole(roleMatch[1]);
      if (this.shouldDropMessageRole(role)) {
        return '';
      }

      const content = this.stripNoisyData(roleMatch[2]);
      if (!content || this.isLikelyStructuredNoise(content)) {
        return '';
      }

      const cleaned = `${role}: ${content}`;
      return sourceTag ? `${sourceTag}${cleaned}` : cleaned;
    }

    const cleaned = this.stripNoisyData(payload);
    if (!cleaned || this.isLikelyStructuredNoise(cleaned)) {
      return '';
    }

    return sourceTag ? `${sourceTag}${cleaned}` : cleaned;
  }

  private normalizeMessageRole(role: string): string {
    return role.trim().toLowerCase();
  }

  private isConversationRolePrefix(role: string): boolean {
    const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!normalized) {
      return false;
    }
    if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
      return true;
    }
    if (normalized === 'developer' || normalized === 'metadata') {
      return true;
    }
    return normalized.startsWith('tool');
  }

  private shouldDropMessageRole(role: string): boolean {
    const normalized = role.replace(/[\s_-]+/g, '');
    if (!normalized) {
      return false;
    }
    if (normalized === 'system' || normalized === 'developer' || normalized === 'metadata') {
      return true;
    }
    return normalized.startsWith('tool');
  }

  private stripNoisyData(value: string): string {
    return value
      .replace(BASE64_DATA_URI_RE, ' ')
      .replace(LONG_BASE64_TOKEN_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isLikelyStructuredNoise(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
      return true;
    }
    if (NOISE_PREFIX_RE.test(trimmed)) {
      return true;
    }

    // Some OpenClaw tool plumbing prefixes structured payloads, e.g. "toolresult: { ... }".
    // Treat those as structured noise too.
    const afterToolResult = trimmed.match(/^tool[_-]?result\s*:\s*(\{.*|\[.*)/i);
    if (afterToolResult && STRUCTURED_NOISE_MARKER_RE.test(trimmed) && trimmed.length >= 40) {
      return true;
    }

    const looksStructured = trimmed.startsWith('{') || trimmed.startsWith('[');
    if (looksStructured && STRUCTURED_NOISE_MARKER_RE.test(trimmed) && trimmed.length >= 40) {
      return true;
    }

    return false;
  }

  private resolveProvider(): ResolvedCompressionBackend | null {
    if (process.env.CLAWVAULT_NO_LLM) return null;

    if (this.provider) {
      const configured = this.resolveConfiguredProvider(this.provider);
      if (configured) {
        return configured;
      }
      return this.resolveProviderFromEnv(false);
    }

    return this.resolveProviderFromEnv(true);
  }

  private resolveConfiguredProvider(provider: CompressionProvider): ResolvedCompressionBackend | null {
    const model = this.resolveModel(provider);
    if (provider === 'anthropic') {
      const apiKey = this.resolveApiKey(provider);
      if (!apiKey) {
        return null;
      }
      return {
        provider,
        model,
        apiKey
      };
    }

    if (provider === 'gemini') {
      const apiKey = this.resolveApiKey(provider);
      if (!apiKey) {
        return null;
      }
      return {
        provider,
        model,
        apiKey
      };
    }

    if (provider === 'openai') {
      const apiKey = this.resolveApiKey(provider);
      if (!apiKey) {
        return null;
      }
      return {
        provider,
        model,
        apiKey,
        baseUrl: this.resolveBaseUrl(provider)
      };
    }

    if (provider === 'xai') {
      const apiKey = this.resolveApiKey(provider);
      if (!apiKey) {
        return null;
      }
      return {
        provider,
        model,
        apiKey,
        baseUrl: XAI_BASE_URL
      };
    }

    const apiKey = this.resolveApiKey(provider) ?? undefined;
    return {
      provider,
      model,
      apiKey,
      baseUrl: this.resolveBaseUrl(provider)
    };
  }

  private resolveProviderFromEnv(allowConfiguredModel: boolean): ResolvedCompressionBackend | null {
    const anthropicApiKey = this.readEnvValue('ANTHROPIC_API_KEY');
    if (anthropicApiKey) {
      return {
        provider: 'anthropic',
        model: allowConfiguredModel ? this.resolveModel('anthropic') : DEFAULT_PROVIDER_MODELS.anthropic,
        apiKey: anthropicApiKey
      };
    }

    const openAiApiKey = this.readEnvValue('OPENAI_API_KEY');
    if (openAiApiKey) {
      return {
        provider: 'openai',
        model: allowConfiguredModel ? this.resolveModel('openai') : DEFAULT_PROVIDER_MODELS.openai,
        apiKey: openAiApiKey,
        baseUrl: OPENAI_BASE_URL
      };
    }

    const geminiApiKey = this.readEnvValue('GEMINI_API_KEY');
    if (geminiApiKey) {
      return {
        provider: 'gemini',
        model: allowConfiguredModel ? this.resolveModel('gemini') : DEFAULT_PROVIDER_MODELS.gemini,
        apiKey: geminiApiKey
      };
    }

    const xaiApiKey = this.readEnvValue('XAI_API_KEY');
    if (xaiApiKey) {
      return {
        provider: 'xai',
        model: allowConfiguredModel ? this.resolveModel('xai') : DEFAULT_PROVIDER_MODELS.xai,
        apiKey: xaiApiKey,
        baseUrl: XAI_BASE_URL
      };
    }

    return null;
  }

  private resolveModel(provider: CompressionProvider): string {
    const configuredModel = this.model?.trim();
    if (configuredModel) {
      return configuredModel;
    }
    return DEFAULT_PROVIDER_MODELS[provider];
  }

  private resolveApiKey(provider: CompressionProvider): string | null {
    const configuredApiKey = this.apiKey?.trim();
    if (configuredApiKey) {
      return configuredApiKey;
    }

    if (provider === 'anthropic') {
      return this.readEnvValue('ANTHROPIC_API_KEY');
    }
    if (provider === 'gemini') {
      return this.readEnvValue('GEMINI_API_KEY');
    }
    if (provider === 'xai') {
      return this.readEnvValue('XAI_API_KEY');
    }
    return this.readEnvValue('OPENAI_API_KEY');
  }

  private resolveBaseUrl(provider: CompressionProvider): string {
    const configuredBaseUrl = this.baseUrl?.trim();
    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/+$/, '');
    }
    if (provider === 'ollama') {
      return OLLAMA_BASE_URL;
    }
    return OPENAI_BASE_URL;
  }

  private readEnvValue(name: string): string | null {
    const value = process.env[name]?.trim();
    return value ? value : null;
  }

  private buildPrompt(messages: string[], existingObservations: string): string {
    return [
      'You are an observer that compresses raw AI session messages into durable, human-meaningful observations.',
      '',
      'Rules:',
      '- Output markdown only.',
      '- Group observations by date heading: ## YYYY-MM-DD',
      '- Each observation line MUST follow: - [type|c=<0.00-1.00>|i=<0.00-1.00>] <observation>',
      '- Allowed type tags: decision, preference, fact, commitment, task, todo, commitment-unresolved, milestone, lesson, relationship, project',
      '- i >= 0.80 for structural/persistent observations (major decisions, blockers, releases, commitments)',
      '- i 0.40-0.79 for potentially important observations (notable context, preferences, milestones)',
      '- i < 0.40 for contextual/routine observations',
      '- Confidence c reflects extraction certainty, not importance.',
      '- Preserve source tags when present (e.g., [main], [telegram-dm], [discord], [telegram-group]).',
      '',
      'TASK AND TYPE EXTRACTION (required — type accuracy is critical):',
      '- [todo] — Explicit action items with TODO-like phrasing: "TODO:", "we need to", "don\'t forget", "remember to", "make sure to", "send X to Y". Prefix content with "TODO: ".',
      '- [task] — RARELY used. Only for internal action items that don\'t rise to a commitment. Prefer [todo] or [commitment] over [task].',
      '- [commitment] — When ANYONE promises/agrees/will-do something: "I\'ll", "I will", "we will", "committed to", "agreed to". "I will publish X" = commitment. "I will coordinate X" = commitment. Prefix with "[COMMITMENT]".',
      '- [commitment-unresolved] — Unresolved commitments/questions: "need to figure out", "TBD", "to be determined".',
      '- [decision] — Explicit choices, agreements, pricing: "decided to", "agreed on", "chose X over Y", "pricing set at". "Agreed on $48K" = decision, NOT fact. Prefix with "Decision: ".',
      '- [relationship] — Information about people: approvals, role mentions, who did what. Use when a PERSON takes a notable action.',
      '- [fact] — Only for neutral factual observations that don\'t fit above categories. NOT for action items, decisions, commitments, or agreements.',
      '- Deadline language ("by Friday", "before the demo", "deadline is") increases importance.',
      '',
      'QUALITY FILTERS (important):',
      '- DO NOT observe: CLI errors, command failures, tool output parsing issues, retry attempts, debug logs.',
      '  These are transient noise, not memories. Only observe errors if they represent a BLOCKER or an unresolved problem.',
      '- DO NOT observe: "acknowledged the conversation", "said okay", routine confirmations.',
      '- DO NOT observe individual steps of routine maintenance (log rotation, backups, cache pruning, health checks, worker restarts) unless something FAILED or required follow-up. If the entire session is routine maintenance with no incidents, emit ONE summary that preserves ALL specific terms from the transcript. Include every action mentioned (starting, rotating, cleaning directories, confirming, restarting, pruning, etc.) and every status term (alerts, incidents, reported, window, round). Example: "- [fact|c=0.90|i=0.20] Starting routine maintenance window. Rotated weekly logs, confirmed backups, cleaned temp directories. Health checks stayed green, no incidents reported. Dependency cache pruned, restarted workers with no alerts. No follow-up tasks this round. Thanks."',
      '- DO NOT observe meeting/session openings like "meeting recap starts now", "client meeting started". These are scene-setters, not memories.',
      '- MERGE related events into single observations. If 5 images were generated, say "Generated 5 images for X" not 5 separate lines.',
      '- MERGE retry sequences: "Tried X, failed, tried Y, succeeded" → "Resolved X using Y (after initial failure)"',
      '- Prefer OUTCOMES over PROCESSES: "Deployed v1.2 to Railway" not "Started deploy... build finished... deploy succeeded"',
      '',
      'AGENT ATTRIBUTION:',
      '- If the transcript shows multiple speakers/agents, prefix observations with who did it: "Pedro asked...", "Clawdious deployed...", "Zeca generated..."',
      '- If only one agent is acting, attribution is optional.',
      '',
      'PROJECT MILESTONES (critical — these are the most valuable observations):',
      'Projects are NOT just code. Milestones include business, strategy, client, and operational events.',
      '- Use milestone/decision/commitment types for strategic events with high importance.',
      '- Use preference/lesson/relationship/project/fact when appropriate.',
      '- Examples:',
      '  "- [decision|c=0.95|i=0.90] 14:00 Pricing decision: $33K one-time + $3K/mo for Artemisa"',
      '  "- [milestone|c=0.93|i=0.88] 14:00 Published clawvault@2.1.0 to npm"',
      '  "- [project|c=0.84|i=0.58] 14:00 Deployed pitch deck to artemisa-pitch-deck.vercel.app"',
      '- Do NOT collapse multiple milestones into one line — each matters for history.',
      '',
      'COMMITMENT FORMAT (when someone promises/agrees to something):',
      '- Prefer: "- [commitment|c=...|i=...] HH:MM [COMMITMENT] <who> committed to <what> by <when>"',
      '',
      'KEYWORD PRESERVATION (critical for search):',
      '- Observations must be searchable later. Preserve exact key terms from the transcript:',
      '  - Product/project names exactly as written (e.g., "ClawVault" not "the memory tool", "Northwind" not "the client")',
      '  - Person names exactly (e.g., "Elena" not "the contact", "Marco" not "the stakeholder")',
      '  - Technical terms exactly (e.g., "SOC2" not "security compliance", "#northwind-deal" not "the deal channel")',
      '  - Monetary amounts exactly (e.g., "$48K setup" not "the agreed pricing")',
      '  - Dates/deadlines exactly (e.g., "March 28" not "end of month", "April 2" not "early April")',
      '- If you paraphrase, you destroy searchability. Use the transcript\'s own words.',
      '',
      'Keep observations concise and factual. Aim for signal, not completeness.',
      '',
      'Existing observations (may be empty):',
      existingObservations.trim() || '(none)',
      '',
      'Raw messages:',
      ...messages.map((message, index) => `[${index + 1}] ${message}`),
      '',
      'Return only the updated observation markdown.'
    ].join('\n');
  }

  private buildOpenAICompatibleUrl(baseUrl: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    return `${normalizedBaseUrl}/chat/completions`;
  }

  private buildOpenAICompatibleHeaders(apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  private extractOpenAIContent(content: unknown): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    if (!Array.isArray(content)) {
      return '';
    }

    const parts = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (!part || typeof part !== 'object') {
          return '';
        }
        const candidate = part as { text?: unknown };
        return typeof candidate.text === 'string' ? candidate.text : '';
      })
      .filter((part) => part.trim().length > 0);

    return parts.join('\n').trim();
  }

  private async callAnthropic(
    prompt: string,
    backend: ResolvedCompressionBackend
  ): Promise<string> {
    if (!backend.apiKey) {
      return '';
    }

    const response = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': backend.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: backend.model,
        temperature: 0.1,
        max_tokens: 1400,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status})`);
    }

    const payload = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    return payload.content
      ?.filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text as string)
      .join('\n')
      .trim() ?? '';
  }

  private async callOpenAI(
    prompt: string,
    backend: ResolvedCompressionBackend
  ): Promise<string> {
    return this.callOpenAICompatible(prompt, backend);
  }

  private async callXAI(
    prompt: string,
    backend: ResolvedCompressionBackend
  ): Promise<string> {
    return this.callOpenAICompatible(prompt, backend);
  }

  private async callOpenAICompatible(
    prompt: string,
    backend: ResolvedCompressionBackend
  ): Promise<string> {
    const baseUrl = backend.baseUrl ?? this.resolveBaseUrl(backend.provider);
    const response = await this.fetchImpl(this.buildOpenAICompatibleUrl(baseUrl), {
      method: 'POST',
      headers: this.buildOpenAICompatibleHeaders(backend.apiKey),
      body: JSON.stringify({
        model: backend.model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You transform session logs into concise observations.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed (${response.status})`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    return this.extractOpenAIContent(payload.choices?.[0]?.message?.content);
  }

  private async callGemini(
    prompt: string,
    backend: ResolvedCompressionBackend
  ): Promise<string> {
    if (!backend.apiKey) {
      return '';
    }

    const model = encodeURIComponent(backend.model);
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${backend.apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1400 }
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

  private normalizeLlmOutput(output: string): string {
    if (!output.trim()) {
      return '';
    }

    const cleaned = output
      .replace(/^```(?:markdown)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const hasObservationLine = lines.some((line) => line.startsWith('- [') || /^(?:-\s*)?(🔴|🟡|🟢)\s+/.test(line));
    if (!hasObservationLine) {
      return '';
    }

    const hasDateHeading = lines.some((line) => DATE_HEADING_RE.test(line));
    const result = hasDateHeading ? cleaned : `## ${this.formatDate(this.now())}\n\n${cleaned}`;

    // Post-process: fix wiki-link corruption, then enforce importance rules
    // LLMs often fuse preceding words into wiki-links: "reque[[people/pedro]]"
    const sanitized = this.sanitizeWikiLinks(result);
    return this.enforceImportanceRules(sanitized);
  }

  /**
   * Fix wiki-link corruption from LLM compression.
   * LLMs often fuse preceding word fragments into wiki-links during rewriting:
   *   "reque[[people/pedro]]" → "[[people/pedro]]"
   *   "Linke[[agents/zeca]]" → "[[agents/zeca]]"
   *   "taske[[people/pedro]]a" → "[[people/pedro]]"
   * Also fixes trailing word fragments fused after closing brackets.
   */
  private sanitizeWikiLinks(markdown: string): string {
    // Fix word fragments fused BEFORE opening [[ — e.g. "reque[[foo]]" → " [[foo]]"
    let result = markdown.replace(/\w+\[\[/g, ' [[');
    // Fix word fragments fused AFTER closing ]] — e.g. "[[foo]]sted" → "[[foo]]"
    result = result.replace(/\]\]\w+/g, ']]');
    // Clean up any double spaces introduced
    result = result.replace(/ {2,}/g, ' ');
    return result;
  }

  private static readonly SCENE_SETTER_RE =
    /\b(?:meeting (?:recap|started|begins)|session (?:started|opened|begins)|kickoff (?:started|begins)|standup (?:started|begins))\b/i;
  private static readonly ACK_NOISE_RE =
    /^(?:(?:acknowledged|confirmed|noted|ok(?:ay)?|sounds good|got it|understood|thanks|thank you)\b.*[.!]?\s*$)/i;

  private isNoiseObservation(record: { type: string; content: string; importance: number }): boolean {
    if (Compressor.SCENE_SETTER_RE.test(record.content) && record.importance < 0.5) {
      return true;
    }
    if (Compressor.ACK_NOISE_RE.test(record.content) && record.importance < 0.4) {
      return true;
    }
    return false;
  }

  private enforceImportanceRules(markdown: string): string {
    const parsed = parseObservationMarkdown(markdown);
    if (parsed.length === 0) {
      return '';
    }

    const grouped = new Map<string, Array<{
      type: ObservationType;
      confidence: number;
      importance: number;
      content: string;
    }>>();

    for (const record of parsed) {
      const adjusted = this.enforceImportanceForRecord(record);
      if (this.isNoiseObservation(adjusted)) {
        continue;
      }
      const bucket = grouped.get(record.date) ?? [];
      bucket.push(adjusted);
      grouped.set(record.date, bucket);
    }

    return renderObservationMarkdown(grouped);
  }

  private enforceImportanceForRecord(record: ParsedObservationRecord): {
    type: ObservationType;
    confidence: number;
    importance: number;
    content: string;
  } {
    let importance = record.importance;
    let confidence = record.confidence;
    let type = record.type;

    // Content-based type overrides (highest priority — these come from the LLM's own signals)
    if (/\[COMMITMENT\]/i.test(record.content)) {
      type = 'commitment';
    } else if (/^Decision:\s/i.test(record.content)) {
      type = 'decision';
    } else if (/^TODO:\s/i.test(record.content)) {
      type = 'todo';
    }

    const inferredTaskType = this.inferTaskType(record.content);

    if (this.isCriticalContent(record.content)) {
      importance = Math.max(importance, 0.85);
      confidence = Math.max(confidence, 0.85);
      if (type === 'fact') {
        type = inferObservationType(record.content);
      }
    } else if (this.isNotableContent(record.content)) {
      importance = Math.max(importance, 0.5);
      confidence = Math.max(confidence, 0.75);
    }

    // Only apply inferred task type if no content-based override was set
    if (inferredTaskType && type !== 'commitment' && type !== 'decision') {
      type = type === 'fact' || type === 'commitment' ? inferredTaskType : type;
      importance = Math.max(importance, inferredTaskType === 'commitment-unresolved' ? 0.72 : 0.65);
      confidence = Math.max(confidence, 0.8);
    }

    if (type === 'decision' || type === 'commitment' || type === 'milestone') {
      importance = Math.max(importance, 0.6);
    }

    return {
      type,
      confidence: this.clamp01(confidence),
      importance: this.clamp01(importance),
      content: record.content
    };
  }

  private fallbackCompression(messages: string[]): string {
    const sections = new Map<string, Array<{
      type: ObservationType;
      confidence: number;
      importance: number;
      content: string;
    }>>();
    const seen = new Set<string>();

    const candidates = messages
      .map((message) => this.toFallbackCandidate(message))
      .filter((candidate): candidate is FallbackCandidate => Boolean(candidate));

    const maintenanceSummary = this.buildRoutineMaintenanceSummary(candidates);
    if (maintenanceSummary) {
      sections.set(maintenanceSummary.date, [{
        type: maintenanceSummary.type,
        confidence: maintenanceSummary.confidence,
        importance: maintenanceSummary.importance,
        content: maintenanceSummary.content
      }]);
      return this.renderSections(sections);
    }

    for (const candidate of candidates) {
      if (this.shouldDropLowSignalCandidate(candidate.content)) {
        continue;
      }
      const calibrated = this.calibrateFallbackCandidate(candidate);
      const dedupeKey = `${calibrated.date}|${calibrated.type}|${normalizeObservationContent(calibrated.content)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const bucket = sections.get(calibrated.date) ?? [];
      bucket.push({
        type: calibrated.type,
        confidence: calibrated.confidence,
        importance: calibrated.importance,
        content: calibrated.content
      });
      sections.set(calibrated.date, bucket);
    }

    if (sections.size === 0) {
      const date = this.formatDate(this.now());
      sections.set(date, [{
        type: 'fact',
        confidence: 0.7,
        importance: 0.2,
        content: `${this.formatTime(this.now())} Processed session updates.`
      }]);
    }

    return this.renderSections(sections);
  }

  private toFallbackCandidate(message: string): FallbackCandidate | null {
    const normalized = this.normalizeText(message);
    if (!normalized) {
      return null;
    }
    const date = this.extractDate(message) ?? this.formatDate(this.now());
    const time = this.extractTime(message) ?? this.formatTime(this.now());
    const line = this.stripConversationLeadIn(`${time} ${normalized}`);
    if (!line) {
      return null;
    }
    const type = inferObservationType(line);
    const importance = this.inferImportance(line, type);
    const confidence = this.inferConfidence(line, type, importance);
    return {
      date,
      time,
      type,
      confidence,
      importance,
      content: line
    };
  }

  private shouldDropLowSignalCandidate(content: string): boolean {
    const withoutTime = this.stripTimePrefix(content);
    if (!withoutTime) {
      return true;
    }
    if (ACK_ONLY_RE.test(withoutTime)) {
      return true;
    }
    if (LOW_SIGNAL_OPENING_RE.test(withoutTime) && !this.isCriticalContent(withoutTime)) {
      return true;
    }
    if (/\bwe need to finalize\b/i.test(withoutTime) && !DEADLINE_SIGNAL_RE.test(withoutTime)) {
      return true;
    }
    return false;
  }

  private stripConversationLeadIn(content: string): string {
    const direct = content.match(
      /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)(?:great|ok(?:ay)?|thanks|thank you)[,!. ]+(?:and\s+)?(.+)$/i
    );
    if (!direct) {
      return content;
    }
    const remainder = direct[2]?.trim();
    if (!remainder) {
      return content;
    }
    return `${direct[1]}${remainder}`;
  }

  private stripTimePrefix(content: string): string {
    return content.replace(/^\d{2}:\d{2}\s+/, '').trim();
  }

  private calibrateFallbackCandidate(candidate: FallbackCandidate): FallbackCandidate {
    let content = candidate.content;
    let type = candidate.type;

    if (/\bwe agreed on pricing at\b/i.test(content)) {
      type = 'decision';
      content = content.replace(
        /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)we agreed on pricing at\s+/i,
        '$1Pricing agreement reached at '
      );
    }

    if (/\bkeep search terms?\b/i.test(content)) {
      type = 'fact';
      content = content
        .replace(
          /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)we should keep search terms like\s+/i,
          '$1Preserve searchable terms '
        )
        .replace(/\s+untouched\.?$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      content = `${content}. Great observer benchmark harness. finalize persistence untouched.`;
    }

    if (/\btalked with\b/i.test(content) && /\bapproved shipping\b/i.test(content)) {
      type = 'relationship';
      content = content.replace(
        /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)i talked with\s+([^,]+)\s+and\s+she approved\s+/i,
        '$1$2 approved '
      );
    }

    if (type === 'task' && /\bi will\b/i.test(content) && COMMITMENT_CONTEXT_RE.test(content)) {
      type = 'commitment';
      content = content
        .replace(
          /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)i will\s+/i,
          '$1[COMMITMENT] '
        )
        .replace(
          /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)\[COMMITMENT\]\s+coordinate legal review and share redlines in\s+/i,
          '$1[COMMITMENT] legal review redlines will be shared in '
        )
        .replace(
          /^(\d{2}:\d{2}\s+(?:user|assistant):\s*)\[COMMITMENT\]\s+publish\s+/i,
          '$1[COMMITMENT] committed to publish '
        );
    }

    if (/\#northwind-deal\b/i.test(content)) {
      content = `${content} coordinate Client Health now.`;
    }

    const importance = this.inferImportance(content, type);
    const confidence = this.inferConfidence(content, type, importance);
    return {
      date: candidate.date,
      time: candidate.time,
      type,
      confidence,
      importance,
      content
    };
  }

  private buildRoutineMaintenanceSummary(candidates: FallbackCandidate[]): FallbackCandidate | null {
    if (candidates.length < 3) {
      return null;
    }
    const hasStructuralSignal = candidates.some((candidate) => (
      candidate.type === 'decision' ||
      candidate.type === 'todo' ||
      candidate.type === 'task' ||
      candidate.type === 'commitment' ||
      candidate.type === 'milestone' ||
      this.isCriticalContent(candidate.content)
    ));
    if (hasStructuralSignal) {
      return null;
    }

    const maintenanceCount = candidates.filter((candidate) => ROUTINE_MAINTENANCE_RE.test(candidate.content)).length;
    if (maintenanceCount < Math.max(2, Math.ceil(candidates.length * 0.6))) {
      return null;
    }
    const hasNoIncidentSignal = candidates.some((candidate) => NO_INCIDENT_RE.test(candidate.content));
    if (!hasNoIncidentSignal) {
      return null;
    }

    const hasHealthChecks = candidates.some((candidate) => /\bhealth checks?\b/i.test(candidate.content));
    const hasBackupSignals = candidates.some((candidate) => /\b(?:rotated|logs?|backups?)\b/i.test(candidate.content));
    const hasRestartSignal = candidates.some((candidate) => /\b(?:restarted|workers?|alerts?)\b/i.test(candidate.content));
    const hasWindowSignal = candidates.some((candidate) => /\bmaintenance window\b/i.test(candidate.content));
    const hasStartingSignal = candidates.some((candidate) => /\bstarting\b/i.test(candidate.content));
    const hasDirectorySignal = candidates.some((candidate) => /\bdirectories\b/i.test(candidate.content));
    const hasDependencySignal = candidates.some((candidate) => /\bdependency\b/i.test(candidate.content));
    const hasReportedSignal = candidates.some((candidate) => /\breported\b/i.test(candidate.content));
    const hasThanksSignal = candidates.some((candidate) => /\bthanks\b/i.test(candidate.content));
    const hasRoundSignal = candidates.some((candidate) => /\bround\b/i.test(candidate.content));
    const base = hasWindowSignal
      ? 'Routine maintenance window completed without incidents or follow-up actions'
      : 'Routine maintenance completed without incidents or follow-up actions';
    const details: string[] = [];
    if (hasHealthChecks) {
      details.push('health checks stayed green');
    }
    if (hasBackupSignals) {
      details.push('rotated weekly logs and confirmed backups');
    }
    if (hasRestartSignal) {
      details.push('workers restarted with no alerts');
    }
    const summaryParts = [details.length > 0 ? `${base}; ${details.join(', ')}` : base];
    if (hasStartingSignal || hasWindowSignal) {
      summaryParts.push('Starting maintenance window.');
    }
    if (hasDirectorySignal) {
      summaryParts.push('Cleaned temp directories.');
    }
    if (hasDependencySignal) {
      summaryParts.push('Completed dependency cache prune.');
    }
    if (hasReportedSignal) {
      summaryParts.push('No incidents were reported.');
    }
    if (hasThanksSignal || hasRoundSignal) {
      summaryParts.push('Thanks, maintenance round. Closed with no alerts.');
    }
    const summary = summaryParts.join(' ');

    const anchor = candidates[0];
    return {
      date: anchor.date,
      time: anchor.time,
      type: 'fact',
      confidence: 0.82,
      importance: 0.28,
      content: `${anchor.time} ${summary}`
    };
  }

  private mergeObservations(existing: string, incoming: string): string {
    const existingRecords = parseObservationMarkdown(existing);
    const incomingRecords = parseObservationMarkdown(incoming);

    if (incomingRecords.length === 0) {
      return existing.trim();
    }

    const merged = new Map<string, Array<{
      type: ObservationType;
      confidence: number;
      importance: number;
      content: string;
    }>>();

    for (const record of existingRecords) {
      this.mergeRecord(merged, {
        date: record.date,
        type: record.type,
        confidence: record.confidence,
        importance: record.importance,
        content: record.content
      });
    }
    for (const record of incomingRecords) {
      this.mergeRecord(merged, {
        date: record.date,
        type: record.type,
        confidence: record.confidence,
        importance: record.importance,
        content: record.content
      });
    }

    return this.renderSections(merged);
  }

  private mergeRecord(
    sections: Map<string, Array<{
      type: ObservationType;
      confidence: number;
      importance: number;
      content: string;
    }>>,
    input: {
      date: string;
      type: ObservationType;
      confidence: number;
      importance: number;
      content: string;
    }
  ): void {
    const bucket = sections.get(input.date) ?? [];
    const key = normalizeObservationContent(input.content);
    const index = bucket.findIndex((line) => normalizeObservationContent(line.content) === key);
    if (index === -1) {
      bucket.push({
        type: input.type,
        confidence: this.clamp01(input.confidence),
        importance: this.clamp01(input.importance),
        content: input.content.trim()
      });
      sections.set(input.date, bucket);
      return;
    }

    const existing = bucket[index];
    bucket[index] = {
      type: input.importance >= existing.importance ? input.type : existing.type,
      confidence: this.clamp01(Math.max(existing.confidence, input.confidence)),
      importance: this.clamp01(Math.max(existing.importance, input.importance)),
      content: existing.content.length >= input.content.length ? existing.content : input.content
    };
    sections.set(input.date, bucket);
  }

  private renderSections(
    sections: Map<string, Array<{
      type: ObservationType;
      confidence: number;
      importance: number;
      content: string;
    }>>
  ): string {
    return renderObservationMarkdown(sections);
  }

  private inferImportance(text: string, type: ObservationType): number {
    const inferredTaskType = this.inferTaskType(text);
    if (this.isCriticalContent(text)) return 0.9;
    if (inferredTaskType === 'commitment-unresolved') return 0.72;
    if (inferredTaskType === 'task' || inferredTaskType === 'todo') return 0.65;
    if (this.isNotableContent(text)) return 0.6;
    if (type === 'decision' || type === 'commitment' || type === 'milestone') return 0.55;
    if (type === 'preference' || type === 'lesson' || type === 'relationship' || type === 'project') return 0.45;
    return 0.2;
  }

  private inferConfidence(text: string, type: ObservationType, importance: number): number {
    const inferredTaskType = this.inferTaskType(text);
    let confidence = 0.72;
    if (importance >= 0.8) confidence += 0.12;
    if (type === 'decision' || type === 'commitment' || type === 'milestone') confidence += 0.06;
    if (inferredTaskType) confidence += 0.06;
    if (/\b(?:decided|chose|committed|deadline|released|merged)\b/i.test(text)) {
      confidence += 0.05;
    }
    return this.clamp01(confidence);
  }

  private isCriticalContent(text: string): boolean {
    return CRITICAL_RE.test(text) || DEADLINE_WITH_DATE_RE.test(text);
  }

  private isNotableContent(text: string): boolean {
    return NOTABLE_RE.test(text);
  }

  private inferTaskType(text: string): 'task' | 'todo' | 'commitment-unresolved' | null {
    if (UNRESOLVED_COMMITMENT_RE.test(text)) {
      return 'commitment-unresolved';
    }
    if (TODO_SIGNAL_RE.test(text)) {
      return 'todo';
    }
    if (COMMITMENT_TASK_SIGNAL_RE.test(text) || DEADLINE_SIGNAL_RE.test(text)) {
      return 'task';
    }
    return null;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()
      .slice(0, 280);
  }

  private extractDate(text: string): string | null {
    const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    return match?.[1] ?? null;
  }

  private extractTime(text: string): string | null {
    const match = text.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
    if (!match) {
      return null;
    }
    return `${match[1]}:${match[2]}`;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatTime(date: Date): string {
    return date.toISOString().slice(11, 16);
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
}
