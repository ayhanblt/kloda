# Windows Codex CLI devir belgesi — yalnız D1 koruma testleri

Checkpoint:2026-10-21. Ana geliştirme oturumu macOS’tadır. Windows Codex CLI yalnız bu belgedeki tek test görevini yapacak, kanıt ve rapor hazırlayıp duracak. Kullanıcı sonucu ana oturuma getirir; sonraki geliştirme/kararlar orada alınır. Bu belge kalıcı genel roadmap yürütme izni değildir.

## Yetki ve tek görev

Kullanıcının bu belgeyi referans alan Windows başlangıç prompt’u, aşağıdaki **dört kalan testin her birini bir kez**, sıralı ve ilk hatada durarak çalıştırma iznidir. Okumak veya eski “evet” kayıtları tek başına yeni izin değildir. İlk absent-target testi zaten geçti; önceki owner-start ve tek-test izinleri tüketilmiştir, tekrarlanmaz. Bu görevin açık test kapsamı için yeniden onay sorma; kapsam dışı karar/iş/yeniden deneme gerekiyorsa dur ve raporla. Sistem sandbox/approval engeli varsa gerçek nedeni bildir, güvenlik sınırını dolanma.

1. `installation_files::windows::candidate::tests::rename_atomically_refuses_existing_target_and_preserves_pending`
2. `installation_files::windows::candidate::tests::existing_pending_is_not_adopted_deleted_or_overwritten`
3. `installation_files::windows::candidate::tests::injected_cut_points_and_lost_reply_never_ack_or_regenerate`
4. `installation_files::windows::candidate::tests::target_appearing_after_preflush_is_not_replaced`

Bu görev veri yazan Windows API fixture’ları çalıştırır: actual KnownFolder LocalAppData altında yalnız yeni random `Kloda.NativePublication.Test.<nonce>/pairing` kökleri; test owner.lock ve disposable sabit byte’lar. Hepsi çalışırsa en fazla9 yeni root; eldeki normal kurulum/arşiv kullanılmaz. Test kökleri kanıt için bırakılır, silinmez. Bir testin birden fazla cut senaryosu olması ikinci kez çalıştırma izni değildir; mevcut test gövdesini bir kez çalıştır.

Repo beklenen yolu: `C:\Users\ayhan\Desktop\projects\kloda`. Kullanıcı bu güncel repo ve belgeleri macOS’tan push edip Windows’ta pull edecektir. Agent Git işlemi yapmaz. Windows’a daha önce elle beş mevcut ve beş yeni dosya uygulanmıştı; pull local/untracked çatışması çıkarabilir. Böyle bir durumda user’ın kaynaklarını taşıma/silme/reset/stash/overwrite ile çözme; kullanıcı raporlasın. Gitignored `.local-evidence` yokluğu normaldir ve bu görevin önkoşulu değildir.

## Önce okunacaklar

- Kök `AGENTS.md`, `.omp/AGENTS.md`, [Codex handoff](codex-migration-handoff.md) ve [session handoff](implementation-session-handoff.md) güncel üst/son checkpoint’leri.
- [ADR0009](../decisions/0009-evidence-gated-incremental-implementation.md), [ADR0015](../decisions/0015-desktop-platform-and-signing-isolation.md), [ADR0016](../decisions/0016-v1-pc-local-file-authority.md), [ADR0017](../decisions/0017-photos-sidecar-manifest-and-import-recovery.md), [ADR0018](../decisions/0018-desktop-background-receiver-lifecycle.md), [ADR0019](../decisions/0019-desktop-device-removal-and-recoverable-backup-deletion.md). Yeni karar yok; mevcut scoped supersession korunur.
- [Windows kök neden](windows-startup-root-cause-2026-10-21.md), [D1/D2/D3 tasarımı](windows-authority-publication-recovery-design.md), [platform planı](desktop-platform-validation-plan.md), [roadmap](qr-pairing-implementation-roadmap.md), [status](first-vertical-slice-status.md).
- **Taşınabilir kanıt:** [kanıt README](evidence/windows-publication-d1-2026-10-21/README.md), [results](evidence/windows-publication-d1-2026-10-21/results.json), [10 source hash](evidence/windows-publication-d1-2026-10-21/source-hashes.json), [stdout excerpts](evidence/windows-publication-d1-2026-10-21/windows-observations.txt), [komut prosedürü](evidence/windows-publication-d1-2026-10-21/commands.md). Hepsi Git’e uygun seçilmiş metindir; local ZIP/ham arşiv gerektirmez.

## Bilinen durum ve kanıt ayrımı

| Konu | Mevcut kesinlik / sınır |
|---|---|
| Üretim owner | İki kontrollü kullanıcı denemesi başarısız; son çıktı `Storage/LeafNameValidation/storage_failure/win32=None`. |
| Bugünkü ret | Guard yalnız `epoch.pending`16 ve `owner.lock`0 kabul etmişti. `prepare` taraması pending adını allowlist’te bulamadığından duruyor; bu ret belirlenmiştir. Dosya içeriği okunmadı/hash’lenmedi. |
| Eski pending neden kaldı? | İlk uygulama failing operation kanıtı yok. Eski ayrı WRITE_THROUGH32/directory-reopen5 probe sonuçları özgün uygulama hatası değildir. Yeni probe/aynı owner tekrarına izin yok. |
| Allowlist eklemek | Çözüm değil: sonraki `epoch()` yine CREATE_NEW ile aynı pending’e takılır. Silmek veya pending’i epoch diye benimsemek onaylı değil. |
| D1 | **Test-only** native `NtSetInformationFile(FileRenameInformation)`; tek synchronous CREATE_NEW source handle, DELETE/read/write + read-only sharing, NULLroot/simpleleaf/no-replace; retained owner/ancestors + ACL/reparse/NTFS/singlelink, flush/ID/path checks. Production publisher hâlâ eski yolda; D1’e bağlanmadı. |
| SDK | windows-sys0.61.2 sabit. `Wdk_Storage_FileSystem`/`Win32_System_IO` sadece Windows dev-dependencies. Sürüm/crate/provider değişimi yok. |
| macOS D1 geçmiş kontrol | Native139/contract4/fmt/strict Desktop clippy/300line/Desktop build PASS. Windows ABI/API proof değildir; şimdi tekrar çalıştırılmış sayılmaz. |
| Windows D1 compile | Kullanıcı bildirimli PASS27.31s, `--lib --no-run`,6existing-source warning. Hiç test çalıştırmadan SDK/test code derlendi. Strict Windows clippy PASS değildir. |
| İlk D1 fixture | Kullanıcı stdout:1 PASS/0FAIL/0 ignored/148filtered/0.11s. Dört sabit hedefte namespace/object/ACL/content kontrolleri geçti. **Tekrar çalıştırma.**148filtered PASS sayılmaz. |
| Kalandört fixture | Export anında NOT_RUN. Yalnız bu Windows göreviyle yeni izinli grup. |
| D2/D3 | Metadata/power-loss durability ve geçmiş yarım kurulum/independent continuity witness OPEN. Sertifika replacement/targetrace, SQLite DB/WAL/SHM gerçek-object binding OPEN. Test sonucu bu kararları kapatmaz. |

Kod: `packages/pairing-native/src/installation_windows_candidate{,_buffer,_fixture,_tests}.rs`, `windows_publication_contract.rs`, cfg(test) bağlantısı `installation_windows.rs`/`lib.rs`; yardımcı `installation_windows_{handles,path}.rs`. Başlangıç sırası/epoch `initialization.rs`, `installation_files.rs`; gerçek production publish `installation_windows.rs:116+`. Conditional cfg/test sınırını ve ilgili çağıranları doğrula. Tam satırlar yeni commit’te değişebilir; sembol/ad üzerinden bul.

SDK buffer’ın ayrı pure-layout test case’i tek başına çalıştırılmış sayılmaz. Normal-return cut enjeksiyonu **gerçek process kill/restart/elektrik kesintisi değildir**. `NamespaceObservedDurabilityUnproven` özellikle kalıcılık kabulü değildir. Geçmiş kaydı güncel izin sayma.

## Değişmez sınırlar

- Agent **Git add/commit/push/pull/reset/clean/stash yapmaz**. Kullanıcı Git aktarımını kendisi yönetir. Read-only status/log/diff/show uygun; index/history/config’i değiştirme. `.gitignore` içindeki `/.local-evidence/` kuralını açma.
- Model/effort ayarı, Codex/OMP agent config’i, genel environment/config veya toolchain değiştirme. Eski OMP alias/tool adlarını varmış gibi çalıştırma. Yeni dependency, SDK kurulumu/güncelleme, fallback, admin yükseltme veya ExecutionPolicy bypass yok. Windows CLI kullandığın mevcut ortamdaki yetki engelini dürüst bildir.
- Gerçek `%LOCALAPPDATA%` development/production pairing klasörünü, mevcut pending/epoch/owner/pin/key/cert/DB/WAL/SHM/authority verisini tarama/okuma/hash/taşıma/silme/yenileme. Fixture’ların kendi yeni random kökünde yaptığı işlemler bunun dışındaki açık test kapsamıdır. Var olan test köklerini de temizleme.
- Kullanıcı arşivi, elle eklenmiş ilgisiz dosyalar ve telefonlar test verisi değildir. Mevcut owner, Electron, tray/autostart, QR, cihaz onayı/grant/revoke, gerçek alıcı/aktarım, hardware identity/TPM, network veya eski probe çalıştırma yok.
- Genel fiziksel/ürün kabulü duraklatılmıştır; yalnız budört disposable fixture dar istisnası vardır. Normal uygulamayı başlatma ve işlevsel ürün kabulüne genişleme.
- PC-first offline LAN ve ADR0016 PC-local ACL korunur; login/JWT/KMS LAN zorunluluğu, software key fallback, security check gevşetme, farklı provider, ancestor paylaşımını açma, automatic pending adoption/reset/migration yok.
- ADR0017 metadata, ADR0018 background/foreground grant ayrımı, ADR0019 selected-version trash30day/sharedPhotos/suppression/explicitrebackup korunur. Desktop WebDAV5attempt/60s retry değişmez; native installation’a bu bütçeyi taşıma. Native freeze code/test/expected sonuç/izin allowlist’i değiştirme.
- Android/iOS, Linux/macOS platform geliştirmesi, yeni scheduler/kuyruk/hesap/remote/E2EE/two-way/migration işi yok. macOS signing, Linux provider ve UbuntuLTS/GNOME/KubuntuLTS/KDE gerçek kabulü açık; Windows fixture bunları kapatmaz. Android suppression/rebackup runtime ve broader product gates ana oturumda takip edilir.
- Bu görevde **ürün/test/fixture kaynaklarını değiştirme**. İzinli yazılar: compiler artifact’ları, sadece yeni fixture root’ları, Git-dışı run kanıtı, seçilmiş redakte kanıt/status notları. Derleme/test hatasında source patch/expected-value değişimi/probe ile düzeltmeye çalışma; source/log incelemesiyle sonucu raporla ve dur. Yeni soru/karar ana oturuma döner.

## Uygulama sırası

[Komut prosedürünü](evidence/windows-publication-d1-2026-10-21/commands.md) izle:

1. Repo/actualGitHEAD/dirty dosyaları salt okunur kaydet.10 public hash’i strict normalizasyonla doğrula; freeze uyuşmuyorsa dur. Eski source ZIP veya `.local-evidence` isteme; güncel repo yeterlidir.
2. Mevcut explicit x64 MSVC1.99.0 ile `cargo test --lib --no-run --locked --no-default-features --target x86_64-pc-windows-msvc --message-format=json` derle. Yüklü araç yok/compileFAIL ise dur; config/dependency düzeltme yok.
3. Bu derlemenin tek doğru `compiler-artifact` test executable’ını seç; eski hashli exe adını/globilkdosyayı kullanma. Dört tam adı list-only ile ilk mutating testten önce doğrula. İsimsıfır/çok/değişmiş binary varsa dur.
4. Dördünü yukarıdaki sırada **birer kez** exact/ignored/singlethread çalıştır; her nativeexit+case adı+1testsummary’i doğrula; ilk hata/unknown/timeout’ta sonraki testi çalıştırma. Test scope dışı `--include-ignored`/suite/prefix run yok.
5. Raw stdout/stderr sadece Git-dışı local run alanında; bu kanıt klasörüne redakte kısa `.txt`+JSON yeni run checkpoint’i ekle. UTC/exitcode/HEAD/source/exe hash, ne çalıştı-ne çalışmadı açık olsun. Private path/config/state koyma; ham transcript’i topluca kopyalama. Ayrı sonuç-review geçişi yap, testleri yeniden koşturma.
6. Kısa sonuç raporu ver ve **dur**. Ana roadmap’e/geliştirmeye geçme. Kullanıcı raporu macOS oturumuna getirecek.

## Test grubunun verebileceği sonuç

Dört case PASS olursa “gözlenen Windows/NTFS ortamında adayın hedef/pending korunması ve yapay belirsiz sonuç guard’ları geçti” denebilir. Bu dört assertion kümesi için somut sonuçtur. Şunlar **söylenemez**: ilk pending’i bırakan tarihsel failing operation bulundu; power-loss kalıcılığı/gerçek restart kanıtlandı; mevcut owner düzeldi; production API/D2/D3 onaylandı; bütün Windows/Desktop tamamlandı.

FAIL/UNKNOWN’da beklenen-hatalı assertion, gerçek exit/NTSTATUS (varsa), son tamamlanan adım ve kaynakta anlamı verilir. Çıktının vermediği kesin nedeni tahmin etme. Üretim düzeltmesi için gereken en küçük sonraki öneri raporda olabilir; uygulanmaz.

Son rapor formatı:dört case için PASS/FAIL/NOT_RUN/UNKNOWN tablosu; gözlenen komut/exit/süre/HEAD/source-hash/exe bağı ve redakte kanıt yolları; önceki1 PASS’in ayrı geçmiş kaydı; kalan D2/D3/cert/SQLite/continuity sınırı. Rapor bu ana oturuma yapıştırılabilir Türkçe olsun. “Windows görev raporu hazır; sonuç ana oturumda değerlendirilmeli” diyerek bitir ve bekle.
