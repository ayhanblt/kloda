# Uygulama maliyeti ve doğruluk kapıları — 16.11.2026

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

## 3. Ajan içi verimlilik kontrolü

**15000 output token**, thinking dahil, ajan içi kontrol işaretidir; durma/onay
eşiği, Pro kota yüzdesi veya sağlayıcı hard-cap'i değildir. Tek onaylı goal içinde
her alt test için yeniden bütçe izni istenmez.

- Güvenilir usage araçtan/harness'ten görünüyorsa tur başından itibaren kaydet;
  devam/compaction parçalarında sayacı sıfırlama. Her aşama ve yeni build/araştırma
  öncesi mevcut değeri kontrol et. Ayrı ajan pilot kullanımını ayrıca göster.
- Usage erişilemiyorsa UNKNOWN yaz; token/kota uydurma veya özel servis/veritabanı
  taraması başlatma. UNKNOWN tek başına durma/sohbet değiştirme nedeni değildir.
- Eşikte (ölçüm yoksa ilk temsilci sonunda) tekrar okuma/test, kapsam, ilerleme ve
  bağlam kalitesini değerlendir; kısa notu mevcut manifestte tut. İlerleme varsa
  onaylı kapsamı sürdür. Başarılı etkilenmeyen kanıtları tekrar üretme.
- Temsilci GREEN sonrası bütün onaylı kabul satırlarına devam et; FL/FS/FW ayrı
  görev/onay/review değildir. Belirgin bağlam bozulursa kompakt devir yap; yalnız
  token sayısından bozulma veya tasarruf sonucu çıkarma.
- Gerçek DUR: kapsam/ürün/güvenlik kararı, sözleşme çatışması, eksik bilgi/altyapı,
  izin gerektiren yıkıcı işlem veya aynı yaklaşım/invariant için iki başarısız fix.
  Somut engeli belirt; sayaç yeni oturumda sıfırlanmaz. Kullanıcı durdurursa dur.
- Zorunlu kontrol eksikse KISMİ/BLOCKED; review-ready/PASS değil. Önceden onaylı
  ertelenmiş fiziksel/release kapıları açık kalır; kendiliğinden yeni erteleme yok.

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
