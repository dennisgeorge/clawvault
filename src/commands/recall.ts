import { ClawVault } from '../lib/vault.js';
import { resolveVaultPath } from '../lib/config.js';
import { buildRecallResult } from '../recall/service.js';
import type { RecallOptions, RecallResult, RecallStrategy } from '../recall/types.js';

export interface RecallCommandOptions {
  vaultPath?: string;
  limit?: number;
  strategy?: RecallStrategy;
  json?: boolean;
  includeSources?: boolean;
}

export async function recallCommand(
  query: string,
  options: RecallCommandOptions
): Promise<RecallResult> {
  const vaultPath = resolveVaultPath({ explicitPath: options.vaultPath });
  const vault = new ClawVault(vaultPath);
  await vault.load();

  const recallOptions: RecallOptions = {
    limit: options.limit,
    strategy: options.strategy,
    includeSources: options.includeSources
  };
  const result = await buildRecallResult(vault, query, recallOptions);

  if (options.json) {
    console.log(JSON.stringify({
      strategy: result.strategy,
      query: result.query,
      sources: result.sources,
      context: result.context
    }, null, 2));
    return result;
  }

  console.log(result.context);
  return result;
}

