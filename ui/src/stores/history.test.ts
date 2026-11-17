import { beforeEach, describe, expect, it, vi } from 'vitest';

const historyList = vi.fn<() => Promise<string[]>>();
const historyAdd = vi.fn<(command: string) => Promise<string[]>>();
const historyClear = vi.fn<() => Promise<void>>();
vi.mock('../ipc', () => ({ historyList, historyAdd, historyClear }));

const { useHistory } = await import('./history');

beforeEach(() => {
  vi.resetAllMocks();
  useHistory.setState({ entries: [] });
});

describe('history store', () => {
  it('loads the remembered commands', async () => {
    historyList.mockResolvedValueOnce(['git status']);

    await useHistory.getState().load();

    expect(useHistory.getState().entries).toEqual(['git status']);
  });

  it('keeps the list the core answers with, which may have dropped the command', async () => {
    useHistory.setState({ entries: ['git status'] });
    historyAdd.mockResolvedValueOnce(['git status']);

    await useHistory.getState().record('export TOKEN=abc');

    expect(historyAdd).toHaveBeenCalledWith('export TOKEN=abc');
    expect(useHistory.getState().entries).toEqual(['git status']);
  });

  it('keeps working when a command cannot be remembered', async () => {
    useHistory.setState({ entries: ['git status'] });
    historyAdd.mockRejectedValueOnce(new Error('disk full'));

    await useHistory.getState().record('npm test');

    expect(useHistory.getState().entries).toEqual(['git status']);
  });

  it('forgets everything', async () => {
    useHistory.setState({ entries: ['git status'] });
    historyClear.mockResolvedValueOnce();

    await useHistory.getState().clear();

    expect(historyClear).toHaveBeenCalled();
    expect(useHistory.getState().entries).toEqual([]);
  });
});
