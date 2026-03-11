import { describe, expect, it } from 'vitest';
import { autoLink, dryRunLink, findUnlinkedMentions } from './auto-linker.js';
import type { EntityIndex } from './entity-index.js';

function createIndex(entries: Array<[string, string]>): EntityIndex {
  return {
    entries: new Map(entries),
    byPath: new Map(),
  };
}

describe('auto-linker', () => {
  it('links only first unprotected occurrence per entity', () => {
    const index = createIndex([
      ['justin', 'people/justin'],
    ]);

    const input = `---
owner: Justin
---

\`\`\`
Justin
\`\`\`

Already linked [[people/justin]].
URL https://example.com/Justin should stay plain.

Real Justin mention.
Another Justin mention.
`;

    const output = autoLink(input, index);

    expect(output).toContain('Real [[people/justin]] mention.');
    expect(output).toContain('Another Justin mention.');
    expect(output).toContain('owner: Justin');
    expect(output).toContain('https://example.com/Justin');
  });

  it('renders alias links and escapes regex metacharacters', () => {
    const index = createIndex([
      ['node.js', 'projects/nodejs'],
      ['justin', 'people/justin'],
    ]);

    const output = autoLink('Node.js integrates with Justin.', index);

    expect(output).toContain('[[projects/nodejs|Node.js]]');
    expect(output).toContain('[[people/justin]]');
  });

  it('prefers longer aliases before shorter overlaps', () => {
    const index = createIndex([
      ['core api', 'projects/core-api'],
      ['api', 'projects/api'],
    ]);

    const output = autoLink('Core API is replacing the API endpoint.', index);

    expect(output).toContain('[[projects/core-api|Core API]]');
    expect(output).toContain('the [[projects/api]] endpoint.');
  });

  it('reports dry-run links with line numbers and protected-range filtering', () => {
    const index = createIndex([
      ['core api', 'projects/core-api'],
      ['justin', 'people/justin'],
    ]);

    const content = [
      'Title',
      'Mention Justin here.',
      '`Core API` should not be linked here.',
      'Core API should be linked here.',
    ].join('\n');

    const dryRun = dryRunLink(content, index);
    const unlinked = findUnlinkedMentions(content, index);

    expect(dryRun).toEqual([
      { alias: 'Core API', path: 'projects/core-api', line: 4 },
      { alias: 'Justin', path: 'people/justin', line: 2 },
    ]);
    expect(unlinked).toEqual(dryRun);
  });

  it('is idempotent across repeated runs', () => {
    const index = createIndex([
      ['alice', 'people/alice'],
      ['core api', 'projects/core-api'],
    ]);

    const input = [
      'Existing [[people/alice|Alice]] reference.',
      'Alice worked on the Core API.',
      '```md',
      'Alice and Core API should stay plain here.',
      '```',
      '`Core API` also stays plain.',
    ].join('\n');

    const linkedOnce = autoLink(input, index);
    let linkedRepeatedly = linkedOnce;
    for (let i = 0; i < 9; i++) {
      linkedRepeatedly = autoLink(linkedRepeatedly, index);
    }

    expect(linkedRepeatedly).toBe(linkedOnce);
    expect(linkedRepeatedly).not.toContain('[[[[');
  });

  it('keeps existing wiki-links stable and only links unlinked mentions', () => {
    const index = createIndex([
      ['alice', 'people/alice'],
    ]);

    const input = 'Keep [[people/alice|Alice]] unchanged and mention Alice once.';
    const output = autoLink(input, index);

    expect(output).toContain('[[people/alice|Alice]]');
    expect(output).toContain('mention [[people/alice]] once.');
    expect(output).not.toContain('[[[[people/alice');
  });

  it('does not link partial word matches', () => {
    const index = createIndex([
      ['ann', 'people/ann'],
    ]);

    const output = autoLink('Annette met Ann in Annex.', index);

    expect(output).toBe('Annette met [[people/ann]] in Annex.');
  });

  it('does not link mentions inside fenced or inline code', () => {
    const index = createIndex([
      ['alice', 'people/alice'],
      ['core api', 'projects/core-api'],
    ]);

    const input = [
      '```ts',
      'const user = "Alice";',
      '```',
      'Use `Core API` helper and then call Core API for Alice.',
    ].join('\n');

    const output = autoLink(input, index);

    expect(output).toContain('const user = "Alice";');
    expect(output).toContain('Use `Core API` helper and then call [[projects/core-api|Core API]] for [[people/alice]].');
  });

  it('does not link mentions inside filesystem paths', () => {
    const index = createIndex([
      ['openclaw', 'decisions/openclaw'],
      ['alice', 'people/alice'],
    ]);

    const input = [
      'Path /home/dadgo/.openclaw/media/inbound/file.jpg should stay plain.',
      'Alice can still be linked in prose.',
    ].join('\n');

    const output = autoLink(input, index);

    expect(output).toContain('/home/dadgo/.openclaw/media/inbound/file.jpg');
    expect(output).not.toContain('/home/dadgo/.[[decisions/openclaw]]/media');
    expect(output).toContain('[[people/alice]] can still be linked in prose.');
  });
});
