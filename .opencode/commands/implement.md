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
düşük maliyetli subagent'a ver; dar brief ve resmî kanıtı doğrula. Proje içi kök neden
araştırmasını kendin yap; yapay dış soru veya aynı soruya tekrar arama yaratma.
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
checkbox'ı [x] yapma. Hazır prompt ayrı GPT /review olsun; mevcut review sohbeti varsa
oraya dön. FIX için de mevcut Opus sohbetini kullan; alt test başına sohbet açtırma.
verification-before-completion
skill'iyle devir bilgisi bırak (başlangıç HEAD, diff kapsamı, komutlar, log
yolları, açık kapılar). Başlangıçtaki mevcut değişiklikleri ayır; tracked,
staged ve untracked kapsamı ile işe ait diff/kanıt yollarını açıkça kaydet.
Opus'a ayrıca review sonrası kayıt/kapanış işi devretme. Commit/push yok.
Plan içindeki uygulama/test/teşhis ve kendi kodunun düzeltmeleri aynı Opus
sohbetinde kalır; planın tasarımını/kapsamını kendiliğinden değiştirme.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. Tamamlanan uygulama için bağımsız GPT /review öner;
mevcut review sohbeti varsa onu kullan, yoksa yeni sohbet açılır.
iki başarısız denemeyi yeni sohbetle sıfırlama.

Plan/review otomatik shell expansion ile yüklenmez; mod seçiminden sonra
gereken dosya/bölümler okunur.
