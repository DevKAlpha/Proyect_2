import { describe, expect, it, vi } from 'vitest';

// The store imports the Tauri bridge, which needs a real window.
vi.mock('../ipc', () => ({}));

const { effectiveFontSize, pickDefaultShell, useSettings } = await import('./settings');

describe('font zoom', () => {
  it('adds the zoom to the configured size', () => {
    expect(effectiveFontSize(14, 2)).toBe(16);
    expect(effectiveFontSize(14, -3)).toBe(11);
  });

  it('keeps the size readable at both ends', () => {
    expect(effectiveFontSize(14, -100)).toBe(6);
    expect(effectiveFontSize(14, 100)).toBe(48);
  });

  it('does not store zoom beyond the limit, so zooming back works at once', () => {
    useSettings.setState({ zoom: 0, config: null });
    for (let i = 0; i < 20; i++) useSettings.getState().zoomBy(-1);
    expect(useSettings.getState().zoom).toBe(-8);

    useSettings.getState().zoomBy(1);
    expect(useSettings.getState().zoom).toBe(-7);

    useSettings.getState().resetZoom();
    expect(useSettings.getState().zoom).toBe(0);
  });
});

const shells = [
  { id: 'pwsh', name: 'PowerShell', program: 'pwsh.exe', args: [] },
  { id: 'cmd', name: 'Command Prompt', program: 'cmd.exe', args: [] },
];

describe('pickDefaultShell', () => {
  it('uses the configured shell when it is installed', () => {
    expect(pickDefaultShell({ default_shell: 'cmd' }, shells)?.id).toBe('cmd');
  });

  it('falls back to the first shell when none is configured', () => {
    expect(pickDefaultShell({ default_shell: null }, shells)?.id).toBe('pwsh');
  });

  it('falls back to the first shell when the configured one is missing', () => {
    expect(pickDefaultShell({ default_shell: 'fish' }, shells)?.id).toBe('pwsh');
  });

  it('returns nothing when no shell was found', () => {
    expect(pickDefaultShell({ default_shell: null }, [])).toBeUndefined();
  });
});
