# iOS LAN tasarım kanıtı — 24 Ekim 2026

[SDK test kaynağı](parameter-checks.c), [derleme komutu](build-command.json),
[derleme çıktısı](build.log), [simulator çıktısı](runtime.log), [exit/süre/hash](result.json).

İzole iOS26.5/arm64 simulator, SDK27.1, minimum compile target16.4.
Clang -Wall -Wextra -Werror exit0; simulator executable exit0.
İki parametre round-trip kontrol grubu; hiçbir endpoint, NWConnection, NWListener,
NWPathMonitor veya socket oluşturulmaz. Rust owner/identity/storage açılmaz.

**PASS kapsamı yalnız ayar nesnesi oluşturma/okumadır.** Wi-Fi bağlantısı, gateway
reddi, proxy reddi, değişim yarışları veya physical/platform support kanıtı değildir.
Ağ trafiği/aktif aktarım/QR testi yok. Production sender kodu değiştirilmedi.
Büyük executable ve bütün local-evidence alınmadı; kaynak ve binary SHA kayıtlıdır.

Resmî API/SDK sözleşmelerinin karşılaştırması ve açık kapılar:
[dar tasarım sonucu](../../ios-lan-transport-design-2026-10-24.md).
