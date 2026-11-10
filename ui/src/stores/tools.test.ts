import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolStatus } from '../ipc';

const listTools = vi.fn<() => Promise<ToolStatus[]>>();
vi.mock('../ipc', () => ({ listTools }));

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
  useTools.setState({ tools: [], hidden: false });
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

  it('hides the bar when the user asks, even without storage', () => {
    useTools.getState().hide();

    expect(useTools.getState().hidden).toBe(true);
  });
});
