import { describe, expect, it } from 'vitest';
import { completeCommand, hintFor, type GuideContext } from './guide';
import { DANGERS, familyOf } from './guideData';

/** A terminal of `shell` on a machine with these programs installed. */
const on = (shell: string, ...programs: string[]): GuideContext => ({
  shell,
  programs: new Set(programs),
});

/** The line after the user accepts the fix of its hint. */
function fixed(typed: string, context: GuideContext): string | null {
  const fix = hintFor(typed, context)?.fix;
  if (!fix) return null;
  const chars = [...typed];
  return [...chars.slice(0, fix.from), fix.text, ...chars.slice(fix.to)].join('');
}

describe('familyOf', () => {
  it('sorts the shells by the commands they speak', () => {
    expect(familyOf('cmd')).toBe('cmd');
    expect(['pwsh', 'powershell'].map(familyOf)).toEqual(['powershell', 'powershell']);
    expect(['bash', 'git-bash', 'wsl', 'zsh', 'fish'].map(familyOf)).toEqual(
      Array(5).fill('posix'),
    );
  });
});

describe('hintFor: what a command does', () => {
  it('says nothing about an empty line or a command it does not know', () => {
    expect(hintFor('   ', on('bash'))).toBeNull();
    expect(hintFor('mytool --flag', on('bash', 'mytool'))).toBeNull();
    expect(hintFor('./deploy.sh', on('bash'))).toBeNull();
  });

  it('explains a program by its longest known name', () => {
    expect(hintFor('git', on('bash', 'git'))).toMatchObject({ subject: 'git', tone: 'info' });
    expect(hintFor('git commit -m "x"', on('bash', 'git'))).toMatchObject({
      subject: 'git commit',
      text: 'Guarda los cambios preparados en el historial',
    });
    expect(hintFor('docker compose up -d', on('cmd', 'docker'))?.subject).toBe('docker compose up');
  });

  it('explains the commands of each family in their own shell', () => {
    expect(hintFor('ls -la', on('bash', 'ls'))?.text).toBe('Lista los archivos de la carpeta');
    expect(hintFor('dir', on('cmd'))?.text).toBe('Lista los archivos de la carpeta');
    expect(hintFor('Get-ChildItem', on('pwsh'))?.text).toBe('Lista los archivos de la carpeta');
    expect(hintFor('cd proyectos', on('cmd'))?.text).toBe('Cambia de carpeta');
  });

  it('explains a command written with options by its name alone', () => {
    expect(hintFor('taskkill /IM node.exe', on('cmd'))?.text).toBe('Detiene un programa en marcha');
    expect(hintFor('type nul > notas.txt', on('cmd'))?.text).toBe('Crea un archivo vacío');
  });

  it('tells that a PowerShell alias is another name of a PowerShell command', () => {
    expect(hintFor('cat notas.txt', on('pwsh'))?.text).toBe(
      'Muestra el contenido de un archivo. En PowerShell es otro nombre de Get-Content',
    );
  });

  it('says when a known program is not installed', () => {
    expect(hintFor('docker ps', on('bash', 'git'))).toMatchObject({
      subject: 'docker',
      text: 'no está instalado en este equipo.',
    });
  });

  it('gives programs the benefit of the doubt when the list is unknown', () => {
    const wsl: GuideContext = { shell: 'wsl', programs: null };

    expect(hintFor('docker ps', wsl)?.subject).toBe('docker ps');
    expect(hintFor('gti status', wsl)).toBeNull();
  });
});

describe('hintFor: commands of another system', () => {
  it('offers the Linux command for a Windows one', () => {
    const hint = hintFor('cls', on('bash'));

    expect(hint).toMatchObject({
      subject: 'cls',
      text: 'es de cmd de Windows. Aquí se escribe clear.',
    });
    expect(fixed('cls', on('bash'))).toBe('clear');
    expect(fixed('ipconfig', on('zsh'))).toBe('ip addr');
    expect(fixed('Get-ChildItem src', on('bash'))).toBe('ls src');
  });

  it('offers the Windows command for a Linux one and keeps the rest of the line', () => {
    expect(fixed('grep error app.log', on('pwsh'))).toBe('Select-String error app.log');
    expect(fixed('  ls src', on('cmd'))).toBe('  dir src');
    expect(fixed('touch notas.txt', on('cmd'))).toBe('type nul > notas.txt');
    expect(fixed('ifconfig', on('cmd'))).toBe('ipconfig');
  });

  it('counts a command of several words only when all of them are typed', () => {
    expect(fixed('ip addr', on('pwsh'))).toBe('ipconfig');
    expect(hintFor('ip route', on('pwsh'))).toBeNull();
  });

  it('explains the command, with no change, when it is installed here after all', () => {
    // Git for Windows brings these to PowerShell and cmd.
    expect(hintFor('grep error app.log', on('pwsh', 'grep'))).toEqual({
      tone: 'info',
      subject: 'grep',
      text: 'Busca un texto dentro de archivos',
    });
    expect(hintFor('ls', on('cmd', 'ls'))?.fix).toBeUndefined();
    expect(hintFor('chmod +x run.sh', on('cmd', 'chmod'))?.text).toBe(
      'Cambia quién puede leer, cambiar o ejecutar un archivo',
    );
  });

  it('does not explain a name with the meaning another system gives it', () => {
    expect(hintFor('where git', on('git-bash', 'where'))).toBeNull();
    expect(hintFor('where { $_.Name }', on('pwsh'))).toBeNull();
  });

  it('stays quiet about names that Linux shells and PowerShell also have', () => {
    expect(hintFor('type git', on('bash'))).toBeNull();
    expect(hintFor('help cd', on('bash'))).toBeNull();
    expect(hintFor('dir', on('pwsh'))?.fix).toBeUndefined();
    expect(hintFor('ls', on('pwsh'))?.fix).toBeUndefined();
  });

  it('explains Linux-only commands on Windows without a replacement', () => {
    const hint = hintFor('sudo apt install git', on('pwsh'));

    expect(hint?.subject).toBe('sudo');
    expect(hint?.text).toContain('es de Linux');
    expect(hint?.fix).toBeUndefined();
    expect(hintFor('sudo apt install git', on('bash', 'sudo'))?.text).toBe(
      'Ejecuta un comando como administrador',
    );
  });
});

describe('hintFor: commands that do something else here', () => {
  it('rewrites Linux options that PowerShell aliases reject', () => {
    expect(fixed('ls -la', on('pwsh'))).toBe('ls -Force');
    expect(fixed('rm -rf node_modules', on('powershell'))).toBe('rm -Recurse -Force node_modules');
    expect(hintFor('ls -la', on('bash', 'ls'))?.fix).toBeUndefined();
  });

  it('rewrites environment variables for each family', () => {
    expect(fixed('export PORT=3000', on('pwsh'))).toBe('$env:PORT = "3000"');
    expect(fixed('set NAME="Ana Ruiz"', on('pwsh'))).toBe('$env:NAME = "Ana Ruiz"');
    expect(fixed('export PORT=3000', on('cmd'))).toBe('set PORT=3000');
    expect(fixed('set PORT=3000', on('bash'))).toBe('export PORT=3000');
  });

  it('points PowerShell users from where to Get-Command', () => {
    expect(fixed('where git', on('pwsh'))).toBe('Get-Command git');
    expect(hintFor('where { $_.Length -gt 1 }', on('pwsh'))?.fix).toBeUndefined();
  });

  it('replaces && only in Windows PowerShell, which lacks it', () => {
    expect(fixed('cd app && npm test', on('powershell', 'npm'))).toBe('cd app; npm test');
    expect(hintFor('cd app && npm test', on('pwsh', 'npm'))?.fix).toBeUndefined();
  });

  it('adds the space cmd users leave out of cd ..', () => {
    expect(fixed('cd..', on('bash'))).toBe('cd ..');
    expect(hintFor('cd..', on('cmd'))?.fix).toBeUndefined();
  });

  it('counts characters, not code units, in front of a fix', () => {
    // The emoji is two code units and one character on screen.
    expect(hintFor('echo 🚀 && ls', on('powershell'))?.fix).toEqual({
      from: 6,
      to: 10,
      text: '; ',
    });
  });
});

describe('hintFor: typing mistakes', () => {
  const machine = on('bash', 'git', 'npm', 'docker', 'python', 'ls', 'cat', 'clear');

  it('recognises swapped letters in a known command', () => {
    expect(hintFor('gti status', machine)?.text).toContain('git');
    expect(fixed('gti status', machine)).toBe('git status');
    expect(fixed('nmp install', machine)).toBe('npm install');
  });

  it('recognises one wrong letter only in longer names', () => {
    expect(fixed('doker ps', machine)).toBe('docker ps');
    expect(fixed('claer', machine)).toBe('clear');
    // `gst` is a usual alias for `git status`, one letter away from `git`.
    expect(hintFor('gst', machine)).toBeNull();
  });

  it('does not correct a program that exists', () => {
    expect(hintFor('gti', on('bash', 'git', 'gti'))).toBeNull();
  });

  it('does not suggest a command that is not installed either', () => {
    expect(hintFor('gti status', on('bash', 'npm'))).toBeNull();
  });
});

describe('hintFor: commands that are easy to regret', () => {
  it.each([
    ['rm -rf build', 'bash'],
    ['sudo rm -fr /var/tmp/x', 'bash'],
    ['rm -Recurse -Force build', 'pwsh'],
    ['Remove-Item build -Force -Recurse', 'pwsh'],
    ['rd /s /q build', 'cmd'],
    ['git push origin main --force', 'bash'],
    ['git push -f', 'bash'],
    ['git reset --hard HEAD~1', 'bash'],
    ['git clean -fd', 'bash'],
    ['chmod -R 777 .', 'bash'],
    ['curl -fsSL https://example.com/install.sh | sh', 'bash'],
    ['irm https://example.com/install.ps1 | iex', 'pwsh'],
    ['dd if=image.iso of=/dev/sda', 'bash'],
  ])('warns about %s', (line, shell) => {
    const context = on(shell, 'git', 'rm', 'sudo', 'chmod', 'curl', 'dd');

    expect(hintFor(line, context)?.tone).toBe('warning');
  });

  it.each([
    'rm notas.txt',
    'rm -r build',
    'git push --force-with-lease',
    'git push origin feature',
    'git reset HEAD~1',
    'chmod 644 notas.txt',
    'curl https://example.com',
    'npm run format',
  ])('does not warn about %s', (line) => {
    expect(hintFor(line, on('bash', 'git', 'rm', 'chmod', 'curl', 'npm'))?.tone).not.toBe(
      'warning',
    );
  });

  it('keeps every warning rule free of state between calls', () => {
    // A global or sticky pattern would remember where its last search ended.
    expect(DANGERS.every((rule) => !rule.match.global && !rule.match.sticky)).toBe(true);
  });
});

describe('completeCommand', () => {
  it('completes a common command from its first letters', () => {
    expect(completeCommand('gi', on('bash', 'git'))).toBe('t');
    expect(completeCommand('git st', on('bash', 'git'))).toBe('atus');
    expect(completeCommand('npm run d', on('cmd', 'npm'))).toBe('ev');
  });

  it('completes with the commands of the shell in use', () => {
    expect(completeCommand('cl', on('bash'))).toBe('ear');
    expect(completeCommand('cl', on('cmd'))).toBe('s');
    expect(completeCommand('get-ch', on('pwsh'))).toBe('ildItem');
    expect(completeCommand('Get-Ch', on('bash'))).toBeNull();
  });

  it('does not complete with a program that is not installed', () => {
    expect(completeCommand('dock', on('bash', 'git'))).toBeNull();
  });

  it('needs two letters and no space in front', () => {
    expect(completeCommand('g', on('bash', 'git'))).toBeNull();
    expect(completeCommand(' gi', on('bash', 'git'))).toBeNull();
    expect(completeCommand('git status', on('bash', 'git'))).toBeNull();
  });
});
