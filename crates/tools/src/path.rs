//! The PATH a newly started program should see, and the programs on it.
//!
//! A process keeps the PATH it was started with. On Windows an installer adds
//! its folder to the PATH stored in the registry, so without this module a
//! tool installed from the terminal would stay "not found" in every new tab
//! until the whole app was restarted.

use std::collections::BTreeSet;
use std::ffi::{OsStr, OsString};
use std::fs;

/// The names of the programs in the folders of `path`, as the user types
/// them, sorted and without repeats. This is how the terminal knows whether
/// a command exists here before the user runs it.
///
/// On Windows a program is a file with one of the extensions of `PATHEXT`,
/// typed without it and in any case, so names come back in lower case and
/// without extension. Elsewhere it is a file with permission to run.
pub fn programs_on(path: &OsStr) -> Vec<String> {
    let extensions = cfg!(windows).then(windows_extensions);
    let mut names = BTreeSet::new();
    for folder in std::env::split_paths(path) {
        // A folder on PATH that is missing or unreadable is common. Skip it.
        let Ok(entries) = fs::read_dir(&folder) else {
            continue;
        };
        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let Some(file_name) = file_name.to_str() else {
                continue;
            };
            match &extensions {
                Some(extensions) => names.extend(windows_program(file_name, extensions)),
                None if can_run(&entry) => {
                    names.insert(file_name.to_owned());
                }
                None => {}
            }
        }
    }
    names.into_iter().collect()
}

/// The extensions Windows runs without the user typing them, in lower case
/// and with their dot.
fn windows_extensions() -> Vec<String> {
    std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_owned())
        .split(';')
        .filter(|extension| extension.starts_with('.'))
        .map(str::to_lowercase)
        .collect()
}

/// What the user types to run `file_name` on Windows, or `None` when the
/// file is not a program.
fn windows_program(file_name: &str, extensions: &[String]) -> Option<String> {
    let lower = file_name.to_lowercase();
    extensions
        .iter()
        .find_map(|extension| lower.strip_suffix(extension.as_str()))
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
}

/// Whether the file is one this user's shell would run.
#[cfg(unix)]
fn can_run(entry: &fs::DirEntry) -> bool {
    use std::os::unix::fs::PermissionsExt;
    // Through `fs::metadata`, which follows links: most programs in the
    // system folders are links to the real file.
    fs::metadata(entry.path())
        .map(|file| file.is_file() && file.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn can_run(_: &fs::DirEntry) -> bool {
    // Never asked on Windows: the extension decides there.
    false
}

/// The PATH currently stored by the system, or `None` when the PATH of this
/// process is already the right one (every system except Windows, where
/// installers put programs in folders that are already on PATH).
pub fn fresh_path() -> Option<OsString> {
    #[cfg(windows)]
    {
        windows::stored_path()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// Replaces `%NAME%` with the value `lookup` gives for `NAME`. Unknown names
/// and a lone `%` are left as they are, which is what Windows does.
#[cfg_attr(not(windows), allow(dead_code))]
fn expand(text: &str, lookup: &dyn Fn(&str) -> Option<String>) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => match lookup(&after[..end]) {
                Some(value) => {
                    out.push_str(&value);
                    rest = &after[end + 1..];
                }
                None => {
                    // Keep the first `%` and look again from the second one:
                    // it may open a real variable.
                    out.push('%');
                    out.push_str(&after[..end]);
                    rest = &after[end..];
                }
            },
            None => {
                out.push('%');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

#[cfg(windows)]
mod windows {
    use std::ffi::OsString;

    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    const MACHINE_ENVIRONMENT: &str =
        "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment";
    const USER_ENVIRONMENT: &str = "Environment";

    /// Machine PATH followed by user PATH, the order Windows itself uses.
    pub fn stored_path() -> Option<OsString> {
        let machine = read(RegKey::predef(HKEY_LOCAL_MACHINE), MACHINE_ENVIRONMENT);
        let user = read(RegKey::predef(HKEY_CURRENT_USER), USER_ENVIRONMENT);
        if machine.is_none() && user.is_none() {
            return None;
        }
        // The PATH of this process goes last: whoever started the app may
        // have added folders that are not stored anywhere.
        let process = std::env::var("PATH").ok();
        let mut seen = std::collections::HashSet::new();
        let folders: Vec<&str> = [&machine, &user, &process]
            .into_iter()
            .flatten()
            .flat_map(|part| part.split(';'))
            .filter(|folder| !folder.is_empty() && seen.insert(folder.to_lowercase()))
            .collect();
        Some(OsString::from(folders.join(";")))
    }

    fn read(root: RegKey, key: &str) -> Option<String> {
        let raw: String = root.open_subkey(key).ok()?.get_value("Path").ok()?;
        Some(super::expand(&raw, &|name| std::env::var(name).ok()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lookup(name: &str) -> Option<String> {
        match name {
            "SystemRoot" => Some("C:\\Windows".into()),
            "USERPROFILE" => Some("C:\\Users\\ana".into()),
            _ => None,
        }
    }

    #[test]
    fn expands_known_variables() {
        assert_eq!(
            expand("%SystemRoot%\\system32;%USERPROFILE%\\bin", &lookup),
            "C:\\Windows\\system32;C:\\Users\\ana\\bin"
        );
    }

    #[test]
    fn leaves_unknown_variables_and_lone_percent_signs() {
        assert_eq!(expand("%NOPE%\\bin", &lookup), "%NOPE%\\bin");
        assert_eq!(expand("C:\\100%\\bin", &lookup), "C:\\100%\\bin");
    }

    #[test]
    fn finds_a_variable_after_a_stray_percent_sign() {
        assert_eq!(expand("50%;%SystemRoot%", &lookup), "50%;C:\\Windows");
    }

    #[test]
    fn text_without_variables_is_unchanged() {
        assert_eq!(expand("C:\\tools", &lookup), "C:\\tools");
    }

    #[test]
    fn a_windows_program_is_typed_without_extension_and_in_any_case() {
        let extensions = [".exe".to_owned(), ".cmd".to_owned()];

        assert_eq!(
            windows_program("Git.EXE", &extensions),
            Some("git".to_owned())
        );
        assert_eq!(
            windows_program("npm.cmd", &extensions),
            Some("npm".to_owned())
        );
        assert_eq!(windows_program("notes.txt", &extensions), None);
        assert_eq!(windows_program("README", &extensions), None);
        assert_eq!(windows_program(".exe", &extensions), None);
    }

    #[cfg(windows)]
    #[test]
    fn lists_the_programs_of_every_folder_once_and_sorted() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        for file in ["zeta.exe", "Alpha.CMD", "notes.txt"] {
            fs::write(first.path().join(file), "").unwrap();
        }
        fs::write(second.path().join("alpha.exe"), "").unwrap();
        let missing = first.path().join("gone");
        let path = std::env::join_paths([first.path(), &missing, second.path()]).unwrap();

        assert_eq!(programs_on(&path), ["alpha", "zeta"]);
    }

    #[cfg(unix)]
    #[test]
    fn lists_the_files_that_can_run_once_and_sorted() {
        use std::os::unix::fs::PermissionsExt;

        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        for (folder, file, mode) in [
            (&first, "zeta", 0o755),
            (&first, "notes.txt", 0o644),
            (&second, "alpha", 0o755),
            (&second, "zeta", 0o755),
        ] {
            let path = folder.path().join(file);
            fs::write(&path, "").unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(mode)).unwrap();
        }
        // A link to a program is a program; a folder is not.
        std::os::unix::fs::symlink(first.path().join("zeta"), first.path().join("link")).unwrap();
        fs::create_dir(first.path().join("folder")).unwrap();
        let missing = first.path().join("gone");
        let path = std::env::join_paths([first.path(), &missing, second.path()]).unwrap();

        assert_eq!(programs_on(&path), ["alpha", "link", "zeta"]);
    }

    #[cfg(windows)]
    #[test]
    fn windows_stores_a_path_with_the_system_folder() {
        let path = fresh_path().expect("Windows stores PATH in the registry");

        assert!(path.to_string_lossy().to_lowercase().contains("system32"));
    }
}
