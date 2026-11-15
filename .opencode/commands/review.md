---
description: Gerçek diff'in bağımsız GPT review'u
model: openai/gpt-6.1-sol
---

Uygulamadan ayrı GPT oturumunda çalış; bu koşul sağlanmıyorsa bağımsız kabul verme.
Planın tek goal/bitti ölçütleri ve ortak durum-geçiş tablosunu esas al. Manifestte
her zorunlu ölçüt/satır ID'nin kanıtını kontrol et; eksik varsa goal kapanmaz.
Yeni goal üretme; bulguyu mevcut ölçüte bağla. Gerçekten yeni ürün hedefi ayrı
kapsam kararıdır. Scoped fix kabulünü üst işin bütününün kabulü olarak raporlama.
Goal'un bütün uygulamasını topluca review et; kabul satırlarına ayrı review açma.
Hataya ek olarak etkilenen yolları, kod temizliği/sorumluluk sınırlarını, proje
standartlarını ve gerekli test/lint/typecheck/build kanıtlarını kontrol et.
Gerekli dış API araştırmasını research-pilot.md ile düşük maliyetli subagent'a ver;
gerçek kod review'u ve kabul kararı ana GPT'de kalır.
AGENTS.md → CURRENT.md'nin aktif iş bölümünü oku. İlk uygulama review'unda onaylı
planı kullan. FIX review'unda önce son bulgular + tur manifesti + düzeltme diff'i;
plandan yalnız ilgili invariant/onay/kapsam bölümleri. Etkilenen komşu güvenlik
yollarını da incele; eski işin tümünü ve başarılı kontrolleri yeniden başlatma.
Araştırma eki ve tarihî CURRENT kaydı varsayılan okuma değildir; yalnız ilgili
kanıt/karar bölümünü aç. Sembol/caller keşfiyle okumayı daralt; tam dosya gerekiyorsa
oku. Ham logları bağlama dökme; başarılı değişmeyen kontrolleri tekrar çalıştırma.
Uygulama devrindeki başlangıç HEAD'i, kapsamı ve kanıt manifestini kullanarak
işe ait gerçek diff'i incele: tracked, staged ve untracked dosyalar dahil.
Birikmiş ilgisiz değişiklikleri topluca bağlama alma; aynı dosyadaki önceki
değişiklikleri başlangıç kaydıyla ayır. Belirsizliği etkisine göre sınıflandır:
ürün/güvenlik davranışını veya kabul ölçütünü doğrulamayı engelliyorsa kapanış
engeli say. Yalnız CURRENT/checkpoint gibi durum belgelerinin tarihî satır
aidiyeti eksikse, mevcut içeriğin kaynak/kanıtla doğruluğu ve diğer kabul
ölçütleri doğrulanabiliyorsa sınırlama olarak kaydet; tek başına kapanışı
engelleme. ADR/ürün kararı değişikliğini sıradan durum kaydı sayma.
Eksik tarihî kanıtı uydurma; her engelleyici bulguda karşılanamayan kabul
ölçütünü ve somut etkisini belirt. İdari eksiklik için tekrar review döngüsü açma.
Plana, güvenlik/ADR
sınırlarına ve korunacak davranışlara karşı review et; her bulguyu dosya:satır,
önem ve kabul adımıyla ver. Çalıştırılmamış kontrolü PASS sayma.
Ürün kodunu değiştirme. Review sonucunu ilgili evidence dizininde review.md'ye
kaydet: gerçek reviewer modeli/oturumu (bilinmeyeni uydurma), HEAD ve diff
kapsamı, kabul kararı, bulgular, taze/yeniden kullanılan kanıt ve açık kapılar.
Kabul ölçütleri karşılanıp bağımsız review kabul edildiyse aynı oturumda yalnız
CURRENT/ilgili manifest kapanış kayıtlarını güncelle ve maddeyi [x] yap.
Engelleyici bulgu varsa checkbox açık kalsın; tüm bulguları tek gerekçeli listede
topla, engelleyici bulgularla isteğe bağlı temizlik önerilerini ayır. Onaylı davranış
içindeki scoped düzeltmeyi mevcut Opus sohbetine devret: kök neden doğrulama →
regression → minimum fix → etkilenen yollar. Yeni plan/onay yalnız tasarım/kapsam
kararı gerekiyorsa. Sonucu bu GPT review sohbetinde değerlendir.
Her bulguyu invariant ailesine bağla (stale ownership, OS handoff, migration
proof/storage fence vb.); önceki bulgudan kalan mı yeni hata mı belirt. Devirde
dosya/sembol, başlangıç durumu→olay sırası→beklenen sonuç, dar regression ve
korunacak yollar olsun. Yeni beklentiyi eski kabul şartı gibi ekleme.
Manifestte invariant bazlı başarısız denemeleri koru; aynı yaklaşım iki kez
başarısızsa otomatik yeni FIX yerine GPT tasarım değerlendirmesi gerekir.
Mevcut F1 R12/R3 clock turu yeniden reddedilirse doğrudan yeni Opus FIX devretme:
önce aynı GPT sohbetinde kök neden/en küçük çözüm/sözleşme çelişkisini netleştir,
CURRENT'a DECISION yaz. Sonraki uygulamalarda execution-budget.md kapıları geçerli;
dar fix sözleşmesi tasarım belirsizliği taşıyorsa aynı şekilde önce GPT çözümü gerekir.
CURRENT'ta INITIAL/FIX/REVIEW/DECISION durumunu ve son review/manifest yollarını
açıkça göster. Normal FIX devrinde tam prompt yerine `/implement` yeterli.
Ertelenmiş test/kabul kapılarını koru; kod review kabulünü tam PASS sayma.
Kayıt için Opus'a yeni oturum açtırma. Sıradaki iş ve hazır promptu güncelle;
sonraki planı/uygulamayı başlatmadan dur. Commit/push yok.
Review açıklamaları, kanıt tamamlama ve belge kapanışı aynı GPT review
sohbetinde kalır; yalnız bunlar için yeni oturum isteme.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. Aynı işte mevcut Opus/GPT rol sohbetlerini kullan;
yeni bağımsız işte veya ilgili rol sohbeti yoksa yeni sohbet öner.

!`git status --short`
