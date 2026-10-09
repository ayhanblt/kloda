fn main() {
    #[cfg(feature = "desktop-node")]
    napi_build::setup();
}
