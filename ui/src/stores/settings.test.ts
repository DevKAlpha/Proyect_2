import { describe, expect, it, vi } from 'vitest';

// The store imports the Tauri bridge, which needs a real window.
vi.mock('../ipc', () => ({}));

const { pickDefaultShell } = await import('./settings');

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
