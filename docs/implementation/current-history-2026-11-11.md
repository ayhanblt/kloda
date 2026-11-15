# CURRENT tarihî kayıt — 11.11.2026 öncesi ayrıntılar

Bu dosya başlangıç girdisi değildir. Güncel sıra ve durum için CURRENT.md kullanılır.
İçindeki eski promptlar yürütme talimatı değildir; yalnız ilgili bölüm gerektiğinde okunur.

Tarihî PASS taze kabul değildir.

**09.11 rol/akış:** OpenCode v2; GPT plan+review, Claude kodlama (AGENTS.md "Roles and workflow"). Sıra: geçmiş review → kalan geliştirme (Lovable eksikleri dahil) → tek regresyon → fiziksel kabul. Proje skill'leri `.opencode/skills/`: grill-me, systematic-debugging, verification-before-completion (üçü `opencode/autoinvoke: false`). 10.11 kullanıcı doğrulaması: üç skill OpenCode Desktop'ta yükleniyor; `.opencode/` commit edildi (650ec17); global `opencode api`/`opencode api *` shell deny çalışıyor ("Permission denied: shell", #53465; localhost curl'ü engellemez).

**11.11 süreç kuralları (kullanıcı kararı):** Geçmiş tek seferlik review tamam;
üç geçişin kaydı [claude-review-2026-11-11.md](claude-review-2026-11-11.md)
(16c/17 güvenlik B1–B4, Jest kök neden + saha eşleştirme, Lovable UI farkları
G1–G6). Teslim planı: Faz 0 backlog dondurma (GPT + tek grill-me) → Faz 1 küçük
teknik borçlar (B1, Jest spec, B3, B4, B2→20–21) → Faz 2 Lovable UI kapanışı
(G1 öncelik) → Faz 3 tek tam regresyon (kod/paket seviyesi güvenlik testleri
burada) → Faz 4 fiziksel kabul (cihaz/ağ seviyesi güvenlik; Android tam, iOS
simülatör + açık fiziksel-iOS kapıları, PASS denmez).
**Model/effort:** varsayılan plan/review GPT 6.1 Sol medium, geliştirme Claude
Opus 5.5 medium. High'a çıkılacak yerler: Faz 3/4 planları; native/güvenlik
(custody/journal/TLS) diff'lerinin geliştirmesi ve bağımsız review'u.
**Backlog disiplini:** Faz 0 çıktısı bu dosyada tek checkbox listesi olur.
Opus uygulama/doğrulama/devri yapar; maddeyi işaretlemeden "GPT review bekliyor"
bırakır. Ayrı GPT review'u kabul halinde review kaydını ve ilgili manifesti
günceller, maddeyi `[x]` yapar. Kapanış için ayrıca Opus oturumu açılmaz.
Her kapanışta "Sıradaki iş" ve hazır prompt güncellenir; açık kabul kapıları
korunur. Liste tarihçeye dönüştürülmez; biten fazlar tek satıra sıkıştırılır.
**Akış checkpoint'i (11.11):** OpenCode korunuyor; proje komutları bu kapanış
ve oturum sınırı kuralına uyarlandı: aynı iş/rolde araştırma, netleştirme ve
kapanış aynı sohbette; rol veya bağımsız iş değişince yeni sohbet. Her devir
`Durum / Devam: AYNI SOHBET–YENİ SOHBET–DUR / Rol / Komut veya prompt` verir.
Yeni sohbet iki-deneme sayacını sıfırlamaz. Önceki alt-adım başına yeni sohbet
talimatları geçersizdir. Proje komutları ayrıca kanıt kapsamı
kuralına uyarlandı. Review'da yalnız durum belgesinin tarihî satır aidiyeti
eksikliği, mevcut içerik/diğer kabul ölçütleri doğrulanabiliyorsa engelleyici
değildir; ürün/güvenlik/ADR belirsizlikleri ayrı değerlendirilir. Sonraki
uygulamalar değişecek dosyaların başlangıç içeriğini/diff'ini dar kapsamda
kaydeder. Mevcut B4 kabul kararı ayrı review oturumunda verilecektir.
Planlar hedef dosya/sembol, değişecek davranış ve kabul
ölçütünü belirtir. Bu düzenleme ürün backlog maddelerini kapatmaz.

## Teslim backlog'u — 11.11.2026 / kullanıcı onaylı sınır

Tek yürütme sırası aşağıdadır; eski bölümlerdeki "Sıradaki" ve promptlar tarihî
bağlamdır, bu sırayı değiştirmez. Her geliştirme işi önce ayrı GPT planı, sonra
Claude uygulaması ve ayrı oturumda gerçek diff üzerinden GPT review'u alır.

- [x] **Faz 0:** kaynakları eşleştir, tek grill-me ile kapsamı netleştir ve backlog'u dondur (11.11).
- [x] **1.1 / B1:** SMB/SFTP/FTPS UUID üretimi mevcut native desene taşındı; bağımsız GPT diff review kabul (11.11). Kullanıcı kararlı build/link kapsamı; gerçek JS→native runtime kapısı açık, Faz 3 planında ele alınacak.
- [x] **1.2 / Jest:** `s3-diagnostic-page.spec.tsx` AppState listener spec'i düzeltildi; ürün davranışı değişmedi, bağımsız GPT gerçek-diff review kabul (11.11).
- [x] **1.3 / B3:** FTPS sahipli parola/JNI JSON kopyalarına Drop-zeroize (zeroize 1.9.1); bağımsız GPT `/review` kabul (11.11), P3 yalnız belge notu. ADR sapması kabul edilmedi; FTPS/JNI runtime ve fiziksel kapılar açık, Faz 3/4.
- [x] **1.4 / B4:** Android S3/FTPS vault kilit politikası değerlendirmesi + bağımsız GPT belge review'u kabul (11.11); bayrak yok, kalan risk kararı korunur. R1 tarihî CURRENT aidiyeti kanıtlanamadı; kullanıcı kararıyla tek başına engel değil. F1/1.4b ve Faz 3/4 açık; runtime/fiziksel güvenlik PASS'i değil.
- [ ] **1.4b / F1:** Kilitliyken tetiklenen S3/FTPS otomatik işi planı iptal ediyor ([B4 §5](b4-android-vault-lock-policy-2026-11-11.md)). Ayrı GPT planı: kilitliyken güvenli bekleme korunarak kilit açılınca planın kaybolmaması/yeniden çalışabilmesi; OS arka plan sınırında anında çalışma garantisi yok.
- [ ] **1.5 / regresyon hazırlığı:** iOS WebDAV journal host testini onar; cesu8/instant-xml/instant-xml-macros lisans metinlerini tamamla; B2 iOS S3 fixture-CA marker'ının release app binary'sinde yokluğunu 20–21 dağıtım kontrolüne bağla.
- [ ] **2.1 / G1:** Mobil Etkinlik'te gerçek journal verisiyle Şu an/Geçmiş segmentleri; demo state kopyalama.
- [ ] **2.2 / G2–G3:** Desktop tray gerçek kontrolleri, ayarlar sürüm satırı ve kapanış davranışı eşlemesi; ADR0018 foreground fence ve Linux görünür kontrol şartını koru.
- [ ] **2.3 / G4–G6:** Mobil ayarlar için gerçek native yetenek/kapsam kararını netleştir; D10 kaynak seçimi birleşimini belgele; kilit ekranını mevcut step19 kapısında tut. Demo switch veya yeni native yetenek izni varsayma.
- [ ] **2.4 / saha ürün açıklığı:** Eşleşme bekleme/onay sırası, aktarım durumları, WebDAV tam endpoint/port/yol ve sır sızdırmayan aşamalı hata sunumu; teşhis olmadan retry/güvenlik fence gevşetme.
- [ ] **2.5 / yakalama:** Mevcut betikleri kullanarak eksik ekran/dil kapsamını kalıcı toplu capture'a tamamla; hazır olmadan runnable komut iddia etme.
- [ ] **3 / tek tam regresyon:** high GPT planı; fixture/tek temsilci yolu önce kanıtla, sonra JS/native/build, kod/paket güvenliği (B2 dahil), a11y/görsel ve performans kapsamı. Tek giriş iskeleti/manifest; açık Dropbox Android JobService, iOS >150 MiB upload_session, Dropbox Photos/eklenmiş Nextcloud restore, Android yükseltme ve recovery göster/kopyala kontrollerini kapsa. Gerçek hesaplar ayrı izinli; başarısızlıklar scoped fix/review'a döner, yalnız etkilenen kontroller tekrarlanır. Bağımsız GPT diff review ve dağıtım kapıları görünür kalır.
- [ ] **4 / fiziksel kabul:** high GPT planı; Android tam cihaz/OS/ağ kapsamı, Desktop lifecycle/signing/storage ve saha kesintisi kök neden teşhisi. iOS Simulator kanıtı ayrı raporlanır; fiziksel iOS yoksa signing/custody/OS/Photos/iCloud kapıları açık kalır, PASS denmez. Mevcut veri/eşleşme korunur; cihaz/hesap/medya kapsamına yeni açık izin gerekir.

**Onaylı teslim sınırı:** Saha açıklık/teşhis iyileştirmeleri dahil. Uzak WebDAV
klasör gezgini, yeni CA/auth/mTLS desteği ve okunabilir export bu teslimin dışında;
ayrı tasarım/kapsam onayı gerekir. CloudMe engelli, Kolab Now/Box/MEGA/GCS V1 dışı
kararları korunur; yeni sağlayıcı/yükleme adaptörü otomatik eklenmez.

**Teslim notuna zorunlu A5 kaydı:** Finder'da özgün dosya adı/uzantısı ve cihaz
etiketiyle okunabilir sunum/export bu teslimde yok. Arşiv fingerprint/operation-ID
düzenini kullanır; retained `.part` hardlink'leri ikinci veri kopyası veya otomatik
silinebilir çöp sayılmaz. Journal/inode/publication bağları korunur; yeniden
adlandırma/silme yapılmaz. A5 kapanmış veya düzeltilmiş olarak raporlanmayacak.

**Açık karar/kabul kapıları:** ADR0029 kabulü, iOS16 runtime davranışı, P5 production
sağlayıcı/at-rest, release imzaları/provider/storage ve 20–21 fiziksel kapıları.
Tarihî PASS taze kabul değildir; kaynak/varyantı eşleşen kanıt yeniden kullanılır.

### 1.1 / B1 — GPT uygulama planı / 11.11.2026

**Amaç ve bulgu:** Üç `use-*-items.ts:36` çağrısı `crypto.randomUUID()` kullanıyor;
yerel `jest-setup.js` yalnız Reanimated kuruyor. Bu oturum runtime yeniden üretimi
yapmadı. Review B1'in kaynak karşılığı doğrulandı. Çalışan desen:
`use-s3-items.ts:37–39` → `s3.newRequest()` → UUID biçimi doğrulanan senkron
`s3TestRequest`; Android `UUID.randomUUID().toString()`, iOS
`UUID().uuidString.lowercased()`. Üç protokolün kendi native modüllerinde henüz
bu fabrika yok. UUID yalnız istek kimliğidir; tek başına yetki vermez.

**Seçilen dar çözüm:** S3 desenini protokolün kendi modülüne taşı. S3 modülüne
bağımlılık, global polyfill, yeni paket, Math.random/zaman tabanlı fallback veya
ortak hook refactor'u yok. Native köprüye eklenen üç senkron fonksiyon bu planın
açık kapsamıdır: `smbRequest`, `sftpRequest`, `ftpsRequest`; mevcut fonksiyonların
imzaları ve Rust/C/JNI ABI değişmez. Bu ek kapsam uygulama talimatıyla açıkça
onaylanmadan kodlamaya geçilmez; daha fazla dosya/ABI gerekiyorsa tekrar onay al.

**Hedef dosyalar (brace grupları listedeki üç dosyanın her birini ifade eder):**
- `apps/mobile/src/features/file-transfer/model/use-{smb,sftp,ftps}-items.ts`
  (3): yalnız UUID edinimi ve fabrikadan hata gelirse güvenli duruş.
- `apps/mobile/src/shared/api/{smb,sftp,ftps}.ts` (3): native interface'e ilgili
  senkron fabrika; API nesnesine `newRequest(): string`. Eksik modül/fonksiyonda
  mevcut `native_unsupported`, geçersiz UUID'de `outcome_unknown`; native hataları
  mevcut protokol hata yoluyla göster. UUID'yi mevcut `uuid`/`text` ile doğrula.
- `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/Kloda{Smb,Sftp,Ftps}Module.kt`
  (3): yalnız ilgili senkron UUID `Function` kaydı.
- `apps/mobile/modules/my-module/ios/Kloda{Smb,Sftp,Ftps}Module.swift` (3): yalnız
  ilgili senkron UUID `Function` kaydı; mevcut `KLODA_*_NATIVE` sınırını koru.
- `apps/mobile/src/shared/api/{smb,sftp,ftps}.spec.ts` (3): fabrika kontratı.
- `apps/mobile/src/pages/activity/ui/{smb,sftp,ftps}-items-panel.spec.tsx` (3):
  mock'lara `newRequest` ekle; review/restore ve iptal testlerini burada genişlet.
- Devir belgesi: yalnız bu dosyanın checkpoint/promptu ve
  `docs/implementation/evidence/b1-uuid-2026-11-11/` altında log/tek manifest.
  Toplam uygulama sınırı 12 ürün + 6 mevcut test dosyası; yeni test framework'ü yok.
  S3 dosyaları, `*-backups.ts`, journal/vault/engine ve UI bileşenleri salt-okunur.

**Korunacak davranışlar:**
- `act` guard'ları (active/busy/page, review'da yalnız file), tek istek ve yeni
  aksiyonda yeni ticket; `copy`/`restore` ile `cancel` aynı ticket'ı kullanır.
- Fabrika çağrısı mevcut guard'lardan sonra, request/busy/choosing kurulmadan önce
  try/catch içinde olur. Başarısızlıkta copy/restore/cancel çağrılmaz; working takılı
  kalmaz, hata görünür ve sonraki açık aksiyon tekrar denenebilir. SFTP/FTPS kendi
  hata normalizer'larını, SMB mevcut Error.message/outcome_unknown yolunu korur.
- Review foreground kaybında iptal edilir; Photos restore da iptal edilir.
  Files restore'un native picker handoff istisnası aynen kalır; native dönüşteki
  target/context kontrolü gevşetilmez. Unmount/açık cancel istek yetkisini düşürür.
- Epoch/mounted/active kontrolleri geç sonucu UI'a taşımaz; issues sonrası mevcut
  reload, pagination ve targetId birleştirmesi değişmez. UUID fabrikası herhangi
  bir grant başlatmaz, journal/network/credential işlemi yapmaz.
- ADR0022 preserved boundaries + FTPS practical verification değişmez: bilinmeyen
  ACK ile retry/adoption/Completed yok. ADR0025'in açık tek-isteklik review ilkesi
  korunur; WebDAV fixture izni bu işe genişlemez. TLS/pin/LAN/generation/custody,
  varsayılan opt-in kapalı hali, PC-local ACL ve kullanıcı verisi değişmez.

**En dar doğrulama (Claude; önce tek temsilci, sonra yalnız etkilenen kapsam):**
1. Başlangıç HEAD + tracked/untracked diff envanterini al; mevcut node_modules ve
   test çalıştırıcısını kontrol et, paket kurma/yükseltme. Proje systematic-debugging
   ve verification-before-completion skill'lerini uygula; iki başarısız denemede dur.
   Açık ürün kararı yok; yeni grill-me veya tasarım/capture kurulumu gerekmez.
2. Önce FTPS panel spec'inde global crypto/randomUUID yokken restore aksiyonunu
   kapsayan regression testi yaz; özgün kodda doğru sebeple kırmızı olduğunu kaydet.
   Global descriptor'ı test sonunda geri yükle. Factory mock'u benzersiz ticket
   döndürsün; ürün düzeltmesinden sonra aynı test yeşil olmalı. Mock fabrika eklemek
   tek başına gerçek native köprü doğrulaması değildir.
3. Sonra bu üç panel spec'i ve üç API spec'ini tek dar batch'te çalıştır. Her
   protokolde geçerli UUID, eksik modül/fonksiyon, bozuk tip/UUID, fabrika throw'u;
   global crypto olmadan Files restore ve file review çağrısında exact ticket;
   review background iptali + geç başarıyı yok sayma; mevcut Photos iptal testi;
   Files picker geçişinde JS'in iptal etmemesi, açık cancel/unmount'ta exact ticket;
   busy/foreground guard'ında yeni ticket üretilmemesi kapsansın. Fabrika hatasında
   çağrı yok/working false ve sonraki aksiyonla toparlanma doğrulansın.
   Mevcut testleri yalnız hook/API değişikliğinden etkilendikleri için tekrar koş.
   `apps/mobile` çalışma dizininde mevcut `npm test -- --runTestsByPath` komutuna
   yukarıdaki altı spec'in `src/` ile başlayan, brace'leri açılmış yollarını ver.
   Ardından mobil `tsc --noEmit` ve yalnız değişen TS/TSX için mevcut ESLint'i çalıştır;
   300 satır sınırı dahil. Komut/exit code/tam çıktı logda kalsın.
4. Native Function eklendiğinden yalnız Jest ile kapanış yapma. Mevcut kanıtlardaki
   gerçek build komutlarını/flag'leri manifestten hedefli al; burada yeni runnable
   native komut veya fixture varmış gibi varsayma. Önce tek Android arm64 Hermes
   uygulama varyantında üç native modülün etkin/yüklü olduğunu kanıtla; her gerçek
   fabrikadan iki geçerli/farklı UUID al. Ardından tek iOS arm64 Simulator varyantında
   aynı üç senkron export'u build/link + köprü üzerinden doğrula. Ağ, gerçek hesap,
   picker/medya mutasyonu veya fiziksel cihaz gerektirmeyen izole yol kullan.
   Mevcut smoke aracı bunu yapamıyorsa yeni araç/dosya eklemeden kapsam onayı iste;
   altyapı/izin yoksa NOT_RUN ve açık köprü kapısı raporla. Yeni binary gerekir;
   yalnız Metro reload yeterli sayılmaz. Rust yeniden paketleme/6 ABI/tam regresyon yok.
5. Kaynak taramasında üç hook'ta `crypto.randomUUID` kalmadığını doğrula. Manifest:
   başlangıç HEAD, değişen kaynak/varyant hash'leri, komutlar, sonuçlar ve açık kapılar.
   Bu plan oturumunda test/build çalışmadı; eski PASS yeniden kabul edilmedi.

**Claude handoff / review çıkışı:** Ayrı kullanıcı-başlatmalı Claude Opus oturumu;
native köprü ve güvenlik fence'ine komşu diff nedeniyle CURRENT kuralınca high effort
önerilir (bu GPT oturumu model/effort değiştirmedi). Sadece yukarıdaki kapsamı uygula;
önce başlangıç durumunu kaydet. Plan anındaki HEAD
`650ec17f300ebdeee804bd4218f5b57356eecb21`; önceden değişmiş `CURRENT.md` ve untracked
`claude-review-2026-11-11.md` kullanıcı girdisidir, sahiplenme/üzerine yazma.
Review devrinde gerçek tracked+untracked diff kapsamı, başlangıç HEAD, çalıştırılan
komut/log yolları, taze ve yeniden kullanılan kanıt ayrımı, açık kapılar bırak.
Bu oturum hiçbir tarihî test kanıtını taze doğrulama yerine kullanmadı; ileride
reuse ancak kaynak/varyant hash eşleşmesiyle. Ayrı GPT gerçek-diff review'u olmadan
1.1 kapanmış sayılmaz; checkbox şimdilik açık. B2–B4, Jest 1.2, UI ve tam regresyon
başlatılmaz; fiziksel/production kabul kapıları aynen açıktır.

**Checkpoint (Claude uygulaması, 11.11):** Başlangıç HEAD `650ec17`; plan kapsamı
birebir uygulandı (12 ürün + 6 test dosyası, üç senkron `smbRequest`/`sftpRequest`/
`ftpsRequest`; iOS eklemeleri yalnız `KLODA_*_NATIVE` dalında; ABI/Rust değişmedi).
Hook'lar S3 desenini izler: fabrika guard'lardan sonra, epoch/request/busy kurulmadan
önce; hata görünür, native çağrı yok, sonraki aksiyon toparlar. Taze: FTPS regression
özgün kodda doğru sebeple kırmızı; 6 spec/36 test, tsc, 12 dosya ESLint PASS; üç hook'ta
`crypto.randomUUID` 0. Android arm64 Hermes debug assembleDebug PASS (Rust UP-TO-DATE,
dex'te üç Function). iOS üç bayraklı pod install + arm64 Simulator Debug build PASS
(2. denemede; ilk deneme komut bayrağı), dylib'de üç Function ve native dal sembolleri.
**Açık:** gerçek runtime JS→native fabrika çağrısı iki platformda NOT_RUN — tek seferlik
CDP eval iki denemede başarısız (origin reddi; sonra Runtime.evaluate yanıtsız), iki-deneme
kuralıyla durdu; kullanıcı kararıyla seçenek 2'ye (build/link) düşüldü. Kanıt:
[manifest](evidence/b1-uuid-2026-11-11/manifest.json) (loglar diskte, `*.log` gitignore).
Ortam: AVD KlodaFtps16c'ye debug APK kuruldu (veri/aksiyon yok), iOS Pods üç bayrakla
yeniden üretildi (untracked). Aynı-oturum review'u bağımsız değildir. Commit/push yok;
1.1 checkbox'ı GPT review'una kadar açık.
**Checkpoint (bağımsız GPT review, 11.11):** [Review ve kanıt eşlemesi](evidence/b1-uuid-2026-11-11/review.md).
HEAD `650ec17`; 18 mobil dosya (+354/-54) planla uyumlu, düzeltme gerektiren kod
bulgusu yok. 18/18 kaynak ve Android APK/iOS dylib hash'i manifestle eşleşti;
guard/ticket, picker ve foreground fence'leri korunuyor. Kayıtlı 36 test/tsc/lint
ve build/link kanıtı yeniden kullanıldı; test/build tekrarlanmadı. Kullanıcının
yukarıda kayıtlı build/link'e düşme kararı kapsamında 1.1 uygulama+review kapandı.
**Runtime PASS değil:** Android ve iOS gerçek JS→native fabrika çağrıları NOT_RUN;
Faz 3 planında matris genişlemeden önce ele alınacak. Üçüncü CDP denemesi yapılmadı;
fiziksel/production kapıları açık. Ürün değişikliği ve commit/push yok.
### 1.2 / Jest — Claude uygulama checkpoint'i / 11.11.2026

Başlangıç HEAD `650ec17` (1.1 değişiklikleri hâlâ commit'siz, dokunulmadı). Diff: yalnız
`apps/mobile/src/pages/connections/ui/s3-diagnostic-page.spec.tsx` (+7/-5), ürün kodu
değişmedi. Kök neden kaynakta teyit: S3Page `use-s3-backup` + iki `S3ItemsPanel`
listener'ı kaydediyor; spy yalnız sonuncuyu tutuyordu. Düzeltme: handler Set'i, tüm
canlı handler'lara dağıtım, `remove()` kendi handler'ını siler, unmount sonrası
`handlers.size===0`. Taze: özgün spec kırmızı (satır 35, `cancelTest` çağrılmadı), sonra
3/3 PASS (act/console uyarısı 0), mobil tsc ve dosya ESLint PASS. Tam Jest koşulmadı
(Faz 3). Kanıt: [manifest](evidence/jest-1.2-2026-11-11/manifest.json). Aynı-oturum
review'u bağımsız değildir; 1.2 checkbox'ı GPT review'una kadar açık. Commit/push yok.
**Checkpoint (bağımsız GPT gerçek-diff review, 11.11):** 1.2 kabul; düzeltme
gerektiren bulgu yok. Güncel HEAD başlangıç `650ec17f300ebdeee804bd4218f5b57356eecb21`
ile aynı. `00-start.log` tracked/untracked envanterine göre ek kapsam yalnız spec
ve 1.2 kanıt dizini; önceki dosyalardan eksilen yok, 1.1'in 18/18 kaynak hash'i
manifestiyle eşleşiyor. `05-spec.diff` gerçek diff ile byte düzeyinde aynı (+7/-5).
Spec HEAD SHA256 `5f90e778714af54de4809ceb66916f4130ec19b7feb3e6386f6c8ee1f487f5f6`,
güncel SHA256 `587027cf4c93aa3604ccd105d472e0eae5016d228f71e7971bb7d9d86b1ecf55`;
ikisi de 1.2 manifestiyle eşleşti. `use-s3-backup`, `use-s3-items`, `s3-page` ve
`s3-items-panel` başlangıç HEAD'iyle aynı: tek handler yerine canlı handler Set'i
üç listener'a da olay ulaştırıyor; her remove kendi kaydını siliyor, unmount'ta Set
boşluğu doğrulanıyor. Exact-ticket, ikinci iptal ve geç başarıyı reddetme assertion'ları
korunmuş; ürün/foreground fence davranışı değişmedi. Taze: salt-okunur HEAD/envanter,
hash/diff/kaynak incelemesi ve scoped `git diff --check` (exit 0). Yeniden kullanılan:
`01-red.log` doğru sebeple kırmızı, `02-green.log` 3/3 ve uyarısız, `03-tsc.log` ve
`04-eslint.log` exit 0; ilgili ürün kaynakları, package/lockfile, mobil tsconfig ve
Jest setup HEAD ile aynı. Test/lint/typecheck/build tekrar çalıştırılmadı; manifest
spec hash'i kaydeder, tam dependency ağacı/node_modules hash'i iddiası yok. Tam Jest
Faz 3'te açık; 1.1 gerçek JS→native runtime NOT_RUN ve fiziksel/production kapıları
değişmedi. Yalnız CURRENT kabul kaydı güncellendi; ürün/test koduna dokunulmadı,
commit/push yok. Manifestteki bağımsız-review açık kapısını bu checkpoint kapatır.
### 1.3 / B3 — GPT uygulama planı / 11.11.2026

**Durum:** Plan anı: salt-okunur keşif. Uygulama yapıldı, aşağıdaki Claude checkpoint'ine bak; checkbox GPT review'una kadar açık.
Plan başlangıç HEAD `650ec17f300ebdeee804bd4218f5b57356eecb21`. Mevcut 1.1/1.2
ürün/test/kanıt değişiklikleri, untracked review ve `.opencode/commands/` kullanıcı
çalışmasıdır; korunur. Bu oturum yalnız CURRENT ve plan devir dosyasını değiştirir.
`.opencode/plans/next-plan.md` mevcut değil; proje `plan`/`implement` komutlarının
seçtiği [devir yolu](plans/next-plan.md) kullanılır; komut dosyaları değiştirilmez.

**Amaç / karar sınırı:** Review B3 (`claude-review-2026-11-11.md:15–16`) için
FTPS motorunun sahip olduğu parola ve JNI JSON tahsislerine Drop-zeroize ekle.
ADR0022 D1, preserved boundaries ve FTPS practical verification korunur. ADR
metni açık bir tüm-bellek-zeroize şartı tanımlamaz; review'daki sapma alternatifi
kullanıcıca kabul edilmiş değildir. ADR'ye kabul/sapma notu ekleme; tüm native veya
üçüncü-taraf kopyalarını kapsayan yeni güvenlik garantisi verme. Bu plan uygulama
oturumunda açık kullanıcı talimatıyla yetkilendirilir; kapsam büyürse tekrar onay al.

**Kaynakla doğrulanan sahiplik ve ömürler:**
- Android: `AndroidFtpsProfile.password` ve `AndroidFtpsPublication.request` /
  `AndroidFtpsDownload` JSON'u JVM `String`'leridir; native vault/captured profile
  sahibi ve GC tarafından yaşatılır, Rust bunları temizleyemez. JNI
  `android_jni.rs:95–101` `get_string` sonucundan ayrı, sahipli Rust `String`
  üretir; boyut/callback reddi dahil `run` dönüşüne kadar yaşar. Başarılı yolda
  C köprüye yalnız senkron `as_ptr/len` borcu verilir; çağrı bitmeden temizlenemez.
- iOS: `IosFtpsPublication.swift:36–58` yerel JSON `Data`'sı ve
  `IosFtpsDownload.swift:35–58` `ReadOwner.request` verisi Swift sahibinde kalır;
  `withUnsafeBytes` C'ye senkron borç verir. Rust `bridge.rs:82–85` bu girdiyi
  değiştirmez/sahiplenmez; `*const` veriye zeroize yazımı veya yeni JSON kopyası yok.
- İki platform: `Request.password: String` (`request.rs:10`) Serde'nin ayrı
  sahipli tahsisidir. Request, `bridge::run` içindeki parse → validate → TLS/login
  → publish/download → close süresince yaşar, normal dönüş/hata ve unwind'da
  düşer. `Session` parolayı alan olarak tutmaz; `session.rs:95` login'e borç verir.
  Request tamamlanmadan parse hatasında sıradan String alanı düşebilir; yalnız
  `impl Drop for Request` bu kısmi deserialize yolunu kapsamaz.
- Daha kısa ömür zorlamak (login sonrasında temizleme), username silme, JVM/Swift
  custody refactor'u bu işte yok. Mevcut işlem-süresi ömrü korunur. Drop, abort/kill
  veya bellek dump'ına karşı garanti değildir. Serde escape/scratch/reallocation,
  JNI dönüşüm geçicileri, suppaftp `login` → `Command::Pass(String)` → formatlanan
  `PASS` ve TLS/OS tamponları ayrıca kopya üretebilir; bu plan onları temizlemez.
  Bunlar kabul edilmiş ADR sapması veya B3'ün tüm süreç belleğini temizlediği iddiası
  değildir; daha geniş temizlik talebi yeni kapsam kararı gerektirir.

**Bağımlılık / seçilen çözüm:** FTPS Cargo.toml'da doğrudan zeroize yok;
Cargo.lock'ta rustls/rustls-pki-types üzerinden `zeroize 1.9.1` zaten var. S3'ün
doğrudan pini de `=1.9.1`. FTPS'ye `zeroize = { version = "=1.9.1", features =
["serde"] }` ekle; default alloc korunur, derive/new crate/version yükseltmesi yok.
Lockfile yalnız FTPS doğrudan bağımlılık ve zeroize→serde kenarını yansıtmalı;
beklenmeyen paket/sürüm/license değişiminde dur. `Request.password` alanını
`Zeroizing<String>` yap: tam Request ve password alanı başarıyla parse edildikten
sonraki kısmi-Request hatalarında alan Drop'u korur. JNI sahipli JSON String'i
oluşturulduğu noktada `Zeroizing::new` ile sar; erken return'ler de aynı korumada
kalsın. Ek parola/JSON clone'u veya kalıcı global sahibi ekleme.

**Kesin dosya sınırı (6 mevcut dosya; testler iç modüllerde):**
1. `packages/ftps-native/Cargo.toml` ve `Cargo.lock` (2): yukarıdaki pin/feature.
2. `packages/ftps-native/src/request.rs`: parola tipi/import ve dar unit testler.
3. `packages/ftps-native/src/android_jni.rs`: yalnız sahipli JSON RAII sargısı;
   C/JNI parametreleri, FD/callback sırası ve dönüş kodları değişmez.
4. `packages/ftps-native/src/session.rs`: login'de username/password için aynı
   `&str` görünümü (`as_str`; login tek generic S kullanıyor); iki mevcut test
   Request literal'ında açık `Zeroizing::new(String::from(...))` uyarlaması.
   Üretim TLS/login/transfer akışını yeniden düzenleme.
5. `packages/ftps-native/src/bridge.rs`: yalnız `#[cfg(test)]` dar C-boundary
   negatif/FD kontratı testleri; üretim kodu salt-okunur.
Ek izinli çıktı: CURRENT, mevcut plan devir dosyası ve
`docs/implementation/evidence/b3-zeroize-2026-11-11/` altında tek manifest/loglar.
Yeni test framework/helper/script, Kotlin/Swift/TS, header/ABI, vault/journal,
paketleme betiği veya başka protokol değişikliği yok. Üretilen native çıktılar
aşağıdaki kapsamda ayrıca kaydedilir; kaynak dosya sınırına gizlice eklenmez.

**Korunacak davranışlar:** JSON camelCase/deny_unknown_fields, parola UTF-8 byte
sınırı 1–4096/kontrol-karakter reddi; UUID/path/size/timeouts ve numeric hata
kodları aynen kalır. C girdisi salt-okunur, çağrı senkron; callback/context yalnız
çağrı boyunca borçtur. İki FD hata dahil bir kez tüketilir, eşit-FD bir kez kapanır.
AUTH TLS/PROT P, public-root+hostname, LAN control/data peer+generation/revoke
fence'leri ve varsayılan opt-in kapalı hali değişmez. Journal Intent→Uploaded→
Verified ve taze full-readback/size/SHA256 şartı korunur; kayıp ACK review'da,
kör retry/hash-only adoption/otomatik Completed yok. Vault/recovery/PC-local ACL,
foreground/picker, kullanıcı verisi/eşleşmesi ve B4 kilit politikası değişmez.

**En dar doğrulama (yalnız sonraki Opus oturumunda):**
1. Başlangıç HEAD + tracked/untracked envanter/hash'lerini kaydet; proje systematic-
   debugging ve verification-before-completion kurallarını uygula. Rust1.99.0
   rustc/rustdoc/Clippy, mevcut registry/toolchain ve NDK27.1.12297006/SDK erişimini
   bir kez kontrol et; kurulum/yükseltme veya fixture canlandırma yapma. Lock
   güncellemesini dar/offline çözümle; sonra tüm cargo kontrollerinde `--locked`.
2. Önce tek host temsilci: geçerli Request JSON decode/validate ve password alanının
   `ZeroizeOnDrop` kontratını kapsayan yeni unit test. Ardından aynı request modülünde
   0/4096/4097-byte, multibyte/escape, kontrol karakteri; password sonrasında bozuk/
   eksik/duplicate/unknown alan parse reddi. Açık `zeroize()` sonrası boşluk kontrolü
   yalnız primitive davranışını kanıtlar; Drop için upstream1.9.1 uygulaması ve
   trait/source kontratıyla birlikte raporla. Serbest bırakılmış belleği okumak,
   UB/allocator gözlem düzeneği veya test için ürün telemetry'si eklemek yok.
3. Mevcut iç test modüllerinde C publish/read için invalid JSON, validation,
   callback eksikliği/erken ret ve eşit/ayrı FD tüketimini izole local FD'lerle
   doğrula; ağ/hesap/medya yok. Error::Invalid kodu ve girdinin değiştirilmediği
   doğrulansın. Host `cargo test --locked --lib` ve `--features android-jni` dar
   koşularını ilgili FTPS manifestiyle çalıştır; JNI sargısı iki export'un ortak
   run yolunda kaynak incelemesi + feature compile ile denetlenir. Bu, gerçek
   JVM çağrısı veya heap-instrumented zeroization kanıtı sayılmaz.
4. FTPS için fmt check ve Clippy (`--locked --lib --features android-jni`,
   `-D warnings`); test-only kod dahil kontrol et. TS/Swift/Kotlin kaynakları
   değişmediğinden mobil Jest/tsc/lint ve eski medya/LAN/OS matrisini tekrarlama.
   FTPS Rust hash'i değiştiği için eski engine/runtime PASS'ini yeni binary'ye
   aktarma. Eski 16c manifest/checkpoint yalnız davranış ve komut referansıdır;
   değişmeyen kaynak/varyant kanıtı ancak hash eşleştirmesiyle reuse edilir.
5. Native paketleme: önce `node tools/check-ftps-native.mjs aarch64-linux-android
   --release`, ardından `aarch64-apple-ios-sim --release` (aynı betik). Bunlar tek
   temsilci compile/export kontrolleridir, ürün paketini henüz yenilemez. İkisi
   geçince stabil kaynakta bir kez `node tools/build-ftps-native.mjs android` ve
   `node tools/build-ftps-native.mjs ios`: dört Android ABI `.so` ve iki arm64
   iOS archive içeren XCFramework yeniden üretilmeli. Android16KB/C+JNI exports,
   Apple C exports, fixture marker yokluğu mevcut betiklerin kapılarıdır.
   Betikler temsilci compile'ları tekrar çağırır; aynı output/cache kullan, ayrı
   ikinci matris açma. Fixture CA env/owned-fixture üretim paketine giremez.
6. Paket hedefleri: `apps/mobile/modules/my-module/android/src/main/jniLibs/
   {arm64-v8a,armeabi-v7a,x86_64,x86}/libkloda_ftps_native.so` ve
   `apps/mobile/modules/my-module/ios/NativeFtps/KlodaFtpsNative.xcframework`.
   Kopyalanan `NativeFtps/kloda_ftps.h` byte olarak değişmemeli. Ignored/generated
   çıktıları da hash/envanterde açıkça göster. Yalnız FTPS yeniden paketlenir;
   S3/SFTP/SMB/pairing paketlerini yeniden üretme.
7. Ardından tek FTPS-etkin Android arm64 app build/link ve tek arm64 iOS Simulator
   app build/link: en son B1 manifest/loglarındaki gerçek komut/flag/output yolunu
   hedefli oku; build zinciri başka native paketleri gereksiz yenileyecekse dur ve
   sınırı bildir. Üç mevcut B1 native Function'ı ve feature flag'lerini koru;
   native yeniden link gerekir, Metro reload yeterli değildir. Yeni ABI/export/
   Pod dependency yok, pod install/prebuild varsayılan adım değildir. Device iOS
   archive paketlenir; signed device app/release/fiziksel çalıştırma yapılmaz.
   Runtime FTPS/JNI/gerçek TLS/LAN ve bütün güvenlik regresyonu Faz3'te taze binary
   hash'leriyle açık kalır; B1'in runtime NOT_RUN kapısı bu işle kapanmaz.
8. Her adım komut/exit code/log, kaynak/artifact SHA256, toolchain/features,
   taze/reuse/NOT_RUN ayrımıyla tek manifestte kalır. Temsilci başarısızsa matris
   genişletme; aynı yaklaşım iki kez başarısızsa dur. Bağımlılık/ABI/dosya sınırı
   büyümesi, geniş native bellek garantisi veya ADR değişikliği tekrar onay ister.

**Doküman dayanağı:** Context7 resolve+docs ile Zeroizing Drop/serde ve
String-capacity/reallocation sınırlamaları kontrol edildi (latest indeks);
exact yerel registry `zeroize-1.9.1/src/lib.rs:695–732`, `Cargo.toml:52–80`
ile doğrulandı. serde feature mevcut serde'yi kullanır; derive bağımlılığı gerekmez.
suppaftp12.2.1 `src/sync_ftp.rs:332` ve `src/command.rs:142,246` login kopyalarını
doğrular. Bunlar salt-okunur kaynak bulgularıdır, test/build PASS değildir.

**Checkpoint / kabul kapısı:** Bu oturumda test/lint/typecheck/build/paketleme,
uygulama/fixture/cihaz başlatma yapılmadı. B3 kapanmadı; ürün kodu ve ADR değişmedi.
Opus uygulaması sonrası ayrı GPT gerçek tracked+untracked diff review'u zorunlu;
aynı-oturum self-review bağımsız sayılmaz. 1.4/B4, tam regresyon ve physical/
production/signing kapıları bu işin dışında kalır. Commit/push yok.
**Checkpoint (Claude uygulaması, 11.11):** Başlangıç HEAD `650ec17` (plan HEAD ile
aynı). B1 18/18 + 1.2 spec hash-doğrulandı; diğer önceden mevcut untracked içeriklerin
değişmezliği doğrulanamadı (başlangıç hash'i yok; yalnız varlıkları doğrulandı). Diff yalnız 6 planlı dosya (+237/-6):
`zeroize =1.9.1` + serde (lock yalnız iki kenar, yeni paket/sürüm yok);
`Request.password: Zeroizing<String>`; JNI sahipli JSON oluşturulduğu yerde
`Zeroizing`; session yalnız `login(as_str, as_str)` + iki ignored test literal'i;
bridge yalnız `#[cfg(test)]` C-boundary testleri. ABI/header (byte-eşit), Kotlin/Swift/
TS, betikler ve diğer native paketler değişmedi. Taze (rustup 1.99.0; PATH'teki
Homebrew 1.98.1 kullanılmadı): host temsilci request 4/4 → lib ve `android-jni` 6/6
(+2 fixture testi ignored), fmt, iki Clippy `-D warnings` PASS. Bridge testlerinin ilk
koşusu test düzeneği hatasıyla kırmızı (macOS kapalı peer'de `SO_RCVTIMEO` EINVAL),
kök neden giderilip 2. denemede yeşil. Android arm64 + iOS sim candidate, ardından
yalnız FTPS 4 ABI + 2 slice paketleme PASS (fixture marker 0); FTPS-etkin Android
arm64 `assembleDebug` (APK `.so` = yeni paketin strip'i) ve B1 bayraklı Pods ile iOS
arm64 Simulator Debug build/link PASS. Kanıt: [manifest](evidence/b3-zeroize-2026-11-11/manifest.json)
(kaynak/artifact önce-sonra hash'leri; loglar diskte). **NOT_RUN/açık:** FTPS/JNI
runtime, gerçek TLS/LAN/hesap, fixture testleri, heap gözlemi (kapsam dışı), fiziksel/
imza kapıları; eski engine/runtime PASS yeni binary'ye devredilmedi. Kapsam sınırı:
yalnız Rust-sahipli iki kopya Drop'ta silinir; JVM/Swift/Serde scratch/suppaftp/TLS
kopyaları ve abort/kill kapsanmaz; ADR sapması kabul edilmedi. Aynı-oturum review'u
bağımsız değildir; 1.3 checkbox'ı GPT review'una kadar açık. Commit/push yok.
**Checkpoint (review kaydı, 11.11):** Kayıt: HEAD `650ec17`; diff yalnız 6 planlı dosya;
**kabul**, düzeltme gerektiren ürün kodu bulgusu yok; ADR0022 D1/preserved boundaries/
FTPS practical verification ihlali yok. Salt-okunur taze: kaynak 8/8+9/9, artifact
10/10, APK/dylib ve APK içi `.so` hash'leri, diff dosyası byte-eşit, B1 18/18 + 1.2 spec,
`diff --check`, bridge üretim kodu HEAD öneki, lock paket/sürüm listesi. 00–31 logları
reuse (çoğu yalnız son satır). **P3 (düşük, kanıt kapsamı, engellemiyor):** önceden mevcut
untracked dosyaların byte düzeyinde korunduğu kanıtlanamıyor; iddia yukarıda ve
manifestte daraltıldı. Review sınırları: iOS ara slice hash'i taze hesaplanmadı, CURRENT
diff'i ayrıştırılmadı. **Bağımsız kapı açık:** kayıtta reviewer modeli yok (özeti Claude
Opus 5.5 oturumu yazdı) ve kullanıcı ilk sorulduğunda ayrı GPT oturumunu teyit edemedi.
**Checkpoint (bağımsız review kabulü, 11.11):** Kullanıcı teyidi: yukarıdaki review ayrı
GPT oturumunda `/review` ile yapıldı; bağımsız gerçek-diff review kapısı kapandı, 1.3 kabul
ve `[x]`. P3 belge notu: B1 18/18 + 1.2 spec hash-doğrulandı; diğer önceden mevcut
untracked içeriklerin değişmezliği doğrulanamadı (başlangıç hash'i yok). Bu bir değişiklik
bulgusu değildir; sonradan hash başlangıç kanıtı gibi kullanılmaz. Manifestin `review`/
`openGates` alanları bu teyitten önce yazıldı; bağımsız-review kapısı için bu checkpoint
geçerlidir (bu oturum yalnız CURRENT'ı güncelledi). **Açık kalanlar:** FTPS/JNI runtime,
gerçek TLS/LAN/hesap, ignored fixture testleri, heap gözlemi (kapsam dışı), B1 JS→native
runtime, tam regresyon (Faz 3) ve fiziksel/production/signing kapıları (Faz 4). Eski
engine/runtime PASS yeni binary'ye devredilmez. Ürün kodu değişmedi, commit/push yok.
**Checkpoint (1.4/B4 Claude değerlendirmesi, 11.11):** Başlangıç HEAD `650ec17` (plan HEAD
ile aynı). Plan: `plans/next-plan.md`. Diff yalnız: yeni
[b4-android-vault-lock-policy-2026-11-11.md](b4-android-vault-lock-policy-2026-11-11.md),
yeni `evidence/b4-vault-lock-2026-11-11/` (manifest + ctx7/doküman logları + kaynak
hash'leri) ve bu checkpoint. Ürün/test kodu, ADR, anahtar politikası değişmedi. Sonuç:
mevcut uygulama guard'ı (her vault read/write'ta `isDeviceLocked`, S3 admission'da ek
kilit şartı, FTPS'de vault+native callback üzerinden) onaylı gereksinimle çelişmiyor;
**bayrak şimdi önerilmiyor** (resmî doküman: API 28+, Android 12–14'te kilit kaldırılınca
anahtar silinir/güvenli kilitsiz kullanılamaz/zayıf biyometrik yeniden yetkilendirmez;
mevcut alias'lar etkilenmez, sessiz migration yok; vault'ta reset yolu yok). İleride
seçenek: yalnız API≥35 + yeni alias, ayrı plan/onay. Ek bulgu F1 (B4 dışı, düzeltilmedi):
kilitliyken tetiklenen S3/FTPS otomatik işi `reconcile` içinde planı iptal ediyor;
uygulama açılana/ayar/boot tetikleyicisine kadar düşüyor. Taze: ctx7 library+2 docs,
resmî sayfa alıntısı, kaynak SHA256; NOT_RUN: test/build, tüm gerçek OS kilit/reboot/
biyometrik gözlemi, native faz eşlemesi. **Kullanıcı kararı (grill-me):** "Kabul + F1 ayrı
iş" — bayrak şimdilik yok, guard↔Keystore farkı ve kalan riskler kabul edilerek belgelendi;
F1 ayrı backlog maddesi 1.4b (bu oturumda uygulanmadı). B4 kapanışı F1'i veya fiziksel
güvenlik kabulünü kapatmaz. **Açık:** bağımsız GPT review, 1.4b planı, Faz 3/4 runtime.
1.4 review kabulüne kadar `[ ]`. Aynı-oturum incelemesi bağımsız değil; commit/push yok.
**Checkpoint (1.4/B4 review düzeltmesi, 11.11):** GPT review (HEAD `650ec17`) 4 belge
bulgusu kapsamında düzeltildi; yalnız B4 belgesi, B4 evidence ve bu checkpoint değişti.
(1) §3 tablo kalıcı run fazı / UI durumu / operasyon journal'ı olarak ayrıldı; unlock/retry
koşullu dallar. (2) S3 `AndroidS3Client` 100 ms programlanmış Timer → check → `call.cancel`
zinciri eklendi, kesin durdurma/sır silme garantisi yok. (3) İncelenen üretilmiş debug
BuildConfig (FTPS=true, S3=false) ve merged manifest SHA256'ları `12-build-output-sha256.txt`;
S3 değerlendirmesi yalnız kaynak. (4) Manifest `result` kullanıcı kararıyla hizalandı.
Taze: 5 yeni atıf kaynağının hash'i (26/26 OK), build çıktısı hash'leri, kapsam kontrolü
(`22-fix-scope-check.log`). NOT_RUN: test/build/cihaz/Keystore. 1.4 re-review'a kadar `[ ]`.
**Checkpoint (1.4/B4 P2 kilitli-status düzeltmesi, 11.11):** GPT re-review P2'si (HEAD `650ec17`)
düzeltildi; yalnız B4 belgesi §3, manifest `reviewFixPass.p2LockedStatusFix` ve bu checkpoint
değişti. Kilitliyken iki protokolde `status()` → `capture()` → vault guard `credential_locked`
ile reddedilir; UI sütunu artık yalnız unlock sonrası okunabilen `run.state`. FTPS manuel
`waiting → paused` yalnız `active?.run?.id != run.id` iken (`AndroidFtpsQueue.kt:190`). Taze:
`23-p2-start.log` (HEAD/envanter, 26/26 hash), `24-p2-scope-check.log`. NOT_RUN: test/build/
cihaz/Keystore, kilitli gerçek ekran gözlemi. 1.4 GPT kabulüne kadar `[ ]`.
**Checkpoint (1.4/B4 GPT re-review, 11.11):** GPT-6.1 Sol, ayrı review-only oturum;
oturum ID'si bilinmiyor. [Review](evidence/b4-vault-lock-2026-11-11/review.md).
HEAD `650ec17`; önceki kilitli-status P2 kaynakla doğrulandı. Taze: 26/26 B4 kaynak,
28/28 önceki iş kaynak hash'i ve 3/3 üretilmiş çıktı hash'i eşleşti; staged diff boş.
**R1 / kanıt sınırlaması:** B4 öncesi dirty CURRENT metni/diff snapshot'ı bulunamadı;
tarihî satır aidiyeti kanıtlanamadı. Kullanıcı bu eksikliğin tek başına kapanış engeli
olmamasını açıkça onayladı (bu konuşma, 11.11). Belge hash'i önceki review ile aynı;
mevcut içerik için bağımsız kaynak/ADR review'u reuse edildi, başka engelleyici bulgu
yok. **1.4 belge/değerlendirme + bağımsız review kabul, `[x]`.** Geçmiş snapshot
uydurulmadı; bu bir ürün güvenlik veya runtime PASS'i değil. Test/build/cihaz NOT_RUN;
F1, native faz eşlemesi, direct-boot doküman doğrulaması ve Faz 3/4 açık. Ürün/ADR
değişmedi; commit/push yok.
**Sıradaki iş (bu oturumda başlanmadı):** ayrı GPT oturumunda yalnız 1.4b/F1 planı.
İdari kapanış için Opus oturumu gerekmez; 1.5'e geçilmez.
**Hazır sonraki-sohbet promptu (GPT plan):** “AGENTS.md → CURRENT.md backlog 1.4b →
b4-android-vault-lock-policy-2026-11-11.md §5 ve §7 oku. Yalnız F1 için hedef
dosya/sembol, korunacak fence'ler, davranış değişikliği ve en dar kabul/doğrulama
yolunu içeren scoped plan hazırla. Kilitliyken fail-closed bekleme, kilit açılınca
planın kaybolmaması/yeniden çalışabilirliği; OS altında anında çalışma garantisi yok.
Ürün/test/ADR değiştirme, uygulamaya geçme, başarılı testleri tekrarlama; açık ürün
kararı varsa yalnız onu sor. B4'ün tarihî CURRENT aidiyeti kanıt sınırı ve Faz 3/4
kapıları korunur. Commit/push yok; plan/checkpoint ve devir promptuyla dur.”

**05.11 gerçek kullanım açık bulguları:** [tek kayıt](field-findings-2026-11-05.md): Android–Mac eşleşme/tekrarlı durma,12PC Completed+1Receiving, fingerprint klasörü/rastgele media kimlikleri/retained part hardlink; WebDAV port URL içinde destekli fakat form açıklığı,TLS/CA/auth ve hata teşhisi eksikleri. İnceleme tamam; aktarım kök nedeni ADB bağlantısı koptuğu için açık. Kullanıcı bu tur geliştirme istemedi; yalnız bulgu kaydı yapıldı.

## Mobil tema uyumu — 05.11.2026

Android gerçek stack: AppearanceModule.setColorScheme null style. Kurulu NativeWind4.2/css-interop0.2 `system` için null gönderirken RN0.86.3 Android `unspecified` bekliyor. ThemeProvider yalnız system dalında doğrudan Appearance.setColorScheme('unspecified') kullanır; açık/koyu NativeWind yolunda kalır, OS dinleyicisi korunur. Kaydedilmiş system ve kullanıcı system/light değişimi için2yeni Jest testi PASS; mobil tsc ve iki değişen tema dosyası lint PASS (yalnız mevcut multiple-tsconfig uyarısı). Fiziksel telefon tekrar açılış/OS tema değişimi henüz doğrulanmadı; native rebuild gerektiren değişiklik yok. İlk Jest koşusu mobil node_modules'taki lockfile-dışı fazla React yüzünden Invalid hook call ile durdu; fazla kopya silinmeden temp yedeğe taşındı, kök locked19.3.0 kullanılarak test geçti. Kaynak package/lockfile değiştirilmedi. Log `/tmp/kloda-mobile-theme-fix.log`. Commit/push yok.

Sonraki sohbet prompt'u: “AGENTS.md → CURRENT.md mobil tema uyumu bölümünü oku. Metro'yu gerekiyorsa temiz önbellekle yeniden başlatıp gerçek Android'de kayıtlı Sistem tercihiyle açılış ve açık/koyu/sistem değişimini doğrula. Başarılı Jest/tsc/lint'i tekrarlama; veriyi sıfırlama, commit/push yapma.”

## macOS Electron geliştirme imzası — 05.11.2026

**Normal GUI başlangıcı takip kontrolü:** Beyaz ekran renderer React19.2.3/react-dom19.3.0 uyuşmazlığıydı; lockfile her ikisi için19.3.0. Kök React, lockfile SHA512 bütünlüğü doğrulanmış yerel npm arşivinden onarıldı. Desktop node_modules içindeki lockfile-dışı fazladan React kopyası ve Vite önbelleği silinmeden temp yedeğe taşındı; mobil kopyasına dokunulmadı. Genel offline npm onarımı ilgisiz @expo/fingerprint metadata eksikliğiyle durmuştu; başarılı sayılmadı. Kaynak/lockfile değiştirilmedi. Normal `npm run dev:desktop` açıldı; CUA gerçek “Bu bilgisayarı alıcı yap” kurulum ekranını doğruladı. Süreç açık, log `/tmp/kloda-desktop-dev-20261105.log`. QR/telefon eşleştirme kabulü hâlâ açık.

Kullanıcı ücretli Apple Developer üyeliğine geçti; Xcode Mac kaydı ve `com.kloda.desktop.dev` development profili doğrulandı. Normal Electron ad-hoc hostunda `secd` -34018 görülmüştü. `npm run dev:desktop` artık macOS'ta `tools/run-desktop-dev.mjs` üzerinden ayrı `apps/desktop/dist/macos-development/Kloda Development.app` üretir. Kaynak Electron, kullanıcı authority/veritabanı ve production kimliği değiştirilmez. Windows/Linux mevcut Electron başlatmasını kullanır.

Profil standart Xcode klasörlerinden seçilir; gerektiğinde `KLODA_MAC_PROFILE=/mutlak/yol/profile.provisionprofile` verilir. CMS decode, macOS/expiry/bu Mac/app-ID-prefix/team/Keychain grubu ve yerel sertifika eşleşmesi hazırlıktan önce kontrol edilir. Sertifika/profil repoya girmez. Restricted Keychain hakları yalnız ana hostta; helper'larda yalnız allow-jit, hardened runtime açık, library-validation bypass/software-key fallback yok. Dört mevcut main runtime bağımlılığı paket içine kopyalanır; dış node_modules symlink'i yok. Girdi hash'i değişmediyse yeniden imza yerine strict verify yapılır.

Yeni doğrulama: profil bağlama 2 test (negatif varyantlar dahil) PASS; ayrı uygulama deep/strict imza doğrulaması PASS; signed Electron host gerçek NAPI yükleme + bellek içi SQLite + sync-core import PASS; değişmeyen girdide tekrar imzalama yapılmadı. Özgün Electron hâlâ ad-hoc. İlk iki hazırlık denemesinde framework symlink/harici dependency symlink hataları giderildi; bunlar PASS sayılmaz. Loglar `/tmp/kloda-macos-signing-20261105.log`, `/tmp/kloda-macos-signing-cache.log`. Eski başarılı build/test matrisleri tekrarlanmadı.

Normal imzalı GUI başlangıcı doğrulandı. Kullanıcı Android–Mac QR eşleştirmesinin PC onayından sonra tamamlandığını bildirdi. Secure Enclave create/reopen, ağ keşfi ve kesintisiz aktarım kabulü açık; [saha bulguları](field-findings-2026-11-05.md) ayrı izleniyor. Deneme Xcode uygulamasının App Sandbox hakkı Electron'a taşınmadı. Release/production/notarization ve bağımsız review açık. Aynı-agent ayrı kaynak incelemesi yapıldı. Commit/push yok.

Sonraki sohbet prompt'u: “AGENTS.md → CURRENT.md macOS Electron geliştirme imzası bölümünü oku. Saha bulgularını oku. Mevcut eşleşmeyi ve kullanıcı verisini koru; yalnız açık Secure Enclave create/reopen, ağ keşfi ve Android aktarım kesintisi kontrollerini değerlendir. Başarılı imza/NAPI/GUI kontrollerini tekrar etme. Commit/push yapma.”

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
