use crate::error::{PairingError, Result};

pub(crate) fn unix_seconds() -> Result<u64> {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| PairingError::IdentityUnavailable)?
        .as_secs();
    if seconds == 0 {
        return Err(PairingError::IdentityUnavailable);
    }
    Ok(seconds)
}

#[cfg(target_os = "macos")]
pub(crate) fn elapsed_ms() -> Result<u64> {
    #[repr(C)]
    struct Timebase {
        numer: u32,
        denom: u32,
    }
    unsafe extern "C" {
        fn mach_continuous_time() -> u64;
        fn mach_timebase_info(info: *mut Timebase) -> libc::c_int;
    }
    // SDK mach/mach_time.h: mach_continuous_time advances during sleep (macOS 10.12+).
    static TIMEBASE: std::sync::LazyLock<Option<(u32, u32)>> = std::sync::LazyLock::new(|| {
        let mut info = Timebase { numer: 0, denom: 0 };
        if unsafe { mach_timebase_info(&mut info) } != 0 || info.numer == 0 || info.denom == 0 {
            None
        } else {
            Some((info.numer, info.denom))
        }
    });
    let &(numer, denom) = TIMEBASE.as_ref().ok_or(PairingError::LanUnavailable)?;
    let ticks = unsafe { mach_continuous_time() };
    u64::try_from(u128::from(ticks) * u128::from(numer) / u128::from(denom) / 1_000_000)
        .map_err(|_| PairingError::LanUnavailable)
}

#[cfg(any(target_os = "android", target_os = "linux"))]
pub(crate) fn elapsed_ms() -> Result<u64> {
    // Linux/Android CLOCK_BOOTTIME includes suspend; never substitute CLOCK_MONOTONIC.
    let mut time = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    if unsafe { libc::clock_gettime(libc::CLOCK_BOOTTIME, &mut time) } != 0
        || time.tv_sec < 0
        || !(0..1_000_000_000).contains(&time.tv_nsec)
    {
        return Err(PairingError::LanUnavailable);
    }
    (time.tv_sec as u64)
        .checked_mul(1_000)
        .and_then(|ms| ms.checked_add(time.tv_nsec as u64 / 1_000_000))
        .ok_or(PairingError::LanUnavailable)
}

#[cfg(target_os = "windows")]
pub(crate) fn elapsed_ms() -> Result<u64> {
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetTickCount64() -> u64;
    }
    // Microsoft sysinfo/interrupt-time: includes sleep/hibernation, independent of wall time.
    Ok(unsafe { GetTickCount64() })
}

#[cfg(not(any(
    target_os = "macos",
    target_os = "android",
    target_os = "linux",
    target_os = "windows"
)))]
pub(crate) fn elapsed_ms() -> Result<u64> {
    Err(PairingError::NativeUnsupported)
}
