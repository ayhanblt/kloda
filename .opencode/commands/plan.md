---
description: Backlog'daki tek iş için GPT planı
model: openai/gpt-6.1-sol
---

AGENTS.md → CURRENT.md backlog'unu oku. Yalnız $ARGUMENTS için uygulama planı
yaz: hedef, dosyalar/akışlar, korunacak davranış, en dar doğrulama ve durdurma
kriteri (iki-deneme kuralı). docs/implementation/execution-budget.md uyarınca risk/model önerisi, bütçe
eşiği, test önkoşulları ve ilk temsilci kanıt kapısını belirt. Kritik tasarım çatışmasını
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
Planı docs/implementation/plans/next-plan.md dosyasına yaz (üzerine yaz).
Sonraki işler için plan kısa bir uygulama sözleşmesi olsun: durum/onay, amaç,
dosya-sembol-değişiklik tablosu, zorunlu invariant ve kabul ölçütleri, dar doğrulama,
açık kararlar ve devir. Hedef 100–150 satır; güvenlik sözleşmesini kesmek için
katı limit değildir. Araştırma tarihçesi, elenen seçenekler ve uzun kaynak
dökümlerini gerekiyorsa docs/implementation/plans/<iş-kimliği>-research.md'ye
yaz; sözleşmeden yalnız gerekli bölümüne bağlantı ver. Bu araştırma eki dışında
başka dosya değiştirme, kod yazma, commit yok. Geçmiş planları başlangıç girdisi yapma.
Sonuçta planın "uygulamaya hazır" veya "hazır değil" durumunu açıkça belirt.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. Yalnız hazır plan için yeni Opus /implement öner.
