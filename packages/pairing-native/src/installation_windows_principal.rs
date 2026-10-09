use super::security::check;
use crate::error::{PairingError, Result};
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
        check(unsafe {
            CreateWellKnownSid(kind, null_mut(), sid.0.as_mut_ptr().cast(), &mut size)
        })?;
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
    check(unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) })?;
    // File owns the token HANDLE too; CloseHandle is the required token destructor.
    let token = unsafe { File::from_raw_handle(token) };
    let mut buffer = [0usize; 32];
    let mut length = 0;
    check(unsafe {
        GetTokenInformation(
            token.as_raw_handle(),
            TokenUser,
            buffer.as_mut_ptr().cast(),
            size_of_val(&buffer) as u32,
            &mut length,
        )
    })?;
    if length < size_of::<TOKEN_USER>() as u32 || length > size_of_val(&buffer) as u32 {
        return Err(PairingError::StorageFailure);
    }
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut sid = Sid([0; SECURITY_MAX_SID_SIZE as usize / 4]);
    check(unsafe {
        CopySid(
            SECURITY_MAX_SID_SIZE,
            sid.0.as_mut_ptr().cast(),
            user.User.Sid,
        )
    })?;
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
    check(unsafe { InitializeAcl(acl, size_of_val(&acl_storage) as u32, ACL_REVISION) })?;
    for sid in [&principals.user, &principals.system] {
        check(unsafe {
            AddAccessAllowedAceEx(acl, ACL_REVISION, flags, FILE_ALL_ACCESS, sid.pointer())
        })?;
    }
    let mut descriptor = SECURITY_DESCRIPTOR::default();
    let descriptor = ptr::from_mut(&mut descriptor).cast::<c_void>();
    check(unsafe { InitializeSecurityDescriptor(descriptor, SECURITY_DESCRIPTOR_REVISION) })?;
    check(unsafe { SetSecurityDescriptorOwner(descriptor, principals.user.pointer(), 0) })?;
    check(unsafe { SetSecurityDescriptorDacl(descriptor, 1, acl, 0) })?;
    check(unsafe {
        SetSecurityDescriptorControl(descriptor, SE_DACL_PROTECTED, SE_DACL_PROTECTED)
    })?;
    operation(&SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor,
        bInheritHandle: 0,
    })
}
