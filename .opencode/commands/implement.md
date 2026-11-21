---
description: Hazır GPT planını uygula
model: claude-agent/sonnet
---

Yeni oturum/iş başlangıcında AGENTS.md → docs/implementation/CURRENT.md aktif iş/durumunu oku.
Aynı uygulama sohbetinde FIX/devam: başlangıcı yeniden yapma; değişen CURRENT bölümü,
son review'un yeni bulguları ve manifest/diff/kanıt farklarını oku. Bağlamda bulunan
değişmeyen AGENTS/plan/eski kanıtları tekrar yükleme. Talimat değişmişse veya bağlamda
yoksa gerekli kısmı oku; güncellik belirsizse hedefli diff/hash ile kontrol et.
CURRENT'tan modu seç; normal yönlendirme kararını kullanıcıya tekrar sorma:
- Onaylı ilk uygulama: INITIAL; next-plan.md güncel onaylı sözleşmesini oku.
- Review düzeltmesi bekleniyor: FIX; son review'un açık bulguları ve scoped kabul
  sözleşmesi esas görevdir. Önce son review ve tur manifestini oku; next-plan.md'den
  yalnız onay/kapsam ve ilgili invariant bölümlerini getir. Tüm planı yeniden
  uygulama, kapanmış bulguları yeniden yazma.
- Review bekleniyor veya iş kapalı: uygulamayı tekrarlama; doğru rol/komutu ver.
- Plan hazır değil/onaysız veya kayıtlar çelişkili: kodlama yapma, somut engeli ver.
İlk kısa mesajda mod, iş/bulgu kimlikleri ve kapsam kaynağını bildir.
Sözleşmedeki tek goal ve ortak durum-geçiş tablosunu kullan; yeniden tanımlama.
Mevcut manifestte ölçüt/satır ID → test/kanıt → karşılandı/açık eşlemesi tut.
Tek test yeşil diye goal tamamlandı deme; tüm zorunlu ölçütler ve ilgili
korunan komşular kanıtlanmalı. Bütçe/engel nedeniyle durursan işi kısmi/açık
bırak; güvenlik kapılarını atlayarak veya kapsamı sessiz daraltarak kapatma.
docs/implementation/execution-budget.md uygula: 15000 output token (thinking dahil)
ajan içi verimlilik kontrolüdür; UNKNOWN veya eşik tek başına durma/onay nedeni değil.
İlk temsilci regression+minimum fix geçince tüm onaylı etkilenen kapsama devam et.
FL/FS/FW gibi satırları ayrı görev/sohbet/review yapma. Tasarım çelişkisinde DECISION;
test beklentisini gevşetme. Durum mesajı: üst iş, aşama, kalan kapsam, karar ihtiyacı.
Plan kapsamı dışına taşma. Araştırma ekini varsayılan olarak yükleme;
gereken sözleşme detayı için yalnız bağlantılı bölümü aç. Dosyaları önce
sembol/caller aramasıyla daralt; doğruluk için gerekiyorsa tam dosyayı oku.
Ham test/build loglarını diske yaz; sohbete yalnız sonuç ve ilgili kısa hata gelsin.
Gerçek dış dokümantasyon belirsizliğini docs/implementation/research-pilot.md uyarınca
Haiku 5.5 (`claude-agent/haiku`) subagent'ına ver; ana uygulama modeli Sonnet 5.5'tir.
18.11 geçişi mevcut Opus çalışması bittikten sonra geçerlidir; çalışan Opus turunun
modelini/delegasyonunu değiştirme. Sonraki uygulama/FIX'te Sonnet kullan; effort'u koru.
Dar brief ve resmî kanıtı doğrula. Proje içi kök neden
araştırmasını kendin yap; yapay dış soru veya aynı soruya tekrar arama yaratma.
Gerektiğinde aynı Haiku'ya dar salt-okunur kanıt taraması, etkilenen normal/recovery/
hata çağıranları veya kabul→test eşlemesi ver (research-pilot.md). Karar/kod/test
çalıştırma bu salt-okunur görevlerde sende kalır. Bağımsız işe devam et; bağlı kararda sonucu bekle, aramayı tekrarlama.
Sonraki iş döngülerinde execution-budget.md §4 düşük-riskli yazma istisnasını uygula:
planın ayırdığı net işi doğrudan Haiku 5.5'e devret, önce aynı işi ayrıntılı yeniden
tasarlama. İzinli dosyalar/başlangıç/ID/komut/log yolları kısa brief olsun; tek yazar.
Haiku değişikliği ve seçilmiş dar kontrolleri tamamlar; sen gerçek diff/kanıtı doğrula,
başarılı kontrolü yeniden çalıştırma. Araç desteği yoksa UNAVAILABLE bildir; sessiz
model fallback yok. Mevcut devam eden review'un devir sözleşmesini değiştirme.
§5: plandaki kontrol seçimini kullan; dar compile/typecheck ardından runtime.
Yeni semantic diff veya hata yoksa seçimi/matrisi baştan kurma.
§5 “Araç ve teşhis disiplini”ni uygula: bağımsız çağrıları toplulaştır; gerçek test
exit code'u/tam logu koru, ilk ilgili uyarıyı incele. Takılmada sabit bekleme yerine
süreç durumunu doğrula; kök neden iddiasını tam regression ve etkilenen komşuyla kanıtla.
İki başarısız denemede dur ve raporla.
FIX turunda koddan önce mevcut manifestte kısa matris tut: bulgu → invariant →
olay sırası → sembol → regression testi → önceki/sonraki sonuç.
Review bulgusunu doğrudan yamalama: önce ilgili kod/olay sırasıyla kök nedeni doğrula;
dış API belirsizliğinde araştırma kullan. Onaylı davranış içindeki scoped fix için
yeni plan/onay isteme; temel tasarım veya kapsam değişecekse GPT kararına dön.
Aynı köklü bulguları grupla; yalnız rapordaki örneğe yama yapma. İlgili active/pending/
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
alma; mevcut kanıt mekanizmasını kullan. Review öncesi hazırlık:
- Goal/tablonun tüm zorunlu satırlarını kanıta eşle; ilgili çağıran/komşu yolları incele.
- Gerçek diff'te temizlik, sorumluluk sınırları, çeviri/stil ve 300 satır kuralını kontrol et;
  satır kazanmak için biçimsel sıkıştırma yapma.
- İlgili test/lint/typecheck/build/smoke sonuçlarını doğrula; etkilenmeyen başarılı
  kanıtı hash/varyantıyla yeniden kullan. Zorunlu eksik varsa KISMİ/BLOCKED bırak;
  NOT_RUN'ı veya self-review'ı kabul sayma. Önceden ertelenmiş kapıları açık göster.
Yalnız bu hazırlık tamamlanınca:
CURRENT.md'de işi "uygulandı; bağımsız GPT review bekliyor" olarak belirt;
checkbox'ı [x] yapma. İlk bağımsız review için yeni GPT sohbetinde /review ver;
mevcut review sohbetine dönüşte komutu yeniden çalıştırmasını isteme. Aynen
yapıştırılabilir tek kısa mesaj üret: "<iş/bulgu> FIX tamamlandı. Mevcut review'a
<manifest §bölüm> ve <fix diff/kanıt dizini> üzerinden devam et; önceki goal ve
kabul ölçütleri geçerli." Yer tutucuları gerçek kimlik/yollarla doldur.
Bu devam mesajına AGENTS→CURRENT başlangıç zincirini veya review komutunun sabit
gövdesini ekleme. Yeni karar/kısıt varsa yalnız onu ekle. Kullanıcı metni kısaltmak
zorunda kalmasın. FIX için mevcut uygulama sohbetini kullan; alt test başına sohbet açtırma.
verification-before-completion
skill'iyle devir bilgisi bırak (başlangıç HEAD, diff kapsamı, komutlar, log
yolları, açık kapılar). Başlangıçtaki mevcut değişiklikleri ayır; tracked,
staged ve untracked kapsamı ile işe ait diff/kanıt yollarını açıkça kaydet.
Uygulayıcıya ayrıca review sonrası kayıt/kapanış işi devretme. Commit/push yok.
Plan içindeki uygulama/test/teşhis ve kendi kodunun düzeltmeleri aynı uygulama
sohbetinde kalır; planın tasarımını/kapsamını kendiliğinden değiştirme.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. İlk review'da /review; mevcut review'a dönüşte yukarıdaki
kısa devam mesajı. Kullanıcıya komut + aynı talimatları yineleyen uzun açıklama verme.
iki başarısız denemeyi yeni sohbetle sıfırlama.

Plan/review otomatik shell expansion ile yüklenmez; mod seçiminden sonra
gereken dosya/bölümler okunur.
