# Windows devam — 16.11.2026 / F1-FTPS fix2 kısmi

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
