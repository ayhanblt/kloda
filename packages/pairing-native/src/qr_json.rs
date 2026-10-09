use crate::{
    error::{PairingError, Result},
    qr::{LanHint, QrPayload},
    qr_base64, qr_ip,
};
use zeroize::Zeroizing;

struct Parser<'a> {
    source: &'a str,
    pos: usize,
}
impl<'a> Parser<'a> {
    fn whitespace(&mut self) {
        while self
            .source
            .as_bytes()
            .get(self.pos)
            .is_some_and(|b| matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
        {
            self.pos += 1;
        }
    }
    fn consume(&mut self, byte: u8) -> Result<()> {
        self.whitespace();
        if self.source.as_bytes().get(self.pos) != Some(&byte) {
            return Err(PairingError::InvalidQr);
        }
        self.pos += 1;
        Ok(())
    }
    fn string(&mut self) -> Result<Zeroizing<String>> {
        self.whitespace();
        let start = self.pos;
        self.consume(b'"')?;
        while let Some(&byte) = self.source.as_bytes().get(self.pos) {
            self.pos += 1;
            if byte == b'"' {
                let value = serde_json::from_str::<String>(&self.source[start..self.pos])
                    .map_err(|_| PairingError::InvalidQr)?;
                return Ok(Zeroizing::new(value));
            }
            if byte == b'\\' {
                self.pos += 1;
            }
        }
        Err(PairingError::InvalidQr)
    }
    fn number(&mut self) -> Result<&'a str> {
        self.whitespace();
        let start = self.pos;
        while self
            .source
            .as_bytes()
            .get(self.pos)
            .is_some_and(|b| b.is_ascii_digit() || matches!(b, b'-' | b'+' | b'.' | b'e' | b'E'))
        {
            self.pos += 1;
        }
        if self.pos == start {
            return Err(PairingError::InvalidQr);
        }
        Ok(&self.source[start..self.pos])
    }
    fn next(&mut self) -> Result<bool> {
        self.whitespace();
        if self.source.as_bytes().get(self.pos) == Some(&b'}') {
            self.pos += 1;
            Ok(false)
        } else {
            self.consume(b',')?;
            Ok(true)
        }
    }
    fn lan(&mut self) -> Result<LanHint> {
        self.consume(b'{')?;
        let mut seen = 0u8;
        let mut ip = None;
        let mut port = None;
        loop {
            let key = self.string()?;
            let bit = match key.as_str() {
                "ip" => 1,
                "port" => 2,
                _ => return Err(PairingError::InvalidQr),
            };
            if seen & bit != 0 {
                return Err(PairingError::InvalidQr);
            }
            seen |= bit;
            self.consume(b':')?;
            if bit == 1 {
                ip = Some(qr_ip::parse(&self.string()?)?);
            } else {
                let token = self.number()?;
                if token.len() > 5
                    || token.starts_with('0')
                    || !token.bytes().all(|b| b.is_ascii_digit())
                {
                    return Err(PairingError::InvalidQr);
                }
                let value = token.parse::<u16>().map_err(|_| PairingError::InvalidQr)?;
                if value == 0 {
                    return Err(PairingError::InvalidQr);
                }
                port = Some(value);
            }
            if !self.next()? {
                break;
            }
        }
        Ok(LanHint {
            ip: ip.ok_or(PairingError::InvalidQr)?,
            port: port.ok_or(PairingError::InvalidQr)?,
        })
    }
}

pub(crate) fn parse(source: &str) -> Result<QrPayload> {
    let mut p = Parser { source, pos: 0 };
    p.consume(b'{')?;
    let mut seen = 0u8;
    let mut sid = None;
    let mut pc_fingerprint = None;
    let mut secret = None;
    let mut hint = None;
    loop {
        let key = p.string()?;
        let bit = match key.as_str() {
            "v" => 1,
            "sid" => 2,
            "pc_spki_sha256" => 4,
            "secret" => 8,
            "lan" => 16,
            _ => return Err(PairingError::InvalidQr),
        };
        if seen & bit != 0 {
            return Err(PairingError::InvalidQr);
        }
        seen |= bit;
        p.consume(b':')?;
        match bit {
            1 => {
                let token = p.number()?;
                if token != "1" {
                    if token == "0"
                        || !token.starts_with('0') && token.bytes().all(|b| b.is_ascii_digit())
                    {
                        return Err(PairingError::UnsupportedVersion);
                    }
                    return Err(PairingError::InvalidQr);
                }
            }
            2 => sid = Some(qr_base64::fixed::<16>(&p.string()?)?),
            4 => pc_fingerprint = Some(qr_base64::fixed::<32>(&p.string()?)?),
            8 => secret = Some(Zeroizing::new(qr_base64::fixed::<32>(&p.string()?)?)),
            16 => hint = Some(p.lan()?),
            _ => unreachable!(),
        }
        if !p.next()? {
            break;
        }
    }
    p.whitespace();
    if seen != 31 || p.pos != source.len() {
        return Err(PairingError::InvalidQr);
    }
    Ok(QrPayload {
        sid: sid.ok_or(PairingError::InvalidQr)?,
        pc_fingerprint: pc_fingerprint.ok_or(PairingError::InvalidQr)?,
        secret: secret.ok_or(PairingError::InvalidQr)?,
        hint: hint.ok_or(PairingError::InvalidQr)?,
    })
}
