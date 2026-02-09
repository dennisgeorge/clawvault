import {
  setupCommand
} from "./chunk-Z6LQ4VTI.js";
import {
  buildTemplateVariables,
  renderTemplate
} from "./chunk-7766SIJP.js";
import {
  buildContext,
  contextCommand,
  formatContextMarkdown
} from "./chunk-WBVPVD2C.js";
import {
  ClawVault,
  createVault,
  findVault
} from "./chunk-Y4H6XSBV.js";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CONFIG,
  MEMORY_TYPES,
  QMD_INSTALL_COMMAND,
  QMD_INSTALL_URL,
  QmdUnavailableError,
  SearchEngine,
  TYPE_TO_CATEGORY,
  extractTags,
  extractWikiLinks,
  hasQmd,
  qmdEmbed,
  qmdUpdate
} from "./chunk-VHECN4BB.js";

// src/index.ts
import * as fs from "fs";
function readPackageVersion() {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
var VERSION = readPackageVersion();
export {
  ClawVault,
  DEFAULT_CATEGORIES,
  DEFAULT_CONFIG,
  MEMORY_TYPES,
  QMD_INSTALL_COMMAND,
  QMD_INSTALL_URL,
  QmdUnavailableError,
  SearchEngine,
  TYPE_TO_CATEGORY,
  VERSION,
  buildContext,
  buildTemplateVariables,
  contextCommand,
  createVault,
  extractTags,
  extractWikiLinks,
  findVault,
  formatContextMarkdown,
  hasQmd,
  qmdEmbed,
  qmdUpdate,
  renderTemplate,
  setupCommand
};
