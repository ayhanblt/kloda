---
description: Hazır GPT planını uygula
model: claude-agent/opus
---

Önce AGENTS.md → docs/implementation/CURRENT.md aktif iş/durumunu oku.
CURRENT'tan modu seç; normal yönlendirme kararını kullanıcıya tekrar sorma:
- Onaylı ilk uygulama: INITIAL; next-plan.md güncel onaylı sözleşmesini oku.
- Review düzeltmesi bekleniyor: FIX; son review'un açık bulguları ve scoped kabul
  sözleşmesi esas görevdir. Önce son review ve tur manifestini oku; next-plan.md'den
  yalnız onay/kapsam ve ilgili invariant bölümlerini getir. Tüm planı yeniden
  uygulama, kapanmış bulguları yeniden yazma.
- Review bekleniyor veya iş kapalı: uygulamayı tekrarlama; doğru rol/komutu ver.
- Plan hazır değil/onaysız veya kayıtlar çelişkili: kodlama yapma, somut engeli ver.
İlk kısa mesajda mod, iş/bulgu kimlikleri ve kapsam kaynağını bildir.
docs/implementation/execution-budget.md uygula: varsayılan 15000 output token
(thinking dahil) kontrol eşiği; usage yoksa UNKNOWN ve ilk temsilci sonunda
genişleme öncesi zorunlu kullanıcı kontrol noktası. Tasarım çelişkisinde DECISION;
uzun çözüm keşfi veya test beklentisi değiştirme yok. İlk regression+minimum fix
geçmeden diğer kapsamı inşa etme. Eşik aşımı sonrası yeni işlem başlatma; güvenli
checkpoint bırak, eksik doğrulamayı PASS sayma. Bu provider hard-cap değildir.
Plan kapsamı dışına taşma. Araştırma ekini varsayılan olarak yükleme;
gereken sözleşme detayı için yalnız bağlantılı bölümü aç. Dosyaları önce
sembol/caller aramasıyla daralt; doğruluk için gerekiyorsa tam dosyayı oku.
Ham test/build loglarını diske yaz; sohbete yalnız sonuç ve ilgili kısa hata gelsin.
Gerçek dış dokümantasyon belirsizliği çıkarsa kullanıcı onaylı tek araştırma
pilotunu docs/implementation/research-pilot.md koşullarıyla değerlendir. Kaynak/test
sorununu web araştırmasına çevirme; pilot için yapay iş veya tekrar arama yaratma.
İki başarısız denemede dur ve raporla.
FIX turunda koddan önce mevcut manifestte kısa matris tut: bulgu → invariant →
olay sırası → sembol → regression testi → önceki/sonraki sonuç. Aynı köklü
bulguları grupla; yalnız rapordaki örneğe yama yapma. İlgili active/pending/
OS-owned/unresolved kardeş durumlarını hedefli kontrol et; tüm matrisi açma.
Önce en yüksek riskli tek bulguyu ortak production yolunda dar testle yeniden
üret; test beklentisini mevcut hatalı koddan değil review/plan sözleşmesinden türet.
Sonra düzelt ve yalnız etkilenen yolları doğrula. Yeniden üretilemiyorsa kanıtı
raporla; varsayımla büyük rewrite yapma. Aynı invariant için iki başarısız
düzeltmede dur; yeni R numarası/sohbet iki-deneme sayacını sıfırlamaz.
İlk düzenlemeden önce başlangıç HEAD/status ve yalnız değiştirilecek dosyaların
başlangıç içeriğini veya yeniden oluşturulabilir diff'ini mevcut işin evidence
dizinine kaydet (CURRENT dahil; sır/kimlik bilgisi kopyalama). Başlangıçta dirty
veya untracked dosyalar için yalnız ad/hash yeterli değildir. Tüm repo snapshot'ı
alma; mevcut kanıt mekanizmasını kullan. Kapanışta:
CURRENT.md'de işi "uygulandı; bağımsız GPT review bekliyor" olarak belirt;
checkbox'ı [x] yapma. "Sıradaki iş" ve hazır prompt ayrı GPT /review olsun.
verification-before-completion
skill'iyle devir bilgisi bırak (başlangıç HEAD, diff kapsamı, komutlar, log
yolları, açık kapılar). Başlangıçtaki mevcut değişiklikleri ayır; tracked,
staged ve untracked kapsamı ile işe ait diff/kanıt yollarını açıkça kaydet.
Opus'a ayrıca review sonrası kayıt/kapanış işi devretme. Commit/push yok.
Plan içindeki uygulama/test/teşhis ve kendi kodunun düzeltmeleri aynı Opus
sohbetinde kalır; planın tasarımını/kapsamını kendiliğinden değiştirme.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. Tamamlanan uygulama için yeni GPT /review öner;
iki başarısız denemeyi yeni sohbetle sıfırlama.

Plan/review otomatik shell expansion ile yüklenmez; mod seçiminden sonra
gereken dosya/bölümler okunur.
