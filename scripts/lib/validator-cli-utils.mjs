import * as fs from 'fs';
import * as path from 'path';

export function isJsonModeRequestedFromArgv(argv) {
  return argv.includes('--json');
}

export function bestEffortOutPath(argv) {
  const index = argv.indexOf('--out');
  if (index === -1) return '';
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) return '';
  return value;
}

export function writeValidatedJsonPayload(outPath, payload, ensurePayloadShape) {
  ensurePayloadShape(payload);
  const resolvedPath = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
}
