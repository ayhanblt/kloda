# R1/R2 yöntem araştırması — 16.11.2026

Öneri; READY/FIX yetkisi veya runtime kabulü değil. Ürün/test değiştirilmedi.
Mevcut review ve research-stop-completion.md kanıtı yeniden kullanıldı.

## Skill bulgusu

Proje systematic-debugging: çalışan benzer yol ile karşılaştır, doğru olay sırasını
yeniden üret, kök nedene müdahale et, kardeş yolları kontrol et. Verification skill:
etkilenmeyen kanıtı yeniden kullan, taze/önceki/ertelenmiş sonucu ayır. Grill-me:
repodan cevaplanabilen teknik soruyu kullanıcıya yükleme. Bunlar Android API kanıtı
değildir. Debug skill'in üç-hipotez ifadesine karşı AGENTS'in iki başarısız yaklaşım
kuralı geçerlidir. Yeni skill/araç kurulmadı.

## Dış araştırma ve doğrulama

- General subagent: `opencode/inkling-2-small-free#low`, session
  `ses_e1e8ca0d3ffeYnNVN07wrjxG67`; katalog fiyatı 0, gerçek token/süre UNKNOWN.
  Yalnız bağımsız JobService lifecycle sorusu; repo analizi/değişikliği yok.
- Context7 kullanımı ajan tarafından bildirildi; çağrı sayıları yanıt içinde
  tutarsız, kesin sayaç olarak kabul edilmedi. Fallback yok, tasarruf yüzdesi yok.
- Ana ajan resmi https://developer.android.com/reference/android/app/job/JobService
  sayfasında jobFinished'in void olduğunu; onStopJob sonrası jobFinished gerekmediğini
  ve stop dönüşünün reschedule isteğini taşıdığını doğruladı. Bu API'de uygulamaya
  terminal completion acknowledgment sunulmuyor.
- Önceki Android15 JobServiceContext stop-ack/stale-finish bulgusu reuse.
- Alt ajanın "diskte retry intent zorunlu" çıkarımı resmi kaynakla kanıtlanmadı ve
  öneriye alınmadı. Yeni DB/prefs/recovery politikası yetkisi çıkmaz. Main-thread
  serialization da tek başına OS acknowledgment kabul edilmez.

## En küçük öneri

R1: exact E worker-yazma yetkisi ile stop cevabı bilgisini ayrı tut. Completion
başlarken worker yetkisini kapat; geç stop için pre-admission retry kararı erişilebilir
kalsın. jobFinished dönüşü veya geçen süre temizlik kanıtı değildir. Sınırlı RAM
completion/stop kaydı adayı; temizliği stop tüketimi, yeni delivery/authority değişimi
ve service teardown ile açıkça tanımlanmalı. Aynı-token yeni E eski worker'ı yeniden
yetkilendirmemeli. Bu temizleme/eşleme tablosu henüz kesin sözleşme değildir.

R2: FTPS WATCH initial install/replace/ordinary recovery aynı OS-result fonksiyonundan
geçmeli. Exact proposed/previous projection kaydı kurulumdan önce var olmalı; sonuç
INSTALLED/REJECTED/UNKNOWN olarak sınıflandırılmalı. UNKNOWN generic catch→cancel'e
düşmemeli; explicit pause/disable revoke yetkisi korunmalı. Recovery'de aktif callback
yoksa finish üretilemez. Shared BackupScheduler'a yeni sonuç politikası yükleme.

Dar doğrulama adayları: R1 completion kararı sonrası/OS teslimi öncesi stop ve ters
sıra, aynı-token gerçek yeni E ayrımı; R2 ordinary recovery schedule accepted-then-throw
ve kanıtsız throw. Mevcut testte fault portunu recovery öncesi kaldırma. Önce doğru
sebeple RED, sonra minimum fix; tüm eski matris/FO1/fixture tekrarı yok.

Durum DECISION kalır. R3 kabul, önceki PASS ve FO1 fiziksel ertelemesi korunur.
