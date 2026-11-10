//! Shell detection.
//!
//! Finds which shells exist on this machine so the user never has to type a
//! path. Every look at the system goes through [`Probe`], so the rules for
//! Windows, macOS and Linux can all be tested on any one of them.

use std::path::{Path, PathBuf};

use serde::Serialize;

/// A shell the terminal can open in a tab.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ShellProfile {
    /// Stable key used in the configuration file (`default_shell`).
    pub id: String,
    /// Name shown to the user.
    pub name: String,
    /// Absolute path of the executable.
    pub program: String,
    pub args: Vec<String>,
}

/// Operating system family, as far as shell detection cares.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    Windows,
    MacOs,
    Linux,
}

impl Os {
    /// The system this binary was built for.
    pub fn current() -> Self {
        if cfg!(windows) {
            Os::Windows
        } else if cfg!(target_os = "macos") {
            Os::MacOs
        } else {
            Os::Linux
        }
    }
}

/// The questions detection asks the system.
pub trait Probe {
    /// Finds an executable by name on `PATH`.
    fn on_path(&self, program: &str) -> Option<PathBuf>;
    fn exists(&self, path: &Path) -> bool;
    fn env(&self, key: &str) -> Option<String>;
}

/// [`Probe`] backed by the real machine.
pub struct SystemProbe;

impl Probe for SystemProbe {
    fn on_path(&self, program: &str) -> Option<PathBuf> {
        which::which(program).ok()
    }

    fn exists(&self, path: &Path) -> bool {
        path.is_file()
    }

    fn env(&self, key: &str) -> Option<String> {
        std::env::var(key).ok()
    }
}

/// Shells installed on this machine, best default first.
pub fn detect_shells() -> Vec<ShellProfile> {
    detect_with(Os::current(), &SystemProbe)
}

/// Same as [`detect_shells`] for a given system and probe.
pub fn detect_with(os: Os, probe: &dyn Probe) -> Vec<ShellProfile> {
    match os {
        Os::Windows => windows(probe),
        // macOS terminals start login shells: that is where Homebrew and
        // similar tools add themselves to PATH.
        Os::MacOs => unix(probe, &["-l"]),
        Os::Linux => unix(probe, &[]),
    }
}

/// `(id, name, executable, args)` for shells found on PATH, in order of preference.
const WINDOWS_ON_PATH: &[(&str, &str, &str, &[&str])] = &[
    ("pwsh", "PowerShell", "pwsh.exe", &["-NoLogo"]),
    (
        "powershell",
        "Windows PowerShell",
        "powershell.exe",
        &["-NoLogo"],
    ),
    ("cmd", "Command Prompt", "cmd.exe", &[]),
];

/// `(environment variable, path below it)` where Git for Windows installs bash.
const GIT_BASH_LOCATIONS: &[(&str, &str)] = &[
    ("ProgramFiles", "Git\\bin\\bash.exe"),
    ("ProgramFiles(x86)", "Git\\bin\\bash.exe"),
    ("LOCALAPPDATA", "Programs\\Git\\bin\\bash.exe"),
];

fn windows(probe: &dyn Probe) -> Vec<ShellProfile> {
    let mut found = Vec::new();
    for (id, name, executable, args) in WINDOWS_ON_PATH {
        if let Some(path) = probe.on_path(executable) {
            found.push(profile(id, name, &path, args));
        }
    }
    // Git Bash is looked up by install folder: on Windows, `bash.exe` on PATH
    // is usually the WSL launcher, not Git Bash.
    let git_bash = GIT_BASH_LOCATIONS
        .iter()
        .filter_map(|(key, below)| Some(PathBuf::from(probe.env(key)?).join(below)))
        .find(|path| probe.exists(path));
    if let Some(path) = git_bash {
        found.push(profile("git-bash", "Git Bash", &path, &["--login", "-i"]));
    }
    if let Some(path) = probe.on_path("wsl.exe") {
        found.push(profile("wsl", "WSL", &path, &[]));
    }
    found
}

fn unix(probe: &dyn Probe, args: &[&str]) -> Vec<ShellProfile> {
    let mut found: Vec<ShellProfile> = Vec::new();
    // The user's login shell comes first: it is the one they configured.
    let login_shell = probe
        .env("SHELL")
        .map(PathBuf::from)
        .filter(|path| probe.exists(path));
    if let Some(path) = login_shell {
        if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
            found.push(profile(name, name, &path, args));
        }
    }
    for name in ["bash", "zsh", "fish", "sh"] {
        if found.iter().any(|shell| shell.id == name) {
            continue;
        }
        if let Some(path) = probe.on_path(name) {
            found.push(profile(name, name, &path, args));
        }
    }
    found
}

fn profile(id: &str, name: &str, program: &Path, args: &[&str]) -> ShellProfile {
    ShellProfile {
        id: id.to_owned(),
        name: name.to_owned(),
        program: program.to_string_lossy().into_owned(),
        args: args.iter().map(|arg| (*arg).to_owned()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// A made-up machine.
    #[derive(Default)]
    struct FakeProbe {
        path: HashMap<&'static str, &'static str>,
        files: Vec<PathBuf>,
        env: HashMap<&'static str, &'static str>,
    }

    impl Probe for FakeProbe {
        fn on_path(&self, program: &str) -> Option<PathBuf> {
            self.path.get(program).map(PathBuf::from)
        }

        fn exists(&self, path: &Path) -> bool {
            self.files.iter().any(|file| file == path)
        }

        fn env(&self, key: &str) -> Option<String> {
            self.env.get(key).map(|value| (*value).to_owned())
        }
    }

    fn ids(shells: &[ShellProfile]) -> Vec<&str> {
        shells.iter().map(|shell| shell.id.as_str()).collect()
    }

    #[test]
    fn windows_lists_shells_in_order_of_preference() {
        let probe = FakeProbe {
            path: HashMap::from([
                ("cmd.exe", "C:\\Windows\\System32\\cmd.exe"),
                ("pwsh.exe", "C:\\Program Files\\PowerShell\\7\\pwsh.exe"),
                ("powershell.exe", "C:\\Windows\\powershell.exe"),
                ("wsl.exe", "C:\\Windows\\System32\\wsl.exe"),
            ]),
            files: vec![PathBuf::from("C:\\Program Files").join("Git\\bin\\bash.exe")],
            env: HashMap::from([("ProgramFiles", "C:\\Program Files")]),
        };

        let shells = detect_with(Os::Windows, &probe);

        assert_eq!(
            ids(&shells),
            ["pwsh", "powershell", "cmd", "git-bash", "wsl"]
        );
        assert_eq!(shells[3].args, ["--login", "-i"]);
    }

    #[test]
    fn windows_ignores_bash_on_path_because_it_is_the_wsl_launcher() {
        let probe = FakeProbe {
            path: HashMap::from([("bash.exe", "C:\\Windows\\System32\\bash.exe")]),
            ..FakeProbe::default()
        };

        assert!(detect_with(Os::Windows, &probe).is_empty());
    }

    #[test]
    fn unix_puts_the_login_shell_first_without_repeating_it() {
        let probe = FakeProbe {
            path: HashMap::from([
                ("bash", "/bin/bash"),
                ("zsh", "/bin/zsh"),
                ("sh", "/bin/sh"),
            ]),
            files: vec![PathBuf::from("/bin/zsh")],
            env: HashMap::from([("SHELL", "/bin/zsh")]),
        };

        let shells = detect_with(Os::Linux, &probe);

        assert_eq!(ids(&shells), ["zsh", "bash", "sh"]);
        assert!(shells[0].args.is_empty());
    }

    #[test]
    fn unix_skips_a_login_shell_that_does_not_exist() {
        let probe = FakeProbe {
            path: HashMap::from([("sh", "/bin/sh")]),
            env: HashMap::from([("SHELL", "/opt/gone/fish")]),
            ..FakeProbe::default()
        };

        assert_eq!(ids(&detect_with(Os::Linux, &probe)), ["sh"]);
    }

    #[test]
    fn macos_starts_login_shells() {
        let probe = FakeProbe {
            path: HashMap::from([("zsh", "/bin/zsh")]),
            ..FakeProbe::default()
        };

        assert_eq!(detect_with(Os::MacOs, &probe)[0].args, ["-l"]);
    }

    #[test]
    fn this_machine_has_at_least_one_shell() {
        assert!(!detect_shells().is_empty());
    }
}
