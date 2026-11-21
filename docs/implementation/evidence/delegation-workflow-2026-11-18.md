# Delegasyon ve süre azaltma — 18.11 kullanıcı onayı

Çakışmalar: eski salt-okunur/kod delegasyonu yasağı ve ayrı pilot-komutu zorunluluğu.
Çözüm: araştırma görevleri salt-okunur kalır; sonraki döngüde planın açıkça ayırdığı
düşük riskli Sonnet uygulaması için dosya allowlist + dar kontrol istisnası eklendi.
Ana Opus modeli değişmedi; kodu önceden ikinci kez tasarlamaz. Tek yazar, ortak
build/cihazda tek koşu; gerçek diff/kanıt kontrolü Opus, bağımsız kabul GPT.

Plan/review Luna; uygulama Sonnet 5.5. Her küçük işte ayrı ajan şartı yok.
Kabul→etkilenen yol→kontrol→reuse bir kez seçilir, semantic diff/başarısızlıkta güncellenir.
Dar compile önce, runtime sonra; mevcut kanıt/komut ve çağıran taraması yeniden kullanılır.
Hassas F1/custody/TLS/kalıcılık/recovery/OS sahipliği Opus'ta kalır.

Değişen politika/komutlar: AGENTS, execution-budget §4–5, research-pilot,
plan/implement/review; implement-pilot silindi, CURRENT maliyet pointer'ı uyumlandı.
Sürmekte olan review'un goal/kabul/devir durumu değiştirilmedi. Tarihî kanıtlar silinmedi.
Yeni subagent, build/test veya ürün değişikliği yapılmadı; süre/kota tasarrufu henüz ölçülmedi.
Sonraki işin onaylı planı bu yönlendirmeyi kullanır; ayrı komut/model seçimi gerekmez.
