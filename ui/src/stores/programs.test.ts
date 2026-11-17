import { beforeEach, describe, expect, it, vi } from 'vitest';

const listPrograms = vi.fn<(shellId: string) => Promise<string[] | null>>();
vi.mock('../ipc', () => ({ listPrograms }));

const { usePrograms } = await import('./programs');

beforeEach(() => {
  vi.resetAllMocks();
  usePrograms.setState({ byShell: {} });
});

describe('programs store', () => {
  it('keeps the programs of each shell, in lower case', async () => {
    listPrograms.mockResolvedValueOnce(['git', 'Xorg']);

    await usePrograms.getState().refresh('bash');

    expect(listPrograms).toHaveBeenCalledWith('bash');
    expect([...usePrograms.getState().byShell.bash!]).toEqual(['git', 'xorg']);
  });

  it('remembers that the programs of a shell cannot be known', async () => {
    listPrograms.mockResolvedValueOnce(null);

    await usePrograms.getState().refresh('wsl');

    expect(usePrograms.getState().byShell).toEqual({ wsl: null });
  });

  it('keeps the last list when the machine cannot be checked', async () => {
    usePrograms.setState({ byShell: { bash: new Set(['git']) } });
    listPrograms.mockRejectedValueOnce(new Error('no answer'));

    await usePrograms.getState().refresh('bash');

    expect([...usePrograms.getState().byShell.bash!]).toEqual(['git']);
  });
});
