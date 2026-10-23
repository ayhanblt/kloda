# Windows D2/D3 — Mac incelemesine devir raporu

Tarih: 23 Ekim 2026. Durum: onaylı Windows kaynak ve disposable test grubu
tamamlandı; D3 bütünü ve üretim Windows kabulü tamamlanmadı.

Çalışma tabanı: `5cf2ffb5094239423550f89856b9c6de0a0ae2f8`.
Değişiklikler çalışma ağacında; commit/push yapılmadı. Önceden var olan
değişiklikler korundu. Bu rapor için yeni test veya build çalıştırılmadı.

## 1. Kaynakta tamamlananlar

**D2:** İlk dosya yayınlaması, aynı handle üzerinde create-new, içerik yazma,
pre-flush, mevcut hedefi değiştirmeyen rename, post-flush ve nesne/içerik
doğrulamasına bağlandı. Belirsiz sonuç başarıya çevrilmiyor; orijinal owner ve
dosya/ancestor sahipliği korunuyor. NTFS kalıcılık sonucu resmî sözleşmelerin
birlikte değerlendirilmesine dayanan açık bir çıkarımdır; elektrik kesintisi
deneyi değildir. Geçerli mevcut sertifika korunur; yenileme gerektiğinde signing
ve yazma öncesinde güvenli durulur. Sertifika replacement çözülmüş sayılmıyor.

**D3 kayıt ve seçim:** Sabit boyutlu intent/activation kayıtları ve bounded tam
zincir doğrulaması uygulandı. Eksik, bozuk, yarım, bilinmeyen veya tutarsız
envanterde ret var; eski geçerli prefix'e veya legacy generation'a fallback yok.

**D3 mevcut generation'ı yeniden açma:** Windows production initializer, tam ve
commit edilmiş mevcut generation'ı doğrulayan yola bağlandı. Varsayılan native
namespace development; production yalnız açık `desktop-production` Cargo
feature'ıyla seçilir. Çağıranın yolu veya ortam değişkeni rol seçmez.

Mevcut legacy fence, role kilidi, seçili generation kilidi, ancestor ve kayıt
pin'leri aynı `OwnerLock` Arc ömrüne bağlandı. Role/generation kilitleri Windows
paylaşım denetimine katılan data-read erişimiyle ve share-none açılır; yazılmaz.
Eksik gerekli kilit oluşturulmaz. D2'nin belirsiz sonuçta tuttuğu owner kopyası
bu sahiplik paketini de tutar.

**SQLite:** Yalnız yeni Windows generation yolu için tek authority connection,
ilk WAL erişiminden önce doğrulanan EXCLUSIVE WAL ve private VFS bağlandı.
SQLite'ın gerçekten kullandığı DB/WAL handle'ları I/O öncesinde volume + 128-bit
file identity, final path ve mevcut güvenlik kontrolleriyle doğrulanır. SHM,
bilinmeyen dosya, NORMAL fallback, read-only downgrade ve doğrulama hatası
reddedilir. Mevcut generation reopen yolu CREATE veya schema migration izni
vermez. Windows production'da eski yol tabanlı `Store::open` kapalıdır;
testlerdeki disposable eski yol diğer kanıtlarla karıştırılmamalıdır.

Bu bağlantı mevcut commit edilmiş generation'ı açabilir; yeni generation
oluşturma akışının uygulanmış olduğu anlamına gelmez. Gerçek kurulum açılmadı.

## 2. Gerçekten çalıştırılan kontroller

| Kontrol | Sonuç / kapsam |
| --- | --- |
| Windows locked/offline test derlemesi, `--no-run` | PASS / exit 0 |
| Desktop native `desktop-node` build/link | PASS / exit 0; uygulama çalıştırılmadı |
| `desktop-production` native check | PASS / exit 0 |
| Beş dar kontrol | 5 PASS / exit 0: canonical generation adı, VFS yol/connection reddi, sticky SHM reddi, NORMAL/non-WAL reddi, ayrı store trust ve QR/izin ayrımı |
| Onaylanan disposable native testler | 5 PASS / exit 0; her biri tek exact ignored case olarak çalıştırıldı |
| Satır sınırı | Değişen Rust dosyaları en fazla 300 nonblank satır |
| `git diff --check` | PASS / exit 0 |
| fmt / clippy | UNAVAILABLE; explicit toolchain'de araçlar yok, kurulmadı |
| TypeScript lint/typecheck | NOT_RUN; TS/UI/ABI değişikliği yok |

Beş native fixture şu davranışları doğruladı:

1. Aynı test kilidinin ikinci açılışı reddedilir; ilk handle kapanınca açılır.
2. Gerçek `OwnerLock` Arc klonları son referansa kadar orijinal kilidi tutar.
3. Private VFS gerçek DB/WAL handle kimliklerini doğrular; EXCLUSIVE query/write
   çalışır, SHM oluşmaz ve aynı admission ikinci connection'ı reddeder.
4. Main handle doğrulaması reddedilirse SQL kabul edilmez; DB byte'ları değişmez.
5. Eksik test WAL'ı yeniden oluşturulmaz.

Native fixture'lar yalnız kendilerinin oluşturduğu geçici sentetik dosyaları
kullandı. Owner Arc fixture'ı `_generation=None` kullanır; bütün production
legacy/role/generation paketinin runtime testi değildir. VFS fixture'ının test
admission'ı gerçek file identity karşılaştırır; tam production
KnownFolder/ACL/zincir/TPM başlangıcını kanıtlamaz.

Önceki dokuz saf kayıt/zincir testi ve D2 kontrolleri kendi tarihsel kanıtlarında
PASS'tir; bu son grupta gereksiz yere yeniden çalıştırılmadı. D1'in eski dört
fixture PASS'i yeni entegrasyonun kanıtı olarak kullanılmadı. Warning'ler
bulunduğundan strict lint PASS iddiası yoktur.

## 3. Ayrı güvenlik ve sonuç incelemesi

Ayrı review'da bulunan kilit mutual-exclusion, cached SQL sonrası poison,
callback sonuç türü ve read-only downgrade sorunları düzeltildi. Win32'nin
yalnız RW/RO döndüren `pOutFlags` sözleşmesine aykırı ek type-bit kontrolü de
kaldırıldı. Güncel reopen-only kaynakta kalan somut P1 engel saptanmadı.

Son sonuç/gizlilik review'ı kaynak hash'lerini **31/31**, native ham kayıt
hash'lerini **11/11**, beş exact PASS ve boş stderr kayıtlarını doğruladı.
İncelenen public raporlarda özel profil yolu, SID veya secret saptanmadı.
Review yapan agent test/build/native işlem çalıştırmadı.

## 4. Açık işler ve kabul sınırları

| İş / kabul ölçütü | Güncel durum |
| --- | --- |
| Doğru generation seçimi ve owner ömrü | Kaynak bağlı; zincir saf testleri ve dar kilit fixture'ları var. Tam production başlangıcı NOT_RUN |
| Eşzamanlı owner açılışını engelleme | Gerçek kilit helper fixture'ı PASS; tam namespace/çok süreç pipeline kabulü açık |
| Eksik/bozuk/yarım zincirde ret ve no-fallback | Kaynak ve saf zincir testleri; tam native admission fixture'ı yok |
| Kesinti/kayıp yanıtta yanlış başarı veya yeniden oluşturma olmaması | D2 unknown retention kaynakta korunuyor; eksik WAL no-recreate PASS. Yeni aktivasyon writer/crash/restart kabulü yok |
| Eski trust/izinleri yeni generation'a taşımama | Ayrı store trust izolasyonu doğrulandı; gerçek fresh-bootstrap ve eski granted ACL transferi testi yapılmadı |
| QR tek başına dosya izni vermesin | Tamamlanmış sentetik yeni QR kaydı ve store reopen sonrasında scope yok: PASS |
| Fresh generation bootstrap ve strict yeni TPM alias collision | Uygulanmadı; mevcut alias'ı açma davranışı fresh-create kanıtı değildir |
| Intent/activation yazıcısı ve canlı generation değiştirme/quiesce | Uygulanmadı |
| Sertifika yenileme/replacement | Yenilemede güvenli duruş var; replacement açık |
| Yeni production publisher runtime, gerçek süreç kesintisi/restart | NOT_RUN |
| Gerçek owner/TPM/cihaz/platform/power-loss kabulü | NOT_RUN; fiziksel duraklatma sürüyor |
| Bağımsız tam rollback tespiti | Sağlanmıyor; aynı disk zinciri bağımsız monotonic witness değildir |

Eski backup'lar ve retention/suppression metadata'sı yeni trust üzerinden
otomatik listelenmez, restore edilmez veya devralınmaz. Fresh QR ve ayrı yerel
dosya erişim onayı kararları korunur. Gerçek key/pin/cert/epoch/authority/pending
ve kullanıcı arşivi üzerinde işlem yapılmadı; reset/adoption/migration/cleanup
ve guard gevşetme yapılmadı.

## 5. Mac incelemesi ve değişiklik envanteri

Kaynak grupları:

- D2: `installation_windows_publication.rs`, paylaşılan publication name/buffer,
  initialization/files/diagnostics ve Windows Cargo feature bağlantıları.
- D3: generation record/chain, native generation admission ve legacy fence;
  `initialization_windows_generation.rs` ve initializer bağlantısı.
- SQLite: `store_windows_connection.rs`, `store_windows_vfs*.rs`, `store.rs` ve
  disposable/saf regresyon testleri.
- Karar/takip: ADR0015, Codex/session handoff, roadmap/status, D2/D3 tasarım
  belgeleri ve seçilmiş evidence kayıtları.

Dosya bazında tam commit öncesi envanter ve kaynak hash'leri aşağıdaki JSON
kayıtlarındadır. Ham `.local-evidence` komple aktarılmamalıdır. Mac'te kaynak
diff'i ve kalan fresh-bootstrap/activation tasarımı incelenmeli; bu sonuçlar
üretim Windows alıcısı hazır veya D3 tümü tamamlandı diye özetlenmemelidir.

## 6. Birincil kanıtlar

- [D2 final kaynak/sertifika kanıtı](evidence/windows-publication-d1-2026-10-21/d2-parent-certificate-20261023T073810Z.json)
- [D3 bağlı kaynak, build/test ve envanter](evidence/windows-publication-d1-2026-10-21/d3-connected-source-20261023T091848Z.json)
- [D3 izinli native runtime ve güncel envanter](evidence/windows-publication-d1-2026-10-21/d3-native-runtime-20261023T102540Z.json)
- [SQLite nesne bağlama tasarımı](windows-d3-sqlite-object-binding-design.md)
- [Atomik generation seçim tasarımı](windows-d3-atomic-generation-selection.md)

Önceki NOT_RUN/pending açıklamaları tarihsel checkpoint'lerdir. Son native
kayıt yalnız belirtilen beş fixture için bunları aşar; diğer kabul kapılarını
kapatmaz. Bu onaylı Windows grubu tamamlandı ve duruldu.
