# Windows D1 — ayrı standart hesap devri

## Sonuç — 2026-10-22: dört D1 fixture doğrulandı

Yeni standart hesapta kullanıcı tarafından çalıştırılan aynı reviewed Four
ikilisinin ortak alana kopyalanmış ham kayıtları doğrulandı: dört exact liste
exit0, dört exact runtime PASS/exit0, sekiz süreç exited. Fixture context
sayıları1/1/6/1, tamamı0/0/0/1. Ayrı readonly review bulgusuz; 41 ham dosya
hash'i ve bundle hash'leri doğrulandı. Yeni test/build/retry/cleanup yok.

[Sonuç](evidence/windows-publication-d1-2026-10-21/d1-four-native-result-20261022T144423Z.json)
ve [Mac'e devir](evidence/windows-publication-d1-2026-10-21/d1-macos-handoff-20261022T144423Z.md).
Bu güncelleme aşağıdaki tarihli NOT_RUN checkpoint'lerinden sonra gelir.
Dört disposable D1 çalışma grubu tamamlandı; eski başarısız kayıtlar korunur.
Production owner/preserved pending, D2/D3, cert/SQLite binding, continuity,
power-loss durability ve platform kabulü açık. Windows'ta burada durulur.


## Yeni profil ortamı onaylandı — 2026-10-22

Kullanıcı, mevcut profillerin ACL/verisini koruyarak başka yeni standart
hesapta dört D1 case'in birer kez/sıralı/fail-stop çalıştırılmasını açıkça
onayladı. Hesabı kullanıcı UI'dan oluşturur; aynı adlı hesap varsa onu
yeniden kullanma/silme/parola sıfırlama yok. Paket eski hesapta yalnız
Public Documents'a konur. Yeni kullanıcı kendi oturumunda public staging'den
özel kopyasını alır; eski hesap yeni profilin özel klasörlerine girmez,
Explorer Continue onayı verilmez. Yeni kullanıcı sonuçları da ayrı bir
Public Documents sonuç klasörüne kendisi kopyalar.

Mevcut reviewed dört-case paket/ikili/blok hash'leri tekrar doğrulandı;
yeniden derleme veya yeni standalone preflight gerekmiyor. Her Fixture'ın
native context/ACL kontrolleri korunur. Dört runtime henüz NOT_RUN.
Onay ACL/owner/guard değişikliği, eski hesap/profil cleanup'ı veya gerçek
authority/arşiv müdahalesi değildir. D2/D3/platform sınırları değişmez.

## Salt okunur kalıtım incelemesi — 2026-10-22

Onaylanan beş-seviyeli metadata incelemesinde, seçilen standart-profil
Local yolundaki benzersiz sayısal ACE adayı profil kökünde explicit
flags3/mask2032127, AppData/Local'da inherited flags19 olarak gözlendi.
Profil DACL'si protected; incelenen iki üst seviyede aynı SID ACE'si yok.
Bağımsız güncel snapshot'ta ek trustee gözlemci process TokenUser'ıyla
eşleşiyor. Bu karşılaştırmalar bellekte; SID/hesap/özel yol dump'ı yok.
Çıkmış Rust sürecinin SID/yol kimliğiyle eşitlik iddia edilmez.

Kullanıcı diğer profili Explorer'dan açarken Continue erişim onayı
verdiğini hatırladığını doğruladı. [Microsoft KB950934](https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/dont-have-permission-access-folder)
bu onayın kalıcı Full Control izni ekleyebildiğini açıklar. Gözlemler bu
mekanizmayla güçlü biçimde uyumlu; tarihsel oluşturan/zaman/olay kanıtı yok.
ACL/owner/guard/ortam değiştirilmedi; yeni test/build/fixture çalışmadı.

Önerilen sonraki ortam kararı henüz onaylanmadı: mevcut profili/ACL'yi
koruyarak başka yeni standart profil; paket yalnız Public Documents'a,
özel kopya yeni kullanıcının kendi oturumundan; eski hesaptan yeni profile
girme/Continue yok. Sonuçları da yeni kullanıcı Public Documents'a aktarır.
Aynı reviewed binary/policy kullanılabilir; yeni derleme gerekmez.
Yeni hesap veya ek runtime için bu readonly onayı izin sayılmaz.

## Son gözlem — 2026-10-22: mevcut politika altında ortam engeli

Tek writer-role collision ham sonucu okundu: token context0/0/0/1 PASS;
collision FAIL101, süreç exited. Aynı ret dalındaki SID için
named_match=false/account_sid_shape=true, ACE type0/size36/flags19,
mask2032127/overlap852304. Bu yalnız hesap-domain SID şeklidir; hesabın
kimliği, local/domain kökeni, üyeliği ve güvenilirliği UNKNOWN.
Mevcut allowlist dışındaki inherited mutation grant reddi sürüyor;
yeni kaynak kusuru gösterilmedi. Nonce/root/publication'a erişilmedi,
diğer3 NOT_RUN. Aynı fixture yeni bilgi olmadan tekrarlanmaz.

[Sonuç kaydı](evidence/windows-publication-d1-2026-10-21/writer-role-native-result-20261022T140301Z.json).
Astra da guard/ACL/owner/root değişikliğini destekleyen kanıt olmadığını
ve karar noktasını doğruladı. İlgili üst klasörlerde yalnız anonim ACL
miras kaynağı araştırması, mevcut same-fixture-base metadata sınırını
genişletir; açık kapsam kararı bekler. Alternatif uyumlu ortam seçimi de
ayrı karardır. Bu checkpoint hiçbir ACL onarımı, trust genişlemesi veya
mevcut veri müdahalesi izni değildir. Mevcut hesapta yeni runtime yoktur.

## Güncel araştırma — 2026-10-22: yalnız reddedilen writer rolü

Dört-test paketinin ilk collision ham çıktısı okundu: native context0/0/0/1
geçti; valid basic allow ACE type0/size36/flags19/mask2032127,
mutation overlap852304 için UnexpectedDirectoryWriter reddi, exit101.
Process exited; diğer3 NOT_RUN. Nonce/RootCreate/publication'a erişilmedi.
ACE boyutu veya benzer maskeden önceki süreç/principal kimliği çıkarılmaz.

Mevcut araştırma onayı içinde yalnız cfg(test) ret dalı tanılaması eklendi.
Aynı descriptor içindeki bounds/IsValidSid kontrolü geçmiş SID üzerinde
yerel IsWellKnownSid sabit rol eşleşmeleri ve account_sid_shape boolean'ı
yazılır. Hesap adı/SID/RID/domain/yol/ACL veya token dökümü yok; lookup ve
ağ sorgusu yok. Named match veya account şekli güven/üyelik/admission
gerekçesi değildir. Eşleşmeme API hatası diye kaydedilmez. Mevcut
UnexpectedDirectoryWriter reddi ve production davranışı değişmez.

Yeni paket yalnız collision case'ini **bir kez** çalıştırıp durur; ayrı
preflight, kalan3, absent-target veya sentetik test çalıştırılmaz.
Her Fixture kendi context kontrolünü sürdürür. Bu yeni ölçüm değişmeyen
FAIL'in kör tekrarı değildir; rol ayrımı için hedefli tanılama sağlar.
Tanılama sonunda bile mevcut allowlist dışındaki trustee'yi kabul etmek,
ACL/owner/authority-root değiştirmek ayrı güvenlik/ortam kararı gerektirir.
Mevcut hesap yalnız locked/no-run build, exact liste ve paket doğrular;
kullanıcı ayrı standart hesabında yeni pinned tek-collision bloğunu kullanır.

## Güncel aşama — 2026-10-22: PASS sonrası dört D1 fixture

Yeni standart-hesap preflight ham kayıtları okundu: exit0, tek test PASS,
process exited; sınıf21 ReturnLength1 ve context tam 0/0/0/1.
[Doğrulanmış kayıt](evidence/windows-publication-d1-2026-10-21/token-boolean-native-result-20261022T131955Z.json).
Kullanıcı sıradaki aşamaya geçilmesini onayladı. Kaynak ve ikili değişmez;
önceki BOOLEAN snapshot'ı 14/14 tekrar doğrulandı. Yeni derleme gerekmez.

Yeni paket/blok yalnız aşağıdaki dört D1 case içindir. Ayrı
native_user_preflight testi tekrarlanmaz: her Fixture::new_inner başında
aynı native context::verify, KnownFolder seçimi ve dosya yaratmadan önce
zaten çalışır. Bu kontroller atlanmaz/değiştirilmez. Beş dosyalık sabit
bundle ve dış manifest pin'i, yeni özel kopya, her spawn öncesi hash,
dört exact ignored liste ve fail-stop runtime kuralları korunur.
Sıra: collision, existing-pending, cut/lost-reply, late-target. Her biri
bir kez; ilk FAIL/UNKNOWN/kesinti/altyapı engelinde kalanlar NOT_RUN.
En fazla9 yeni disposable random kök; cleanup/adoption/retry yok.
Tarihsel absent-target testi ve sentetik testler bu blokta çalıştırılmaz.
Mevcut Codex hesabında yalnız liste/paket doğrulaması; runtime yine
kullanıcının ayrı standart hesabında yapılır. D1 sonucu production owner,
korunmuş pending, D2/D3, cert/SQLite binding/continuity veya ürün kabulü değildir.

## Güncel dar düzeltme — 2026-10-22: hizalı BOOLEAN payload

Yeni standart-hesap preflight çıktısı salt okunur incelendi: sınıf29 için
capacity4/ReturnLength4, sınıf21 için capacity4/ReturnLength1; ardından
length validation reddi ve exit101. Süreç exited; dosya fixture'ları NOT_RUN.
[Microsoft Win32 açıklaması](https://github.com/microsoft/win32metadata/discussions/2308)
TokenHasRestrictions için BOOLEAN payload / DWORD hizalamasını doğruluyor;
Learn'deki DWORD tanımı için düzeltme açıklanmış. Kullanıcı araştırma ve
dar çözüme devamı onayladı; Astra önerisi ve ayrı kaynak review aynı yönde.

Yeni cfg(test) decoder, hizalı u32::MAX buffer ve kapasite4'ü korur.
Yalnız TokenHasRestrictions başarılı ReturnLength1 ile ilk bellek byte'ını
okur; diğer üç bilinen sorgu için tam ReturnLength4 ister. Bilinmeyen sınıf
ve diğer boyutlar reddedilir. Sıfır dışı restriction kabul edilmez;
native_user_context yine tam 0/0/0/1 ister. API hatası ve tanılama korunur.
ACL/owner/guard, namespace ve production yollarında değişiklik yok.
Kaynak düzeltmesi doğrulandı; yeni native runtime sonucu henüz NOT_RUN.
Desteklenen tüm Windows sürümleri için test matrisi iddia edilmez.

Bu düzeltme paketi de **yalnız exact readonly native_user_preflight** içindir.
İki sentetik decoder regresyon testi eklenip derlendi; mevcut hesaptaki
compile/list sınırı nedeniyle çalıştırılmış sayılmaz. Yeni preflight-only
blok kullanılmalı; PASS olsa bile dört dosya fixture'ına geçilmez.
Yeni UTC kaynak/paket envanteri eskileri ezmez; kullanıcı yeni paket ve
onun ayrı manifest hash'iyle standart hesabında bir preflight çalıştırır.

## Güncel dar görev — 2026-10-22: yalnız token ReturnLength tanılaması

Kullanıcı bildirimi: önceki yeni-hesap paketinde beş liste exit0, yalnız
`native_user_preflight` exit101: `Fixture(NativeUserContext)` /
`TokenInformation` / `storage_failure` / `win32=None`. Dört mutating case
NOT_RUN, süreçler exited. Bu checkpoint kullanıcı mesajıdır; burada ZIP
incelenmiş veya yeni runtime çalıştırılmış sayılmaz.

Bu yeni paket yalnız exact `installation_files::windows::candidate::context::native_user_preflight`
case'ini çalıştırma yetkisi taşır. Aşağıdaki tarihsel dört-fixture çalışma
grubuna bu paketle devam edilmez; preflight PASS olsa bile durulur.
Mevcut hesapta yalnız locked/no-run derleme ve exact ignored liste yapılır.

`scalar()` tanılaması her ulaşılan sorgu için sabit sayısal `class`, verilen
`capacity` ve gerçek `return_length` alanlarını yazar. Gerçek API hatası
diagnostic I/O'dan önce mevcut `os_check` ile korunur. Boyut eşitliği,
sonuç değeri ve token/ACL/owner/guard kabul koşulları değişmedi. API hatası
üzerindeki ReturnLength başarılı okuma veya kök neden diye yorumlanmaz.
Yeni sonuç gelmeden boyut kusuru veya düzeltme varsayılmaz.

Yeni UTC bundle eski paketi ezmez; aynı beş dosyalık allowlist ve dış kanaldan
manifest hash pin'i korunur. Bundle içindeki `native-user-source-hashes.json`
bu yeni dar tanılama kaynak snapshot'ıdır; depodaki eski inventory değişmez.
Paket dışındaki yeni, hash-pinned interaktif **preflight-only** blok kullanılır;
eski beş-case kullanıcı bloğu kullanılmaz. Kullanıcı normal standart hesap
terminalinde yalnız liste + bir preflight çalıştırır; dört dosya fixture'ı
hiç başlatılmaz. Sonuç ne olursa olsun raporla/dur; retry, cleanup veya
ExecutionPolicy/ortam değişikliği yok.

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
