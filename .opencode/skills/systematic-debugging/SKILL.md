---
name: systematic-debugging
description: Kloda'da bir hata, başarısız test veya beklenmeyen davranışın kök nedenini düzeltmeden önce kanıtla bul.
metadata:
  opencode/autoinvoke: false
---

AGENTS.md ve CURRENT.md'nin konuyla ilgili bölümünü oku. Güvenlik açısından
hassas bir koddaysan önce ilgili ADR'yi oku.

1. **Yeniden üret.** Hatayı tek ve dar bir komutla ya da adımla yeniden üret.
   Ham logu `docs/implementation/evidence/` altına yaz. Bağlama yalnız durumu
   ve ilgili kısa hata parçasını al. Üretemiyorsan bunu söyle, tahminle düzeltme.
2. **Aşamayı ayır.** Hatanın hangi katmanda çıktığını göster: UI/TS, köprü
   (NAPI/JNI/Swift), Rust engine, ağ/TLS/kimlik doğrulama, dosya sistemi/OS
   ya da ortam (ör. lockfile dışında kalan node_modules kopyası).
3. **Karşılaştır.** Çalışan benzer yolu ya da son geçen kanıtı bul ve farkı yaz.
4. **Tek hipotez.** Bir hipotez kur ve en küçük değişiklikle sına. Aynı anda
   birden fazla değişiklik yapma.
5. **Önce test.** Hatayı yakalayan testi projenin mevcut aracıyla yaz: mobilde
   Jest, masaüstünde Vitest, Rust'ta `cargo test`. Testin doğru sebepten
   başarısız olduğunu gör. Sonra düzelt ve testi geçir.
6. **Benzerleri ara.** Aynı kök neden başka yerde de varsa listele. Kapsam
   dışında kalanları yalnız raporla.

Üç hipotez başarısız olursa dur ve bulguları kullanıcıya sun. Yeni bir mimari
ya da güvenlik politikası kararı gerekiyorsa dur. Kullanıcı verisini, eşleşmeyi
veya fiziksel cihaz durumunu sıfırlama. Bağımlılık ekleme ya da yükseltme.
Testleri devre dışı bırakma, beklenen sonucu zayıflatma.
