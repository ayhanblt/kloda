# F1 tekrar maliyeti — kök neden ve süreç düzeltmesi

12.11.2026; yalnız süreç/komut değişikliği. Aktif ürün uygulamasına müdahale yok.

Kanıt: yerel Claude kaydı `19eec870-eaed-4ad7-b28d-299319ee09e6.jsonl` başlangıç
implement mesajı 44781 karakter; komut next-plan.md'yi koşulsuz cat ile yüklemiş.
Yeni tur son review'u okumuş, fix-r8-r11 baseline açmış: bütün uygulamanın
baştan yazıldığı doğrulanmadı. Tekrarlanan user kayıtları iki kez gönderildiği
şeklinde yorumlanmadı. Önceki devam kaydı 42716 karakter checkpoint taşıyor.

Kaynak: fix-r1-r7/review.md (F1 evidence grubu). R1/R3/R5 kısmen düzeltildi;
R8/R9/R10–11 aynı ownership/handoff/migration invariant ailelerinin başka
olay sıralarında açık kaldığını bildiriyor. Bu inceleme onların bağımsız runtime
yeniden üretimi değil. Test PASS'lerinin eksik interleaving'leri kapsamadığı kayıtlı.

Kök nedenler:
- INITIAL ile FIX arasında komut yönlendirmesi yok; koşulsuz tam plan girdisi.
- Geniş birleşik durum makinesinde vaka yamaları; invariant ailelerinin komşu
  durumları ve kesinti pencereleri eksik sınanmış.
- İki-deneme kuralı bulgu/oturum değişince operasyonel olarak takip edilemiyor;
  manifestte invariant bazlı düzeltme sonucu gerekiyor.
- Uzun düşünme ve büyük checkpoint tekrarları ölçülen maliyeti büyütüyor;
  provider kota hatası veya bütün planın yeniden kodlanması kanıtlanmadı.

Düzeltme: implement/review tam-plan shell injection kaldırıldı. CURRENT durumuna
göre INITIAL/FIX/REVIEW ayrımı; FIX için önce son review+manifest ve ilgili plan
bölümleri. Plan invariant/event-sequence/test matrisi ister; implement dar negatif
kanıt→fix→etkilenen test yapar. Review aynı invariant'ın kalan/yeni açığını ayırır,
iki başarısız yaklaşımı yeniden tasarıma döndürür. Normal devir yalnız komut.
Bu prompt-temelli yönlendirmedir, çalıştırılabilir zorunlu state-machine/sert kota
sınırı değildir; doğruluk veya token tasarrufu garantisi iddia edilmez.

Aktif F1 planı/ürün/test dosyaları/CURRENT değiştirilmedi (eşzamanlı uygulama
kaydıyla çakışmamak için). Bu checkpoint'e göre sonraki komutlar yeni kuralları
kullanır; zaten gönderilmiş prompt geriye dönük değişmez.
Devam AYNI mevcut Opus FIX turu; yeniden /implement gönderilmez. Sonraki GPT
review sonucu invariant bazlı değerlendirilir. Commit/push yok.
