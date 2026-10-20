use super::principal::{principals, same};
use crate::error::{PairingError, Result};
use crate::startup_diagnostics::{self as diagnostic, Operation};
use std::{ffi::c_void, ptr::null_mut};
use windows_sys::Win32::{
    Foundation::{GetLastError, LocalFree, GENERIC_ALL, GENERIC_WRITE, HANDLE},
    Security::{
        Authorization::{GetSecurityInfo, SE_FILE_OBJECT},
        *,
    },
    Storage::FileSystem::{
        DELETE, FILE_ALL_ACCESS, FILE_DELETE_CHILD, FILE_WRITE_ATTRIBUTES, FILE_WRITE_EA,
        WRITE_DAC, WRITE_OWNER,
    },
    System::SystemServices::ACCESS_ALLOWED_ACE_TYPE,
};

pub(super) fn check(value: i32) -> Result<()> {
    if value == 0 {
        diagnostic::record(
            Some(Operation::SecurityValidation),
            PairingError::StorageFailure,
            None,
        );
        Err(PairingError::StorageFailure)
    } else {
        Ok(())
    }
}

pub(super) fn os_check(value: i32, operation: Operation) -> Result<()> {
    if value == 0 {
        let code = unsafe { GetLastError() };
        diagnostic::record(Some(operation), PairingError::StorageFailure, Some(code));
        Err(PairingError::StorageFailure)
    } else {
        Ok(())
    }
}

struct Descriptor(*mut c_void);
impl Drop for Descriptor {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0);
        }
    }
}
struct Security {
    _descriptor: Descriptor,
    owner: PSID,
    acl: *mut ACL,
    control: u16,
}
fn security(handle: HANDLE) -> Result<Security> {
    let mut descriptor = null_mut();
    let mut owner = null_mut();
    let mut acl = null_mut();
    let status = unsafe {
        GetSecurityInfo(
            handle,
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            null_mut(),
            &mut acl,
            null_mut(),
            &mut descriptor,
        )
    };
    let descriptor = Descriptor(descriptor);
    if status != 0 {
        diagnostic::record(
            Some(Operation::SecurityInfo),
            PairingError::StorageFailure,
            Some(status),
        );
    }
    if status != 0 || descriptor.0.is_null() || owner.is_null() || acl.is_null() {
        return Err(PairingError::StorageFailure);
    }
    check(unsafe { IsValidSid(owner) })?;
    check(unsafe { IsValidAcl(acl) })?;
    let mut control = 0;
    let mut revision = 0;
    os_check(
        unsafe { GetSecurityDescriptorControl(descriptor.0, &mut control, &mut revision) },
        Operation::GetControl,
    )?;
    Ok(Security {
        _descriptor: descriptor,
        owner,
        acl,
        control,
    })
}

fn ace(acl: *mut ACL, index: u32) -> Result<(*const ACCESS_ALLOWED_ACE, PSID)> {
    let mut pointer = null_mut();
    os_check(
        unsafe { GetAce(acl, index, &mut pointer) },
        Operation::GetAce,
    )?;
    let header = unsafe { &*pointer.cast::<ACE_HEADER>() };
    let sid_offset = std::mem::offset_of!(ACCESS_ALLOWED_ACE, SidStart);
    if header.AceType as u32 != ACCESS_ALLOWED_ACE_TYPE
        || (header.AceSize as usize) < sid_offset + 8
    {
        return Err(PairingError::StorageFailure);
    }
    let sid = unsafe { pointer.cast::<u8>().add(sid_offset).cast::<c_void>() };
    // Bound the variable-length SID before IsValidSid/GetLengthSid may read it.
    let count = unsafe { *sid.cast::<u8>().add(1) } as usize;
    if sid_offset + 8 + count * 4 > header.AceSize as usize {
        return Err(PairingError::StorageFailure);
    }
    check(unsafe { IsValidSid(sid) })?;
    Ok((pointer.cast(), sid))
}

pub(super) fn protected(handle: HANDLE, directory: bool, inherited_sqlite: bool) -> Result<()> {
    let result = protected_inner(handle, directory, inherited_sqlite);
    if let Err(error) = result {
        diagnostic::record(Some(Operation::SecurityValidation), error, None);
    }
    result
}
fn protected_inner(handle: HANDLE, directory: bool, inherited_sqlite: bool) -> Result<()> {
    let principals = principals()?;
    let security = security(handle)?;
    if !same(security.owner, &principals.user)
        || (!inherited_sqlite && security.control & SE_DACL_PROTECTED == 0)
    {
        return Err(PairingError::StorageFailure);
    }
    if unsafe { (*security.acl).AceCount } != 2 {
        return Err(PairingError::StorageFailure);
    }
    let mut seen = [false; 2];
    for index in 0..2 {
        let (ace, sid) = ace(security.acl, index)?;
        let ace = unsafe { &*ace };
        let flags = if directory {
            (OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE) as u8
        } else if inherited_sqlite && security.control & SE_DACL_PROTECTED == 0 {
            INHERITED_ACE as u8
        } else {
            0
        };
        if ace.Mask != FILE_ALL_ACCESS || ace.Header.AceFlags != flags {
            return Err(PairingError::StorageFailure);
        }
        let slot = if same(sid, &principals.user) {
            0
        } else if same(sid, &principals.system) {
            1
        } else {
            return Err(PairingError::StorageFailure);
        };
        if seen[slot] {
            return Err(PairingError::StorageFailure);
        }
        seen[slot] = true;
    }
    Ok(())
}

pub(super) fn user_directory(handle: HANDLE) -> Result<()> {
    let result = user_directory_inner(handle);
    if let Err(error) = result {
        diagnostic::record(Some(Operation::SecurityValidation), error, None);
    }
    result
}
fn user_directory_inner(handle: HANDLE) -> Result<()> {
    let principals = principals()?;
    let security = security(handle)?;
    if !same(security.owner, &principals.user) {
        return Err(PairingError::StorageFailure);
    }
    let mutation = DELETE
        | FILE_DELETE_CHILD
        | WRITE_DAC
        | WRITE_OWNER
        | FILE_WRITE_ATTRIBUTES
        | FILE_WRITE_EA
        | GENERIC_ALL
        | GENERIC_WRITE;
    for index in 0..unsafe { (*security.acl).AceCount } as u32 {
        let (ace, sid) = ace(security.acl, index)?;
        let ace = unsafe { &*ace };
        if ace.Header.AceFlags as u32 & INHERIT_ONLY_ACE == 0
            && ace.Mask & mutation != 0
            && !same(sid, &principals.user)
            && !same(sid, &principals.system)
            && !same(sid, &principals.administrators)
        {
            return Err(PairingError::StorageFailure);
        }
    }
    Ok(())
}
