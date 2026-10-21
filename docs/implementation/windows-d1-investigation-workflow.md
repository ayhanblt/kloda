# Windows D1 — kanıta dayalı araştırma çalışma grubu

2026-10-21. Ayhan'ın yeni talimatı: “sorunu çözene kadar kapsamlı testler yapabilirsin ... tahmin yürütmeden araştırmalı şekilde kesin çözüme ulaşmak için arama yapabilirsin”; ayrıca bu Windows işi için Astra danışmanlığına izin verdi. Her küçük tanılama için tekrar ürün onayı istenmez. Bu grup, disposable D1 fixture engelinin kök nedenini kanıtlamak ve mevcut kararlarla güvenli çözüm mümkünse doğrulamak içindir. Gerçek authority/veri, sandbox güvenliği veya açık mimari kararlar için sınırsız yetki değildir.

**Bu belge önceki tek-deneme/dört-test stop prosedürlerini yalnız bu araştırma grubu için günceller.** Bir case FAIL olduğunda aynı komutu körlemesine tekrar etme; çıktıyı/kodu araştır, bağımlı testleri beklet, bağımsız kanıt çalışmalarına devam et. Yeni bilgiye dayanan gerekli tekrarlar için yeniden kullanıcı prompt'u bekleme. Yeni güvenlik/mimari kararı, gerçek veri müdahalesi veya geçerli yürütme ortamının erişilememesi halinde somut blocker/karar raporuyla dur.

## Başlangıç durumu ve üç ayrı sorun

1. **Hash komutu:** önceki culture-sensitive BOM StartsWith, gerçek ilk karakteri siliyordu. Windows kullanıcısının numeric BOM ve byte-safe Git blob karşılaştırmaları10/10; Mac'te yanlış hash10/10 yeniden üretildi. Manifest bozukluğu olarak yeniden araştırma; numeric first-char65279 ve strict UTF8/CRLF→LF kuralını koru.
2. **D1 güncel engel:** Windows user-reported HEAD1369d3e,12/12 source match, locked/no-run compile0/22.6248996s, exact list0. Collision test FAIL101: `KLODA_STARTUP stage=Fixture(BaseSecurity) operation=Some(SecurityValidation) code=storage_failure win32=None`. Nonce/RootCreate/candidate publish/assertion'a erişilmedi; bu denemede random root oluşturulmadı. İlk ret koşulu henüz bilinmiyor. Son üç test NOT_RUN. Önceki manuel absent-target PASS ayrı tarihsel kanıt.
3. **Gerçek ürün owner:** eski guarded startup'taki `epoch.pending` leaf-name reddi ayrı ve kanıtlanmış sorun. D1 fixture engelini aşmak, preserved pending için recovery/adoption politikasını veya production owner açılışını çözmez. İlk pending'in tarihsel bırakılma nedeni bilinmiyor. Eski MoveFileEx32/directory-reopen5 probe'larını tekrarlama. D2/D3/cert replacement/SQLite-object binding/continuity açık.

Son kullanıcı raporlarının orijinalleri Windows evidence alanındadır; ana Mac'teki kayıtlar kullanıcı tarafından iletilen sonuçları kaynak olarak belirtir. Henüz aktarılmayan dosyayı varmış gibi üretme.

## Hazırlanmış tanılama: önce bu kaynaklarla başla

- [13 dosyalık source inventory](evidence/windows-publication-d1-2026-10-21/security-rule-source-hashes.json), eski10 ve12 dosyalık inventory'leri ezmez. İlk kaynak aktarımından sonra13/13 doğrula; açıklanamayan kaynak farkında derleme/test yapma.
- Değişen üç kaynak: `installation_windows_security.rs`, `startup_diagnostics.rs`, `startup_diagnostics_fixture_tests.rs` (`packages/pairing-native/src/`). Security macro'su production'da asıl ifadeyi değerlendirir; testte mevcut `at`/first-error bağlamına sabit `SecurityRule` etiketi ekler. ACE type/size birleşik ret koşulu eşdeğer iki ardışık ret olarak ayrıldı. Owner/ACL/pin/share/CREATE_NEW/namespace/OS çağrıları/assertion/cleanup sonucu değişmedi.
- Etiketler: Principals, DescriptorPresence, OwnerSidValidity, AclValidity, AceType, AceHeaderSize, AceSidBounds, AceSidValidity, UserDirectoryOwner, UnexpectedDirectoryWriter, ProtectedOwnerAndInheritance, ProtectedAceCount, ProtectedAceMaskAndFlags, ProtectedAcePrincipal, ProtectedDuplicatePrincipal.
- Pure retin örnek şekli `stage=SecurityRule(UserDirectoryOwner) operation=None ... win32=None` olabilir; örnek runtime gözlemi değildir. Önceden kaydedilen gerçek API kodu önceliğini korur. `Principals` cached error ise geçmiş OS kodu geri üretilemez; None, önceki OS hatası olmadığını kanıtlamaz.
- [Hazırlık ve ayrı Astra incelemesi](evidence/windows-publication-d1-2026-10-21/security-rule-preparation.json). Yeni host testleri15 etikette gerçek/kodsuz hata korumasını, outer fixture bağlamına dönüşü ve veri sızdırmayan formatı doğrular; Windows ACL/API testi yerine geçmez.

## Araştırma sırası

### A. Kaynak ve yürütme bağlamı

AGENTS/.omp, güncel ADR0015/16/17/18/19, Codex/session handoff, bu belge ve önceki fixture tanılama belgesini oku. Git/HEAD/status ve izinli kaynakları oku; kullanıcının ilgisiz değişikliklerini koru. Git mutation/network yapma. `.local-evidence` Git dışında kalır; yokluğu başlangıcı engellemez.

Mevcut supported session/status/launcher bilgisinden, çalıştırılacak executable için geçerli sandbox türü ve process bağlamını belirle. Yalnız gerekli alanları incele; full config/env/credential/komut geçmişi loglama. Masaüstü hesabı, PowerShell `$env:USERNAME` veya dış `whoami`, Rust child'ın TokenUser'ını tek başına kanıtlamaz. API'nin zaten yaptığı aynı-process owner karşılaştırmasının ret etiketi doğrudan o kıyasın false olduğuna kanıttır; sandbox'ın buna neden olduğuna tek başına kanıt değildir.

Resmî belgeler yalnız hipotezleri sınırlar; mevcut ortamın ne olduğunu kanıtlamaz:

- [OpenAI Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox): farklı modlarda dedicated lower-privilege user veya restricted-current-user token; `elevated` sandbox adı, komutun yönetici çalışması anlamına gelmez.
- [Microsoft TOKEN_USER](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_user): token'ın kullanıcı hesabı.
- [Microsoft KnownFolder](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shgetknownfolderpath): null-token current-user seçimi; env path kullanımı değildir.
- [Microsoft DACL access checks](https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object): deny ACE varlığı tek başına güvensiz ACL anlamına gelmez. Ancak bilinmeyen/deny ACE'yi yok sayarak kabul etmek mevcut policy'yi değiştirebilir.

### B. Gerçek ilk ret koşulunu al

Mevcut explicit MSVC1.99 toolchain/target/locked/no-default-features ile Cargo `test --lib --no-run --message-format=json` derle; doğru tek compiler-artifact exe'sini seç. Manifest/profile/repo/path/no-reparse ve exe SHA256 kontrollerini eski [prosedürden](evidence/windows-publication-d1-2026-10-21/commands.md) aynen koru. Yalnız collision case'i önce `--exact --ignored --list`, sonra `--exact --ignored --nocapture --test-threads=1` ile çalıştır. Sabit filtered sayısı bekleme.

- `UserDirectoryOwner`: klasör sahibi ile process TokenUser eşleşmiyor. Ürünün bu klasörü neden reddettiği artık belirlenmiştir; neden bu süreç/klasör bileşiminin oluştuğunu launcher/current-user bilgisiyle araştır. Yanlış kullanıcıyı kabul edecek guard değişikliği, owner değiştirme, farklı root seçme veya impersonation yapma.
- `AceType`: parser desteklemeyen type reddi. Aynı pinned handle üzerinde yalnız gerekli sayısal ACE type/size/flags bilgisini, yeni test-only tanılamayla elde edebilirsin. Tür/boyut sınırını geçmeyen ACE'yi ACCESS_ALLOWED_ACE diye cast ederek mask/SID okumaya çalışma. Deny ACE olduğunu bilmek sandbox provenance'ını kanıtlamaz. Desteklenen ACE çeşitlerini genişletmek/deny'ı yok saymak yeni güvenlik kararı gerektiriyorsa synthetic negatif test ve somut dar öneriyle dur.
- `UnexpectedDirectoryWriter`: eşleşmeyen başka principal'a checked mutation grant'i var. Yalnız doğrulanmış supported ACE için mask/flags ve user/system/admin/other kategorisi gibi anonim metadata ile bulguyu kanıtla. SID/account/ACL dump yayınlama, ACL düzeltme/silme yapma.
- Validity/bounds/presence/principals/API hataları: ilgili kaynak ve mevcut pinned SDK sözleşmesini doğrula; gerçek kod yoksa uydurma. Kaynak kusuru kanıtlanır ve mevcut güvenlik kararını değiştirmeden düzeltilebilirse minimal düzeltme, ilgili pozitif/negatif testler ve ayrı review yap. Kusur yoksa gerçek ortam engelini açık bırak.

Ek gözlem yalnız aynı pinned fixture base handle'ının güvenlik metadata'sı ve o test sürecinin token bilgisiyle sınırlı olabilir. Gerçek pairing/epoch/key/pin/cert/DB/archive yolunu açma/tarama. Ham SID/username/private path/full ACL veya token içeriğini kalıcı kanıta koyma. Sadece owner-match boolean, sayısal ACE layout/mask/flags, sabit principal role kategorisi ve OS code gibi en küçük anonim sonucu tut. Her ek ölçümün hangi iki olasılığı ayırdığını önce yaz.

InitializeDefaultDrives uyarısı ayrı kalır. Aynı test sürecindeki bir etkisi kanıtlanmadıkça asıl sebep sayma; profili/config'i veya sürücüyü değiştirme. Kaynak/komut/bağlam değişmeden aynı FAIL'i tekrar çalıştırma.

### C. Güvenli çözüm ve D1 regresyonu

Kanıtlanmış implementasyon/tanılama/test kusurlarında mevcut güvenlik kabul kümesini genişletmeyen minimal düzeltmelere ve bağımsız otomatik kontrollere devam et. Public kaynak değişikliğinde önce baseline inventory bağını koru, diff'i review et, mevcut envanteri ezmeden yeni UTC source inventory çıkar; değişmiş kaynağı eski reviewed SHA ile aynı diye sunma. Dosyaları değiştirmek sadece hash'i eşleştirmek için yapılamaz. Bağımlılık/provider/schema/SDK flag/model/effort değişimi yok.

Doğru current-user, private-KnownFolder ve mevcut platform kuralları izinli launcher'da karşılanamıyorsa bunu yürütme bağlamı blocker'ı olarak raporla. Sandbox'ı kapatma/yeniden yapılandırma, admin/UAC/runas/GUI ile dışarı kaçış veya ACL/owner değiştirme yok. Mevcut araç/platform politikasının sunduğu standart approval mekanizmasıyla yalnız somut izinli fresh-fixture/derleme komutu için dar execution approval talep edebilirsin. Bu, yeni ürün/mimari kararı onayı değildir. UI/policy ayrıca onay istiyorsa genel iş onayını onun yerine geçirme; gerçek yanıtı bekle. Onay reddedilirse veya uygun yürütme ortamı yoksa dur ve blocker’ı raporla. Approval yalnız o somut komutu kapsar; sandbox config/kimlik/ACL değiştirme veya admin/runas/GUI ile kaçış yetkisi vermez. `require_escalated` ile `elevated` sandbox adını karıştırma; neden ek araç izni gerektiğini açıkla.

Fixture kurulumu gerçekten geçtikten sonra candidate sonucu ve koruma assertion'larını değerlendir. Collision PASS ise diğer üç mevcut D1 case'i bağımlılık sırasıyla çalıştırabilirsin:

1. `installation_files::windows::candidate::tests::rename_atomically_refuses_existing_target_and_preserves_pending`
2. `installation_files::windows::candidate::tests::existing_pending_is_not_adopted_deleted_or_overwritten`
3. `installation_files::windows::candidate::tests::injected_cut_points_and_lost_reply_never_ack_or_regenerate`
4. `installation_files::windows::candidate::tests::target_appearing_after_preflush_is_not_replaced`

Her case'ten önce exact ignored list/exe doğrulaması; tek-thread; gerçek nativeexit ve tek case summary kontrolü. Yeni hata varsa bağımlı case'i çalıştırma, nedenini araştır. Genel ignored/all suite ile TPM/identity/gerçek owner'a genişleme yok. Tarihsel absent-target PASS'i yalnız ilgili değişiklik yeni regresyon kontrolünü gerektiriyorsa, mevcut taze-disposable test gövdesi kapsamında tekrar edebilirsin; sırf eski sonucu yenilemek için tekrarlama. Native testlerin oluşturduğu fresh random root'ları bırak, eski test köklerini tekrar kullanma/silme.

## Kanıt, review ve bitiş

- Her anlamlı denemeyi yeni UTC label ile kaydet: hipotez, değişen tek değişken/kod, source/exe hash, test/exit, gerçek ret etiketi, tamamlanan ve ulaşılmayan aşamalar, sonuç ve belirsizlik. Kör sonsuz retry yok; yeni bilgi olmadan dur.
- Raw çıktı mevcut Git-dışı alanda; sadece redakte küçük metin/JSON `docs/implementation/evidence/windows-publication-d1-2026-10-21/` içinde. Eski başarısız run/manifestleri ezme. Yeni sonuç dosyaları Git'e uygun ama agent Git yapmaz. Review geçişi kaynak/result/provenance/privacy kontrol eder; reviewer testleri tekrar koşmaz.
- İlgili Rust fmt/clippy/build/test kontrollerini gerçek platform sonuçlarıyla kaydet. Önceden mevcut warning'leri veya fixture FAIL'i PASS ile gizleme. Her source değişikliğinde gerekli exact kontrolleri seç; değişmemiş kapsamda tam ürün matrisi tekrarı yok.
- Windows-only handoff/status/roadmap'e anlamlı son checkpoint'i yaz. Kısa raporda **neden kanıtlandı / ne düzeltildi / hangi gerçek kontroller geçti / ne engelli** ayrımı olsun. İzinli kapsamda çözüm varsa otomatik devam et; ancak gerçek karar veya altyapı engelinde tek somut soru/kanıtla ana oturuma dön.
- D1 tamamlanması Windows uygulamasının çalıştığını veya production-ready olduğunu göstermez. `epoch.pending` history recovery, D2 durability/D3 continuity, cert replacement/SQLite-object binding ve gerçek owner/receiver/product/physical acceptance açık kalır. Onaysız yeni güvenlik/authority kararı veya mevcut data mutation ile kapatma.

Android/iOS, macOS signing, Linux provider ve diğer roadmap işleri bu Windows araştırma grubuna dahil değildir. Kullanıcı arşivi test verisi değildir. Genel fiziksel kabul duraklatması sürer; izinli çalışma yalnız yukarıdaki disposable Windows tanılama/regresyonudur.
