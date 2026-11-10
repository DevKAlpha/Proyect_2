//! Pseudo-terminal sessions.
//!
//! One [`PtySession`] is one shell process attached to a pseudo-terminal.
//! This crate hides the platform difference (ConPTY on Windows, forkpty on
//! Unix) and knows nothing about the UI: output and exit are reported through
//! plain callbacks, so the same code serves the desktop app and the tests.
//!
//! The consumer must behave like a terminal emulator. In particular, ConPTY
//! asks for the cursor position at start (`ESC [ 6 n`) and the shell does not
//! run until the answer (`ESC [ row ; col R`) is written back. xterm.js
//! answers by itself; a headless consumer has to do it (see `tests/`).

use std::io::{Read, Write};
use std::path::PathBuf;
use std::thread;

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};

/// Why a pseudo-terminal operation failed.
#[derive(Debug, thiserror::Error)]
pub enum PtyError {
    #[error("could not open a pseudo-terminal: {0}")]
    Open(String),
    #[error("could not start `{program}`: {reason}")]
    Spawn { program: String, reason: String },
    #[error("could not resize the pseudo-terminal: {0}")]
    Resize(String),
    #[error("pseudo-terminal I/O failed: {0}")]
    Io(#[from] std::io::Error),
}

/// What to run and the initial size of the terminal grid.
#[derive(Debug, Clone)]
pub struct SpawnOptions {
    pub program: String,
    pub args: Vec<String>,
    /// Working directory. `None` leaves the choice to the platform.
    pub cwd: Option<PathBuf>,
    /// Variables set on top of the environment of this process.
    pub env: Vec<(String, String)>,
    pub cols: u16,
    pub rows: u16,
}

/// A running shell attached to a pseudo-terminal.
///
/// Dropping the session kills the process and closes the pseudo-terminal.
pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

impl PtySession {
    /// Starts `options.program` in a new pseudo-terminal.
    ///
    /// `on_data` receives raw output bytes as they arrive. Chunks can split a
    /// UTF-8 character or an escape sequence, so the consumer must treat them
    /// as a byte stream. `on_exit` runs once with the exit code when the
    /// process ends (`None` if the code could not be read).
    pub fn spawn<D, E>(options: SpawnOptions, mut on_data: D, on_exit: E) -> Result<Self, PtyError>
    where
        D: FnMut(&[u8]) + Send + 'static,
        E: FnOnce(Option<u32>) + Send + 'static,
    {
        let pair = native_pty_system()
            .openpty(size(options.cols, options.rows))
            .map_err(|e| PtyError::Open(e.to_string()))?;

        let mut command = CommandBuilder::new(&options.program);
        command.args(&options.args);
        if let Some(cwd) = &options.cwd {
            command.cwd(cwd);
        }
        // Programs choose their colour and key handling from these.
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        for (key, value) in &options.env {
            command.env(key, value);
        }

        let mut child = pair
            .slave
            .spawn_command(command)
            .map_err(|e| PtyError::Spawn {
                program: options.program.clone(),
                reason: e.to_string(),
            })?;
        // The child owns its end now. Keeping ours open would hide its exit.
        drop(pair.slave);

        let killer = child.clone_killer();
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| PtyError::Open(e.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| PtyError::Open(e.to_string()))?;

        thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => on_data(&buffer[..n]),
                }
            }
        });

        // Exit is watched on its own thread: on Windows the reader does not
        // reach end-of-file until the pseudo-terminal itself is closed.
        thread::spawn(move || {
            let code = child.wait().ok().map(|status| status.exit_code());
            on_exit(code);
        });

        Ok(Self {
            master: pair.master,
            writer,
            killer,
        })
    }

    /// Sends input (keystrokes or pasted text) to the shell.
    pub fn write(&mut self, data: &[u8]) -> Result<(), PtyError> {
        self.writer.write_all(data)?;
        self.writer.flush()?;
        Ok(())
    }

    /// Tells the shell the terminal grid changed size.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), PtyError> {
        self.master
            .resize(size(cols, rows))
            .map_err(|e| PtyError::Resize(e.to_string()))
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        // Already-exited processes return an error here; nothing to do.
        let _ = self.killer.kill();
    }
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        // A zero-sized grid makes some shells crash on start.
        cols: cols.max(1),
        rows: rows.max(1),
        pixel_width: 0,
        pixel_height: 0,
    }
}
