//! Developer tools people expect to find in a terminal (Node.js, Docker).
//!
//! This crate only *reports*: which tools are missing and the command that
//! installs each one with the package manager of this system. It never runs
//! an installer. The app shows the command and runs it in a visible tab after
//! the user asks for it, because installing software changes the machine,
//! can need administrator rights and comes with licence terms.

use std::ffi::OsString;

use serde::Serialize;

mod path;

pub use path::fresh_path;

/// A tool and whether this machine has it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ToolStatus {
    pub id: &'static str,
    /// Name shown to the user.
    pub name: &'static str,
    /// The commands the user gains, shown next to the name.
    pub provides: &'static str,
    pub installed: bool,
    /// Command that installs the tool here. `None` when this system has no
    /// package manager we know; the user then follows `website`.
    pub install_command: Option<&'static str>,
    /// Official download page.
    pub website: &'static str,
}

struct Tool {
    id: &'static str,
    name: &'static str,
    provides: &'static str,
    /// Executable whose presence on PATH means the tool is installed.
    program: &'static str,
    website: &'static str,
    /// `(package manager executable, install command)`.
    installers: &'static [(&'static str, &'static str)],
}

/// Package managers in the order they are tried. System managers come before
/// Homebrew, which can also be present on Linux as an extra.
const PACKAGE_MANAGERS: &[&str] = &["winget", "apt-get", "dnf", "pacman", "brew"];

const TOOLS: &[Tool] = &[
    Tool {
        id: "node",
        name: "Node.js",
        provides: "node, npm, npx",
        program: "node",
        website: "https://nodejs.org/en/download",
        installers: &[
            ("winget", "winget install --exact --id OpenJS.NodeJS.LTS"),
            ("apt-get", "sudo apt-get install -y nodejs npm"),
            ("dnf", "sudo dnf install -y nodejs npm"),
            ("pacman", "sudo pacman -S --needed nodejs npm"),
            ("brew", "brew install node"),
        ],
    },
    Tool {
        id: "docker",
        name: "Docker",
        provides: "docker, docker compose",
        program: "docker",
        website: "https://docs.docker.com/get-started/get-docker/",
        // No dnf entry: the package name differs between Fedora and RHEL.
        installers: &[
            ("winget", "winget install --exact --id Docker.DockerDesktop"),
            (
                "apt-get",
                "sudo apt-get install -y docker.io docker-compose-v2",
            ),
            ("pacman", "sudo pacman -S --needed docker docker-compose"),
            ("brew", "brew install --cask docker"),
        ],
    },
];

/// Status of every known tool on this machine.
///
/// Uses [`fresh_path`], so a tool installed while the app is open is found
/// without a restart.
pub fn detect() -> Vec<ToolStatus> {
    let path = fresh_path().or_else(|| std::env::var_os("PATH"));
    detect_with(&|program| on_path(program, path.as_ref()))
}

/// Same as [`detect`], with the PATH lookup supplied by the caller.
pub fn detect_with(is_on_path: &dyn Fn(&str) -> bool) -> Vec<ToolStatus> {
    let manager = PACKAGE_MANAGERS
        .iter()
        .find(|manager| is_on_path(manager))
        .copied();

    TOOLS
        .iter()
        .map(|tool| ToolStatus {
            id: tool.id,
            name: tool.name,
            provides: tool.provides,
            installed: is_on_path(tool.program),
            install_command: tool
                .installers
                .iter()
                .find(|(name, _)| Some(*name) == manager)
                .map(|(_, command)| *command),
            website: tool.website,
        })
        .collect()
}

fn on_path(program: &str, path: Option<&OsString>) -> bool {
    let cwd = std::env::current_dir().unwrap_or_default();
    which::which_in(program, path, cwd).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status<'a>(tools: &'a [ToolStatus], id: &str) -> &'a ToolStatus {
        tools.iter().find(|tool| tool.id == id).expect("known tool")
    }

    #[test]
    fn reports_installed_and_missing_tools() {
        let tools = detect_with(&|program| program == "node");

        assert!(status(&tools, "node").installed);
        assert!(!status(&tools, "docker").installed);
    }

    #[test]
    fn offers_the_command_of_the_package_manager_on_this_system() {
        let tools = detect_with(&|program| program == "winget");

        assert_eq!(
            status(&tools, "node").install_command,
            Some("winget install --exact --id OpenJS.NodeJS.LTS")
        );
        assert_eq!(
            status(&tools, "docker").install_command,
            Some("winget install --exact --id Docker.DockerDesktop")
        );
    }

    #[test]
    fn prefers_the_system_package_manager_over_homebrew() {
        let tools = detect_with(&|program| program == "brew" || program == "apt-get");

        assert_eq!(
            status(&tools, "node").install_command,
            Some("sudo apt-get install -y nodejs npm")
        );
    }

    #[test]
    fn has_no_command_without_a_known_package_manager() {
        let tools = detect_with(&|_| false);

        assert!(tools.iter().all(|tool| tool.install_command.is_none()));
        assert!(tools
            .iter()
            .all(|tool| tool.website.starts_with("https://")));
    }

    #[test]
    fn has_no_command_when_the_manager_does_not_carry_the_tool() {
        let tools = detect_with(&|program| program == "dnf");

        assert!(status(&tools, "node").install_command.is_some());
        assert!(status(&tools, "docker").install_command.is_none());
    }

    #[test]
    fn detection_runs_on_this_machine() {
        assert_eq!(detect().len(), TOOLS.len());
    }
}
