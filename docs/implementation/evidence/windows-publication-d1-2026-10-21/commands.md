# Windows D1 — izinli komutlar ve sonuç toplama

> **Güncel override:** İlk collision case fixture aşamasında FAIL; diğer3 NOT_RUN. Son onay yalnız [tek-test tanılama devrini](../../windows-fixture-diagnostic-handoff.md) kapsar. Eski10 yerine o dilimin12 dosyalık envanteri ve yalnız bir exact case kullanılır; aşağıdaki dört-test sırası bu denemede çalıştırılmaz.

Bu prosedür yalnız [Windows görev belgesindeki](../../windows-codex-d1-handoff.md) dört kalan testi kapsar. Kullanıcının o belgeyi referans alan yürütme prompt’u gerekir. Burada hazırlanırken test/build/Windows komutu çalıştırılmadı.

## 1. Salt okunur ön kontrol

Repo kökü: Windows devir belgesindeki sabit yol. `AGENTS.md`, `.omp/AGENTS.md` ve devir belgesini oku. `git --no-optional-locks status --short` ve `git --no-optional-locks rev-parse HEAD` ile gerçek çalışma ağacını kaydet; Git mutation/network yok. Kullanıcı push/pull’u kendisi yapar. Pull çatışması/eksik kaynak varsa source overwrite, reset, stash, clean veya yeni overlay yapmadan dur. İlgisiz değişiklikleri koru; kaynak/test/helper davranışında açıklanamayan fark varsa test başlatma.

`source-hashes.json` içindeki **10 public dosyayı** oku ve strict UTF8 + en fazla bir leading U+FEFF kaldırma + CRLF→LF normalizasyonundan sonra SHA256 karşılaştır. Başka whitespace/BOM/encoding değişimi kabul etme. Manifest dışı arşiv/native state/config tarama/hash yok. Bir fark varsa yeni hash’i otomatik benimseme, dosyayı değiştirip PASS üretme: raporla ve dur. Kodun hâlâ cfg(test)-only olduğunu, fixture’ın fresh KnownFolder random test root kullandığını, gerçek pairing root/TPM/network açmadığını kaynak üzerinden kontrol et.

Toolchain doğrulama (yüklü değilse kurulum/güncelleme yapmadan dur):

```powershell
rustup.exe which --toolchain 1.99.0-x86_64-pc-windows-msvc rustc
```

Exit code0 şart. Ortamı yöneticiye yükseltme veya kalıcı env/config değiştirme. Shell çağrıları arasında değişkenlerin korunduğunu varsayma.

## 2. Taze test ikilisini yalnız derle

Repo kökünde:

```powershell
rustup.exe run 1.99.0-x86_64-pc-windows-msvc cargo test --manifest-path packages/pairing-native/Cargo.toml --locked --no-default-features --target x86_64-pc-windows-msvc --lib --no-run --message-format=json
```

Exit code0 olmadan ilerleme. `--no-run` kaldırılmaz. Standart çıktı ve exit code’u Git-dışı run alanına kaydet; native stderr yüzünden asıl exit code/çıktıyı kaybetme. `--message-format=json` içindeki `reason=compiler-artifact`, `target.name=kloda_pairing_native`, `profile.test=true`, `executable` dolu kaydı seç. Artifact manifest/src path’i bu repodaki `packages/pairing-native` ile uyuşmalı. **Tek** test executable seçilemiyorsa veya çıktı parse edilemiyorsa dur. Eski `4db531…exe` adını sabitleme, glob’daki ilk `.exe`yi seçme; Cargo `fresh=true` geçerli olabilir, çünkü frozen kaynak/derleme kontrolü yapıldı.

Executable’ın gerçek bu repo altındaki `packages/pairing-native/target/x86_64-pc-windows-msvc/debug/deps/` yolunda normal `.exe` olduğunu doğrula; reparse/symlink veya başka repo/hedef/belirsiz path varsa dur. Gözlenen executable SHA256 ve relatif artifact path’i run kaydına eklenebilir; binary dosyasını Git’e koyma. Toolchain/dependency/lock sürümü değiştirme, `npm ci`/Desktop production build’i ile bunu ikame etme.

Resmî sözleşmeler: [Cargo no-run](https://doc.rust-lang.org/cargo/commands/cargo-test.html), [compiler-artifact JSON](https://doc.rust-lang.org/cargo/reference/external-tools.html#compiler-messages). Gerekli güncel CLI lookup için repo Context7 kuralını uygula; sorguya özel veri koyma.

## 3. Dört exact test için liste ön kontrolü

Sıra ve tam adlar:

```text
installation_files::windows::candidate::tests::rename_atomically_refuses_existing_target_and_preserves_pending
installation_files::windows::candidate::tests::existing_pending_is_not_adopted_deleted_or_overwritten
installation_files::windows::candidate::tests::injected_cut_points_and_lost_reply_never_ack_or_regenerate
installation_files::windows::candidate::tests::target_appearing_after_preflush_is_not_replaced
```

Yukarıdaki gerçek artifact path’i kullanarak, her test için **çalıştırmadan önce**:

```text
<fresh-test-executable> <exact-test-name> --exact --ignored --list
```

Bu bir komut şablonudur: Codex gerçek path/adı yerleştirir; shell çağrısı PowerShell’de `&` operatörüyle yapılır. Dördünün liste ön kontrolünü dosya yazan ilk testten önce tamamla. Her listede yalnız ilgili `<exact-test-name>: test` satırı ve tek test bulunmalı; exit0 şart. Sıfır/birden fazla/eşleşmeyen test, benchmark, değişmiş binary veya sorgu hatası varsa testleri başlatma. `--list` test çalıştırmaz; [Rust libtest sözleşmesi](https://doc.rust-lang.org/rustc/tests/index.html#cli-arguments).

## 4. Her birini bir kez, sıralı ve ilk hatada durarak çalıştır

Her tam ad için, yukarıdaki sırada:

```text
<fresh-test-executable> <exact-test-name> --exact --ignored --nocapture --test-threads=1
```

Her çağrının native exit code’unu hemen al; stdout/stderr ve `running 1 test`/test adı/result satırını doğrula. **Başarısızlıkta sonraki test çağrılmaz; otomatik tekrar yapılmaz.** Exit0 tek başına yeterli değil:1 passed/0 failed/0 ignored ve beklenen exact ad/tek test görünmeli. Önceki test/diğer suite sonuçlarını bu dört testin yerine sayma. `--include-ignored`, genel prefix/all-suite `cargo test`, extra ignored test, `--list` dışında başka test çalıştırma yok. İlk daha önce geçen absent-target testini tekrarlama.

Tek bir pipeline içinde dört komutu kontrolsüz zincirleme; her birinin sonucu doğrulanmadan diğerine geçme. Ayrı tool çağrıları ya da açık native exit kontrolü olan fail-stop döngü kullanılabilir. Native stderr bir PowerShell hata kaydına dönüşürse çıktıyı kaybetme; hata kontrolünü kaldırma. Native test takılır/araç kesilirse sonuç **UNKNOWN/INCOMPLETE**, PASS değil; tekrar yok, raporla ve dur. Yapay cut noktaları process-kill/restart değildir.

## 5. Kanıt ve kapanış

Her run için `.local-evidence/windows-publication-d1-windows-runs/<UTC-run-label>/` altında compiler JSON/stdout/stderr, exit code, Git HEAD, source hash kontrolü, exe hash ve seçilmiş test adlarını sakla. Bu alan Git dışında kalır; fixture klasörleri bu alana taşınmaz/taranmaz/silinmez. Full env/config veya kullanıcı/native state içeriği loglama. Native fixture’lar actual LocalAppData altında kendi random test root’larını bırakır; hepsi geçerse en fazla9 yeni root (1 + 1 + 6 + 1); cleanup yok.

Git’e uygun bu klasörde yeni `windows-run-<UTC>.json` ve redakte `windows-run-<UTC>.txt` oluştur. UTC timestamp’i makineden gözle, uydurma. Her exact test için durum/exit/passed/failed/ignored/time (çıktıda varsa) ve kanıtın path’ini kaydet. Çalışmayanlar NOT_RUN, yarım/karşılığı doğrulanamayanlar UNKNOWN. Git HEAD, kaynak envanter doğrulaması ve relatif executable/hash bağını belirt. Önceki `results.json` tarihsel checkpoint’ini ezme; README’ye yeni run link’i ekle. Ham kişisel absolute path, özel veri veya tüm JSON build dump’ını Git’e otomatik koyma. [Saklama sınırı](README.md).

Ayrı sonuç-review geçişiyle exact test sayısı/exit/provenance/no-false-PASS ve hassas veri yokluğunu kontrol et; yeniden test çalıştırma. İlgili Windows handoff/status’a kısa gözlenen checkpoint eklenebilir, ürün/mimari kararını veya bu frozen kaynak hash’lerini değiştirme. Git add/commit/push/reset/clean/stash/pull yapma.

Son rapor: dört case tablosu; hata varsa ilk kırılan assertion/gerçek NTSTATUS ve kaynaktaki anlamı (çıktının sağlamadığını uydurma), runtime/source/exe kanıtları; çözülemeyen durability/recovery sınırı. **Tamamla ve dur.** Kullanıcı raporu ana macOS oturumuna getirir; bu Windows oturumu D2/D3, başka platform veya yeni geliştirme başlatmaz.
