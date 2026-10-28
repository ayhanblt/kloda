# Kloda yürütme listesi — 24 Ekim başlangıcı / 28 Ekim genişletmesi

2026-10-28 **Liste12 UI kaynağı/otomatik/izole kapsam:** [Lovable ortak kabuk ve akış raporu](lovable-ui-step12-2026-10-28.md). Mobil123test/14suite, lint/TS/iOS+Android export; Desktop322tam test+sonra13hedefli, lint/TS/build ve42font-loaded renderer capture geçti. iOS production-page fixture + büyük yazı/font-change takipleri var; Android native görsel ADB unauthorized nedeniyle **açık/NOT_RUN**. Kurulumu atla oturumluk ve yetki yazmaz;16sağlayıcı kataloğu var, uygulanmamış adapterler kapalı. Galeri13, provider/auth14+, LiveActivities19, bütünleşik20 ve fiziksel21 ayrı. Eski başarı/örnek QR/grant gerçek duruma çevrilmedi. Fiziksel/platform kapıları, launcher/native OS görsel/a11y ve Android doğrulama açığı kapanmadı. Git/authority mutation yok.



**Son güncelleme:** Lovable tasarımı onaylandı ve MCP erişimi doğrulandı; [bağlayıcı kaynak ve revizyon](../ui/lovable-design-reference.md). iOS Live Activities18’den sonra19’a eklendi; bütünleşik20, final kabul21.

**Güncel sıra:** Kullanıcının28Ekim onayıyla [genişletilmiş plan](expanded-execution-plan-2026-10-28.md) geçerlidir.1–10 korunur; eski11 fiziksel kabul artık21’dir.11–20 tasarım/ana sayfa/bağlantı/sağlayıcı ve bütünleşik hazırlık işleri eklendi. İlk genişletme plan-only idi; güncel11/12 yürütme kanıtı üsttedir. Sağlayıcı kararı veya fiziksel kabul izni sayılmaz.

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
|11|Lovable tasarım alımı ve eşleme — TAMAM|[151dosya/7JPEG/42kapsam/6capture ve native eşleme](lovable-design-intake-step11-2026-10-28.md) doğrulandı; revizyon cb1143d16f73. Eski Stitch arşivlenip kaldırıldı.12 ekran uyarlaması henüz başlamadı.|
|12|Ortak uygulama kabuğu ve ana akışların uyarlanması|Mobil ana gezinme, ana sayfa, kurulum atla, kaynak/program, PC/QR, Activity/restore, bağlantılar ve ayarlar; Desktop alıcı/devices/incoming/backups/trash/settings ve giden hedefler. Mevcut native bileşenleri bağla; önce tasarım shell/prototype ile canlı özelliği ayır. Her rota geri dönüşlü ve erişilebilir olsun.|
|13|Galeri ve fotoğraf detayının gerçek kaynaklara bağlanması|İzinli seçilmiş kaynaklarla liste/boş/limited-permission/detay/yedek durumunu eşle. Sahte medya veya başarıyı gerçek diye sunma. Mevcut metadata/Photos API’lerini kullan; geniş thumbnail cache/arama/EXIF/yeni yerel silme politikası gerektiriyorsa somut karar kapısı aç.|
|14|Protokol ve bulut teknik uygunluk/karar matrisi|Her P/C için resmî API/SDK, lisans, platform, auth/credential custody, upload/list/restore, kesinti/idempotency, limit/maliyet ve hesap gereksinimini kaynakla doğrula. Aşağıdaki güvenlik kararlarını ve gerekli ADR’leri yaz; yeni global kuyruk/SDK seçimini varsayma. **İncelenmedi; çalışma onayı kararların yerine geçmez.**|
|15|Mevcut WebDAV’ın eksik mobil gönderimini tamamlama|Mevcut tek profil/test-warning ve kalıcı iş/ayar/retry yapılarını kullan; mobil gerçek byte upload/status/sonuç/restore kapsamını belirleyip bağla. Desktop’ın tamamlanmış göndericisini yeniden yazma. İzole sunucuda kayıp yanıt, kesinti, context değişimi, çakışma ve güvenli yeniden deneme kanıtı.|
|16|SMB, SFTP ve FTP bağlantı/aktarımı|16a SMB LAN-only;16b SFTP host identity doğrulamalı;16c FTP ancak onaylanmış güvenli profil varsa. Her biri ayrı dar dilim: form+gerçek adapter+job/context/error/restore sözleşmesi+izole otomatik kanıt. Karar verilmeyen seçenek görünür fakat çalışır gösterilmez.|
|17|S3 uyumlu ve Amazon S3|P5 ile C1 ayrı ekran/konfigürasyon; uygunsa aynı doğrulanmış adapter kullan. Endpoint/region/bucket/prefix ve credential bağlamı; multipart/abort/retry/belirsiz commit ve integrity kanıtını mevcut iş kimliğiyle ele al. Ortak içerik veya ETag tek başına tamamlanma/suppression kanıtı sayılmaz.|
|18|Diğer bulut sağlayıcıları|C2–C11 aşağıdaki ayrı checklist ile tek tek kapatılır. Ortak protokol/API gerçekten eşdeğerse adapter tekrar kullan; sağlayıcı auth/limit/davranışını eşdeğer varsayma. Her sağlayıcıda gerçek adapter ve güvenli credential/iş bağlamı, UI durumları, izole fixture/sandbox kanıtı gerekir. Hesap/maliyet/erişim engeli görünür kalır.|
|19|iOS Live Activities — kilit ekranı|Onaylı Lovable lock-screen tasarımını gerçek native iş/ACK durumuna bağlama; ActivityKit/WidgetKit extension, signing/OS uygunluğu, mahremiyet ve lifecycle/action sınırları önce doğrulanır. Stale/paused/wait/error/completed ayrılır; native SwiftUI/Tailwind uyumsuzluğu ve varsa yeni yetki/push kararı kullanıcıya sunulur. Background çalışma garantisi veya yeni upload yetkisi değildir.|
|20|Genişletilmiş bütünleşik kapanış ve platform hazırlığı|Yeni akışların otomatik/regresyon, Simulator/emülatör, görsel/a11y ve ayrı güvenlik review’u; gerçek normal macOS uygulamasının imza/alıcı kapısı, WindowsD3 ve Linux provider durumunu güncel kanıtla değerlendir. Koruma kopyasıyla eşzamanlı receiver latency, staging/alan ve retry maliyetini izole ölç. Açık SDK config olayını ve eski scope locator sınırını koru.|
|21|Toplu fiziksel/uçtan uca kabul — en son|Açık kullanıcı yürütme izni, hazır platform/sağlayıcı hesabı ve disposable verilerle gerçek Android/iPhone↔PC ve onaylanmış dış hedefler. Kaynak/izin/aktarım/restart/background/revoke/remove/trash/restore/suppression/performans/erişilebilirlik. Engelli platform veya sağlayıcıyı sessizce çıkarma; kapsam/karar ve NOT_RUN kaydıyla raporla.|

Önceki tamamlanan temel: Android foreground kalıcı5/60 retry, mobil PC-first Stitch
ana akışı, iOS C ABI/Swift temel ve native clock; her biri kendi kayıtlı kapsamıyla.
TR/EN/DE ve onaylı Stitch dili korunur; mevcut native authority/journal/ACL/Photos
sözleşmeleri yeniden yazılmaz. iOS zorunluluğu engel nedeniyle listeden düşmez.

Windows D3/Windows platform, macOS normal paket/release signing ve Linux provider/fiziksel kabul ayrı
Desktop kayıtlarında açıktır; burada tekrarlanmaz. Ubuntu LTS/GNOME ve Kubuntu
LTS/KDE gerçek ortam kanıtı olmadan desteklenmiş sayılmaz.

Media E2EE/key lifecycle, hesap/recovery, remote erişim, Files two-way/conflict/
versions, migration ve gelişmiş galeri/arama/katalog kapsamı ayrı backlog'dur; yeni onaylı temel galeri/detay sayfaları13. adıma alındı; bu sıraya onaysız
sokulmaz ve sessizce düşürülmez. Kullanıcı arşivi test verisi değildir. Fiziksel
pause ve Git add/commit/push/reset/clean/stash yasağı sürer; model/effort değişmez.
