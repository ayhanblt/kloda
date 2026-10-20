use super::security::os_check;
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::Operation;
use std::{
    ffi::c_void,
    fs::File,
    mem::{size_of, size_of_val},
    os::windows::io::{AsRawHandle, FromRawHandle},
    ptr::{self, null_mut},
    sync::LazyLock,
};
use windows_sys::Win32::{
    Security::*,
    Storage::FileSystem::FILE_ALL_ACCESS,
    System::{
        SystemServices::SECURITY_DESCRIPTOR_REVISION,
        Threading::{GetCurrentProcess, OpenProcessToken},
    },
};

pub(super) struct Sid([u32; SECURITY_MAX_SID_SIZE as usize / 4]);
impl Sid {
    fn pointer(&self) -> PSID {
        self.0.as_ptr().cast_mut().cast()
    }
    fn well_known(kind: WELL_KNOWN_SID_TYPE) -> Result<Self> {
        let mut sid = Self([0; SECURITY_MAX_SID_SIZE as usize / 4]);
        let mut size = SECURITY_MAX_SID_SIZE;
        os_check(
            unsafe { CreateWellKnownSid(kind, null_mut(), sid.0.as_mut_ptr().cast(), &mut size) },
            Operation::WellKnownSid,
        )?;
        Ok(sid)
    }
}
pub(super) struct Principals {
    pub(super) user: Sid,
    pub(super) system: Sid,
    pub(super) administrators: Sid,
}
static PRINCIPALS: LazyLock<Result<Principals>> = LazyLock::new(|| {
    let mut token = null_mut();
    os_check(
        unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) },
        Operation::OpenProcessToken,
    )?;
    // File owns the token HANDLE too; CloseHandle is the required token destructor.
    let token = unsafe { File::from_raw_handle(token) };
    let mut buffer = [0usize; 32];
    let mut length = 0;
    os_check(
        unsafe {
            GetTokenInformation(
                token.as_raw_handle(),
                TokenUser,
                buffer.as_mut_ptr().cast(),
                size_of_val(&buffer) as u32,
                &mut length,
            )
        },
        Operation::TokenInformation,
    )?;
    if length < size_of::<TOKEN_USER>() as u32 || length > size_of_val(&buffer) as u32 {
        return Err(PairingError::StorageFailure);
    }
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut sid = Sid([0; SECURITY_MAX_SID_SIZE as usize / 4]);
    os_check(
        unsafe {
            CopySid(
                SECURITY_MAX_SID_SIZE,
                sid.0.as_mut_ptr().cast(),
                user.User.Sid,
            )
        },
        Operation::CopySid,
    )?;
    Ok(Principals {
        user: sid,
        system: Sid::well_known(WinLocalSystemSid)?,
        administrators: Sid::well_known(WinBuiltinAdministratorsSid)?,
    })
});
pub(super) fn principals() -> Result<&'static Principals> {
    PRINCIPALS.as_ref().map_err(|error| *error)
}
pub(super) fn same(left: PSID, right: &Sid) -> bool {
    unsafe { EqualSid(left, right.pointer()) != 0 }
}

pub(super) fn with_attributes<T>(
    inherit: bool,
    operation: impl FnOnce(&SECURITY_ATTRIBUTES) -> Result<T>,
) -> Result<T> {
    let principals = principals()?;
    // DWORD-aligned ACL: header + two maximum-sized ACCESS_ALLOWED_ACE records.
    let mut acl_storage = [0u32; 42];
    let acl = acl_storage.as_mut_ptr().cast::<ACL>();
    let flags = if inherit {
        OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE
    } else {
        0
    };
    os_check(
        unsafe { InitializeAcl(acl, size_of_val(&acl_storage) as u32, ACL_REVISION) },
        Operation::InitializeAcl,
    )?;
    for sid in [&principals.user, &principals.system] {
        os_check(
            unsafe {
                AddAccessAllowedAceEx(acl, ACL_REVISION, flags, FILE_ALL_ACCESS, sid.pointer())
            },
            Operation::AddAce,
        )?;
    }
    let mut descriptor = SECURITY_DESCRIPTOR::default();
    let descriptor = ptr::from_mut(&mut descriptor).cast::<c_void>();
    os_check(
        unsafe { InitializeSecurityDescriptor(descriptor, SECURITY_DESCRIPTOR_REVISION) },
        Operation::InitializeDescriptor,
    )?;
    os_check(
        unsafe { SetSecurityDescriptorOwner(descriptor, principals.user.pointer(), 0) },
        Operation::SetOwner,
    )?;
    os_check(
        unsafe { SetSecurityDescriptorDacl(descriptor, 1, acl, 0) },
        Operation::SetDacl,
    )?;
    os_check(
        unsafe { SetSecurityDescriptorControl(descriptor, SE_DACL_PROTECTED, SE_DACL_PROTECTED) },
        Operation::SetControl,
    )?;
    operation(&SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor,
        bInheritHandle: 0,
    })
}
