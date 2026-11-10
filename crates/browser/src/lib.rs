//! The test browser.
//!
//! AI agents test web apps by driving a real browser through the Chrome
//! DevTools Protocol. This crate starts that browser. The protocol gives full
//! control of the browser to whoever connects, so three rules hold here:
//!
//! - It is a separate browser with its own empty profile. The user's own
//!   browser, with its sessions and passwords, is never exposed.
//! - It listens on this machine only, and only while the user keeps it open.
//!   The app starts it on request and stops it on exit.
//! - It is never the app's own window. The window that hosts the terminal
//!   can start shells, so it must not be remotely controllable.

use std::io;
use std::net::{Ipv4Addr, TcpListener};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

use serde::Serialize;

/// A Chromium-based browser found on this machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Browser {
    pub name: &'static str,
    pub program: PathBuf,
}

/// How an agent is told about the test browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Connector {
    /// Id of the agent, as in `term-tools`.
    pub agent_id: &'static str,
    /// Command the user runs once to register the browser with that agent.
    pub command: String,
}

/// Why the test browser could not start.
#[derive(Debug)]
pub enum LaunchError {
    /// Another program already listens there. Starting anyway would point
    /// agents at a browser the app does not control.
    PortInUse(u16),
    Spawn(io::Error),
}

impl std::fmt::Display for LaunchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::PortInUse(port) => write!(
                f,
                "port {port} is already in use; close the program using it or change [browser] port"
            ),
            Self::Spawn(error) => write!(f, "could not start the browser: {error}"),
        }
    }
}

/// Where agents connect.
pub fn endpoint(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

/// `(name, executable names on PATH, install locations)` in order of
/// preference. Only Chromium-based browsers speak the protocol agents use.
/// Locations starting with `%NAME%` hang from that environment variable.
const CANDIDATES: &[(&str, &[&str], &[&str])] = &[
    (
        "Google Chrome",
        &["google-chrome", "google-chrome-stable", "chrome"],
        &[
            "%ProgramFiles%/Google/Chrome/Application/chrome.exe",
            "%ProgramFiles(x86)%/Google/Chrome/Application/chrome.exe",
            "%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ],
    ),
    (
        "Microsoft Edge",
        &["microsoft-edge", "microsoft-edge-stable", "msedge"],
        &[
            "%ProgramFiles(x86)%/Microsoft/Edge/Application/msedge.exe",
            "%ProgramFiles%/Microsoft/Edge/Application/msedge.exe",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ],
    ),
    (
        "Chromium",
        &["chromium", "chromium-browser"],
        &["/Applications/Chromium.app/Contents/MacOS/Chromium"],
    ),
];

/// The browser to use for tests on this machine, if there is one.
pub fn find_browser() -> Option<Browser> {
    find_with(
        &|name| which::which(name).ok(),
        &|path| path.is_file(),
        &|key| std::env::var(key).ok(),
    )
}

/// Same as [`find_browser`], with every look at the system supplied by the caller.
pub fn find_with(
    on_path: &dyn Fn(&str) -> Option<PathBuf>,
    exists: &dyn Fn(&Path) -> bool,
    env: &dyn Fn(&str) -> Option<String>,
) -> Option<Browser> {
    CANDIDATES.iter().find_map(|(name, programs, locations)| {
        let installed = locations
            .iter()
            .filter_map(|location| resolve(location, env))
            .find(|path| exists(path));
        let program = installed.or_else(|| programs.iter().find_map(|program| on_path(program)))?;
        Some(Browser { name, program })
    })
}

/// Turns `%NAME%/rest` into a path below that environment variable.
fn resolve(location: &str, env: &dyn Fn(&str) -> Option<String>) -> Option<PathBuf> {
    match location
        .strip_prefix('%')
        .and_then(|rest| rest.split_once("%/"))
    {
        Some((key, below)) => Some(PathBuf::from(env(key)?).join(below)),
        None => Some(PathBuf::from(location)),
    }
}

/// Arguments that start a browser agents can drive.
pub fn launch_args(port: u16, profile: &Path) -> Vec<String> {
    vec![
        format!("--remote-debugging-port={port}"),
        // Its own profile: nothing of the user's browser is reachable, and
        // browsers refuse remote control of the default profile anyway.
        format!("--user-data-dir={}", profile.display()),
        // An empty profile is not enough. Edge signs a new profile in with
        // the account of the Windows user and starts syncing their passwords,
        // history and bookmarks into it. These two switch that off.
        "--disable-features=msImplicitSignin".into(),
        "--disable-sync".into(),
        "--no-first-run".into(),
        "--no-default-browser-check".into(),
        "about:blank".into(),
    ]
}

/// Starts `browser` listening on `port` with the profile folder `profile`.
/// The caller owns the process and must stop it.
pub fn launch(browser: &Browser, port: u16, profile: &Path) -> Result<Child, LaunchError> {
    // Binding proves the port is free. The listener is dropped at once so
    // the browser can take it.
    if TcpListener::bind((Ipv4Addr::LOCALHOST, port)).is_err() {
        return Err(LaunchError::PortInUse(port));
    }
    std::fs::create_dir_all(profile).map_err(LaunchError::Spawn)?;
    Command::new(&browser.program)
        .args(launch_args(port, profile))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(LaunchError::Spawn)
}

/// Commands that register the test browser with the agents that support it.
///
/// The browser is offered through the Chrome DevTools MCP server, which the
/// agent starts by itself when it needs the browser.
pub fn connectors(port: u16) -> Vec<Connector> {
    // npx is a script on Windows, and agents there cannot start a script
    // directly: it has to go through the command interpreter.
    let npx = if cfg!(windows) { "cmd /c npx" } else { "npx" };
    // By default this server reports usage statistics and sends the
    // addresses of measured pages to a public service. Both are turned off:
    // what the user tests stays on their machine.
    let server = format!(
        "{npx} -y chrome-devtools-mcp@latest --no-usage-statistics --no-performance-crux --browserUrl {}",
        endpoint(port)
    );
    vec![Connector {
        agent_id: "claude",
        command: format!("claude mcp add --scope user test-browser -- {server}"),
    }]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_an_installed_browser_and_expands_its_location() {
        let browser = find_with(
            &|_| None,
            &|path| path == Path::new("C:/PF86").join("Microsoft/Edge/Application/msedge.exe"),
            &|key| (key == "ProgramFiles(x86)").then(|| "C:/PF86".to_owned()),
        )
        .unwrap();

        assert_eq!(browser.name, "Microsoft Edge");
        assert!(browser.program.ends_with("msedge.exe"));
    }

    #[test]
    fn falls_back_to_a_browser_on_path() {
        let browser = find_with(
            &|name| (name == "chromium").then(|| PathBuf::from("/usr/bin/chromium")),
            &|_| false,
            &|_| None,
        )
        .unwrap();

        assert_eq!(browser.name, "Chromium");
    }

    #[test]
    fn reports_no_browser_when_none_is_installed() {
        assert_eq!(find_with(&|_| None, &|_| false, &|_| None), None);
    }

    #[test]
    fn the_browser_gets_its_own_profile_and_the_requested_port() {
        let args = launch_args(9333, Path::new("/data/profile"));

        assert!(args.contains(&"--remote-debugging-port=9333".to_owned()));
        assert!(args.contains(&"--user-data-dir=/data/profile".to_owned()));
    }

    #[test]
    fn the_browser_never_signs_in_or_syncs_the_users_account() {
        let args = launch_args(9333, Path::new("/data/profile"));

        assert!(args.contains(&"--disable-features=msImplicitSignin".to_owned()));
        assert!(args.contains(&"--disable-sync".to_owned()));
    }

    #[test]
    fn refuses_a_port_that_is_taken() {
        let taken = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = taken.local_addr().unwrap().port();
        let browser = Browser {
            name: "none",
            program: PathBuf::from("definitely-not-a-browser"),
        };
        let profile = std::env::temp_dir().join("term-browser-test-profile");

        let error = launch(&browser, port, &profile).unwrap_err();

        assert!(matches!(error, LaunchError::PortInUse(p) if p == port));
    }

    #[test]
    fn the_claude_code_command_points_at_this_machine_only() {
        let connector = &connectors(9400)[0];

        assert_eq!(connector.agent_id, "claude");
        assert!(connector.command.starts_with("claude mcp add "));
        assert!(connector
            .command
            .ends_with("--browserUrl http://127.0.0.1:9400"));
        assert!(connector.command.contains("--no-usage-statistics"));
        assert!(connector.command.contains("--no-performance-crux"));
    }
}
