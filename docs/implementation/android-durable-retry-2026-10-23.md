# Android kalıcı erişim retry — 23 Ekim 2026

Kullanıcı mobil geliştirmeye devam edilmesini onayladı; ilk teslimde Android ve
iOS birlikte zorunlu. Bu dilim yalnız Android foreground sender için uygulanmıştır.
Windows araştırması genişletilmedi; D3 paralel oturumda açık kalır.

## Uygulanan kapsam

Mevcut `kloda-sync.sqlite` schema4 yalnız `files_run` çalışma/deneme kaydı ekler.
Dosya işleri, request/operation/ACK-offset, snapshot ve Completed/deletion
receipt'leri taşınmaz veya sıfırlanmaz. Schema3 yükseltmesi eski transfer tablolarını
tekrar kurmaz; schema1/2 geçişleri korunur. Uygulama gerçek kullanıcı DB'si açılarak
çalıştırılmadı; migration yalnız disposable kaynak-SQL kapsamında kontrol edildi.

Manuel çalışmada ilk dahil5 erişim denemesi vardır. Yalnız native
`lan_unavailable`/`connection_closed` sonrası60s beklenir; aynı çalışma ve varsa
önceden açıkça onaylı rebackup eylemi korunur. Yeniden açılışta devam eden çalışma
aynı bütçeyi sürdürür; terminal çalışmadan sonra açık Sync Now yeni run başlatır.
Yetki iptali, kimlik/TLS, source değişimi, suppression, çakışma, belirsiz native
sonuç ve yerel/storage hataları otomatik retry ile aşılmaz. Mevcut native
idempotent create/status/resume/finalize ve her-turn yetki kontrolleri değişmedi.

Aynı boot'ta elapsedRealtime beklemesi process restart ve wall-clock değişiminden
etkilenmez; BOOT_COUNT boot sınırını ayırır. Reboot sonrası eski monotonic proof
kullanılamaz: bütçe korunarak yeni60s minimum beklenir. Boot sayacı okunamıyorsa
otomatik retry güvenli durur ve anlaşılır hata gösterilir. Saatler yalnız retry
kontrolüdür; trust/continuity witness değildir.

Activity mevcut üç dilde run/attempt/due/hata gösterir; pasif retry kayıtları
paused'dır ve kendiliğinden başlayacak gibi sunulmaz. finished yalnız scan-return
anlamındadır; tüm dosyalar tamamlandı anlamına gelmez. Erken hata, dosya işi henüz
yokken de run üzerinde kalır. Aktif record filtresi ve kalıcı activation sırası,
eski PC çalışması sürdürülünce başka PC sonucunun görünmesini engeller.

## Yeni çalıştırılmış kanıt

- Mobile Jest6 suite /35 test PASS; lint ve TypeScript exit0.
- Ana ve instrumentation Kotlin compile exit0; ilk preBuild dört Android JNI ABI
  üretimini tamamladı. Sekiz Rust dead-code ve Gradle deprecation uyarısı vardır.
- Gerçek Kotlin retry modeli ve worker için host JVM kontrolleri PASS: bütçe,
  monotonic bekleme, missing boot, nonretryable disposition, paused view; altı
  worker vakası (5 failure, pause, success, early error, attention, wait failure).
  Journal test double'dır; native Android storage kabulü değildir.
- Üretim SQL disposable host SQLite kontrolü PASS: ek şema, reopen, activation,
  sayaç sınırı, receipt/tombstone koruması, terminal due temizliği.
- Expo iOS/Android JS export exit0. iOS native implementasyon kanıtı değildir.
- Ayrı reviewer geçişinde3 somut bulgu düzeltildi; son düzeltme ayrıca incelendi; engelleyici kaynak bulgusu kalmadı.

[Seçilmiş sonuç ve kaynak hash'leri](evidence/android-durable-retry-2026-10-23/result.json).
Worker test kaynağı/output/runner aynı public klasördedir; tüm `.local-evidence`
Git'e alınmadı. Raw araç çıktılarının tamamı bu kayıtla yeniden üretilmiş sayılmaz.

## Açık işler ve sınırlar

Native Android instrumentation kaynakları eklendi ve derlendi, çalıştırılmadı.
Gerçek süreç/SQLiteOpenHelper migration/runtime, cihaz/LAN kabulü NOT_RUN.
Bu dilim background/scheduled/Live yürütme, OS5min/5 bütçesi, program/source revision
ilişkisi veya mobile WebDAV atomik kaydını tamamlamaz. Ön plan fence'leri korunur.
Android suppression/rebackup runtime kabulü ayrıca açık kalır.

iOS native bridge, identity/route adapter, Files/Photos sender/import/restore ve
background gerçek eksiklerdir; Android kaynağı/JS export ile tamamlanmış sayılmaz.
İlk teslimde iki platform zorunluluğu değişmez. Mobil PC-first ekranlarının mevcut
Stitch diline uyarlanması mevcut tasarım belgesinde açık karardır; kullanıcıya
somut mevcut-bileşen uyarlaması soruldu. Cevap beklenirken bu UI yeniden tasarlanmadı.

Fiziksel duraklatma, Desktop platform engelleri ve Git işlem yasağı sürer.
Medya E2EE/key lifecycle, account/recovery, remote erişim, two-way/versions/conflict,
migration ve geniş galeri kapsamı görünür backlog'dur; sessizce kapatılmadı.
