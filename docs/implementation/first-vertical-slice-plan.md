# İlk WebDAV vertical slice — tarihsel implementation planı

**Tarihsel plan snapshot'ı; current runtime veya otomatik execution onayı değil.** İlk kapsam ADR0002, güncel PC-first/Live/Files–Photos yönü ADR0005, current implementation eksikleri [status](first-vertical-slice-status.md), current approval/evidence ayrımı [session index](session-documentation-index.md) içindedir. Aşağıdaki başlangıç kodu gözlemleri, önerilen adapter/API alanları ve Live/migration/versioning dışlamaları ilk WebDAV planının o anki kapsamıdır; güncel ürün politikasını veto etmez ve uygulanmış özellik sayılmaz. Plan aşaması için “çalıştırılmadı” ifadeleri historical plan hazırlığına aittir; sonraki bağımsız PoC'ler ayrı evidence kayıtlarıdır. Bu docs-only iş snapshot'ı yeniden yürütmedi.

# Kloda ilk vertical slice — implementation planı

## Context ve onaylanan kapsam

Uçtan uca akış: **ilk açılış → kaynak seçimi + 12/24 saat ve çalışma saati → storage credentials → WebDAV erişim/yazma testi → Start Backup → tek kaynaklık sync işleri → Backup Activity ve Sync Now**. Mobil Android/iOS ve Electron desktop birlikte tamamlanacak. Otomatik sync yalnız tercih kaydı değil, gerçek OS/native yürütmesidir.

Bu konuşmada Ayhan'ın seçtikleri:
- Mobil ve desktop birlikte teslim.
- Gerçek otomatik çalışma; Sync Now bunun yanında.
- Bağlantı testi bu dilimde **WebDAV erişim ve yazma testi**. WAN/public-IP karşılaştırması yapılmayacak. AGENTS §3 gereksinimi silinmeyecek; test sonucu CGNAT yokluğu veya dış ağ erişim garantisi sayılmayacak.
- Expo development build içinde **yerel Swift/Kotlin Expo modülü** kullanılabilir; framework değişmeyecek.
- Program **cihazın yerel saatini koruyacak**; saat dilimi değiştiğinde sonraki hedef yeniden hesaplanacak.

Migration, medya encryption/key management, relay implementasyonu ve premium AWS bu çalışmanın hiçbir aşamasında uygulanmayacak. Galeri/thumbnail/arama ve NestJS'nin açık olan rolü de bu dilim üzerinden karara bağlanmayacak. OS credential kasası kullanımı, medya için E2EE şeması seçmek değildir. Kullanıcının mevcut FolderSync arşivi test hedefi yapılmayacak.

### Doğrulanmış başlangıç

- Mobile: Expo 57 development build, React Native 0.86; desktop: Electron 44 + React/Vite. İkisinde de yalnız başlık shell'i ve bir render testi var. Kaynak seçimi, credential saklama, WebDAV, IPC, kuyruk veya scheduler bulunmuyor.
- API: boş NestJS modülü; domain/application/infrastructure henüz işlev içermiyor. Bu dilimde `apps/api` değişmeyecek; dosyalar cihazdan kullanıcının WebDAV depolamasına gider.
- Root workspace yalnız `apps/*`; root lint/test/build ve Node 24 CI mevcut. ESLint max-lines 300 ve FSD sınırları kurulmuş. Resolver yalnız API tsconfig'ini kapsıyor. Desktop test config yalnız renderer `.spec.tsx` dosyalarını topluyor; native/main testleri için kapsam genişletilecek.
- Electron renderer zaten `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Preload boş; gerçek bridge kurulurken sandbox-compatible CommonJS çıktısı kullanılacak.
- Stitch iki onboarding ekranı tanımlıyor: kaynak+program, sonra depolama. Kaynak HTML'lerdeki sahte başarılı bağlantı, hız/kapasite değerleri, E2EE/metadata silme/relay vaatleri ve Wi-Fi/şarj kısıtları gerçek gereksinim değildir. Görsel düzen korunacak; bu iddialar çalışan ürüne kopyalanmayacak. ADR gereği Select All olmayacak; Instant/Live Sync üçüncü otomatik program seçeneği yapılmayacak.

### Kritik dayanaklar

1. `.omp/AGENTS.md`: ürün akışı, protokol sınırları, backend rolünün açık oluşu, mimari/kalite kuralları.
2. `docs/decisions/0001-mobile-sync-behavior-and-framework-constraints.md`: iki ayrı 5 girişim bütçesi, 60 saniye/5 dakika, `updated`, Files+Photos, eski OS ve framework kararları.
3. `docs/ui/stitch-reference.md` ve işaret ettiği iki onboarding/Backup Activity tasarımı: görsel source of truth; Stitch kaynak dosyaları değiştirilmeyecek.
4. `apps/mobile/package.json`, `app.json`, `src/app/App.tsx`: mevcut native/build ve UI başlangıcı.
5. `apps/desktop/electron/main.ts`, `preload.ts`, `vitest.config.ts` ile root `eslint.config.mjs`: yetkili işlem sınırı ve test/lint kapsamı.

## Uygulama yaklaşımı ve sınırlar

### Paketler ve sorumluluklar

- `apps/mobile/src` ve `apps/desktop/src`: mevcut FSD. `app` composition/lifecycle; `pages/onboarding` ve `pages/backup-activity`; kullanıcı eylemleri `features`; kaynak, hedef, program ve sync durumu `entities`; platform bridge ve görsel primitive'ler `shared`.
- Yeni `packages/sync-core` / `@kloda/sync-core`: platformdan bağımsız TS sözleşmeleri, hata sınıfları, program/deneme/iş durumu kuralları. UI, Node, Expo, HTTP veya credential bağımlılığı olmayacak. Yeni workspace root'a eklenecek; yalnız public API'den tüketilecek. Backend paketi değildir; uygulamalara doğru import yapamaz.
- `apps/desktop/electron`: main-process runtime, credential kasası, SQLite kuyruk, dosya erişimi, WebDAV ve scheduler. Renderer yalnız dar preload API'sini kullanır.
- `apps/mobile/modules/kloda-sync-runtime`: kaynak izinleri, credential kasası, SQLite kuyruk, native transfer ve OS scheduler için yerel Expo modülü. Swift/Kotlin arka plan yürütmesi React ağacının veya JS timer'ının yaşamına bağlı olmayacak. Native durum geçişleri TS sözleşmesiyle aynı senaryo tablolarına karşı test edilecek; TS kodunun uygulama askıdayken çalıştığı varsayılmayacak.
- Backend use-case **bütün aşamalarda yok**. Aşağıdaki portlar istemci runtime sınırlarıdır; `apps/api/domain` altına taşınmayacak. Bir port ancak gerçek platform implementasyonları arasındaki sınırda kullanılacak; boş repository/use-case katmanları eklenmeyecek.

### Kalıcı durum ve çalışma kuralları

- Taslak: kaynak referansları, `intervalHours: 12 | 24`, yerel `HH:mm`, hedef bilgileri, credential referansı, konfigürasyon revision'ı. Parola normal store/SQLite/log içinde bulunmaz.
- Kaynak: opak `sourceId`, `kind` (directory veya Photos kaynağı), kullanıcıya gösterilen ad ve native tarafta tutulan kalıcı erişim referansı. Renderer'a keyfî path açma yetkisi verilmez.
- Her program occurrence'ı için kalıcı run kimliği; her kaynak için ayrı **tek kaynaklık** job. Birden fazla seçim sessizce ilk klasöre indirilmez: seçilen kaynakların işleri sırayla yürür. Paralel folder transferi eklenmez.
- Run/job kayıtlarında durum, kaynak/hedef/config revision, native transfer kimlikleri, dosya işlerinin durumu, erişim girişimi sayısı, OS girişimi sayısı, `nextAttemptAt` ve scheduled run için `updated` bulunur. Durumlar en az queued/running/waiting-access/waiting-os/blocked/completed ayrımını yapar.
- OS/native runtime kuyruk için tek yazma otoritesidir; UI komut gönderir ve snapshot/event okur. SQLite transaction ile aynı kaynak+hedef için tek aktif iş korunur. UI process'i ölünce kayıt ve ilerleme kaybolmaz. İlerleme yüzdesinin her artışında DB yazılmaz; iş/transfer geçişleri ve güvenli checkpoint'ler kalıcıdır.
- Scheduled run başlatıldığında `updated=0`; kapsamındaki bütün kaynakların bütün dosya işleri başarıyla sonuçlanınca transaction içinde `updated=1`. OS'ye teslim, taramanın bitmesi veya bildirim completion değildir. Boş bir kaynak ancak başarılı tam taramadan sonra tamamlanmış sayılır.
- Sunucu erişimi: ilk dahil toplam 5; yeniden girişim **önceki başarısız sonucun ardından 60 saniye**. OS erteleme/iptal bütçesi ayrı: ilk dahil 5, yeniden değerlendirme hedefi 5 dakika. Hiç çalışmamış görev erişim hatası sayılmaz. Aktif native transfer varsa yeni kopya açılmaz, sayaç tüketilmez. OS bütçesi bitince kalan dosyalar sonraki scheduled occurrence'a taşınır; kaybolmaz.
- Erişim reddi, geçersiz credential, TLS hatası, kaynak izni kaybı ve hedef çatışması kendi eyleme dönük hata durumlarıdır; otomatik tekrar bunları başarıya çevirmiş gibi göstermez. Erişim hatası bildirimi ADR bütçesi sonunda üretilir; formda kullanıcı düzeltmesi için hata daha erken gösterilebilir. Alt HTTP kütüphanelerinin gizli retry'ları uygulama bütçesini büyütmez.
- Yerel saat: 24 saatte seçilen saat; 12 saatte seçilen saat ve 12 saat sonrası. DST'de var olmayan saat ilk geçerli zamana kayar; tekrarlanan yerel saat bir occurrence oluşturur. Saat dilimi/saat değişimi, uyanma ve açılışta sonraki hedef yeniden hesaplanır. Kaçırılmış çok sayıda zaman ayrı ayrı aynı dosyaları başlatmaz; en eski tamamlanmamış iş korunur ve tek catch-up yürütmesi yapılır. Sync Now düzenli programın saatini kaydırmaz.

### Aktarım güvenliği ve bu dilimdeki dosya davranışı

- Yedekleme tek yönlüdür; kaynak dosya silinmez, uzaktaki silmeler kaynağa yansıtılmaz. Yeni, uygulamaya ayrılmış hedef alt dizin kullanıcıya test/başlatma öncesinde gösterilir. FolderSync'in mevcut dosyaları taranıp "zaten yüklenmiş" diye sınıflandırılmaz.
- Kaynak relative path'i segment bazında URL-encode edilir; alt klasörler korunur. Farklı seçilmiş kaynaklar ayrı hedef alt dizinleri kullanır. Symlink'ler kaynak ağacının dışına taşınmaz; iOS Photos resource'ları asset/resource kimliğiyle birbirinden ayrılır; aynı dosya adına güvenilmez. Photos orijinalleri alınır; thumbnail/transcode/metadata temizleme yapılmaz, bir asset'in birden fazla orijinal resource'u varsa hepsi işlenir.
- Uygulamanın kendi başarılı upload receipt'i yalnız kendi işlerinin replay'ini engeller; genel migration tespiti değildir. Receipt'te source identity/revision, hedef URI ve upload sonucu tutulur. Sonraki tarama, kendi tamamlanmış revision'ını tekrar kuyruğa almaz; değişen revision yeni iştir. Güvenilir revision üretilemeyen kaynakta sessiz "değişmedi" varsayımı yapılmaz.
- Güvenli varsayılan **overwrite yok**: var olan hedef dosyası başarı veya yedeklenmiş sayılmaz; kullanıcıya çatışma olarak gösterilir, `updated=1` yapılmaz. Değişmiş kaynağın önceki hedefiyle çatışması da bu kurala dahildir. Otomatik overwrite/versiyonlama bu ilk upload dilimine örtülü eklenmez. Bu varsayım plan onayında değiştirilebilir; migration yöntemi belirlemez.
- Dosya, kalıcı iş kimliğine ait geçici remote ada PUT edilir; başarılı byte aktarımı sonrası `MOVE` + `Overwrite: F` ile final ada geçirilir. Geçici ve final yollar journal'a işlem öncesinde yazılır. Cevabın kaybolduğu durumda kör PUT/overwrite yerine kendi transaction'ı uzaktaki durumla uzlaştırılır; belirsiz final içerik gerekirse okunup gönderilen snapshot ile doğrulanır. Bilinmeyen final dosya benimsenmez. Geçici dosyalar yalnız kendine ait journal kayıtları üzerinden temizlenir; remote klasör genelinde toplu silme yok.
- Büyük dosyalar JS belleğine/base64'e alınmaz. Desktop/Android stream; iOS background URLSession için file-backed staging. iOS'ta staging sınırlı sıra ile hazırlanır, tüm kütüphane bir kerede kopyalanmaz. Source okunurken değişirse karışık snapshot başarılı sayılmaz; yeniden tarama için görünür iş bırakılır.
- Güvenli bağlantı varsayımı HTTPS ve OS trust store'dur; sertifika doğrulaması kapatılmaz. Host/port/credential kodda veya repoda tutulmaz. HTTP desteği bu varsayımın gevşetilmesini gerektiriyorsa sessizce eklenmez; kullanıcıya plan kapsam değişikliği olarak sunulur. WebDAV Basic/Digest challenge'ları transport düzeyinde karşılanır; parola loglanmaz.
- Test/probe yönlendirmelerinde credential başka origin'e taşınmaz. iOS background URLSession redirect'leri uygulamanın veto edemediği için redirect-free canonical upload endpoint test edilir; bu platform sınırı belgelenir. Endpoint'in transfer sırasında davranış değiştirmesine karşı kesin redirect engelleme vaadi verilmez.

## Küçük ve review edilebilir uygulama aşamaları

Her aşama ayrı küçük PR/commit sınırı olabilir. Aşama tamamlanması, bütün vertical slice'ın bittiği anlamına gelmez. Üretim akışına fake adapter, zamanlayıcıyla sahte başarı veya no-op konulmaz. Test double'ları yalnız izole testlerde kullanılır.

### 1. Çalışma sözleşmeleri ve kalite kapsamı

- **Amaç:** Kuyruk/deneme/program davranışını UI ve platformlardan bağımsız tanımlamak; yeni dosyaları mevcut kalite kapılarının dışında bırakmamak.
- **Package/app:** Yeni `packages/sync-core`; root workspaces/ESLint/CI; mobile ve desktop test config'leri.
- **FSD:** Platform bağımsız alt bağımlılık; uygulamaların `entities/*/model` tüketimi. Feature'lar arası ters bağımlılık yok.
- **Backend use-case:** Yok.
- **Domain port:** `SourceAccessPort`, `CredentialVaultPort`, `SyncJournalPort`, `WebDavPort`, `SchedulerPort`; UI'nın runtime'a komut/snapshot erişimi için `SyncRuntimePort`.
- **Infrastructure adapter:** Henüz port tanımı dışında üretim adapter'ı yok; aynı aşamada küçük saf kurallar gerçekten çalışır. Sonraki aşamaların native/main test runner girişleri hazırlanır, sahte runtime sunulmaz.
- **Test yaklaşımı:** 5 girişim sınırı; 60 saniyenin hata sonucundan hesaplanması; ayrı OS bütçesi; aktif transferde duplicate engeli; `updated` geçişleri; DST/timezone ve kaçırılmış occurrence senaryoları. Bunlar consumer-visible davranış testleridir, enum/kopya/wiring testleri değildir. Desktop Node testleri renderer jsdom testlerinden ayrılır.
- **Tamamlanma kriteri:** Saf kurallar ve public sözleşmeler testle gösterilir; max-lines 300 tüm yeni TS dosyalarını kapsar; resolver uygulama/paket tsconfig'lerini tanır; package→app import yasaklanır. Native kod da tek sorumluluklu küçük dosyalara bölünür, build ve native test kapısı tanımlanır.

### 2. Onboarding başlangıcı ve iki ekranın durumu

- **Amaç:** İlk açılışta doğrudan doğru onboarding; kaynak+program ekranından storage ekranına kontrollü geçiş, geri dönüşte taslak kaybı olmaması.
- **Package/app:** Mobile ve desktop.
- **FSD:** `app` composition; `pages/onboarding`; `features/complete-onboarding`; `entities/backup-plan`; `shared/ui`. Gereksiz widget katmanı oluşturulmaz.
- **Backend use-case:** Yok; istemci komutu `CompleteOnboarding`.
- **Domain port:** `SyncRuntimePort` üzerinden draft okuma/kaydetme ve setup tamamlama.
- **Infrastructure adapter:** `ElectronSyncBridge`, `ExpoSyncBridge`; gerçek `DesktopSqliteSyncJournal`, `AndroidSqliteSyncJournal`, `IosSqliteSyncJournal` adapter'larının draft/source-reference saklama bölümü bu aşamada kurulur. Desktop main için `better-sqlite3` Electron ABI'ına uygun rebuild edilir; mobile yerel modül platform SQLite API'lerini kullanır. Job tabloları aşama 7'de eklenir. Bridge'e yalnız implementasyonu bulunan komutlar açılır; henüz bulunmayan yeteneklere başarılı sonuç verilmez.
- **Test yaklaşımı:** İlk açılış, geri/ileri, geçersiz seçimde geçiş engeli, setup tamamlanmadan activity açılmaması; gerçek uygulama yüzeyinde Stitch karşılaştırması. Mevcut başlık metnine bağlı render testleri kaldırılıp davranış testleriyle değiştirilir.
- **Tamamlanma kriteri:** “Depolama ekle” ile başlayan giriş yok; iki ekranın görsel düzeni/tokenları ve erişilebilir kontrolleri referansla uyumlu. Kaynak izni, test sonucu ve sync tamamlanması ayrı state'ler. Uygulanmamış kripto/relay/galeri vaatleri görünmez. Ekran sonu “Start Backup”; galeriye sahte navigasyon yok.

### 3. Gerçek kaynak seçimi ve kalıcı erişim

- **Amaç:** Kullanıcının seçtiği kaynağa yeniden açılışta ve arka planda erişebilmek; opak source referansı üretmek.
- **Package/app:** Desktop main/preload ve mobile yerel Expo modülü. Review sınırı olarak desktop, Android, iOS ayrı değişiklikler.
- **FSD:** `features/select-sources`, `entities/backup-source`, `shared/api` bridge; sayfada yalnız composition.
- **Backend use-case:** Yok; istemci `SelectSources` / `RemoveSource`.
- **Domain port:** `SourceAccessPort`.
- **Infrastructure adapter:** `ElectronDirectorySourceAdapter` (native dialog + Node fs); `AndroidSafSourceAdapter` (`ACTION_OPEN_DOCUMENT_TREE`, persisted URI grant); `IosFilesSourceAdapter` (security-scoped bookmark + coordinated access); `IosPhotosSourceAdapter` (PhotoKit izinleri, albüm/kütüphane referansları).
- **Test yaklaşımı:** Picker iptali, aynı kaynağın tekrar seçilmesi, birden fazla kaynak, izin reddi/geri alınması, stale bookmark, erişilemeyen/removable dizin, yeniden açılış. iOS limited Photos erişimi ve iCloud'dan henüz indirilmemiş orijinal ayrı senaryolar; Files ve Photos gerçek cihazda ayrı ayrı denenir.
- **Tamamlanma kriteri:** Select All yok; Photos kütüphanesi açık kullanıcı seçimiyle bir kaynaktır. Native izinler kalıcılaştırılır, JS path'i izin sayılmaz. Erişilemeyen kaynak görünür ve yeniden izin ister; boş klasörle karıştırılmaz. Çoklu seçimin tüm referansları saklanır; tek kaynaklık motor her biri için sırayla iş oluşturabilecek durumdadır.

### 4. 12/24 saat ve yerel çalışma saati seçimi

- **Amaç:** Kullanıcının programını saklamak ve hedef başlangıcı doğru göstermek; bu aşama tek başına otomatik çalışmanın teslimi sayılmaz.
- **Package/app:** Mobile, desktop, sync-core.
- **FSD:** `features/configure-schedule`, `entities/sync-schedule`, onboarding sayfası.
- **Backend use-case:** Yok; istemci `ConfigureSchedule`.
- **Domain port:** `SyncJournalPort`, `SchedulerPort` sözleşmesi.
- **Infrastructure adapter:** Draft/journal adapter'ı; OS kaydı aşama 10–11'de gerçek scheduler'a bağlanır.
- **Test yaklaşımı:** Yalnız 12/24 kabulü, saat zorunluluğu, 12.00/00.00 örneği, yeniden açılış, timezone/DST değişimi; Sync Now'ın programı değiştirmemesi.
- **Tamamlanma kriteri:** Kaynaklarla aynı ilk ekranda gerçek form değerleri ve sonraki hedef görünür. Üçüncü Instant otomatik modu, örtülü Wi-Fi-only/charging-only kısıtı veya kesin OS saati vaadi yok. Kullanıcı seçimi yokken uydurma varsayılanla setup tamamlanmaz.

### 5. Storage credentials ve güvenli platform sınırı

- **Amaç:** Kullanıcı hedefini ve credentials'ı toplamak, secret'ı yalnız yetkili runtime'a vermek.
- **Package/app:** Mobile native modülü, desktop main/preload, iki UI.
- **FSD:** `features/configure-storage`, `entities/storage-target`, `shared/api`.
- **Backend use-case:** Yok; istemci `SaveStorageCredentials`.
- **Domain port:** `CredentialVaultPort`, `SyncJournalPort`.
- **Infrastructure adapter:** `IosKeychainCredentialVault` (ilk kilit açılışından sonra arka plan erişimi, cihazla sınırlı); `AndroidKeystoreCredentialVault`; `ElectronSafeStorageCredentialVault`. Credential referansları aşama 2'nin gerçek SQLite journal'ına yazılır; secret bu store'a yazılmaz.
- **Test yaklaşımı:** Boş/geçersiz URL, URL içinde credentials, yanlış path; vault unavailable/locked; yeniden başlatma sonrası secret erişimi; log/snapshot/IPC error içinde parola olmaması. Electron gerçek main process'te DB açma ve credential round-trip; yalnız Node testindeki başarı ABI kanıtı sayılmaz.
- **Tamamlanma kriteri:** Formda gerçek endpoint/path/username/password; repo içinde hostname/port/password yok. Renderer kaydedilmiş parolayı okuyamaz; form save sonrası temizlenir. Linux keyring `basic_text` gibi güvensiz fallback'te düz metin saklama yok, engel açıkça gösterilir. Native/IPC komutlarında payload ve sender doğrulanır; renderer'a raw IPC, fs veya arbitrary URL/path operasyonu açılmaz. Protocol UI yalnız WebDAV'ı etkin gösterir; SMB varsa pasif ve LAN-only açıklamalıdır, çalışıyormuş gibi seçilemez.

### 6. Gerçek WebDAV bağlantı ve yazma testi

- **Amaç:** Girilen endpoint'in erişilebilir, authentication'ın geçerli ve seçilen dizinin bu aktarım için kullanılabilir olduğunu kanıtlamak.
- **Package/app:** Mobile native transport, desktop main transport; iki UI.
- **FSD:** `features/test-storage-connection`, `entities/storage-target`; networking renderer'da değil.
- **Backend use-case:** Yok; istemci `TestWebDavConnection`.
- **Domain port:** `WebDavPort`, `CredentialVaultPort`.
- **Infrastructure adapter:** `NodeWebDavAdapter`, `AndroidWebDavAdapter`, `IosWebDavAdapter`. Desktop Node HTTP(S) stream; Android OkHttp; iOS foreground URLSession probe ve background URLSession upload yolu. WebDAV XML parser DTD/external entity çözmez.
- **Test yaklaşımı:** Yerel gerçek WebDAV sunucusunda PROPFIND collection kontrolü; benzersiz probe alt dizininde MKCOL, küçük PUT, GET ile içerik doğrulama, MOVE no-overwrite ve yalnız probe dosyalarının DELETE işlemi. 207 içindeki resource/propstat durumları; 401/403/404/405/423/507; malformed XML, timeout, TLS, redirect ve cleanup hataları.
- **Tamamlanma kriteri:** HTTP 200 veya ping tek başına başarı sayılmaz; yazma/finalize yeteneği doğrulanır. Cleanup başarısızsa sahte tam başarı yok, probe yolu görünür. Test sonucu config revision'a bağlıdır; hedef/credential değişimi eski başarıyı geçersiz kılar. Start Backup yalnız geçerli testten sonra açılır. Kart “WebDAV erişim/yazma doğrulandı” der; “CGNAT yok”, “No relay needed”, garantili dış erişim, sahte throughput/kapasite göstermez. Test tekrarları da kayıtlı erişim bütçesine uyar; form değişiminde önceki test iptal edilir, eski cevap yeni forma uygulanmaz.

### 7. Tek kaynak taraması ve kalıcı dosya kuyruğu

- **Amaç:** Tek directory/Photos kaynağını kayıp ve duplicate üretmeden dosya işlerine dönüştürmek.
- **Package/app:** Sync-core sözleşmeleri, desktop runtime, mobile native runtime.
- **FSD:** `entities/sync-job` read modeli; tarama ve DB adapter'ları yetkili runtime tarafında.
- **Backend use-case:** Yok; istemci `PrepareSourceSync`.
- **Domain port:** `SourceAccessPort`, `SyncJournalPort`.
- **Infrastructure adapter:** `DesktopSqliteSyncJournal`, `AndroidSqliteSyncJournal`, `IosSqliteSyncJournal`; aşama 3 source adapter'ları.
- **Test yaklaşımı:** İç içe dizin, aynı isimli farklı kaynak, Unicode/%/#/boşluk, zero-byte dosya, symlink dışına çıkma, tarama sırasında kaynak değişimi, process kill ve yeniden tarama; Photos çok-resource asset. Başarılı receipt replay'i engeller, yabancı remote dosya migration yöntemiyle sınıflandırılmaz.
- **Tamamlanma kriteri:** Dosya içeriği UI/JS'ye kopyalanmadan kalıcı sıra oluşur. Tarama kesilmesi başarı değildir. Seçili N kaynak N ayrı sırayla çalışan kaynak işi üretir; scheduler run'ı hepsinin sonucunu izler. Dosya ağacı büyük olduğunda sayfalı enumeration ve bounded staging kullanılır.

### 8. Gerçek upload, finalize ve recovery

- **Amaç:** Kuyruktaki dosyaları kullanıcının WebDAV hedefine gerçekten taşımak; kesintiden sonra yalnız tamamlanmamış işi sürdürmek.
- **Package/app:** Desktop main; Android/iOS native modül. Üç platform adapter'ı ayrı review parçaları.
- **FSD:** `entities/sync-job` durum sözleşmesi; runtime implementasyonları FSD UI dışındaki platform sınırında.
- **Backend use-case:** Yok; istemci `RunSourceSync` / `ReconcileTransfers`.
- **Domain port:** `WebDavPort`, `SourceAccessPort`, `SyncJournalPort`, `CredentialVaultPort`.
- **Infrastructure adapter:** `DesktopStreamTransferAdapter`, `AndroidTransferWorker`, `IosBackgroundTransferAdapter` (kalıcı session ID, file-backed upload, completion callback'leri ve task/journal eşlemesi).
- **Test yaklaşımı:** Geçici gerçek WebDAV hedefinde byte-for-byte kaynak/remote karşılaştırması; büyük dosya; PUT ve MOVE sırasında bağlantı kaybı; response kaybolması; uygulama kapanışı; hedef çatışması; kaynak okuma hatası; yetersiz staging alanı. Transfer bitmeden completion görünmediği ve bir callback'in iki kez gelmesinin duplicate üretmediği doğrulanır.
- **Tamamlanma kriteri:** Remote final dosyalar doğru içeriktedir; aktif transferler yeniden açılışta reconcile edilir. Tamamlanmış dosya işleri tekrar PUT edilmez. Çatışma/başarısız dosya varken run tamamlandı gösterilmez. Native upload kabul edilmesi ile server-finalize/receipt tamamlanması ayrıdır; `updated` ancak gerçek tüm-dosyalar başarısında değişir.

### 9. Start Backup, Sync Now ve gerçek Backup Activity

- **Amaç:** Kullanıcının ilk backup'ı ve sonraki manuel sync'i aynı gerçek motora bağlaması; ilerlemeyi ve hatayı görmesi.
- **Package/app:** Mobile ve desktop; mevcut runtime adapter'ları.
- **FSD:** `features/start-sync`, `features/complete-onboarding`, `pages/backup-activity`, `entities/sync-job`; gerektiği yerde `widgets/sync-progress`.
- **Backend use-case:** Yok; istemci `StartSyncNow`, `CompleteOnboarding`.
- **Domain port:** `SyncRuntimePort`; native bildirim sınırında `SyncNotificationPort`.
- **Infrastructure adapter:** `ElectronSyncBridge`, `ExpoSyncBridge`, platform local notification adapter'ları. Push/backend eklenmez.
- **Test yaklaşımı:** Çift tıklama; scheduler ile eşzamanlı Sync Now; aktif uzun transfer; config değişiminden kalmış stale test; bildirim izni reddi; yeniden açılışta gerçek progress. UI screenshot/erişilebilirlik kontrolü ve gerçek dosya aktarımı birlikte yapılır.
- **Tamamlanma kriteri:** Start Backup geçerli config/testi transaction ile tamamlar ve gerçek ilk işi başlatır. Sync Now hazır kurulumda her zaman erişilebilir; aynı kaynakta aktif iş varsa ikinci kopya yerine mevcut işe yönlendirir. Manuel başlatma bir sonraki programı değiştirmez. İlerleme gerçek byte/dosya durumudur; sahte yüzdeler yok. Aktif iş için sessiz ilerleme bildirimi ve erişim bütçesi sonunda hata bildirimi; izin engeli activity'de görünür. iOS bildirim yenilemesi/sunumunun OS kontrolünde olduğu belirtilir; bildirim timer/worker yerine geçmez.

### 10. Desktop gerçek otomatik çalışma

- **Amaç:** Kaydedilmiş yerel saat programının renderer'dan bağımsız main process'te çalışması.
- **Package/app:** Desktop Electron main/preload, sync-core.
- **FSD:** `app` runtime composition, `features/configure-schedule`, `entities/sync-schedule` read modeli.
- **Backend use-case:** Yok; istemci `RunDueSchedule` / `ReconcileSchedule`.
- **Domain port:** `SchedulerPort`, `SyncJournalPort`.
- **Infrastructure adapter:** `ElectronScheduleAdapter` (main timer + persisted due times + `powerMonitor` resume + startup reconciliation). Single-instance runtime; window kapandığında tray'de devam. Açık Quit komutu işi durdurur; kullanıcıya automatic sync'in uygulama çalışırken/arka plandayken etkin olduğu gösterilir.
- **Test yaklaşımı:** Gerçek Electron'da hedefi yakın bir saate kurup otomatik dosya upload gözlemek; pencereyi kapatma, sleep/wake, explicit Quit/relaunch, saat dilimi değişimi, aktif manuel iş sırasında due occurrence. Testte süre kısaltma production'a alternatif program seçeneği eklemez.
- **Tamamlanma kriteri:** Renderer kapalıyken otomatik backup çalışır; cihaz kapalı/uykudayken çalışma iddiası yok. Yeniden açılışta kalan iş aynı journal'dan sürer. Explicit Quit sonrasında scheduler'ın çalışmadığı doğru gösterilir; işletim sistemi servisi veya login autostart eklenmez. Saat değişimleri duplicate iş oluşturmaz.

### 11. Mobile gerçek otomatik çalışma ve OS recovery

- **Amaç:** Android/iOS'ta uygulama ön planda değilken gerçek program teslimi, aktarım ve kalıcı recovery.
- **Package/app:** Mobile yerel Expo modülü ve app config/plugin. Android ve iOS ayrı küçük değişiklikler; son entegrasyon ortak.
- **FSD:** `app` native lifecycle composition; `entities/sync-schedule` ve `entities/sync-job` read modeli; UI'da yalnız program/durum gösterimi.
- **Backend use-case:** Yok; istemci `RunDueSchedule` / `ReconcileInterruptedSync`.
- **Domain port:** `SchedulerPort`, `SyncJournalPort`, `SourceAccessPort`, `SyncNotificationPort`.
- **Infrastructure adapter:** `AndroidWorkManagerScheduler` (unique durable work, network-connected constraint; charging/unmetered zorunluluğu yok) ve `IosBackgroundTaskScheduler` (BGProcessingTaskRequest, earliestBeginDate, lifecycle/expiration handler); aşama 8 transfer adapter'ları. Android uzun işler foreground WorkManager yürütmesi ve ilgili notification/service tipiyle ilerler; OS'nin runtime/quota/foreground-start sınırlarında checkpoint alınır ve iş ertelenir. iOS background URLSession sistem transferi ve yeniden bağlanma yolu kullanılır; yalnız iOS 26+ API'ye bağlı çözüm yok.
- **Test yaklaşımı:** Fiziksel iOS/Android cihazında uygulama background/ekran kilitli iken gerçek remote dosya doğrulaması; OS task durdurma/expiration, ağ gidip gelmesi, reboot, user force-stop/force-quit ve sonraki açılış; izin iptali, 5 dakikadan uzun aktif upload. Hızlandırılmış native scheduler tetiklemesi mekanizmayı sınar; ayrıca gerçek 12/24 saat program gözlemiyle kayıtlı hedef/başlangıç/bitiriş karşılaştırılır.
- **Tamamlanma kriteri:** Gerçek OS registration vardır; JS `setInterval` otomatik sync çözümü sayılmaz. 5 dakika kontrol hedefi kaydedilir; OS fırsat verdiğinde reconcile edilir, kesin uyanma garantisi verilmez. Native aktif task kontrol edilmeden `updated=0` yeniden başlatılmaz. OS bütçesi sonunda kalan iş sonraki occurrence'dadır. User force-stop veya OS yürütme engeli gizlenmez; yeniden izin/açılış gerektiği doğru belirtilir. Dosyalar başarıyla bitmeden updated değişmez.
- **Platform önkoşulu:** Minimum OS ürün kararı burada alınmaz. Mevcut Expo/RN toolchain'in fiilî minimumları ve kullanılan API availability'leri çıkarılıp compatibility kaydına yazılır; native modül bu tabanı keyfî yükseltmez. iOS 26 öncesi ve daha eski Android üzerinde uygun fiziksel cihaz smoke'u gerekir. Hedeflenen cihaz mevcut toolchain tabanının altındaysa sessiz min-version yükseltme/framework değişimi yok; Ayhan'ın ayrı kararı gerekir. Native app identifier/signing değerleri kullanıcı ortamından alınır, üretim identifier'ı uydurulmaz.

## Önerilen implementation sırası

**1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11.**

Önce gerçek sözleşmeler ve ekran geçişleri; ardından kaynak/credential erişimi; yazma testi; tek kaynaklık kalıcı motor; manuel uçtan uca kullanım; son olarak aynı motoru çalıştıran desktop ve mobile scheduler. Bu sıra otomatik çalışmayı sonraya bırakan bir teslim kapsamı değildir: **10 ve 11 tamamlanmadan bu vertical slice tamamlandı sayılmaz.**

Her aşama için implementation ve review ayrı geçişler olacak. Review özellikle AGENTS §3 protokol/uzaktan erişim iddiaları, §6 katman yönleri ve §7 max-lines/FSD kurallarını kontrol edecek. Bir use-case/komut dosyası tek sorumluluk taşıyacak; platformlar arası büyük merkezi runtime dosyası oluşturulmayacak.

Onaydan sonra bu konuşmadaki kapsam/native modül/yerel saat kararları `docs/decisions/` altında kısa yeni ADR ile kaydedilecek; ADR 0001'in retry ve platform kısıtları korunacak. Görsel uyarlamalar ve doğrulanmış davranışlar ilgili aşamanın smoke kanıtından sonra `docs/ui/stitch-reference.md` içinde güncellenecek; salt tasarım kaynakları değişmeyecek. Yeni ADR WAN testi istisnasının yalnız bu dilime ait olduğunu belirtecek.

## Verification ve bütün dilimin bitiş kriteri

### Otomatik kontroller

- İlgili değişiklikler bütünleştikten sonra root `npm run lint`, `npm test`, `npm run build` bir kez toplu çalıştırılır; her küçük aşamanın kendi davranış testi ve smoke kanıtı ayrıca vardır.
- Sync-core saf davranış testleri, desktop renderer ve ayrı main-process test projesi, mobile Jest/RNTL, native Kotlin/Swift testleri aynı kabul senaryolarını kapsar.
- Native CI/build işleri Android worker ve iOS modülünü gerçekten compile/test eder. Expo export ve Vite build, native modülün veya Electron DB ABI'ının çalıştığının kanıtı sayılmaz.
- WebDAV integration için test süresince açılan gerçek Apache mod_dav sunucusu, geçici hesap/hedef ve test CA'sı kullanılır. Production TLS doğrulaması kapatılmaz. Ayrıca kullanıcının sağladığı gerçek WebDAV kurulumunda **ayrı boş hedef** ile manuel smoke yapılır; secret/env repo dışındadır. Fixture portları/kimlikleri runtime'da oluşturulur; kullanıcının NAS ayarları sabitlenmez.

### Uçtan uca senaryolar

1. **Yeni kurulum:** Temiz app state → gerçek kaynak → 12 saat + yerel saat → credentials → gerçek yazma testi → Start Backup → activity. Aynı akış 24 saatle tekrarlanır; app restart tercihleri korur. Önce storage isteyen ekran yok.
2. **Gerçek transfer:** İç içe ve farklı boyutlu dosyalar, Unicode isimler ve boş dosya uzak hedefte byte-for-byte karşılaştırılır. iOS Files ve Photos kaynaklarının her biri gerçekten yüklenir. Çoklu seçimin hiçbiri sessizce atlanmaz.
3. **Manuel/otomatik çakışma:** Sync Now çift tıklaması ve scheduled tetikleme aynı kaynağın ikinci upload'ını başlatmaz. `updated=0` kalmış aktif uzun iş tekrar açılmaz. Otomatik program manuel başlatmayla kaymaz.
4. **İki ayrı bütçe:** Erişim başarısızlığı sonrası 60 saniye ve toplam 5 kanıtlanır; OS kesintisi ayrı sayaçla 5 dakika hedefi ve toplam 5 olarak izlenir. OS çalıştırmadığı sürede erişim denemesi uydurulmaz. Sona kalan iş sonraki schedule'da görünür.
5. **Lifecycle:** Renderer kapanışı, mobile background/lock, process kesintisi ve restart sonrası completed iş replay edilmez; native aktif task tekrar oluşturulmaz; pending iş kaybolmaz. Desktop sleep/resume ve mobile force-quit sınırlamaları ayrı raporlanır.
6. **Hata ve veri koruma:** Permission denied/revoked, yanlış parola, TLS hatası, unavailable endpoint, quota, source değişimi, overwrite çatışması ve belirsiz finalize sonucu. Hiçbirinde sahte başarı/updated=1 veya mevcut FolderSync dosyasına yazma yok.
7. **Gerçek schedule:** Her platformda OS/main tarafından tetiklenmiş upload gözlenir. Mobilde geliştirme tetiklemesi yanında gerçek 12/24 saat gözlem kaydı bulunur. Hedef saat ile gerçek başlama farkı saklanır; OS ertelemesi otomatik başarı diye yazılmaz.
8. **Görsel yüzey:** İki onboarding ekranı ve Backup Activity gerçek Electron ve Expo development build'de açılır; Stitch düzeni, disabled/loading/error state, klavye/safe area ve erişilebilir kontroller kontrol edilir. Screenshot-only veya mock network demosu davranış kanıtı sayılmaz.

**Tamamlandı ölçütü:** Yukarıdaki akış Android, iOS ve desktop'ta gerçek dosya/veriyle çalışır; gerçek otomatik çalışma kanıtı vardır; lint/test/build ve ayrı review geçer. Fiziksel cihaz, signing veya test NAS erişimi yoksa ilgili kabul kanıtı eksiktir ve dilim tamamlandı diye sunulmaz. Bu planlama çalışmasında uygulama kodu değiştirilmedi; build/test/smoke çalıştırılmadı.

## Platform seçimlerinin resmi dayanakları

- [Expo — local native modules](https://docs.expo.dev/modules/get-started/): mevcut development build içinde Swift/Kotlin modülü.
- [Expo — BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/): exact-time olmayan OS yürütmesi; tek başına 5 dakika timer garantisi değildir.
- [Apple — background URLSession](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background): file-backed uploads, session yeniden bağlama ve redirect sınırı.
- [Apple — directory access](https://developer.apple.com/documentation/uikit/providing-access-to-directories): security-scoped bookmark/koordineli erişim.
- [Apple — BGProcessingTaskRequest](https://developer.apple.com/documentation/backgroundtasks/bgprocessingtaskrequest): iOS 13'ten itibaren bulunan API; bu bilgi uygulamanın minimum iOS kararını belirlemez.
- [Android — persistent directory access](https://developer.android.com/training/data-storage/shared/documents-files) ve [background data transfer](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options): persisted URI erişimi, WorkManager erteleme/iptal/runtime sınırları.
- [Electron — context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) ve [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): dar IPC, OS credential protection ve Linux keyring sınırlaması.
- [RFC 4918](https://www.rfc-editor.org/rfc/rfc4918): PROPFIND/MKCOL/PUT/MOVE ve multistatus/overwrite semantiği.
