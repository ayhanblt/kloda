# D1 Windows — Git’e uygun seçilmiş test kanıtları

**Son yön:** [ayrı standart hesap devri](../../windows-d1-native-user-handoff.md), [14 kaynak inventory](native-user-source-hashes.json), [Mac kontrol/review kaydı](native-user-preparation.json). Yeni test-only süreç-token koruması hazırlanmıştır; Windows compile/package/hesap/runtime NOT_RUN. Eski kaynak inventory'leri tarihsel olarak korunur.

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

- [Native-user A package 20261021T194101Z](native-user-package-20261021T194101Z.json) / [report](native-user-package-20261021T194101Z.txt): source14/14, locked/no-run build0, original/bundle five exact lists0; runtime NOT_RUN. [Single interactive user block](native-user-block-20261021T194101Z.txt) is outside the fixed five-file binary bundle.

- [Token ReturnLength package 20261022T124122Z](token-length-package-20261022T124122Z.json) / [report](token-length-package-20261022T124122Z.txt): unchanged acceptance, numeric query/capacity/ReturnLength diagnostic; build0, preflight list-only0; runtime NOT_RUN. [Preflight-only block](token-length-preflight-block-20261022T124122Z.txt), [new source snapshot](token-length-source-hashes-20261022T124122Z.json).

- [Aligned BOOLEAN fix 20261022T130517Z](token-boolean-package-20261022T130517Z.json) / [report](token-boolean-package-20261022T130517Z.txt): Microsoft2308-confirmed class21 length1/DWORD alignment; strict unchanged token policy. Compile0/list-only0; runtime NOT_RUN. [Preflight-only block](token-boolean-preflight-block-20261022T130517Z.txt), [new source snapshot](token-boolean-source-hashes-20261022T130517Z.json).

- [Native BOOLEAN preflight result 20261022T131955Z](token-boolean-native-result-20261022T131955Z.json): user execution raw output read directly; preflight1PASS/exit0, native fields0/0/0/1, class21 length1; process exited. Mutating4 NOT_RUN; no agent runtime.

- [Four-case stage 20261022T132354Z](d1-four-package-20261022T132354Z.json): after verified native preflightPASS; identical exe reused, source14 unchanged, four exact lists0, runtimeNOT_RUN. [Four-case user block](d1-four-block-20261022T132354Z.txt) includes no standalone preflight; every existing Fixture still verifies native context.

- [Writer-role diagnostic 20261022T133736Z](writer-role-package-20261022T133736Z.json): standard-account contextPASS then extra valid writer ACE rejected (collision101; remaining3NOT_RUN); cfg(test) fixed local role/shape metadata only, unchanged refusal. Compile/list0, new runtimeNOT_RUN. [Single collision block](writer-role-block-20261022T133736Z.txt), [new source snapshot](writer-role-source-hashes-20261022T133736Z.json).

- [Writer-role native result 20261022T140301Z](writer-role-native-result-20261022T140301Z.json): raw collision101/contextPASS/process exited; named_match=false/account_sid_shape=true at same rejected ACE; extra trustee outside current allowlist. Remaining3NOT_RUN; exact identity/provenance UNKNOWN; no new agent runtime.

- [Readonly inheritance summary 20261022T141516Z](writer-inheritance-summary-20261022T141516Z.json): matching candidate grant explicit at protected profile root, inherited in AppData/Local; independent observer-user match, user recalls Explorer Continue; MicrosoftKB950934 behavior consistent. Historical creator/event UNKNOWN; no ACL/guard/test changes; next environment decision pending.

- [Verified four-case native result](d1-four-native-result-20261022T144423Z.json): four exact PASS/exit0, four list0, eight exited; independent evidence/privacy review complete. [Mac handoff](d1-macos-handoff-20261022T144423Z.md). Disposable D1 only; production/durability/continuity/platform gates remain open.
- [D2 contract / D3 generation design checkpoint](d2-d3-contract-20261022T150939Z.json): final Windows locked/offline test build0; eight exact pure tests PASS including the two decoder gaps. Production integration blocked on exact durability composition; generation design only, no namespace/key/old-state access. See [design and acceptance](../../windows-d2-d3-contract-and-fresh-trust.md).
