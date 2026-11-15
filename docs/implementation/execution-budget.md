# Uygulama maliyeti ve doğruluk kapıları — 12.11.2026

Kullanıcı onaylı dört ilke. Yeni uygulama/fix turlarında geçerli; mevcut planın
güvenlik kabulünü azaltmaz. Normal devirde ek yönetim sohbeti gerekmez.

## 1. Hazır tasarım

GPT sözleşmesi değişecek sembolleri, kritik olay sıralarını, beklenen kalıcı/OS
sonuçlarını, test önkoşullarını ve ilk temsilciyi belirtir. Kritik tasarım/ürün
kararı açıkken READY verilmez. Eski test ile sözleşme çelişkisi uygulamada çıkarsa
Opus karar tasarlamak veya testi gevşetmek yerine kanıtı kaydedip DECISION bırakır.
GPT aynı plan/review sohbetinde dar çözümü netleştirir; yeni kota turu otomatik açılmaz.

## 2. Önce küçük kanıt

İlk aşama: yalnız bir temsilci regression + minimum üretim değişikliği + ilgili
dar koşu. Gerekli test seam/compile bu aşamaya dahil; diğer test altyapısını peşinen
yazma. Önkoşulları mevcut lifecycle kodundan doğrula; ilk assertion expected/actual
ve ilgili kimlik/deadline/context farkını sırsız göstersin. Sırf hata mesajı eklemek
için tekrar APK döngüsünden kaçın. İlk yol geçince yalnız onaylı etkilenen kapsamı
genişlet. Testin geçmesi için ürün beklentisini değiştirme.

## 3. Bütçe kontrol noktası

Başlangıç eşiği: uygulama/fix turu başına **15000 output token**, thinking dahil;
thinking'i ayrıca ekleme. Bu deneysel bir durma eşiği, Pro kota yüzdesi veya
sağlayıcı tarafından zorlanan sert limit değildir. Bir model yanıtı eşiği aşabilir.
Plan ihtiyaç varsa farklı eşiği gerekçeyle onaya sunar; ajan kendi yükseltemez.

- Güvenilir usage araçtan/harness'ten görünüyorsa tur başından itibaren kaydet;
  devam/compaction parçalarında sayacı sıfırlama. Her aşama ve yeni build/araştırma
  öncesi mevcut değeri kontrol et. Ayrı ajan pilot kullanımını ayrıca göster.
- Usage erişilemiyorsa UNKNOWN yaz; transcript boyutundan token/kota uydurma ve
  ölçmek için özel servis/veritabanı taraması başlatma. İlk temsilci sonunda zorunlu
  kontrol noktası bırakıp genişletmeye başlamadan kullanıcı yanıtını bekle.
- Ölçüm varsa ve eşik altında, temsilci yeşilse onaylı etkilenen kontroller otomatik
  devam edebilir. Eşik aşıldıysa yeni edit/build/araştırma başlatma; mevcut işlemin
  sonucunu ve güvenli checkpoint'i kaydet. Başlayan build'i sırf eşik diye öldürme.
- DUR çıktısı: yapılan/kanıtlanan, harcanan veya UNKNOWN, kalan dar iş ve öneri.
  Kullanıcı aynı sohbetten devam bütçesini onaylayabilir; yeni sohbet şart değildir.
- Bütçe nedeniyle atlanan zorunlu kontroller açık kalır; iş PASS/review-ready olmaz.
  İki başarısız yaklaşım kuralı ayrıca geçerlidir.

## 4. Risk bazlı tek Sonnet pilotu

İlk uygun düşük riskli ve tasarımı net işte GPT Sonnet pilotunu önerir; mevcut
F1/custody/journal/TLS/migration/OS ownership işi pilot değildir. Kullanıcı
`/implement-pilot` seçerek o iş için modeli açıkça seçer. Normal `/implement`
Opus kalır; ajan modeli veya effort'u sessizce değiştirmez.
Pilot komutu aynı kapsam, bütçe, kanıt ve bağımsız GPT review kurallarını kullanır.
İş büyür/başarısız olursa otomatik Opus'a tekrar yaptırma; somut engelle dur.
Manifestte model, süre, erişilebilir usage, ilk-doğru-test ve review sonucu kaydedilir.
Sonnet'in Pro kotası tüketmeyeceği veya kesin ucuz olacağı varsayılmaz. Bir pilot
sonrasında kalıcı model politikası kullanıcı değerlendirmesi bekler.
