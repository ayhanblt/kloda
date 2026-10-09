# ADR 0010 — PC işlem-bağlı durable commit kanıtı

- Kalıcı kayıt tarihi: 2026-10-05
- Durum: yön kabul edildi; source/API/ABI, gerçek receiver veya production proof değil
- Karar sahibi: Ayhan
- Onay: ambiguous recovery için “PC işlem-bağlı commit kanıtı” seçildi; sınırlı byte-presence receipt alternatifi seçilmedi.

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) SAS-bound ilk trust/binding ifadelerini yerel QR-established pins ile değiştirir; işlem-bağlı commit/query, scope/current-authority ve durable publication kararları korunur.

## Bağlam

[Phase-bound sender recovery](../implementation/implementation-session-handoff.md#beşinci-implementation-dilimi--phase-bound-acknowledged-recovery) gerçek HTTPS fixture'da uygulanmış MOVE yanıtının kaybını gözledi. Temp yok ve final doğru byte'ları içeriyor olsa bile content equality işlemin kimin tarafından yayımlandığını kanıtlamaz. Eski blind cleanup tek original temp'i silip final yokken completed0 üretmişti. Yeni sender unknown/unacknowledged nesneleri korur; acknowledged201 + whole-body hash + atomic local settlement yolu çalışır. Bu fixture normal WebDAV/TLS modelidir, native PC authority veya fiziksel durability değildir.

## Karar

1. Ana PC-first receiver'da otomatik ambiguous recovery'nin hedefi **işlem-bağlı durable sonuç kanıtıdır**: own operation identity, source/target bağlamı ve content revision/hash aynı yayın sonucuna bağlanmalıdır. Root/peer/scope authority ve durable publication fence ADR0004/0007'ye tabidir; sender journal veya hash tek başına grant değildir.
2. Sonuç PC'de tutulur; merkezi Nest/Supabase servis medya byte'ı, plaintext medya/album kataloğu veya medya hash listesi için yeni store olmaz. Bu karar receiver endpoint possession key'i yerine server issuer signer'ı koymaz.
3. WebDAV unacknowledged/unknown temp veya final için **fail-closed** kalır: otomatik delete/adoption/receipt elevation yoktur. `prepared` niyet kaydı ownership değildir. Genel unknown/legacy final veya FolderSync arşivi bu kararla migrate/adopt edilmiş sayılmaz.
4. Next receiver diliminden önce yalnız gereken dar source/API/ABI prerequisite hazırlanır. Kayıp native corpus topluca rebuild edilmez; ADR0009 evidence-gated sıra korunur. Mevcut sender snapshot/hash/phase code'u authority/session/fence implementation'ı olarak yeniden etiketlenmez.
5. Ayhan taşıyıcı için **authenticated PC result query** seçti: PC local durable operation sonucu fresh authenticated peer kanalında sorgulanır; LAN full pinned TLS1.3 + QR-established Kloda P-256 mutual device proof yönü [ADR0012](0012-kloda-owned-p256-device-identity.md)/ADR0013'tedir. Initial QR PC fingerprint actual TLS P-256 SPKI ile eşleşir; exact-DER capability binding ayrı kalır. Matrix/SAS/SDK signer/binding current dependency değildir. Portable signed receipt, ek receipt signer veya canonical signature formatı seçilmedi; ayrı Kloda identity key receipt signer kararı değildir. Query fresh peer/session/scope/current deny/revoke koşullarını bypass etmez; historical result veya backend-independent QR trust current file grant değildir.
6. Exact production API/schema, query encoding/replay/error contract ve local transactional/fence implementasyonu henüz seçilmedi. Protocol/provider/hosting/custody, native platform/storage/time veya KMS kararı çıkarılmaz. Gereken karar ve ayrı deney/gerçek sistem/physical execution izinleri ayrıca alınır.

## Kabul sınırı

- Positive recovery ancak gerçek receiver'da operation binding, doğru byte'lar, durable publication/record ordering, deny/revoke precedence, restart ve lost-reply yolları gözlenerek kabul edilir. Synthetic journal veya echo/mock result bu kanıt değildir.
- PC offline ve cloud file store yoksa sender bekler; eski result/receipt mevcut file grant, current availability veya tamamlanmamış yeni transfer için completion üretmez.
- ADR0004 authority/certificate lifecycle ve ADR0009 incremental sıra korunur; ADR0012 single Matrix key/upstream-first auth varsayımını, ADR0013 initial SAS path'ini supersede eder. ES256 server issuer provisional; yeni P-256 identity/source/platform/QR contract/native LAN binding ve enrollment/schema/trusted-time/fence/KMS/release/physical gate'leri açık. Android device-local hardware signer CLOSED/PASS yalnız dar alt-gate'tir; local QR trust için issuer/backend gerekmez, file authorization kapıları ayrıdır.

## Sonuç

Direction onayı kaydedildi; PC receiver/result API veya native code bu ADR kaydıyla implemented sayılmaz. Dar prerequisite durumu [handoff](../implementation/implementation-session-handoff.md#pc-commit-proof--dar-prerequisite-sınırı) içinde tutulur.
