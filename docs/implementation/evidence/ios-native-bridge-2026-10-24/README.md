# iOS native ABI temel kanıtı — 24 Ekim 2026

[result.json](result.json) gerçek tool sonuçlarından seçilmiş kapsamlı özet ve
kaynak SHA256 listesidir; yeniden üretilmiş bir raw terminal kaydı değildir.
Binary arşivler ve bütün `.local-evidence` Git'e alınmadı. Bu dosyaların varlığı
başka makinede testin çalıştırıldığı anlamına gelmez.

## Tekrar kaynakları

- [Rust ABI testleri](../../../../packages/pairing-native/src/ios_bridge_tests.rs)
- [Swift decoder](decoder-checks.swift), [ownership](ownership-checks.swift),
  [C stub](ownership-stub.c) + [header](ownership-stub.h)
- [ABI Swift typecheck](abi-typecheck.swift), [C link-only](abi-link.c)
- [Network API availability](network-api-check.swift): compile-only, route kanıtı değil.

Rust doğrulaması repo kökünde; önce tam toolchain yollarını sabitle:

```sh
compiler=$(rustup which --toolchain 1.99.0 rustc)
toolbin=${compiler%/*}
export PATH="$toolbin:$PATH"
export RUSTC="$compiler"
export RUSTC_WORKSPACE_WRAPPER="$toolbin/clippy-driver"
cargo test --manifest-path packages/pairing-native/Cargo.toml --target-dir packages/pairing-native/target/ios-validation-1.99 --locked --offline --no-default-features --features ios-ffi ios_bridge -- --test-threads=1
cargo clippy --manifest-path packages/pairing-native/Cargo.toml --target-dir packages/pairing-native/target/ios-validation-1.99 --locked --offline --no-default-features --features ios-ffi --lib --tests -- -D warnings
cargo clippy --manifest-path packages/pairing-native/Cargo.toml --target-dir packages/pairing-native/target/ios-validation-1.99 --target aarch64-apple-ios-sim --locked --offline --no-default-features --features ios-ffi --lib -- -D warnings
rustfmt --config skip_children=true --check packages/pairing-native/src/ios_bridge.rs packages/pairing-native/src/ios_bridge_command.rs packages/pairing-native/src/ios_bridge_registry.rs packages/pairing-native/src/ios_bridge_tests.rs
```

Swift host testleri `swiftc` ile assert'ler açık (optimizasyonsuz) derlendi.
Decoder kaynağı `apple/IosPairingReply.swift` ile derlenir. Ownership kaynağı
iki production Swift dosyası ve C stub object ile, stub header `-import-objc-header`
ve production header dizini `-I` kullanılarak derlenir. Stub `kloda_ios_reply_free`
uygulamasını taklit eder; Rust native owner çalıştırmaz. Swift iOS simulator
kontrolü `-target arm64-apple-ios16.4-simulator -sdk <simulator SDK> -typecheck`
ve production C header ile yapıldı. SDK sürümü27.1.

Paket üretimi: `node tools/build-native-ios.mjs`. Device ve simulator debug
staticlib, beş export ve XCFramework doğrulanır; signing/app kurulumu/owner yok.
C link harness her iki SDK'ya karşı staticlib + Security/SystemConfiguration
framework'leriyle dylib olarak bağlandı; bu dylib'ler çalıştırılmadı.

Gerçek iOS identity/storage/route/clock provider, Expo foreground/worker bağlantısı,
final-app SQLite provider bağı, Files/Photos/background ve fiziksel kabul açıktır.
[Dar devir](../../ios-native-bridge-2026-10-24.md).
