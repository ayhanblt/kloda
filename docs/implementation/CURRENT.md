# CURRENT — 04.11.2026

Tarihî PASS taze kabul değildir.

**16c uygulama/izole kapanış03.11:** main67701e7; [tek checkpoint](ftps-native-checkpoint-2026-11-03.md), [manifest](evidence/ftps-native-step16c-2026-11-03/manifest.json). ADR0022 pratik FTPS profiliyle native engine/journal/vault/Files/Photos/restore/queue/OS ve TR/EN/DE ürün bağlantısı tamam, varsayılan kapalı. Yeni scoped testler,6ABI paketleri, Android/iOS app build, owned Files/Photos/restore/reopen/cleanup ve aynı-agent ayrı review PASS. Başarılı eski testler tekrarlanmadı; commit/push yok,17 başlamadı. Gerçek public-CA/LAN, genel12/20/21 ve bağımsız son Claude review açık; izole CA/sentetik route bunları kapatmaz.

**17 S3 —04.11 uygulama/izole doğrulama tamam:** [checkpoint](s3-step17-checkpoint-2026-11-03.md), [son doğrulama](evidence/s3-native-step17-2026-11-03/verification-2026-11-04/manifest.json). İki platform actual owned Photos upload/full GET/metadata/restore/repeat/reopen/cleanup ve automatic/manual yetki componentleri PASS. iOS Int64 SQLite bind düzeltmesi + normal Xcode27.2 app build PASS. Önceki6ABI/newJS/native kanıtları korunur; başarılı eski AWS/core testleri tekrar edilmedi. JNI14yeni paket advisory0eşleşme;3lisans metni eksik. Dağıtım/P5 production/genel UI/bağımsız review/gerçek OS/fiziksel kabul [tek20–21 listesinde](20-21-acceptance-collection-2026-11-04.md), kapalı sayılmaz.18/19 Claude alanında; hizalama 04.11'de yapıldı (aşağıda). Gerçek-key app/AWS ve gerçek kullanıcı medyası değişmedi. Commit/push yok.

**18/19/29 Claude —04.11 main'e birleştirildi:** main `66b8300` (Codex 16c/17 dahil; geçmiş co-author satırları temizlenerek yeniden yazıldı, eski hash'ler geçersiz). [Checkpoint](step18-20-checkpoint-2026-10-31.md) "Sıradaki". 18A/4d Android köprü + EN/DE/a11y, 4 metin bulgusu ve Durum sekmesinin tüm hedefleri toplaması tamam. Jest 260/261 (tek başarısız Codex `s3-diagnostic-page.spec.tsx`, temiz main'de de), tsc/ESLint, Android/iOS Simulator derleme PASS. ADR0029 proposed (kabul kullanıcıda). Bağımsız review yok.

## Steps

|#|Durum|Açık kapı|
|---|---|---|
|1|Android context uygulandı|runtime/21|
|2|Android background owner uygulandı|gerçek OS/21|
|3|Android schedule/retry uygulandı|eski OS/Doze/21|
|4|Android izole+dar fiziksel kanıt|gerçek PC/Photos/16KB/performans|
|5|iOS pairing izole|iPhone/Secure Enclave/PC LAN|
|6|iOS Files izole|provider/iCloud/restore|
|7|iOS Photos/izole PhotoKit|LivePhoto/RAW/edited/iCloud/alan|
|8|iOS background/izole retry|OS delivery/lock/gerçek PC|
|9|WebDAV ayarlar uygulandı|canlı ürün kabulü15/20/21|
|10|Mobil bütünleşik izole kanıt|reader/LAN/pil/alan/latency|
|11|Lovable alımı tamam|native görsel kabulü12|
|12|UI kodu+web kanıtı tamam|native ABI/görsel/a11y açık|
|13|Dar salt-okunur galeri uygulandı|Android/native/physical açık|
|14|16/16 teknik matris+D1–3 onaylı|SDK/fiyat/hesap/platform|
|15|WebDAV Files+Photos/own restore izole|picker/UI/BG/signing/20/21|
|16|16a+16b+16c uygulama/izole kapanış tamam|Genel12/20/21 ve son Claude review açık; protokoller varsayılan kapalı|
|17|Uygulama/izole fonksiyonel doğrulama tamam|Dağıtım/P5/genel UI/OS/physical kabul20–21listesinde|
|18|18A/1–4d + 18B/1, 18B/5 Dropbox, 18B/5r restore uygulama/izole tamam (Claude)|8: Android otomatik JobService, iOS >150 MiB `upload_session`; 9: Dropbox Photos + eklenmiş Nextcloud restore; Android yükseltme; Box engelli|
|19|Live Activity uygulama/izole tamam (Claude)|signing/fiziksel cihaz/iOS 16 runtime kararı|
|20|Başlamadı; Claude payı altyapı (2 yakalama betiği hazır)|regresyon iskeleti, platform/güvenlik/a11y/perf, bağımsız review|
|21|En son toplu fiziksel kabul|yeni açık izin+hazır hesap/cihaz|

## 16a — tamamlanan uygulama/izole kapanış /01.11

Kullanıcı sırası: önce16a, sonra16b. Bağımsız review kullanıcı kararıyla en sonda Claude’da; mevcut geliştirme/testi durdurmaz. Ajan açılmaz/Claude worktree’sine yazılmaz. [Somut kabul listesi](smb-acceptance-checklist-2026-11-01.md); [ADR26][a26], [ADR22][a22] ve [native checkpoint](smb-native-publication-checkpoint-2026-10-30.md). SMB varsayılan kapalı; genel ürün aktivasyonu/nihai güvenlik kabulü verilmedi.

LAN sunucusu eksikliği giderildi. Kullanıcı Windows11Pro’da boş, ayrı test kullanıcılı `192.168.1.54:445/KlodaTest16a` paylaşımını hazırladı. Darwin kısa IPv4 netmask(sa_len=7) okuyucusu sınır-güvenli düzeltildi; eski negatif kontrol+host4test, gerçek Simulator Windows admission, loopback/gateway reddi, üretim Clippy, native device+Simulator paket ve tam app build PASS. [Tek route kanıtı](evidence/smb-windows-lan-2026-11-01/manifest.json). Ortak `backup_destination` migration’ı beklenmez; SMB kullanıcı kararıyla kendi `smb_enabled` tablosunda, ortak şema/CHECK/user_version’a dokunulmaz.

[Gerçek Files/Windows zinciri](evidence/smb-windows-files-2026-11-01/manifest.json) PASS: SMB3.1.1/AES128GCM/imzalı+şifreli host auth; ayrı owned Simulator’da gerçek Source+Restore picker/bookmark,4097-byte kaynak, üretim route-bound yayın/own Completed+katalog, unchanged aynı-job reuse, byte doğrulanmış restore/tekrar aynı inode ve ayrı süreç reopen. [Exact D7 A onaylı tam Photos zinciri](evidence/smb-windows-photos-2026-11-01/manifest.json) PASS:1PNG kaynak+albüm, gerçek resource/manifest yayın+own download/import, tekrar/no duplicate ve ayrı süreç reopen. OS30albüm cleanup uyarısı ilkinde reddedildi; exact asset üyelikleri1/1 doğrulandı, yalnız cleanup sürdü, seed/import tekrarlanmadı. Son2asset+2albüm cleanup/post-fetch0 PASS. Yeni Keychain/izin girdileri ve asıl600 parola dosyası+boş dizini kaldırıldı; Windows UUID test kökleri+yerel makbuzlar retained. [Exact Photos kapsamı](smb-ios-windows-photos-owned-fixture-2026-11-01.md). Önceki [yerel importer bileşeni](smb-ios-photo-import-owned-fixture-2026-11-01.md) daha dar tarihî kanıttır.

[Native SMB ekranı+önkontrol](evidence/smb-native-ui-2026-11-01/manifest.json) scoped PASS: gerçek API/Inter/theme/MobileShell ile TR/EN/DE, Almanca maxfontScale3.571; klavye üzerinde görünür secure parola/maskeleme, native7 alan etiketi/header/save rolleri. Kaydet/etkinleştir/çalıştır basılmadı; journal quick_check=ok, profile/upload/run/enabled0. İzole Simulator Keychain grubuyla doğrudan status storage_failure giderildi. İki native otomatik koordinatörde hedefsiz başlangıç artık gereksiz ortak PC journal okumaz; gerçek guard negatif kontroller+pause/vault/journal güvenli duruş ve app build/link PASS. Önceki [otomatik/manuel admission yarışı](evidence/ios-automatic-admission-2026-11-01/manifest.json) recursive fence’i korunur; eski0bb96303 kaydı/Claude step19 dalı değişmedi.

Açık kalan genel kapılar: VoiceOver ses/focus ve tam a11y/audit, tüm ekranlar için kalıcı batch capture12/20; gerçek OS BG teslim/lock, production signing/device custody, fiziksel/perf20/21; en sonda gerçek Claude güvenlik incelemesi. Bu kapılar isolated testlerle kapandı sayılmaz. [Review snapshot](evidence/smb-closure-step16a-2026-11-01/README.md) son önkontrol düzeltmesiyle142 kaynak+patch hashleri doğrulanarak tazelendi; henüz bağımsız review yok. Owned uygulamalar/Simulator kapalı, font ayarı geri alındı; kişisel veri/hesap/cihaz ve fiziksel21 izni varsayılmadı.16a nihai ürün aktivasyonu iddiası yok; kullanıcı01.11 kararıyla16b devam ediyor.

## 16b — tamamlanan uygulama/izole kapanış /02.11

Kullanıcının toplu uygulama→test sırası tamamlandı. [Güncel kısa checkpoint](sftp-native-checkpoint-2026-11-02.md), [tek kapanış manifesti](evidence/sftp-closure-step16b-2026-11-01/manifest.json). SFTP native çekirdek/vault/profil/journal/Files/Photos/restore/queue/schedule/OS ve TR/EN/DE ürün bağlantısı uygulandı. Mobil test/lint/TS, Rust+native kontroller, dört Android ABI16KB ve iki iOS arm64 paket+Simulator ürün build PASS.211 dependency OSV eşleşmesi0; notices hazır. Varsayılan aktivasyon kapalıdır.

Gerçek Android Files+ürün/OS ve exact onaylı Photos zinciri PASS. Gerçek Windows LAN iOS Files picker/bookmark4097 byte yayın/download/restore/repeat+ayrı süreç reopen PASS; exact onaylı Photos1PNG resource/manifest/import/repeat/reopen PASS. Son2asset+2albüm kimlik doğrulamalı cleanup/post-fetch0, kendi Keychain/TCC ve kaynak parola dosyası temizliği PASS. Owned Simulator ve Android5584 kapalı; Windows test sunucusu kullanıcı `Stop-Service sshd` komutuna kadar açık, remote test UUID kanıtları retained.

Ayrı aynı-agent review’da parent kontrolü sırasında düşen yetkinin rename’e sızması düzeltildi; eski negatif kontrol ve düzeltilmiş bound gerçek sunucu testi PASS, altı mobile artifact yeniden paketlendi. Native TR/EN/DE/maxfont batch ve klavye alan gözlemi scoped PASS; ayrı klavye screenshot eksik. Bağımsız Claude review kullanıcı kararıyla en sonda; genel12/20/21 görsel/a11y/VoiceOver, kalıcı tüm-ekran capture, gerçek BG delivery/lock, production signing/device custody, fiziksel/perf açık. `backup_destination` şema/CHECK/user_version ve Claude worktree değişmedi.

[16c explicit FTPS dar ön elemesi](ftps-native-preflight-2026-11-02.md)03.11 ilerledi: exact libcurl8.23.0 kaynak/lisans/advisory+iki sentetik host negatif probe; STOU upload/TLS-only API varsayımları elendi. Exclusive/durable publication ve gerçek TLS/control+data route kapıları açık; dependency/ABI/ürün uygulaması/17 başlamadı. Devamda yalnız bu kısa checkpoint ve [ADR0022][a22] D1 bölümünü oku.

## 16a — korunan kanıt ve açık kabul

D8 bağlı-socket handoff; profil değişimi eski işi yetkisiz kılar, yeni generation/pending→ready ve vault-okunamaz güvenli duruş. Android gerçek Keystore/tamper/reopen+eski iş; Swift host ayrı süreç testleri PASS.
[Kanıt](evidence/smb-native-publication-step16-2026-10-30/profile-owner-2026-10-31.json).
iOS üretim vault/profil sınıflarıyla ayrı Simulator uygulamasında pozitif Keychain, ayrı süreç reopen, eski generation/pending/tamper/missing güvenli duruş PASS. [Kanıt](evidence/smb-native-publication-step16-2026-10-30/ios-custody-2026-10-31.json). Bu üretim signing/cihaz kilidi kabulü değildir.
iOS OS route köprüsü açık A onayıyla uygulandı: iki native sembol, mevcut Rust route sahibi+Swift bound yayın. Dar Rust/Swift, Simulator link/ret+witness, Clippy ve device+Simulator paketleme PASS. [Kanıt](evidence/smb-native-publication-step16-2026-10-30/ios-lan-owner-2026-10-31.json).
16a aktif: Files generation/OS-bound yayın, unchanged reuse/değişen immutable içerik, own katalog/readonly staging ve Android gerçek SAF restore/tekrar kopyalamama PASS. iOS ayrı süreç yerel inode restore ve sahipsiz inode/hash adoption reddi PASS. Açık Files keep-both taze snapshot/yeni UUID+alias/kalıcı request bağıyla Android runtime ve iOS host testinde PASS. [Tek grup kanıtı](evidence/smb-native-publication-step16-2026-10-30/sources-catalog-read-2026-10-31.json).
Photos exact Android fixture A ile açık onaylandı ve çalıştı: tek owned PNG, unchanged reuse, favorite-only sidecar revision (medya yeniden yüklenmedi), own receipt-bound restore/byte doğrulaması, tekrar restore/no duplicate, stale-context ve unknown-create güvenli duruş **PASS**. [Exact kapsam](smb-photos-owned-fixture-2026-10-31.md). iOS Photos mutation izni/kabulü değildir.
Ayrı SMB native queue/run/schedule/OS dispatch sınıfları eklendi. Android gerçek Files queue, sayaçlar/disable ve SQLite pause-save failure callback testi; iki platform native run/retry bütçesi/immutable terminal/CAS plan testleri PASS. Startup owner yarım işi eski bağlamla tekrar yetkilendirmez; bilinmeyen ACK otomatik retry olmaz. OS JobService/BG kaydı ve opt-in ürün bağlantısı uygulandı; aşağıdaki taze ürün kontrolleri geçerlidir. Varsayılan dağıtım aktivasyonu kapalıdır.
Ayrı aynı-agent review: step0+native4 “create yok” kanıtı sayılmaktan çıkarıldı; persistence hatasında callback kaybı ve exhausted retry'da busy kalma düzeltildi. Bağımsız review değildir. Rust14 host, owned8 yayın+5readonly ve Clippy PASS; altı release ABI adayı C/JNI exports ile doğrulandı, Android dört ABI16KB LOAD hizalı; device+Simulator geçici XCFramework ve gerçek Simulator release readonly FD ret/link+witness PASS. Pod/Gradle ürün paketi opt-in bağlantısı ve gerçek ürün derlemeleri aşağıda doğrulandı.
31.10 kullanıcı kararı: SMB ürün opt-in şimdilik kendi `smb_enabled` tablosunda kalır; profil generation ve job fence aynı SMB veritabanı/transaction içinde korunur. ADR0027 notu Claude'un `worktree-step18-20` dalında yalnız okundu. Ortak migration Claude'un dalında tamamlandı; SMB bunu kullanmaz ve ürün bağlantısı migration'ı beklemez. `backup_destination` şeması/CHECK/user_version bu dalda değiştirilmez; SMB'yi ortak tabloya taşıma ayrı sonraki karardır.
Ürün bağlantısı uygulandı: ayrı Expo SMB modülü; TR/EN/DE hedef formu, açık kaydet/etkinleştir ve kayıtlı hedef yönetimi; run/pause, son sonuç/sayaç/retry, own katalog/restore/review; Android JobService2706/2707+boot/settings/global pause ve iOS BG kaydı. Profil doğrulaması/opt-in açma ve generation+opt-in kapatma aynı SMB transaction içindedir. Parola native vault'ta kalır; JS kalıcı depolamasına verilmez.
Taze kontroller: mobil **27 paket/175 test**, TypeScript ve lint PASS. Paketlenmiş release Rust ile disposable Android gerçek OS JobService/lease→SAF Files→şifreli SMB→Completed/sayaç/sonraki plan/disable PASS; kapatma yazma hatasında generation+enabled rollback PASS. iOS gerçek Expo/Pods ile SMB etkin arm64 Simulator **uygulama derleme+link PASS**; ayrı süreç kaynak/restore, Photos/run/CAS ve journal kilidi tutulurken foreground kaybı host testleri PASS. Ortak iOS global pause ilk iki hedef hata verse de bütün hedefleri durdurur; geçici pause fence kalıcı yazma başarısızken de yeni PC/DAV/SMB otomatik işi engeller. Ayrı aynı-agent review; bağımsız review değildir. Owned AVD ve SMB container durduruldu, kanıtlar retained.
Devam: **16a ürün bağlantısı ve yukarıdaki kaynak/otomatik/izole kapsam uygulandı; TAM KABUL/varsayılan aktivasyon AÇIK.** Ortak migration/table kararı artık engel değildir. Sonraki kabul işi gerçek iOS admitted LAN+seçili bookmark runtime ve tam SMB Photos kaynak/yayın/download zinciri (dar PhotoKit importer bileşeni01.11 PASS), ardından ayrı güvenlik/platform değerlendirmesidir; signing/cihaz custody ve12/20/21 görsel/a11y/perf/fiziksel kapıları korunur. Android medya onayı iOS'a genişlemez. SMB varsayılan build'de kapalı kalır; opt-in derleme/tekrar komutları checkpointtedir. 16b01.11 kullanıcı isteğiyle bekletildi;16c başlamadı.16a tek grup kanıtı üstteki manifestte; geçici çıktılar /tmp/kloda-smb-sources16, release adayları /tmp/kloda-smb16-release.
16a gerektiğinde okuma: [ADR26][a26] D6–D8; [ADR22][a22] transport/custody; [checkpoint](smb-native-publication-checkpoint-2026-10-30.md) “Sıradaki dar iş”. Hedefli: [D8][d8], [usage](resume-and-usage-plan-2026-10-30.md).16 kabul ölçütlerini raporlamadan17'ye geçme.

## 18/19/20 — Claude alanı açık işler /04.11

Sıra: 8 → 9 → 20 regresyon iskeleti. Ayrıntı ve kanıt: [checkpoint](step18-20-checkpoint-2026-10-31.md).

- **8 (18B/5):** Android otomatik JobService koşusu (elle başlatma 18A/4d'de PASS); iOS >150 MiB `upload_session`.
- **9 (18B/5r):** Dropbox'tan Photos geri yükleme; eklenmiş Nextcloud hedefinden geri yükleme.
- **11:** Android kurtarma kodu göster/kopyala (kullanıcı deseniyle); kurtarma ekranları EN/DE/a11y yakalaması.
- **NOT_RUN:** Android kurulu uygulama yükseltmesi; uygulamadan gerçek Nextcloud girişi (fixture CA yalnız androidTest'te, ayrı karar); TalkBack; iOS EN/DE Bağlantılar; sunucu uyuşmazlığında iptal uçtan uca; 18A/3 Android çok hedefli DAV (Codex HTTPS fixture anahtarları silinmiş).
- **Bilinen:** `tools/test-ios-webdav-journal.py` host'ta derlenmiyor (29/4 stub yaklaşımıyla düzeltilecek); iOS dev yeniden yüklemede `candidate_stale` (üretimde doğrulanmadı); yeniden etkinleştirmede eski hata satırı (metin/davranış kararı); `pod install` için `LANG=en_US.UTF-8`.
- **Kullanıcıda:** ADR0029 kabulü, iOS 16 runtime kararı, gate 21 fiziksel test, GitHub contributor önbelleği.

**20 regresyon iskeleti (öneri, tek giriş `tools/regress.py`; ucuzdan pahalıya, başarısız katman üsttekileri durdurur):**
1. Ön kontrol: `KlodaCloud18` emülatör, Cloud18 simülatör, Nextcloud fixture, Metro.
2. JS: Jest, tsc, ESLint.
3. iOS host: `test-ios-recovery-catalog`, `-recovery-code`, `-destination-migration`, `-oauth`, `-live-activity`, `-webdav-journal` (önce düzeltilir).
4. Derleme: Android app + androidTest APK; `LANG=en_US.UTF-8` pod install + iOS arm64 Simulator.
5. Android enstrümantasyon: `cloud18-*`, `recovery29`; fixture'lı `test-android-nextcloud`, `-dav-targets` (fixture gelene kadar atlanır).
6. Görsel: `capture-ios-live-activity.py`, `capture-android-connections.py`; eklenecek iOS Bağlantılar/kurtarma ve Android Durum; her karede dil/ekran doğrulama + e-posta karartma.
7. Gerçek hesap (ör. `test-android-dropbox-live.py`): varsayılan kapalı, yalnız kullanıcı onayı ve girişiyle.
8. Manifest: kaynak/varyant hash'i + sonuç; yalnız değişene bağlı testler yeniden koşar; bilinen dış hatalar ayrı listelenir, PASS sayılmaz.

## Decisions

- D6A 30.10: exact ENCRYPTION bit patch; hash/versiyon/upstream kaldırma koşulu [ADR26][a26].
- D7A 30.10: ayrı Files/SMB Photos makbuz/sidecar; kayıp ACK ile adoption yok [ADR26][a26].
- D8 31.10: ilk tek-satır geri alındı; iki wrapper+native köprü AYRI açık A onaylı [D8][d8].
- iOS OS route iki-sembollü native ABI kapsamı A ile açık onaylandı/uygulandı; [somut diff/karar](smb-ios-lan-owner-decision-2026-10-31.md). Exact Android SMB Photos fixture A ve01.11 ayrı exact iOS importer bileşen fixture açık onaylı/PASS; iOS uçtan uca LAN/Photos ve21 fiziksel izni verilmedi. WebDAV istisnaları genişletilmez.

## Gates

SMB ortak migration bekleme kapısı 31.10 kullanıcı kararıyla kaldırıldı; `smb_enabled` üzerinden16a ürün bağlantısı yetkili.

11/12/13/15/20/21 kabulü açık. WindowsD3/provider/startup/SQLite/opened-object, macOS normal uygulama signing, Linux provider+görünür kontrol; gerçek OS/storage/restore/revoke/recovery, bağımsız review, reader/large text/klavye, pil/alan/latency/retry/perf, SDK config olayı ve eski scope-locator kapanmadı.
Roadmap dışı açık kapsam: hesap/MFA/recovery, public roots/deep-link, Internet/remote/E2EE, iki yönlü sync/versions ve FolderSync migration; otomatik işe ekleme. Her tarihî açık/karar maddesi [kayıpsız eşleştirmede](archive/migration-check.md); kapanış kaynağı yoksa açık kalır.

## ADRs

[ADR dizini](../decisions/). Yazılı kapsam değişir.
- 01 framework/schedule; SAS ilk trust13 ile değişti.
- 02 ilk slice; Files/Photos kapsamını05 genişletir.
- 03 pairing/offline; LAN merkezî önkoşullarını16 kaldırır.
- 04 cert/authority; Matrix-key12, SAS13, LAN önkoşulları16.
- 05 PC-first Files/Photos; LAN account/step-up önkoşulları16.
- 06 hesap/MFA/recovery; yalnız LAN bağımlılığı16 ile kalkar.
- 07 Matrix sınırı/continuity; LAN central/token/online şartı16.
- 08 upstream/cert; LAN DER/reissue/KMS şartı16; SDK istisnası26.
- 09 kanıtlı dilimler; fiziksel eski11 artık21.
- 10 operation-bound durable proof; değişmedi.
- 11 in-process native peer session; değişmedi.
- 12 Kloda P256; Matrix-key identity yerine.
- 13 QR LAN; SAS/account-first trust yerine.
- 14 ortak Rust QR core; ayrı engine yerine.
- 15 Desktop platform/signing isolation.
- 16 PC-local ACL; LAN JWT/KMS/24h/central-grant/DER-reissue yerine; pin/cert/revoke kalır.
- 17 Photos sidecar/import recovery; iOS ertelemesi step7 kapsamında kalktı.
- 18 receiver UI ayrılığında sürer; close-on-blur yerine, grant fence kalır.
- 19 device remove/trash/recover; bulut silme politikası değildir.
- 20 iOS LAN/native pairing; stub yerine, physical açık.
- 21 seçili Photos salt-okunur; geniş medya düzenleme yok.
- 22 LAN SMB3/FTPS, SFTP pin, native custody; plain FTP/broker yok.
- 23 açık etkin her hedefe bağımsız yedek; tek-PC dağıtım varsayımı yerine.
- 24 ayrı WebDAV Photos sidecar; PC Completed-ID sözleşmesini değiştirmez.
- 25 açık tek-isteklik review yetkisi; sessiz rebind/adoption yerine.
- 26 ortak Rust SMB/native sahip, D6/7/düzeltilmiş8; genel fork izni değildir.

## Rules

JWT/KMS LAN önkoşulu yok; close-on-blur/Wake-on-LAN yok; %100 yedekli/yansıtıldı iddiası yok. Foreground grant fence bypass yok. Legacy sahipsiz receipt/pending: hedef tahmin/silme yok; ağdan önce dur. Socket+route/generation kanıtı yoksa SMB parolası gönderilmez; şifresiz/DNS fallback yok.

## References

[Lovable](https://kloda-secure-photo-sync.lovable.app), rev `c144e98938da96f698f378972290ff3d1dd311eb`; [proje/snapshot](../ui/lovable-design-reference.md).
Yakalama: toplu script varsayılan; **kalıcı script/komut yok, bekleyen**. Kanıt [UI checkpoint](lovable-ui-interlude-checkpoint-2026-10-30.md); yeni UI işi araya alınmaz.
[Arşiv](archive/README.md), [sıra](expanded-execution-plan-2026-10-28.md) yalnız ilgili bölüm okunur.

[a26]: ../decisions/0026-shared-rust-smb-engine.md
[a22]: ../decisions/0022-advanced-destination-transport-and-credential-custody.md
[d8]: smb-route-bound-transport-decision-2026-10-31.md
