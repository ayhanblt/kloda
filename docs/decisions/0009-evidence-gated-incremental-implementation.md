# ADR 0009 — Kanıt bağımlılığına göre dilimli implementation

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) approves native local SQLite ACL with explicit PC backup-scope approval; central eligibility/step-up/capability/ES256/KMS and `<24h` prerequisites below are historical/superseded for that LAN scope. Evidence-gated work remains; safe platform/library filesystem capability and SQLite/WAL/platform custody support must be established, not replaced by prefix/canonicalization-only checks. FINAL remote authorization and recovery/central revocation versus offline PC/local grants are OPEN. Physical work remains paused until group acceptance; approved direction is not implemented/production proof.

- Kalıcı kayıt tarihi: 2026-10-05
- Durum: çalışma sırası kabul edildi; production gate veya yeni teknik seçim onayı değil
- Karar sahibi: Ayhan
- Onay: kayıp native deneyin yeniden kurulması ilerleyen sürece bırakıldı; mevcut ADR/kanıtlarla implementation'a geçilmesi, engelleyen eksiklerin ilgili işte hazırlanması istendi.

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) ilk Matrix/SAS/SDK gerekliliklerini yerel QR trust ile değiştirir; evidence-gated dilim sırası, authority ve historical evidence sonuçları korunur.

## Bağlam

[Recovery kaydı](../security/evidence-retention-and-recovery.md) tarihsel karar/sonuçları ve hash-verified SDK patch'ini korur; original archive ve verified final native source/lock/ABI/driver corpus tamamlanmadı. [Preparation](../implementation/issuance-admission-preparation.md) içindeki eski Matrix-key 1A exact native spec blocked sonucu yalnız historical scope'a aittir; current QR/P-256 prerequisite [native kayıt](../implementation/native-peer-session-prerequisite.md) ve [QR roadmap](../implementation/qr-pairing-implementation-roadmap.md) ile sınırlanır. Bu özel eski eksik bütün ürün işlerini durdurmak için gerekçe değildir; ADR onayı da runtime başarısı değildir.

## Karar

1. Kabul edilmiş ürün/mimari kararları ve yeterli prerequisite'leri olan küçük implementation dilimleri ilerleyebilir. Her dilimin başında gerçek repo kodu, çağıranlar, gerekli karar/source/runtime kanıtı ve kabul kriteri kontrol edilir; genel implementation onayı bütün açık teknik seçimleri çözmüş sayılmaz.
2. Eksik API/ABI/source veya feasibility sonucu dilimin doğru implementasyonunu belirliyorsa **koddan önce** hazırlanır. Bilinmeyen native/provider/storage/schema/protokol davranışı tahminle doldurulmaz; bağımlı iş bekler, bağımsız iş ilerleyebilir.
3. Yalnız runtime, fiziksel cihaz, gerçek KMS veya release doğrulamasında gerekli kanıt ilgili doğrulama noktasında üretilir. Ancak bu kanıt teknik entegrasyon seçimini belirliyorsa test sonuna ertelenmez. Mock/simulator/local signer eski veya gerçek production kanıtı yerine geçirilmez.
4. Kayıp native corpus için toplu rebuild şimdilik ertelendi; otomatik yeniden kurulum yapılmaz. Gerektiğinde yalnız bağımlı kapsam için self-contained plan ve ayrıca gereken deney/device/cloud işlem izni hazırlanır. Stage1/2 deneylerinin kendi prerequisite/onay kapıları korunur.
5. Değişen davranış gerçek smoke ile gözlenir; ilgili lint/test ve ayrı review geçişi yapılır. Yeni sanitized public source/lock/komut/hash/sonuç kanıtı doğrulanarak ignored `.local-evidence/` alanına alınır; `/tmp` tek kopya olmaz. Private key/state/credential/full transcript saklanmaz.

Prerequisite-ready dilimler bağımsız ilerler; tamamlanan kod/testler tekrar backlog'a alınmaz. Fiziksel Windows/Android/iOS kabulü mümkün olduğunca ilgili geliştirme grubunun sonunda birleştirilir; her küçük değişiklik için fiziksel test veya yeni probe istenmez.

Otomatik davranış testleri, etkilenen lint/typecheck/build, gerçek host/loopback smoke ve ayrı kritik güvenlik review geliştirme sırasında sürer. Başarısız kontrol sonraki bağımlı işe engeldir; bağımsız işi engellemez. API/storage/crypto davranışı tasarımı belirliyorsa madde 2–3 istisnası korunur: fiziksel kanıt eksikliği tahminle doldurulmaz. Kullanıcının güncel fiziksel-test duraklatması sürerken ilgili bağımlı iş blocked kalır; test talebi/probe üretilmez. Bir grubun implemented/automated-verified olması physical-verified veya production-ready değildir.

## Değişmeyen sınırlar

- Authority/evidence-gated incremental sıra korunur. [ADR0012](0012-kloda-owned-p256-device-identity.md) ayrı Kloda P-256 identity'yi korur; ADR0013 current first trust için backend-independent yerel QR seçer. Matrix/SAS/store/SDK/upstream/fork current gate değildir. Yerel pin tek başına file grant değildir: V1 LAN için ADR0016 explicit PC scope/native ACL gerekir; same-account eligibility/step-up/central capability/exact-DER reissue zorunluluğu bu kapsamda superseded'dır. [Frozen V1](../security/qr-pairing-v1-protocol.md) ve [QR roadmap](../implementation/qr-pairing-implementation-roadmap.md) implemented/build-tested kapsamı ile açık physical/platform/storage/session gate'lerini ayırır. Remote WebRTC/DTLS/Cloudflare TURN yönü korunur, final remote authorization açık. Android device-local signer dar PASS aggregate actual LAN gate'ini kapatmaz; lost corpus toplu rebuild edilmez.
- Tarihsel merkezi issuer ES256/KMS feasibility ve [36 authority hedefi](../security/capability-acceptance.md) not-executed kalır; bunlar ADR0016 V1 LAN prerequisite'i değildir ve remote/recovery için otomatik seçilmiş model sayılmaz. [Production/physical gate'ler](../security/production-gates.md) açık; implementation/host proof release readiness değildir.
- `.local-evidence/` proje-local ve Git-dışıdır; bağımsız yedek yok. Disk/proje silinmesi veya `git clean -fdx` karşısında saklama garantisi verilmez.

## Sonuç

Implementation'a geçiş onaylandı; ilk dilim yeni session'da mevcut repo üzerinden scope edilir. Başlangıç kaydı: [implementation session handoff](../implementation/implementation-session-handoff.md). Bu ADR kaydı sırasında ürün kodu, native rebuild veya yeni runtime deneyi çalıştırılmadı.
