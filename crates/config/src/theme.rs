//! Colours of the terminal.
//!
//! A theme starts from a preset and the user overrides any colour on top of
//! it. The rest of the app always receives a complete [`Theme`], so nothing
//! else has to know about presets or defaults.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// The 16 colours programs can ask for by number, in that order.
pub const ANSI_NAMES: [&str; 16] = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "bright_black",
    "bright_red",
    "bright_green",
    "bright_yellow",
    "bright_blue",
    "bright_magenta",
    "bright_cyan",
    "bright_white",
];

struct Preset {
    name: &'static str,
    background: &'static str,
    foreground: &'static str,
    cursor: &'static str,
    selection: &'static str,
    accent: &'static str,
    ansi: [&'static str; 16],
}

/// The first preset is the default.
const PRESETS: &[Preset] = &[
    Preset {
        name: "dark",
        background: "#14161b",
        foreground: "#d7dae0",
        cursor: "#8ab4f8",
        selection: "#8ab4f84d",
        accent: "#8ab4f8",
        ansi: [
            "#1f2430", "#f07178", "#9ece6a", "#e5c07b", "#7aa2f7", "#bb9af7", "#7dcfff", "#c8ccd4",
            "#5c6370", "#ff8b92", "#b5e48c", "#f0d58c", "#9dbcff", "#cfb3ff", "#a4e3ff", "#ffffff",
        ],
    },
    Preset {
        name: "light",
        background: "#fafafa",
        foreground: "#2a2c33",
        cursor: "#3b6fd4",
        selection: "#3b6fd433",
        accent: "#3b6fd4",
        ansi: [
            "#2a2c33", "#c4372f", "#3d8b40", "#a06a00", "#2f5fc4", "#8a3fc0", "#0b7f8f", "#9aa0aa",
            "#5c6370", "#e0483f", "#4fa353", "#b98300", "#3b76e8", "#a154dc", "#1298ab", "#d0d3d9",
        ],
    },
    Preset {
        name: "high-contrast",
        background: "#000000",
        foreground: "#ffffff",
        cursor: "#ffff00",
        selection: "#ffffff55",
        accent: "#ffff00",
        ansi: [
            "#000000", "#ff5555", "#55ff55", "#ffff55", "#6c8cff", "#ff6cff", "#55ffff", "#e5e5e5",
            "#7f7f7f", "#ff8080", "#80ff80", "#ffff80", "#99b3ff", "#ff99ff", "#80ffff", "#ffffff",
        ],
    },
];

/// A complete set of colours, as CSS hex strings (`#RRGGBB` or `#RRGGBBAA`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "ThemeFile")]
pub struct Theme {
    /// Name of the preset the colours started from.
    pub preset: String,
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub selection: String,
    /// Colour of the active tab and of the keyboard focus.
    pub accent: String,
    /// The 16 numbered colours, in the order of [`ANSI_NAMES`].
    pub ansi: Vec<String>,
}

/// The `[theme]` table as the user writes it: everything optional.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct ThemeFile {
    preset: Option<String>,
    background: Option<String>,
    foreground: Option<String>,
    cursor: Option<String>,
    selection: Option<String>,
    accent: Option<String>,
    /// `[theme.ansi]`: colour name to value.
    ansi: BTreeMap<String, String>,
}

impl Theme {
    fn from_preset(preset: &Preset) -> Self {
        Self {
            preset: preset.name.to_owned(),
            background: preset.background.to_owned(),
            foreground: preset.foreground.to_owned(),
            cursor: preset.cursor.to_owned(),
            selection: preset.selection.to_owned(),
            accent: preset.accent.to_owned(),
            ansi: preset
                .ansi
                .iter()
                .map(|colour| (*colour).to_owned())
                .collect(),
        }
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self::from_preset(&PRESETS[0])
    }
}

impl TryFrom<ThemeFile> for Theme {
    /// Shown to the user, who made a typo in the file.
    type Error = String;

    fn try_from(file: ThemeFile) -> Result<Self, Self::Error> {
        let preset = match &file.preset {
            None => &PRESETS[0],
            Some(name) => PRESETS
                .iter()
                .find(|preset| preset.name == name)
                .ok_or_else(|| {
                    let known: Vec<_> = PRESETS.iter().map(|preset| preset.name).collect();
                    format!(
                        "unknown theme preset `{name}`; use one of: {}",
                        known.join(", ")
                    )
                })?,
        };
        let mut theme = Theme::from_preset(preset);

        for (slot, value) in [
            (&mut theme.background, file.background),
            (&mut theme.foreground, file.foreground),
            (&mut theme.cursor, file.cursor),
            (&mut theme.selection, file.selection),
            (&mut theme.accent, file.accent),
        ] {
            if let Some(value) = value {
                *slot = value;
            }
        }
        for (name, value) in file.ansi {
            let index = ANSI_NAMES
                .iter()
                .position(|known| *known == name)
                .ok_or_else(|| {
                    format!(
                        "unknown colour `{name}` in [theme.ansi]; use one of: {}",
                        ANSI_NAMES.join(", ")
                    )
                })?;
            theme.ansi[index] = value;
        }
        Ok(theme)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(text: &str) -> Result<Theme, toml::de::Error> {
        toml::from_str(text)
    }

    #[test]
    fn an_empty_table_is_the_default_preset() {
        assert_eq!(parse("").unwrap(), Theme::default());
        assert_eq!(Theme::default().preset, "dark");
    }

    #[test]
    fn a_preset_changes_every_colour() {
        let light = parse("preset = \"light\"").unwrap();

        assert_eq!(light.background, "#fafafa");
        assert_ne!(light.ansi, Theme::default().ansi);
    }

    #[test]
    fn single_colours_override_the_preset() {
        let theme = parse("preset = \"light\"\nbackground = \"#ffffff\"").unwrap();

        assert_eq!(theme.background, "#ffffff");
        assert_eq!(theme.foreground, "#2a2c33");
    }

    #[test]
    fn numbered_colours_are_overridden_by_name() {
        let theme = parse("[ansi]\nred = \"#ff0000\"\nbright_white = \"#fefefe\"").unwrap();

        assert_eq!(theme.ansi[1], "#ff0000");
        assert_eq!(theme.ansi[15], "#fefefe");
        assert_eq!(theme.ansi[2], Theme::default().ansi[2]);
    }

    #[test]
    fn an_unknown_preset_names_the_valid_ones() {
        let error = parse("preset = \"neon\"").unwrap_err().to_string();

        assert!(
            error.contains("neon") && error.contains("high-contrast"),
            "{error}"
        );
    }

    #[test]
    fn a_misspelt_colour_name_is_an_error() {
        let error = parse("[ansi]\ngren = \"#00ff00\"").unwrap_err().to_string();

        assert!(error.contains("gren"), "{error}");
    }

    #[test]
    fn every_preset_is_complete_and_named_once() {
        let mut names: Vec<_> = PRESETS.iter().map(|preset| preset.name).collect();
        names.dedup();

        assert_eq!(names.len(), PRESETS.len());
        for preset in PRESETS {
            assert!(preset.ansi.iter().all(|colour| colour.starts_with('#')));
        }
    }
}
