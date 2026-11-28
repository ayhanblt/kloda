use std::sync::{OnceLock, RwLock};

static LOCAL_DEVICE_NAME: OnceLock<RwLock<Option<String>>> = OnceLock::new();

fn cell() -> &'static RwLock<Option<String>> {
    LOCAL_DEVICE_NAME.get_or_init(|| RwLock::new(None))
}

#[allow(dead_code)]
pub(crate) fn set_local_name(raw: &str) {
    let cleaned = sanitize_display(raw);
    if let Ok(mut guard) = cell().write() {
        *guard = cleaned;
    }
}

pub(crate) fn local_name() -> Option<String> {
    cell().read().ok().and_then(|guard| guard.clone())
}

pub(crate) fn sanitize_display(raw: &str) -> Option<String> {
    let mut out = String::new();
    let mut prev_space = false;
    for ch in raw.chars() {
        if ch.is_control() {
            if !out.is_empty() && !prev_space {
                out.push(' ');
                prev_space = true;
            }
            continue;
        }
        if ch.is_whitespace() {
            if !out.is_empty() && !prev_space {
                out.push(' ');
                prev_space = true;
            }
            continue;
        }
        out.push(ch);
        prev_space = false;
        if out.chars().count() >= 48 {
            break;
        }
    }
    let trimmed = out.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

pub(crate) fn sanitize_folder(raw: &str) -> Option<String> {
    let mut out = String::new();
    let mut prev_space = false;
    for ch in raw.chars() {
        let forbidden = ch.is_control()
            || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|');
        if forbidden || ch.is_whitespace() {
            if !out.is_empty() && !prev_space {
                out.push(' ');
                prev_space = true;
            }
            continue;
        }
        out.push(ch);
        prev_space = false;
        if out.chars().count() >= 48 {
            break;
        }
    }
    let trimmed = out.trim().trim_end_matches(['.', ' ']).trim();
    if trimmed.is_empty() || matches!(trimmed, "." | "..") {
        return None;
    }
    let stem = trimmed.split('.').next().unwrap_or(trimmed).to_ascii_uppercase();
    if matches!(
        stem.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    ) {
        return None;
    }
    Some(trimmed.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_display_and_folder_names_across_platforms() {
        assert_eq!(sanitize_display("  \t \n "), None);
        assert_eq!(
            sanitize_display("Ayhan’ın\nMac mini\x07"),
            Some("Ayhan’ın Mac mini".into())
        );
        assert_eq!(sanitize_folder("Galaxy S24"), Some("Galaxy S24".into()));
        assert_eq!(sanitize_folder("a/b\\c:d*e?\"<>|"), Some("a b c d e".into()));
        assert_eq!(sanitize_folder("con"), None);
        assert_eq!(sanitize_folder("LPT1.txt"), None);
        assert_eq!(sanitize_folder(".."), None);
        assert_eq!(sanitize_folder("iPhone... "), Some("iPhone".into()));
    }
}
