# First vertical slice — implementation status

Bu belge ilk WebDAV vertical slice'ın uygulanmış temelini, eksik kabulünü ve session'da sonradan kabul edilen PC-first yönü ayrı tutar. **İlk slice ve PC-first ürün tamamlanmadı; production-ready değil.** [ADR0001](../decisions/0001-mobile-sync-behavior-and-framework-constraints.md)/[ADR0002](../decisions/0002-first-vertical-slice-scope.md) tarihsel baseline; [ADR0005](../decisions/0005-computer-first-files-and-photos-backup.md) güncel ürün, [ADR0006](../decisions/0006-account-mfa-and-recovery-policy.md) account, [ADR0003](../decisions/0003-secure-pairing-and-offline-authorization.md)/[ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md)/[ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md) pairing/authority sınırlarıdır. Bu docs-only konsolidasyon aşağıdaki temeli yeniden build/audit/smoke etmedi; önceki durum kaydını korur.

## Güncel implementation başlangıcı — 2026-10-05

Ayhan, [ADR0009](../decisions/0009-evidence-gated-incremental-implementation.md) çalışma sırasını kabul etti: kayıp native deneyin toplu rebuild'i ertelenir; prerequisite'leri yeterli küçük implementation dilimleri ilerler. Implementation biçimini belirleyen eksik source/API/ABI/feasibility ilgili dilimden önce çözülür. İlk bağımsız PC-first prerequisite dilimi uygulandı: desktop Files seçiminde hâlen seçili aynı exact path'in source ID'si transaction içinde korunur; duplicate path tek kayıt olur ve renderer journal'daki ID'yi alır. DB reopen/reselect sonrası receipt/pending bağlantıları korunur. Bu WebDAV sender'ı PC receiver yapmaz; kaynak kaldırıp yeniden ekleme/move/alias veya SHA256 migration garantisi değildir. [Handoff](implementation-session-handoff.md#ilk-dilim--source-identity-continuity) scope, smoke ve kanıt sınırlarını tutar: derlenmiş runtime+gerçek SQLite/native picker fixture smoke, desktop lint/build ve4 dosya/9 test pass; gerçek Electron UI/peer/native/physical not-executed. Ayrı review tamamlandı; production gate'ler açık.

İkinci bağımsız prerequisite dilimi: WebDAV receipt/pending kayıtları exact endpoint+targetPath+username hedefiyle scope edilir; runtime run başında hedefi yakalar, sonraki config değişimi aktif işlemi başka hedefe taşımaz. Transactional legacy migration eski kayıtları unknown hedefte korur; legacy receipt otomatik benimsenmez, unscoped pending network öncesi açık hata verir. Yerel HTTPS gerçek PUT/MOVE byte-smoke5 senaryoda pass; desktop lint/build ve4 dosya/12 test pass, ayrı review tamamlandı. [Handoff](implementation-session-handoff.md#ikinci-dilim--receiptpending-target-isolation) komut/sonuç/legacy ve fixture sınırlarını tutar. Physical store/account identity, SHA256 snapshot/migration ve authenticated final reconciliation açık; PC receiver/production hazır değil.

Üçüncü prerequisite dilimi: desktop kaynak revision'ı gerçek SHA256 byte hash'i oldu. Tek dosya private staging,64KiB bounded copy/hash, initial-size limit ve source dev/ino/size/mtimeNs/ctimeNs kontrolü vardır; hash/upload aynı staging byte'larını kullanır, normal skip/success/error cleanup yapılır. Eski metadata receipt otomatik benimsenmez; değişen kaynak mevcut finalde no-overwrite conflict olarak kalır. Desktop lint/build,5 dosya/17 test ve6 localhost HTTPS/filesystem smoke senaryosu pass; ayrı review tamamlandı. [Handoff](implementation-session-handoff.md#üçüncü-implementation-dilimi--sha256-source-snapshot) failure→fix ve staging/256MiB-host/fixture sınırlarını tutar. Remote receipt revalidation, belirsiz final reconciliation, orphan/crash/quota/physical kapsamları hâlâ açık; FolderSync arşivi kullanılmadı.

Dördüncü prerequisite dilimi: own target/source/path/SHA256 receipt'i tek başına skip üretmez; authenticated200 GET whole-body hash eşitliği gerekir.404 yeniden upload'a gider; corrupt occupied final no-overwrite conflict,206/403/network/truncated stream gerçek hatadır. Unknown/legacy final benimsenmez; zayıf ETag kullanılmaz. Desktop lint/build,6 dosya/26 test ve5 gerçek HTTPS/reopen/error smoke senaryosu pass; ayrı review tamamlandı. [Handoff](implementation-session-handoff.md#dördüncü-implementation-dilimi--own-receipt-remote-byte-revalidation) bandwidth/TOCTOU/fixture sınırlarını tutar. Pending phase/restart recovery ve production/native/physical kapsamları açık.

Beşinci prerequisite dilimi: phase-bound acknowledged recovery uygulandı. Pending row replace edilmez, exact target+temp+phase CAS kullanılır;201 ack+remote final hash sonrası receipt ve pending clear atomiktir. Unknown/aşamasız row network'ten önce bloklanır; unacknowledged temp hiçbir hash sonucu ile otomatik silinmez/benimsenmez. Verified own temp+missing final safely MOVE F ile devam eder; ack kaydı olan restart yalnız GET+settlement yapar. Desktop lint/build,6 dosya/34 test ve14 HTTPS/reopen/fault/path smoke pass. [Handoff](implementation-session-handoff.md#beşinci-implementation-dilimi--phase-bound-acknowledged-recovery) standard WebDAV causal-proof sınırını ve karar gereken ambiguous recovery'yi tutar. Önceki dilim paragrafları kendi tarihsel checkpoint'lerini anlatır; remote byte revalidation ve acknowledged recovery artık implemented, unknown/ambiguous/native/physical/product gate'leri açık.

Sonraki receiver yönü [ADR0010](../decisions/0010-operation-bound-pc-commit-proof.md) ile kabul: PC local operation-bound durable proof, **authenticated PC result query** taşıyıcısı; current sender metadata/phase authority değil. [Dar prerequisite inventory](implementation-session-handoff.md#pc-commit-proof--dar-prerequisite-sınırı) peer-context/result/fence source/API/ABI'nin managed code'da olmadığını gösterir; native spec veya receiver ready sayılmaz. Exact query contract ve ilgili native/platform/envelope/schema/fence seçimleri before-code gate'idir.

[Native prerequisite](native-peer-session-prerequisite.md), [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md), [frozen KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) ve [future-only QR roadmap](qr-pairing-implementation-roadmap.md) current checkpoint'tir: backend-independent local QR trust, ADR0012 P-256 identity/durable peer pins; trust file grant değildir. Matrix/SAS/key-binding/upstream/fork task/gate yok. Protocol bytes/minimum native behavioral contract frozen; QR pairing not implemented, actual platform API/ABI/adoption/integration unverified. Android device-local signer **CLOSED/PASS (SM-S921B/API36)** narrow alt-gate; actual Android↔PC LAN/final app/native bridge/iOS physical/desktop/background/authority gates açık.

## Uygulanan temel

- `@kloda/sync-core`, 12/24 saatlik yerel zaman programı, erişim ve OS yeniden-deneme bütçeleri ile scheduled-run durum sözleşmelerini içerir.
- Electron tarafında SQLite journal, Electron `safeStorage` tabanlı credential vault, dar preload/IPC sınırı, WebDAV yazma doğrulaması ve recursive transfer runtime'ı vardır. Kaynak seçici birden çok klasör seçebilir; mevcut transfer runtime'ı seçilmiş kaynakların tümünü sırayla işler. Upload final hedefe doğrudan yazılmaz: hedef-scope journal önce temp remote path ile `pending_upload` kaydı oluşturur, dosya temp path'e `PUT` edilir ve final path'e `MOVE Overwrite:F` sonrası hedef-scope receipt yazılır. Mevcut pre-run cleanup yalnız yakalanmış hedefin pending kayıtlarını işler; bu belirsiz final commit için authenticated reconciliation değildir. Legacy unscoped pending korunur ve transferi açık hatayla durdurur; actual final validation/startup recovery hâlâ eksiktir.
- Electron renderer, kaynak → program → WebDAV kimlik bilgisi/testi → backup activity temel akışını uygular. Manual Sync Now ve desktop scheduler aynı runtime üzerinden single-flight çalışır; aynı anda ikinci upload açılmaz. Masaüstü otomatik çalışma, süreç yaşadığı sürece bir sonraki yerel zaman için `setTimeout` kurar; uyku sonrası kaçırılmış occurrence'u bir kez çalıştırır ve ikinci bir active run başlatmaz. OS düzeyinde dayanıklı scheduler değildir.
- Mobile, Expo development build ve yerel Expo Swift/Kotlin modülünü kullanır. Android schedule ayarını `SharedPreferences`a, iOS `UserDefaults`a yazar. Android Files seçimi kalıcı `content://` URI izni alır; iOS Files seçimi security-scoped bookmark saklar. Her seçilen Files kaynağı, native tercihte UUID, tür, görünen ad ve opaque erişim referansıyla ayrı kayıt olarak tutulur; kaldırılırken Android URI izni de bırakılır. Uygulama açılışında native katman Android'de kalıcı okuma iznini, iOS'ta bookmark'ın stale olmadığını ve security-scoped erişimi doğrular; erişimi kaybolan klasör UI'da tekrar seçilmesi gereken kaynak olarak gösterilir. `prepareSourceJobs` Android'de SAF ağacını, iOS'ta Files bookmark ve Photos kaynaklarını tarayarak platform SQLite `queued_source_file` tablosuna kaynak başına ayrı queued kayıtlar yazar; kaynak kaldırılınca kendi queue kayıtları da silinir.
- Mobile UI Files klasörü, iOS Photos kütüphanesi ve kullanıcı albümü seçimi, seçili kaynakların kaldırılması, schedule ayarı ve WebDAV HTTPS adresi/kimlik bilgisi formunu gösterir. iOS Photos erişimi `.readWrite` yetkisiyle istenir; sınırlı Photos yetkisi geçerli bir kaynak olarak korunur. Secret olmayan WebDAV endpoint, hedef klasör ve kullanıcı adı native tercihe yazılır; parola yalnız `expo-secure-store` ile platformun şifreli depolamasına yazılır. Test, hedef klasöre `PROPFIND`, benzersiz probe dizinine `MKCOL`, geçici dosyaya `PUT`, `MOVE` no-overwrite, `GET` read-back ve yalnız probe kaynaklarının `DELETE` temizliğini yürütür. Gerçek dosya aktarımı, Sync Now ve aktivite ekranı henüz mobile'da uygulanmamıştır.
- Mobile NativeWind v4, Electron renderer Tailwind CSS kullanır. Her iki uygulamada i18next/react-i18next ile `tr`, `en`, `de` locale dosyaları bulunur; JSX/TSX kullanıcı metni `t(id)` ile çözülür.

## Henüz uygulanmayan zorunlu işler

1. Mobile queue kayıtlarını gerçek transfer ve receipt/recovery durumlarıyla tamamlamak; gerçek dosya aktarımını ve Sync Now/aktivite ekranını uygulamak.
2. Android/iOS native scheduled execution, OS ertelemesi/iptali sonrası kalıcı run recovery ve iki ayrı retry bütçesini uygulamak.
3. Mobile onboarding'i storage ve backup activity ekranlarıyla tamamlamak; desktop transferini kesinti sonrası devam edebilecek hâle getirmek.
4. Stitch referansına karşı her iki platformun gerçek UI yüzeyini görsel olarak doğrulamak; ardından uçtan uca smoke ve bağımsız review yürütmek.

## Uygulama kısıtları ve açık riskler

- Bu slice yalnız WebDAV HTTPS kimlik doğrulaması, dizin erişimi ve yazma yeteneğini test eder. Başarılı test dış ağ erişimi veya CGNAT/relay kararı anlamına gelmez.
- Mobile WebDAV probe istekleri redirect'i hata olarak ele alır; kimlik bilgisinin başka bir origin'e yönlendirilmesine izin verilmez. Gerçek WebDAV endpoint'inde transport davranışı henüz smoke ile gözlenmemiştir.
- FolderSync yöntemi artık [ADR0005](../decisions/0005-computer-first-files-and-photos-backup.md) SHA-256+kalıcı kayıt yönüdür; yaklaşık8.000 dosya üzerinde migration uygulanmış/kanıtlanmış değil. Nest central control–PC enforcement rolü ADR0004 ile kabul edildi. Tam medya E2EE/key management, remote routing/relay adoption, issuer custody/hosting, release API/minimum compatibility ve AWS premium gate'leri açık.
- Generated iOS `IPHONEOS_DEPLOYMENT_TARGET=16.4` yalnız build ayarıdır. iOS16.4+/Android7+ kullanıcı destek hedefi ADR0001'de kayıtlı; toolchain/release minimum ve eski gerçek cihaz compatibility kanıtı değildir.
- Mobile'da iOS bookmark ve Android URI kaynak kayıtlarında saklanır ve onboarding'de yeniden erişim doğrulanır; ancak bunlar henüz sync journal ile eşlenmiş veya iş kuyruğunda kullanılan bir `BackupSource` değildir.

## Session sonunda kalıcı karar / implementasyon ayrımı

| Konu | Kesinleşen yön | Bugünkü implementasyon / kanıt |
|---|---|---|
| PC-first genel dosya | Normal PC files; advanced WebDAV/SMB; one-way+list/download, optional Files two-way; Photos backup-first | Product PC receiver/account/file-restore/conflict/versioning uygulanmış değil; mevcut WebDAV gönderici ayrı |
| Program | Default opportunistic Live;12/24 yerel saat ve manual Sync Now korunur | Mevcut baseline12/24 temeli default Live üretim yürütmesi kanıtı değil |
| Files/Photos | SHA256 kayıtlı duplicate/migration;30-day trash/versions, iki-copy conflict; kullanıcı restore ve erişilebilir Photos organization ayrı | Kullanıcı arşivi taranmadı; Files/Photos product acceptance not-executed |
| Hesap | Supabase Auth+Postgres, optional TOTP/operation step-up/recovery+support hold | Auth backend/enrollment/MFA/recovery integration yok; source özellikleri live service proof değil |
| Pairing/device identity | Backend-independent QR LAN trust; Kloda hardware-preferred P-256 actual mutual TLS, PC SPKI equality, secret/channel proof, PC approval/durable pins | [V1 bytes/minimum native behavior frozen](../security/qr-pairing-v1-protocol.md) / implementation not executed. Actual API/ABI/native/state/store/ACK recovery integration açık; offline trust account/file grant yaratmaz |
| Capability | LAN exact certificate DER binding + fresh full pinned TLS/SPKI + Kloda mutual session proof; Nest control–PC fence | Backend JWT user session ayrı; signed capability device/PC/scope/expiry authority. Native pin/channel/capability composition ve remote DTLS binding açık; actual admission uygulanmadı |
| Server imzası | **ES256 provisional** | Exact source support var; JWT cross-runtime ve gerçek KMS feasibility **not-executed** |
| Remote | WebRTC/DTLS + signed signaling/fingerprint + Kloda mutual proof; direct P2P mümkünse tercih, Cloudflare TURN relay fallback | Native/provider deployment/signaling/channel-proof/background gate'leri açık; eski direct inconclusive P-256 veya production adoption proof değil |
| Sonraki implementation | ADR0009 incremental sıra; ADR0013 QR roadmap/current checkpoint, ADR0012 identity | Beş sender prerequisite korunur; pairing/PC receiver/auth/fence yok. Matrix feasibility historical/non-actionable; QR protocol/native LAN/persistence required, execution bu docs teslimiyle açılmaz |

## PoC sonucu: baseline completion değildir

| Evre | Gerçek kayıt | Sınır |
|---|---|---|
| Android physical transport |14pass,1direct-connectivity **inconclusive**, `complete:false` | TURN UDP/TLS443 ve LAN payload pass; direct root cause/large direct workload kanıtlanmadı |
| iOS URLSession transport | Simulator **inconclusive**, physical pending, architecture retained | Background daemon/trust/byte-final proof yok; mimari elenmedi |
| Matrix Rust |17pass/0gap/0fail | Host motor proof; native/physical/account/authority değil |
| Native verification | Android emulator26+iOS simulator26=52 | Otomatik native wrapper/storage/diagnostic proof; insan SAS, physical provider/authority değil |
| Same-key TLS | Host8; Android–PC25 ve iOS–PC25 TLS; copied verification26/pair | Patched SDK fixture TLS1.3; production SDK/real-peer-network değil |
| Public certificate inspection | Node22.23.1, iki pair, exit0;88 inspection assertion | DER vs SPKI, public key/recorded peer equality; JWT/admission/renewal testi değil |
| Authority acceptance |36 hedef **not-executed** | Eski52/TLS sayıları authority pass olarak sayılmaz |

Bu PoC satırları eski scope'ta historical sonuçtur; Kloda P-256 hardware identity, SAS↔Kloda-key binding, yeni LAN/DTLS mutual session veya capability admission için pass sayılmaz. TLS/DTLS kanal koruması zorunlu; varsa payload encryption defense-in-depth, yerine geçmez.

Ayrıntı ve public hashes: [transport](../security/poc-transport-evidence.md), [native/TLS](../security/poc-native-verification-evidence.md), [certificate evidence](../security/evidence/certificate-binding-inspection.json). Failure→fix→final ve inconclusive ayrı saklanır; successful TURN cleanup direct payload pass değildir.

## Kalan işlerin takip kapsamı

Tarihsel7 completed /10 open todo checkpoint uygulama completion ölçütü değildir. Bugünkü açık kabul:

1. Native SAF/bookmark/PhotoKit queue'yu real transfer+receipt/recovery'ye bağlama; bütün seçilen kaynaklar, source change ve kesilmiş scan görünür kalmalı.
2. Desktop/mobile temp-upload→MOVE no-overwrite→durable receipt/reconcile; bilinmeyen final adoption/FolderSync overwrite yok. WebDAV finalize PC-peer fence yerine geçmez.
3. Gerçek onboarding/Start Backup/Sync Now/Activity ve kalıcı ilerleme; single-flight/manual-scheduled çakışma; current PC-first scope ayrı implementation planına taşınmalı.
4. Desktop persisted due-time/startup reconciliation/window-close lifecycle; process timer tamamlanmış durable scheduler değildir, yeni OS service/autostart seçilmedi.
5. Mobile gerçek scheduled execution, ayrı5×60s erişim ve5×5min OS hedef bütçeleri; native active-task duplication yok, force-stop/OS ertelemesi sessiz completed değil.
6. Gerçek Stitch UI/erişilebilirlik, WebDAV byte-smoke ve ayrı lint/test/build/review; kaynak tasarım dosyaları readonly.
7. Account/PC receiver/pair/capability/trust/time/scoped publication product integration gate'leri; isolated feasibility/synthetic fixtures bunları kapatmaz.

## physical-device validation required

- iOS16.4/current: gerçek LAN HTTPS/URLSession trust, Files/Photos orijinalleri/izin değişimleri/iCloud resource, staging+temporary-copy budget, background/lock/system termination/relaunch/reboot/first-unlock/force-quit.
- Android API24/current OEM: SAF permission/source queue, gerçek transfer, Doze/worker/foreground OS quota; mevcut API36 transport deneyi eski cihaz veya gerçek6-hour quota proof değildir.
- İki platform: QR scan/invitation, actual mutual P-256 TLS/PC SPKI equality, same-channel secret proof, PC approval/pins/ACK recovery; Secure Enclave/Keystore/StrongBox/TEE lock/unavailable/background ve key/pin/epoch/cert backup/restore continuity. Android device-local signer PASS tek-device alt-gate; iOS physical cihaz yokluğu deferred validation, simulator production proof değil. Required state loss/restore suspicion fresh QR re-trust + gerekli online authorization ister.
- Gerçek12/24 saat+Live yürütme ve iki retry bütçesi; Wi-Fi/cellular explicit opt-in ve packet-level locality, gerçek ayrı-network direct/TURN/ICE behavior.
- Desktop production packaging/Windows TPM/macOS Secure Enclave/Linux veya hardware-absent fallback seçimi; native P-256/session provider APIs, secure backend fail closed, gerçek PC sleep/wake/receiver lifecycle.

Merkezi liste: [production gate / doğrulanmamış varsayımlar](../security/production-gates.md). Physical-required, inconclusive, not-executed ve demonstrated subgate farklı statülerdir. [Session coverage index](session-documentation-index.md) kritik karar/kanıtların kalıcı karşılığını gösterir.
