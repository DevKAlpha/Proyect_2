//! Other machines the user works on over SSH.
//!
//! "Remote control" in this app means going out: opening a terminal on
//! another machine with the `ssh` program of the system. The app itself
//! never listens for connections. This module only *reads names*: the
//! machines the user already wrote down in their own SSH configuration, so
//! they can be offered in a menu. It never reads keys and never connects.

use std::fs;
use std::io::Read;
use std::path::Path;

use serde::Serialize;

/// A machine named in the user's SSH configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SshHost {
    /// The short name the user gave it. `ssh <name>` connects to it.
    pub name: String,
    /// Who and where it connects to (`user@address`), to tell hosts apart
    /// in a menu. `None` when the configuration does not say.
    pub address: Option<String>,
}

/// What the UI needs to offer SSH connections.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SshStatus {
    /// Whether this machine has the `ssh` program.
    pub available: bool,
    pub hosts: Vec<SshHost>,
}

/// A configuration larger than this is not one a person wrote by hand.
const MAX_CONFIG_BYTES: u64 = 1024 * 1024;

/// Whether `ssh` is installed, and the hosts named in the file at `config`
/// (`~/.ssh/config`). A missing or unreadable file means no hosts.
pub fn ssh_status(config: Option<&Path>) -> SshStatus {
    SshStatus {
        available: crate::system_lookup()("ssh"),
        hosts: config
            .and_then(read_config)
            .map(|text| parse_hosts(&text))
            .unwrap_or_default(),
    }
}

fn read_config(path: &Path) -> Option<String> {
    let mut text = String::new();
    fs::File::open(path)
        .ok()?
        .take(MAX_CONFIG_BYTES)
        .read_to_string(&mut text)
        .ok()?;
    Some(text)
}

/// The hosts an SSH configuration names, in the order of the file.
///
/// Names with `*`, `?` or `!` are patterns that apply settings to many
/// hosts, not machines to connect to, and are left out. `Include` lines are
/// not followed: the menu is a shortcut, and any host can still be typed.
pub fn parse_hosts(config: &str) -> Vec<SshHost> {
    let mut hosts: Vec<SshHost> = Vec::new();
    // The hosts of the block being read; `HostName` and `User` apply to them.
    let mut block: Vec<usize> = Vec::new();
    let mut user: Option<String> = None;
    let mut host_name: Option<String> = None;

    let close = |hosts: &mut Vec<SshHost>,
                 block: &mut Vec<usize>,
                 user: &mut Option<String>,
                 host_name: &mut Option<String>| {
        let user = user.take();
        let host_name = host_name.take();
        for index in block.drain(..) {
            let host = &mut hosts[index];
            host.address = match (&user, &host_name) {
                (Some(user), Some(address)) => Some(format!("{user}@{address}")),
                (Some(user), None) => Some(format!("{user}@{}", host.name)),
                (None, Some(address)) => Some(address.clone()),
                (None, None) => None,
            };
        }
    };

    for line in config.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        // `Keyword value` or `Keyword=value`; keywords ignore case.
        let (keyword, value) = line
            .split_once(|c: char| c.is_whitespace() || c == '=')
            .unwrap_or((line, ""));
        let value = value.trim_start_matches(|c: char| c.is_whitespace() || c == '=');
        match keyword.to_ascii_lowercase().as_str() {
            "host" => {
                close(&mut hosts, &mut block, &mut user, &mut host_name);
                for name in value.split_whitespace().map(unquote) {
                    let is_pattern = name.contains(['*', '?', '!']);
                    if is_pattern || name.is_empty() || hosts.iter().any(|host| host.name == name) {
                        continue;
                    }
                    block.push(hosts.len());
                    hosts.push(SshHost {
                        name: name.to_owned(),
                        address: None,
                    });
                }
            }
            // A `Match` block is about conditions, not about one host.
            "match" => close(&mut hosts, &mut block, &mut user, &mut host_name),
            "hostname" if host_name.is_none() => host_name = first_word(value),
            "user" if user.is_none() => user = first_word(value),
            _ => {}
        }
    }
    close(&mut hosts, &mut block, &mut user, &mut host_name);
    hosts
}

fn unquote(word: &str) -> &str {
    word.trim_matches('"')
}

fn first_word(value: &str) -> Option<String> {
    value
        .split_whitespace()
        .next()
        .map(|word| unquote(word).to_owned())
        .filter(|word| !word.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn host(name: &str, address: Option<&str>) -> SshHost {
        SshHost {
            name: name.to_owned(),
            address: address.map(str::to_owned),
        }
    }

    #[test]
    fn lists_the_hosts_with_who_and_where_they_connect() {
        let hosts = parse_hosts(
            "# work\n\
             Host web\n\
             \x20   HostName 203.0.113.7\n\
             \x20   User deploy\n\
             \x20   IdentityFile ~/.ssh/work\n\
             \n\
             Host db\n\
             \x20   HostName db.internal\n\
             Host laptop\n\
             \x20   User ana\n\
             Host bare\n",
        );

        assert_eq!(
            hosts,
            [
                host("web", Some("deploy@203.0.113.7")),
                host("db", Some("db.internal")),
                host("laptop", Some("ana@laptop")),
                host("bare", None),
            ]
        );
    }

    #[test]
    fn patterns_are_settings_for_many_hosts_and_are_left_out() {
        let hosts = parse_hosts("Host *\n  User ana\nHost *.internal !old ?x\nHost web\n");

        assert_eq!(hosts, [host("web", None)]);
    }

    #[test]
    fn one_line_can_name_several_hosts() {
        let hosts = parse_hosts("Host a b *.x\n  HostName 10.0.0.1\n");

        assert_eq!(
            hosts,
            [host("a", Some("10.0.0.1")), host("b", Some("10.0.0.1"))]
        );
    }

    #[test]
    fn keywords_ignore_case_and_accept_an_equals_sign() {
        let hosts = parse_hosts("HOST=web\nhostname = example.org\nUSER=\"ana\"\n");

        assert_eq!(hosts, [host("web", Some("ana@example.org"))]);
    }

    #[test]
    fn a_host_named_twice_is_listed_once() {
        let hosts = parse_hosts("Host web\n  User a\nHost web\n  User b\n");

        assert_eq!(hosts, [host("web", Some("a@web"))]);
    }

    #[test]
    fn settings_after_a_match_line_belong_to_no_host() {
        let hosts = parse_hosts("Host web\nMatch user root\n  HostName other\n");

        assert_eq!(hosts, [host("web", None)]);
    }

    #[test]
    fn an_empty_or_unrelated_file_has_no_hosts() {
        assert!(parse_hosts("").is_empty());
        assert!(parse_hosts("ServerAliveInterval 60\n# Host commented\n").is_empty());
    }

    #[test]
    fn a_missing_configuration_means_no_hosts() {
        let folder = tempfile::tempdir().unwrap();

        assert!(ssh_status(Some(&folder.path().join("config")))
            .hosts
            .is_empty());
        assert!(ssh_status(None).hosts.is_empty());
    }

    #[test]
    fn reads_the_configuration_file() {
        let folder = tempfile::tempdir().unwrap();
        let config = folder.path().join("config");
        fs::write(&config, "Host web\n").unwrap();

        assert_eq!(ssh_status(Some(&config)).hosts, [host("web", None)]);
    }
}
