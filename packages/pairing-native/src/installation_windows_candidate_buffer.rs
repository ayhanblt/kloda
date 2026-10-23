use crate::error::{PairingError, Result};
use crate::windows_publication_name::{buffer_size, Target};
use std::{
    alloc::{alloc_zeroed, dealloc, Layout},
    mem::{align_of, offset_of, size_of},
    ptr::NonNull,
};
use windows_sys::Wdk::Storage::FileSystem::FILE_RENAME_INFORMATION;

pub(super) struct RenameBuffer {
    pointer: NonNull<u8>,
    layout: Layout,
}
impl RenameBuffer {
    pub(super) fn new(target: Target) -> Result<Self> {
        let units: Vec<u16> = target.name().encode_utf16().collect();
        let offset = offset_of!(FILE_RENAME_INFORMATION, FileName);
        let size = buffer_size(
            size_of::<FILE_RENAME_INFORMATION>(),
            offset,
            align_of::<FILE_RENAME_INFORMATION>(),
            units.len(),
        )?;
        let layout = Layout::from_size_align(size, align_of::<FILE_RENAME_INFORMATION>())
            .map_err(|_| PairingError::StorageFailure)?;
        // Size, alignment and trailing UTF-16 capacity were checked against the SDK type.
        let pointer =
            NonNull::new(unsafe { alloc_zeroed(layout) }).ok_or(PairingError::StorageFailure)?;
        let buffer = Self { pointer, layout };
        unsafe {
            let info = &mut *buffer.pointer.as_ptr().cast::<FILE_RENAME_INFORMATION>();
            info.Anonymous.ReplaceIfExists = false;
            info.RootDirectory = std::ptr::null_mut();
            info.FileNameLength =
                u32::try_from(units.len() * 2).map_err(|_| PairingError::StorageFailure)?;
            std::ptr::copy_nonoverlapping(
                units.as_ptr(),
                buffer.pointer.as_ptr().add(offset).cast::<u16>(),
                units.len(),
            );
        }
        Ok(buffer)
    }
    pub(super) fn pointer(&self) -> *const core::ffi::c_void {
        self.pointer.as_ptr().cast()
    }
    pub(super) fn length(&self) -> u32 {
        // buffer_size rejects capacities exceeding ULONG before allocation.
        self.layout.size() as u32
    }
}
impl Drop for RenameBuffer {
    fn drop(&mut self) {
        unsafe {
            dealloc(self.pointer.as_ptr(), self.layout);
        }
    }
}

#[test]
fn sdk_buffer_contains_only_checked_same_directory_no_replace_request() {
    for name in ["epoch", "initialized", "listener-port", "certificate.der"] {
        let target = Target::from_name(name).unwrap();
        let buffer = RenameBuffer::new(target).unwrap();
        assert_eq!(
            buffer.pointer() as usize % align_of::<FILE_RENAME_INFORMATION>(),
            0
        );
        let info = unsafe { &*buffer.pointer().cast::<FILE_RENAME_INFORMATION>() };
        assert!(!unsafe { info.Anonymous.ReplaceIfExists });
        assert!(info.RootDirectory.is_null());
        let length = info.FileNameLength as usize / 2;
        let units = unsafe {
            std::slice::from_raw_parts(
                buffer
                    .pointer()
                    .cast::<u8>()
                    .add(offset_of!(FILE_RENAME_INFORMATION, FileName))
                    .cast::<u16>(),
                length,
            )
        };
        assert_eq!(String::from_utf16(units).unwrap(), target.name());
        assert!(buffer.length() as usize >= size_of::<FILE_RENAME_INFORMATION>() + length * 2);
    }
}
