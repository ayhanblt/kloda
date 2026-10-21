# Windows Codex — güncel tek fixture tanılama prompt'u

2026-10-21: Önceki dört-test prompt'u ilk fixture FAIL sonrası durdu. Aşağıdaki metin yalnız onaylanan tanılamalı tek yeniden denemeyi kapsar. Kullanıcı güncel kaynakları ve yeni dosyaları kendi Git aktarımıyla Windows'a taşıdıktan sonra bağlı Windows konuşmasına gönderir.

```text
Repo: C:\Users\ayhan\Desktop\projects\kloda

Önce AGENTS.md, .omp/AGENTS.md, Codex handoff ve
 docs/implementation/windows-fixture-diagnostic-handoff.md belgesini oku.
Bu görev yalnız bu yeni tek-test belgesi kapsamındadır; eski dört-test
prompt'unu yürütme.

Ayhan'ın onayladığı cfg(test) fixture tanılamasıyla yalnız şu exact case'i
bir kez yeniden çalıştır:
installation_files::windows::candidate::tests::rename_atomically_refuses_existing_target_and_preserves_pending

Önce fixture-diagnostic-source-hashes.json envanterindeki 12 kaynak dosyasını
strict UTF8, sayısal leading BOM kontrolü, CRLF→LF ve BOM'suz UTF8 SHA256 ile
doğrula. Eski10 dosyalık envanteri değiştirme veya bu dilim için kullanma.
Uyuşmazlıkta dur; kaynak overwrite veya hash benimseme yok.

Yeni devir belgesindeki mevcut explicit MSVC1.99.0 locked/no-run derleme,
Cargo artifact/path/hash doğrulaması ve tek exact ignored --list kontrolünü
tamamla. Ardından yalnız yukarıdaki test için --exact --ignored --nocapture
--test-threads=1 kullan. Tek deneme; FAIL/UNKNOWN/PASS sonrasında dur.
Diğer üç testi ve tarihsel absent-target PASS testini çalıştırma.

Gerçek stage/operation/varsa Win32 kodunu ve assertion sonucunu kaydet.
Çıktı yalnız reddedilen işlemi kanıtlıyorsa sandbox/ACL vb. alt neden uydurma.
InitializeDefaultDrives uyarısını koru; profil/config/ortam değiştirme.

Kaynak/test assertion/manifest, yetki/share/ACL veya güvenlik kontrolü
 değiştirme. Gerçek authority/anahtar/pin/epoch/cert/DB/arşive dokunma.
Owner/probe/TPM/network/app, cleanup/reset/adoption/fallback/admin bypass,
Git işlemi veya model/effort değişikliği yok.

Kanıtları mevcut Git-dışı raw ve Git'e uygun seçilmiş metin/JSON ayrımıyla
kaydet; önceki raporları ezme. Ayrı sonuç review yap. Ne çalıştı, hangi
 aşamada durdu, kalan3 NOT_RUN ve yeni rapor yollarını Türkçe bildir ve dur.
D2/D3, continuity, cert/SQLite binding veya platform kabulüne geçme.
```
