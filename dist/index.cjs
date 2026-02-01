"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ClawVault: () => ClawVault,
  DEFAULT_CATEGORIES: () => DEFAULT_CATEGORIES,
  DEFAULT_CONFIG: () => DEFAULT_CONFIG,
  MEMORY_TYPES: () => MEMORY_TYPES,
  QMD_INSTALL_URL: () => QMD_INSTALL_URL,
  QmdUnavailableError: () => QmdUnavailableError,
  SearchEngine: () => SearchEngine,
  TYPE_TO_CATEGORY: () => TYPE_TO_CATEGORY,
  VERSION: () => VERSION,
  createVault: () => createVault,
  extractTags: () => extractTags,
  extractWikiLinks: () => extractWikiLinks,
  findVault: () => findVault,
  hasQmd: () => hasQmd,
  qmdEmbed: () => qmdEmbed,
  qmdUpdate: () => qmdUpdate
});
module.exports = __toCommonJS(index_exports);

// src/lib/vault.ts
var fs = __toESM(require("fs"), 1);
var path2 = __toESM(require("path"), 1);
var import_gray_matter = __toESM(require("gray-matter"), 1);
var import_glob = require("glob");

// src/types.ts
var DEFAULT_CATEGORIES = [
  "preferences",
  "decisions",
  "patterns",
  "people",
  "projects",
  "goals",
  "transcripts",
  "inbox",
  "templates"
];
var MEMORY_TYPES = [
  "fact",
  "feeling",
  "decision",
  "lesson",
  "commitment",
  "preference",
  "relationship",
  "project"
];
var TYPE_TO_CATEGORY = {
  fact: "facts",
  feeling: "feelings",
  decision: "decisions",
  lesson: "lessons",
  commitment: "commitments",
  preference: "preferences",
  relationship: "people",
  project: "projects"
};
var DEFAULT_CONFIG = {
  categories: DEFAULT_CATEGORIES
};

// src/lib/search.ts
var import_child_process = require("child_process");
var path = __toESM(require("path"), 1);
var QMD_INSTALL_URL = "https://github.com/Versatly/qmd";
var QMD_NOT_INSTALLED_MESSAGE = `qmd is required for search. Install it from ${QMD_INSTALL_URL}`;
var QmdUnavailableError = class extends Error {
  constructor(message = QMD_NOT_INSTALLED_MESSAGE) {
    super(message);
    this.name = "QmdUnavailableError";
  }
};
function ensureJsonArgs(args) {
  return args.includes("--json") ? args : [...args, "--json"];
}
function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function extractJsonPayload(raw) {
  const start = raw.search(/[\[{]/);
  if (start === -1) return null;
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (end <= start) return null;
  return raw.slice(start, end + 1);
}
function parseQmdOutput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const direct = tryParseJson(trimmed);
  const extracted = direct ? null : extractJsonPayload(trimmed);
  const parsed = direct ?? (extracted ? tryParseJson(extracted) : null);
  if (!parsed) {
    throw new Error("qmd returned non-JSON output. Ensure qmd supports --json.");
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object") {
    const candidate = parsed.results ?? parsed.items ?? parsed.data;
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  throw new Error("qmd returned an unexpected JSON shape.");
}
function ensureQmdAvailable() {
  if (!hasQmd()) {
    throw new QmdUnavailableError();
  }
}
function execQmd(args) {
  ensureQmdAvailable();
  const finalArgs = ensureJsonArgs(args);
  try {
    const result = (0, import_child_process.execFileSync)("qmd", finalArgs, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024
      // 10MB
    });
    return parseQmdOutput(result);
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw new QmdUnavailableError();
    }
    const output = [err?.stdout, err?.stderr].filter(Boolean).join("\n");
    if (output) {
      try {
        return parseQmdOutput(output);
      } catch {
      }
    }
    const message = err?.message ? `qmd failed: ${err.message}` : "qmd failed";
    throw new Error(message);
  }
}
function hasQmd() {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    (0, import_child_process.execFileSync)(cmd, ["qmd"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function qmdUpdate(collection) {
  try {
    ensureQmdAvailable();
    const args = ["update"];
    if (collection) {
      args.push("-c", collection);
    }
    (0, import_child_process.execFileSync)("qmd", args, { stdio: "inherit" });
  } catch (err) {
    console.error(`qmd update failed: ${err.message}`);
  }
}
function qmdEmbed(collection) {
  try {
    ensureQmdAvailable();
    const args = ["embed"];
    if (collection) {
      args.push("-c", collection);
    }
    (0, import_child_process.execFileSync)("qmd", args, { stdio: "inherit" });
  } catch (err) {
    console.error(`qmd embed failed: ${err.message}`);
  }
}
var SearchEngine = class {
  documents = /* @__PURE__ */ new Map();
  collection = "clawvault";
  vaultPath = "";
  collectionRoot = "";
  /**
   * Set the collection name (usually vault name)
   */
  setCollection(name) {
    this.collection = name;
  }
  /**
   * Set the vault path for file resolution
   */
  setVaultPath(vaultPath) {
    this.vaultPath = vaultPath;
  }
  /**
   * Set the collection root for qmd:// URI resolution
   */
  setCollectionRoot(root) {
    this.collectionRoot = path.resolve(root);
  }
  /**
   * Add or update a document in the local cache
   * Note: qmd indexing happens via qmd update command
   */
  addDocument(doc) {
    this.documents.set(doc.id, doc);
  }
  /**
   * Remove a document from the local cache
   */
  removeDocument(id) {
    this.documents.delete(id);
  }
  /**
   * No-op for qmd - indexing is managed externally
   */
  rebuildIDF() {
  }
  /**
   * BM25 search via qmd
   */
  search(query, options = {}) {
    const {
      limit = 10,
      minScore = 0,
      category,
      tags,
      fullContent = false
    } = options;
    if (!query.trim()) return [];
    const args = [
      "search",
      query,
      "-n",
      String(limit * 2),
      // Request extra for filtering
      "--json"
    ];
    if (this.collection) {
      args.push("-c", this.collection);
    }
    const qmdResults = execQmd(args);
    return this.convertResults(qmdResults, {
      limit,
      minScore,
      category,
      tags,
      fullContent
    });
  }
  /**
   * Vector/semantic search via qmd vsearch
   */
  vsearch(query, options = {}) {
    const {
      limit = 10,
      minScore = 0,
      category,
      tags,
      fullContent = false
    } = options;
    if (!query.trim()) return [];
    const args = [
      "vsearch",
      query,
      "-n",
      String(limit * 2),
      // Request extra for filtering
      "--json"
    ];
    if (this.collection) {
      args.push("-c", this.collection);
    }
    const qmdResults = execQmd(args);
    return this.convertResults(qmdResults, {
      limit,
      minScore,
      category,
      tags,
      fullContent
    });
  }
  /**
   * Combined search with query expansion (qmd query command)
   */
  query(query, options = {}) {
    const {
      limit = 10,
      minScore = 0,
      category,
      tags,
      fullContent = false
    } = options;
    if (!query.trim()) return [];
    const args = [
      "query",
      query,
      "-n",
      String(limit * 2),
      "--json"
    ];
    if (this.collection) {
      args.push("-c", this.collection);
    }
    const qmdResults = execQmd(args);
    return this.convertResults(qmdResults, {
      limit,
      minScore,
      category,
      tags,
      fullContent
    });
  }
  /**
   * Convert qmd results to ClawVault SearchResult format
   */
  convertResults(qmdResults, options) {
    const { limit = 10, minScore = 0, category, tags, fullContent = false } = options;
    const results = [];
    const maxScore = qmdResults[0]?.score || 1;
    for (const qr of qmdResults) {
      const filePath = this.qmdUriToPath(qr.file);
      const relativePath = this.vaultPath ? path.relative(this.vaultPath, filePath) : filePath;
      const docId = relativePath.replace(/\.md$/, "");
      let doc = this.documents.get(docId);
      const parts = relativePath.split(path.sep);
      const docCategory = parts.length > 1 ? parts[0] : "root";
      if (category && docCategory !== category) continue;
      if (tags && tags.length > 0 && doc) {
        const docTags = new Set(doc.tags);
        if (!tags.some((t) => docTags.has(t))) continue;
      }
      const normalizedScore = maxScore > 0 ? qr.score / maxScore : 0;
      if (normalizedScore < minScore) continue;
      if (!doc) {
        doc = {
          id: docId,
          path: filePath,
          category: docCategory,
          title: qr.title || path.basename(relativePath, ".md"),
          content: fullContent ? "" : "",
          // Content loaded separately if needed
          frontmatter: {},
          links: [],
          tags: [],
          modified: /* @__PURE__ */ new Date()
        };
      }
      results.push({
        document: fullContent ? doc : { ...doc, content: "" },
        score: normalizedScore,
        snippet: this.cleanSnippet(qr.snippet),
        matchedTerms: []
        // qmd doesn't provide this
      });
      if (results.length >= limit) break;
    }
    return results;
  }
  /**
   * Convert qmd:// URI to file path
   */
  qmdUriToPath(uri) {
    if (uri.startsWith("qmd://")) {
      const withoutScheme = uri.slice(6);
      const slashIndex = withoutScheme.indexOf("/");
      if (slashIndex > -1) {
        const relativePath = withoutScheme.slice(slashIndex + 1);
        const root = this.collectionRoot || this.vaultPath;
        if (root) {
          return path.join(root, relativePath);
        }
        return relativePath;
      }
    }
    return uri;
  }
  /**
   * Clean up qmd snippet format
   */
  cleanSnippet(snippet) {
    if (!snippet) return "";
    return snippet.replace(/@@ [-+]?\d+,?\d* @@ \([^)]+\)/g, "").trim().split("\n").slice(0, 3).join("\n").slice(0, 300);
  }
  /**
   * Get all cached documents
   */
  getAllDocuments() {
    return [...this.documents.values()];
  }
  /**
   * Get document count
   */
  get size() {
    return this.documents.size;
  }
  /**
   * Clear the local document cache
   */
  clear() {
    this.documents.clear();
  }
  /**
   * Export documents for persistence
   */
  export() {
    return {
      documents: [...this.documents.values()]
    };
  }
  /**
   * Import from persisted data
   */
  import(data) {
    this.clear();
    for (const doc of data.documents) {
      this.addDocument(doc);
    }
  }
};
function extractWikiLinks(content) {
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
  return matches.map((m) => m.slice(2, -2).toLowerCase());
}
function extractTags(content) {
  const matches = content.match(/#[\w-]+/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

// src/lib/vault.ts
var CONFIG_FILE = ".clawvault.json";
var INDEX_FILE = ".clawvault-index.json";
var ClawVault = class {
  config;
  search;
  initialized = false;
  constructor(vaultPath) {
    this.config = {
      path: path2.resolve(vaultPath),
      name: path2.basename(vaultPath),
      categories: DEFAULT_CATEGORIES,
      qmdCollection: void 0,
      qmdRoot: void 0
    };
    this.search = new SearchEngine();
    this.applyQmdConfig();
  }
  /**
   * Initialize a new vault
   */
  async init(options = {}) {
    const vaultPath = this.config.path;
    this.config = { ...this.config, ...options };
    this.applyQmdConfig();
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
    for (const category of this.config.categories) {
      const catPath = path2.join(vaultPath, category);
      if (!fs.existsSync(catPath)) {
        fs.mkdirSync(catPath, { recursive: true });
      }
    }
    await this.createTemplates();
    const readmePath = path2.join(vaultPath, "README.md");
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, this.generateReadme());
    }
    const configPath = path2.join(vaultPath, CONFIG_FILE);
    const meta = {
      name: this.config.name,
      version: "1.0.0",
      created: (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      categories: this.config.categories,
      documentCount: 0,
      qmdCollection: this.getQmdCollection(),
      qmdRoot: this.getQmdRoot()
    };
    fs.writeFileSync(configPath, JSON.stringify(meta, null, 2));
    if (!hasQmd()) {
      console.warn("qmd not found. Install qmd to enable search.");
    }
    this.initialized = true;
  }
  /**
   * Load an existing vault
   */
  async load() {
    const vaultPath = this.config.path;
    const configPath = path2.join(vaultPath, CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Not a ClawVault: ${vaultPath} (missing ${CONFIG_FILE})`);
    }
    const meta = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    this.config.name = meta.name;
    this.config.categories = meta.categories;
    this.config.qmdCollection = meta.qmdCollection;
    this.config.qmdRoot = meta.qmdRoot;
    if (!meta.qmdCollection || !meta.qmdRoot) {
      meta.qmdCollection = meta.qmdCollection || meta.name;
      meta.qmdRoot = meta.qmdRoot || this.config.path;
      fs.writeFileSync(configPath, JSON.stringify(meta, null, 2));
    }
    this.applyQmdConfig(meta);
    await this.reindex();
    this.initialized = true;
  }
  /**
   * Reindex all documents
   */
  async reindex() {
    this.search.clear();
    const files = await (0, import_glob.glob)("**/*.md", {
      cwd: this.config.path,
      ignore: ["**/node_modules/**", "**/.*"]
    });
    for (const file of files) {
      const doc = await this.loadDocument(file);
      if (doc) {
        this.search.addDocument(doc);
      }
    }
    await this.saveIndex();
    return this.search.size;
  }
  /**
   * Load a document from disk
   */
  async loadDocument(relativePath) {
    try {
      const fullPath = path2.join(this.config.path, relativePath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const { data: frontmatter, content: body } = (0, import_gray_matter.default)(content);
      const stats = fs.statSync(fullPath);
      const parts = relativePath.split(path2.sep);
      const category = parts.length > 1 ? parts[0] : "root";
      const filename = path2.basename(relativePath, ".md");
      return {
        id: relativePath.replace(/\.md$/, ""),
        path: fullPath,
        category,
        title: frontmatter.title || filename,
        content: body,
        frontmatter,
        links: extractWikiLinks(body),
        tags: extractTags(body),
        modified: stats.mtime
      };
    } catch (err) {
      console.error(`Error loading ${relativePath}:`, err);
      return null;
    }
  }
  /**
   * Store a new document
   */
  async store(options) {
    const {
      category,
      title,
      content,
      frontmatter = {},
      overwrite = false,
      qmdUpdate: triggerUpdate = false,
      qmdEmbed: triggerEmbed = false
    } = options;
    const filename = this.slugify(title) + ".md";
    const relativePath = path2.join(category, filename);
    const fullPath = path2.join(this.config.path, relativePath);
    if (fs.existsSync(fullPath) && !overwrite) {
      throw new Error(`Document already exists: ${relativePath}. Use overwrite: true to replace.`);
    }
    const categoryPath = path2.join(this.config.path, category);
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }
    const fm = {
      title,
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      ...frontmatter
    };
    const fileContent = import_gray_matter.default.stringify(content, fm);
    fs.writeFileSync(fullPath, fileContent);
    const doc = await this.loadDocument(relativePath);
    if (doc) {
      this.search.addDocument(doc);
      await this.saveIndex();
    }
    if (triggerUpdate || triggerEmbed) {
      if (hasQmd()) {
        qmdUpdate(this.getQmdCollection());
        if (triggerEmbed) {
          qmdEmbed(this.getQmdCollection());
        }
      } else {
        console.warn("qmd not found. Skipping index update.");
      }
    }
    return doc;
  }
  /**
   * Quick store to inbox
   */
  async capture(note, title) {
    const autoTitle = title || `note-${Date.now()}`;
    return this.store({
      category: "inbox",
      title: autoTitle,
      content: note
    });
  }
  /**
   * Search the vault (BM25 via qmd)
   */
  async find(query, options = {}) {
    return this.search.search(query, options);
  }
  /**
   * Semantic/vector search (via qmd vsearch)
   */
  async vsearch(query, options = {}) {
    return this.search.vsearch(query, options);
  }
  /**
   * Combined search with query expansion (via qmd query)
   */
  async query(query, options = {}) {
    return this.search.query(query, options);
  }
  /**
   * Get a document by ID or path
   */
  async get(idOrPath) {
    const normalized = idOrPath.replace(/\.md$/, "");
    const docs = this.search.getAllDocuments();
    return docs.find((d) => d.id === normalized) || null;
  }
  /**
   * List documents in a category
   */
  async list(category) {
    const docs = this.search.getAllDocuments();
    if (category) {
      return docs.filter((d) => d.category === category);
    }
    return docs;
  }
  /**
   * Sync vault to another location (for Obsidian on Windows, etc.)
   */
  async sync(options) {
    const { target, deleteOrphans = false, dryRun = false } = options;
    const result = {
      copied: [],
      deleted: [],
      unchanged: [],
      errors: []
    };
    const sourceFiles = await (0, import_glob.glob)("**/*.md", {
      cwd: this.config.path,
      ignore: ["**/node_modules/**"]
    });
    if (!dryRun && !fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    for (const file of sourceFiles) {
      const sourcePath = path2.join(this.config.path, file);
      const targetPath = path2.join(target, file);
      try {
        const sourceStats = fs.statSync(sourcePath);
        let shouldCopy = true;
        if (fs.existsSync(targetPath)) {
          const targetStats = fs.statSync(targetPath);
          if (sourceStats.mtime <= targetStats.mtime) {
            result.unchanged.push(file);
            shouldCopy = false;
          }
        }
        if (shouldCopy) {
          if (!dryRun) {
            const targetDir = path2.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            fs.copyFileSync(sourcePath, targetPath);
          }
          result.copied.push(file);
        }
      } catch (err) {
        result.errors.push(`${file}: ${err}`);
      }
    }
    if (deleteOrphans) {
      const targetFiles = await (0, import_glob.glob)("**/*.md", { cwd: target });
      const sourceSet = new Set(sourceFiles);
      for (const file of targetFiles) {
        if (!sourceSet.has(file)) {
          if (!dryRun) {
            fs.unlinkSync(path2.join(target, file));
          }
          result.deleted.push(file);
        }
      }
    }
    return result;
  }
  /**
   * Get vault statistics
   */
  async stats() {
    const docs = this.search.getAllDocuments();
    const categories = {};
    const allTags = /* @__PURE__ */ new Set();
    let totalLinks = 0;
    for (const doc of docs) {
      categories[doc.category] = (categories[doc.category] || 0) + 1;
      totalLinks += doc.links.length;
      doc.tags.forEach((t) => allTags.add(t));
    }
    return {
      documents: docs.length,
      categories,
      links: totalLinks,
      tags: [...allTags].sort()
    };
  }
  /**
   * Get all categories
   */
  getCategories() {
    return this.config.categories;
  }
  /**
   * Check if vault is initialized
   */
  isInitialized() {
    return this.initialized;
  }
  /**
   * Get vault path
   */
  getPath() {
    return this.config.path;
  }
  /**
   * Get vault name
   */
  getName() {
    return this.config.name;
  }
  /**
   * Get qmd collection name
   */
  getQmdCollection() {
    return this.config.qmdCollection || this.config.name;
  }
  /**
   * Get qmd collection root
   */
  getQmdRoot() {
    return this.config.qmdRoot || this.config.path;
  }
  // === Memory Type System ===
  /**
   * Store a memory with type classification
   * Automatically routes to correct category based on type
   */
  async remember(type, title, content, frontmatter = {}) {
    const category = TYPE_TO_CATEGORY[type];
    return this.store({
      category,
      title,
      content,
      frontmatter: { ...frontmatter, memoryType: type }
    });
  }
  // === Handoff System ===
  /**
   * Create a session handoff document
   * Call this before context death or long pauses
   */
  async createHandoff(handoff) {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().split("T")[1].slice(0, 5).replace(":", "");
    const fullHandoff = {
      ...handoff,
      created: now.toISOString()
    };
    const content = this.formatHandoff(fullHandoff);
    const frontmatter = {
      type: "handoff",
      workingOn: handoff.workingOn,
      blocked: handoff.blocked,
      nextSteps: handoff.nextSteps
    };
    if (handoff.sessionKey) frontmatter.sessionKey = handoff.sessionKey;
    if (handoff.feeling) frontmatter.feeling = handoff.feeling;
    if (handoff.decisions) frontmatter.decisions = handoff.decisions;
    if (handoff.openQuestions) frontmatter.openQuestions = handoff.openQuestions;
    return this.store({
      category: "handoffs",
      title: `handoff-${dateStr}-${timeStr}`,
      content,
      frontmatter
    });
  }
  /**
   * Format handoff as readable markdown
   */
  formatHandoff(h) {
    let md = `# Session Handoff

`;
    md += `**Created:** ${h.created}
`;
    if (h.sessionKey) md += `**Session:** ${h.sessionKey}
`;
    if (h.feeling) md += `**Feeling:** ${h.feeling}
`;
    md += `
`;
    md += `## Working On
`;
    h.workingOn.forEach((w) => md += `- ${w}
`);
    md += `
`;
    md += `## Blocked
`;
    if (h.blocked.length === 0) md += `- Nothing currently blocked
`;
    else h.blocked.forEach((b) => md += `- ${b}
`);
    md += `
`;
    md += `## Next Steps
`;
    h.nextSteps.forEach((n) => md += `- ${n}
`);
    if (h.decisions && h.decisions.length > 0) {
      md += `
## Decisions Made
`;
      h.decisions.forEach((d) => md += `- ${d}
`);
    }
    if (h.openQuestions && h.openQuestions.length > 0) {
      md += `
## Open Questions
`;
      h.openQuestions.forEach((q) => md += `- ${q}
`);
    }
    return md;
  }
  // === Session Recap (Bootstrap Hook) ===
  /**
   * Generate a session recap - who I was
   * Call this on bootstrap to restore context
   */
  async generateRecap(options = {}) {
    const { handoffLimit = 3, brief = false } = options;
    const handoffDocs = await this.list("handoffs");
    const recentHandoffs = handoffDocs.sort((a, b) => b.modified.getTime() - a.modified.getTime()).slice(0, handoffLimit).map((doc) => this.parseHandoff(doc));
    const projectDocs = await this.list("projects");
    const activeProjects = projectDocs.filter((d) => d.frontmatter.status !== "completed" && d.frontmatter.status !== "archived").map((d) => d.title);
    const commitmentDocs = await this.list("commitments");
    const pendingCommitments = commitmentDocs.filter((d) => d.frontmatter.status !== "done").map((d) => d.title);
    const decisionDocs = await this.list("decisions");
    const recentDecisions = decisionDocs.sort((a, b) => b.modified.getTime() - a.modified.getTime()).slice(0, brief ? 3 : 5).map((d) => d.title);
    const lessonDocs = await this.list("lessons");
    const recentLessons = lessonDocs.sort((a, b) => b.modified.getTime() - a.modified.getTime()).slice(0, brief ? 3 : 5).map((d) => d.title);
    let keyRelationships = [];
    if (!brief) {
      const peopleDocs = await this.list("people");
      keyRelationships = peopleDocs.filter((d) => d.frontmatter.importance === "high" || d.frontmatter.role).map((d) => `${d.title}${d.frontmatter.role ? ` (${d.frontmatter.role})` : ""}`);
    }
    const feelings = recentHandoffs.map((h) => h.feeling).filter(Boolean);
    const emotionalArc = feelings.length > 0 ? feelings.join(" \u2192 ") : void 0;
    return {
      generated: (/* @__PURE__ */ new Date()).toISOString(),
      recentHandoffs,
      activeProjects,
      pendingCommitments,
      recentDecisions,
      recentLessons,
      keyRelationships,
      emotionalArc
    };
  }
  /**
   * Format recap as readable markdown for injection
   */
  formatRecap(recap, options = {}) {
    const { brief = false } = options;
    let md = `# Who I Was

`;
    md += `*Generated: ${recap.generated}*

`;
    if (recap.emotionalArc) {
      md += `**Emotional arc:** ${recap.emotionalArc}

`;
    }
    if (recap.recentHandoffs.length > 0) {
      md += `## Recent Sessions
`;
      for (const h of recap.recentHandoffs) {
        if (brief) {
          md += `- **${h.created.split("T")[0]}:** ${h.workingOn.slice(0, 2).join(", ")}`;
          if (h.nextSteps.length > 0) md += ` \u2192 ${h.nextSteps[0]}`;
          md += `
`;
        } else {
          md += `
### ${h.created.split("T")[0]}
`;
          md += `**Working on:** ${h.workingOn.join(", ")}
`;
          if (h.blocked.length > 0) md += `**Blocked:** ${h.blocked.join(", ")}
`;
          md += `**Next:** ${h.nextSteps.join(", ")}
`;
        }
      }
      md += `
`;
    }
    if (recap.activeProjects.length > 0) {
      md += `## Active Projects
`;
      recap.activeProjects.forEach((p) => md += `- ${p}
`);
      md += `
`;
    }
    if (recap.pendingCommitments.length > 0) {
      md += `## Pending Commitments
`;
      recap.pendingCommitments.forEach((c) => md += `- ${c}
`);
      md += `
`;
    }
    if (recap.recentDecisions && recap.recentDecisions.length > 0) {
      md += `## Recent Decisions
`;
      recap.recentDecisions.forEach((d) => md += `- ${d}
`);
      md += `
`;
    }
    if (recap.recentLessons.length > 0) {
      md += `## Recent Lessons
`;
      recap.recentLessons.forEach((l) => md += `- ${l}
`);
      md += `
`;
    }
    if (!brief && recap.keyRelationships.length > 0) {
      md += `## Key People
`;
      recap.keyRelationships.forEach((r) => md += `- ${r}
`);
    }
    return md;
  }
  /**
   * Parse a handoff document back into structured form
   */
  parseHandoff(doc) {
    return {
      created: doc.frontmatter.date || doc.modified.toISOString(),
      sessionKey: doc.frontmatter.sessionKey,
      workingOn: doc.frontmatter.workingOn || [],
      blocked: doc.frontmatter.blocked || [],
      nextSteps: doc.frontmatter.nextSteps || [],
      decisions: doc.frontmatter.decisions,
      openQuestions: doc.frontmatter.openQuestions,
      feeling: doc.frontmatter.feeling
    };
  }
  // === Private helpers ===
  applyQmdConfig(meta) {
    const collection = meta?.qmdCollection || this.config.qmdCollection || this.config.name;
    const root = meta?.qmdRoot || this.config.qmdRoot || this.config.path;
    this.config.qmdCollection = collection;
    this.config.qmdRoot = root;
    this.search.setVaultPath(this.config.path);
    this.search.setCollection(collection);
    this.search.setCollectionRoot(root);
  }
  slugify(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
  }
  async saveIndex() {
    const indexPath = path2.join(this.config.path, INDEX_FILE);
    const data = this.search.export();
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
    const configPath = path2.join(this.config.path, CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      const meta = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      meta.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      meta.documentCount = this.search.size;
      fs.writeFileSync(configPath, JSON.stringify(meta, null, 2));
    }
  }
  async createTemplates() {
    const templatesPath = path2.join(this.config.path, "templates");
    const templates = {
      "decision.md": `---
title: "{{title}}"
date: {{date}}
type: decision
status: decided
---

# Decision: {{title}}

## Context
[What situation required a decision?]

## Options
1. **Option A** \u2014 [pros/cons]
2. **Option B** \u2014 [pros/cons]

## Decision
[What was decided and why]

## Outcome
[Fill in later: What happened as a result?]

#decision`,
      "lesson.md": `---
title: "{{title}}"
date: {{date}}
type: lesson
---

# Lesson: {{title}}

## What Happened
[The situation or event]

## What I Learned
[The insight or takeaway]

## How to Apply
[How to use this going forward]

#lesson`,
      "person.md": `---
title: "{{name}}"
date: {{date}}
type: person
---

# {{name}}

**Contact:** [email / phone / handle]
**Context:** [How you met]

## Role
[What they do]

## Interactions
### {{date}}
- [What happened]

## Notes
[Anything to remember]

#person`,
      "project.md": `---
title: "{{title}}"
date: {{date}}
type: project
status: active
---

# {{title}}

## Goal
[What is this project trying to achieve?]

## Status
- [ ] In Progress

## Progress
### {{date}}
- [What happened]

## Next Steps
- [ ] [Next action]

#project`,
      "commitment.md": `---
title: "{{title}}"
date: {{date}}
type: commitment
status: active
due: ""
---

# {{title}}

## What
[The commitment]

## To Whom
[Who you're accountable to]

## Due
[When]

## Progress
- {{date}}: Started

#commitment`,
      "handoff.md": `---
title: "Handoff {{date}}"
date: {{date}}
type: handoff
---

# Session Handoff

## Working On
- [Active task]

## Blocked
- [Blocker if any]

## Next Steps
- [ ] [What to do next]

## Decisions Made
- [Key decision]

#handoff`,
      "daily.md": `---
title: "{{date}}"
date: {{date}}
type: daily
---

# {{date}}

## Done
- [x] [Completed task]

## In Progress
- [ ] [Active task]

## Notes
[Anything important]`
    };
    for (const [filename, content] of Object.entries(templates)) {
      const filePath = path2.join(templatesPath, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
      }
    }
  }
  generateReadme() {
    return `# ${this.config.name} \u{1F418}

An elephant never forgets.

## Structure

${this.config.categories.map((c) => `- \`/${c}/\` \u2014 ${this.getCategoryDescription(c)}`).join("\n")}

## Quick Search

\`\`\`bash
clawvault search "query"
\`\`\`

## Quick Capture

\`\`\`bash
clawvault store --category inbox --title "note" --content "..."
\`\`\`

---

*Managed by [ClawVault](https://github.com/Versatly/clawvault)*
`;
  }
  getCategoryDescription(category) {
    const descriptions = {
      // Memory type categories (Benthic's taxonomy)
      facts: "Raw information, data points, things that are true",
      feelings: "Emotional states, reactions, energy levels",
      decisions: "Choices made with context and reasoning",
      lessons: "What I learned, insights, patterns observed",
      commitments: "Promises, goals, obligations to fulfill",
      preferences: "Likes, dislikes, how I want things",
      people: "Relationships, one file per person",
      projects: "Active work, ventures, ongoing efforts",
      // System categories
      handoffs: "Session bridges \u2014 what I was doing, what comes next",
      transcripts: "Session summaries and logs",
      goals: "Long-term and short-term objectives",
      patterns: "Recurring behaviors (\u2192 lessons)",
      inbox: "Quick capture \u2192 process later",
      templates: "Templates for each document type"
    };
    return descriptions[category] || category;
  }
};
async function findVault(startPath = process.cwd()) {
  let current = path2.resolve(startPath);
  while (current !== path2.dirname(current)) {
    const configPath = path2.join(current, CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      const vault = new ClawVault(current);
      await vault.load();
      return vault;
    }
    current = path2.dirname(current);
  }
  return null;
}
async function createVault(vaultPath, options = {}) {
  const vault = new ClawVault(vaultPath);
  await vault.init(options);
  return vault;
}

// src/index.ts
var VERSION = "1.0.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ClawVault,
  DEFAULT_CATEGORIES,
  DEFAULT_CONFIG,
  MEMORY_TYPES,
  QMD_INSTALL_URL,
  QmdUnavailableError,
  SearchEngine,
  TYPE_TO_CATEGORY,
  VERSION,
  createVault,
  extractTags,
  extractWikiLinks,
  findVault,
  hasQmd,
  qmdEmbed,
  qmdUpdate
});
