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
    security::os_check(
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
    )?;
    diagnostic::validation(
        Operation::TokenInformation,
        if length == std::mem::size_of_val(&value) as u32 {
            Ok(value)
        } else {
            Err(PairingError::StorageFailure)
        },
    )
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
