use crate::error::{PairingError, Result};

pub(super) fn validate(bytes: &[u8]) -> Result<()> {
    walk(bytes, 0)
}

pub(super) fn single(bytes: &[u8]) -> Result<()> {
    let (_, _, rest) = element(bytes)?;
    if !rest.is_empty() {
        return Err(PairingError::TlsRejected);
    }
    validate(bytes)
}

/// Enforce schema cardinalities which a permissive ASN.1 parser may otherwise ignore.
pub(super) fn certificate_shape(bytes: &[u8]) -> Result<()> {
    single(bytes)?;
    let (tag, outer, _) = element(bytes)?;
    if tag != 0x30 {
        return Err(PairingError::TlsRejected);
    }
    let (tag, mut tbs, outer) = element(outer)?;
    if tag != 0x30 {
        return Err(PairingError::TlsRejected);
    }
    let (tag, signature_algorithm, outer) = element(outer)?;
    if tag != 0x30 || signature_algorithm != [6, 8, 0x2a, 0x86, 0x48, 0xce, 0x3d, 4, 3, 2] {
        return Err(PairingError::TlsRejected);
    }
    let (tag, _, rest) = element(outer)?;
    if tag != 3 || !rest.is_empty() {
        return Err(PairingError::TlsRejected);
    }
    for (index, expected) in [0xa0, 2, 0x30, 0x30, 0x30, 0x30, 0x30]
        .into_iter()
        .enumerate()
    {
        let (tag, value, rest) = element(tbs)?;
        if tag != expected {
            return Err(PairingError::TlsRejected);
        }
        if expected == 0xa0 && value != [2, 1, 2] {
            return Err(PairingError::TlsRejected);
        }
        if index == 2 && value != signature_algorithm {
            return Err(PairingError::TlsRejected);
        }
        if index == 4 {
            let (first, _, second) = element(value)?;
            let (second, _, remainder) = element(second)?;
            if !matches!(first, 0x17 | 0x18)
                || !matches!(second, 0x17 | 0x18)
                || !remainder.is_empty()
            {
                return Err(PairingError::TlsRejected);
            }
        }
        tbs = rest;
    }
    for expected in [0x81, 0x82] {
        if tbs.first() == Some(&expected) {
            tbs = element(tbs)?.2;
        }
    }
    let (tag, extensions, rest) = element(tbs)?;
    if tag != 0xa3 || !rest.is_empty() {
        return Err(PairingError::TlsRejected);
    }
    let (tag, mut extensions, rest) = element(extensions)?;
    if tag != 0x30 || !rest.is_empty() {
        return Err(PairingError::TlsRejected);
    }
    while !extensions.is_empty() {
        let (tag, extension, rest) = element(extensions)?;
        if tag != 0x30 {
            return Err(PairingError::TlsRejected);
        }
        let (tag, _, mut extension) = element(extension)?;
        if tag != 6 {
            return Err(PairingError::TlsRejected);
        }
        if extension.first() == Some(&1) {
            let (_, boolean, rest) = element(extension)?;
            if boolean != [0xff] {
                return Err(PairingError::TlsRejected);
            }
            extension = rest;
        }
        let (tag, _, remaining) = element(extension)?;
        if tag != 4 || !remaining.is_empty() {
            return Err(PairingError::TlsRejected);
        }
        extensions = rest;
    }
    Ok(())
}
fn walk(mut bytes: &[u8], depth: usize) -> Result<()> {
    if depth > 16 {
        return Err(PairingError::TlsRejected);
    }
    while !bytes.is_empty() {
        let (tag, value, rest) = element(bytes)?;
        if tag & 0x20 != 0 {
            walk(value, depth + 1)?;
            if tag == 0x31 {
                let mut previous: Option<&[u8]> = None;
                let mut items = value;
                while !items.is_empty() {
                    let (_, _, remainder) = element(items)?;
                    let item = &items[..items.len() - remainder.len()];
                    if previous.is_some_and(|p| p > item) {
                        return Err(PairingError::TlsRejected);
                    }
                    previous = Some(item);
                    items = remainder;
                }
            }
        } else {
            match tag {
                1 if value != [0] && value != [0xff] => return Err(PairingError::TlsRejected),
                2 if value.is_empty()
                    || value.len() > 1
                        && (value[0] == 0 && value[1] & 0x80 == 0
                            || value[0] == 0xff && value[1] & 0x80 != 0) =>
                {
                    return Err(PairingError::TlsRejected)
                }
                3 => {
                    if value.is_empty()
                        || value[0] > 7
                        || value.len() == 1 && value[0] != 0
                        || value.len() > 1 && value.last().unwrap() & ((1u8 << value[0]) - 1) != 0
                    {
                        return Err(PairingError::TlsRejected);
                    }
                }
                5 if !value.is_empty() => return Err(PairingError::TlsRejected),
                6 => {
                    if value.is_empty() || value.last().unwrap() & 0x80 != 0 {
                        return Err(PairingError::TlsRejected);
                    }
                    let mut start = true;
                    for &byte in value {
                        if start && byte == 0x80 {
                            return Err(PairingError::TlsRejected);
                        }
                        start = byte & 0x80 == 0;
                    }
                }
                0x17 | 0x18 => {
                    let n = if tag == 0x17 { 13 } else { 15 };
                    if value.len() != n
                        || value[n - 1] != b'Z'
                        || !value[..n - 1].iter().all(u8::is_ascii_digit)
                    {
                        return Err(PairingError::TlsRejected);
                    }
                    if tag == 0x18
                        && &value[..4] >= b"1950".as_slice()
                        && &value[..4] <= b"2049".as_slice()
                    {
                        return Err(PairingError::TlsRejected);
                    }
                }
                _ => (),
            }
        }
        bytes = rest;
    }
    Ok(())
}

pub(super) fn element(bytes: &[u8]) -> Result<(u8, &[u8], &[u8])> {
    if bytes.len() < 2 || bytes[0] & 0x1f == 0x1f {
        return Err(PairingError::TlsRejected);
    }
    let tag = bytes[0];
    let mut start = 2;
    let mut length = usize::from(bytes[1]);
    if length & 0x80 != 0 {
        let count = length & 0x7f;
        if count == 0 || count > 2 || bytes.len() < 2 + count || bytes[2] == 0 {
            return Err(PairingError::TlsRejected);
        }
        length = 0;
        for &byte in &bytes[2..2 + count] {
            length = length * 256 + usize::from(byte);
        }
        if length < 128 {
            return Err(PairingError::TlsRejected);
        }
        start += count;
    }
    let end = start + length;
    if end > bytes.len() {
        return Err(PairingError::TlsRejected);
    }
    Ok((tag, &bytes[start..end], &bytes[end..]))
}
