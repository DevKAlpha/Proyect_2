//! Runs a real shell. ConPTY and forkpty behave differently, so these tests
//! must pass on every platform in CI.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use term_pty::{PtySession, SpawnOptions};

const TIMEOUT: Duration = Duration::from_secs(15);

/// "Where is the cursor?" ConPTY asks this at start and waits for the answer.
const CURSOR_QUERY: &str = "\x1b[6n";
/// "Row 1, column 1."
const CURSOR_ANSWER: &[u8] = b"\x1b[1;1R";

/// Runs `script` in the platform shell, playing the part of the terminal
/// emulator. Returns once the shell exited and `marker` showed up in the
/// output.
fn run(script: &str, marker: &str) -> (String, Option<u32>) {
    let (program, flag) = if cfg!(windows) {
        ("cmd.exe", "/C")
    } else {
        ("sh", "-c")
    };
    let options = SpawnOptions {
        program: program.into(),
        args: vec![flag.into(), script.into()],
        cwd: None,
        env: vec![],
        cols: 80,
        rows: 24,
    };
    let (data_tx, data_rx) = mpsc::channel::<Vec<u8>>();
    let (exit_tx, exit_rx) = mpsc::channel();
    let mut session = PtySession::spawn(
        options,
        move |bytes| {
            let _ = data_tx.send(bytes.to_vec());
        },
        move |code| {
            let _ = exit_tx.send(code);
        },
    )
    .expect("shell starts");

    let deadline = Instant::now() + TIMEOUT;
    let mut output = String::new();
    let mut exit = None;
    while exit.is_none() || !output.contains(marker) {
        assert!(
            Instant::now() < deadline,
            "timed out; exit: {exit:?}, output: {output:?}"
        );
        if let Ok(chunk) = data_rx.recv_timeout(Duration::from_millis(20)) {
            let text = String::from_utf8_lossy(&chunk);
            if text.contains(CURSOR_QUERY) {
                session.write(CURSOR_ANSWER).expect("answer is written");
            }
            output.push_str(&text);
        }
        if let Ok(code) = exit_rx.try_recv() {
            exit = Some(code);
        }
    }
    (output, exit.flatten())
}

#[test]
fn reports_output_and_exit_code() {
    let (output, code) = run("echo hello-pty", "hello-pty");

    assert!(output.contains("hello-pty"));
    assert_eq!(code, Some(0));
}

#[test]
fn reports_a_failing_exit_code() {
    let (_, code) = run("exit 3", "");

    assert_eq!(code, Some(3));
}

#[test]
fn missing_program_is_an_error() {
    let options = SpawnOptions {
        program: "definitely-not-a-real-shell".into(),
        args: vec![],
        cwd: None,
        env: vec![],
        cols: 80,
        rows: 24,
    };

    assert!(PtySession::spawn(options, |_| {}, |_| {}).is_err());
}
