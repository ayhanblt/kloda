fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        build_ios_route();
    }
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,common-page-size=16384");
    }
    #[cfg(feature = "desktop-node")]
    napi_build::setup();
}

fn build_ios_route() {
    use std::{env, path::PathBuf, process::Command};
    fn run(command: &mut Command) {
        let status = command
            .status()
            .expect("could not launch Apple SDK compiler");
        assert!(status.success(), "iOS route witness SDK build failed");
    }
    let target = env::var("TARGET").expect("TARGET");
    assert!(
        matches!(
            target.as_str(),
            "aarch64-apple-ios" | "aarch64-apple-ios-sim" | "x86_64-apple-ios"
        ),
        "unsupported iOS route witness target"
    );
    let simulator = target.ends_with("-sim") || target.starts_with("x86_64-");
    let sdk = if simulator {
        "iphonesimulator"
    } else {
        "iphoneos"
    };
    let sdk_path = Command::new("xcrun")
        .args(["--sdk", sdk, "--show-sdk-path"])
        .output()
        .expect("could not resolve iOS SDK");
    assert!(sdk_path.status.success(), "iOS SDK unavailable");
    let sdk_path = String::from_utf8(sdk_path.stdout).expect("iOS SDK path UTF-8");
    let arch = if target.starts_with("aarch64-") {
        "arm64"
    } else {
        "x86_64"
    };
    let clang_target = format!(
        "{arch}-apple-ios16.4{}",
        if simulator { "-simulator" } else { "" }
    );
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR"));
    let object = output.join("IosRouteWitness.o");
    let archive = output.join("libkloda_ios_route.a");
    run(Command::new("xcrun")
        .args([
            "--sdk",
            sdk,
            "clang",
            "-target",
            &clang_target,
            "-isysroot",
            sdk_path.trim(),
            "-fobjc-arc",
            "-fblocks",
            "-Wall",
            "-Wextra",
            "-Werror",
            "-c",
            "apple/IosRouteWitness.m",
            "-o",
        ])
        .arg(&object));
    run(Command::new("xcrun")
        .args(["libtool", "-static", "-o"])
        .arg(&archive)
        .arg(&object));
    println!("cargo:rerun-if-changed=apple/IosRouteWitness.m");
    println!("cargo:rerun-if-env-changed=DEVELOPER_DIR");
    println!("cargo:rustc-link-search=native={}", output.display());
    println!("cargo:rustc-link-lib=static=kloda_ios_route");
    println!("cargo:rustc-link-lib=framework=Network");
    println!("cargo:rustc-link-lib=framework=Foundation");
}
