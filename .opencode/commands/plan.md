---
description: Backlog'daki tek iş için GPT planı
model: openai/gpt-6.1-sol
---

AGENTS.md → CURRENT.md backlog'unu oku. Yalnız $ARGUMENTS için uygulama planı yaz.
Yeni iş/test/fixture önermeden ilgili eski kanıtı mevcut diff ile karşılaştır:
yeniden kullanılacak / değişiklikten etkilenmiş / eksik. Her tekrar için somut
gerekçe göster; yeni sohbet veya kayıp fixture tek başına tekrar gerekçesi değildir.
En küçük yeterli çözümü seç, tek net sonraki adım ver; onaylı ertelemeyi yeniden açma.
Goal'u bu işin sözleşmesinde bir kez tanımla: gözlenebilir sonuç, kapsam dışı
alanlar ve sabit kimlikli bitti ölçütleri. İlgili durum-geçiş tablosunu aynı belgede
tut (satır ID / başlangıç / olay / beklenen state ve yan etki / kabul testi).
Geliştirme ve review bu tek kaynağa referans verir, yeni goal kopyası üretmez.
Bir iş için tek onaylı çözüm planı oluştur; kabul satırları ajan içi kontroldür,
ayrı görev/onay/sohbet değildir. Review ölçütlerini baştan belirt: davranış ve
etkilenen yolların kanıtı, temiz kod/proje standartları, ilgili test/lint/typecheck/build.
Zorunlu kontrolleri ertelenmiş fiziksel/release kapılarından açıkça ayır.
Gerekli dış araştırmayı research-pilot.md uyarınca düşük maliyetli subagent'a ver;
dar soruyu ve resmî kaynak kanıtını doğrula. Proje içi çözüm/kök neden ana ajandadır.
İçerik: hedef, dosyalar/akışlar, korunacak davranış, en dar doğrulama ve durdurma
kriteri (iki-deneme kuralı). docs/implementation/execution-budget.md uyarınca risk/model önerisi, bütçe
verimlilik kontrolünü, test önkoşulları ve ilk temsilci kanıt kapısını belirt.
UNKNOWN/15000 eşiğini kullanıcı onayına veya alt görev duruşuna dönüştürme.
Kritik tasarım çatışmasını
implementere bırakma; yalnız hazır sözleşme uygulamaya devredilir. İlk uygun
düşük riskli işte tek Sonnet pilotu için /implement-pilot öner; güvenlik işinde
normal /implement korunur. Sonnet'in kullanıcı seçimi olmadan model değiştirme.
Geliştirme noktalarını somutlaştır: hedef dosya ve
fonksiyon/bileşen, mevcut sorun, beklenen değişiklik ve ilgili kabul ölçütü.
Concurrency/kalıcılık işinde en küçük değişiklikten önce invariant ve olay-sırası
tablosu ver: başlangıç durumu, kesinti/geç callback, beklenen kalıcı durum ve OS
yan etkisi, bunu yakalayan dar test. Birbirine bağlı tüm katmanları tek büyük
uygulama yığınına bırakma; ilk temsilci test→dar uygulama→etkilenen genişletme
sırasını belirt. Sadece dosya sayısını küçük tutmak işi küçük yapmaz. Kritik
tasarım seçimini implementere bırakma; belirsizse hazır/onaylı etiketi verme.
Doğrulanmış bulguları varsayımlardan ayır; belirsiz kritik konu varsa uygulama
yerine aynı GPT sohbetinde dar salt-okunur araştırma ve tasarım netleştirmesi
yap; sırf bu alt adım için yeni sohbet açtırma. Çözülemeyen kritik konu varsa
somut engeli/karar ihtiyacını belirt ve dur. Gereksiz tam kod/pseudocode üretme.
Yeni işin planını docs/implementation/plans/next-plan.md dosyasına yaz; aktif onaylı
işin dar düzeltmesinde planı baştan oluşturma, yalnız ilgili sözleşmeyi güncelle.
Sonraki işler için plan kısa bir uygulama sözleşmesi olsun: durum/onay, amaç,
dosya-sembol-değişiklik tablosu, zorunlu invariant ve kabul ölçütleri, dar doğrulama,
açık kararlar ve devir. Hedef 100–150 satır; güvenlik sözleşmesini kesmek için
katı limit değildir. Araştırma tarihçesi, elenen seçenekler ve uzun kaynak
dökümlerini gerekiyorsa docs/implementation/plans/<iş-kimliği>-research.md'ye
yaz; sözleşmeden yalnız gerekli bölümüne bağlantı ver. Bu araştırma eki dışında
başka dosya değiştirme, kod yazma, commit yok. Geçmiş planları başlangıç girdisi yapma.
Sonuçta planın "uygulamaya hazır" veya "hazır değil" durumunu açıkça belirt.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. Yalnız onaylı hazır planı Opus'a devret;
aynı işin mevcut Opus sohbetini kullan, yoksa yeni sohbet için /implement öner.
