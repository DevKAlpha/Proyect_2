//! Where the app keeps its files.
//!
//! Three folders, each with one job, so that a person looking for something
//! knows where to go:
//!
//! - the **program** folder: what the installer put on the machine;
//! - the **configuration** folder: what the user writes (`config.toml`) and
//!   what the app saves about the layout (`workspace.json`);
//! - the **data** folder: what the app collects while it is used (command
//!   history, pasted pictures, the profile of the test browser).
//!
//! The data folder is `<local application data>/terminal/data`. On Windows
//! the installer puts the program in `<local application data>/Terminal`,
//! which is the same folder: the `data` level keeps the two apart.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::APP_DIR;

/// Level under the local folder of the app that holds what it collects.
const DATA_DIR: &str = "data";

/// What earlier versions kept directly in the local folder of the app.
const OLD_DATA: [&str; 4] = ["history.txt", "pasted", "shell", "browser-profile"];

/// The local folder of the app. It stays on this machine: it does not
/// follow the user's account to other computers.
pub fn local_dir() -> Option<PathBuf> {
    Some(dirs::data_local_dir()?.join(APP_DIR))
}

/// Folder for what the app collects while it is used.
pub fn data_dir() -> Option<PathBuf> {
    Some(local_dir()?.join(DATA_DIR))
}

/// Folder of the configuration file and of the saved projects.
pub fn config_dir() -> Option<PathBuf> {
    Some(dirs::config_dir()?.join(APP_DIR))
}

/// Moves what an earlier version left in `local` (the local folder of the
/// app) into its data folder. Returns the names it moved.
///
/// An entry is moved only when nothing with its name is in the data folder
/// yet: data that is already in place is never overwritten.
pub fn tidy_data(local: &Path) -> io::Result<Vec<&'static str>> {
    let data = local.join(DATA_DIR);
    let mut moved = Vec::new();
    for name in OLD_DATA {
        let old = local.join(name);
        let new = data.join(name);
        if !old.exists() || new.exists() {
            continue;
        }
        fs::create_dir_all(&data)?;
        fs::rename(&old, &new)?;
        moved.push(name);
    }
    Ok(moved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_lives_one_level_below_the_local_folder() {
        if let (Some(local), Some(data)) = (local_dir(), data_dir()) {
            assert_eq!(data, local.join("data"));
        }
    }

    #[test]
    fn old_data_moves_into_the_data_folder() {
        let local = tempfile::tempdir().unwrap();
        fs::write(local.path().join("history.txt"), "git status\n").unwrap();
        fs::create_dir(local.path().join("pasted")).unwrap();
        fs::write(local.path().join("pasted").join("imagen-1.png"), "png").unwrap();
        // The program itself, on Windows: it is not data and must stay.
        fs::write(local.path().join("terminal-app.exe"), "exe").unwrap();

        let moved = tidy_data(local.path()).unwrap();

        assert_eq!(moved, ["history.txt", "pasted"]);
        let data = local.path().join("data");
        assert_eq!(
            fs::read_to_string(data.join("history.txt")).unwrap(),
            "git status\n"
        );
        assert!(data.join("pasted").join("imagen-1.png").is_file());
        assert!(!local.path().join("history.txt").exists());
        assert!(local.path().join("terminal-app.exe").is_file());
    }

    #[test]
    fn data_already_in_place_is_never_overwritten() {
        let local = tempfile::tempdir().unwrap();
        let data = local.path().join("data");
        fs::create_dir(&data).unwrap();
        fs::write(data.join("history.txt"), "new\n").unwrap();
        fs::write(local.path().join("history.txt"), "old\n").unwrap();

        let moved = tidy_data(local.path()).unwrap();

        assert!(moved.is_empty());
        assert_eq!(
            fs::read_to_string(data.join("history.txt")).unwrap(),
            "new\n"
        );
        assert!(local.path().join("history.txt").exists());
    }

    #[test]
    fn a_fresh_or_missing_folder_needs_nothing() {
        let local = tempfile::tempdir().unwrap();

        assert!(tidy_data(local.path()).unwrap().is_empty());
        assert!(tidy_data(&local.path().join("gone")).unwrap().is_empty());
        // Nothing to move: the data folder is not created for nothing.
        assert!(!local.path().join("data").exists());
    }
}
