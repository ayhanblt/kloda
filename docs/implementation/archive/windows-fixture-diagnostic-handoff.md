# Windows D1 — fixture kurulum tanılaması ve yalnız tek yeniden deneme

> **Güncel onay — 2026-10-21:** Kullanıcı artık her küçük denemede onay beklemeden, yalnız güvenli disposable D1 kapsamında kanıta dayalı araştırma/test/dar düzeltme/review yapılmasına izin verdi. [Güncel çalışma grubu](windows-d1-investigation-workflow.md) bu belgedeki eski tek/four-test stop kapsamının yerine geçer; mevcut veri, sandbox ve açık mimari sınırlarını kaldırmaz.

2026-10-21. Ayhan, ilk collision testinin fixture kurulumu `StorageFailure` ile durmasından sonra yalnız test tanılamasını ve aynı başarısız case'in **bir kez** yeniden denenmesini onayladı. Bu belge, bu deneme için [eski dört-test devrinin](windows-codex-d1-handoff.md) yürütme kapsamını daraltır. Diğer üç test çalıştırılmaz; başarıda da otomatik devam yok.

## Kanıtlanan ve bilinmeyen

- Kullanıcı raporu: HEAD `d4c88d3`, 10/10 source match, locked/no-run compile exit0/10.2698947s, dört exact list exit0. İlk collision case exit101; `installation_windows_candidate_tests.rs:27:34` içindeki `Fixture::new().unwrap()` başarısız. Candidate publish/koruma assertion'larına erişilmedi. Diğer üç case NOT_RUN; önceki absent-target PASS tekrarlanmadı.
- Windows JSON ve tam ham kayıt bu Mac checkout'unda henüz yok; bu checkpoint kullanıcı tarafından gönderilen rapora dayanır. Gerçek kayıt varmış gibi yeniden oluşturulmadı.
- Önceki hash engeli: kültüre duyarlı BOM StartsWith kontrolü ilk gerçek karakteri siliyordu. Mac'te doğru hash10/10 ve ilk karakter çıkarılınca eski yanlış hash10/10 yeniden üretildi. Windows numeric BOM/Git blob doğrulaması kullanıcı raporu. Eski manifest/başarısız kayıt korunur.
- Kaynakta fixture `diagnostic::run` başlatmadığı için alt yardımcıların `record` çağrıları bir diagnostic state bulamıyordu. Yeni tanılama yalnız bu görünürlük açığını kapatır; Windows `StorageFailure` alt nedeni henüz bilinmiyor. PowerShell InitializeDefaultDrives uyarısının nedensel etkisi kanıtlanmadı.

## İzinli kaynak değişikliği ve değişmeyen sınır

Üç dosya: `installation_windows_candidate_fixture.rs`, `startup_diagnostics.rs`, yeni `startup_diagnostics_fixture_tests.rs` (hepsi `packages/pairing-native/src/` altında).

Fixture `run` ile çevrildi; hataya dönebilen adımlar `at` ile sabit etiket aldı: Base, VolumeRootOpen, AncestorOpen, BaseOpen, Volume, BaseSecurity, Nonce, RootCreate/PairingCreate, RootOpen/PairingOpen, RootSecurity/PairingSecurity, OwnerCreate/OwnerSecurity/OwnerFlush. Örnek çıktı şekli: `KLODA_STARTUP stage=Fixture(VolumeRootOpen) operation=Some(OpenFile) code=storage_failure win32=Some(...)`. Bu örnek gözlenmiş Windows sonucu değildir. Validation veya başka kodsuz hatada win32=None kalır; kod uydurulmaz. `stage=Fixture(Base)` cache'lenmiş KnownFolder hatasını da gösterebilir; eksik Win32 bilgisi varsayımla doldurulmaz.

Yeni Stage varyantı/etiket enum'u ve host testi cfg(test); fixture mevcut Windows cfg(test) ağacında. Production başlangıç/yayınlama, erişim/share/ACL/reparse/NTFS/singlelink, CREATE_NEW, pinned handles, namespace, işlem sırası, test assertion'ları ve cleanup davranışı değişmedi. Yeni dependency/SDK flag yok. Log yalnız typed enum/closed code/optional numeric OS code; path, SID, nonce veya dosya içeriği yok. Production binary'nin byte düzeyinde aynı olduğu iddia edilmez.

Mac doğrulaması:9 diagnostic test PASS (16 adım × kodlu/kodsuz ilk-hata koruması; mevcut isolated subprocess/pending-preservation smoke dahil), fmt/strict all-target Desktop clippy/300-line guard/diff-check PASS. [Güncel hazırlık kaydı](evidence/windows-publication-d1-2026-10-21/fixture-diagnostic-preparation.json). Mac testleri Windows fixture/API compile/runtime kanıtı değildir.

## Windows'ta tek görev

1. AGENTS/.omp, Codex handoff, bu belge ve eski devirdeki ADR/security sınırlarını oku. Kullanıcı güncel source/docs'u Git ile taşır; agent add/commit/push/pull/reset/clean/stash yapmaz. Conflict/custom source farkında dur; overwrite/overlay yok. Yeni repo konumu seçme.
2. Repo/HEAD/dirty dosyaları kaydet. Eski10 dosyalık manifesti değiştirme. Bu dilimde [yeni12 dosyalık envanteri](evidence/windows-publication-d1-2026-10-21/fixture-diagnostic-source-hashes.json) kullan. Strict UTF8 decode; `text.Length > 0` ve sayısal `text[0] == 65279` ise bir karakter kaldır; gerçek CRLF→LF; BOM'suz UTF8 byte[] SHA256. Kültüre duyarlı StartsWith/Trim/başka whitespace dönüşümü yok.12/12 eşleşmeden ilerleme.
3. Eski [komut prosedüründeki](evidence/windows-publication-d1-2026-10-21/commands.md) artifact güvenliğiyle explicit mevcut `1.99.0-x86_64-pc-windows-msvc`, locked/no-default-features, x86_64-pc-windows-msvc `cargo test --lib --no-run --message-format=json` derle. Derleme hatasında dur, kaynak/toolchain/config düzeltme yok. Yeni test nedeniyle filtered sayısı değişebilir;149 gibi sabit bir sayı bekleme.
4. Bu derlemenin tek doğru compiler-artifact executable'ını seç, repo/manifest/profile/path/reparse/SHA256 doğrulamalarını koru. Eski exe adı veya hash'ini sabitleme. Yalnız aşağıdaki exact case için `--exact --ignored --list` çalıştır; tek exact test/exit0 şart.
5. Yalnız şu case'i **bir kez**, `--exact --ignored --nocapture --test-threads=1` ile çalıştır:

   `installation_files::windows::candidate::tests::rename_atomically_refuses_existing_target_and_preserves_pending`

   Sonuç FAIL/UNKNOWN ise tekrar yok; PASS olsa bile diğer case'lere devam yok. Test en fazla bir yeni disposable random KnownFolder fixture root'u oluşturmayı dener; hata noktasına göre hiç oluşturmamış da olabilir. Var olan test kökünü tarama/kullanma/silme. Fixture kurulursa aynı test kendi mevcut candidate/koruma assertion'larına normal şekilde devam eder.
6. Git-dışı yeni UTC run alanında raw stdout/stderr/exit/exe hash sakla. Git'e uygun evidence klasörüne yeni küçük JSON/TXT rapor yaz; eski kayıtları ezme. Gerçek KLODA_STARTUP satırını ve panic/assertion'ı aktar. OS çağrısının FAIL kodunu olası sebep ile karıştırma: OpenFile/error5 yalnız access denied gözlemidir; sandbox/ACL/antivirus vb. alt sebebi tek başına kanıtlamaz. InitializeDefaultDrives uyarısını koru; onun için profil/config/izin değiştirme. İlk failure'da tamamlanan/ulaşılmayan kısmı belirt.
7. Ayrı sonuç review yap; test tekrarı yapmadan Türkçe raporla ve **dur**. Windows native kurulum nedeninin hâlâ belirsiz kaldığı durumları açık yaz. Kaynak veya expected assertion değiştirip PASS üretme.

## Kesin yasaklar ve kapanış

Mevcut gerçek pairing/authority/epoch/pin/key/cert/DB/WAL/SHM ve kullanıcı arşivi okunmaz/değiştirilmez; owner/probe/TPM/network/app/QR/grant yok. Yeni namespace/fallback/admin/security bypass, share/ACL gevşetme, cleanup/reset/adoption yok. Fiziksel kabul duraklatması sadece bu tek disposable test için dar istisna; model/effort değişmez. Android/iOS veya platform geliştirmesi yok.

D2/D3, power-loss/durability, historical pending recovery, cert replacement, SQLite object binding, continuity ve gerçek Windows ürün kabulü açık kalır. Bu test başarılı olursa dahi Windows storage sorunu çözüldü denmez. Windows oturumu ana roadmap'e geçmez; sonuç ana macOS oturumunda değerlendirilir.
