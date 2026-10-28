# Onaylı mobil yürütme listesi — 24 Ekim 2026

Bu sıra kullanıcı tarafından koruma altına alındı. “Sıradaki adıma geç” bu listedeki
sonraki açık adımdır. Bir adımda gereken yeni güvenlik/mimari kararı ayrı göster;
listeyi sessizce yeniden sıraya koyma. Tamamlanan alt dilim tüm platform kabulü
değildir. Her anlamlı dilimde ilgili otomatik kontroller/ayrı review/kayıt güncelle.

| Sıra | İş | Güncel durum |
| --- | --- | --- |
| 1 | Android iş–ayar bağlamı: kaynak/PC/program değişiminde güvenli duruş, yeni işin fırsatını koruma | [Uygulandı ve otomatik/host doğrulandı](android-run-context-2026-10-24.md); Android runtime yarış kabulü4. adımda açık |
| 2 | Android arka plan yürütme: native owner/queue ömrü | [Kaynak/otomatik-host tamam](android-background-owner-2026-10-25.md); gerçek Android service/JNI/kill kabulü4. adımda açık |
| 3 | Android Live, zamanlama ve OS retry; reboot/ağ/izin/bildirim | [Kaynak/otomatik-host ve explicit K1 tam lint doğrulandı](android-lint-and-compatibility-2026-10-25.md); varsayılan K2 araç hatası kayıtlı, OS/runtime kabulü4. adımda |
| 4 | Android silme/rebackup, kesinti/restart ve uyumluluk doğrulamaları | [Emülatör11 grup PASS](android-runtime-step4-2026-10-26.md); [izinli fiziksel yerel5 grup + PID reopen PASS](android-physical-step4-2026-10-26.md); FGS geçti, [Mac Personal Team native/Electron-host NAPI doğrulandı](macos-personal-team-validation-2026-10-26.md); normal Kloda UI/QR/ayrı izin/Android-Mac aktarımı açık; gerçek PC/queue/Photos/LAN/Doze/eskiOS/16KB/performans açık |
| 5 | iOS native eşleştirme: LAN, identity/storage, Expo ve foreground | [ADR0020 ile kaynak/Simulator tamam](ios-native-pairing-step5-2026-10-27.md); gerçek app/modül/journal smoke PASS; iPhone Secure Enclave/QR/PC LAN fiziksel kabul açık, canlı Files sender liste6 |
| 6 | iOS Files: kalıcı kuyruk/transfer/resume/geçmiş/restore | [Kaynak/host/Simulator tamam](ios-files-step6-2026-10-27.md); gerçek app erken-hata/process-restart smoke PASS; gerçek provider/iCloud/iPhone-PC/restore kabulü ve staging alan değerlendirmesi açık, otomatik retry8 ayrı |
| 7 | iOS Photos: metadata/ortak resource/import/restore/suppression | [Kaynak/host/gerçek PhotoKit Simulator dilimi tamam](ios-photos-step7-2026-10-27.md); PNG/H264/PID reopen, strict codec, suppression/rebackup ve own-download/bulk/retry PASS; PC/session fixture. Gerçek iPhone/PC LAN, LivePhoto/RAW/edited/iCloud/alan ve fiziksel kabul10–11 açık |
| 8 | iOS background/zamanlama/retry | [Kaynak/host/Simulator tamam](ios-background-step8-2026-10-28.md); ayrı5/60 erişim +5/300 OS, kalıcı Pause/context, native lease,70 test/lint/TS/build ve Expo process-restart PASS; gerçek iPhone/OS-delivery/lock/PC kabulü10–11 açık |
| 9 | Ortak WebDAV kayıt tutarlılığı/eksik ayar ve hata akışları | [Kaynak/otomatik/izole iOS ayar kontrolleri tamam](mobile-webdav-step9-2026-10-28.md);98 test/lint/TS/export, SecureStore/farklı-PID ve native cookie/redirect PASS. Gerçek HTTPS WebDAV/Android runtime/byte sender açık; yarım probe uyarısının restart kalıcılığı/reconciliation10 değerlendirmesinde |
| 10 | Mobil bütünleşik otomasyon/simulator, görsel ve erişilebilirlik kontrolü | [Kaynak/108 test/izole iOS ve host görsel kapsam doğrulandı](mobile-integrated-step10-2026-10-28.md); typed storage, kalıcı probe warning ve büyük yazı/klavye düzeltildi. Gerçek LAN/pil/alan/reader ve koruma-kopyası eşzamanlı latency kabulü açık; [Android dar UI/reopen followup PASS](mobile-android-step10-followup-2026-10-28.md), gerçek PC/LAN ve tam Android görsel matris açık; SDK config yan etkisi kayıtlı |
| 11 | Toplu fiziksel/uçtan uca kabul | Genel toplu grup ayrı izinle; kullanıcı26Ekim yalnız liste4 Android/Mac fiziksel başlangıcını onayladı, platform kapıları sürer |

Önceki tamamlanan temel: Android foreground kalıcı5/60 retry, mobil PC-first Stitch
ana akışı, iOS C ABI/Swift temel ve native clock; her biri kendi kayıtlı kapsamıyla.
TR/EN/DE ve onaylı Stitch dili korunur; mevcut native authority/journal/ACL/Photos
sözleşmeleri yeniden yazılmaz. iOS zorunluluğu engel nedeniyle listeden düşmez.

Windows D3/Windows platform, macOS normal paket/release signing ve Linux provider/fiziksel kabul ayrı
Desktop kayıtlarında açıktır; burada tekrarlanmaz. Ubuntu LTS/GNOME ve Kubuntu
LTS/KDE gerçek ortam kanıtı olmadan desteklenmiş sayılmaz.

Media E2EE/key lifecycle, hesap/recovery, remote erişim, Files two-way/conflict/
versions, migration ve geniş galeri kapsamı ayrı backlog'dur; bu sıraya onaysız
sokulmaz ve sessizce düşürülmez. Kullanıcı arşivi test verisi değildir. Fiziksel
pause ve Git add/commit/push/reset/clean/stash yasağı sürer; model/effort değişmez.
