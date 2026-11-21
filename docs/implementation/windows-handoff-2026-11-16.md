# Windows devam — 16.11.2026 / F1-FTPS fix2 kısmi

**17.11 güncel kullanıcı kararı:** aşağıdaki Mac F1→1.5 kuyruğu supersede edildi.
F1 fix2 compile/RED-GREEN/lint Faz3'e DEFERRED / NOT_RUN. 1.5 H15/P15 host testi
Mac'te 6.01 sn / exit0 PASS; bağımsız GPT review bekliyor (CURRENT ve 1.5 manifest).
Mevcut kodu/testi yeniden başlatma; FO1 Faz4 ertelemesi korunur.

## Güncel Mac doğrulama sırası — 16.11 kullanıcı kararı

Kullanıcı F1 ve 1.5'in eksik ortam doğrulamalarını Mac'te sırayla deneyecek.
Aşağıdaki sıra günceldir; bu dosyanın eski Windows devam metni tarihî checkpoint'tir.
İşler kapanmadı; bu kayıt test PASS'i veya bağımsız review yerine geçmez.

1. **F1-FTPS fix2:** CURRENT + FTPS MANIFEST §fix2 Windows devamı ve
   `fix2/resume-win/` üzerinden mevcut tamamlanmış kaynakları kullan.
   Kod değiştirmeden build + start-RED + final-GREEN + dar lint; yalnız değişen/eksik
   kanıt. Eski yarım-kod checkpoint'ini yeniden uygulama. İki-ret sayaçları,
   S3/R3 kabulü, FO1 fiziksel ertelemesi korunur. Sonra mevcut GPT review sohbeti.
2. **1.5 H15/P15:** [1.5 MANIFEST](evidence/backlog-1.5/MANIFEST.md) ve
   [sözleşme §1.5](plans/next-plan.md#15--regresyon-hazırlığı-uygulama-sözleşmesi--16112026).
   macOS/xcrun/swiftc/SQLite3/CryptoKit, disposable temp ve mevcut golden JSON'u
   doğrula; `python3 -I tools/test-ios-webdav-journal.py` koşusunun log/exit'ini
   `evidence/backlog-1.5/` altına kaydet. Üretim kodu/assertion değiştirme;
   hata varsa önce teşhis, yalnız onaylı harness sınırı. Eksik başlangıç compile
   teşhisi için kayıtlı `baseline/test-ios-webdav-journal.py.start` kullanılır;
   çalışan dosyayı körlemesine geri alma. L15/B15 etkilenmeyen kanıtları tekrar koşma.
   Zorunlu kanıt tamamlanınca REVIEW/unchecked ve ayrı GPT review; şimdilik KISMİ.

Gerçek release B2/notices paket kontrolü, signing/P5 ve fiziksel kapılar bu dar
sıranın parçası değildir; önceki release/fiziksel aşamalarında açık kalır.
Yeni fixture/CA/SDK kurulumu veya commit/push yetkisi yok.

## Tek aktif iş

Opus limiti bitti; kullanıcı bütün mevcut değişikliklerin checkpoint commit/push'ını
ve Windows'ta yeni Opus oturumundan devamı istedi. Bu devir release/review kabulü değildir.
Önce AGENTS → CURRENT → bu kayıt; sonra yalnız
`plans/f1-ftps-r1r2-stop-recovery-contract.md` §1–4 ve son
`evidence/f1-ftps-automatic-lock-2026-11-15/fix-r1r2/review.md` R1/R2.
Ana FTPS planını/önceki bütün sohbetleri baştan uygulama.

## Opus'un diskte bıraktığı kesin nokta

- `evidence/f1-ftps-automatic-lock-2026-11-15/fix2/start/`: HEAD/status, CURRENT,
  manifest ve altı kaynak başlangıcı mevcut. Başlangıç HEAD `f26e425`.
- K/AndroidFtpsJob.kt değişmiş: FtpsSlot faz/stop/epoch/ticket/verdict modeli;
  arbiter'lı start/stop/destroy, yeni completion çağrısı, claim kritik bölgesi.
- K/AndroidFtpsScheduler.kt kısmen değişmiş: Os.pending, arbiter/epochs,
  Attempt/watchUnknown, retain/stopped eklendi. **complete/rewatch ve WATCH
  initial/recovery dönüşümü tamamlanmamış**; Job çağrılarıyla mevcut imzalar uyumsuz.
  Bu kaynakların derlenebilir olduğu iddia edilmez; yarım düzenleme korunmuştur.
- Queue ve AutomaticChecks/LifecycleChecks/PolicyChecks fix2 başlangıcına eşit.
  Yeni sözleşmenin regression testleri henüz eklenmemiş; fix2 altında yeni koşu sonucu yok.
- Kaynak checkpoint hash'leri `fix2/windows-resume.sha256`. İlk iş: bu kısmi diff'i
  start kopyalarıyla eşle, sözleşmeye göre tamamlanacak değişiklikleri belirle; kör
  baştan yazma/geri alma yok. RED varyantı gerekirse kayıtlı baseline kullanılır,
  Windows çalışma ağacındaki yarım kod kaybedilmez.

K = apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/;
T = aynı modülün src/androidTest/java/com/kloda/sync/ dizini.

## Devam ve kanıt

1. Windows resume HEAD/status ve hash'leri kaydet; Git EOL dönüşümü hash'i değiştirirse
   önce LF/CRLF farkını ayır, eski testi otomatik geçersiz/yeniden gerekli sayma.
2. Mevcut Android araç/owned emulator/native asset hazırlığını hedefli kontrol et.
   Mac seri/yol varsayma. Eksik kurulumları raporla; onaysız kurulum yok.
3. Onaylı sözleşmenin R1 gerçek yarış regression'ı → minimum tamamlanmış fix;
   ardından R1 karşıtları ve R2 aynı OS-result yolu/regression. Kısmi kod tek başına
   baseline RED veya GREEN değildir. Gerekli dar build/test/lint ve kanıt devri.
4. Bağımsız GPT review'a devret; Opus checkbox kapatmaz. R1/R2 iki ret sayacı korunur.

7/32 ve build önceki fix-r1r2 kaynaklarının PASS'idir; değişmiş fix2 için taze PASS
değildir. R3 scoped lint kabulü, S3 scoped kabulü ve FO1 ertelemesi korunur.
FO1 tekrar testi/fixture/CA kurulumu yok. FO1 delta fiziksel §21/Faz4'te kalır.

Git kaynak/plan/start kopyaları ve izlenen kanıtları taşır. Ignored `.log`, APK/.so,
üretilmiş native projeler, node_modules, SDK/emulator, global OpenCode ayarları ve
provider oturumları otomatik taşınmaz. Kanıt dosyası yoksa test tekrarlamak yerine
önce yalnız gereken mevcut Mac kanıtını taşı; geçmiş manifestten taze PASS uydurma.
Git'teki sentetik residue DB test kanıtıdır; uygulama/test paketine geri yükleme.

## Windows yeni Opus sohbetine verilecek prompt

`/implement` — F1-FTPS FIX/fix2 Windows devamı. AGENTS → CURRENT →
docs/implementation/windows-handoff-2026-11-16.md oku. Opus limitinde Job/Scheduler
yarım kaldı; fix2/start ve windows-resume.sha256 ile mevcut diff'i tanı, baştan
uygulama. Onaylı R1/R2 stop-recovery sözleşmesini tamamla. FO1 tekrar/fixture yok;
S3/R3 kabulü ve deneme sayaçları korunur. Ortam ve kanıt eksiklerini hedefli ayır.
Commit/push yalnız ayrıca istenirse.
