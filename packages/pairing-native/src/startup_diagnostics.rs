#[cfg(any(target_os = "windows", test))]
use crate::error::PairingError;
use crate::error::Result;

#[derive(Clone, Copy, Debug)]
pub(crate) enum Stage {
    Directory,
    Storage,
    #[cfg(any(target_os = "windows", test))]
    OwnerLock,
    Epoch,
    Continuity,
    Identity,
    Certificate,
    Database,
    Initialized,
    #[cfg(test)]
    Fixture(FixtureStep),
    #[cfg(test)]
    SecurityRule(SecurityRule),
}

#[cfg(test)]
#[derive(Clone, Copy, Debug)]
pub(crate) enum SecurityRule {
    Principals,
    DescriptorPresence,
    OwnerSidValidity,
    AclValidity,
    AceType,
    AceHeaderSize,
    AceSidBounds,
    AceSidValidity,
    UserDirectoryOwner,
    UnexpectedDirectoryWriter,
    ProtectedOwnerAndInheritance,
    ProtectedAceCount,
    ProtectedAceMaskAndFlags,
    ProtectedAcePrincipal,
    ProtectedDuplicatePrincipal,
}

#[cfg(test)]
#[derive(Clone, Copy, Debug)]
pub(crate) enum FixtureStep {
    NativeUserContext,
    Base,
    VolumeRootOpen,
    AncestorOpen,
    BaseOpen,
    Volume,
    BaseSecurity,
    Nonce,
    RootCreate,
    PairingCreate,
    RootOpen,
    PairingOpen,
    RootSecurity,
    PairingSecurity,
    OwnerCreate,
    OwnerSecurity,
    OwnerFlush,
}

#[cfg(any(target_os = "windows", test))]
#[derive(Clone, Copy, Debug)]
pub(crate) enum Operation {
    OpenFile,
    CreateNew,
    FileInformation,
    FileValidation,
    PathSelectionValidation,
    LeafNameValidation,
    FinalPath,
    FinalPathValidation,
    VolumeInformation,
    VolumeValidation,
    Flush,
    Publish,
    CreateDirectory,
    KnownFolder,
    SecurityInfo,
    SecurityValidation,
    OpenProcessToken,
    TokenInformation,
    CopySid,
    WellKnownSid,
    InitializeAcl,
    AddAce,
    InitializeDescriptor,
    SetOwner,
    SetDacl,
    SetControl,
    GetControl,
    GetAce,
    Io,
}

#[cfg(any(target_os = "windows", test))]
#[derive(Clone, Copy, Debug)]
struct Failure {
    stage: Stage,
    operation: Option<Operation>,
    code: PairingError,
    win32: Option<u32>,
}
#[cfg(any(target_os = "windows", test))]
#[derive(Clone, Copy)]
struct State {
    stage: Stage,
    failure: Option<Failure>,
}
#[cfg(any(target_os = "windows", test))]
thread_local! {
    static STATE: std::cell::Cell<Option<State>> = const { std::cell::Cell::new(None) };
}

// Only fixed enum labels and numeric OS codes can reach the diagnostic output.
#[cfg(any(target_os = "windows", test))]
pub(crate) fn record(operation: Option<Operation>, code: PairingError, win32: Option<u32>) {
    STATE.with(|state| {
        if let Some(mut current) = state.get() {
            if current.failure.is_none() {
                current.failure = Some(Failure {
                    stage: current.stage,
                    operation,
                    code,
                    win32,
                });
                state.set(Some(current));
            }
        }
    });
}

#[cfg(any(target_os = "windows", test))]
pub(crate) fn validation<T>(operation: Operation, result: Result<T>) -> Result<T> {
    if let Err(error) = &result {
        record(Some(operation), *error, None);
    }
    result
}

pub(crate) fn at<T>(stage: Stage, action: impl FnOnce() -> Result<T>) -> Result<T> {
    #[cfg(any(target_os = "windows", test))]
    let previous = STATE.with(|state| {
        let old = state.get().map(|s| s.stage);
        if let Some(mut current) = state.get() {
            current.stage = stage;
            state.set(Some(current));
        }
        old
    });
    #[cfg(not(any(target_os = "windows", test)))]
    let _ = stage;
    let result = action();
    #[cfg(any(target_os = "windows", test))]
    {
        if let Err(error) = result.as_ref() {
            record(None, *error, None);
        }
        STATE.with(|state| {
            if let (Some(mut current), Some(previous)) = (state.get(), previous) {
                current.stage = previous;
                state.set(Some(current));
            }
        });
    }
    result
}

#[cfg(any(target_os = "windows", test))]
struct Restore(Option<State>);
#[cfg(any(target_os = "windows", test))]
impl Drop for Restore {
    fn drop(&mut self) {
        STATE.with(|state| state.set(self.0));
    }
}

pub(crate) fn run<T>(action: impl FnOnce() -> Result<T>) -> Result<T> {
    #[cfg(any(target_os = "windows", test))]
    let previous = STATE.with(|state| {
        state.replace(Some(State {
            stage: Stage::Directory,
            failure: None,
        }))
    });
    #[cfg(any(target_os = "windows", test))]
    let _restore = Restore(previous);
    let result = action();
    #[cfg(any(target_os = "windows", test))]
    {
        let observed = STATE.with(|state| state.get());
        #[cfg(target_os = "windows")]
        if result.is_err() {
            if let Some(failure) = observed.and_then(|s| s.failure) {
                use std::io::Write;
                let _ = writeln!(std::io::stderr(), "{}", line(failure));
            }
        }
        #[cfg(all(test, not(target_os = "windows")))]
        let _ = observed;
    }
    result
}

#[cfg(any(target_os = "windows", test))]
fn line(failure: Failure) -> String {
    format!(
        "KLODA_STARTUP stage={:?} operation={:?} code={} win32={:?}",
        failure.stage,
        failure.operation,
        failure.code.code(),
        failure.win32
    )
}

#[cfg(test)]
#[path = "startup_diagnostics_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "startup_diagnostics_fixture_tests.rs"]
mod fixture_tests;
