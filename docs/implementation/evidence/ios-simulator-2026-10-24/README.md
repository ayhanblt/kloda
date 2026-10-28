# iOS simulator kanıtı — 24 Ekim 2026

[Çalışma/exit/hash](runtime-result.json), [review sonrası final](native-final-result.json),
[final çıktı](native-final-runtime.log), [decoder](decoder-checks-runtime.log),
[ownership](ownership-checks-runtime.log), [derleme komutları](build-commands.json).
[Native test kaynağı](../../../../packages/pairing-native/apple/tests/IosPairingSimulatorChecks.swift).

Yeni boş Kloda-IosAbi-20261024: iOS26.5/arm64, SDK27.1, minimum compile target16.4.
Mevcut simülatör verileri kullanılmadı. Üç executable simctl spawn ile gerçek simulator
runtime içinde çalıştı. Native test gerçek Rust staticlib/production Swift ile bağlı;
ownership testi C stub kullanır, gerçek Rust free bağımsız bellek enstrümantasyonu değildir.

İlk native çalışma ve ayrı süreç tekrar exit0. Review sonrası oversized tampon
okunabilir boyuta düzeltildi; son native build/run exit0, binary SHA ayrı kayıtta.
Süreç tekrarları kalıcı owner/journal/UI restart kabulü değildir; owner oluşturulmadı.
Mevcut unsupported kapısı random temp hedef oluşmadan reddeder. Key/DB/ağ açılmaz.

Yeniden üretim: build-commands içindeki SDK yolunu yerel SDK ile çöz; native executable,
aynı önceki decoder fixture ve ownership C stub kaynaklarıyla derlenir. Sonra
`xcrun simctl spawn <dedicated-device> <absolute-executable-path>` kullanılır.
Executable ve staticlib binary'leri Git kanıtına alınmadı; SHA'lar kayıtlıdır.

NOT_RUN: QR/TLS/grant/transfer, gerçek provider/Secure Enclave, Expo uygulama/UI,
Photos/background, fiziksel kabul ve eski16.4 runtime. Yalnız runtime26.5 mevcuttu.
İlk sandbox simctl/Swift cache reddi onaylı dış çalıştırmayla aşıldı; hata PASS değildir.
Xcode ilk komutta Install Started/Succeeded ve stale CoreSimulator service version
mesajı verdi; bu araç/service etkisi kayıtlıdır, ürün kaynak düzeltmesi sayılmaz.
Test sonunda yalnız yeni simulator shutdown yapılır, erase/delete yok.
