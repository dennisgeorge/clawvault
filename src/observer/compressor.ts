export interface CompressorOptions {
  model?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

type Priority = '🔴' | '🟡' | '🟢';

interface ObservationLine {
  priority: Priority;
  content: string;
}

const DATE_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const OBSERVATION_LINE_RE = /^(🔴|🟡|🟢)\s+(.+)$/u;
const CRITICAL_RE =
  /\b(decid(?:e|ed|ing|ion)|error|fail(?:ed|ure)?|prefer(?:ence)?|block(?:ed|er)?|must|required?|urgent)\b/i;
const NOTABLE_RE = /\b(context|pattern|architecture|approach|trade[- ]?off|milestone|notable)\b/i;

export class Compressor {
  private readonly model?: string;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CompressorOptions = {}) {
    this.model = options.model;
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async compress(messages: string[], existingObservations: string): Promise<string> {
    const cleanedMessages = messages.map((message) => message.trim()).filter(Boolean);
    if (cleanedMessages.length === 0) {
      return existingObservations.trim();
    }

    const prompt = this.buildPrompt(cleanedMessages, existingObservations);
    const provider = this.resolveProvider();

    if (provider) {
      try {
        const llmOutput = provider === 'anthropic'
          ? await this.callAnthropic(prompt)
          : provider === 'gemini'
          ? await this.callGemini(prompt)
          : await this.callOpenAI(prompt);
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

  private resolveProvider(): 'anthropic' | 'openai' | 'gemini' | null {
    if (process.env.ANTHROPIC_API_KEY) {
      return 'anthropic';
    }
    if (process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    if (process.env.GEMINI_API_KEY) {
      return 'gemini';
    }
    return null;
  }

  private buildPrompt(messages: string[], existingObservations: string): string {
    return [
      'You are an observer that compresses raw AI session messages into durable observations.',
      '',
      'Rules:',
      '- Output markdown only.',
      '- Group observations by date heading: ## YYYY-MM-DD',
      '- Each line must follow: <emoji> <HH:MM> <observation>',
      '- Priority emojis: 🔴 critical, 🟡 notable, 🟢 info',
      '- Mark decisions, errors, user preferences, and blockers as 🔴',
      '- Keep observations concise and factual.',
      '- Avoid duplicates when possible.',
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

  private async callAnthropic(prompt: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return '';
    }

    const response = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model ?? 'claude-3-5-haiku-latest',
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

  private async callOpenAI(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return '';
    }

    const response = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.model ?? 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You transform session logs into concise observations.' },
          { role: 'user', content: prompt }
        ]
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

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return '';
    }

    const model = this.model ?? 'gemini-2.0-flash';
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    const hasObservationLine = lines.some((line) => OBSERVATION_LINE_RE.test(line));
    if (!hasObservationLine) {
      return '';
    }

    const hasDateHeading = lines.some((line) => DATE_HEADING_RE.test(line));
    if (hasDateHeading) {
      return cleaned;
    }

    const today = this.formatDate(this.now());
    return `## ${today}\n\n${cleaned}`;
  }

  private fallbackCompression(messages: string[]): string {
    const sections = new Map<string, ObservationLine[]>();
    const seen = new Set<string>();

    for (const message of messages) {
      const normalized = this.normalizeText(message);
      if (!normalized) continue;

      const date = this.extractDate(message) ?? this.formatDate(this.now());
      const time = this.extractTime(message) ?? this.formatTime(this.now());
      const priority = this.inferPriority(normalized);
      const line = `${time} ${normalized}`;
      const dedupeKey = `${date}|${priority}|${this.normalizeText(line)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const bucket = sections.get(date) ?? [];
      bucket.push({ priority, content: line });
      sections.set(date, bucket);
    }

    if (sections.size === 0) {
      const date = this.formatDate(this.now());
      sections.set(date, [{ priority: '🟢', content: `${this.formatTime(this.now())} Processed session updates.` }]);
    }

    return this.renderSections(sections);
  }

  private mergeObservations(existing: string, incoming: string): string {
    const existingSections = this.parseSections(existing);
    const incomingSections = this.parseSections(incoming);

    if (incomingSections.size === 0) {
      return existing.trim();
    }

    if (existingSections.size === 0) {
      return this.renderSections(incomingSections);
    }

    for (const [date, lines] of incomingSections.entries()) {
      const current = existingSections.get(date) ?? [];
      current.push(...lines);
      existingSections.set(date, current);
    }

    return this.renderSections(existingSections);
  }

  private parseSections(markdown: string): Map<string, ObservationLine[]> {
    const sections = new Map<string, ObservationLine[]>();
    let currentDate: string | null = null;

    for (const rawLine of markdown.split(/\r?\n/)) {
      const dateMatch = rawLine.match(DATE_HEADING_RE);
      if (dateMatch) {
        currentDate = dateMatch[1];
        if (!sections.has(currentDate)) {
          sections.set(currentDate, []);
        }
        continue;
      }

      if (!currentDate) continue;
      const lineMatch = rawLine.match(OBSERVATION_LINE_RE);
      if (!lineMatch) continue;

      const bucket = sections.get(currentDate) ?? [];
      bucket.push({
        priority: lineMatch[1] as Priority,
        content: lineMatch[2].trim()
      });
      sections.set(currentDate, bucket);
    }

    return sections;
  }

  private renderSections(sections: Map<string, ObservationLine[]>): string {
    const chunks: string[] = [];
    const sortedDates = [...sections.keys()].sort((a, b) => a.localeCompare(b));

    for (const date of sortedDates) {
      const lines = sections.get(date) ?? [];
      if (lines.length === 0) continue;
      chunks.push(`## ${date}`);
      chunks.push('');
      for (const line of lines) {
        chunks.push(`${line.priority} ${line.content}`);
      }
      chunks.push('');
    }

    return chunks.join('\n').trim();
  }

  private inferPriority(text: string): Priority {
    if (CRITICAL_RE.test(text)) return '🔴';
    if (NOTABLE_RE.test(text)) return '🟡';
    return '🟢';
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\[[^\]]+\]/g, '')
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
}
