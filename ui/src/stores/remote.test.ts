import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SshStatus } from '../ipc';

const sshStatus = vi.fn<() => Promise<SshStatus>>();
vi.mock('../ipc', () => ({ sshStatus }));

const { sshCommand, useRemote } = await import('./remote');

beforeEach(() => {
  vi.resetAllMocks();
  useRemote.setState({ available: false, hosts: [] });
});

describe('sshCommand', () => {
  it('connects to a machine, with or without a user', () => {
    expect(sshCommand('web')).toBe('ssh web');
    expect(sshCommand('deploy@203.0.113.7')).toBe('ssh deploy@203.0.113.7');
    expect(sshCommand('  ana@db-1.internal  ')).toBe('ssh ana@db-1.internal');
    expect(sshCommand('_svc@host_2')).toBe('ssh _svc@host_2');
  });

  it.each([
    '',
    '   ',
    'web; rm -rf ~',
    'web && calc',
    'web | sh',
    'a b',
    '$(whoami)@web',
    '`id`',
    'web\nwhoami',
    '-oProxyCommand=calc',
    'ana@-oProxyCommand=calc',
    '-l root web',
    'ana@',
    '@web',
    'ana@web@other',
    '"web"',
    'x'.repeat(256),
  ])('refuses %j', (target) => {
    expect(sshCommand(target)).toBeNull();
  });
});

describe('remote store', () => {
  it('keeps the hosts that can be offered', async () => {
    sshStatus.mockResolvedValueOnce({
      available: true,
      hosts: [
        { name: 'web', address: 'deploy@203.0.113.7' },
        { name: '-oProxyCommand=calc', address: null },
        { name: 'db', address: null },
      ],
    });

    await useRemote.getState().refresh();

    expect(useRemote.getState().available).toBe(true);
    expect(useRemote.getState().hosts.map((host) => host.name)).toEqual(['web', 'db']);
  });

  it('keeps what it knew when the machine cannot be checked', async () => {
    useRemote.setState({ available: true, hosts: [{ name: 'web', address: null }] });
    sshStatus.mockRejectedValueOnce(new Error('no answer'));

    await useRemote.getState().refresh();

    expect(useRemote.getState().hosts).toHaveLength(1);
  });
});
