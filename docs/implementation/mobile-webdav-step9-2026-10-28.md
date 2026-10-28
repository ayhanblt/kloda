# Mobil liste9 — WebDAV kayıt, ayar ve hata tutarlılığı

28 Ekim2026: bu dar kaynak/otomatik/izole Simulator dilimi tamamlandı. [Seçilmiş kanıt](evidence/mobile-webdav-2026-10-28/validation.json). PC-first receiver veya gerçek otomatik WebDAV sender tamamlandı anlamına gelmez.

## Bulgu ve en küçük giderim

Önceki `App` parola için SecureStore, hedef için ayrı native preferences yazıyordu; test sonucu yalnız UI belleğindeydi. İki yazma arasındaki kesinti parola ve hedefi ayrıştırabiliyordu. Kaynak/call-site taramasında bu legacy native WebDAV metadata'sını kullanan canlı bir byte sender bulunmadı; mevcut native Files/Photos göndericileri PC-local ACL yoludur.

- Yeni açık test/save, mevcut SecureStore içinde tek sürümlü `kloda.webdav.profile.v1` değeri yazar: tam hedef/kullanıcı/parola + geçmiş test zamanı. Native callback ardından tam serialized readback eşitliği doğrulanmadan kaydedildi başarısı verilmez. Bu, SDK'nın tek öğe update/commit sözleşmesidir; güç kaybı kalıcılık kanıtı değildir.
- iOS `WHEN_UNLOCKED_THIS_DEVICE_ONLY` kullanılır; plaintext prefs'e yeni parola/config kopyası yazılmaz. UI loader yalnız metadata döndürür, parola kutusu yeniden açılışta boştur. Kullanıcı yeniden test için parolayı açıkça girer.
- Eski split password/native metadata otomatik migrate/reset/cleanup edilmez. Yeni profil yoksa yalnız eski metadata gösterilebilir ve doğrulanmamıştır. Okunamayan/bozuk yeni profil sessizce benimsenmez; görünür storage hatasıyla durur.
- Retest başlamadan önce önceki profilin geçmiş başarı işareti aynı tam kayıt içinde geçersizleştirilir; yeni taslağın parolası eski hedefe karıştırılmaz. Başarısız yeni hedef testinde eski tam bağlam doğrulanmamış olarak kalır. Kayıp store yanıtı eski veya yeni bütün profili bırakabilir; UI başarı vermez, sonraki yükleme yalnız gerçekten okunabilen bütün kaydı kullanır.
- Stale form/load sonucu, eşzamanlı test ve edit/background/navigation/unmount ele alınır. İptal native AbortSignal'e taşınır; yeni form eski PASS'i kullanmaz. Kaydetme sürerken draft değişirse en fazla eski test edilen bütün profil kalabilir; yeni draft test edilmiş sayılmaz. Profil bir file authority/grant değildir.

## Probe ve kullanıcı görünümü

- Genel React Native fetch yolu `redirect` seçeneğini native katmana taşımıyordu. Zaten kurulu `expo/fetch` ile native no-follow `redirect:error` ve açık `credentials:omit` kullanılır. Ortam cookie'si verilen yanlış parolayı doğrulanmış gibi gösteremez. HTTPS, embedded credential/query/fragment, boş alan, colon username, NUL ve dot-path kontrolleri ağdan önce yapılır.
- Yalnız seçili WebDAV dizininde yeni UUID probe klasörü oluşturulur. MKCOL/PUT/MOVE201, GET200 ve PROPFIND207 dışında genel2xx/207 başarı kabulü yoktur; DELETE200/204 ister. PUT `If-None-Match:*`, MOVE `Overwrite:F` kullanır. Marker sınırlı streamed byte karşılaştırmasıyla doğrulanır; GET fazla/eksik/yanlış byte başarısızdır.
- Her belirsiz mutasyonda durulur. Kayıp PUT/MOVE/DELETE yanıtından sonra bilinmeyen dosyalar benimsenmez; kör finally/recursive cleanup yapılmaz. Sadece tam doğrulanmış akış kendi final test dosyasını ve kendi probe klasörünü temizler; cleanup doğrulanmadan test PASS olmaz. Kullanıcının arşivine test verisi yazılmaz.
- Eksik alan/storage/connection/iptal/belirsiz probe hataları TR/EN/DE görünür; raw native hata, parola veya private URL loglanmaz. Devam eden test düğmesi çalışıyor durumunu gösterir. Belirsiz probe uyarısı form değişiminden sonra da kalır; yeni UUID testinin başarısı eski kalıntıyı temizlemiş sayılmaz.
- Geçmiş test etiketi güncel erişim garantisi vermediğini söyler. Advanced ekranı otomatik WebDAV byte sender'ın henüz bağlı olmadığını açıklar; PC-first native receiver ayrı kalır. Mobil/desktop gerçek transfer retry bütçeleri değişmedi; manuel probe'a yeni otomatik retry veya toplam deadline eklenmedi.

## Gerçek doğrulama

| Kontrol | Sonuç ve kapsam |
| --- | --- |
| Mobil Jest |10 suite/98 PASS: profil bağlama, unverified retest, stale/busy, kayıp store/MOVE, yanlış207, eksik alan, readback sınırı,3 dil UI |
| Root lint / mobil TS / iOS+Android JS export | PASS |
| iOS Simulator uygulama derlemesi | Normal Xcode ad-hoc signed Debug PASS; mevcut native modüller, imza/provider politikası değiştirilmedi |
| Gerçek SecureStore Simulator | Sentetik **doğrulanmamış** tek profil seed ve farklı PID reopen PASS; UI metadata parolasız |
| Gerçek native HTTP Simulator | Loopback pozitif cookie include kontrolü ardından omit PASS; sentetik explicit Basic korunur;302/307 reddi ve redirect hedefinde0 istek |
| Bağımsız güvenlik review | İki UI belirsizlik bulgusu giderildi; son source review engelleyici bulgusuz; reviewer test/build koşmadı |

İlk `CODE_SIGNING_ALLOWED=NO` test artefaktı SecureStore'da `ERR_KEY_CHAIN` verdi; PASS sayılmadı. Exact OSStatus yakalanmadı. Standart Xcode ad-hoc Simulator build sonrasında native kontroller geçti; Keychain ayarı/guard/entitlement policy/anahtar provider'ı gevşetilmedi. Bu sonuç iPhone hardware custody veya release signing kanıtı değildir.

SDK sözleşmesi [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) ve kurulu Expo native fetch kaynaklarıyla kontrol edildi; yönlendirme/AbortSignal davranışı [Expo fetch](https://github.com/expo/expo/blob/main/packages/expo/src/winter/fetch/fetch.ts) kaynağında da doğrulandı.

## Açık ve ertelenen işler

- Gerçek HTTPS WebDAV sunucusu, mevcut kullanıcı arşivi veya fiziksel cihaz kullanılmadı. Android native SecureStore/HTTP runtime kabulü bu adımda çalıştırılmadı; ortak JS ve kurulu iki platform native source denetimi ayrı kanıttır.
- Yarım probe kendi UUID klasörünü bırakabilir. Uyarı bu UI oturumu boyunca korunur; **süreç yeniden açılışında probe uyarısı kalıcı değildir**. Otomatik yeniden benimseme/remote cleanup veya yeni resolver politikası eklenmedi. Liste10 değerlendirmesinde görünür tut; tekrar test başarı sayacı bunu temizlemez.
- Gerçek mobil WebDAV scheduled/background byte sender hâlâ bağlı değildir; yeni profile gelecekteki sender adoption ayrı iştir. Bu adım PC Files/Photos journal/resume, ADR0016/17/19/20 veya native retry'yi yeniden geliştirmez.
- Liste10 bütünleşik akış/görsel/a11y/alan ve liste11 açık izinli toplu fiziksel kabul; Desktop platform kapıları, iOS gerçek background/lock, geniş E2EE/recovery/remote/versions/migration backlog'u sürer.
- Sıradaki tek iş liste10'dur. Bu çalışma grubunda başlatılmadı. Git mutation, mevcut güven/anahtar/epoch veya kullanıcı arşivi değişikliği yapılmadı.
