//! What surrounds a terminal: where it is and what it is working on.
//!
//! Today that is the Git branch of a folder. It is read straight from the
//! files Git keeps, without starting `git`: the answer is needed after every
//! command, a process per prompt would be slow on Windows, and Git may not
//! be installed at all.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// Where a repository is: the branch being worked on, or a commit when no
/// branch is checked out.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GitBranch {
    /// Branch name, or the first characters of the commit when `detached`.
    pub name: String,
    /// No branch is checked out: the folder sits on a commit.
    pub detached: bool,
}

/// `HEAD` holds one short line. Anything longer is not a Git file.
const MAX_HEAD_BYTES: u64 = 1024;
/// How much of a commit id is shown, the length Git itself prints.
const SHORT_COMMIT: usize = 7;

/// The branch of the repository `folder` belongs to, or `None` when it is
/// not inside one. `folder` itself or any folder above it can be the root.
pub fn git_branch(folder: &Path) -> Option<GitBranch> {
    let head = folder.ancestors().find_map(head_file)?;
    parse_head(&read_start(&head)?)
}

/// The `HEAD` file of the repository rooted at `root`, if `root` is one.
fn head_file(root: &Path) -> Option<PathBuf> {
    let dot_git = root.join(".git");
    if dot_git.is_dir() {
        return Some(dot_git.join("HEAD"));
    }
    // Worktrees and submodules have a `.git` file that points at the real
    // folder: `gitdir: <path>`, relative to the file's folder or absolute.
    let pointer = read_start(&dot_git)?;
    let target = pointer.trim().strip_prefix("gitdir:")?.trim();
    // That path comes from a file anyone can put in a folder. Followed to
    // another machine, Windows would send the user's credentials there.
    if is_on_another_machine(target) {
        return None;
    }
    Some(root.join(target).join("HEAD"))
}

/// Whether `path` names a folder shared by another computer (`\\server\...`).
pub fn is_on_another_machine(path: &str) -> bool {
    path.starts_with("\\\\") || path.starts_with("//")
}

/// The first bytes of a small text file, or `None` when it cannot be read.
fn read_start(path: &Path) -> Option<String> {
    let mut text = String::new();
    fs::File::open(path)
        .ok()?
        .take(MAX_HEAD_BYTES)
        .read_to_string(&mut text)
        .ok()?;
    Some(text)
}

/// Reads the content of a `HEAD` file.
fn parse_head(head: &str) -> Option<GitBranch> {
    let head = head.trim();
    if let Some(reference) = head.strip_prefix("ref:") {
        let reference = reference.trim();
        let name = reference
            .strip_prefix("refs/heads/")
            .or_else(|| reference.strip_prefix("refs/"))
            .unwrap_or(reference);
        return (!name.is_empty() && is_plain(name)).then(|| GitBranch {
            name: name.to_owned(),
            detached: false,
        });
    }
    let is_commit = head.len() >= SHORT_COMMIT && head.chars().all(|c| c.is_ascii_hexdigit());
    is_commit.then(|| GitBranch {
        name: head[..SHORT_COMMIT].to_owned(),
        detached: true,
    })
}

/// `folder` written short for display: the user's home folder becomes `~`,
/// as shells write it. Windows does not tell upper from lower case in
/// paths, so neither does the comparison there.
pub fn short_label(folder: &Path, home: Option<&Path>) -> String {
    let full = folder.to_string_lossy();
    let Some(home) = home.map(Path::to_string_lossy) else {
        return full.into_owned();
    };
    let home = home.trim_end_matches(['/', '\\']);
    let Some((start, rest)) = full.split_at_checked(home.len()) else {
        return full.into_owned();
    };
    let same = if cfg!(windows) {
        start.eq_ignore_ascii_case(home)
    } else {
        start == home
    };
    // `/home/ana2` starts like `/home/ana` and is not inside it.
    if !home.is_empty() && same && (rest.is_empty() || rest.starts_with(['/', '\\'])) {
        format!("~{rest}")
    } else {
        full.into_owned()
    }
}

/// The name goes on screen, so it must be text and nothing else. Git itself
/// refuses control characters in branch names.
fn is_plain(name: &str) -> bool {
    !name.chars().any(char::is_control)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A folder that is a repository whose `HEAD` holds `head`.
    fn repository(head: &str) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join(".git")).unwrap();
        fs::write(root.path().join(".git").join("HEAD"), head).unwrap();
        root
    }

    fn branch(name: &str) -> Option<GitBranch> {
        Some(GitBranch {
            name: name.to_owned(),
            detached: false,
        })
    }

    #[test]
    fn reads_the_branch_of_a_repository() {
        let root = repository("ref: refs/heads/develop\n");

        assert_eq!(git_branch(root.path()), branch("develop"));
    }

    #[test]
    fn keeps_the_slashes_of_a_branch_name() {
        let root = repository("ref: refs/heads/feature/hints\n");

        assert_eq!(git_branch(root.path()), branch("feature/hints"));
    }

    #[test]
    fn finds_the_repository_from_a_folder_inside_it() {
        let root = repository("ref: refs/heads/main\n");
        let inside = root.path().join("src").join("deep");
        fs::create_dir_all(&inside).unwrap();

        assert_eq!(git_branch(&inside), branch("main"));
    }

    #[test]
    fn a_folder_outside_any_repository_has_no_branch() {
        let folder = tempfile::tempdir().unwrap();

        // The temporary folder could itself sit inside a repository; a
        // sibling `.git` that is a folder without HEAD stops the search.
        fs::create_dir(folder.path().join(".git")).unwrap();

        assert_eq!(git_branch(folder.path()), None);
    }

    #[test]
    fn a_commit_without_a_branch_is_shown_short() {
        let root = repository("4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39\n");

        assert_eq!(
            git_branch(root.path()),
            Some(GitBranch {
                name: "4f2a9c1".to_owned(),
                detached: true,
            })
        );
    }

    #[test]
    fn follows_the_pointer_of_a_worktree() {
        let root = tempfile::tempdir().unwrap();
        let real = root.path().join("real");
        let worktree = root.path().join("worktree");
        fs::create_dir_all(&real).unwrap();
        fs::create_dir_all(&worktree).unwrap();
        fs::write(real.join("HEAD"), "ref: refs/heads/fix\n").unwrap();
        fs::write(worktree.join(".git"), "gitdir: ../real\n").unwrap();

        assert_eq!(git_branch(&worktree), branch("fix"));
    }

    #[test]
    fn does_not_follow_a_pointer_to_another_machine() {
        let folder = tempfile::tempdir().unwrap();
        fs::write(
            folder.path().join(".git"),
            "gitdir: \\\\server\\share\\repo\n",
        )
        .unwrap();

        assert_eq!(head_file(folder.path()), None);
        assert!(is_on_another_machine("//server/share"));
        assert!(!is_on_another_machine("C:\\Users\\ana"));
        assert!(!is_on_another_machine("/home/ana"));
    }

    #[test]
    fn a_head_that_is_not_git_gives_nothing() {
        for head in ["", "hello", "ref:", "ref: refs/heads/a\u{1b}[31mb"] {
            assert_eq!(parse_head(head), None, "{head:?}");
        }
    }

    #[test]
    fn the_home_folder_is_written_as_a_tilde() {
        let home = Path::new("/home/ana");

        assert_eq!(short_label(Path::new("/home/ana"), Some(home)), "~");
        assert_eq!(
            short_label(Path::new("/home/ana/web/app"), Some(home)),
            "~/web/app"
        );
        assert_eq!(
            short_label(
                Path::new("C:\\Users\\ana\\web"),
                Some(Path::new("C:\\Users\\ana"))
            ),
            "~\\web"
        );
    }

    #[test]
    fn folders_outside_home_are_written_in_full() {
        let home = Path::new("/home/ana");

        assert_eq!(short_label(Path::new("/srv/app"), Some(home)), "/srv/app");
        assert_eq!(
            short_label(Path::new("/home/ana2/web"), Some(home)),
            "/home/ana2/web"
        );
        assert_eq!(short_label(Path::new("/srv/app"), None), "/srv/app");
        assert_eq!(short_label(Path::new("/"), Some(home)), "/");
    }

    #[cfg(windows)]
    #[test]
    fn windows_ignores_case_when_it_looks_for_home() {
        assert_eq!(
            short_label(
                Path::new("c:\\users\\ANA\\web"),
                Some(Path::new("C:\\Users\\ana"))
            ),
            "~\\web"
        );
    }

    #[test]
    fn a_huge_head_file_is_not_read_whole() {
        let root = repository(&"f".repeat(10_000));

        // Only the start is read, and a commit id is shown by its start.
        assert_eq!(git_branch(root.path()).unwrap().name, "fffffff");
    }
}
