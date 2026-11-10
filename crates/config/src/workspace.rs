//! Projects: named folders, each with the terminals the user keeps in it.
//!
//! This is what the user builds while working, not configuration they type,
//! so it lives in its own JSON file that the app reads and writes. Only the
//! layout is saved (which terminals exist and what they run), never their
//! output or history.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{ConfigError, APP_DIR};

/// Everything saved between runs.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Workspace {
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Project {
    /// Stable key chosen when the project is created.
    pub id: String,
    pub name: String,
    /// Folder the project's terminals start in.
    pub path: String,
    #[serde(default)]
    pub terminals: Vec<SavedTerminal>,
}

/// A terminal to offer again on the next run. It is started only when the
/// user opens it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SavedTerminal {
    pub title: String,
    pub shell_id: String,
    /// Command run when the terminal starts, for example an AI agent.
    #[serde(default)]
    pub command: Option<String>,
}

/// Where the workspace file lives on this system.
pub fn workspace_path() -> Option<PathBuf> {
    Some(dirs::config_dir()?.join(APP_DIR).join("workspace.json"))
}

impl Workspace {
    /// Reads the file at `path`. A missing file is an empty workspace.
    ///
    /// A file that cannot be read as a workspace is moved aside (`.bad`)
    /// and reported: the next save would otherwise overwrite the only copy
    /// of the user's projects.
    pub fn load(path: &Path) -> Result<Self, ConfigError> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let text = fs::read_to_string(path)?;
        serde_json::from_str(&text).map_err(|error| {
            let _ = fs::rename(path, path.with_extension("json.bad"));
            ConfigError::Workspace(error)
        })
    }

    /// Writes the file at `path`. The content goes to a temporary file first
    /// and replaces the old one in a single step, so a crash in the middle
    /// cannot leave half a file.
    pub fn save(&self, path: &Path) -> Result<(), ConfigError> {
        if let Some(folder) = path.parent() {
            fs::create_dir_all(folder)?;
        }
        let text = serde_json::to_string_pretty(self).map_err(ConfigError::Workspace)?;
        let temporary = path.with_extension("json.tmp");
        fs::write(&temporary, text)?;
        fs::rename(&temporary, path)?;
        Ok(())
    }

    /// Folder of the project `id`, if the project exists and the folder is
    /// still there (it may be on a drive that is not connected).
    pub fn project_dir(&self, id: &str) -> Option<PathBuf> {
        let project = self.projects.iter().find(|project| project.id == id)?;
        let folder = PathBuf::from(&project.path);
        folder.is_dir().then_some(folder)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(path: &Path) -> Workspace {
        Workspace {
            projects: vec![Project {
                id: "p1".into(),
                name: "Web".into(),
                path: path.to_string_lossy().into_owned(),
                terminals: vec![
                    SavedTerminal {
                        title: "Servidor".into(),
                        shell_id: "pwsh".into(),
                        command: None,
                    },
                    SavedTerminal {
                        title: "Claude Code".into(),
                        shell_id: "pwsh".into(),
                        command: Some("claude".into()),
                    },
                ],
            }],
        }
    }

    #[test]
    fn a_missing_file_is_an_empty_workspace() {
        let folder = tempfile::tempdir().unwrap();

        let workspace = Workspace::load(&folder.path().join("workspace.json")).unwrap();

        assert_eq!(workspace, Workspace::default());
    }

    #[test]
    fn what_is_saved_is_what_is_loaded() {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("nested").join("workspace.json");
        let workspace = sample(folder.path());

        workspace.save(&file).unwrap();

        assert_eq!(Workspace::load(&file).unwrap(), workspace);
        assert!(!file.with_extension("json.tmp").exists());
    }

    #[test]
    fn a_broken_file_is_kept_aside_instead_of_overwritten() {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("workspace.json");
        fs::write(&file, "{ not json").unwrap();

        assert!(Workspace::load(&file).is_err());

        assert!(!file.exists());
        assert_eq!(
            fs::read_to_string(file.with_extension("json.bad")).unwrap(),
            "{ not json"
        );
    }

    #[test]
    fn a_project_resolves_to_its_folder_only_while_it_exists() {
        let folder = tempfile::tempdir().unwrap();
        let mut workspace = sample(folder.path());

        assert_eq!(workspace.project_dir("p1").unwrap(), folder.path());
        assert_eq!(workspace.project_dir("unknown"), None);

        workspace.projects[0].path = folder.path().join("gone").to_string_lossy().into_owned();
        assert_eq!(workspace.project_dir("p1"), None);
    }

    #[test]
    fn terminals_and_commands_are_optional_in_the_file() {
        let workspace: Workspace =
            serde_json::from_str(r#"{"projects":[{"id":"a","name":"A","path":"/tmp"}]}"#).unwrap();

        assert!(workspace.projects[0].terminals.is_empty());
    }
}
