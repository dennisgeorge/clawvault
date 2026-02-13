export function buildUnitCountMap(values) {
  if (!Array.isArray(values)) {
    return {};
  }
  return values.reduce((counts, value) => {
    const existingCount = counts[value] ?? 0;
    counts[value] = existingCount + 1;
    return counts;
  }, {});
}

export function buildUnitCountMapByKey(valuesByKey) {
  if (!valuesByKey || typeof valuesByKey !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(valuesByKey).map(([key, values]) => [key, buildUnitCountMap(values)])
  );
}
