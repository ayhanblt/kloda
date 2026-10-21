# Windows Codex CLI başlangıç prompt’u — D1 kalan koruma testleri

Aşağıdaki metin kullanıcı tarafından Windows Codex CLI’ye verildiğinde yalnız belirtilendört test için dar yürütme iznidir. Bu dosyayı otomatik keşfetmek/okumak izin değildir. Görev bitince ana macOS oturumuna dönülür.

```text
Repo: C:\Users\ayhan\Desktop\projects\kloda

Önce AGENTS.md, .omp/AGENTS.md ve docs/implementation/windows-codex-d1-handoff.md dosyasını oku. Bu Windows oturumu yalnız o devir belgesindeki D1 kalan dört koruma testi içindir; ana geliştirme planını yürütme.

Belgenin referans verdiği seçilmiş kanıtları ve kaynak hash envanterini oku; .local-evidence yokluğunu eksik önkoşul sayma. Repo/kaynak/toolchain kontrollerinden sonra test ikilisini çalıştırmadan derle ve gerçek compiler-artifact çıktısından seç. Dört exact ignored testin her birini bir kez, belirtilen sırada ve ilk hatada sonraki teste geçmeden durarak çalıştırmanı onaylıyorum. İlk daha önce PASS olan absent-target testini veya başka suite/owner/probe’u tekrar çalıştırma.

Ürün/test kaynaklarını, güvenlik kontrollerini, mevcut epoch.pending/anahtar/pin/sertifika/authority/arşiv verisini değiştirme. Model/effort/config değiştirme; Git add/commit/push/pull/reset/clean/stash yapma. Sadece disposable fixture’lar, compiler artifact’ları ve belgedeki kanıt/status kayıtları izinlidir. Yeni karar, kaynak farkı, compile/test hatası, belirsizlik veya altyapı engelinde düzeltme/yeniden deneme yapmadan raporla ve dur.

Gerçek exit/assertion çıktılarıyla redakte kanıt ve dört testin sonuç tablosunu hazırla; çalışmayanı PASS sayma. Git’e uygun küçük sonuçları docs/implementation/evidence/windows-publication-d1-2026-10-21/ altında yeni run olarak kaydet; bütün .local-evidence veya ham private çıktı ekleme. Ayrı sonuç-review geçişi yap. Kesin kanıt sınırlarını koru: fixture başarısı power-loss/gerçek restart/mevcut kurulum onarımı/ürün kabulü değildir.

Bitince Türkçe kısa rapor ver ve dur. Yeni geliştirmeye, D2/D3’e, Android/iOS’a veya sonraki roadmap adımına geçme. Sonucu bu Windows oturumundan alıp ana macOS oturumuna ben taşıyacağım; devam kararı orada verilecek.
```
