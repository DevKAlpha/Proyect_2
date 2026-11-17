import { describe, expect, it } from 'vitest';
import {
  elapsedLabel,
  showsWorking,
  verbFor,
  VERBS,
  WORKING_HEIGHT,
  WORKING_WIDTH,
  workingFrame,
} from './working';

describe('showsWorking', () => {
  it('swims for commands that work on their own', () => {
    for (const command of [
      'npm install',
      'cargo build --release',
      'git clone https://github.com/a/b',
      'ping 192.168.1.1',
      'python build.py',
      'node server.js',
      'docker compose up --build',
      'Start-Sleep 30',
    ]) {
      expect(showsWorking(command), command).toBe(true);
    }
  });

  it('stays away from programs that talk with the user', () => {
    for (const command of [
      'vim notas.txt',
      'C:\\Tools\\nvim.exe',
      './less registro.log',
      'claude',
      'ssh servidor',
      'top',
      'man ls',
    ]) {
      expect(showsWorking(command), command).toBe(false);
    }
  });

  it('a shell or a language console without arguments is interactive', () => {
    expect(showsWorking('python')).toBe(false);
    expect(showsWorking('node')).toBe(false);
    expect(showsWorking('pwsh')).toBe(false);
    expect(showsWorking('pwsh -File build.ps1')).toBe(true);
  });

  it('a container with a terminal attached is interactive', () => {
    expect(showsWorking('docker run -it ubuntu bash')).toBe(false);
    expect(showsWorking('docker exec -ti web sh')).toBe(false);
    expect(showsWorking('docker run --rm ubuntu echo hola')).toBe(true);
  });

  it('nothing typed is nothing to wait for', () => {
    expect(showsWorking('   ')).toBe(false);
  });
});

describe('elapsedLabel', () => {
  it('says seconds, then minutes, then hours', () => {
    expect(elapsedLabel(0)).toBe('0 s');
    expect(elapsedLabel(12_400)).toBe('12 s');
    expect(elapsedLabel(65_000)).toBe('1 min 05 s');
    expect(elapsedLabel(3_725_000)).toBe('1 h 02 min');
  });
});

describe('verbFor', () => {
  it('keeps one word for the whole command and changes between commands', () => {
    expect(verbFor(5_000)).toBe(verbFor(5_999));
    expect(new Set([0, 1000, 2000, 3000].map(verbFor)).size).toBe(4);
    expect(VERBS).toContain(verbFor(123_456));
  });
});

describe('workingFrame', () => {
  it('is always the same size', () => {
    for (let tick = 0; tick < 12; tick++) {
      const frame = workingFrame(tick);
      expect(frame).toHaveLength(WORKING_HEIGHT);
      expect(frame.every((row) => row.length === WORKING_WIDTH)).toBe(true);
    }
  });

  it('the duck bobs: its hat is one row lower in the second half', () => {
    expect(workingFrame(0)[0]).toContain('W');
    expect(workingFrame(3)[0]).not.toContain('W');
    expect(workingFrame(3)[1]).toContain('W');
    expect(workingFrame(6)[0]).toContain('W');
  });

  it('the water moves one dot per frame', () => {
    const water = (tick: number) => workingFrame(tick)[WORKING_HEIGHT - 1]!;
    expect(water(1).slice(0, -1)).toBe(water(0).slice(1));
    // The waves repeat every six dots, so six frames bring them back.
    expect(water(6)).toBe(water(0));
  });
});
