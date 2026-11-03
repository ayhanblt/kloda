# Step18–20 checkpoint (Claude, worktree `worktree-step18-20`) — 31 Ekim 2026

Kullanıcı 31.10.2026'da 18/19/20'yi Claude'a verdi; Codex 16a'da (sonra 16b/c, 17)
devam eder. Bu dal `origin/main` 50ae92e'den ayrıldı; CURRENT.md birleştirmede güncellenir.

## Kararlar

- Çalışma ayrı worktree/branch'te; birleştirmeyi kullanıcı onaylar.
- 18 sırası: A grubu önce (Nextcloud → CloudMe → Kolab Now). B grubu OAuth
  (Dropbox/Drive/OneDrive/Yandex) kullanıcının geliştirici kayıtlarını bekler;
  C grubu (GCS/MEGA/Box) ayrı karar.
- B grubu kayıtları (1.11, public client ID'ler; secret yok/istenmez):
  Dropbox app key `5435jnh71fcmfck` (App folder);
  Drive iOS `169708313293-8ddls2ekh492ba9tfsb3ovllq25u6cqr.apps.googleusercontent.com`;
  Drive Android `169708313293-ra0u8gcc0pkgeb2squjpgfejhqqoe044.apps.googleusercontent.com`
  (debug SHA-1 `5E:8F:16:…:F6:25`, herkese açık RN şablon anahtarı — yalnız test; yayın
  anahtarı/Play imzası eklenmeli, release şu an debug imzalı); Google consent Testing'de,
  marka doğrulaması yayına kaldı. OneDrive client ID `dcd6301f-639d-4289-80d0-620f376fab71`.
  Yandex ClientID `c50f110fd8ab48debcabb20f8b1474f0` (yalnız Android platformu; iOS Team ID
  bekliyor; mobil redirect belgeden doğrulanacak). Kullanıcı "şimdilik bekle" dedi; B
  entegrasyonu başlamadı.
- [ADR0027](../decisions/0027-multiple-dav-based-cloud-destinations.md) onaylı: çoklu
  DAV hedefi, kalıcı eski WebDAV kimliği, hedef başına kasa, Login Flow v2, limit 8,
  `backup_destination.kind` için DAV+`smb` tek ortak migration (ayrı dilim).
- 19: ücretsiz kişisel Apple takımı; Live Activity yalnız uygulama içi güncelleme, push yok.
- 19 (31.10): SwiftUI native istisnası onaylı (Live Activity UI yalnız SwiftUI); widget extension
  `apps/mobile/plugins` altında Expo config-plugins ile kendi eklentimiz, yeni bağımlılık yok;
  Duraklat/Devam ilk sürümde (iOS 17+ LiveActivityIntent, mevcut yetki yoluna bağlı; iOS 16'da yok);
  kilit ekranında yalnız hedef türü, yüzde ve öğe sayısı — cihaz/sunucu ve dosya adları yok.
- SMB (31.10): `smb_enabled` şimdilik kalır; ADR0027'ye not düşüldü.
- 20: şimdilik yalnız altyapı (kalıcı görsel yakalama script'i, regresyon iskeleti).
- [Fixture onayı](cloud18-fixture-approval-2026-10-31.md): resmî Nextcloud imajı,
  ayrı `KlodaCloud18` AVD ve `Kloda-Cloud18-Disposable` simulator.

## Tamamlanan dilim — 18A/1

Nextcloud Login Flow v2 + hedef başına kasa, Android ve iOS; gerçek Nextcloud 31.0.14
fixture'ına karşı PASS. [Protokol kanıtı](evidence/cloud18-nextcloud-2026-10-31/fixture-protocol-2026-10-31.json),
[native kanıt](evidence/cloud18-nextcloud-2026-10-31/native-login-custody-2026-10-31.json).
Ürün akışı, kuyruk, UI ve migration yok; Nextcloud "çalışıyor" sayılmaz.

Çalıştırma: `python3 -I tools/nextcloud-fixture.py start`, sonra
`python3 -I tools/test-android-nextcloud.py` (emulator-5590 `KlodaCloud18`) ve
`python3 -I tools/test-ios-nextcloud.py <Kloda-Cloud18-Disposable UDID>`.

## Tamamlanan dilim 18A/2 — ortak `backup_destination.kind` migration

Kullanıcı onayı 31.10 (Codex koordinasyonu: Claude tek sahip; Codex tabloya dokunmaz,
SMB `smb_enabled` geçici; SMB'nin bu tabloya bağlanması ayrı kullanıcı kararı).
`AndroidWebDavJournal` / `IosWebDavJournal` açılışta eski CHECK'i görürse tek transaction'da
tabloyu `('pc','webdav','nextcloud','cloudme','kolab-now','smb')` ile yeniden kurar; satırlar
birebir korunur, hata olursa tamamen geri alınır. Kontrol yazma kilidi altında tekrarlanır.
`setEnabled` bilerek `pc`/`webdav` ile sınırlı kalır (kuyruk dilimi açar).
`SQLiteOpenHelper` sürümü (Codex alanı) değişmedi.

- iOS host: `python3 -I tools/test-ios-destination-migration.py` PASS (Swift 5; Swift 6
  mevcut `IosWebDavPublication.swift` yüzünden derlenmiyor, bu dilimle ilgisiz).
- iOS regresyon: `python3 -I tools/test-ios-webdav-journal.py` PASS.
- Android: `python3 -I tools/test-android-destination-migration.py` (scope
  `cloud18-destination` + `webdav-journal`) PASS, `KlodaCloud18`.
- [Kanıt](evidence/cloud18-nextcloud-2026-10-31/destination-migration-2026-10-31.json).
  Kurulu uygulamanın gerçek yükseltmesi NOT_RUN.
- Bilinen sınır: daha yeni bir sürümün eklediği türü içeren tabloyu eski sürüm açarsa
  yeniden kurma reddedilir ve journal açılmaz (güvenli duruş; sürüm düşürme desteklenmiyor).

## Dilim 18A/4a — DAV hedef köprüsü (ekran bağlanmadı)

Kullanıcı kararı 1.11: 18A/3 ve ekran, Codex'in commit edilmemiş WebDAV kuyruğu ve Hedefler ekranı/App.tsx
değişiklikleriyle çakıştığı için önce çakışmayan kısım; Android'de `androidx.browser:browser:1.9.0`
(Apache-2.0, expo-dev-menu'nün zaten çözdüğü sürüm, minCompileSdk 36) eklendi.
- Native `KlodaCloud` modülü (iOS `KlodaCloudModule.swift`, Android `KlodaCloudModule.kt`, iki platformda kayıtlı):
  `destinations`, `signInNextcloud(server, folder)`, `cancelSignIn`, `removeDestination(targetId)`.
  Giriş: iOS ephemeral `ASWebAuthenticationSession`, Android Custom Tab; onay gelene kadar poll; sayfa kapatılırsa
  (iOS) veya iptalde poll durur. Hedef başına kasaya yazılır; aynı hedef varsa `destination_exists` ve yeni uygulama
  parolası best effort iptal edilir; 8 sınırı önce kontrol edilir. Kaydetmek etkinleştirmek değildir (ADR0023);
  kuyruk 18A/3'e kadar bu hedefleri kullanmaz. Kaldırma: Nextcloud ise parola iptali best effort, sonra kasa silinir;
  özgün WebDAV kaydı burada kaldırılamaz (`not_found`). Listede parola yok.
- JS: `shared/api/cloud-destinations.ts` (katı doğrulama), `features/cloud-destination/model/use-cloud-destinations.ts`;
  TR/EN/DE `transfer.errors`: `nextcloud_login`, `nextcloud_server_mismatch`, `nextcloud_login_expired`,
  `destination_limit`, `destination_exists`.
- Kontroller: jest 27 dosya / 178 test, tsc, eslint PASS; pod install + iOS Simulator derlemesi PASS (modül
  `ExpoModulesProvider`'da); Android `:app:assembleDebug` (arm64) ve `:my-module:lintDebug` PASS
  (`react-native-worklets` lint analizi, bu dilimle ilgisiz bir lint aracı çökmesi yüzünden hariç tutuldu).
- NOT_RUN: köprünün çalışırken denenmesi (ekran yok), gerçek Nextcloud'a uygulamadan giriş. Aynı ajan review;
  bulunan tek sorun (Android'de tarayıcı yoksa kodsuz hata) düzeltildi.
- Kalan 18A/4b: Hedefler ekranına bağlama, Codex commit ettikten sonra.

## Dilim 18A/5 — uygulama parolası iptali

Kaldırmada iptal 18A/4a'da. Ek olarak sunucu uyuşmazlığında (poll yanıtındaki `server` girilenden farklı) verilen
uygulama parolası, yalnız girilen sunucuda best effort iptal edilir, diğer adrese hiç gönderilmez (iOS ve Android
`AndroidNextcloudLogin`/`IosNextcloudLogin`). `tools/test-ios-nextcloud.py` gerçek fixture'a karşı PASS (regresyon);
uyuşmazlıkta iptal uçtan uca test edilmedi (sunucunun farklı `server` döndürmesi gerekir). Android: derleme + lint
PASS; `KlodaCloud18` AVD 2026-11-01'de kullanıcı onayıyla mevcut API35 google_apis arm64 imajından yeniden
oluşturuldu (indirme yok); `test-android-nextcloud.py` (emulator-5590) PASS `cloud18-owned-nextcloud` (regresyon).

## Dilim 18A/6 — Kolab Now adaptörü, CloudMe engelli

2026-11-01 anonim PROPFIND (kimlik bilgisi yok): `https://webdav.cloudme.com/` yalnız `Digest … algorithm=MD5`
sunar → ADR0027 §6 gereği CloudMe görünür biçimde engelli (`blockedProviders`), ekleme yolu yok, auth düşürme yok.
`https://apps.kolabnow.com/files` (Kolab Now KB'deki belgelenmiş adres) `Basic realm="sabre/dav"` sunar.
`KlodaCloud.addKolabNow(username, password, folder)` iOS/Android: uç nokta sabit (kullanıcı girmez), provider
`kolab-now`, ön planda; ortak `store()` (doğrulama, `destination_exists`, kasa sınırı) Nextcloud ile paylaşılır.
Kaydetme etkinleştirme değildir. JS: `validateCredentials`, `cloudDestinations.addKolabNow`, hook `addKolabNow`.
Kontroller: jest 27/180, tsc, eslint, iOS Simulator derlemesi, Android `:my-module` derleme + lint PASS.
Açık: kayıtta sunucu doğrulaması yok (yanlış parola 18A/3 kuyruğunda `webdav_auth` olur); kökün `/files` mi
`/files/Files` mi olduğu, koşullu oluşturma ve `Overwrite: F` MOVE gerçek hesapla doğrulanmadı — Kolab Now ADR0027
gereği ayrı onaylı hesap testi geçene kadar "çalışıyor" sayılmaz. Lovable `provider-page` `server` alanı 4b'de
sabit uç noktayla uzlaştırılacak. Aynı-ajan inceleme; bağımsız değil.

## 18 kapanış (1.11)

- Kurulu uygulama yükseltmesi iOS PASS: eski derleme (`/private/tmp/kloda-smb-product-ios-build`, eski CHECK)
  `Kloda-Cloud18-Disposable`'da günlüğü oluşturdu, satır eklendi, yeni derleme üzerine kuruldu; tablo 6 türe
  yeniden kuruldu, satır korundu, `integrity_check` ok. Android NOT_RUN: elde tek eski APK (29.10) güncel JS ile
  uyuşmuyor, günlük açılmadı; geçiş `cloud18-destination` instrumentation ile kapsanıyor.
  [Kanıt](evidence/cloud18-nextcloud-2026-10-31/installed-upgrade-2026-11-01.json),
  [köprü/Kolab kanıtı](evidence/cloud18-nextcloud-2026-10-31/bridge-kolab-2026-11-01.json).
- Aynı-ajan review bulguları düzeltildi: Android'de hedef kaldırma ağ yokken `AndroidNextcloudLogin` kurucusu
  yüzünden engelleniyordu (ADR0027 best effort) → iptal `runCatching`; kayıt hatasında iptal açık giriş nesnesiyle;
  iOS `slots()` geçersiz `dav.*` hesabını yok sayar (Android ile aynı). Sonra: Android modül derleme+lint,
  iOS derleme, iOS/Android Nextcloud fixture testleri PASS. Bağımsız review yapılmadı.
- 18 açık kalanlar: 18A/3 ve 4b (Codex commit'ini bekliyor), Kolab Now hesap testi (izin), B/C grupları.

## Dilim 18B/1 — Dropbox girişi ve kasa (2.11, ekran bağlanmadı)

- [ADR0028](../decisions/0028-oauth-cloud-destinations.md) onaylı (2.11): kod+PKCE sistem tarayıcısı, hedef başına
  yenileme jetonu kasası, yalnız uygulama klasörü, DAV+OAuth ortak limit 8, kaldırmada yerel kasa her durumda silinir.
- iOS: `IosOAuthVault` (Keychain servisi `<bundle>.oauth.native.v1`, hesap `oauth.<targetId>`, yalnız ekleme),
  `IosDropboxLogin` (ASWebAuthenticationSession, `db-5435jnh71fcmfck://oauth`, state+S256, hücresel/yönlendirme/çerez yok).
- Android: `AndroidOAuthVault` (Keystore AES-GCM, `kloda-oauth-<targetId>.v1`), `AndroidDropboxLogin` (Custom Tabs),
  `KlodaOAuthRedirectActivity` (yönlendirmeyi alır, uygulamayı öne getirir; sekme kapatılırsa iptal).
- JS: `cloudDestinations.signInDropbox(folder)`, hook `signInDropbox`; `username` = Dropbox account ID (görüntü).
- Yükleme yok: 18A/3 kuyruğu ve 4 yeni `backup_destination` türü için ayrı migration bekliyor.
- Kontroller: Jest 27/182, tsc, eslint, iOS derleme, Android derleme+lint PASS; Dropbox yönlendirme kaydı kimliksiz
  yoklamayla doğrulandı. iOS gerçek hesap (kullanıcı izni ve kendi girişi, 2.11): `tools/test-ios-dropbox.py`
  PASS — PKCE değişimi, Keychain, yenileme, iptal sonrası yenileme reddi, kasa silme; jeton kaydedilmedi.
  Android gerçek hesap (aynı gün): `tools/test-android-dropbox.py` PASS — Custom Tab, yönlendirme aktivitesi, PKCE,
  Keystore, yenileme, iptal. Modül/JS köprüsü çalışırken ve Android sekme-kapatma iptali NOT_RUN.
  [Kanıt](evidence/cloud18-nextcloud-2026-10-31/dropbox-signin-2026-11-02.json). Bağımsız review yok.

## Dilim 18B/2 — OneDrive + ortak OAuth kodu (2.11, ekran bağlanmadı)

- Dropbox'a özel giriş kodu sağlayıcı ayarlı `IosOAuthLogin`/`AndroidOAuthLogin` oldu; JS `signInOAuth(provider, folder)`,
  hata kodu `oauth_login`. OneDrive: Entra `common`, `offline_access User.Read Files.ReadWrite.AppFolder`, hesap kimliği
  Graph `/me`; Microsoft public client iptali sunmuyor → kaldırmada yalnız yerel kasa silinir (ADR0028 §6).
  Android redirect `msauth://com.kloda.app/<debug hash>` — yayın anahtarı ayrı kayıt ister.
- Bulunan hata: Microsoft `…://auth/` (sonda `/`) ile dönüyor; geri dönüş kontrolü birebir yol karşılaştırıyordu →
  iki platformda sondaki `/` yok sayılır (tanı modu jeton saklamadan buldu).
- Gerçek hesap (kullanıcı kendi girişi): OneDrive ve Dropbox (ortak koda geçişten sonra yeniden) iOS ve Android'de PASS;
  betikler `tools/test-ios-oauth.py <UDID> <provider>`, `tools/test-android-oauth.py <provider>` (eski `*-dropbox.py`
  adları bunlarla değişti). [Kanıt](evidence/cloud18-nextcloud-2026-10-31/onedrive-signin-2026-11-02.json).
- Açık: OneDrive yenileme jetonu her yenilemede döner; yükleme adaptörü yeni jetonu kasaya yazmalı (kasa şu an yalnız
  ekleme). Modül/JS köprüsü çalışırken ve Android sekme-kapatma iptali NOT_RUN. Bağımsız review yok.

## Dilim 18B/3 — Yandex Disk (2.11, ekran bağlanmadı)

- Ortak OAuth koduna `yandex`: redirect `yxc50f…://authorize` (kullanıcı Web services platformuna ekledi), kapsam Yandex
  kaydından (uygulama klasörü), hesap kimliği `login.yandex.ru/info`. İptal secret ister → yalnız yerel silme.
- Yenileme secret olmadan reddedildi (gerçek test). Kullanıcı kararı: Yandex'in uzun ömürlü erişim jetonu bitiş tarihiyle
  kasada (ADR0028 §2 istisnası); süre dolunca `oauth_expired`, yeniden giriş. Bitiş tarihi ekranda 4b'de gösterilecek.
- Gerçek hesap iOS ve Android PASS; Dropbox/OneDrive çevrimdışı kontrolleri yeniden PASS.
  [Kanıt](evidence/cloud18-nextcloud-2026-10-31/yandex-signin-2026-11-02.json). Bağımsız review yok.

## Dilim 18B/4 — Google Drive (2.11, ekran bağlanmadı)

- iOS: ortak OAuth kodu, `drive.file`, hesap kimliği Drive `about` permissionId, iptal Google revoke.
- Android: `play-services-auth:22.0.0` (Android SDK License); izni Play services tutar, kasada token yok,
  yalnız hesap kimliği + hesap adı (kullanıcı kararı, ADR0028 §2 notu). İptal 15 sn sınırlı (§6).
- Kullanıcı Cloud projesinde Drive API'yi açtı ve test paketi `com.kloda.sync.test` için ayrı Android istemcisi ekledi.
- Gerçek hesap iOS PASS (iptal dahil); Android PASS (izin, kimlik, sessiz token, kasa silme). Android iptali
  Play services 24.23.35'te cevap vermedi → AÇIK; izin kullanıcının Google hesabında kalabilir.
  [Kanıt](evidence/cloud18-nextcloud-2026-10-31/google-drive-signin-2026-11-02.json). Bağımsız review yok.
- B grubu oturum açma dilimleri tamam (Dropbox, OneDrive, Yandex, Drive). Açık: modül/JS çalışma testi,
  release imza kayıtları, OneDrive refresh dönüşü kalıcılığı, Android sekme kapama iptali, yükleme adaptörleri.

## Dilim 19/1 — iOS Live Activity (derlendi, çalışırken doğrulanmadı)

Kendi Expo eklentisi (`apps/mobile/plugins/with-live-activity.cjs`) widget extension'ı,
renkleri (`tokens.ts`), TR/EN/DE metinleri, Lucide ikonları ve Inter'i prebuild'de üretir.
Native `IosLiveActivity` ana sayfa durum kurallarını (`home-status.ts`) aynen izler; yalnız
uygulama süreci çalışırken günceller, push yok. Duraklat: kilit açtırıp mevcut Pause yolu.
Devam: Kloda'yı açar, mevcut ön plan kontrolünden sonra çalışır.
`python3 -I tools/test-ios-live-activity.py` PASS; prebuild + Simulator derlemesi PASS.
[Kanıt](evidence/step19-live-activity-2026-10-31/build-and-mapping-2026-10-31.json).
Açık: gerçek bir çalıştırmayla kilit ekranında görünüm, düğmelerin uçtan uca testi,
görsel/a11y karşılaştırması, fiziksel cihaz imzası (21).
Birleştirme notu: `KlodaPairingModule.swift` ve `expo-module.config.json` Codex'le ortak dosyalar.

Simulator'da gerçek yedeklemeyle deneme (2026-11-01,
[kanıt](evidence/step19-live-activity-2026-10-31/simulator-runtime-2026-11-01.json)):
- Önkoşul düzeltmesi (kullanıcı onayı 1.11): Hermes'te `crypto` yok; `webdav.ts`,
  `use-webdav-review.ts`, `use-webdav-restore.ts` içinde `crypto.randomUUID()` →
  `expo-modules-core` `uuid.v4()`. Codex kopyası birebir aynıydı, test etkilenmedi; tsc,
  eslint, jest 168/168 PASS; bağlantı testi sunucuda uçtan uca geçti. Codex'in
  `use-smb-items.ts` dosyasında aynı çağrı var, dokunulmadı (birleştirmede not).
- Simulator derlemesi ad-hoc imzalı olmalı (`CODE_SIGN_IDENTITY=-`), yoksa `webdav_storage`.
- PASS: kilit ekranı (Yedekleniyor/Bekleniyor/Duraklatıldı), Dynamic Island kompakt ve
  genişletilmiş, Kloda'yı aç. Gizlilik: yalnız "WebDAV".
- KISMİ: Duraklat intent'i çalışıp otomatik duraklatmayı yazıyor; ama iş elle başlatılmıştı ve
  uygulama ön plandan çıkınca iOS onu zaten kesmişti, çalışan işi durdurma gösterilmedi.
- KISMİ: Devam et Kloda'yı açıyor, iş sürmüyor. Neden kanıtlandı (journal kopyası): son iş elle
  başlatılmış, `waiting/os_interrupted`. `IosWebDavQueue.status()` bunu `paused` gösteriyor;
  ana sayfa ve Live Activity "Devam et" sunuyor, bu da yalnız otomatik işleri yeniden planlayan
  `resumeAutomatic` yolunu çağırıyor. Elle başlatılmış işi hiçbir şey yeniden başlatmıyor.
  Önceden var olan, ortak koddaki sorun.
- Düzeltme (kullanıcı kararı 1.11: yeniden başlatsın): `home-page.tsx` otomatik duraklatma yoksa ve
  WebDAV işi duraklatılmış elle başlatılmış işse "Devam et" → `transfer.run()`, değilse eskisi gibi
  `resumeAutomatic()`; ikisi asla birlikte değil (birlikte denendiğinde otomatik iş `backup_busy` ile
  `needs_attention` oldu). `IosLiveActivityStatus` böyle bir işi `waiting` gösterir, kilit ekranı yalnız
  "Kloda'yı aç" sunar. jest 171/171, tsc, eslint, Live Activity Swift 5/6 PASS. Düzeltilmiş sürüm
  Simulator'da yeniden denenmedi; native değişiklik derlenip kilit ekranında görülmedi.
- Yeniden derlenip Simulator'da denendi: "Devam et" PASS (kesilmiş elle iş → yeni elle iş, sunucuda
  65 GET 200, `backup_busy` yok). Kilit ekranı: bitmiş kart listede kaldığı için yeni kart hiç
  açılmıyordu; `IosLiveActivity.tick()` yalnız active/stale kartları sayacak ve bitmişleri kapatacak
  şekilde düzeltildi. PASS: sonraki otomatik işte yeni kart açıldı ve "İnceleme gerekiyor" ile kapandı.
  Elle duraklatılmış iş kartı ("Bekleniyor", yalnız Kloda'yı aç) kilit ekranında gösterilemedi; her ön
  plana geçişte vadesi gelen otomatik iş kartı önce bitiriyor. Yalnız host testiyle kapsanıyor.
- "Son çalışma tamamlandı" kartı PASS. Bulunan uyuşmazlık: kart WebDAV `automaticError`'ı okumuyordu
  (ana sayfa "Yedekleme durdu" derken kart "tamamlandı"); `IosLiveActivity.observe()` artık
  `webDavStatus` ile aynı alanı ekliyor. Host testi + derleme PASS, çalışırken görülmedi. Bu
  Simulator'da `automatic_unavailable` hiç kalkmadığı için durum `error` ve yeni kart açılmaz.
- Betikli görsel yakalama (step 20 altyapısının ilk parçası): `python3 -I tools/capture-ios-live-activity.py
  <UDID> <çıktı>`; gerçek `KlodaLockCard`'ı Simulator'da ImageRenderer ile her durum için çizer (prebuild
  çıktısı gerekir). 12 sayfa PASS: TR/EN/DE × koyu, açık, xxxL, AX2 → `evidence/step19-live-activity-2026-10-31/captures/`.
  Bulgular: metinler tam, xxxL'ye kadar kesilme yok; açık temada kart bilerek koyu (`tile`); AX2'de düğme
  ve uzun başlıklar kesiliyordu, ikonlar sabit; bayat kartta başlık "Bekleniyor" ama Duraklat kalıyor.
  Sistem kilit ekranı çerçevesi ve Dynamic Island çizilmez.
- Kullanıcı kararı 1.11 (alt alta diz): erişilebilirlik boyutlarında düğmeler alt alta, başlık 2 satıra
  kadar sarar. Yeniden yakalamada AX2'de düğme ve başlık kesilmiyor; mapping Swift 5/6 ve Simulator
  derlemesi PASS. Kalan: AX2'de işlem sayısı satırı hâlâ kesiliyor, ikonlar sabit; kart 160 pt sınırını
  aşıyor, gerçek kilit ekranında nasıl kırpıldığı görülmedi.
- Bayat kart artık Duraklat sunmuyor (kullanıcı 1.11). Simulator provası (otomatik duraklatma + yeniden başlatma ile
  Simulator'ın `automatic_unavailable` hatası aşıldı): Duraklatıldı kartı, kilit ekranından Devam et ve AX2/AX5 kilit
  ekranı PASS (sistem yazı boyutunu sınırlıyor, kesilme yok). Gösterilemedi: çalışan işi Duraklat (iş çok kısa),
  elle duraklatılmış kart, iOS 16 (runtime yok). Uygulama içi bulgular (AX'te sekme çubuğu ve açılış başlığı) değişmedi.
- [Fiziksel test listesi](step19-physical-test-checklist.md): sunucu olarak kullanıcının kendi sunucusu (karar 1.11);
  imza bundle id'si test öncesi çözülmeli; çalışan işi Duraklat için lldb ile BG görevi tetikleme adımları.
- Fiziksel cihaza (21) kalan: kilit ekranından çalışan işi Duraklat, kilit ekranından Devam et, VoiceOver.
- Birleştirme notu: `begin()` yarışını Codex 1.11'de kendi checkout'unda kapattı (WebDAV ve SMB:
  available → journal plan/run → start, elle başlatmayla aynı `IosWebDavContext.synchronized`
  (NSRecursiveLock) altında; meşgul kuyruk erteleme yolunda). Bu dalda yok; birleştirmede Codex sürümü
  alınır. 18'in çoklu DAV kuyruğu bu kilit kapsamını korumalı. Gerçek düğme yarışı yeniden oynatılmadı.
- Yapılmadı: açık tema, EN/DE, VoiceOver, fiziksel cihaz.

## Dilim 18A/3 — hedef başına DAV kuyruğu (2.11, commit `67701e7`, push yok)

- Kullanıcı kararı 2.11: hedefler **sırayla** (tek yükleme, mevcut kilit ve `begin()` sırası); 18A/3'te yalnız DAV
  (özgün WebDAV, Nextcloud, Kolab Now) yükler; OAuth türleri tabloya eklendi ama yükleyicileri (18B/5) gelene kadar
  etkinleştirilemez. ADR0027 "Decided with approval" bölümüne yazıldı.
- Hedef başına plan (`webdav_target_plan`; eski tek satır bir kez taşınır), her etkin hedef kendi plan/run/retry'ını
  tutar, vadesi en erken olan çalışır. `setDestinationEnabled` (yalnız ön planda), özetlerde `enabled`, kaldırmada
  satır kapatılır + plan silinir + yalnız o hedefin işi durur. JS `setEnabled`, TR/EN/DE `destination_unsupported`.
- Android uçtan uca (gerçek JobService, owned HTTPS fixture): yanlış parolalı hedef tek başına `webdav_auth`, diğeri
  tamamlandı, özgün planı değişmedi — PASS. iOS: derleme, migration/plan, journal, admission PASS; iOS çalışma
  zamanı çok hedefli koşu NOT_RUN (HTTPS düzeneği Codex'in WebDAV15 simülatörüne bağlı).
  [Kanıt](evidence/cloud18-nextcloud-2026-10-31/multi-target-queue-2026-11-02.json). Bağımsız review yok.
- Bilinen sınır: özgün WebDAV yeniden yapılandırılınca ortak bağlam yenilenir, diğer DAV hedefleri yeniden planlanır.
- Açık: ekran (4b: hedef listesi, aç/kapa, elle başlat, durum), eklenen hedeften geri yükleme, iOS çalışma zamanı testi.

## Dilim 18A/4b — Bağlantılar hedef listesi (3.11, commit edilmedi)

- `ConnectionsPage`: tek saved WebDAV kartı yerine `cloud-destination-list.tsx` (özgün WebDAV kartı + eklenen DAV/OAuth
  kartları: durum, aç/kapa yalnız Nextcloud/Kolab Now, OAuth için `destination_unsupported`, onaylı kaldırma).
  Native `destinations()` özgün WebDAV'ı `provider: webdav` ile ilk satırda döndürür; listede süzülür (yakalamada
  bulunan kusur). Ekleme: `cloud-provider-page.tsx` (Nextcloud giriş, Kolab Now kullanıcı/parola, OAuth klasör);
  App.tsx bu sağlayıcıları ProviderPage yerine buraya yönlendirir, kayıttan sonra Bağlantılar'a döner. Hook `lastAdded`.
- TR/EN/DE: `ui.conn.{remove,removeTitle,removeBody,cancel,addHint,browserHint,signIn,save,waiting,cancelSignIn}`,
  `transfer.errors.{oauth_login,oauth_expired}`.
- Kullanıcı kararı 3.11: hedef başına elle başlatma ve çalışma durumu için köprü yok; köprüsüz ilerlendi, açık iş.
- Kontroller: Jest tam 34/200 PASS (süzme düzeltmesinden önce), sonra etkilenen 26 test, tsc, ESLint PASS. Android
  arm64 debug (AVD KlodaCloud18) ve iOS Simulator debug (Kloda-Cloud18-Disposable) yeniden derlendi/kuruldu; TR koyu
  yakalama: [manifest](evidence/cloud18-connections-ui-2026-11-03/manifest.json). Codex simülatörlerine dokunulmadı.
- NOT_RUN: EN/DE/açık tema/büyük yazı/VoiceOver yakalaması; eklenmiş hedefli kartların native görüntüsü (yalnız Jest);
  gerçek giriş; kalıcı yakalama betiği (dokunma araçla yapıldı). Aynı ajan review; bağımsız review yok.

## Kararlar ve dilim 18A/4c — hedef başına elle başlatma (3.11, commit yok)

- Kullanıcı kararları 3.11 (ADR0027/0028'e yazıldı): CloudMe V1'de görünür engelli kalır (Digest). Box, MEGA, GCS V1 dışı
  (GCS için kullanıcı bucket'ı/HMAC yolu konuşuldu, V1 için reddedildi, ADR taslağı yok). **Kolab Now V1 dışı ve uygulamada
  görünmez**: `hiddenProviders` ekleme listesinden süzer; native ekleme yolu ve testleri kodda kalır.
- Köprü: `KlodaCloud.runDestination(targetId)` (yalnız ön planda) ve `pauseDestination(targetId)` iOS/Android; yalnız
  eklenmiş DAV hedefi (`not_found`/`destination_unsupported`), mevcut `start(target:)`/`pauseTarget` — aynı kilit ve
  `begin()` sırası. Özetlere eklenmiş DAV hedefinin son koşusu `run` olarak eklendi (`runView`, `status()` ile ortak
  `view`). JS: sıkı ayrıştırıcı `run.state`/`errorCode` kabul eder; hook `runNow`/`pause`, koşu sürerken 2 sn'de bir
  yenileme; kart: durum satırı, hata, etkinse Şimdi yedekle/Duraklat (mevcut `statusUi.*`, `destinations.states.*`
  anahtarları; yeni i18n yok).
- Kontroller: tsc, ESLint, Jest tam 34/203 PASS; Android arm64 debug ve iOS Simulator debug derlemesi PASS.
- NOT_RUN: köprünün çalışırken denenmesi. iOS Simulator'da metin yapıştırma çalışmadı (sunucu/giriş girilemedi);
  Android çalışma zamanı denenmedi. EN/DE/açık yakalama: dil/tema uygulama ayarından geldiği için simctl argümanları
  etkisiz; betikli yakalamaya kaldı. Aynı ajan review; bağımsız review yok.
- [iOS fiziksel test dosyası](ios-physical-tests/ios-fiziksel-testi-claude-step18-20.md): 19 listesi + 18 cihaz adımları
  birleştirildi (Codex aynı klasöre ekler); eski step19 listesi yönlendirme oldu.

## Dilim 18B/5 — Dropbox yükleme adaptörü (3.11, commit yok)

- Kapsam kullanıcı onayı 3.11 (aşağıda madde 8). Ortak taşıma arayüzü: iOS `IosBackupTransport`, Android
  `AndroidBackupTransport` (inspect/upload/move). Publisher artık `target` + dışarıdan taşıma alır; yayın durum makinesi
  (`IosWebDavPublication`/`AndroidWebDavPublication`) değişmedi. Hedef türü `IosCloudTarget`/`AndroidCloudTarget`
  (DAV profili veya OAuth profili) bağlam/kuyruk/koordinatörden geçer; `stored()` OAuth yuvasını yalnız adaptörü olan
  sağlayıcı (`oauthKinds = dropbox`) için döndürür. Journal `queueKinds = davKinds + dropbox` (tablo CHECK değişmedi).
- `IosDropboxTransport`/`AndroidDropboxTransport`: `files/upload` ve `upload_session` commit'i `mode=add`,
  `autorename=false`, `strict_conflict=true`, `mute=true`; `move_v2` `autorename=false`; `inspect` dosyayı indirip
  kendi SHA-256/boyutumuzla karşılaştırır (409 `path/not_found` → missing). 150 MiB üstü: 8 MiB parçalı oturum, oturum
  kimliği yalnız bellekte (tek çalışma). `Dropbox-API-Arg` ASCII dışı ve 0x7F `\uXXXX`. Erişim jetonu bellekte, 401'de bir
  kez yenile+yeniden gönder; yenileme reddi → `oauth_expired`. Hata eşlemesi: 409 conflict → `conflict`,
  insufficient_space → `disk_full`, malformed/disallowed/too_long → `backup_path_rejected`, 429/5xx → `connection_unavailable`.
- HTTP: `IosWebDavClient.exchange` / `AndroidWebDavClient.call` REST yolu (gövde okunur; mutasyonun alınan durumu ACK
  kalır, okuma kesilirse hata). DAV yolu davranışı aynı.
- Aç/kapa, elle başlatma, kaldırmada `forget` (satır kapatılır, plan silinir) Dropbox için açıldı; OneDrive/Yandex/Drive
  `destination_unsupported` kalır. JS `enableableProviders` + `dropbox`; yeni i18n yok.
- Kontroller: Jest etkilenen 5 dosya 23 test, tsc, ESLint PASS; Android `:my-module` Kotlin + androidTest derleme,
  `lintDebug` (worklets lint çökmesi hariç, 18A/4a ile aynı) PASS; iOS `pod install` + Simulator debug derleme
  (`Kloda-Cloud18-Disposable`) PASS. `python3 -I tools/test-android-dropbox-wiring.py` (KlodaCloud18, ağsız) PASS:
  arg kaçışı, hata eşlemesi, kaydet≠etkinleştir, açma/journal satırı/stored/taşıma türü, OneDrive reddi, forget.
- Gerçek hesap (kullanıcı onayı ve kendi girişi, 3.11): `python3 -I tools/test-android-dropbox-live.py` (KlodaCloud18) PASS —
  küçük Unicode adlı dosya create-only upload + `move_v2` + kendi SHA-256; var olan dosyaya upload/move reddi, asıl dosya
  değişmedi, yayın `conflict`'te durdu; 157 286 401 bayt `upload_session` tek çalışmada + SHA-256; iptal ve kasa silme.
  Test dosyaları kullanıcının Dropbox'ında `Apps/Kloda/Kloda/test18b5-*` altında kaldı. Not: Android seçicisinde ürün
  uygulaması ve test paketi aynı yönlendirmeyi dinler → `com.kloda.sync.test`, "Just once". Daha uzun uzak dosya boyut
  sınırında `review_required` verir (DAV ile aynı). [Kanıt](evidence/cloud18-nextcloud-2026-10-31/dropbox-upload-2026-11-03.json).
- Commit `b0980e8` (3.11, push yok). İlk NOT_RUN listesindeki iOS çalışma zamanı ve kuyruk koşusu aşağıda kapandı.
- NOT_RUN (Android): etkin Dropbox hedefinin JobService üzerinden koşusu; 18A/3 DAV çok hedefli regresyon (`test-android-dav-targets.py`: HTTPS fixture özel anahtarları Codex'in
  `/tmp/kloda-step15` alanında silinmiş; yeniden üretmek Codex fixture'ını ve izlenen CA dosyasını değiştirirdi).
- Bilinen sınırlar: eklenen hedeflerde inceleme (review) ekranı yok (özgün WebDAV'a bağlı, önceden de böyle); Dropbox
  yolları büyük/küçük harf duyarsız → yalnız harf farkı olan iki yol `conflict` olur. Aynı ajan review; bağımsız yok.

## Dilim 18B/5 kapanış — iOS gerçek hesap + kuyruk (3.11, commit yok)

- Kloda-Cloud18-Disposable, ürün uygulaması (Debug arm64, ad-hoc). Kullanıcı kendi Dropbox girişini yaptı. PASS: kaydet
  ≠ etkinleştir; etkinleştirme; kaynak seçilince **otomatik** kuyruk koşusu (`automatic=1`) Dropbox'a 2 dosya (Unicode
  adlı 63 B + 2 MB) yükledi, journal SHA-256'ları kaynakla birebir; ardından elle `runDestination` koşusu bitti, yeni
  yükleme yok. [Kanıt](evidence/cloud18-nextcloud-2026-10-31/dropbox-ios-queue-2026-11-03.json). Uzak dosyalar
  kullanıcının Dropbox'ında `Apps/<app>/test/<sourceId>/` altında kaldı.
- Bulunan ve düzeltilen iki hata: (1) `use-cloud-destinations.ts` yalnız `Error.message` okuyordu; Expo iOS kodu
  `error.code`'a koyuyor, mesaj `"x: x (at ExpoModulesCore/Promise.swift:65)"` → Bağlantılar ekranında 18A/4b'den beri
  her hata `outcome_unknown` görünüyordu. `sftpErrorCode` kalıbına çevrildi + Jest testi. Aynı `cause.message` kalıbı
  `use-webdav-backup.ts` ve benzerlerinde de var (dokunulmadı, açık iş). (2) `KlodaSyncRuntimeModule.pickDirectory`
  `currentViewController()`'ı ana iş parçacığı dışında çağırıp MainActor assert ile çöküyordu (Klasör seç → uygulama
  kapanıyor); `@MainActor` yardımcıya taşındı. **Codex ortak dosyası — birleştirmede not.**
- Kontroller: Jest etkilenen 4 dosya/15 test, tsc, ESLint PASS; iOS Simulator derlemesi PASS (uyarı yok).
  NOT_RUN: Android'de JS hata eşlemesinin çalışırken denenmesi; iOS'ta >150 MiB `upload_session`; EN/DE/a11y.
- Not: Metro'yu `CI=1` ile başlatmak dosya izlemeyi kapatır, uygulama eski JS'i alır; `--dev-client`'la başlatın.
  Dropbox kartı hesap adı yerine ham `dbid:` gösteriyor (görsel açık iş).

## Dilim 18B/5r — hedef başına geri yükleme (3.11, commit yok)

- Kullanıcı kararı 3.11: Lovable Yedekler ekranında hedef seçimi yok; seçim Bağlantılar'daki her etkin hedef kartında
  **"Yedekleri gör"** ile yapılır, mevcut Yedekler ekranı o hedefe bağlı açılır (yeni bileşen yok).
- Taşıma: `IosBackupTransport`/`AndroidBackupTransport.download(path, job, receive)`; DAV GET, Dropbox
  `files/download` (yalnız 200 gövdesi sink'e gider → 401 sonrası yeniden gönderim boş sink'le başlar; Android
  `call`/`restReply` `receive` alır). Doğrulama değişmedi: kendi SHA-256/boyut, `hash_mismatch`.
- `IosWebDavDownload`/`AndroidWebDavDownload` `IosCloudTarget`/`AndroidCloudTarget` alır. Files/Photos restore kontrolü
  `IosWebDavVault.read() == profile` / `AndroidWebDavVault.read() != profile` yerine
  `stored(kind, targetId) == destination` (+ mevcut bağlam bağlaması). `restoreTarget(target)`: `""` = özgün WebDAV
  (eski davranış), aksi halde 32 baytlık targetId + `added()`; yoksa `not_found`. Etkinlik restore için şart değil
  (önceki gibi); düğme yalnız etkin kartta.
- Köprü: `webDavBackups(after, target)`, `restoreWebDavFile/Photos(id, request, target)` iOS+Android; JS
  `webDavBackups.list/restoreFile/restorePhotos(..., target = '')`, dönen `targetId` istenenle eşleşmeli.
  `useWebDavRestore(target)` hata kodunu `sftpErrorCode` ile okur (Expo iOS `error.code`). `ActivityPage target`:
  yalnız o hedefin paneli; geri → Bağlantılar. i18n `ui.conn.viewBackups` TR/EN/DE. androidTest çağrıları güncellendi.
- Kontroller: Jest 34/206, tsc, ESLint PASS; Android `:app:assembleDebug` + `:my-module:assembleDebugAndroidTest`
  (arm64) PASS; iOS Simulator Debug arm64 PASS. iOS çalışma zamanı (Kloda-Cloud18-Disposable, kullanıcının mevcut Dropbox
  girişi): kart → Yedekleri gör → liste (2 öğe) → iki dosya yeni boş klasöre geri yüklendi; host `shasum` kaynakla
  birebir. [Kanıt](evidence/cloud18-nextcloud-2026-10-31/dropbox-ios-restore-2026-11-03.json).
- NOT_RUN: Android çalışma zamanı geri yükleme; Dropbox'tan Photos; eklenmiş Nextcloud hedefinden geri yükleme;
  geri yükleme sırasında ayar değişimi / `oauth_expired`; EN/DE/a11y yakalaması. Aynı ajan review; bağımsız yok.
- Görsel/metin açık işi (yeni i18n onayı gerekir): hedefe bağlı ekranda başlıklar özgün WebDAV/PC metinleri
  ("PC'deki tamamlanmış yedekleriniz", "WebDAV yedeklerim", "PC yedeği tamamlandı · Yerel şifreli LAN"); alt sekme
  "Durum" seçili görünür.

## Sıradaki (kullanıcı 1.11: açık işler sırayla)

19, bu listede 18'in 1.–3. maddelerinden sonra gelmesine rağmen önce yapıldı; sıra artık buna göre.

1. 18A/3 — yapıldı (yukarıdaki dilim). Kuyruk/runner/schedule/review/sidecar'ı `targetId` ile çoklu hedefe açmak (ADR0027 §4); Codex'in
   `begin()` kilit kapsamı korunur. Codex'e hizalama isteği: [codex-request-18A3](codex-request-18A3-2026-11-02.md);
   Codex yanıtı main'de `docs/implementation/codex-response-18A3-2026-11-02.md` (kuyruk sözleşmesi, kilit sırası, ekran yeri).
   Hizalama 2.11 (kullanıcı onayı): dal işi `a8b3cd5`, yerel main (`3efe578`, `053d411`, push yok) `0a32874` ile
   birleştirildi. Çakışmalar (manifest, `expo-module.config.json`, instrumentation scope listesi) iki tarafın
   eklemeleri korunarak çözüldü. Sonrası: Jest 33/196, tsc, ESLint, Android compile+lint+androidTest APK, iOS arm64
   Simulator derlemesi PASS (worktree'de `sync-core` dist yeniden derlendi; genel simülatör hedefi x86_64 pairing
   dilimi olmadığı için link etmez). OAuth türlerinin `backup_destination` migration'ı 18A/3 ile yapıldı.
2. 18A/4 — Expo köprüsü (4a tamam) + Lovable bağlantı ekranı (4b ve 4c yapıldı 3.11, yukarıda; açık: köprünün Android çalışma testi, EN/DE/a11y yakalama).
   Kapsam (Codex yanıtı): `pages/connections/ui/connections-page.tsx` içinde tek kayıtlı WebDAV kartının yerine
   hedef listesi; ekleme (Nextcloud giriş, Kolab Now, OAuth girişleri), aç/kapa (`setEnabled`, OAuth kapalı +
   `destination_unsupported`), kaldırma, durum; i18n önekleri `ui.conn.*`, `ui.providers.*`; Lovable
   `provider-page` eşlemesi, 300 satır sınırı. Elle başlatma/durum için native köprü yoksa genişleme olarak
   kullanıcıya sorulur. Doğrulama: Jest/tsc/ESLint + bir Android ve bir iOS Simulator toplu ekran yakalaması;
   18A/3 testleri tekrarlanmaz.
3. 18A/5 — uygulama parolası iptali: tamam (Android fixture testi 1.11'de PASS).
4. 18A/6 — yapıldı: Kolab Now adaptörü (3.11 kararıyla V1 dışı, gizli), CloudMe Digest-only olduğu için engelli.
5. 18 kapanış — yapıldı (iOS yükseltme PASS, Android NOT_RUN; kanıt; aynı ajan review + düzeltmeler).
6. 20 — regresyon iskeleti (görsel yakalama betiği hazır).
7. Kullanıcıda bekleyenler: fiziksel test (gate 21, en sonda, [liste](ios-physical-tests/ios-fiziksel-testi-claude-step18-20.md)), iOS 16
   runtime kararı, birleştirme. C grubu kararı verildi (3.11, V1 dışı). B grubu kayıtları alındı (yukarıda); 18B/1 Dropbox yapıldı.
8. 18B/5 Dropbox — tamam (Android gerçek hesap 3.11; iOS gerçek hesap + otomatik/elle kuyruk koşusu 3.11); açık: Android JobService koşusu. OAuth yükleme adaptörleri (ADR0028 §5). Kullanıcı onayı 3.11: önce yalnız Dropbox
   iOS+Android; DAV yayın durum makinesi korunur, publisher taşıma katmanını dışarıdan alır (inspect/upload/move +
   ileride download); Dropbox `mode=add`/`autorename=false`, `move_v2`, doğrulama kendi SHA-256'mızla; 150 MB üstü
   `upload_session` yalnız tek çalışma içinde (çalışmalar arası devam ayrı migration, sonraya); aç/kapa ve elle başlatma
   yalnız Dropbox için açılır. Gerçek hesap testi kullanıcının girişi ve ayrı onayıyla.
9. 18B/5r — hedef başına geri yükleme (onaylı sıra): taşıma katmanına `download`; `IosWebDavVault.read() == profile`
   bağı yerine hedef bazlı kontrol (eklenen Nextcloud hedeflerini de açar); Dropbox dosya+fotoğraf; hedef seçimi
   kararı 3.11 verildi (kartta "Yedekleri gör"). **Yapıldı 3.11** (yukarıda; Android çalışma zamanı ve metin açık işi kaldı).
10. [ADR0029 taslağı](../decisions/0029-cloud-restore-catalog-and-recovery-key.md) (3.11, onaylanmadı): yeni cihazda
   geri yükleme için kurtarma kodu + HMAC'li create-only katalog + salt geri yükleme yetkili içe aktarılmış fiş.
   ADR sonundaki 4 açık soru kullanıcıda; dilimler 29/1–4, 18B/5r'den sonra.

Açık: sunucu uyuşmazlığında iptal uçtan uca test edilmedi;
bağımsız (başka ajan) review yapılmadı, yalnız aynı ajanın ayrı review geçişi.
