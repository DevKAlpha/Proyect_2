//! Where a shell is.
//!
//! A shell changes folder without telling anyone. With the prompt marks of
//! this crate it also says, before each prompt, which folder it is in. Two
//! forms are in use and both are read here:
//!
//! - `OSC 7 ; file://host/path`, the form of Linux and macOS terminals;
//! - `OSC 9 ; 9 ; path`, the form of Windows terminals.
//!
//! What arrives is program output, so it is not trusted: any program, or a
//! file shown with `cat`, can print these sequences. [`local_folder`] only
//! accepts a plain folder path on this machine, and the caller still checks
//! that the folder exists before doing anything with it.

use std::path::{Path, PathBuf};

use crate::Os;

const ESCAPE: u8 = 0x1b;
const BELL: u8 = 0x07;
/// Longer than any real path. A sequence that never ends is dropped here.
const MAX_SEQUENCE: usize = 4096;

/// Reads the output of a shell as it arrives and picks out the folder the
/// shell reports. Output comes in chunks that can cut a sequence anywhere,
/// so the scanner remembers where it was between calls.
#[derive(Debug, Default)]
pub struct CwdScanner {
    state: State,
    sequence: Vec<u8>,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
enum State {
    /// Plain output.
    #[default]
    Ground,
    /// Right after an escape character.
    Escape,
    /// Inside an OSC sequence, collecting its text.
    Osc,
    /// Inside an OSC sequence, right after an escape character: a `\` now
    /// ends the sequence.
    OscEscape,
}

impl CwdScanner {
    /// Takes the next chunk of output. Returns the folder the shell reported
    /// in it, as the shell wrote it; the last one when there are several.
    pub fn feed(&mut self, mut bytes: &[u8]) -> Option<String> {
        let mut found = None;
        while let Some((&byte, rest)) = bytes.split_first() {
            match self.state {
                State::Ground => {
                    // Almost all output is plain text: jump to the next escape.
                    match bytes.iter().position(|&byte| byte == ESCAPE) {
                        Some(at) => {
                            bytes = &bytes[at + 1..];
                            self.state = State::Escape;
                        }
                        None => break,
                    }
                    continue;
                }
                State::Escape => {
                    self.state = match byte {
                        b']' => {
                            self.sequence.clear();
                            State::Osc
                        }
                        ESCAPE => State::Escape,
                        _ => State::Ground,
                    };
                }
                State::Osc => match byte {
                    BELL => found = self.finish().or(found),
                    ESCAPE => self.state = State::OscEscape,
                    _ if self.sequence.len() >= MAX_SEQUENCE => self.state = State::Ground,
                    _ => self.sequence.push(byte),
                },
                State::OscEscape => {
                    if byte == b'\\' {
                        found = self.finish().or(found);
                    } else {
                        // The sequence was cut short by another one: read
                        // this byte again as the start of that one.
                        self.state = State::Escape;
                        continue;
                    }
                }
            }
            bytes = rest;
        }
        found
    }

    /// Ends the sequence being collected and reads the folder in it, if any.
    fn finish(&mut self) -> Option<String> {
        self.state = State::Ground;
        reported_folder(&self.sequence)
    }
}

/// The folder named by the text of one OSC sequence, or `None` when the
/// sequence is about something else.
fn reported_folder(sequence: &[u8]) -> Option<String> {
    let text = std::str::from_utf8(sequence).ok()?;
    let folder = if let Some(path) = text.strip_prefix("9;9;") {
        // Some shells put the path in double quotes.
        path.trim_matches('"').to_owned()
    } else {
        let address = text.strip_prefix("7;")?.strip_prefix("file://")?;
        // After the name of the machine, which is not needed.
        percent_decode(&address[address.find('/')?..])?
    };
    let clean = !folder.is_empty() && !folder.chars().any(char::is_control);
    clean.then_some(folder)
}

/// Turns `%20` and the like back into characters. Text that is not valid
/// after decoding gives `None`.
fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let hex = (bytes[index] == b'%')
            .then(|| text.get(index + 1..index + 3))
            .flatten()
            .and_then(|hex| u8::from_str_radix(hex, 16).ok());
        match hex {
            Some(byte) => {
                out.push(byte);
                index += 3;
            }
            // A lone `%` is common: most shells do not encode paths at all.
            None => {
                out.push(bytes[index]);
                index += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

/// The folder on this machine that a shell means by `reported`, or `None`
/// when it is not a plain local folder.
///
/// - WSL reports folders of Linux, which this side cannot open: `None`.
/// - Git Bash writes `C:\Users` as `/c/Users`, and its own folders (`/usr`,
///   `/tmp`) live under `git_root`, the folder Git for Windows is in.
/// - A folder shared by another machine (`\\server\share`) is refused:
///   looking at it would send the user's credentials to that machine.
pub fn local_folder(
    shell_id: &str,
    reported: &str,
    os: Os,
    git_root: Option<&Path>,
) -> Option<PathBuf> {
    if shell_id == "wsl" {
        return None;
    }
    if os != Os::Windows {
        return reported.starts_with('/').then(|| PathBuf::from(reported));
    }

    let windows = match reported.strip_prefix('/') {
        // `//server/share`: another machine.
        Some(rest) if rest.starts_with('/') => return None,
        Some(rest) => {
            let (first, below) = rest.split_once('/').unwrap_or((rest, ""));
            let below = below.replace('/', "\\");
            match first.as_bytes() {
                // `/C:/Users`: a Windows path written as a web address.
                [letter, b':'] if letter.is_ascii_alphabetic() => format!("{first}\\{below}"),
                // `/c/Users`: a drive, the way Git Bash writes it.
                [letter] if letter.is_ascii_alphabetic() => {
                    format!("{}:\\{below}", first.to_ascii_uppercase())
                }
                _ => {
                    let inside = rest.replace('/', "\\");
                    return Some(git_root?.join(inside));
                }
            }
        }
        None => reported.replace('/', "\\"),
    };
    // A drive letter, a colon and a separator: nothing else is a local folder.
    let local =
        matches!(windows.as_bytes(), [letter, b':', b'\\', ..] if letter.is_ascii_alphabetic());
    local.then(|| PathBuf::from(windows))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scan(chunks: &[&[u8]]) -> Option<String> {
        let mut scanner = CwdScanner::default();
        let mut found = None;
        // In order, as output arrives: the scanner remembers between chunks.
        for chunk in chunks {
            found = scanner.feed(chunk).or(found);
        }
        found
    }

    #[test]
    fn reads_the_folder_in_both_forms() {
        assert_eq!(
            scan(&[b"\x1b]9;9;C:\\Users\\ana\x07PS> "]),
            Some("C:\\Users\\ana".to_owned())
        );
        assert_eq!(
            scan(&[b"\x1b]7;file://laptop/home/ana/web\x1b\\$ "]),
            Some("/home/ana/web".to_owned())
        );
    }

    #[test]
    fn takes_quotes_and_percent_codes_off() {
        assert_eq!(
            scan(&[b"\x1b]9;9;\"C:\\Mis cosas\"\x1b\\"]),
            Some("C:\\Mis cosas".to_owned())
        );
        assert_eq!(
            scan(&[b"\x1b]7;file://host/home/ana/mis%20cosas/100%\x07"]),
            Some("/home/ana/mis cosas/100%".to_owned())
        );
    }

    #[test]
    fn reads_a_sequence_cut_anywhere_between_chunks() {
        let output = b"ls\r\n\x1b]7;file://host/srv/app\x1b\\$ ";
        for cut in 1..output.len() {
            let (first, second) = output.split_at(cut);

            assert_eq!(
                scan(&[first, second]),
                Some("/srv/app".to_owned()),
                "cut at {cut}"
            );
        }
    }

    #[test]
    fn the_last_folder_of_a_chunk_wins() {
        assert_eq!(
            scan(&[b"\x1b]7;file://h/a\x07 text \x1b]7;file://h/b\x07"]),
            Some("/b".to_owned())
        );
    }

    #[test]
    fn other_sequences_and_plain_text_report_nothing() {
        assert_eq!(scan(&[b"plain text, 7;file://host/etc"]), None);
        assert_eq!(scan(&[b"\x1b]0;window title\x07\x1b]133;B\x07"]), None);
        assert_eq!(scan(&[b"\x1b[31mred\x1b[0m"]), None);
        assert_eq!(scan(&[b"\x1b]9;4;1;50\x07"]), None);
    }

    #[test]
    fn a_sequence_cut_short_does_not_hide_the_next_one() {
        assert_eq!(
            scan(&[b"\x1b]0;half a title\x1b]7;file://h/srv\x07"]),
            Some("/srv".to_owned())
        );
    }

    #[test]
    fn a_sequence_without_end_is_dropped() {
        let mut flood = b"\x1b]7;file://h/".to_vec();
        flood.extend(std::iter::repeat_n(b'a', MAX_SEQUENCE * 2));
        flood.push(BELL);

        assert_eq!(scan(&[&flood]), None);
    }

    #[test]
    fn a_folder_with_control_characters_is_refused() {
        assert_eq!(scan(&[b"\x1b]7;file://h/srv/%1b%5b31m\x07"]), None);
        assert_eq!(scan(&[b"\x1b]9;9;\x07"]), None);
    }

    #[test]
    fn a_windows_shell_reports_a_plain_folder() {
        let folder = local_folder("pwsh", "C:\\Users\\ana", Os::Windows, None);

        assert_eq!(folder, Some(PathBuf::from("C:\\Users\\ana")));
        assert_eq!(
            local_folder("cmd", "C:/Users/ana", Os::Windows, None),
            Some(PathBuf::from("C:\\Users\\ana"))
        );
        assert_eq!(
            local_folder("pwsh", "/C:/Users/ana", Os::Windows, None),
            Some(PathBuf::from("C:\\Users\\ana"))
        );
    }

    #[test]
    fn git_bash_drives_and_its_own_folders_become_windows_folders() {
        let git = Path::new("C:\\Program Files\\Git");

        assert_eq!(
            local_folder("git-bash", "/c/Users/ana", Os::Windows, Some(git)),
            Some(PathBuf::from("C:\\Users\\ana"))
        );
        assert_eq!(
            local_folder("git-bash", "/d", Os::Windows, Some(git)),
            Some(PathBuf::from("D:\\"))
        );
        assert_eq!(
            local_folder("git-bash", "/usr/bin", Os::Windows, Some(git)),
            Some(git.join("usr\\bin"))
        );
        assert_eq!(
            local_folder("git-bash", "/usr/bin", Os::Windows, None),
            None
        );
    }

    #[test]
    fn folders_of_another_machine_are_refused() {
        for reported in [
            "\\\\server\\share",
            "//server/share",
            "\\\\?\\C:\\Users",
            "relative\\folder",
            "C:",
            "",
        ] {
            assert_eq!(
                local_folder("pwsh", reported, Os::Windows, None),
                None,
                "{reported:?}"
            );
        }
    }

    #[test]
    fn unix_folders_must_be_absolute() {
        assert_eq!(
            local_folder("bash", "/home/ana", Os::Linux, None),
            Some(PathBuf::from("/home/ana"))
        );
        assert_eq!(local_folder("zsh", "home/ana", Os::MacOs, None), None);
    }

    #[test]
    fn wsl_folders_are_not_on_this_side() {
        assert_eq!(local_folder("wsl", "/home/ana", Os::Windows, None), None);
    }
}
