import { createMemorySlotPlugin, registerMemorySlot } from './plugin/slot.js';

const clawvaultPlugin = {
  id: "clawvault",
  name: "ClawVault",
  description: "Structured memory system for AI agents with context death resilience",
  register(runtime?: Record<string, unknown>) {
    // Hooks and CLI remain package-driven; this entry now also publishes
    // a memory slot implementation for plugins.slots.memory.
    if (runtime && typeof runtime === 'object') {
      registerMemorySlot(runtime);
    }
    return createMemorySlotPlugin();
  },
};

export default clawvaultPlugin;
export { createMemorySlotPlugin };
