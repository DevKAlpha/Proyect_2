//! Ready-made looks.
//!
//! A template is a piece of configuration file: the `[font]`, `[cursor]` and
//! `[theme]` tables, written by hand with comments. Templates do two jobs.
//! They change the look in one click, and they teach: the simple ones show
//! that one line is enough, the detailed ones show everything that can be
//! set. After applying one, the user's file holds that text and can be
//! edited from there.
//!
//! Applying a template only replaces those tables. The shell, the agents,
//! the background picture and every other setting of the user stay as they
//! are.

use serde::Serialize;

use crate::{Config, ConfigError};

/// A look the user can apply.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Template {
    /// Stable key the UI sends back.
    pub id: &'static str,
    /// Name shown to the user.
    pub name: &'static str,
    /// One line about what it looks like and what it teaches.
    pub about: &'static str,
    /// Whether it writes every colour (`true`) or only a few lines.
    pub detailed: bool,
    /// The tables it puts in the configuration file.
    #[serde(skip)]
    text: &'static str,
}

/// Tables a template owns. Any table under them (`theme.ansi`) goes too.
const OWNED: [&str; 3] = ["font", "cursor", "theme"];

/// First characters of the comment that opens every template.
const BANNER: &str = "# ── Plantilla";

const TEMPLATES: &[Template] = &[
    Template {
        id: "default",
        name: "Predeterminada",
        about: "Blanco sobre negro, como la consola de un router.",
        detailed: false,
        text: include_str!("templates/default.toml"),
    },
    Template {
        id: "dark",
        name: "Oscura",
        about: "Fondo oscuro y acento azul. Una sola línea cambia todos los colores.",
        detailed: false,
        text: include_str!("templates/dark.toml"),
    },
    Template {
        id: "light",
        name: "Clara",
        about: "Fondo claro y tinta gris, más suave que la consola.",
        detailed: false,
        text: include_str!("templates/light.toml"),
    },
    Template {
        id: "contrast",
        name: "Alto contraste",
        about: "Blanco sobre negro y letra grande.",
        detailed: false,
        text: include_str!("templates/contrast.toml"),
    },
    Template {
        id: "amber",
        name: "Ámbar",
        about: "El tema oscuro con tres colores cambiados.",
        detailed: false,
        text: include_str!("templates/amber.toml"),
    },
    Template {
        id: "nord",
        name: "Nórdica",
        about: "Azules fríos y poco contraste. Todos los colores escritos.",
        detailed: true,
        text: include_str!("templates/nord.toml"),
    },
    Template {
        id: "dracula",
        name: "Drácula",
        about: "Fondo morado oscuro y colores muy vivos.",
        detailed: true,
        text: include_str!("templates/dracula.toml"),
    },
    Template {
        id: "paper",
        name: "Papel",
        about: "Fondo crema y tinta oscura, con cursor subrayado.",
        detailed: true,
        text: include_str!("templates/paper.toml"),
    },
    Template {
        id: "retro",
        name: "Fósforo verde",
        about: "Verde sobre negro, como un monitor de los ochenta.",
        detailed: true,
        text: include_str!("templates/retro.toml"),
    },
];

/// Every template, the simple ones first.
pub fn templates() -> &'static [Template] {
    TEMPLATES
}

/// The configuration file `config` with the look of template `id`.
///
/// The tables the template owns are taken out of `config`, comments
/// included, and the template's text goes at the end. Everything else is
/// kept as the user wrote it, to the letter. The result is checked before it
/// is returned: a file that does not load is never handed back.
pub fn apply_template(config: &str, id: &str) -> Result<String, ConfigError> {
    let template = TEMPLATES
        .iter()
        .find(|template| template.id == id)
        .ok_or_else(|| ConfigError::UnknownTemplate(id.to_owned()))?;

    let mut kept = String::new();
    // Whether the lines being read belong to a table that is going away.
    let mut dropping = false;
    for line in config.lines() {
        if let Some(table) = table_name(line) {
            let owned = OWNED
                .iter()
                .any(|name| table == *name || table.starts_with(&format!("{name}.")));
            if owned && !dropping {
                drop_banner(&mut kept);
            }
            dropping = owned;
        }
        if !dropping {
            kept.push_str(line);
            kept.push('\n');
        }
    }

    let applied = format!("{}\n\n{}", kept.trim_end(), template.text);
    Config::parse(&applied)?;
    Ok(applied)
}

/// The name in a table header line (`[theme.ansi]`), or `None` for any
/// other line. Lists of tables (`[[agents]]`) are named the same way.
fn table_name(line: &str) -> Option<&str> {
    let header = line.trim().strip_prefix('[')?;
    let header = header.strip_prefix('[').unwrap_or(header);
    let name = &header[..header.find(']')?];
    Some(name.trim())
}

/// Takes the opening comment of an earlier template off the end of `kept`.
/// It sits right above the first table of that template, so without this
/// one more would pile up with every template applied.
fn drop_banner(kept: &mut String) {
    let Some(start) = kept.rfind(BANNER) else {
        return;
    };
    let only_comments = kept[start..]
        .lines()
        .all(|line| line.trim().is_empty() || line.trim_start().starts_with('#'));
    if only_comments {
        kept.truncate(start);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::DEFAULT_TOML;

    #[test]
    fn every_template_loads_on_top_of_the_default_file() {
        for template in templates() {
            let applied = apply_template(DEFAULT_TOML, template.id).unwrap();

            assert!(Config::parse(&applied).is_ok(), "{}", template.id);
            assert!(template.text.starts_with(BANNER), "{}", template.id);
        }
    }

    #[test]
    fn templates_have_distinct_ids_and_come_in_both_kinds() {
        let mut ids: Vec<_> = templates().iter().map(|template| template.id).collect();
        ids.sort_unstable();
        ids.dedup();

        assert_eq!(ids.len(), templates().len());
        assert!(templates().iter().any(|template| template.detailed));
        assert!(templates().iter().any(|template| !template.detailed));
    }

    #[test]
    fn the_default_template_gives_the_default_look() {
        let applied = apply_template(DEFAULT_TOML, "default").unwrap();

        assert_eq!(Config::parse(&applied).unwrap(), Config::default());
    }

    #[test]
    fn a_template_changes_the_look() {
        let config = Config::parse(&apply_template(DEFAULT_TOML, "nord").unwrap()).unwrap();

        assert_eq!(config.theme.background, "#2e3440");
        assert_eq!(config.theme.ansi[1], "#bf616a");
        assert_eq!(config.font.line_height, 1.35);
    }

    #[test]
    fn everything_that_is_not_the_look_is_kept_to_the_letter() {
        let mine = "default_shell = \"cmd\"  # mine\nscrollback = 42\n\n\
                    [theme]\npreset = \"light\"\n# a note of mine\n\n\
                    [theme.ansi]\nred = \"#ff0000\"\n\n\
                    [background]\nimage = 'C:\\fondos\\noche.png'\ndim = 0.5\n\n\
                    [font]\nsize = 20\n\n\
                    [[agents]]\nname = \"Aider\"\ncommand = \"aider\"\n";

        let applied = apply_template(mine, "dracula").unwrap();
        let config = Config::parse(&applied).unwrap();

        assert!(applied.starts_with("default_shell = \"cmd\"  # mine\nscrollback = 42\n"));
        assert!(applied.contains("[background]\nimage = 'C:\\fondos\\noche.png'\ndim = 0.5\n"));
        assert!(applied.contains("[[agents]]\nname = \"Aider\"\ncommand = \"aider\"\n"));
        assert!(!applied.contains("a note of mine"));
        assert_eq!(config.default_shell.as_deref(), Some("cmd"));
        assert_eq!(config.agents.len(), 1);
        assert_eq!(config.theme.background, "#282a36");
        // The size the user had is gone with the table: the template is exact.
        assert_eq!(config.font.size, 14);
    }

    #[test]
    fn applying_templates_again_and_again_leaves_one_template_in_the_file() {
        let mut file = DEFAULT_TOML.to_owned();
        for id in ["nord", "light", "retro", "default", "nord"] {
            file = apply_template(&file, id).unwrap();
        }
        let once = apply_template(DEFAULT_TOML, "nord").unwrap();

        assert_eq!(file, once);
        assert_eq!(file.matches(BANNER).count(), 1);
    }

    #[test]
    fn an_unknown_template_is_an_error() {
        assert!(matches!(
            apply_template(DEFAULT_TOML, "neon"),
            Err(ConfigError::UnknownTemplate(id)) if id == "neon"
        ));
    }

    #[test]
    fn a_file_with_an_error_elsewhere_is_not_handed_back() {
        assert!(apply_template("scrollback = \"many\"\n", "light").is_err());
    }

    #[test]
    fn reads_table_names_from_header_lines_only() {
        assert_eq!(table_name("[theme]"), Some("theme"));
        assert_eq!(
            table_name("  [ theme.ansi ]  # colours"),
            Some("theme.ansi")
        );
        assert_eq!(table_name("[[agents]]"), Some("agents"));
        assert_eq!(table_name("# [theme.ansi]"), None);
        assert_eq!(table_name("size = 14"), None);
    }
}
