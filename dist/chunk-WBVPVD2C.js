import {
  ClawVault
} from "./chunk-Y4H6XSBV.js";

// src/commands/context.ts
import * as path from "path";
var DEFAULT_LIMIT = 5;
var MAX_SNIPPET_LENGTH = 320;
function formatRelativeAge(date, now = Date.now()) {
  const ageMs = Math.max(0, now - date.getTime());
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1e3));
  if (days === 0) return "today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
function normalizeSnippet(result) {
  const source = (result.snippet || result.document.content || "").trim();
  if (!source) return "No snippet available.";
  return source.replace(/\s+/g, " ").slice(0, MAX_SNIPPET_LENGTH);
}
function formatContextMarkdown(task, entries) {
  let output = `## Relevant Context for: ${task}

`;
  if (entries.length === 0) {
    output += "_No relevant context found._\n";
    return output;
  }
  for (const entry of entries) {
    output += `### ${entry.title} (score: ${entry.score.toFixed(2)}, ${entry.age})
`;
    output += `${entry.snippet}

`;
  }
  return output.trimEnd();
}
async function buildContext(task, options) {
  const normalizedTask = task.trim();
  if (!normalizedTask) {
    throw new Error("Task description is required.");
  }
  const vault = new ClawVault(path.resolve(options.vaultPath));
  await vault.load();
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const recent = options.recent ?? true;
  const results = await vault.vsearch(normalizedTask, {
    limit,
    temporalBoost: recent
  });
  const context = results.map((result) => ({
    title: result.document.title,
    path: path.relative(vault.getPath(), result.document.path).split(path.sep).join("/"),
    category: result.document.category,
    score: result.score,
    snippet: normalizeSnippet(result),
    modified: result.document.modified.toISOString(),
    age: formatRelativeAge(result.document.modified)
  }));
  return {
    task: normalizedTask,
    generated: (/* @__PURE__ */ new Date()).toISOString(),
    context,
    markdown: formatContextMarkdown(normalizedTask, context)
  };
}
async function contextCommand(task, options) {
  const result = await buildContext(task, options);
  const format = options.format ?? "markdown";
  if (format === "json") {
    console.log(JSON.stringify({
      task: result.task,
      generated: result.generated,
      count: result.context.length,
      context: result.context
    }, null, 2));
    return;
  }
  console.log(result.markdown);
}

export {
  formatContextMarkdown,
  buildContext,
  contextCommand
};
