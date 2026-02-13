import {
  readRequiredOptionValue
} from './validator-arg-utils.mjs';

function ensureOptionName(name, kind) {
  if (typeof name !== 'string' || !name.startsWith('--')) {
    throw new Error(`validator cli parser ${kind} option names must start with "--"`);
  }
}

function ensureOptionKey(key, kind) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`validator cli parser ${kind} option key must be a non-empty string`);
  }
}

export function parseValidatorCliArgs(argv, {
  initialValues = {},
  valueOptions = [],
  booleanOptions = [],
  allowPositional = false
} = {}) {
  const parsed = {
    help: false,
    json: false,
    outPath: '',
    ...initialValues
  };
  const positional = [];
  const valueOptionByName = new Map();
  const booleanOptionByName = new Map();

  for (const entry of valueOptions) {
    ensureOptionName(entry?.name, 'value');
    ensureOptionKey(entry?.key, 'value');
    if (valueOptionByName.has(entry.name) || booleanOptionByName.has(entry.name) || entry.name === '--out') {
      throw new Error(`validator cli parser received duplicate option: ${entry.name}`);
    }
    valueOptionByName.set(entry.name, entry);
  }

  for (const entry of booleanOptions) {
    ensureOptionName(entry?.name, 'boolean');
    ensureOptionKey(entry?.key, 'boolean');
    if (booleanOptionByName.has(entry.name) || valueOptionByName.has(entry.name) || entry.name === '--json') {
      throw new Error(`validator cli parser received duplicate option: ${entry.name}`);
    }
    booleanOptionByName.set(entry.name, entry);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }
    if (token === '--json') {
      parsed.json = true;
      continue;
    }
    if (token === '--out') {
      const { value, nextIndex } = readRequiredOptionValue(argv, index, '--out');
      parsed.outPath = value;
      index = nextIndex;
      continue;
    }
    if (valueOptionByName.has(token)) {
      const option = valueOptionByName.get(token);
      const { value, nextIndex } = readRequiredOptionValue(argv, index, option.name);
      parsed[option.key] = value;
      index = nextIndex;
      continue;
    }
    if (booleanOptionByName.has(token)) {
      const option = booleanOptionByName.get(token);
      parsed[option.key] = true;
      continue;
    }
    if (typeof token === 'string' && token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    }
    if (!allowPositional) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    positional.push(token);
  }

  return {
    parsed,
    positional
  };
}
