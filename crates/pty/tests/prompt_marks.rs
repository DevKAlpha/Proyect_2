//! Suggestions and editing by selection only work if the mark a shell prints
//! after its prompt really reaches the terminal. That depends on the shell,
//! on how it is started and on the pseudo-terminal in between, so it is
//! checked here against the real thing, started exactly as the app does.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use term_pty::{PtySession, SpawnOptions};
use term_shell::{detect_shells, install_support, prompt_marks};

/// The mark that ends a prompt, without its terminator (shells differ on it).
const PROMPT_END: &str = "\x1b]133;B";
/// ConPTY asks where the cursor is at start and waits for this answer.
const CURSOR_QUERY: &str = "\x1b[6n";
const CURSOR_ANSWER: &[u8] = b"\x1b[1;1R";

/// Starts the detected shell `id` with its marks and returns what it printed
/// until its first prompt was complete. `None` when this machine lacks it.
fn first_prompt(id: &str) -> Option<String> {
    let shell = detect_shells().into_iter().find(|shell| shell.id == id)?;
    // The start-up files some shells need, as the app writes them at start.
    let support = tempfile::tempdir().expect("a temporary folder");
    install_support(support.path()).expect("support files are written");
    let marks = prompt_marks(
        &shell.id,
        &|key| std::env::var(key).ok(),
        Some(support.path()),
    );
    let mut args = shell.args;
    args.extend(marks.args);

    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    let mut session = PtySession::spawn(
        SpawnOptions {
            program: shell.program,
            args,
            cwd: None,
            env: marks.env,
            cols: 100,
            rows: 24,
        },
        move |bytes| {
            let _ = tx.send(bytes.to_vec());
        },
        |_| {},
    )
    .expect("shell starts");

    let deadline = Instant::now() + Duration::from_secs(30);
    let mut output = String::new();
    while !output.contains(PROMPT_END) {
        assert!(
            Instant::now() < deadline,
            "{id} never marked its prompt; output: {output:?}"
        );
        if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(200)) {
            let text = String::from_utf8_lossy(&chunk);
            if text.contains(CURSOR_QUERY) {
                session.write(CURSOR_ANSWER).expect("answer is written");
            }
            output.push_str(&text);
        }
    }
    Some(output)
}

/// The mark must come right after the prompt text: it is where the user's
/// command starts on screen. Only the shells of Windows have a prompt whose
/// last character is known beforehand.
#[cfg(windows)]
fn assert_mark_follows(output: &str, prompt_tail: &str) {
    let mark = output.find(PROMPT_END).expect("mark is present");
    assert!(
        output[..mark].trim_end_matches(' ').ends_with(prompt_tail),
        "the mark does not follow the prompt: {output:?}"
    );
}

#[cfg(windows)]
#[test]
fn windows_powershell_marks_the_end_of_its_prompt() {
    let output = first_prompt("powershell").expect("Windows always has Windows PowerShell");

    assert_mark_follows(&output, ">");
}

#[cfg(windows)]
#[test]
fn cmd_marks_the_end_of_its_prompt() {
    let output = first_prompt("cmd").expect("Windows always has cmd");

    assert_mark_follows(&output, ">");
}

#[test]
fn bash_marks_the_end_of_its_prompt_when_installed() {
    // Git Bash on Windows, plain bash elsewhere. Neither is guaranteed.
    let id = if cfg!(windows) { "git-bash" } else { "bash" };
    if let Some(output) = first_prompt(id) {
        assert!(output.contains(PROMPT_END));
    }
}

#[cfg(unix)]
#[test]
fn zsh_and_fish_mark_the_end_of_their_prompt_when_installed() {
    for id in ["zsh", "fish"] {
        if let Some(output) = first_prompt(id) {
            assert!(output.contains(PROMPT_END), "{id}");
        }
    }
}
