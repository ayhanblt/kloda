# ADR 0009 — Kanıt bağımlılığına göre dilimli implementation

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

## Değişmeyen sınırlar

- Authority/native DER/evidence-gated incremental sıra korunur. [ADR0012](0012-kloda-owned-p256-device-identity.md) ayrı Kloda P-256 identity'yi korur; ADR0013 current first trust için backend-independent yerel QR seçer. Matrix/SAS/store/SDK/binding veya upstream/fork işi current gate/TODO değildir. Yerel pins same-account file eligibility/step-up/scope/capability yerine geçmez. Remote WebRTC/DTLS/Cloudflare TURN fallback yönü ayrı seçilidir. [KLODA-QR-PAIR-V1 protocol bytes ve minimum native davranış](../security/qr-pairing-v1-protocol.md) frozen; implementation not executed. Exact provider/native API/ABI/adoption/storage/session integration, production enrollment/schema, remote deployment/custody ve trusted-time gate'leri açık; Android device-local signer dar CLOSED/PASS aggregate platform/actual LAN gate'ini kapatmaz. Lost corpus toplu rebuild edilmez.
- ES256 provisional; runtime + gerçek KMS feasibility ve ilgili adoption kararı olmadan final değil. [36 authority hedefi](../security/capability-acceptance.md) not-executed; [production/physical gate'ler](../security/production-gates.md) açık kalır. Genel implementation başlangıcı full authority/file transfer veya release readiness ilanı değildir.
- `.local-evidence/` proje-local ve Git-dışıdır; bağımsız yedek yok. Disk/proje silinmesi veya `git clean -fdx` karşısında saklama garantisi verilmez.

## Sonuç

Implementation'a geçiş onaylandı; ilk dilim yeni session'da mevcut repo üzerinden scope edilir. Başlangıç kaydı: [implementation session handoff](../implementation/implementation-session-handoff.md). Bu ADR kaydı sırasında ürün kodu, native rebuild veya yeni runtime deneyi çalıştırılmadı.
