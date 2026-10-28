use crate::error::{PairingError, Result};
use std::{ffi::c_void, ptr::NonNull};

unsafe extern "C" {
    fn kloda_ios_route_open() -> *mut c_void;
    fn kloda_ios_route_valid(witness: *mut c_void) -> i32;
    fn kloda_ios_route_interface_class(witness: *mut c_void, name: *const u8, index: u32) -> i32;
    fn kloda_ios_route_select(witness: *mut c_void, name: *const u8, index: u32) -> i32;
    fn kloda_ios_route_close(witness: *mut c_void);
}

pub(super) struct Witness(NonNull<c_void>);
// The ARC owner is opaque; every mutable observation is synchronized in the native shim.
unsafe impl Send for Witness {}
unsafe impl Sync for Witness {}

impl Witness {
    pub(super) fn open() -> Result<Self> {
        NonNull::new(unsafe { kloda_ios_route_open() })
            .map(Self)
            .ok_or(PairingError::LanUnavailable)
    }

    pub(super) fn check(&self) -> Result<()> {
        if unsafe { kloda_ios_route_valid(self.0.as_ptr()) } == 1 {
            Ok(())
        } else {
            Err(PairingError::LanUnavailable)
        }
    }

    pub(super) fn select(&self, name: &[u8; 16], index: u32) -> Result<()> {
        if unsafe { kloda_ios_route_select(self.0.as_ptr(), name.as_ptr(), index) } == 1 {
            Ok(())
        } else {
            Err(PairingError::LanUnavailable)
        }
    }

    pub(super) fn class(&self, name: &[u8; 16], index: u32) -> Option<u8> {
        match unsafe { kloda_ios_route_interface_class(self.0.as_ptr(), name.as_ptr(), index) } {
            1 => Some(1),
            2 => Some(2),
            _ => None,
        }
    }
}

impl Drop for Witness {
    fn drop(&mut self) {
        unsafe { kloda_ios_route_close(self.0.as_ptr()) };
    }
}
