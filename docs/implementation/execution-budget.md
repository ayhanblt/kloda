# Uygulama maliyeti ve doğruluk kapıları — 16.11.2026

Kullanıcı onaylı uygulama ilkeleri. Yeni uygulama/fix turlarında geçerli; mevcut planın
güvenlik kabulünü azaltmaz. Normal devirde ek yönetim sohbeti gerekmez.

## 1. Hazır tasarım

Sonraki planlarda dört ilke; ayrı belge/onay/ajan katmanı değildir:
1. **En küçük yeterli çözüm:** mevcut mekanizmayı önce değerlendir. Yardımcı işin
   ayrı altyapıya dönüşmesini hedefe göre gerekçelendir; daha basit yol kabulü
   karşılıyorsa onu seç. Onaylı hedefi/güvenlik davranışını sessizce daraltma.
2. **Belirsizliği önce çöz:** kritik sahiplik, kesinti, kalıcılık ve başarı anını
   yalnız ilgili olay sırasıyla kesinleştir; bilinmeyeni implementere bırakıp READY
   verme. Dosya/sembol, beklenen sonuç, önkoşul ve ilk temsilci aynı sözleşmede olsun.
3. **Uygulanabilir dosya dağılımı:** sorumluluk ve mevcut satır kapasitesini planlarken
   kontrol et. Küçük dosya sayısını küçük çözüm sanma; sıkıştırma veya assertion
   kaybını gerektiren allowlist verme. Gereken sınır değişikliğini mevcut kapsam
   onayında çöz; uygulayıcı sınırı kendiliğinden genişletmez.
4. **Tekrarda tasarımı sadeleştir:** §3'teki aynı yaklaşım/invariant için iki başarısız
   fix sonrası, son örneğe yeni yama listesi yerine bütün olay sırasını ve daha basit
   mekanizmayı değerlendir. Uygulanabilir net karar yoksa yeni FIX devretme; sayaç korunur.

Eski test/sözleşme çatışırsa uygulayıcı kanıtı kaydedip DECISION bırakır; GPT aynı
plan/review sohbetinde çözer. Kullanıcı özeti iş/tek engel/sonraki adımdır; ayrıntılar
mevcut sözleşme/manifestte kalır. Bu sadeleştirme mevcut FIX-R4 devrini değiştirmez.

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

## 4. Düşük riskli uygulama delegasyonu — 18.11 kullanıcı onayı

18.11 son kullanıcı kararı: mevcut Opus çalışması tamamlanınca sonraki uygulama/FIX
ana modeli Sonnet 5.5 (`claude-agent/sonnet`), destek modeli Haiku 5.5 olur.
Çalışan Opus turunun modeli/delegasyonu korunur; mevcut kabul sözleşmesi değişmez.
Tek giriş `/implement`; effort korunur. Planın düşük riskli olarak
belirlediği, davranışı ve dosya sınırı net bağımsız işi doğrudan Haiku 5.5
(`claude-agent/haiku`) subagent uygular. Ana Sonnet önce aynı kodu tasarlayıp satır satır
yeniden tarif etmez: onaylı sözleşme, dosya allowlist'i, kabul ID ve komutlar yeterli.
F1/custody/journal/TLS/migration/OS ownership, izin/auth, veri kaybı riski ve belirsiz
tasarım ana ajanda kalır; belirsiz tasarımda önce GPT kararı gerekir.
Sırf delegasyon için işi bölme; fayda yoksa alt ajan açma.

Tek yazar: Haiku çalışırken ana ajan aynı dosyaları değiştirmez; bağımsız salt-okunur
işi sürdürebilir. Alt ajan yalnız izinli dosyaları düzenler ve seçilmiş dar kontrolleri
çalıştırır; test beklentisi/kapsam/bağımlılık değiştirme, commit/push, cihaz/hesap
temizliği veya başka ajan açma yetkisi yok. Baseline ve mevcut kullanıcı değişiklikleri
korunur. Ortak test cihazı/build dizininde eşzamanlı koşu yok.
Haiku gerçek diff, komut/sonuç/log ve açıkları devreder. Sonnet diff/kanıtı kontrol eder;
geçerli kontrolleri tekrarlamaz. GPT bağımsız review kabulünü verir. Sorunda aynı
sınır içinde scoped düzeltme; iki-deneme sayacı model/oturum değişimiyle sıfırlanmaz.
Risk/kapsam büyürse DECISION; sessiz model yükseltme/Opus fallback yok.
Model, süre, görünür usage ve ana ajanın düzeltme yükü mevcut manifestte kaydedilir;
tasarruf veya Pro kota bağımsızlığı varsayılmaz.

## 5. Tek doğrulama seçimi ve erken hata eleme

Plan: değişiklik→etkilenen yol→en dar kontrol→reuse kanıtını bir kez seçer; uygulanacak
komutlar mevcut doğrulanmış kayıtlardan alınır. Uygulamada yalnız semantic diff, yeni
bulgu veya başarısız önkoşul bu seçimi günceller; sırf alt adım/sohbet değişti diye tekrar yok.
Önce en dar compile/typecheck, sonra pahalı runtime/fixture hazırlığı. Derlemeli olmayan
işte yapay compile adımı yok; RED davranış testinden önce eski varyantın da derlendiği
doğrulanır, compile hatası hedeflenen RED sayılmaz. Başarılı dar compile'dan sonra
aynı işi gereksiz tam build ile tekrar etme; gerekli paketleme ayrı gereksinim olabilir.
Review öncesi normal/recovery/hata çağıranları ve kabul→test/barrier eşlemesi hedefli
kontrol edilir; mevcut alt ajan çıktısını reuse et. Eksik yol için dar kontrol seç;
bütün matris veya yeni kabul hedefi üretme. Ertelenmiş kapılar korunur.

### Araç ve teşhis disiplini — 18.11 kullanıcı onayı

- Bağımsız, sıradaki adımı belli arama/okumaları toplulaştır; sonuca bağlı adımları
  sırayla yürüt. Hazır kontrollerde derleme başarısızsa bağlı runtime'ı başlatma.
  Tek hazır komut için subagent açma; bağımsız çok adımlı işte §4/research-pilot geçerli.
- Yeni test dosyası öncesi mevcut keşif/include kalıbını kontrol et; seçilen testin
  gerçekten koştuğunu sonuçtan doğrula. Bunun için ayrı geniş test koşusu üretme.
- Test/build stdout ve stderr'ini mevcut evidence loguna kaydet; asıl komutun exit
  code'unu filtreleme/özetleme komutundan ayrı koru. İlk beklenmeyen başarısızlıkta
  assertion yanında ilk ilgili warning/error'u da oku; grep/head çıktısını tek kanıt
  sayma. Paylaşılacak özette sırları ayıkla; ham logu bağlama dökme.
- Timeout'u mevcut temsilci süre/önkoşullara göre seç. Saniyelik test belirgin biçimde
  uzarsa otomatik süre artırmak yerine takılmayı teşhis et. Önceki süreç ve alt
  süreçlerin bittiğini doğrulamadan aynı ortak build/cihaz yolunda yeni koşu başlatma.
  Sabit sleep veya polling yerine desteklenen arka plan tamamlanma bildirimini kullan;
  bağımsız iş yoksa gereksiz background/delegasyon ekleme.
- Bir test parçasını kaldırınca GREEN olması kök neden kanıtı değil, hipotezdir.
  Testler arası bozulmada düzeltmeyi tam yeni regression + bozulan komşu test aynı
  koşuda doğrulasın; ancak sonra gereken geniş kontrole dön. Beklentiyi gevşetme.
  Başarısız hipotez/düzeltme ve sonucu mevcut manifestte kısa tut; aynı yaklaşımın
  varyantları §3'teki iki başarısız fix sayacını sıfırlamaz. Salt teşhis koşusunu
  otomatik ayrı fix sayma; kök neden belirsizken kesinleşmiş gibi raporlama.
