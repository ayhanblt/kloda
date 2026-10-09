# Kloda — Evidence retention ve public kaynak kurtarma

## Korunan sonuç ve kayıp kaynak ayrımı

ADR0003/0004/0007/0008 kararları ve [sanitized native evidence](poc-native-verification-evidence.md) kaydı korunuyor. Rust17, historical native52, sonraki TLS25/pair+host8 sonuçları **historical-runtime** olarak kalır; raw archive kaybı bu kayıtları silmez veya yeni runtime proof üretmez. [Sanitized JSON](evidence/poc-native-verification-summary.json) rerun/independent attestation değildir. Source/lock/ABI/driver olmadan aynı deneyin reproduksiyonu veya kesin native execution spec hazır sayılamaz;36 authority hedefi not-executed kalır.

**Current identity/trust scope:** [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) current first trust'ı backend-independent QR LAN olarak seçer; Matrix/SAS/SDK/store/homeserver/upstream/fork current prerequisite değildir. [ADR0012](../decisions/0012-kloda-owned-p256-device-identity.md) P-256 identity/local pin için korunur. Retained sonuç/hash'ler historical Matrix scope'udur, QR/P-256/hardware/session proof değildir; old corpus recovery/rebuild yeni blocker olmaz. Initial QR PC canonical SPKI actual TLS P-256 key ile eşittir; exact protocol bytes/HMAC/exporter/transcript/lifecycle ve minimum native davranış [KLODA-QR-PAIR-V1 sözleşmesinde](qr-pairing-v1-protocol.md) frozen. Actual native API/ABI/adoption/integration unverified, implementation not executed; [QR roadmap](../implementation/qr-pairing-implementation-roadmap.md) execution/kanıt sırasıdır. Offline local trust file enrollment/step-up/scope/capability yaratmaz; required continuity kaybı fresh QR trust + ayrı gerekli online authorization ister. Dar Android signer CLOSED/PASS ve kalan platform/LAN/authority gates [production kaydında](production-gates.md) ayrıdır; historical recovery timeline/results aşağıda değişmeden korunur.

## Kayıp timeline — observed, reported, inference

| Gözlenen olay | UTC | Türkiye UTC+3 |
|---|---|---|
| Archive creation başarı çıktısı:191 regular member,2,314,459byte, beklenenSHA256 | 2026-10-03 20:49:27.946 | 2026-10-03 23:49:27.946 |
| Archive source/report integrity kontrolü başarı çıktısı | 2026-10-03 20:49:59.924 | 2026-10-03 23:49:59.924 |
| Konsolidatör actual archive SHA256'ı yeniden okudu; beklenen digest eşleşti | 2026-10-04 18:59:00.540 | 2026-10-04 21:59:00.540 |
| Preparation sırasında historical workspace erişilemedi | 2026-10-05; exact silinme zamanı değil | 2026-10-05 |

Original public path: `/tmp/kloda-same-key-tls.hjUS9L/proof.tar.gz`. SHA256: `db9e72a619acb9b619f0912978d4c8fdd45de0ffab9d5e4d35d3f3c873adc241`. SDK patch SHA256: `5b56cfe81e41fd7f31e32d20ffa829f7315b8b3699e979379f0255b46b45cc87`.

Provenance: main session tool creation/integrity observations ile `PocEvidenceConsolidator` actual hash observation; [kalıcı archival kayıt](poc-native-verification-evidence.md#kaynak-haritası-hash-ve-arşivsel-sınır). Ana oturum ve konsolidatör incelenen tool çağrılarında archive/workspace deletion komutu bulunmadı; bu sistem-geneli filesystem audit değildir. Kullanıcı gece bilgisayarın kapandığını bildirdi (**reported**). `/tmp` cleanup olası açıklamadır (**inference**), exact neden/aktör/silinme saati kanıtlanmadı. Raw arşiv kalıcı konuma alınmamıştı; hash dosya içeriğini geri üretmez.

## Proje-local retention sözleşmesi

Kullanıcı canonical local alan olarak `.local-evidence/` seçti; `.gitignore` içindeki `/.local-evidence/` kuralı Git dışında tutar. Arşivler `.local-evidence/archives/`, recovery inventory `.local-evidence/recovery-inventory.json` altında olur. Mevcut tracked sanitized JSON/ADR belgeleri yerinde kalır. Local artifact yolları clone'da mevcut varsayılmaz; docs bunları link yerine code path olarak gösterir.

`/tmp` sadece disposable build scratch'tır; incelenmiş public deliverable tek kopyası orada bırakılmaz. Yeni source/evidence deliverable kalıcı alana taşınıp archive/member hash ve memory restore doğrulaması yapılmadan tamamlanmış teslim/scratch cleanup yok. Content-addressed `<sha256>.tar.gz` ve `<sha256>.manifest.json` üzerine overwrite yapılmaz; mevcut aynıbyte no-op, farklıbyte conflict'tir. Absolute/.. path, symlink/hardlink/device member reddedilir; whole archive extraction yapılmaz.

Public source/manifests/locks/scripts/patch, sanitized report/exit/assertion trace ve hash inventory izinlidir. Private DB/WAL/SHM/key/epoch/credential/full env/raw session transcript/device serial/özel endpoint/keystore/native binary tutulmaz; bu kurtarmada screenshot kopyalanmaz. Historical transcript komutları execute edilmez; yalnız public literal text reconstruction memory içinde yapılabilir. Eksik/redacted/truncated/ambiguous/mismatched source executable evidence olarak yayımlanmaz.

Manifest evidenceClass: `historical-byte-verified`, `recovered-source-only` veya `new-experiment`; yeni recovery container eski archive hash'ini devralmaz. Asıl container SHA eşleşmeden historicalArchiveRecovered true olmaz; member count veya kısmi source hash eşleşmesi yeterli değildir. Üye bazında exact-byte proof ile archive/runtime proof ayrı tutulur.

**Bağımsız yedek yok:** kullanıcı yalnız proje-local/Git-dışı saklama seçti. Manifest backup: status `not-configured`, locationLabel/verifiedAtUtc null. Bu alan `/tmp` lifecycle'ına bağımlı değildir; disk arızası, proje silinmesi veya `git clean -fdx` gibi ignored-file cleanup'a dayanıklı değildir. Git clone/commit/push bu artifact'ları korumaz. Hiçbir klasör silinmez garantisi vermez; local cleanup bu alanı korumalıdır.

## Kurtarma ve ilerleme sınıflaması

Recovery inventory her public dosyayı `byte-verified`, `complete-unverified`, `incomplete` veya `missing` olarak sınıflar; expected/observed hash yoksa null. Yalnız retained independently observed hash'e eşleşen tam public dosya recovery arşivine girer. Hiç verified üye yoksa boş arşiv oluşturulmaz. Yeni reconstruction source eski runtime'ın yeniden çalıştırıldığı anlamına gelmez.

Exact native source/caller prerequisites tamamlanmazsa1A blocked kalır; tarihi sonuçlar korunur, yeni public-only rebuild ayrı self-contained plan ve execution onayı ister. Yeni hash/run/evidence eski proof.tar.gz yerine geçirilmez. Bu recovery işi native code/replay/build/device/cloud veya JWT/KMS runtime çalıştırmaz; ES256 provisional ve productionReady:false kalır.

## Gerçek kurtarma sonucu — 2026-10-05

Raw main/consolidator ve sekiz source-producing transcript hedefli parse edildi; rendered JSONL'nin768-character clipping'i kaynak yokluğu sayılmadı. SDK patch'in34 numbered satırı ve final LF yeniden kuruldu: **1,342byte**, historical independently observed SHA256 `5b56cfe81e41fd7f31e32d20ffa829f7315b8b3699e979379f0255b46b45cc87` birebir eşleşti. Bu **byte-verified public source recovery**'dir; signer/TLS/authority suite rerun değildir.

`.local-evidence/recovery-inventory.json` **84 candidate/artifact row** tutar: **1 byte-verified,57 complete-unverified,23 incomplete,3 missing**. Native-base ve TLS revision adayları aynı inventory'dedir;84 row, original191 archive member veya84 final source dosyası kurtarıldı demek değildir. Complete literal/ordered-edit candidate'ların independently retained final source-hash karşılığı yok; native base currentTLS source yerine geçirilmedi. Partial read, unretained Cargo/package locks, final source-hash manifest, binary-hash metadata ve eksik public report/trace byte'ları execution readiness sağlamaz. Unverified/incomplete candidate body'leri arşive alınmadı; yalnız inventory metadata tutuldu.

Immutable recovery paketi yalnız doğrulanmış `sdk-byte-signer.patch` üyesini taşır:

- `.local-evidence/archives/627f60d55f2a4ad194e8874051fcc96aa6387e2231daea07e7ee54a6e3a1ea44.tar.gz` — **734byte**, SHA256 dosya adıyla eşleşti.
- Aynı hash adıyla `.manifest.json`: `evidenceClass:recovered-source-only`; archive/member/restore doğrulaması true; `backup.status:not-configured`.
- `historicalArchiveRecovered:false`, `nativeExecutionSpecReady:false`. Yeni container SHA256 eski `db9e…` archive kimliğini devralmaz. Old archive/member list/source-hash corpus tamamlanmadı.

Gerçek disk paketinde hash/member/type kontrolü ve temiz memory restore patch byte'larını birebir döndürdü. Single-byte archive mutation→digest rejection; `../`, absolute ve symlink member→unsafe-member rejection; missing expected hash ve truncated patch→byte-verified eligibility rejection. Negatif kontroller throwaway memory fixture'dır, historical/native runtime sonucu değildir. Whole archive extraction, private state veya screenshots kopyası yok.

**Sonuç:** tarihsel karar/sonuç korunuyor; exact native source hâlâ eksik,1A blocked. Bilinen archive/source-hash/lock/caller prerequisite'leri orijinal public kopya/yedekten gelirse hash-first inceleme sürdürülebilir. Başka kopya yoksa yeni public-only native feasibility rebuild için ayrı self-contained plan ve execution izni gerekir; yeni source/hash/run eski proof diye sunulmaz. Bu teslim yeni deney/rebuild başlatmadı.

**Sonraki kullanıcı kararı:** [ADR0009](../decisions/0009-evidence-gated-incremental-implementation.md) ile toplu native rebuild ilerleyen sürece bırakıldı. Mevcut ADR/kanıtlarla prerequisite-ready implementation dilimleri başlayabilir; eksik yalnız bağımlı işte, gerekiyorsa koddan önce çözülür. Bu karar recovered-source sınıflarını,1A blocker'ını veya runtime/physical gate'leri değiştirmez. Yeni session başlangıcı: [implementation handoff](../implementation/implementation-session-handoff.md).

## Teslim doğrulaması

Yazım sonrası docs-only smoke dört kalıcı belgede **51 relative-link occurrence** ve **1 heading anchor** hedefini doğruladı; canonical acceptance matrix ile preparation ledger'ın **36 unique exact ID** ve not-executed/unexercised sınıfları eşleşti. Stored inventory84 unique row ve izinli status/hash alanlarını koruyor; full archive/native execution readiness false.

Gerçek `git check-ignore -v --no-index` inventory/archive/manifest yollarını root `/.local-evidence/` kuralına çözdü; `git ls-files -- .local-evidence` boş döndü. Archive/member SHA ve memory restore ile dört unsafe/tamper rejection ve iki source-eligibility rejection yukarıda gerçekten gözlendi. Source/SDK/native build/lint/test, eski suite replay, hizmet/device/cloud veya Git commit/push çalıştırılmadı. Bu kontroller evidence storage/recovery smoke'udur; runtime authority/security gate closure değildir.

İki ayrı read-only review yapıldı: artifact/classification review maddi bulgu bildirmedi; authority review preparation hand-off'taki stale “patch bytes recovered değil” ifadesini buldu. İfade ve combined table güncellendi: yalnız SDK patch byte-verified recovered, remaining native corpus hâlâ blocked. Son docs/ledger/artifact consistency smoke geçti. Review binary/native suite'i tekrar çalıştırmadı; gerçek SHA/restore/rejection kanıtı parent'ın yukarıdaki recovery smoke'udur.
