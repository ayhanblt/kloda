use crate::error::{PairingError, Result};
use std::{
    ffi::c_void,
    ptr,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        LazyLock,
    },
};
use windows_sys::Win32::{
    Foundation::HANDLE, NetworkManagement::IpHelper::*, Networking::WinSock::AF_UNSPEC,
};

// Callbacks touch only process-static state; every Route owns and drains its own
// registrations. Even failed cancellation cannot leave dangling owner references.
static GENERATION: LazyLock<AtomicU64> = LazyLock::new(|| AtomicU64::new(0));
static CLEANUP_FAILED: LazyLock<AtomicBool> = LazyLock::new(|| AtomicBool::new(false));
struct Monitor {
    handles: [usize; 3],
}

impl Monitor {
    fn open() -> Result<Self> {
        cleanup_check()?;
        let mut monitor = Self { handles: [0; 3] };
        let mut handle: HANDLE = ptr::null_mut();
        // No initial callbacks. Observe all interfaces: a winning VPN matters too.
        if unsafe {
            NotifyIpInterfaceChange(
                AF_UNSPEC,
                Some(interface_changed),
                ptr::null(),
                false,
                &mut handle,
            )
        } != 0
        {
            return Err(PairingError::LanUnavailable);
        }
        monitor.handles[0] = handle as usize;
        handle = ptr::null_mut();
        if unsafe {
            NotifyUnicastIpAddressChange(
                AF_UNSPEC,
                Some(address_changed),
                ptr::null(),
                false,
                &mut handle,
            )
        } != 0
        {
            return Err(PairingError::LanUnavailable);
        }
        monitor.handles[1] = handle as usize;
        handle = ptr::null_mut();
        if unsafe {
            NotifyRouteChange2(
                AF_UNSPEC,
                Some(route_changed),
                ptr::null(),
                false,
                &mut handle,
            )
        } != 0
        {
            return Err(PairingError::LanUnavailable);
        }
        monitor.handles[2] = handle as usize;
        Ok(monitor)
    }
}

impl Drop for Monitor {
    fn drop(&mut self) {
        for handle in self.handles {
            if handle != 0 {
                // The owner, never a callback, cancels and drains in-flight calls.
                // Static callback state remains valid even if the OS cannot cancel.
                if unsafe { CancelMibChangeNotify2(handle as HANDLE) } != 0 {
                    CLEANUP_FAILED.store(true, Ordering::Release);
                }
            }
        }
    }
}

pub(super) struct Watch {
    generation: u64,
    invalid: AtomicBool,
    _monitor: Monitor,
}

impl Watch {
    pub(super) fn open() -> Result<Self> {
        let monitor = Monitor::open()?;
        let watch = Self {
            generation: GENERATION.load(Ordering::Acquire),
            invalid: AtomicBool::new(false),
            _monitor: monitor,
        };
        watch.check()?;
        Ok(watch)
    }

    pub(super) fn check(&self) -> Result<()> {
        cleanup_check()?;
        if self.invalid.load(Ordering::Acquire)
            || self.generation == u64::MAX
            || self.generation != GENERATION.load(Ordering::Acquire)
        {
            self.invalidate();
            return Err(PairingError::LanUnavailable);
        }
        Ok(())
    }

    pub(super) fn invalidate(&self) {
        self.invalid.store(true, Ordering::Release);
    }
}

pub(super) fn cleanup_check() -> Result<()> {
    if CLEANUP_FAILED.load(Ordering::Acquire) {
        return Err(PairingError::OutcomeUnknown);
    }
    Ok(())
}

unsafe extern "system" fn interface_changed(
    _: *const c_void,
    _: *const MIB_IPINTERFACE_ROW,
    _: MIB_NOTIFICATION_TYPE,
) {
    changed();
}
unsafe extern "system" fn address_changed(
    _: *const c_void,
    _: *const MIB_UNICASTIPADDRESS_ROW,
    _: MIB_NOTIFICATION_TYPE,
) {
    changed();
}
unsafe extern "system" fn route_changed(
    _: *const c_void,
    _: *const MIB_IPFORWARD_ROW2,
    _: MIB_NOTIFICATION_TYPE,
) {
    changed();
}
fn changed() {
    // Saturation prevents epoch wrap from reviving an invalidated route.
    let mut current = GENERATION.load(Ordering::Acquire);
    loop {
        match GENERATION.compare_exchange_weak(
            current,
            current.saturating_add(1),
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => break,
            Err(value) => current = value,
        }
    }
}
