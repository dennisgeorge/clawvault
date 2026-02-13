export function readRequiredOptionValue(argv, index, optionName) {
  const nextValue = argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return {
    value: nextValue,
    nextIndex: index + 1
  };
}

export function isFlagToken(value) {
  return typeof value === 'string' && value.startsWith('--');
}
