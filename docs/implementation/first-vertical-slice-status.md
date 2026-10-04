# First vertical slice — implementation status

Bu belge ilk WebDAV vertical slice'ın uygulanmış temelini, eksik kabulünü ve session'da sonradan kabul edilen PC-first yönü ayrı tutar. **İlk slice ve PC-first ürün tamamlanmadı; production-ready değil.** [ADR0001](../decisions/0001-mobile-sync-behavior-and-framework-constraints.md)/[ADR0002](../decisions/0002-first-vertical-slice-scope.md) tarihsel baseline; [ADR0005](../decisions/0005-computer-first-files-and-photos-backup.md) güncel ürün, [ADR0006](../decisions/0006-account-mfa-and-recovery-policy.md) account, [ADR0003](../decisions/0003-secure-pairing-and-offline-authorization.md)/[ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md)/[ADR0007](../decisions/0007-matrix-verification-and-device-continuity.md) pairing/authority sınırlarıdır. Bu docs-only konsolidasyon aşağıdaki temeli yeniden build/audit/smoke etmedi; önceki durum kaydını korur.

## Uygulanan temel

- `@kloda/sync-core`, 12/24 saatlik yerel zaman programı, erişim ve OS yeniden-deneme bütçeleri ile scheduled-run durum sözleşmelerini içerir.
- Electron tarafında SQLite journal, Electron `safeStorage` tabanlı credential vault, dar preload/IPC sınırı, WebDAV yazma doğrulaması ve recursive transfer runtime'ı vardır. Kaynak seçici birden çok klasör seçebilir; mevcut transfer runtime'ı seçilmiş kaynakların tümünü sırayla işler. Upload final hedefe doğrudan yazılmaz: journal önce temp remote path ile `pending_upload` kaydı oluşturur, dosya temp path'e `PUT` edilir ve final path'e `MOVE Overwrite:F` sonrası receipt yazılır. Belirsiz `MOVE` sonucu pending kaydı ve temporary nesne korunur; startup reconciliation henüz uygulanmamıştır.
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
| Pairing | Matrix verification-only; Kloda authority; aynı device key; OS-protected software/epoch | Isolated native PoC var; product package/physical pairing ve provider/restore proof yok |
| Capability | Exact certificate DER binding + fresh same-key full mTLS; Nest control–PC fence; key-bound grant/cert-bound token | Platform/TLS/device-key production gate açık; actual native DER/session admission ve authority uygulanmadı |
| Server imzası | **ES256 provisional** | Exact source support var; JWT cross-runtime ve gerçek KMS feasibility **not-executed** |
| Remote | LAN local-only, cellular default-off opt-in; retained WebRTC/ICE/STUN/TURN araştırma adayı | Tunnel tarihsel/reopened preference; remote direct inconclusive, hosted production service/adoption yok |
| Sonraki iş | [İzole issuance/admission feasibility planı](issuance-admission-feasibility-plan.md) hazır | **Execution ayrıca onay bekliyor**; docs onayı deney/ürün coding onayı değil |

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
- İki platform: insan tarafından iki-uç SAS karşılaştırması, same-key signer/provider lock/unavailable/background, reinstall/backup/restore/device transfer, retained epoch+SDK DB loss ve certificate lifecycle.
- Gerçek12/24 saat+Live yürütme ve iki retry bütçesi; Wi-Fi/cellular explicit opt-in ve packet-level locality, gerçek ayrı-network direct/TURN/ICE behavior.
- Desktop production packaging/Windows/Linux/old macOS, secure backend fail closed, gerçek PC sleep/wake/receiver lifecycle.

Merkezi liste: [production gate / doğrulanmamış varsayımlar](../security/production-gates.md). Physical-required, inconclusive, not-executed ve demonstrated subgate farklı statülerdir. [Session coverage index](session-documentation-index.md) kritik karar/kanıtların kalıcı karşılığını gösterir.
