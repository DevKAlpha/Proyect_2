//! The PATH a newly started program should see.
//!
//! A process keeps the PATH it was started with. On Windows an installer adds
//! its folder to the PATH stored in the registry, so without this module a
//! tool installed from the terminal would stay "not found" in every new tab
//! until the whole app was restarted.

use std::ffi::OsString;

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

    #[cfg(windows)]
    #[test]
    fn windows_stores_a_path_with_the_system_folder() {
        let path = fresh_path().expect("Windows stores PATH in the registry");

        assert!(path.to_string_lossy().to_lowercase().contains("system32"));
    }
}
