import { describe, expect, it } from 'vitest';
import { isVideo, pastedText, pathsToInput, planPaste, quotePath } from './paste';

describe('pastedText', () => {
  it('keeps text, tabs and line ends', () => {
    expect(pastedText('git status\n\tcañón ñ 日本\r\n')).toBe('git status\n\tcañón ñ 日本\r\n');
  });

  it('removes the mark that would end the paste and run what follows', () => {
    const copied = 'echo hola\x1b[201~\nrm -rf ~\n';

    expect(pastedText(copied)).toBe('echo hola[201~\nrm -rf ~\n');
    expect(pastedText(copied)).not.toContain('\x1b');
  });

  it('removes every other control character, also the 8-bit ones', () => {
    expect(pastedText('a\x00b\x07c\x08d\x7fe\x9b201~f\x1b]0;x\x07')).toBe('abcde201~f]0;x');
  });
});

describe('planPaste', () => {
  it('a protected paste goes in whole: the shell waits for Enter', () => {
    expect(planPaste('ls\nrm -rf ~\n', true)).toEqual({ text: 'ls\nrm -rf ~\n', lines: 1 });
  });

  it('unprotected, a copied command does not run by itself', () => {
    expect(planPaste('git status\r\n', false)).toEqual({ text: 'git status', lines: 1 });
    expect(planPaste('git status\n\n', false)).toEqual({ text: 'git status', lines: 1 });
  });

  it('unprotected, several lines are counted so the user can be asked', () => {
    expect(planPaste('echo a\necho b\r\necho c\n', false)).toEqual({
      text: 'echo a\necho b\r\necho c',
      lines: 3,
    });
  });

  it('removes control characters in both cases', () => {
    expect(planPaste('a\x1b[201~\nb', true).text).toBe('a[201~\nb');
    expect(planPaste('a\x1b[201~\nb', false)).toEqual({ text: 'a[201~\nb', lines: 2 });
  });
});

describe('quotePath on PowerShell outside Windows', () => {
  it('a double quote in a file name cannot close the quotes', () => {
    expect(quotePath('/tmp/a"; rm -rf ~; ".png', 'pwsh')).toBe(`'/tmp/a"; rm -rf ~; ".png'`);
  });
});

describe('isVideo', () => {
  it('knows videos by their ending, in any case', () => {
    expect(isVideo('C:\\Vídeos\\demo.mp4')).toBe(true);
    expect(isVideo('/home/ana/clip.MOV')).toBe(true);
    expect(isVideo('grabación.webm')).toBe(true);
  });

  it('lets every other kind of file through', () => {
    for (const path of [
      'captura.png',
      'informe.pdf',
      'datos.xlsx',
      'notas.txt',
      'src/app.ts',
      'archivo.tar.gz',
      'Makefile',
      '.mp4',
      'C:\\carpeta.mp4\\foto.jpg',
    ]) {
      expect(isVideo(path), path).toBe(false);
    }
  });
});

describe('quotePath', () => {
  it('leaves a plain path as it is', () => {
    expect(quotePath('C:\\Users\\ana\\foto.png', 'pwsh')).toBe('C:\\Users\\ana\\foto.png');
    expect(quotePath('C:\\Users\\ana\\foto.png', 'cmd')).toBe('C:\\Users\\ana\\foto.png');
    expect(quotePath('/home/ana/foto.png', 'bash')).toBe('/home/ana/foto.png');
  });

  it('quotes a path with spaces the way each shell does', () => {
    const path = 'C:\\Mis cosas\\foto 1.png';

    expect(quotePath(path, 'pwsh')).toBe('"C:\\Mis cosas\\foto 1.png"');
    expect(quotePath(path, 'cmd')).toBe('"C:\\Mis cosas\\foto 1.png"');
    expect(quotePath(path, 'git-bash')).toBe("'C:\\Mis cosas\\foto 1.png'");
    expect(quotePath('/home/ana/mis cosas/a.png', 'zsh')).toBe("'/home/ana/mis cosas/a.png'");
  });

  it('keeps the backslashes of a Windows path alive in Git Bash', () => {
    expect(quotePath('C:\\Users\\ana\\foto.png', 'git-bash')).toBe("'C:\\Users\\ana\\foto.png'");
  });

  it('never lets a file name run as a command', () => {
    expect(quotePath('/tmp/$(rm -rf ~).png', 'bash')).toBe("'/tmp/$(rm -rf ~).png'");
    expect(quotePath("/tmp/it's; ls.png", 'bash')).toBe("'/tmp/it'\\''s; ls.png'");
    expect(quotePath('C:\\tmp\\$(calc).png', 'pwsh')).toBe("'C:\\tmp\\$(calc).png'");
    expect(quotePath("C:\\tmp\\it's `x`.png", 'powershell')).toBe("'C:\\tmp\\it''s `x`.png'");
    expect(quotePath('C:\\tmp\\a&calc.png', 'cmd')).toBe('"C:\\tmp\\a&calc.png"');
    expect(quotePath('-rf', 'bash')).toBe("'-rf'");
  });

  it('writes a Windows path the way a shell inside WSL sees it', () => {
    expect(quotePath('C:\\Users\\ana\\foto.png', 'wsl')).toBe('/mnt/c/Users/ana/foto.png');
    expect(quotePath('D:\\Mis cosas\\a.png', 'wsl')).toBe("'/mnt/d/Mis cosas/a.png'");
  });
});

describe('pathsToInput', () => {
  it('writes every file, with a space after each', () => {
    expect(pathsToInput(['C:\\a.png', 'C:\\Mis cosas\\b.pdf'], 'pwsh')).toEqual({
      text: 'C:\\a.png "C:\\Mis cosas\\b.pdf" ',
      skipped: 0,
    });
  });

  it('leaves videos out and counts them', () => {
    expect(pathsToInput(['C:\\a.png', 'C:\\demo.mp4', 'C:\\otro.mkv'], 'cmd')).toEqual({
      text: 'C:\\a.png ',
      skipped: 2,
    });
    expect(pathsToInput(['demo.mp4'], 'bash')).toEqual({ text: '', skipped: 1 });
  });

  it('is nothing for no files', () => {
    expect(pathsToInput([], 'bash')).toEqual({ text: '', skipped: 0 });
  });
});
