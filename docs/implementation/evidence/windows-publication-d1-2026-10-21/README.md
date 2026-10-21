# D1 Windows — Git’e uygun seçilmiş test kanıtları

**Güncel:** [Windows araştırma grubu](../../windows-d1-investigation-workflow.md) ve [13 kaynak manifesti](security-rule-source-hashes.json). Önceki tek-test/dört-test izinleri tarihsel; yeni onay yalnız kanıt bağımlı disposable D1 çalışmasıdır.

Tarih:2026-10-21. Bu alan yalnız incelenmiş küçük metin/JSON kanıtları içindir. `.local-evidence/` Git dışında kalır; bu klasör onun kopyası veya tam yedeği değildir. Dosyalar Git’e eklenebilir durumdadır; Codex add/commit/push yapmadı. Kullanıcı kendi push/pull işlemlerini yapacaktır.

- [results.json](results.json): macOS D1 host kontrolleri ile Windows compile ve ilk fixture sonucunun tarihsel/provenance ayrımı. İlk export sırasında kalan dört test NOT_RUN idi; aşağıdaki güncel checkpoint bu tarihsel durumu günceller.
- [source-hashes.json](source-hashes.json): yalnız10 test/kaynak dosyasının SHA256 özeti; UTF8 BOM/CRLF normalizasyonu açık. Authority/key/epoch/DB içeriği hash’lenmedi.
- [windows-observations.txt](windows-observations.txt): seçilmiş kullanıcı stdout kanıtları; compile kısmı açıkça özet/normalize edilmiştir, ilk fixture çıktısı literal korunur.
- [commands.md](commands.md): Windows oturumunda test seçimi/derleme/kanıt toplama prosedürü. Bu dosyayı okumak tek başına test izni değildir; açık kullanıcı prompt’u gerekir.
- [review.md](review.md): bu devir/kanıt hazırlığının ayrı review’ı ve doküman kontrolleri; native test tekrarı değil.
- [Devir belgesi](../../windows-codex-d1-handoff.md): Windows’a özel tek görev, izin sınırları ve durma koşulları.

## Saklama sınırı

**İzinli:** sabit test adları, gözlenen assertion/exit/PASS/FAIL/NOT_RUN özeti, toolchain/target, relatif public kaynak yolları/hash’leri, redakte stdout metni ve review sonucu.

**Bu alana konmaz:** tüm `.local-evidence`, ZIP/native binary/build/target/cache/screenshot, ham session transcript/full environment/config/credential, kullanıcı adı içeren absolute path, cihaz seri/özel endpoint, TPM/private key/SPKI/certificate/epoch/pin/authority DB/WAL/SHM içerikleri, kullanıcı arşivi/verisi veya bunların hash’leri. `epoch.pending` gibi public sabit dosya adını ve testin disposable literal byte’larını anmak gerçek authority içeriğini saklamak değildir.

Ham Windows çıktısı gerekirse yalnız Git-dışı `.local-evidence/windows-publication-d1-windows-runs/` altında tutulur. Yeni derleme/test ham çıktısını otomatik buraya kopyalama; önce incele, private absolute path’leri redakte et, yalnız ilgili satırları `.txt`/JSON olarak ekle. Mevcut sonuçları yeni çalışmış gibi yeniden yazma; run/date/provenance alanıyla yeni checkpoint ekle. Derleme/native dosya-namespace sonucu power-loss/gerçek restart/ürün kabulü değildir.

Windows görevi bitince seçilmiş sonuçlar burada güncellenir; agent Git işlemi yapmaz. Kullanıcı raporu ana macOS oturumuna getirir ve sonraki kararlar orada alınır. Eski raw probe kaynakları mevcut değilse varmış gibi oluşturulmaz; hash eski archive’ı geri üretmez.

- [Windows run 20261021T125810Z](windows-run-20261021T125810Z.json) · [Türkçe rapor](windows-run-20261021T125810Z.txt): kaynak hash ön kontrolünde 10/10 uyuşmazlık; derleme ve dört test NOT_RUN.

## Güncel fixture tanılama dilimi — 2026-10-21

Kullanıcının ilettiği Windows raporunda düzeltilmiş hash10/10, compile/list exit0; ilk collision case fixture kurulumunda FAIL/101, diğer3 NOT_RUN. Özgün `140036Z` raporu/ham kayıt henüz bu checkout’ta yok; kullanıcı bildirimi kaynak olarak belirtilir. Hash hatası ilk karakterin yanlışlıkla çıkarılmasıydı; burada eski yanlış hash10/10 yeniden üretildi.

- [Tek-test devir ve onay sınırı](../../windows-fixture-diagnostic-handoff.md).
- [12 source hash](fixture-diagnostic-source-hashes.json): yalnız yeni onaylı tanılama denemesi; eski envanter korunur.
- [Hazırlık, kontroller ve review](fixture-diagnostic-preparation.json):9 host diagnostic PASS, strict clippy/fmt/line guard ve macOS native build PASS. Windows yeni compile/tek retry NOT_RUN; gerçek alt hata bilinmiyor.

## İç güvenlik ret koşulu tanılaması — 2026-10-21

Kullanıcı raporunda12/12 source, compile/list0, collision FAIL101 ve `Fixture(BaseSecurity)/SecurityValidation/None` gözlendi; random root/candidate yok. Aşağıdaki yeni hazırlık Windows sonucunu değiştirmiş sayılmaz.

- [Araştırma ve Astra/source review kaydı](security-rule-preparation.json): host10 diagnostic, strict clippy/fmt/line guard/native library build PASS; yeni Windows compile/runtime NOT_RUN.
- [Yeni13 public source hash](security-rule-source-hashes.json): önceki inventory’ler korunur; yalnız ilk güncel tanılama kaynağını sabitler.
- Windows araştırması her denemeye yeni UTC source/result bağını ekler; private SID/ACL/config/env/authority içeriği Git’e konmaz.

- [Windows investigation 20261021T185816Z](investigation-20261021T185816Z.json) / [report](investigation-20261021T185816Z.txt): UnexpectedDirectoryWriter proven; restricted and tool-approved collision FAIL101; diagnostic10PASS, remaining3 NOT_RUN; no guard relaxation. [Final source inventory](writer-diagnostic-source-hashes-20261021T185244Z.json).
