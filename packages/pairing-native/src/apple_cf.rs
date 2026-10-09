use crate::error::{PairingError, Result};
use std::{ffi::c_void, ptr};
pub(crate) type Ref = *const c_void;
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    pub(crate) fn CFRelease(value: Ref);
    pub(crate) fn CFErrorGetCode(error: Ref) -> isize;
    pub(crate) fn CFEqual(a: Ref, b: Ref) -> u8;
    pub(crate) fn CFGetTypeID(value: Ref) -> usize;
    pub(crate) fn CFDataGetTypeID() -> usize;
    pub(crate) fn CFNumberGetTypeID() -> usize;
    pub(crate) fn CFDictionaryGetTypeID() -> usize;
    pub(crate) fn CFDataCreate(allocator: Ref, bytes: *const u8, length: isize) -> Ref;
    pub(crate) fn CFDataGetLength(data: Ref) -> isize;
    pub(crate) fn CFDataGetBytePtr(data: Ref) -> *const u8;
    pub(crate) fn CFNumberCreate(allocator: Ref, kind: i32, value: *const c_void) -> Ref;
    pub(crate) fn CFNumberGetValue(number: Ref, kind: i32, value: *mut c_void) -> u8;
    pub(crate) fn CFDictionaryCreate(
        allocator: Ref,
        keys: *const Ref,
        values: *const Ref,
        count: isize,
        key_callbacks: *const c_void,
        value_callbacks: *const c_void,
    ) -> Ref;
    pub(crate) fn CFDictionaryGetValue(dictionary: Ref, key: Ref) -> Ref;
    pub(crate) static kCFTypeDictionaryKeyCallBacks: [usize; 6];
    pub(crate) static kCFTypeDictionaryValueCallBacks: [usize; 5];
    pub(crate) static kCFBooleanTrue: Ref;
    pub(crate) static kCFBooleanFalse: Ref;
    pub(crate) fn CFURLCreateFromFileSystemRepresentation(
        allocator: Ref,
        bytes: *const u8,
        len: isize,
        directory: u8,
    ) -> Ref;
    pub(crate) fn CFURLSetResourcePropertyForKey(
        url: Ref,
        key: Ref,
        value: Ref,
        error: *mut Ref,
    ) -> u8;
    pub(crate) fn CFURLCopyResourcePropertyForKey(
        url: Ref,
        key: Ref,
        value: *mut Ref,
        error: *mut Ref,
    ) -> u8;
    pub(crate) fn CFURLClearResourcePropertyCacheForKey(url: Ref, key: Ref);
    pub(crate) static kCFURLIsExcludedFromBackupKey: Ref;
}
pub(crate) struct Owned(pub(crate) Ref);
impl Owned {
    pub(crate) unsafe fn take(value: Ref) -> Result<Self> {
        if value.is_null() {
            Err(PairingError::IdentityUnavailable)
        } else {
            Ok(Self(value))
        }
    }
    pub(crate) fn data(bytes: &[u8]) -> Result<Self> {
        unsafe {
            Self::take(CFDataCreate(
                ptr::null(),
                bytes.as_ptr(),
                bytes.len() as isize,
            ))
        }
    }
    pub(crate) fn number(value: i32) -> Result<Self> {
        unsafe {
            Self::take(CFNumberCreate(
                ptr::null(),
                3,
                &value as *const i32 as *const c_void,
            ))
        }
    }
    pub(crate) fn dictionary(entries: &[(Ref, Ref)]) -> Result<Self> {
        if entries.len() > 16 {
            return Err(PairingError::IdentityUnavailable);
        }
        let mut keys = [ptr::null(); 16];
        let mut values = [ptr::null(); 16];
        for (index, (key, value)) in entries.iter().enumerate() {
            keys[index] = *key;
            values[index] = *value;
        }
        unsafe {
            Self::take(CFDictionaryCreate(
                ptr::null(),
                keys.as_ptr(),
                values.as_ptr(),
                entries.len() as isize,
                ptr::addr_of!(kCFTypeDictionaryKeyCallBacks).cast(),
                ptr::addr_of!(kCFTypeDictionaryValueCallBacks).cast(),
            ))
        }
    }
    pub(crate) fn bytes(&self, maximum: usize) -> Result<Vec<u8>> {
        unsafe {
            if CFGetTypeID(self.0) != CFDataGetTypeID() {
                return Err(PairingError::IdentityUnavailable);
            }
            let length = CFDataGetLength(self.0);
            if length <= 0 || length as usize > maximum {
                return Err(PairingError::IdentityUnavailable);
            }
            Ok(std::slice::from_raw_parts(CFDataGetBytePtr(self.0), length as usize).to_vec())
        }
    }
}
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe { CFRelease(self.0) }
    }
}

pub(crate) fn exclude_directory_from_backup(path: &std::path::Path) -> Result<()> {
    use std::os::unix::ffi::OsStrExt;
    let bytes = path.as_os_str().as_bytes();
    unsafe {
        let url = Owned::take(CFURLCreateFromFileSystemRepresentation(
            ptr::null(),
            bytes.as_ptr(),
            bytes.len() as isize,
            1,
        ))?;
        let mut error = ptr::null();
        let success = CFURLSetResourcePropertyForKey(
            url.0,
            kCFURLIsExcludedFromBackupKey,
            kCFBooleanTrue,
            &mut error,
        );
        if !error.is_null() {
            CFRelease(error);
        }
        if success == 0 {
            return Err(PairingError::StorageFailure);
        }
        CFURLClearResourcePropertyCacheForKey(url.0, kCFURLIsExcludedFromBackupKey);
        let mut value = ptr::null();
        error = ptr::null();
        let success = CFURLCopyResourcePropertyForKey(
            url.0,
            kCFURLIsExcludedFromBackupKey,
            &mut value,
            &mut error,
        );
        if !error.is_null() {
            CFRelease(error);
        }
        let value = Owned::take(value).map_err(|_| PairingError::StorageFailure)?;
        if success == 0 || CFEqual(value.0, kCFBooleanTrue) == 0 {
            return Err(PairingError::StorageFailure);
        }
        Ok(())
    }
}
