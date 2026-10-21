# Windows Codex — güncel araştırma çalışma grubu prompt'u

2026-10-21: Kullanıcı, her küçük tanılamada onay beklemek yerine disposable Windows D1 engelinin kanıta dayalı araştırılmasını onayladı. Bu metin eski dört-test ve tek-retry prompt'larının yerine geçer; gerçek güvenlik/mimari/veri sınırları değişmez.

```text
Repo: C:\Users\ayhan\Desktop\projects\kloda

Önce AGENTS.md, .omp/AGENTS.md, güncel ADR'ler, Codex/session handoff ve
 docs/implementation/windows-d1-investigation-workflow.md belgesini oku.
Oradaki kanıta dayalı Windows-only araştırma grubunu uygula.
Eski tek-deneme/dört-test prompt'larını güncel görev diye yürütme.

Kullanıcı kapsam içindeki güvenli disposable tanılama/testleri, kanıtlanmış
kusurun mevcut güvenlik kararlarını değiştirmeyen minimal düzeltmesini ve
ilgili regresyon/review'ı onayladı. Her küçük adımda tekrar onay isteme.
Yeni bilgi olmadan aynı FAIL'i körlemesine tekrar etme.

Başlangıçta security-rule-source-hashes.json içindeki13 dosyayı strict UTF8,
sayısal leading BOM65279, gerçek CRLF→LF ve BOM'suz UTF8 SHA256 ile doğrula.
Kaynak aktarımı eksik/farklıysa overwrite/reset veya yeni hash benimsemeden dur.
İlk derlemenin Cargo artifact/path/exe hash'ini doğrula; önce collision case'in
exact ignored list ve tanılamalı çalıştırmasıyla ilk iç ret koşulunu gözle.

Son bilinen actual ret Fixture(BaseSecurity)/SecurityValidation/None idi.
Bu, candidate publish hatası değildir. Yeni SecurityRule etiketiyle owner,
ACL/ACE parsing, writer grant veya principals nedenlerini ayır. Sandbox
nedenini varsayma; gerçek process/launcher bağlamını anonim kanıtla doğrula.
InitializeDefaultDrives uyarısına kanıtsız nedensellik yükleme.

Bulgulara göre araştırma, güvenli dar tanılama, ilgili otomatik kontrol ve
ayrı review ile devam et. Fixture kurulumu ve collision geçerse diğer üç
belgelenmiş D1 testine geçebilirsin. Yeni source değişikliğini baseline/diff/
review ve ayrı UTC hash envanteriyle kaydet; eski manifest/sonuçları ezme.
Bilinmeyen güvenlik politikasını tasarlama veya test assertion'ını değiştirip
PASS üretme. D1 başarısını production Windows başarısı sayma.

Mevcut authority/key/pin/epoch/cert/DB/WAL/SHM ve kullanıcı arşivine dokunma.
ACL/owner/share veya guard gevşetme; sandbox kapatma/reconfigure, admin/UAC,
runas/impersonation/GUI escape, namespace/provider/software fallback, cleanup/
reset/adoption yok. Mevcut policy içindeki somut komuta özel standart araç approval akışını
kullanabilirsin; gerekiyorsa gerçek UI onayını bekle, reddinde dur. Bunu
sandbox bypass/config değişikliği izni sayma. Git mutation/network veya
model/effort değişikliği yok. Gerçek owner/probe/app/TPM/network/QR/grant yok.

Kanıtları mevcut raw-Gitdışı ve seçilmiş-Gituygun metin/JSON ayrımıyla tut.
Handoff/status/roadmap'e son checkpoint'i ve tamamlanan/açık/engelli işleri yaz.

İzinli kapsamda ilerleyebildiğin sürece devam et. Yalnız gerçek yeni güvenlik/
mimari kararında, mevcut veriye müdahale ihtiyacında veya izinli altyapıda
çözülemeyen engelde somut kanıt ve tek net karar sorusuyla dur.
D2/D3/certSQLitebinding/continuity ve fiziksel ürün kabulüne kendiliğinden geçme.
Sonuçları Türkçe, test/exit/source/exe kanıtları ve kalan sınırlarla raporla.
```
