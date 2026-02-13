import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  spawnMock,
  resolveConfiguredVaultPathMock,
  clawvaultCtorMock,
  loadMock
} = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  resolveConfiguredVaultPathMock: vi.fn(),
  clawvaultCtorMock: vi.fn(),
  loadMock: vi.fn()
}));

vi.mock('child_process', () => ({
  spawn: spawnMock
}));

vi.mock('../dist/index.js', () => ({
  ClawVault: clawvaultCtorMock,
  resolveVaultPath: resolveConfiguredVaultPathMock,
  QmdUnavailableError: class QmdUnavailableError extends Error {},
  QMD_INSTALL_COMMAND: 'install-qmd'
}));

async function loadRuntimeModule() {
  vi.resetModules();
  return await import('./command-runtime.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  clawvaultCtorMock.mockImplementation(() => ({
    load: loadMock
  }));
});

describe('command runtime helpers', () => {
  it('delegates vault path resolution and loads vaults', async () => {
    resolveConfiguredVaultPathMock.mockReturnValue('/resolved/vault');
    loadMock.mockResolvedValue(undefined);
    const { getVault, resolveVaultPath } = await loadRuntimeModule();

    const resolved = resolveVaultPath('/explicit');
    expect(resolveConfiguredVaultPathMock).toHaveBeenCalledWith({ explicitPath: '/explicit' });
    expect(resolved).toBe('/resolved/vault');

    await getVault('/explicit');
    expect(clawvaultCtorMock).toHaveBeenCalledWith('/resolved/vault');
    expect(loadMock).toHaveBeenCalled();
  });

  it('maps qmd ENOENT failures to QmdUnavailableError', async () => {
    const { runQmd, QmdUnavailableError } = await loadRuntimeModule();
    spawnMock.mockImplementation(() => {
      const handlers = {};
      const proc = {
        on: (event, handler) => {
          handlers[event] = handler;
        }
      };
      queueMicrotask(() => {
        handlers.error?.({ code: 'ENOENT' });
      });
      return proc;
    });

    await expect(runQmd(['update'])).rejects.toBeInstanceOf(QmdUnavailableError);
  });

  it('surfaces qmd non-zero exit codes as errors', async () => {
    const { runQmd } = await loadRuntimeModule();
    spawnMock.mockImplementation(() => {
      const handlers = {};
      const proc = {
        on: (event, handler) => {
          handlers[event] = handler;
        }
      };
      queueMicrotask(() => {
        handlers.close?.(2);
      });
      return proc;
    });

    await expect(runQmd(['update'])).rejects.toThrow('qmd exited with code 2');
  });

  it('prints consistent qmd missing guidance', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { printQmdMissing } = await loadRuntimeModule();
      printQmdMissing();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ClawVault requires qmd.'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('install-qmd'));
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
