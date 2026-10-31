//! SMB path validation. Reject SDK name translations instead of silently changing names.
use smb2::name::{decode_name, encode_name};

pub fn relative_path(path: &str) -> bool {
    if path.is_empty() || path.encode_utf16().count() > 1024 || path.contains('\\') {
        return false;
    }
    path.split('/').all(|part| {
        if !metadata_name(part) || part.ends_with(['.', ' ']) || part.encode_utf16().count() > 255 {
            return false;
        }
        let base = part
            .split('.')
            .next()
            .unwrap_or_default()
            .trim_end_matches(' ')
            .to_ascii_uppercase();
        let device = matches!(
            base.as_str(),
            "CON" | "PRN" | "AUX" | "NUL" | "CLOCK$" | "CONIN$" | "CONOUT$"
        ) || ["COM", "LPT"].iter().any(|prefix| {
            base.strip_prefix(prefix).is_some_and(|n| {
                matches!(
                    n,
                    "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                )
            })
        });
        !device && encode_name(part) == part && decode_name(part) == part
    })
}

pub(crate) fn metadata_name(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value.encode_utf16().count() <= 1024
        && !value
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\')
}
pub(crate) fn opaque(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
pub(crate) fn source_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_traversal_device_aliases_and_implicit_name_mapping() {
        for path in [
            "",
            "/absolute",
            "a//b",
            "a/../b",
            "a/./b",
            "a\\b",
            "a?b",
            "a:b",
            "trailing.",
            "trailing ",
            "CON.txt",
            "CON .txt",
            "CONIN$",
            "CONOUT$.txt",
            "CLOCK$",
            "nul",
            "LPT1",
            "COM¹.txt",
            "a\0b",
            "a\u{f025}b",
        ] {
            assert!(!relative_path(path), "{path:?}");
        }
        for path in [
            "normal/file.png",
            "Fotoğraflar/çocuk.png",
            "NFC/é.png",
            "NFD/e\u{301}.png",
        ] {
            assert!(relative_path(path), "{path:?}");
        }
    }
}
