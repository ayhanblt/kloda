# Dar dış araştırma — stop acknowledgment / late jobFinished

Soru: API33–35'te local callback kaydı completion niyetiyle kaldırıldıktan sonra
onStopJob false dönerse, daha geç `jobFinished(params,true)` OS retry'ını garanti eder mi?

## Delegasyon / ölçüm

- `research-pilot.md` kapsamında ana ajandan bağımsız dış soru; özel repo kodu yok.
- Katalog: openai/inkling sonucu yok; `opencode/inkling-2-small-free#low` active,
  katalog input/output/cache fiyatları 0. Ana reviewer modeli değiştirilmedi.
- Ajan: general, session `ses_e1e97373cffeVCWzGBv33ez42h`; background tamamlandı.
  Repository incelemesi/ürün kararı alt ajana verilmedi. Fallback kullanılmadı.
- Başlangıç/bitiş kesin zamanları ve token/cache kullanım sayaçları araç sonucunda
  yok; UNKNOWN. Yüzde tasarruf/gerçek toplam maliyet uydurulmadı.
- Ajan Context7 ve resmî AOSP/developer.android.com kullandığını, eski source path'inde
  NOT_FOUND yaşayıp apex path'ini bulduğunu bildirdi. Dönen Context7 çağrı sayısı
  kendi notunda tutarsızdır; kesin sayı kabul edilmedi. API33/34 tag'leri ayrı
  doğrulanmamış; sürüm bazlı çıkarım API35 resmî kaynağa dayanıyor.

## Ana GPT'nin dar kaynak doğrulaması

Kaynak: [AOSP android-15.0.0_r1 JobServiceContext.java](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/apex/jobscheduler/service/java/com/android/server/job/JobServiceContext.java).
Araçla doğrudan fetch+base64 decode edilip yalnız aşağıdaki yöntem kesitleri okundu:

```text
740–745: void doJobFinished(... boolean reschedule) {
            ... if (!verifyCallerLocked(cb)) { return; }
779–780: void doAcknowledgeStopMessage(... boolean reschedule) {
             doCallback(cb, reschedule, null);
1048–1054: private boolean verifyCallerLocked(JobCallback cb) {
              if (mRunningCallback != cb) {
                  ... "Stale callback received, ignoring."
                  return false;
1145–1156: void doCallbackLocked(boolean reschedule, String reason) {
              ... else if (mVerb == VERB_EXECUTING || mVerb == VERB_STOPPING) {
                  handleFinishedLocked(reschedule, reason);
1276–1280: private void handleFinishedLocked(boolean reschedule, String reason) {
              ... case VERB_EXECUTING: case VERB_STOPPING:
                  closeAndCleanupJobLocked(reschedule, reason);
1619–1621: mRunningCallback = null; mParams = null; mVerb = VERB_FINISHED;
```

Kesitler atlanan satırlar içerir; tam dosya yerel snapshot'ı değildir. Ayrıca tam
snapshot'ı Python urllib ile diske alma girişimi yerel CA doğrulama hatasıyla
başarısız oldu (`CERTIFICATE_VERIFY_FAILED`); güvenlik bypass edilmedi/tekrarlanmadı.
Bu hata önceki execute HTTP fetch'lerinde doğrulanan kaynak kesitlerini değiştirmez.

**Sonuç:** stop ack false OS tarafından önce işlenirse, cleanup sonrası geç
jobFinished(true) stale'dir ve retry sağlayamaz. Local map CAS'ının OS acknowledgment
yerine geçtiği iddiası reddedildi. İki IPC'nin yarışında finish'in önce işleneceği
garantisi bulunmadı; garanti VAR diye çıkarım yapılmadı. API35 için bu kaynak
yeterlidir; review edilen emülatör de API35'tir. API33/34 için ayrı runtime/tag
kanıtı üretilmedi. Ana GPT'nin proje eşlemesi `review.md` R1'dedir.
