# Windows D1 — ayrı standart hesap devri

2026-10-21. **Ayhan onayladı:** mevcut profilin ACL/guard/verisini değiştirmek yerine ayrı, yeni, boş standart Windows hesabında disposable D1 doğrulaması. Bu belge bu çalışma grubu için eski collision-retry talimatlarından önce gelir. Yeni hesap henüz oluşturulmadı; yeni Windows derleme/paket/runtime sonucu henüz yok.

## Kanıt ve sınır

Yereldeki [Windows araştırma sonucu](evidence/windows-publication-d1-2026-10-21/investigation-20261021T185816Z.json) ilk reddi `UnexpectedDirectoryWriter` olarak kanıtlar; candidate publication'a ulaşılmadı. Kullanıcının ilettiği ikinci, salt okunur gözlemde tek reddedilen principal yalnız o PowerShell gözlemcisinin TokenAppContainerSid'iyle eşleşti. Bu son gözlemin orijinal dosyası bu hazırlıkta yerelde bulunmadığından burada kullanıcı-iletilen bulgu olarak tutulur. Önceki Rust süreçleriyle principal eşitliği, ACL kökeni veya effective access kanıtlanmış değildir.

Microsoft [AppContainer çift-principal modeli](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer), normal kullanıcı ve package/capability yetkilerinin kesişimini kullanır. Mevcut private klasör USER+SYSTEM iki-ACE sözleşmesiyle ancestor istisnası eklemek tek başına uçtan uca çözüm değildir. Bu kaynak/belge çıkarımıdır; sonraki private reopen reddi runtime'da gözlenmiş sayılmaz. AppContainer desteği veya package SID whitelist kararı verilmedi.

Yeni `cfg(test)` context kontrolü **her Fixture kurulmadan önce**, aynı gerçek test sürecinin primary token'ından dört sayısal alan okur: `app_container=0 restrictions=0 elevated=0 elevation_type=1`. Başka değer/API/uzunluk hatası kapalı ret olur. Ayrı ignored readonly preflight da aynı kontrolü kullanır. Bu dört alan hesap adını, her sandbox mekanizmasının yokluğunu veya thread impersonation yokluğunu kanıtlamaz. Hesabın yeni/standart olduğu kullanıcı tarafından UI'dan doğrulanır; mevcut KnownFolder/owner/ACL kontrolleri ayrıca korunur. İncelenen fixture yolunda impersonation çağrısı yoktur.

Mac hazırlık kanıtı: [5 sözleşme + 10 tanılama testi, fmt/strict clippy/size/native library build ve bağımsız Astra review](evidence/windows-publication-d1-2026-10-21/native-user-preparation.json). Bunlar yeni Windows derleme/runtime doğrulaması değildir.

## A — mevcut Windows hesabında Codex yalnız paketi hazırlasın

1. Proje talimatları, ADR0015/16, güncel handoff ve bu belgeyi oku. HEAD/başlangıç Git durumunu salt okunur kaydet; kullanıcının değişikliklerini koru. Git mutation yapma. Windows görev kapsamı dışına çıkma.
2. [Yeni 14 kaynak inventory'sini](evidence/windows-publication-d1-2026-10-21/native-user-source-hashes.json) doğrula. Strict UTF8; yalnız ilk karakterin sayısal değeri65279 ise bir BOM kaldır; gerçek CRLF→LF; BOM'suz UTF8 byte[] SHA256. Culture-sensitive StartsWith kullanma. Farkta dur; eski inventory'leri değiştirme. Inventory dar delta kimliğidir, bütün repo bağımlılıklarının manifesti değildir; HEAD/dirty kapsamını da kaydet.
3. Yalnız kurulu explicit toolchain ile derle; toolchain/bağımlılık sürümü değiştirme veya fmt/clippy bileşeni kurma:

   `rustup.exe run 1.99.0-x86_64-pc-windows-msvc cargo test --manifest-path packages/pairing-native/Cargo.toml --locked --no-default-features --target x86_64-pc-windows-msvc --lib --no-run --message-format=json`

4. Tek `kloda_pairing_native` test compiler-artifact'ını seç; manifest/src/profile.test/path/regular executable/no-reparse kontrollerini ve SHA256'sını kaydet. Eski executable adını veya hash'ini tahmin etme. Kayıtlar önceki [komut prosedüründeki](evidence/windows-publication-d1-2026-10-21/commands.md) byte-safe yaklaşımı kullanır.
5. Aşağıdaki beş exact ignored case için **yalnız `--list`** çalıştır; her biri exit0, tek tam eşleşen test/0 benchmark olmalı. Native preflight veya fixture runtime'ını bu Codex/sandbox hesabında çalıştırma.
6. UTC zaman+HEAD revision içeren **yeni**, üzerine yazılmayan bundle klasörü hazırla. Sabit girdi allowlist'i yalnız `kloda-d1-tests.exe`, `windows-d1-native-user-handoff.md`, `native-user-source-hashes.json`, `README.txt`, `bundle-manifest.json` olsun; manifest kendisi dışındaki dört girdinin relative adlarını/SHA256'larını içerir ve kendi hash'i ayrı güvenilir kanaldan verilir. Ek dosya/DLL/script, alt klasör veya reparse bileşeni varsa reddet. Yalnız doğrulanan exe, bu public belge, dar kaynak inventory'si ve kullanıcı yönergesi taşınır. Repo, AppData, anahtar/pin/sertifika/epoch/DB, Codex profili, arşiv, raw evidence veya toolchain taşıma. Binary Git'e konmaz.
7. Kullanıcı için tek yapıştırılabilir çalışma bloğu hazırla: aşağıdaki B/C sırasını uygulasın, beklenen **sabit manifest hash'ini** komuta gömsün; manifest ve exe dahil her girdi hash'i doğrulanmadan hiçbir executable çalıştırmasın. Test komutları sabit allowlist olsun, manifestten keyfi komut yürütmesin. Önce readonly listelemeyle kendi kontrolünü yap; liste kontrolünü runtime PASS sayma. Native stdout/stderr/exit'i ayrı kaydet; PowerShell native stderr'i hata diye yanlış yorumlayarak gerçek exit sonucunu kaybetme. Her spawn öncesi exe hash'ini yeniden doğrula. Yeni genel runner altyapısı/dependency ekleme.
8. Paket ve yönergeye ayrı güvenlik/sonuç review yaptır. Başlangıç yöntemi normal interaktif komut bloğudur; unsigned .ps1 çalıştırılması gerekmez. ExecutionPolicy/BYPASS/Unblock-File/registry değişikliği yapma. AppLocker/WDAC/kurum politikası veya executable reddi varsa alternatif yürütmeyle aşmaya çalışma; engeli bildirip dur.
9. Kullanıcıya gerçek paket yolu, güvenilir kanaldan manifest SHA256 ve tek çalışma bloğunu ver; **hesap açma/runtime aşamasına geçmeden dur**. Bu duruş yeni onay talebi değil, kullanıcının oturum değiştirmesi gereken fiziksel devir noktasıdır. Hazırlık build/list/package sonuçlarını NOT_RUN runtime'dan ayır.

## B — kullanıcı yeni standart hesaba geçsin

Windows [resmî hesap yönetimi](https://support.microsoft.com/en-us/windows/security/identity-signin/manage-user-accounts-in-windows): Ayarlar → Hesaplar → Diğer kullanıcılar → Hesap ekle → Bu kişinin oturum açma bilgilerine sahip değilim → Microsoft hesabı olmayan kullanıcı ekle. Yeni yerel hesap için örnek ad `KlodaD1`; aynı ad varsa mevcut hesabı silme/yeniden kullanma veya parolasını sıfırlama. Yeni benzersiz hesap seç. Hesap türü **Standart kullanıcı** olsun. Parola/güvenlik yanıtlarını yalnız kullanıcı yerel UI'da girer; agente veya kanıt kaydına göndermez. Hesap oluşturma için gereken Windows yönetici onayı, testlerin yönetici olarak çalıştırılmasına izin değildir.

Mevcut oturumu kapatmak gerekmez; kullanıcı değiştirip yeni hesaba ilk kez giriş yap. Yeni hesaba Codex/VSCode, proje profili, AppData/keys/config kurma veya kopyalama. Sadece test bundle'ı gerekir; Rust/npm/Codex kurulmaz.

Hesaplar arasında yalnız bundle aktar: örneğin Explorer ile Public Documents altında **yeni** `Kloda-D1-<UTC>-<revision>` klasörüne kopyala. Araç yazamıyorsa ACL/owner/share değiştirmek yerine kullanıcı Explorer kopyası yapsın. Paket yalnız public binary/test materyalidir. Yeni hesapta kendi özel Desktop/Downloads altında **yeni boş** çalışma klasörü oluştur; paylaşılan staging'den yerinde çalıştırma. Staging ve hedef yol bileşenlerinde reparse olmadığını, sabit beş girdiden başka dosya/alt klasör bulunmadığını doğrula. Yalnız allowlist girdilerini tek tek kopyala; tüm klasörü körlemesine kopyalama. Güvenilir kanaldaki sabit manifest hash'ini ve tüm girdi hash'lerini özel kopyada yeniden doğrula. Adjacent ek DLL/EXE/script kabul edilmez; eksik DLL için paket dışından dosya toplama. Çalışma dizini doğrulanan özel klasör olsun; loglar ayrı yeni sonuç klasörüne yazılsın. Self-generated manifest tek başına güven çıpası değildir.

## C — yeni hesapta kullanıcı testleri çalıştırsın

Normal, **yönetici olmayan** terminal aç; Codex sandbox içinden yürütme. Windows Codex'in A'da verdiği doğrulanmış komut bloğunu kullan. Hesabın yeni/standart olduğu kullanıcı teyidi ile native token kanıtını ayrı kaydet. İlk readonly context case PASS olmalı ve dört alan tam `0/0/0/1` dönmeli. Tüm list kontrolleri bu kopyada da tamamlanmadan mutating case çalıştırma.

Tam case listesi (prefix aşağıda sabittir):

- `installation_files::windows::candidate::context::native_user_preflight` — readonly; önce çalışır.
- `installation_files::windows::candidate::tests::rename_atomically_refuses_existing_target_and_preserves_pending`
- `installation_files::windows::candidate::tests::existing_pending_is_not_adopted_deleted_or_overwritten`
- `installation_files::windows::candidate::tests::injected_cut_points_and_lost_reply_never_ack_or_regenerate`
- `installation_files::windows::candidate::tests::target_appearing_after_preflush_is_not_replaced`

Liste argümanları: `<exact-case> --exact --ignored --list`.
Runtime argümanları: `<exact-case> --exact --ignored --nocapture --test-threads=1`.

Dört mutating case yukarıdaki sırayla birer kez, fail-stop çalışır. Her test için gerçek exit0, tek exact testin `ok` sonucu, `1 passed; 0 failed; 0 ignored` doğrulanır; sabit filtered sayısı beklenmez. Native context her Fixture'da yeniden kontrol edilir. İlk hatada sonraki case'ler NOT_RUN; stderr/API kodu yoksa uydurulmaz. Kör retry/ACL fix/alternate authority root/fallback yok. Maksimum9 yeni random disposable kök; kayıp yanıt/cut noktaları testin mevcut injection'larıdır, gerçek güç kesme/process-kill kabulü değildir. Kökleri tarama/silme; tarihsel absent-target PASS'i bu grupta tekrarlama. Eksik runtime DLL veya işletim sistemi engeli varsa kurulum/fallback denemeden NOT_RUN altyapı engeli olarak bildir.

Raw stdout/stderr/exit ve sonuçları özel test klasöründe sakla; kullanıcı test sonucunu mevcut hesabına geri kopyalayınca Windows Codex sanitized raporu inceleyip public evidence alanına eklesin. Kullanıcı adı, SID, özel yol, tam token/ACL/config, arşiv içeriği yayınlama; mevcut `.local-evidence` Git dışında kalır. Review olmayan ham klasörü komple Git'e taşıma. Hesap veya disposable kök cleanup'ı bu onayda yok.

## D — sonuç ve durma sınırı

Gerçek build/list/exe hash/token/test exit/NOT_RUN ayrımlarını ve ayrı review'ı raporla. `InitializeDefaultDrives` uyarısını varsa kaydet; nedensellik kanıtı olmadan atfetme. Dört D1 PASS olsa bile yalnız bu yeni hesaptaki namespace/koruma fixture kanıtıdır: üretim owner/korunmuş `epoch.pending`, TPM/QR/transfer, D2 durability/D3 recovery, cert/SQLite binding/continuity ve platform ürün kabulü açık kalır. Mevcut profilin çalıştığı iddia edilmez. Genel fiziksel duraklatma, macOS signing/Linux provider ve Git/model yasağı sürer. Sonuç ana Mac oturumuna döner; başka roadmap geliştirmesine geçme.
