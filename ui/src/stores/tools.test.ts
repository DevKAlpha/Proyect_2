import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolStatus } from '../ipc';

const listTools = vi.fn<() => Promise<ToolStatus[]>>();
const browserOpen = vi.fn();
const browserClose = vi.fn();
vi.mock('../ipc', () => ({
  listTools,
  listAgents: async () => [],
  browserStatus: async () => null,
  browserOpen,
  browserClose,
}));

const { missingTools, useTools } = await import('./tools');

const tool = (id: string, installed: boolean): ToolStatus => ({
  id,
  name: id,
  provides: id,
  installed,
  install_command: `install ${id}`,
  website: `https://example.com/${id}`,
});

beforeEach(() => {
  listTools.mockReset();
  browserOpen.mockReset();
  browserClose.mockReset();
  useTools.setState({ tools: [], hidden: false, browser: null, browserError: null });
});

describe('tools store', () => {
  it('lists only the tools that are not installed', () => {
    const tools = [tool('node', true), tool('docker', false)];

    expect(missingTools(tools).map((item) => item.id)).toEqual(['docker']);
  });

  it('reflects a tool installed since the last check', async () => {
    listTools.mockResolvedValueOnce([tool('node', false)]);
    await useTools.getState().refresh();
    expect(missingTools(useTools.getState().tools)).toHaveLength(1);

    listTools.mockResolvedValueOnce([tool('node', true)]);
    await useTools.getState().refresh();
    expect(missingTools(useTools.getState().tools)).toHaveLength(0);
  });

  it('keeps the last result when a check fails', async () => {
    useTools.setState({ tools: [tool('node', false)] });
    listTools.mockRejectedValueOnce(new Error('ipc down'));

    await useTools.getState().refresh();

    expect(useTools.getState().tools).toHaveLength(1);
  });

  it('opens the test browser, and closes it when it is open', async () => {
    const status = (running: boolean) => ({
      browser: 'Chrome',
      running,
      endpoint: 'http://127.0.0.1:9333',
      connectors: [],
    });
    browserOpen.mockResolvedValueOnce(status(true));
    browserClose.mockResolvedValueOnce(status(false));

    await useTools.getState().toggleBrowser();
    expect(useTools.getState().browser?.running).toBe(true);

    await useTools.getState().toggleBrowser();
    expect(useTools.getState().browser?.running).toBe(false);
    expect(browserClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the reason when the test browser cannot start', async () => {
    browserOpen.mockRejectedValueOnce('port 9333 is already in use');

    await useTools.getState().toggleBrowser();

    expect(useTools.getState().browserError).toContain('9333');
    expect(useTools.getState().browser).toBeNull();
  });

  it('hides the bar when the user asks, even without storage', () => {
    useTools.getState().hide();

    expect(useTools.getState().hidden).toBe(true);
  });
});
