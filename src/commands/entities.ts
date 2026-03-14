import { buildEntityIndex } from '../lib/entity-index.js';
import { resolveVaultPath } from '../lib/config.js';
import { readEntityProfile, synthesizeEntityProfiles } from '../entities/synthesis.js';

interface EntitiesOptions {
  json?: boolean;
  vaultPath?: string;
  refresh?: boolean;
}

interface EntityOptions {
  json?: boolean;
  vaultPath?: string;
  refresh?: boolean;
}

export async function entitiesCommand(options: EntitiesOptions): Promise<void> {
  const vaultPath = resolveVaultPath({ explicitPath: options.vaultPath });
  if (options.refresh) {
    await synthesizeEntityProfiles(vaultPath, { writeFiles: true });
  }
  const index = buildEntityIndex(vaultPath);
  
  if (options.json) {
    const output: Record<string, string[]> = {};
    for (const [path, entry] of index.byPath) {
      output[path] = entry.aliases;
    }
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  
  // Group by folder
  const byFolder: Record<string, Array<{ path: string; aliases: string[] }>> = {};
  
  for (const [path, entry] of index.byPath) {
    const folder = path.split('/')[0];
    if (!byFolder[folder]) byFolder[folder] = [];
    byFolder[folder].push({ path, aliases: entry.aliases });
  }
  
  console.log('📚 Linkable Entities\n');
  
  for (const [folder, entities] of Object.entries(byFolder)) {
    console.log(`## ${folder}/`);
    for (const entity of entities) {
      const name = entity.path.split('/')[1];
      const otherAliases = entity.aliases.filter(a => a.toLowerCase() !== name.toLowerCase());
      if (otherAliases.length > 0) {
        console.log(`  - ${name} (${otherAliases.join(', ')})`);
      } else {
        console.log(`  - ${name}`);
      }
    }
    console.log();
  }
  
  console.log(`Total: ${index.byPath.size} entities, ${index.entries.size} linkable aliases`);
}

export async function entityCommand(name: string, options: EntityOptions): Promise<void> {
  const vaultPath = resolveVaultPath({ explicitPath: options.vaultPath });
  if (options.refresh) {
    await synthesizeEntityProfiles(vaultPath, { writeFiles: true });
  }

  const profile = await readEntityProfile(vaultPath, name);
  if (!profile) {
    throw new Error(`Entity not found: ${name}`);
  }

  if (options.json) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  console.log(`📌 ${profile.name}`);
  console.log(`Kind: ${profile.kind}`);
  console.log(`Aliases: ${profile.aliases.join(', ')}`);
  console.log(`Last mentioned: ${profile.lastMentioned}`);
  console.log('');
  console.log(profile.summary);
  console.log('');
  console.log('Relationships:');
  if (profile.relationships.length === 0) {
    console.log('- none');
  } else {
    for (const relationship of profile.relationships) {
      console.log(`- ${relationship.target} (strength: ${relationship.strength})`);
    }
  }
}
