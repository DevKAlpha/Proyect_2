//! AI coding agents that run in a terminal (Claude Code, Codex, Gemini CLI...).
//!
//! Like the rest of this crate, this only reports what is installed and how
//! to install the rest. An agent is an ordinary command-line program: the app
//! starts it by typing `command` in a normal shell tab, so it gets the user's
//! own environment and the shell is still there when the agent exits.

use serde::Serialize;

/// A known agent and whether this machine has it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AgentStatus {
    pub id: &'static str,
    /// Name shown to the user.
    pub name: &'static str,
    /// What to type in a shell to start it.
    pub command: &'static str,
    pub installed: bool,
    /// Command that installs it. `None` without npm: Node.js comes first.
    pub install_command: Option<&'static str>,
    pub website: &'static str,
}

struct Agent {
    id: &'static str,
    name: &'static str,
    command: &'static str,
    install_command: &'static str,
    website: &'static str,
}

/// Every agent here installs with npm, which is why Node.js is offered first.
/// Agents that are not listed are added by the user in the configuration file.
const AGENTS: &[Agent] = &[
    Agent {
        id: "claude",
        name: "Claude Code",
        command: "claude",
        install_command: "npm install -g @anthropic-ai/claude-code",
        website: "https://claude.com/claude-code",
    },
    Agent {
        id: "codex",
        name: "Codex",
        command: "codex",
        install_command: "npm install -g @openai/codex",
        website: "https://github.com/openai/codex",
    },
    Agent {
        id: "gemini",
        name: "Gemini CLI",
        command: "gemini",
        install_command: "npm install -g @google/gemini-cli",
        website: "https://github.com/google-gemini/gemini-cli",
    },
    Agent {
        id: "opencode",
        name: "OpenCode",
        command: "opencode",
        install_command: "npm install -g opencode-ai",
        website: "https://opencode.ai",
    },
    Agent {
        id: "copilot",
        name: "GitHub Copilot CLI",
        command: "copilot",
        install_command: "npm install -g @github/copilot",
        website: "https://github.com/github/copilot-cli",
    },
];

/// Status of every known agent on this machine.
pub fn detect_agents() -> Vec<AgentStatus> {
    detect_agents_with(&crate::system_lookup())
}

/// Same as [`detect_agents`], with the PATH lookup supplied by the caller.
pub fn detect_agents_with(is_on_path: &dyn Fn(&str) -> bool) -> Vec<AgentStatus> {
    let has_npm = is_on_path("npm");
    AGENTS
        .iter()
        .map(|agent| AgentStatus {
            id: agent.id,
            name: agent.name,
            command: agent.command,
            installed: is_on_path(agent.command),
            install_command: has_npm.then_some(agent.install_command),
            website: agent.website,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status<'a>(agents: &'a [AgentStatus], id: &str) -> &'a AgentStatus {
        agents
            .iter()
            .find(|agent| agent.id == id)
            .expect("known agent")
    }

    #[test]
    fn reports_which_agents_are_installed() {
        let agents = detect_agents_with(&|program| program == "claude");

        assert!(status(&agents, "claude").installed);
        assert!(!status(&agents, "codex").installed);
    }

    #[test]
    fn offers_an_npm_install_when_npm_exists() {
        let agents = detect_agents_with(&|program| program == "npm");

        assert_eq!(
            status(&agents, "claude").install_command,
            Some("npm install -g @anthropic-ai/claude-code")
        );
    }

    #[test]
    fn has_no_install_command_without_npm() {
        let agents = detect_agents_with(&|_| false);

        assert!(agents.iter().all(|agent| agent.install_command.is_none()));
    }

    #[test]
    fn ids_and_commands_are_unique() {
        let agents = detect_agents_with(&|_| false);
        let mut ids: Vec<_> = agents.iter().map(|agent| agent.id).collect();
        ids.sort_unstable();
        ids.dedup();

        assert_eq!(ids.len(), agents.len());
    }
}
