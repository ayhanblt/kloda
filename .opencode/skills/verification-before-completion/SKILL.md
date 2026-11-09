---
name: verification-before-completion
description: Kloda'da bir işi bitti, düzeldi veya geçti diye raporlamadan önce kanıtı doğrula ve ayrıştır.
metadata:
  opencode/autoinvoke: false
---

"Bitti", "düzeldi" veya "PASS" demeden önce:

1. **Kabul ölçütleri.** GPT planındaki kabul ölçütlerini listele. Her biri için
   karşılayan kanıtı göster.
2. **Taze koşu.** Değişen davranışı kapsayan en dar test, lint, typecheck ya da
   build komutunu şimdi çalıştır ve çıktısını oku. Ham log
   `docs/implementation/evidence/` altında kalsın. Kısa durumu ve varsa hata
   parçasını raporla.
3. **Kayıtlı kanıt.** Değişmeyen davranış için başarılı eski testi tekrar etme.
   Kaynak ya da varyant hash'i ve kanıt yoluyla referans ver. Hash değiştiyse
   ya da kapsam belirsizse bu kanıtı geçerli sayma, bunu açıkça yaz.
4. **Üç ayrı başlıkla raporla:**
   - Taze çalıştırılanlar ve sonuçları.
   - Yeniden kullanılan kayıtlı kanıtlar.
   - Açık kalanlar: fiziksel cihaz, gerçek OS veya ağ, bağımsız review,
     çalıştırılamayan kontroller ve nedenleri.
5. **Devir.** Review için şunları bırak: başlangıç HEAD'i, diff kapsamı
   (izlenen ve izlenmeyen dosyalar), komutlar, log yolları, açık kapılar.

Çalıştırmadığın bir kontrolü PASS olarak yazma. İzole ya da sentetik kanıt
fiziksel kabulü kapatmaz. Aynı oturumda yaptığın kendi incelemen bağımsız
review değildir. Commit ya da push yalnız açık talimatla yapılır.
