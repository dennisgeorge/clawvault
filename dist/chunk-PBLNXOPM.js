// src/observer/compressor.ts
var DATE_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
var OBSERVATION_LINE_RE = /^(🔴|🟡|🟢)\s+(.+)$/u;
var CRITICAL_RE = /\b(decid(?:e|ed|ing|ion)|error|fail(?:ed|ure)?|prefer(?:ence)?|block(?:ed|er)?|must|required?|urgent)\b/i;
var NOTABLE_RE = /\b(context|pattern|architecture|approach|trade[- ]?off|milestone|notable)\b/i;
var Compressor = class {
  model;
  now;
  fetchImpl;
  constructor(options = {}) {
    this.model = options.model;
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  async compress(messages, existingObservations) {
    const cleanedMessages = messages.map((message) => message.trim()).filter(Boolean);
    if (cleanedMessages.length === 0) {
      return existingObservations.trim();
    }
    const prompt = this.buildPrompt(cleanedMessages, existingObservations);
    const provider = this.resolveProvider();
    if (provider) {
      try {
        const llmOutput = provider === "anthropic" ? await this.callAnthropic(prompt) : provider === "gemini" ? await this.callGemini(prompt) : await this.callOpenAI(prompt);
        const normalized = this.normalizeLlmOutput(llmOutput);
        if (normalized) {
          return this.mergeObservations(existingObservations, normalized);
        }
      } catch {
      }
    }
    const fallback = this.fallbackCompression(cleanedMessages);
    return this.mergeObservations(existingObservations, fallback);
  }
  resolveProvider() {
    if (process.env.ANTHROPIC_API_KEY) {
      return "anthropic";
    }
    if (process.env.OPENAI_API_KEY) {
      return "openai";
    }
    if (process.env.GEMINI_API_KEY) {
      return "gemini";
    }
    return null;
  }
  buildPrompt(messages, existingObservations) {
    return [
      "You are an observer that compresses raw AI session messages into durable observations.",
      "",
      "Rules:",
      "- Output markdown only.",
      "- Group observations by date heading: ## YYYY-MM-DD",
      "- Each line must follow: <emoji> <HH:MM> <observation>",
      "- Priority emojis: \u{1F534} critical, \u{1F7E1} notable, \u{1F7E2} info",
      "- Mark decisions, errors, user preferences, and blockers as \u{1F534}",
      "- Keep observations concise and factual.",
      "- Avoid duplicates when possible.",
      "",
      "Existing observations (may be empty):",
      existingObservations.trim() || "(none)",
      "",
      "Raw messages:",
      ...messages.map((message, index) => `[${index + 1}] ${message}`),
      "",
      "Return only the updated observation markdown."
    ].join("\n");
  }
  async callAnthropic(prompt) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return "";
    }
    const response = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.model ?? "claude-3-5-haiku-latest",
        temperature: 0.1,
        max_tokens: 1400,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status})`);
    }
    const payload = await response.json();
    return payload.content?.filter((part) => part.type === "text" && part.text).map((part) => part.text).join("\n").trim() ?? "";
  }
  async callOpenAI(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return "";
    }
    const response = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.model ?? "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: "You transform session logs into concise observations." },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status})`);
    }
    const payload = await response.json();
    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  }
  async callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return "";
    }
    const model = this.model ?? "gemini-2.0-flash";
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1400 }
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Gemini request failed (${response.status})`);
    }
    const payload = await response.json();
    return payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }
  normalizeLlmOutput(output) {
    if (!output.trim()) {
      return "";
    }
    const cleaned = output.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```$/, "").trim();
    const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const hasObservationLine = lines.some((line) => OBSERVATION_LINE_RE.test(line));
    if (!hasObservationLine) {
      return "";
    }
    const hasDateHeading = lines.some((line) => DATE_HEADING_RE.test(line));
    if (hasDateHeading) {
      return cleaned;
    }
    const today = this.formatDate(this.now());
    return `## ${today}

${cleaned}`;
  }
  fallbackCompression(messages) {
    const sections = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
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
      sections.set(date, [{ priority: "\u{1F7E2}", content: `${this.formatTime(this.now())} Processed session updates.` }]);
    }
    return this.renderSections(sections);
  }
  mergeObservations(existing, incoming) {
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
  parseSections(markdown) {
    const sections = /* @__PURE__ */ new Map();
    let currentDate = null;
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
        priority: lineMatch[1],
        content: lineMatch[2].trim()
      });
      sections.set(currentDate, bucket);
    }
    return sections;
  }
  renderSections(sections) {
    const chunks = [];
    const sortedDates = [...sections.keys()].sort((a, b) => a.localeCompare(b));
    for (const date of sortedDates) {
      const lines = sections.get(date) ?? [];
      if (lines.length === 0) continue;
      chunks.push(`## ${date}`);
      chunks.push("");
      for (const line of lines) {
        chunks.push(`${line.priority} ${line.content}`);
      }
      chunks.push("");
    }
    return chunks.join("\n").trim();
  }
  inferPriority(text) {
    if (CRITICAL_RE.test(text)) return "\u{1F534}";
    if (NOTABLE_RE.test(text)) return "\u{1F7E1}";
    return "\u{1F7E2}";
  }
  normalizeText(text) {
    return text.replace(/\s+/g, " ").replace(/\[[^\]]+\]/g, "").trim().slice(0, 280);
  }
  extractDate(text) {
    const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    return match?.[1] ?? null;
  }
  extractTime(text) {
    const match = text.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
    if (!match) {
      return null;
    }
    return `${match[1]}:${match[2]}`;
  }
  formatDate(date) {
    return date.toISOString().split("T")[0];
  }
  formatTime(date) {
    return date.toISOString().slice(11, 16);
  }
};

// src/observer/reflector.ts
var DATE_HEADING_RE2 = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
var OBSERVATION_LINE_RE2 = /^(🔴|🟡|🟢)\s+(.+)$/u;
var Reflector = class {
  now;
  constructor(options = {}) {
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  reflect(observations) {
    const sections = this.parseSections(observations);
    if (sections.size === 0) {
      return observations.trim();
    }
    const cutoff = this.buildCutoffDate();
    const dedupeKeys = [];
    const reflected = /* @__PURE__ */ new Map();
    const dates = [...sections.keys()].sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      const sectionDate = this.parseDate(date);
      const olderThanCutoff = sectionDate ? sectionDate.getTime() < cutoff.getTime() : false;
      const lines = sections.get(date) ?? [];
      const kept = [];
      for (const line of lines) {
        if (line.priority === "\u{1F534}") {
          kept.push(line);
          continue;
        }
        if (line.priority === "\u{1F7E2}" && olderThanCutoff) {
          continue;
        }
        const key = this.normalizeText(line.content);
        const isDuplicate = dedupeKeys.some((existing) => this.isSimilar(existing, key));
        if (isDuplicate) {
          continue;
        }
        dedupeKeys.push(key);
        kept.push(line);
      }
      if (kept.length > 0) {
        reflected.set(date, kept);
      }
    }
    return this.renderSections(reflected);
  }
  buildCutoffDate() {
    const cutoff = new Date(this.now());
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 7);
    return cutoff;
  }
  parseDate(date) {
    const parsed = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }
  parseSections(markdown) {
    const sections = /* @__PURE__ */ new Map();
    let currentDate = null;
    for (const rawLine of markdown.split(/\r?\n/)) {
      const dateMatch = rawLine.match(DATE_HEADING_RE2);
      if (dateMatch) {
        currentDate = dateMatch[1];
        if (!sections.has(currentDate)) {
          sections.set(currentDate, []);
        }
        continue;
      }
      if (!currentDate) continue;
      const lineMatch = rawLine.match(OBSERVATION_LINE_RE2);
      if (!lineMatch) continue;
      const bucket = sections.get(currentDate) ?? [];
      bucket.push({
        priority: lineMatch[1],
        content: lineMatch[2].trim()
      });
      sections.set(currentDate, bucket);
    }
    return sections;
  }
  renderSections(sections) {
    const chunks = [];
    const dates = [...sections.keys()].sort((a, b) => a.localeCompare(b));
    for (const date of dates) {
      const lines = sections.get(date) ?? [];
      if (lines.length === 0) continue;
      chunks.push(`## ${date}`);
      chunks.push("");
      for (const line of lines) {
        chunks.push(`${line.priority} ${line.content}`);
      }
      chunks.push("");
    }
    return chunks.join("\n").trim();
  }
  normalizeText(text) {
    return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s:.-]/g, "").trim();
  }
  isSimilar(a, b) {
    if (a === b) return true;
    if (a.length >= 24 && (a.includes(b) || b.includes(a))) {
      return true;
    }
    return false;
  }
};

// src/observer/observer.ts
import * as fs2 from "fs";
import * as path2 from "path";

// src/observer/router.ts
import * as fs from "fs";
import * as path from "path";
var CATEGORY_PATTERNS = [
  {
    category: "decisions",
    patterns: [
      /\b(decid(?:e|ed|ing|ion)|chose|picked|went with|selected|opted)\b/i,
      /\b(decision|trade[- ]?off|alternative|rationale)\b/i
    ]
  },
  {
    category: "lessons",
    patterns: [
      /\b(learn(?:ed|ing|t)|lesson|mistake|insight|realized|discovered)\b/i,
      /\b(note to self|remember|important|don'?t forget|never again)\b/i
    ]
  },
  {
    category: "people",
    patterns: [
      /\b(said|asked|told|mentioned|emailed|called|messaged|met with)\b/i,
      /\b(client|partner|team|colleague|contact)\b/i
    ]
  },
  {
    category: "preferences",
    patterns: [
      /\b(prefer(?:s|red|ence)?|like(?:s|d)?|want(?:s|ed)?|style|convention)\b/i,
      /\b(always use|never use|default to)\b/i
    ]
  },
  {
    category: "commitments",
    patterns: [
      /\b(promised|committed|deadline|due|scheduled|will do|agreed to)\b/i,
      /\b(todo|task|action item|follow[- ]?up)\b/i
    ]
  },
  {
    category: "projects",
    patterns: [
      /\b(deployed|shipped|launched|released|merged|built|created)\b/i,
      /\b(project|repo|service|api|feature|bug fix)\b/i
    ]
  }
];
var OBSERVATION_LINE_RE3 = /^(🔴|🟡|🟢)\s+(\d{2}:\d{2})?\s*(.+)$/u;
var DATE_HEADING_RE3 = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
var Router = class {
  vaultPath;
  constructor(vaultPath) {
    this.vaultPath = path.resolve(vaultPath);
  }
  /**
   * Takes observation markdown and routes items to appropriate vault categories.
   * Only routes 🔴 and 🟡 items — 🟢 stays only in observations.
   * Returns a summary of what was routed where.
   */
  route(observationMarkdown) {
    const items = this.parseObservations(observationMarkdown);
    const routed = [];
    for (const item of items) {
      if (item.priority === "\u{1F7E2}") continue;
      const category = this.categorize(item.content);
      if (!category) continue;
      const routedItem = { category, title: item.title, content: item.content, priority: item.priority, date: item.date };
      routed.push(routedItem);
      this.appendToCategory(category, routedItem);
    }
    const summary = this.buildSummary(routed);
    return { routed, summary };
  }
  parseObservations(markdown) {
    const results = [];
    let currentDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    for (const line of markdown.split(/\r?\n/)) {
      const dateMatch = line.match(DATE_HEADING_RE3);
      if (dateMatch) {
        currentDate = dateMatch[1];
        continue;
      }
      const obsMatch = line.match(OBSERVATION_LINE_RE3);
      if (!obsMatch) continue;
      const priority = obsMatch[1];
      const content = obsMatch[3].trim();
      const title = content.slice(0, 80).replace(/[^a-zA-Z0-9\s-]/g, "").trim();
      results.push({ priority, content, date: currentDate, title });
    }
    return results;
  }
  categorize(content) {
    for (const { category, patterns } of CATEGORY_PATTERNS) {
      if (patterns.some((p) => p.test(content))) {
        return category;
      }
    }
    return null;
  }
  appendToCategory(category, item) {
    const categoryDir = path.join(this.vaultPath, category);
    fs.mkdirSync(categoryDir, { recursive: true });
    const filePath = path.join(categoryDir, `${item.date}.md`);
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").trim() : "";
    if (existing.includes(item.content)) return;
    const entry = `- ${item.priority} ${item.content}`;
    const header = existing ? "" : `# ${category} \u2014 ${item.date}
`;
    const newContent = existing ? `${existing}
${entry}
` : `${header}
${entry}
`;
    fs.writeFileSync(filePath, newContent, "utf-8");
  }
  buildSummary(routed) {
    if (routed.length === 0) return "No items routed to vault categories.";
    const byCat = /* @__PURE__ */ new Map();
    for (const item of routed) {
      byCat.set(item.category, (byCat.get(item.category) ?? 0) + 1);
    }
    const parts = [...byCat.entries()].map(([cat, count]) => `${cat}: ${count}`);
    return `Routed ${routed.length} observations \u2192 ${parts.join(", ")}`;
  }
};

// src/observer/observer.ts
var Observer = class {
  vaultPath;
  observationsDir;
  tokenThreshold;
  reflectThreshold;
  compressor;
  reflector;
  now;
  router;
  pendingMessages = [];
  observationsCache = "";
  lastRoutingSummary = "";
  constructor(vaultPath, options = {}) {
    this.vaultPath = path2.resolve(vaultPath);
    this.observationsDir = path2.join(this.vaultPath, "observations");
    this.tokenThreshold = options.tokenThreshold ?? 3e4;
    this.reflectThreshold = options.reflectThreshold ?? 4e4;
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.compressor = options.compressor ?? new Compressor({ model: options.model, now: this.now });
    this.reflector = options.reflector ?? new Reflector({ now: this.now });
    this.router = new Router(vaultPath);
    fs2.mkdirSync(this.observationsDir, { recursive: true });
    this.observationsCache = this.readTodayObservations();
  }
  async processMessages(messages) {
    const incoming = messages.map((message) => message.trim()).filter(Boolean);
    if (incoming.length === 0) {
      return;
    }
    this.pendingMessages.push(...incoming);
    const buffered = this.pendingMessages.join("\n");
    if (this.estimateTokens(buffered) < this.tokenThreshold) {
      return;
    }
    const todayPath = this.getObservationPath(this.now());
    const existing = this.readObservationFile(todayPath);
    const compressed = (await this.compressor.compress(this.pendingMessages, existing)).trim();
    this.pendingMessages = [];
    if (!compressed) {
      return;
    }
    this.writeObservationFile(todayPath, compressed);
    this.observationsCache = compressed;
    const { summary } = this.router.route(compressed);
    if (summary) {
      this.lastRoutingSummary = summary;
    }
    await this.reflectIfNeeded();
  }
  /**
   * Force-flush pending messages regardless of threshold.
   * Call this on session end to capture everything.
   */
  async flush() {
    if (this.pendingMessages.length === 0) {
      return { observations: this.observationsCache, routingSummary: this.lastRoutingSummary };
    }
    const todayPath = this.getObservationPath(this.now());
    const existing = this.readObservationFile(todayPath);
    const compressed = (await this.compressor.compress(this.pendingMessages, existing)).trim();
    this.pendingMessages = [];
    if (compressed) {
      this.writeObservationFile(todayPath, compressed);
      this.observationsCache = compressed;
      const { summary } = this.router.route(compressed);
      this.lastRoutingSummary = summary;
      await this.reflectIfNeeded();
    }
    return { observations: this.observationsCache, routingSummary: this.lastRoutingSummary };
  }
  getObservations() {
    this.observationsCache = this.readTodayObservations();
    return this.observationsCache;
  }
  estimateTokens(input) {
    return Math.ceil(input.length / 4);
  }
  getObservationPath(date) {
    const datePart = date.toISOString().split("T")[0];
    return path2.join(this.observationsDir, `${datePart}.md`);
  }
  readTodayObservations() {
    const todayPath = this.getObservationPath(this.now());
    return this.readObservationFile(todayPath);
  }
  readObservationFile(filePath) {
    if (!fs2.existsSync(filePath)) {
      return "";
    }
    return fs2.readFileSync(filePath, "utf-8").trim();
  }
  writeObservationFile(filePath, content) {
    fs2.mkdirSync(path2.dirname(filePath), { recursive: true });
    fs2.writeFileSync(filePath, `${content.trim()}
`, "utf-8");
  }
  getObservationFiles() {
    if (!fs2.existsSync(this.observationsDir)) {
      return [];
    }
    return fs2.readdirSync(this.observationsDir).filter((name) => name.endsWith(".md")).sort((a, b) => a.localeCompare(b)).map((name) => path2.join(this.observationsDir, name));
  }
  readObservationCorpus() {
    const files = this.getObservationFiles();
    if (files.length === 0) {
      return "";
    }
    return files.map((filePath) => this.readObservationFile(filePath)).filter(Boolean).join("\n\n");
  }
  async reflectIfNeeded() {
    const corpus = this.readObservationCorpus();
    if (this.estimateTokens(corpus) < this.reflectThreshold) {
      return;
    }
    for (const filePath of this.getObservationFiles()) {
      const current = this.readObservationFile(filePath);
      if (!current) continue;
      const reflected = this.reflector.reflect(current).trim();
      if (!reflected) {
        fs2.rmSync(filePath, { force: true });
        continue;
      }
      this.writeObservationFile(filePath, reflected);
    }
    this.observationsCache = this.readTodayObservations();
  }
};

// src/observer/session-parser.ts
import * as fs3 from "fs";
import * as path3 from "path";
var JSONL_SAMPLE_LIMIT = 20;
var MARKDOWN_SIGNAL_RE = /^(#{1,6}\s|[-*+]\s|>\s)/;
var MARKDOWN_INLINE_RE = /(\[[^\]]+\]\([^)]+\)|[*_`~])/;
function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}
function extractText(value) {
  if (typeof value === "string") {
    return normalizeText(value);
  }
  if (Array.isArray(value)) {
    const parts = [];
    for (const part of value) {
      const extracted = extractText(part);
      if (extracted) {
        parts.push(extracted);
      }
    }
    return normalizeText(parts.join(" "));
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const record = value;
  if (typeof record.text === "string") {
    return normalizeText(record.text);
  }
  if (typeof record.content === "string") {
    return normalizeText(record.content);
  }
  return "";
}
function normalizeRole(role) {
  if (typeof role !== "string") {
    return "";
  }
  const normalized = role.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized;
}
function isLikelyJsonMessage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value;
  if ("role" in record && "content" in record) {
    return true;
  }
  if (record.type === "message" && record.message && typeof record.message === "object") {
    return true;
  }
  return false;
}
function parseJsonLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return "";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "";
  }
  const entry = parsed;
  if ("role" in entry && "content" in entry) {
    const role = normalizeRole(entry.role);
    const content = extractText(entry.content);
    if (!content) return "";
    return role ? `${role}: ${content}` : content;
  }
  if (entry.type === "message" && entry.message && typeof entry.message === "object") {
    const message = entry.message;
    const role = normalizeRole(message.role);
    const content = extractText(message.content);
    if (!content) return "";
    return role ? `${role}: ${content}` : content;
  }
  return "";
}
function parseJsonLines(raw) {
  const messages = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseJsonLine(trimmed);
    if (parsed) {
      messages.push(parsed);
    }
  }
  return messages;
}
function stripMarkdownSyntax(text) {
  return normalizeText(
    text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`~]/g, "").replace(/<[^>]+>/g, "")
  );
}
function normalizeMarkdownLine(line) {
  return stripMarkdownSyntax(
    line.replace(/^>\s*/, "").replace(/^[-*+]\s+/, "").replace(/^#{1,6}\s+/, "")
  );
}
function parseMarkdown(raw) {
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const blocks = withoutCodeBlocks.split(/\r?\n\s*\r?\n/).map((block) => block.trim()).filter(Boolean);
  const messages = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => normalizeMarkdownLine(line)).filter(Boolean);
    if (lines.length === 0) {
      continue;
    }
    const joined = stripMarkdownSyntax(lines.join(" "));
    if (!joined) continue;
    const roleMatch = /^(user|assistant|system|tool)\s*:?\s*(.+)$/i.exec(joined);
    if (roleMatch) {
      const role = normalizeRole(roleMatch[1]);
      const content = normalizeText(roleMatch[2]);
      if (content) {
        messages.push(`${role}: ${content}`);
      }
      continue;
    }
    messages.push(joined);
  }
  return messages;
}
function parsePlainText(raw) {
  return raw.split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean);
}
function detectSessionFormat(raw, filePath) {
  const nonEmptyLines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (nonEmptyLines.length === 0) {
    return "plain";
  }
  const sample = nonEmptyLines.slice(0, JSONL_SAMPLE_LIMIT);
  const jsonHits = sample.filter((line) => {
    try {
      const parsed = JSON.parse(line);
      return isLikelyJsonMessage(parsed);
    } catch {
      return false;
    }
  }).length;
  if (jsonHits >= Math.max(1, Math.ceil(sample.length * 0.6))) {
    return "jsonl";
  }
  const ext = path3.extname(filePath).toLowerCase();
  if (ext === ".md" || ext === ".markdown") {
    return "markdown";
  }
  const markdownSignals = sample.filter((line) => MARKDOWN_SIGNAL_RE.test(line) || MARKDOWN_INLINE_RE.test(line)).length;
  if (markdownSignals >= Math.max(2, Math.ceil(sample.length * 0.4))) {
    return "markdown";
  }
  return "plain";
}
function parseSessionFile(filePath) {
  const resolved = path3.resolve(filePath);
  const raw = fs3.readFileSync(resolved, "utf-8");
  const format = detectSessionFormat(raw, resolved);
  if (format === "jsonl") {
    const parsed = parseJsonLines(raw);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  if (format === "markdown") {
    const parsed = parseMarkdown(raw);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  return parsePlainText(raw);
}

export {
  Compressor,
  Reflector,
  Observer,
  parseSessionFile
};
