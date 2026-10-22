//! Test-only native-user precondition. Reads this process token; never changes it.
use super::super::security;
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, FixtureStep, Operation, Stage};
use crate::windows_publication_contract::native_user_context;
use std::{
    fs::File,
    io::Write,
    os::windows::io::{AsRawHandle, FromRawHandle},
};
use windows_sys::Win32::{
    Security::{
        GetTokenInformation, TokenElevation, TokenElevationType, TokenHasRestrictions,
        TokenIsAppContainer, TOKEN_INFORMATION_CLASS, TOKEN_QUERY,
    },
    System::Threading::{GetCurrentProcess, OpenProcessToken},
};

fn scalar(token: &File, class: TOKEN_INFORMATION_CLASS) -> Result<u32> {
    let mut value = u32::MAX;
    let mut length = 0;
    let status = security::os_check(
        unsafe {
            GetTokenInformation(
                token.as_raw_handle(),
                class,
                std::ptr::from_mut(&mut value).cast(),
                std::mem::size_of_val(&value) as u32,
                &mut length,
            )
        },
        Operation::TokenInformation,
    );
    #[cfg(test)]
    {
        // os_check captures the actual API error before diagnostic I/O can change it.
        let _ = writeln!(
            std::io::stderr(),
            "KLODA_D1_TOKEN_QUERY class={class} capacity={} return_length={length}",
            std::mem::size_of_val(&value),
        );
    }
    status?;
    diagnostic::validation(Operation::TokenInformation, decode_scalar(class, value, length))
}

fn decode_scalar(class: TOKEN_INFORMATION_CLASS, value: u32, length: u32) -> Result<u32> {
    // Microsoft win32metadata discussion 2308: class 21 returns a BOOLEAN at a
    // DWORD-aligned address. Only its first byte is payload; keep the u32 buffer.
    if class == TokenHasRestrictions && length == std::mem::size_of::<u8>() as u32 {
        Ok(u32::from(value.to_ne_bytes()[0]))
    } else if [TokenIsAppContainer, TokenElevation, TokenElevationType].contains(&class)
        && length == std::mem::size_of::<u32>() as u32
    {
        Ok(value)
    } else {
        Err(PairingError::StorageFailure)
    }
}

pub(super) fn verify() -> Result<()> {
    let mut handle = std::ptr::null_mut();
    security::os_check(
        unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut handle) },
        Operation::OpenProcessToken,
    )?;
    // Match the existing principal helper's HANDLE ownership/CloseHandle discipline.
    let token = unsafe { File::from_raw_handle(handle) };
    let app_container = scalar(&token, TokenIsAppContainer)?;
    let restrictions = scalar(&token, TokenHasRestrictions)?;
    let elevated = scalar(&token, TokenElevation)?;
    let elevation_type = scalar(&token, TokenElevationType)?;
    let _ = writeln!(std::io::stderr(),
        "KLODA_D1_CONTEXT app_container={app_container} restrictions={restrictions} elevated={elevated} elevation_type={elevation_type}");
    if native_user_context(app_container, restrictions, elevated, elevation_type) {
        Ok(())
    } else {
        Err(PairingError::StorageFailure)
    }
}

#[test]
#[ignore = "Read-only context check for the approved separate standard-account D1 run"]
fn native_user_preflight() {
    diagnostic::run(|| diagnostic::at(Stage::Fixture(FixtureStep::NativeUserContext), verify))
        .unwrap();
}

#[test]
fn restriction_byte_ignores_unwritten_tail_but_never_masks_a_nonzero_flag() {
    for tail in [[0, 0, 0], [0xa5; 3], [0xff; 3]] {
        for byte in [0, 1, 2, u8::MAX] {
            let storage = u32::from_ne_bytes([byte, tail[0], tail[1], tail[2]]);
            let decoded = decode_scalar(TokenHasRestrictions, storage, 1).unwrap();
            assert_eq!(decoded, u32::from(byte));
            assert_eq!(native_user_context(0, decoded, 0, 1), byte == 0);
        }
    }
}

#[test]
fn token_query_classes_require_their_exact_payload_size() {
    for class in [TokenIsAppContainer, TokenElevation, TokenElevationType] {
        for length in [0, 1, 2, 3, 5, u32::MAX] {
            assert!(decode_scalar(class, 0, length).is_err());
        }
        for value in [0, 1, 2, 0x100, u32::MAX] {
            assert_eq!(decode_scalar(class, value, 4), Ok(value));
        }
    }
    for length in [0, 2, 3, 4, 5, u32::MAX] {
        assert!(decode_scalar(TokenHasRestrictions, 0, length).is_err());
    }
    for length in [0, 1, 4] {
        assert!(decode_scalar(-1, 0, length).is_err());
    }
}
