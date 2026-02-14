import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { canvasCommand, generateCanvas } from './canvas.js';
import { createTask, updateTask, createBacklogItem, completeTask } from '../lib/task-utils.js';
import { ensureLedgerStructure, getObservationPath, getReflectionsRoot } from '../lib/ledger.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-canvas-cmd-'));
}

describe('canvas command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    // Create .clawvault directory for graph index
    fs.mkdirSync(path.join(tempDir, '.clawvault'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateCanvas', () => {
    it('generates valid canvas structure', () => {
      const canvas = generateCanvas(tempDir);

      expect(canvas).toHaveProperty('nodes');
      expect(canvas).toHaveProperty('edges');
      expect(Array.isArray(canvas.nodes)).toBe(true);
      expect(Array.isArray(canvas.edges)).toBe(true);
    });

    it('includes knowledge graph group', () => {
      const canvas = generateCanvas(tempDir);
      const knowledgeGraphGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Knowledge Graph')
      );

      expect(knowledgeGraphGroup).toBeDefined();
      expect(knowledgeGraphGroup?.color).toBe('6'); // Purple
    });

    it('includes vault stats group', () => {
      const canvas = generateCanvas(tempDir);
      const statsGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Vault Stats')
      );

      expect(statsGroup).toBeDefined();
      expect(statsGroup?.color).toBe('5'); // Cyan
    });

    it('includes active tasks group when tasks exist', () => {
      createTask(tempDir, 'Active Task One');
      createTask(tempDir, 'Active Task Two');

      const canvas = generateCanvas(tempDir);
      const activeGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Active Tasks')
      );

      expect(activeGroup).toBeDefined();

      // Should have file nodes for tasks
      const fileNodes = canvas.nodes.filter(n => n.type === 'file' && n.file?.startsWith('tasks/'));
      expect(fileNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('includes blocked tasks group when blocked tasks exist', () => {
      const task = createTask(tempDir, 'Blocked Task', { owner: 'alice' });
      updateTask(tempDir, task.slug, { status: 'blocked', blocked_by: 'api-issue' });

      const canvas = generateCanvas(tempDir);
      const blockedGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Blocked')
      );

      expect(blockedGroup).toBeDefined();
      expect(blockedGroup?.color).toBe('1'); // Red
    });

    it('includes backlog group when backlog items exist', () => {
      createBacklogItem(tempDir, 'Backlog Item One');
      createBacklogItem(tempDir, 'Backlog Item Two');

      const canvas = generateCanvas(tempDir);
      const backlogGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Backlog')
      );

      expect(backlogGroup).toBeDefined();
    });

    it('includes recently done group when completed tasks exist', () => {
      const task = createTask(tempDir, 'Done Task');
      completeTask(tempDir, task.slug);

      const canvas = generateCanvas(tempDir);
      const doneGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Recently Done')
      );

      expect(doneGroup).toBeDefined();
      expect(doneGroup?.color).toBe('4'); // Green
    });

    it('includes data flow diagram', () => {
      const canvas = generateCanvas(tempDir);
      const dataFlowGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label === 'Data Flow'
      );

      expect(dataFlowGroup).toBeDefined();

      // Should have edges for the flow
      expect(canvas.edges.length).toBeGreaterThan(0);
    });

    it('applies priority colors to task nodes', () => {
      createTask(tempDir, 'Critical Task', { priority: 'critical' });
      createTask(tempDir, 'High Task', { priority: 'high' });
      createTask(tempDir, 'Medium Task', { priority: 'medium' });

      const canvas = generateCanvas(tempDir);
      const fileNodes = canvas.nodes.filter(n => n.type === 'file' && n.file?.startsWith('tasks/'));

      const criticalNode = fileNodes.find(n => n.file?.includes('critical-task'));
      const highNode = fileNodes.find(n => n.file?.includes('high-task'));
      const mediumNode = fileNodes.find(n => n.file?.includes('medium-task'));

      expect(criticalNode?.color).toBe('1'); // Red
      expect(highNode?.color).toBe('2'); // Orange
      expect(mediumNode?.color).toBe('3'); // Yellow
    });

    it('generates valid node IDs', () => {
      createTask(tempDir, 'Test Task');
      const canvas = generateCanvas(tempDir);

      for (const node of canvas.nodes) {
        expect(node.id).toHaveLength(16);
        expect(/^[0-9a-f]+$/.test(node.id)).toBe(true);
      }
    });

    it('generates valid edge IDs and references', () => {
      createTask(tempDir, 'Test Task');
      const canvas = generateCanvas(tempDir);
      const nodeIds = new Set(canvas.nodes.map(n => n.id));

      for (const edge of canvas.edges) {
        expect(edge.id).toHaveLength(16);
        expect(/^[0-9a-f]+$/.test(edge.id)).toBe(true);
        expect(nodeIds.has(edge.fromNode)).toBe(true);
        expect(nodeIds.has(edge.toNode)).toBe(true);
      }
    });

    it('includes vault activity group', () => {
      const canvas = generateCanvas(tempDir);
      const activityGroup = canvas.nodes.find(
        n => n.type === 'group' && n.label?.includes('Vault Activity')
      );

      expect(activityGroup).toBeDefined();
      expect(activityGroup?.color).toBe('5'); // Cyan
    });

    it('vault activity group shows observation stats', () => {
      // Create observation files
      ensureLedgerStructure(tempDir);
      const obsPath = getObservationPath(tempDir, '2026-02-14');
      fs.mkdirSync(path.dirname(obsPath), { recursive: true });
      fs.writeFileSync(obsPath, '# Test observation');

      const canvas = generateCanvas(tempDir);
      
      // Find text nodes in Vault Activity group that contain observation info
      // The Vault Activity group has "Total:" while Vault Stats has "Total days:"
      const obsNode = canvas.nodes.find(
        n => n.type === 'text' && n.text?.includes('**Observations**') && n.text?.includes('Total:') && !n.text?.includes('Total days:')
      );

      expect(obsNode).toBeDefined();
      expect(obsNode?.text).toContain('Total: 1');
    });

    it('vault activity group shows task stats', () => {
      // Create tasks with different statuses
      createTask(tempDir, 'Open Task');
      const inProgressTask = createTask(tempDir, 'In Progress Task');
      updateTask(tempDir, inProgressTask.slug, { status: 'in-progress' });
      const doneTask = createTask(tempDir, 'Done Task');
      completeTask(tempDir, doneTask.slug);

      const canvas = generateCanvas(tempDir);
      
      // Find text nodes that contain task info
      const tasksNode = canvas.nodes.find(
        n => n.type === 'text' && n.text?.includes('**Tasks**') && n.text?.includes('Total:')
      );

      expect(tasksNode).toBeDefined();
      expect(tasksNode?.text).toContain('Total: 3');
      expect(tasksNode?.text).toContain('✓ 1 done');
      expect(tasksNode?.text).toContain('● 1 active');
      expect(tasksNode?.text).toContain('○ 1 open');
    });

    it('vault activity group shows reflection stats', () => {
      // Create reflection files
      ensureLedgerStructure(tempDir);
      const reflectionsRoot = getReflectionsRoot(tempDir);
      const reflectionDir = path.join(reflectionsRoot, '2026');
      fs.mkdirSync(reflectionDir, { recursive: true });
      fs.writeFileSync(path.join(reflectionDir, '2026-W07.md'), '# Week 7 Reflection');

      const canvas = generateCanvas(tempDir);
      
      // Find text nodes that contain reflection info
      const reflNode = canvas.nodes.find(
        n => n.type === 'text' && n.text?.includes('**Reflections**')
      );

      expect(reflNode).toBeDefined();
      expect(reflNode?.text).toContain('Total: 1');
      expect(reflNode?.text).toContain('Week 07');
    });

    it('vault activity group shows session stats', () => {
      // Create handoff files
      const handoffsDir = path.join(tempDir, 'handoffs');
      fs.mkdirSync(handoffsDir, { recursive: true });
      fs.writeFileSync(path.join(handoffsDir, 'handoff-2026-02-14.md'), '# Handoff');

      // Create checkpoint
      fs.writeFileSync(
        path.join(tempDir, '.clawvault', 'last-checkpoint.json'),
        JSON.stringify({ timestamp: '2026-02-14T10:30:00Z', workingOn: 'testing' })
      );

      const canvas = generateCanvas(tempDir);
      
      // Find text nodes that contain session info
      const sessionsNode = canvas.nodes.find(
        n => n.type === 'text' && n.text?.includes('**Sessions**')
      );

      expect(sessionsNode).toBeDefined();
      expect(sessionsNode?.text).toContain('Checkpoints: 1');
      expect(sessionsNode?.text).toContain('Handoffs: 1');
    });

    it('vault activity group shows document stats', () => {
      // Create inbox documents
      const inboxDir = path.join(tempDir, 'inbox');
      fs.mkdirSync(inboxDir, { recursive: true });
      fs.writeFileSync(path.join(inboxDir, 'pending-1.md'), '# Pending');
      fs.writeFileSync(path.join(inboxDir, 'pending-2.md'), '# Pending');

      const canvas = generateCanvas(tempDir);
      
      // Find text nodes that contain document info
      const docsNode = canvas.nodes.find(
        n => n.type === 'text' && n.text?.includes('**Documents**')
      );

      expect(docsNode).toBeDefined();
      expect(docsNode?.text).toContain('Total: 2');
      expect(docsNode?.text).toContain('Inbox: 2 pending triage');
    });
  });

  describe('canvasCommand', () => {
    it('lists templates without writing a canvas file', async () => {
      const outputPath = path.join(tempDir, 'dashboard.canvas');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      let output = '';

      try {
        await canvasCommand(tempDir, { listTemplates: true });
        output = logSpy.mock.calls.flat().join('\n');
      } finally {
        logSpy.mockRestore();
      }

      expect(output).toContain('Available canvas templates:');
      expect(output).toContain('default');
      expect(output).toContain('project-board');
      expect(output).toContain('brain');
      expect(output).toContain('sprint');
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('generates selected template with project filter', async () => {
      const alphaTask = createTask(tempDir, 'Alpha Task', { project: 'alpha' });
      createTask(tempDir, 'Beta Task', { project: 'beta' });
      const outputPath = path.join(tempDir, 'project-board.canvas');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      try {
        await canvasCommand(tempDir, {
          template: 'project-board',
          project: 'alpha',
          output: outputPath
        });
      } finally {
        logSpy.mockRestore();
      }

      expect(fs.existsSync(outputPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as {
        nodes: Array<{ type: string; file?: string; text?: string }>;
      };
      // Project-board uses text cards — verify by content
      const allText = parsed.nodes
        .filter((node: { type: string; text?: string }) => node.type === 'text' && node.text)
        .map((node: { text?: string }) => node.text!)
        .join('\n');
      expect(allText).toContain('Alpha Task');
      expect(allText).not.toContain('Beta Task');
    });

    it('throws for unknown template ids', async () => {
      await expect(canvasCommand(tempDir, { template: 'unknown-template' }))
        .rejects
        .toThrow('Unknown canvas template');
    });
  });
});
