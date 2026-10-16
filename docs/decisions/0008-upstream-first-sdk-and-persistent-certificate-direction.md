# ADR 0008 — Upstream-first SDK ve persistent certificate yönü

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) supersedes exact-DER-bound capability online reissue, signed central authority/trusted `<24h` cache and issuer/KMS prerequisites below for the native local ACL. Native certificate persistence direction and valid native certificate/profile, pins/possession/installation continuity/current operation/revoke/fence remain; persistence is not file permission. Platform SQLite/WAL/storage/custody support remains OPEN, not proven. FINAL remote authorization and central recovery/revocation versus offline PC/local grants are OPEN.

2026-10-15 status clarification: native certificate/store/LAN implementation exists under ADR0014/0016; source/API adoption is not absent. Exact platform persistence/renewal/restore and physical acceptance remain unverified. Before-code/no-execution wording below records this ADR's historical decision-only delivery, not a request to recreate the current producer. [Current handoff](../implementation/codex-migration-handoff.md).

- Kalıcı kayıt tarihi: 2026-10-05; kayıt zamanı gözlemi 2026-10-05T08:01:12Z UTC
- Durum: D01 mandatory upstream auth signer yönü [ADR0012](0012-kloda-owned-p256-device-identity.md) ile retired; D03 native DER persistence kabul, exact storage/API ve runtime doğrulanmadı
- Karar sahibi: Ayhan
- Tarihsel onay: karar sorularında **Upstream-first** ve **Native DER persistence** seçildi; upstream prerequisite aşağıdaki supersession ile retired

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) ilk standard SAS/SDK/store/binding gerekliliklerini kaldırır; D01 upstream/fork yönü historical/non-actionable, D03 native DER persistence ve file authorization continuity korunur.

## Bağlam

[2B karar paketi](../implementation/production-decision-package.md) tarihsel D01 SDK bakım yönü ile D03 certificate lifecycle yönünü ayırır. [2A kaynak araştırması](../security/production-readiness-research.md) eski crypto0.19.1 signer/native binding ve jose→remoteKMS gap'lerini kaydeder. Historical patch/cache/raw final source eksikliği yalnız eski Matrix-key feasibility scope'una aittir; yeni P-256 producer için recover/build blocker değildir.

Current identity [ADR0012](0012-kloda-owned-p256-device-identity.md) ayrı Kloda P-256 uzun ömürlü device auth'tur; ADR0013 initial trust için backend-independent yerel QR seçer ve Matrix'i current path'ten çıkarır. ADR0004 LAN exactDER capability lifecycle ve installation/time/authorization continuity korunur; QR pinning ilk file grant veya offline authority yaratmaz, same Matrix key/software-only auth varsayımı korunmaz.

## 1. SDK byte-signer bakım yönü — historical / retired

Eski **upstream-first auth signer** prerequisite retired'dır. Matrix arbitrary-byte/device-only API, minimal SDK distribution ve standard SAS package gate'leri current roadmap/TODO veya blocker değildir. Historical contribution policy/search yalnız archival/non-actionable kayıt olarak kalır; yeni upstream araştırması açılmaz.

Maintained minimal Matrix SDK fork **seçilmedi**; ayrı Kloda P-256 identity tercihi fork adoption değildir. Tarihsel upstream contribution değerlendirmesi policy/disclosure/human-authorship sınırlarına tabiydi; public submission yapılmadı. Published Apple/Node/WASM binding farkları tek matched production release sayılmaz.

Exact native source/release/manifest/lock/features ve JNI/Swift-C/Node-API ABI, P-256 provider/upgrade/security policy gerekli dependent kapsamda sabitlenir. Historical signer patch/raw final corpus yeni identity prerequisite değildir; toplu recovery/rebuild veya private-key extraction yok.

## 2. Certificate lifecycle yönü — kabul

**Native DER persistence:** exact certificate DER'in normal process restart boyunca native lifecycle içinde korunması hedeflenir. Same-key renewal yeniDER üretirse eski cert-bound capability kabul edilmez; authenticated online reissue gerekir, yalnız mevcut eligible scope. Her process start'ta kasıtlı farklıDER üretip tekrar online issuance bekleyen D03-B yönü **seçilmedi**.

Bu karar exact path/format/OS storage class/native ABI/atomic update/recovery implementation'ını seçmez. Kloda key/pin/pairing/epoch/local authorization consistency ve effective backup/device-transfer exclusions; expiry/restore suspicion ayrıca runtime/physical kanıt ister. Matrix store current initial veya ongoing Kloda auth prerequisite değildir. Epoch/t0 cert reconnect/renewal/reissue ile sıfırlanmaz, scope genişletilmez.

Persisted aynıDER tek başına file admission/offline authority sağlamaz: valid signed capability, current local grant/version/deny/scope, Kloda key+pin+install continuity, trusted absolute time ve elapsed upper<24h ile fresh full pinned TLS + Kloda mutual session proof birlikte gerekir. Pairing-only channel preexisting capability istemez; initial QR PC fingerprint actual TLS P-256 SPKI hash'idir, exact capability DER hash'i değildir. Remote DTLS binding otomatik bu profile'a aktarılmaz. PC offline ise file admission yoktur; reboot/reinstall/ThisDeviceOnly/full rollback için kesintisiz garanti yok. Unprovable time/cert continuity→online wait; transient provider failure→no reset/plaintext fallback; required Kloda key/pin/epoch/restore loss→fresh yerel QR trust + ayrı gerekli online authorization/new grant.

## 3. İzin ve gate sınırı

Bu iki seçim **PR gönderme, upstream/fork/release oluşturma, dependency upgrade/install, product code, build/test/service/device/cloud veya1B/1C/2C execution izni değildir**. Seçilmiş exact API/storage/provider veya zero-open-design native execution spec yoktur. D02 supported nonexport issuer integration/provider/custody/hosting ve D04 platform/storage/trusted-time implementation kararları açık; KMS provider seçilmedi. ES256 provisional kalır; runtime+actualKMS ve ayrı adoption kararı olmadan final olmaz.

Eski Matrix-key 1A raw source/spec blocked;1B/1C/1D sonuçları eski scope'ta historical/not-executed kalır. Bunların recovered SDK-BYTE corpus'u yeni Kloda identity gate değildir. Yeni bağımlı dilimde [QR protocol contract](../implementation/qr-pairing-implementation-roadmap.md), P-256 provider, actual LAN TLS-SPKI/secret-channel binding/state/durable pin/session proof için exact source/API/ABI hazırlanır; ayrıca execution onayı gerekir. LIFE-CERT/EPOCH/BACKUP/PROVIDER/TIME, gerçek KMS/physical gereksinimleri file authority/platform kapsamında korunur, initial QR trust backend blocker'ı değildir. Android device-local hardware signer dar CLOSED/PASS; actual Android↔PC LAN/native/iOS/desktop gates açık ve eski pass'ler bu yeni kapsamın kanıtına aktarılmaz.

36 acceptance hedefi not-executed; G01/G02/G03/G05/G06/G09 ve physical/diğer gate'ler kapanmadı. Bu ADR yön kararının kalıcı kaydıdır; production readiness veya runtime proof değildir.
