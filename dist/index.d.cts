/**
 * ClawVault Types - The elephant's memory structure
 */
interface VaultConfig {
    /** Root path of the vault */
    path: string;
    /** Name of the vault */
    name: string;
    /** Categories to create on init */
    categories: string[];
    /** qmd collection name (defaults to vault name if not set) */
    qmdCollection?: string;
    /** Root path for qmd collection (defaults to vault path) */
    qmdRoot?: string;
    /** Custom templates path (optional) */
    templatesPath?: string;
}
interface VaultMeta {
    name: string;
    version: string;
    created: string;
    lastUpdated: string;
    categories: string[];
    documentCount: number;
    /** qmd collection name (defaults to vault name if not set) */
    qmdCollection?: string;
    /** Root path for qmd collection (defaults to vault path) */
    qmdRoot?: string;
}
interface Document {
    /** Unique ID (relative path without extension) */
    id: string;
    /** Full file path */
    path: string;
    /** Category (folder name) */
    category: string;
    /** Document title */
    title: string;
    /** Raw content */
    content: string;
    /** Frontmatter metadata */
    frontmatter: Record<string, unknown>;
    /** Extracted wiki-links [[like-this]] */
    links: string[];
    /** Tags extracted from content */
    tags: string[];
    /** Last modified timestamp */
    modified: Date;
}
interface SearchResult {
    /** Document that matched */
    document: Document;
    /** Relevance score (0-1) */
    score: number;
    /** Matching snippet */
    snippet: string;
    /** Which terms matched */
    matchedTerms: string[];
}
interface SearchOptions {
    /** Max results to return */
    limit?: number;
    /** Minimum score threshold (0-1) */
    minScore?: number;
    /** Filter by category */
    category?: string;
    /** Filter by tags */
    tags?: string[];
    /** Include full content in results */
    fullContent?: boolean;
}
interface StoreOptions {
    /** Category to store in */
    category: string;
    /** Document title (used for filename) */
    title: string;
    /** Content body */
    content: string;
    /** Frontmatter metadata */
    frontmatter?: Record<string, unknown>;
    /** Override existing file */
    overwrite?: boolean;
    /** Trigger qmd update after storing */
    qmdUpdate?: boolean;
    /** Trigger qmd embed after storing (implies qmdUpdate) */
    qmdEmbed?: boolean;
}
interface SyncOptions {
    /** Target directory to sync to */
    target: string;
    /** Delete files in target not in source */
    deleteOrphans?: boolean;
    /** Dry run - don't actually sync */
    dryRun?: boolean;
}
interface SyncResult {
    copied: string[];
    deleted: string[];
    unchanged: string[];
    errors: string[];
}
type Category = 'preferences' | 'decisions' | 'patterns' | 'people' | 'projects' | 'goals' | 'transcripts' | 'inbox' | 'templates' | 'facts' | 'feelings' | 'lessons' | 'commitments' | 'handoffs' | string;
declare const DEFAULT_CATEGORIES: Category[];
/**
 * Memory Type Taxonomy (Benthic's 8 categories)
 * Knowing WHAT KIND of thing helps you know WHERE to put it
 */
type MemoryType = 'fact' | 'feeling' | 'decision' | 'lesson' | 'commitment' | 'preference' | 'relationship' | 'project';
declare const MEMORY_TYPES: MemoryType[];
/**
 * Memory type to category mapping
 */
declare const TYPE_TO_CATEGORY: Record<MemoryType, Category>;
/**
 * Handoff document - bridges sessions
 */
interface HandoffDocument {
    /** When this handoff was created */
    created: string;
    /** Session key or identifier */
    sessionKey?: string;
    /** What I was working on */
    workingOn: string[];
    /** What is currently blocked */
    blocked: string[];
    /** What comes next */
    nextSteps: string[];
    /** Emotional state/energy */
    feeling?: string;
    /** Key decisions made */
    decisions?: string[];
    /** Open questions */
    openQuestions?: string[];
}
/**
 * Session recap - who I was when I woke up
 */
interface SessionRecap {
    /** When recap was generated */
    generated: string;
    /** Recent handoffs (last N) */
    recentHandoffs: HandoffDocument[];
    /** Active projects */
    activeProjects: string[];
    /** Pending commitments */
    pendingCommitments: string[];
    /** Recent decisions made */
    recentDecisions?: string[];
    /** Recent lessons learned */
    recentLessons: string[];
    /** Key relationships to remember */
    keyRelationships: string[];
    /** Current emotional arc */
    emotionalArc?: string;
}
declare const DEFAULT_CONFIG: Partial<VaultConfig>;

/**
 * ClawVault - The elephant's memory
 */

declare class ClawVault {
    private config;
    private search;
    private initialized;
    constructor(vaultPath: string);
    /**
     * Initialize a new vault
     */
    init(options?: Partial<VaultConfig>): Promise<void>;
    /**
     * Load an existing vault
     */
    load(): Promise<void>;
    /**
     * Reindex all documents
     */
    reindex(): Promise<number>;
    /**
     * Load a document from disk
     */
    private loadDocument;
    /**
     * Store a new document
     */
    store(options: StoreOptions): Promise<Document>;
    /**
     * Quick store to inbox
     */
    capture(note: string, title?: string): Promise<Document>;
    /**
     * Search the vault (BM25 via qmd)
     */
    find(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Semantic/vector search (via qmd vsearch)
     */
    vsearch(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Combined search with query expansion (via qmd query)
     */
    query(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Get a document by ID or path
     */
    get(idOrPath: string): Promise<Document | null>;
    /**
     * List documents in a category
     */
    list(category?: string): Promise<Document[]>;
    /**
     * Sync vault to another location (for Obsidian on Windows, etc.)
     */
    sync(options: SyncOptions): Promise<SyncResult>;
    /**
     * Get vault statistics
     */
    stats(): Promise<{
        documents: number;
        categories: {
            [key: string]: number;
        };
        links: number;
        tags: string[];
    }>;
    /**
     * Get all categories
     */
    getCategories(): Category[];
    /**
     * Check if vault is initialized
     */
    isInitialized(): boolean;
    /**
     * Get vault path
     */
    getPath(): string;
    /**
     * Get vault name
     */
    getName(): string;
    /**
     * Get qmd collection name
     */
    getQmdCollection(): string;
    /**
     * Get qmd collection root
     */
    getQmdRoot(): string;
    /**
     * Store a memory with type classification
     * Automatically routes to correct category based on type
     */
    remember(type: MemoryType, title: string, content: string, frontmatter?: Record<string, unknown>): Promise<Document>;
    /**
     * Create a session handoff document
     * Call this before context death or long pauses
     */
    createHandoff(handoff: Omit<HandoffDocument, 'created'>): Promise<Document>;
    /**
     * Format handoff as readable markdown
     */
    private formatHandoff;
    /**
     * Generate a session recap - who I was
     * Call this on bootstrap to restore context
     */
    generateRecap(options?: {
        handoffLimit?: number;
        brief?: boolean;
    }): Promise<SessionRecap>;
    /**
     * Format recap as readable markdown for injection
     */
    formatRecap(recap: SessionRecap, options?: {
        brief?: boolean;
    }): string;
    /**
     * Parse a handoff document back into structured form
     */
    private parseHandoff;
    private applyQmdConfig;
    private slugify;
    private saveIndex;
    private createTemplates;
    private generateReadme;
    private getCategoryDescription;
}
/**
 * Find and open the nearest vault (walks up directory tree)
 */
declare function findVault(startPath?: string): Promise<ClawVault | null>;
/**
 * Create a new vault
 */
declare function createVault(vaultPath: string, options?: Partial<VaultConfig>): Promise<ClawVault>;

/**
 * ClawVault Search Engine - qmd Backend
 * Uses qmd CLI for BM25 and vector search
 */

declare const QMD_INSTALL_URL = "https://github.com/Versatly/qmd";
declare class QmdUnavailableError extends Error {
    constructor(message?: string);
}
/**
 * Check if qmd is available
 */
declare function hasQmd(): boolean;
/**
 * Trigger qmd update (reindex)
 */
declare function qmdUpdate(collection?: string): void;
/**
 * Trigger qmd embed (create/update vector embeddings)
 */
declare function qmdEmbed(collection?: string): void;
/**
 * QMD Search Engine - wraps qmd CLI
 */
declare class SearchEngine {
    private documents;
    private collection;
    private vaultPath;
    private collectionRoot;
    /**
     * Set the collection name (usually vault name)
     */
    setCollection(name: string): void;
    /**
     * Set the vault path for file resolution
     */
    setVaultPath(vaultPath: string): void;
    /**
     * Set the collection root for qmd:// URI resolution
     */
    setCollectionRoot(root: string): void;
    /**
     * Add or update a document in the local cache
     * Note: qmd indexing happens via qmd update command
     */
    addDocument(doc: Document): void;
    /**
     * Remove a document from the local cache
     */
    removeDocument(id: string): void;
    /**
     * No-op for qmd - indexing is managed externally
     */
    rebuildIDF(): void;
    /**
     * BM25 search via qmd
     */
    search(query: string, options?: SearchOptions): SearchResult[];
    /**
     * Vector/semantic search via qmd vsearch
     */
    vsearch(query: string, options?: SearchOptions): SearchResult[];
    /**
     * Combined search with query expansion (qmd query command)
     */
    query(query: string, options?: SearchOptions): SearchResult[];
    /**
     * Convert qmd results to ClawVault SearchResult format
     */
    private convertResults;
    /**
     * Convert qmd:// URI to file path
     */
    private qmdUriToPath;
    /**
     * Clean up qmd snippet format
     */
    private cleanSnippet;
    /**
     * Get all cached documents
     */
    getAllDocuments(): Document[];
    /**
     * Get document count
     */
    get size(): number;
    /**
     * Clear the local document cache
     */
    clear(): void;
    /**
     * Export documents for persistence
     */
    export(): {
        documents: Document[];
    };
    /**
     * Import from persisted data
     */
    import(data: {
        documents: Document[];
    }): void;
}
/**
 * Find wiki-links in content
 */
declare function extractWikiLinks(content: string): string[];
/**
 * Find tags in content (#tag format)
 */
declare function extractTags(content: string): string[];

/**
 * ClawVault 🐘 — An Elephant Never Forgets
 *
 * Structured memory system for AI agents with Obsidian-compatible markdown
 * and embedded semantic search.
 *
 * @example
 * ```typescript
 * import { ClawVault, createVault, findVault } from 'clawvault';
 *
 * // Create a new vault
 * const vault = await createVault('./my-memory');
 *
 * // Store a memory
 * await vault.store({
 *   category: 'decisions',
 *   title: 'Use ClawVault',
 *   content: 'Decided to use ClawVault for memory management.'
 * });
 *
 * // Search memories
 * const results = await vault.find('memory management');
 * console.log(results);
 * ```
 */

declare const VERSION = "1.0.0";

export { type Category, ClawVault, DEFAULT_CATEGORIES, DEFAULT_CONFIG, type Document, type HandoffDocument, MEMORY_TYPES, type MemoryType, QMD_INSTALL_URL, QmdUnavailableError, SearchEngine, type SearchOptions, type SearchResult, type SessionRecap, type StoreOptions, type SyncOptions, type SyncResult, TYPE_TO_CATEGORY, VERSION, type VaultConfig, type VaultMeta, createVault, extractTags, extractWikiLinks, findVault, hasQmd, qmdEmbed, qmdUpdate };
