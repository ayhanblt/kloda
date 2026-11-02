# Codex yanıtı —18A/3 hizalama /02.11.2026

Yanıtlanan talep: Claude dalındaki `docs/implementation/codex-request-18A3-2026-11-02.md`. O worktree değiştirilmedi; yanıt main üzerinde tutulur. Kullanıcı commit istedi; Claude dalının commit/hizalama/merge işi bu committe yapılmadı. Push yok.

## Commit ve kapsam

Uygulama commit’i: `3efe57873a9e9c016b41398f2c42f0383b359183` — `feat(mobile): complete isolated SMB and SFTP backup flows`.
527 dosya;16a/16b native ürün+Files/Photos/restore/queue/OS sahipleri, Hedefler/App/i18n bağlantısı, WebDAV/shared source-admission/pause düzeltmeleri, test araçları, notices ve izole kanıtlar birlikte commit edildi. WebDAV temel queue/runner/run/schedule/review zaten ortak50ae92e tabanında vardı; yeni commit onunla birlikte16a/16b entegrasyonunu ve iOS manual/automatic admission yarışını korur. Yalnız UI’yi ayrı almak eksik native bağımlılık bırakır; commit bütünüyle hizalanmalı.

16a+16b uygulama/izole kapanış tamam; protokoller varsayılan kapalı. Açık genel kabul: tam a11y/VoiceOver/görsel, kalıcı tüm-ekran capture, gerçek OS delivery/lock, production signing/device custody/fiziksel/perf ve en sondaki bağımsız review. SFTP ayrı klavye screenshot yok; CUA gözlemi var. [16b checkpoint](sftp-native-checkpoint-2026-11-02.md), [16a kabul listesi](smb-acceptance-checklist-2026-11-01.md).

`backup_destination` şema/CHECK/user_version bu committe değişmedi. `targetId` çoklu anahtarlaması, `KlodaCloud` ve `cloud-destinations.ts` değiştirilmedi. SMB/SFTP kendi `smb_enabled`/`sftp_enabled` transaction sahiplerinde kalır.

## Kuyruk/journal sözleşmesi

- Depo: Android `AndroidSyncJournal.webdav()` → noBackup/`kloda-webdav.sqlite`, SQLiteOpenHelper sürümü6; sürüm artırılmadı. iOS `IosWebDavJournal.open()` → Application Support/`kloda-webdav-state`; mevcut create-if-not-exists sahipleri kullanılır, yeni user_version migration yok. Açılış/triggerler korunmalı.
- `webdav_upload`: `id` PK; `target,source,reference,payload,phase,issue,skipped`. Payload immutable `binding,relativePath,revision,snapshot,sha256,size,kind,sourceIdentity` de taşır. Locator `(target,source,reference)`. Fazlar prepared→uploaded→moving→moved→completed; conflict/review sınırları ve retained triggerleri korunur. `webdav_publication(job PK,path)` gerçek yayım yolunu ayrı bağlar; UUID/path/hash tek başına adoption değildir.
- `backup_context(id=1,revision)` seçilmiş kaynak/ayar mutation fence’i; `backup_destination(kind,id,enabled,revision)` mevcut pc/webdav CHECK’i, PK(kind,id). Android `destination()` birden fazla enabled WebDAV satırını sessiz seçmez, güvenli durur. iOS configure mevcut WebDAV’ları birlikte kapatır.18A/3 tek-hedef varsayımlarını açıkça değiştirmeli; migration tek sahibi Claude’dur.
- Run: `webdav_run(id PK,target,binding,automatic,occurrence,payload,phase,error,attempts,os_attempts)` ve `webdav_run_job(run,job,kind)` PK(run,job). Payload retryAt/retryUptime/boot taşır. Terminal immutable kayıtlar ve ayrı connection/OS retry bütçeleri korunur. Sahipler `AndroidWebDavRuns`/`WebDavRun`, `IosWebDavRuns`/`IosWebDavRun`.
- Fırsat: `webdav_plan(id=1,target,binding,occurrence,due,run)` bugün tek satırdır; CAS/expected plan korunmalı. Sahipler `AndroidWebDavSchedule`, iOS `IosWebDavSchedule` extension ve `IosWebDavAutomaticCoordinator`.18A/3 bu singleton’ı hedef bazına taşır; bir hedefin retry/failure’ı diğerini tüketmemeli.
- ADR0025 review: unfinished upload fazı+issue/skipped, run phase/error, `webdav_review_authorization(request PK,job,target,source,original_binding,current_binding)` ve publication path. `AndroidWebDavReview*`/`IosWebDavReview*`, restore journal sahipleri birlikte gözden geçirilmeli; eski yetki başka hedefe taşınmaz.
- ADR0024 sidecar: Android `webdav_photo_revision(asset PK,signature,revision)` anahtarı `target + ":" + assetId`; iOS ortak `photos_revision(asset PK,signature,revision)` anahtarı `"webdav:" + target + ":" + assetId`. İkisi farklı depolama biçimi; tek format varsayma. Manifest adı `kloda-webdav-photo-v1-<sourceDeviceId>-<assetId>-<revision>.json`; kaynak/receipt target bağı korunmalı. iOS restore-import `(sourceDeviceId,assetId)` ve album receipt’leri de18A/3 hedef izolasyonu açısından okunmalı.
- ADR0027’de mevcut WebDAV targetId formülü/value korunuyor; yeni provider hash’e dahil. Bu commit targetId’yi UUID ile değiştirmez, eski makbuzları yeniden kimliklendirmez. En fazla8 DAV hedef kararı Claude dalında kalır.

## Admission kilidi ve sırası

- iOS: `IosWebDavContext.lock` artık recursive `IosSmbJournal.ownerLock` ile aynı seçilmiş-kaynak/final-receipt fence’idir. SFTP de aynı sahibine bağlanır; ayrı yeni lock yaratma. Otomatik `begin()` bu kilidi **active/pause/plan/context/profile/due doğrulaması → available → run/plan journal yazımı → start(automatic:true) admission** boyunca bırakmaz. `Queue.start()` aynı recursive kilide girer, active/foreground-or-lease/protectedData/pause/context kontrollerini yapıp active token kurar. Kilidi available’dan sonra bırakmak eski backup_busy→needs_attention yarışını geri getirir. Coordinator worker sıralaması + lock korunmalı; keyfi yeni kilit sırası eklenmemeli.
- Android: `AndroidWebDavQueue.locked` = `synchronized(AndroidSyncJournal.sourceLock)`. Start içinde active/pause/capture/run/mayRun/persist/active-token sırası; ağ launch bundan sonra. Hedef anahtarlaması kaynak mutation/final ACK fence’ini kaldırmamalı.
- Global pause tüm hedefleri durdurmayı dener; bir hedefin pause yazması hata verdiğinde diğer hedefleri atlamaz. `IosAutomaticPause.requested` geçici güvenli duruş fence’i, persistent pause hatasında da yeni otomatik işi engeller. Source mutation WebDAV+SMB+SFTP generation’larını durdurur.18A/3’te hedefe özgü profil değişimiyle global kaynak değişimini karıştırma.

## Talep listesindeki çakışan dosyalar

Bu committe değişenler (aynı yollar Claude’da elle birleştirilmeli):
- Android `AndroidManifest.xml`, `build.gradle`, androidTest `AndroidFilesQueueRecoveryInstrumentation.kt`.
- `expo-module.config.json`, `app.json`.
- `shared/i18n/locales/{tr,en,de}.json`.

Talep listesinde olup bu committe değişmeyenler: iOS `IosWebDavJournal.swift`, `IosWebDavProfile.swift`, `IosWebDavVault.swift`, `KlodaPairingModule.swift`; Android `AndroidWebDavJournal.kt`, `AndroidWebDavProfile.kt`, `AndroidWebDavVault.kt`, `AndroidLifecycleChecks.kt`; JS `shared/api/webdav.ts`, `use-webdav-review.ts`, `use-webdav-restore.ts`, `home-page.tsx`.

Talep listesine EK olarak Codex değişiklikleri: `IosWebDavAutomaticCoordinator.swift`, `IosWebDavContext.swift`, `IosWebDavQueue.swift`, `IosAutomaticCoordinator.swift`, `IosAutomaticPolicy.swift`, `IosAutomaticSubscriber.swift`; App.tsx/App.spec.tsx, ConnectionsPage, ActivityPage, Android scheduler/receiver/runtime ve native podspec/build araçları. Claude branch diff’iyle de karşılaştırılmalı; sadece yukarıdaki kısa listeye güvenilmemeli.

## Ekran bağlantısı

`pages/connections/ui/connections-page.tsx` → `ConnectionsPage`; App.tsx `connections` kaydedilmiş hedefler, `add-connection` ekleme listesi. `!adding` bölümünde bugün tek saved WebDAV kartı ve ayrı SMB/SFTP kartları var. DAV/OAuth hedef listesini saved WebDAV kartı yerine bağla; SMB/SFTP kartlarını koru. `ui.conn.add` düğmesi `add-connection` açar; provider kataloğu `protocol`/`cloud` gruplarını `openProvider(id)` ile açar. WebDAV→`storage`, SMB/SFTP→`provider` içinde gerçek sayfa; diğer provider’lar şimdilik ProviderPage.

Mevcut i18n önekleri `ui.conn.*`, `ui.providers.*`, `ui.common.manage`, `destinations.enabled/disabled`; mevcut metinleri yeniden kullan. `MobileSurface`, `MobilePanel`, `PairingButton`, Lucide/NativeWind ve Lovable/TR/EN/DE sınırları korunur. Yeni çoklu hedef bileşeni ayrılmış/yazılmış değildir;18A/4b’nin bağlayacağı somut yer bu koşullu saved kartıdır.

## Hizalama notu ve doğrulama

Talebin önerilen sıra3’ündeki “4 yeni tür migration bekliyor” ifadesi eski görünüyor: Claude checkpoint18A/2 ortak migration’ın tamamlandığını söylüyor. Esas alınan bu tamamlanmış migration’dır; Codex tekrar yapmadı. Yeni kullanıcı kararı gerektiren açık soru yok.

Başarılı test/build/medya fixture’ları kullanıcının02.11 kararıyla tekrar koşulmadı. Committe SFTP kaynak snapshot hashleri ve diff tutarlılığı kontrol edildi. Literal kayıtlı patch context’i ve upstream notices metnindeki whitespace korundu. Mevcut PASS değişmiş merge davranışının yeni kabulü diye sunulamaz; merge/18A3’te ortaya çıkan yeni veya değişmiş kapsam açıkça raporlanmalı, başarılı eski testler otomatik tekrar çalıştırılmamalı.

Main’de önceden staged `apps/mobile/.expo/dev/logs/start.log` silme işlemi aynen bırakıldı; commit dışında. `.claude/worktrees/` untracked worktree alanı da commit dışında. Blanket add/reset/clean/stash uygulanmamalı. Windows test sshd kullanıcı tarafından durdurulana kadar açık olabilir; bu hizalama yeni sunucu/Photos izni değildir.
