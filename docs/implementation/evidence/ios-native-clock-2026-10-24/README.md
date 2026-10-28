# iOS native saat kanıtı — 24 Ekim 2026

[Sonuç/komut kapsamı/hash](result.json), [exact liste0](list-0.log), [liste1](list-1.log),
[gerçek simulator test0](test-0.log), [test1](test-1.log), [ABI7 regresyon](abi-regression.log).

Rust1.99 locked/offline test ikilisi `--target aarch64-apple-ios-sim --lib --no-run`
ile üretildi. iOS26.5 arm64 izole Kloda simulator üzerinde simctl spawn ile her
clock testi `--exact --list` sonra `--exact --nocapture --test-threads=1` çalıştı.
Aynı ikilide yalnız `ios_bridge::tests --test-threads=1` regresyonları çalıştı.
Tüm library testleri topluca çalıştırılmadı; diğer fiziksel/fixture testler açılmadı.

Host clock2, host+sim lib/test clippy -D warnings, arm64 iOS device cargo check,
Rustfmt ve dosya boyutu exit0. Yeni paket/dependency/ABI eklenmedi. Rust source
hash ve test executable hash saklandı; büyük binary veya bütün local-evidence yok.
Clock testleri yalnız thread beklemesi ve eşzamanlı çağrı monotonluğudur;
physical sleep/boot/clock rollback veya programlı retry kabulü değildir.
