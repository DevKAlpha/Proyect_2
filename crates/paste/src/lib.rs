//! Pasting more than text.
//!
//! A terminal can only receive characters. Programs that take files, and AI
//! agents above all, take them as paths: paste the path of a picture into
//! an agent and it attaches the picture. So this crate turns what is on the
//! clipboard into paths:
//!
//! - files copied in the file manager are already paths;
//! - a picture (a screenshot, an image copied from a web page) has no path,
//!   so it is saved as a PNG file in a folder of the app and that path is
//!   used.
//!
//! Saved pictures are private data left on disk, so [`sweep`] deletes the
//! old ones.

use std::fs;
use std::io::{self, BufWriter};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// What the clipboard holds, in the order a paste prefers it.
#[derive(Debug, PartialEq, Eq)]
pub enum Clip {
    /// Files copied in the file manager.
    Files(Vec<PathBuf>),
    Text(String),
    /// A picture with no file behind it.
    Picture(Picture),
    /// Nothing a terminal can use.
    Empty,
}

/// A picture as raw pixels: four bytes per pixel, red, green, blue, alpha.
#[derive(Debug, PartialEq, Eq)]
pub struct Picture {
    pub width: usize,
    pub height: usize,
    pub rgba: Vec<u8>,
}

/// More pixels than any screen has. A larger "picture" is refused instead
/// of filling the disk.
const MAX_PIXELS: usize = 64_000_000;

/// Reads the clipboard of the system.
///
/// Files win over text, and text over a picture. Programs often put several
/// forms of the same thing there: a spreadsheet copies cells as text *and*
/// as a picture of them, and the user pasting into a terminal means the
/// text.
pub fn read_clipboard() -> Result<Clip, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| error.to_string())?;

    if let Ok(files) = clipboard.get().file_list() {
        if !files.is_empty() {
            return Ok(Clip::Files(files));
        }
    }
    if let Ok(text) = clipboard.get_text() {
        if !text.is_empty() {
            return Ok(Clip::Text(text));
        }
    }
    if let Ok(image) = clipboard.get_image() {
        return Ok(Clip::Picture(Picture {
            width: image.width,
            height: image.height,
            rgba: image.bytes.into_owned(),
        }));
    }
    Ok(Clip::Empty)
}

/// Saves `picture` as `<folder>/<name>.png` and returns the path.
pub fn save_picture(folder: &Path, picture: &Picture, name: &str) -> io::Result<PathBuf> {
    let pixels = picture.width.saturating_mul(picture.height);
    let well_formed = pixels > 0
        && pixels <= MAX_PIXELS
        && picture.rgba.len() == pixels * 4
        && u32::try_from(picture.width).is_ok()
        && u32::try_from(picture.height).is_ok();
    if !well_formed {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "the picture on the clipboard is empty, damaged or too large",
        ));
    }

    fs::create_dir_all(folder)?;
    let path = folder.join(format!("{name}.png"));
    let mut encoder = png::Encoder::new(
        BufWriter::new(fs::File::create(&path)?),
        picture.width as u32,
        picture.height as u32,
    );
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let written = encoder
        .write_header()
        .and_then(|mut writer| writer.write_image_data(&picture.rgba));
    if let Err(error) = written {
        // Half a picture is worse than none.
        let _ = fs::remove_file(&path);
        return Err(io::Error::other(error));
    }
    Ok(path)
}

/// Deletes the pictures in `folder` that were saved more than `max_age`
/// ago. Only PNG files are touched: nothing else is ever put there by the
/// app, and anything else is not ours to delete.
pub fn sweep(folder: &Path, max_age: Duration) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let path = entry.path();
        let is_png = path.extension().is_some_and(|extension| extension == "png");
        let old = entry
            .metadata()
            .and_then(|file| file.modified())
            .ok()
            .and_then(|saved| now.duration_since(saved).ok())
            .is_some_and(|age| age > max_age);
        if is_png && old {
            let _ = fs::remove_file(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Two pixels: one red, one half-transparent blue.
    fn tiny() -> Picture {
        Picture {
            width: 2,
            height: 1,
            rgba: vec![255, 0, 0, 255, 0, 0, 255, 128],
        }
    }

    #[test]
    fn a_picture_is_saved_as_a_png_that_reads_back_the_same() {
        let folder = tempfile::tempdir().unwrap();

        let path = save_picture(&folder.path().join("nested"), &tiny(), "imagen-1").unwrap();

        assert_eq!(path.file_name().unwrap(), "imagen-1.png");
        let decoder = png::Decoder::new(io::BufReader::new(fs::File::open(&path).unwrap()));
        let mut reader = decoder.read_info().unwrap();
        let mut pixels = vec![0; reader.output_buffer_size().unwrap()];
        let info = reader.next_frame(&mut pixels).unwrap();
        assert_eq!((info.width, info.height), (2, 1));
        assert_eq!(pixels[..info.buffer_size()], tiny().rgba[..]);
    }

    #[test]
    fn a_damaged_or_empty_picture_is_refused_and_leaves_no_file() {
        let folder = tempfile::tempdir().unwrap();
        let short = Picture {
            rgba: vec![0; 4],
            ..tiny()
        };
        let empty = Picture {
            width: 0,
            height: 0,
            rgba: Vec::new(),
        };

        assert!(save_picture(folder.path(), &short, "a").is_err());
        assert!(save_picture(folder.path(), &empty, "b").is_err());
        assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 0);
    }

    #[test]
    fn a_picture_too_large_is_refused_before_anything_is_written() {
        let folder = tempfile::tempdir().unwrap();
        let huge = Picture {
            width: MAX_PIXELS,
            height: 2,
            rgba: Vec::new(),
        };

        assert!(save_picture(folder.path(), &huge, "huge").is_err());
    }

    #[test]
    fn sweeping_deletes_only_old_pictures() {
        let folder = tempfile::tempdir().unwrap();
        let picture = save_picture(folder.path(), &tiny(), "imagen-1").unwrap();
        let other = folder.path().join("notes.txt");
        fs::write(&other, "mine").unwrap();

        sweep(folder.path(), Duration::from_secs(3600));
        assert!(picture.exists(), "a fresh picture stays");

        // Everything is older than no time at all.
        std::thread::sleep(Duration::from_millis(20));
        sweep(folder.path(), Duration::ZERO);
        assert!(!picture.exists());
        assert!(other.exists(), "files that are not pictures are not ours");
    }

    #[test]
    fn sweeping_a_folder_that_does_not_exist_is_fine() {
        sweep(Path::new("/nowhere/at/all"), Duration::ZERO);
    }
}
