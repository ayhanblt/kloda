# First vertical slice — implementation status

Bu belge, kabul edilmiş kararları tekrar tanımlamaz; yürürlükteki sınırı ve kalan implementasyon işini gelecek geliştirme oturumları için kaydeder. Davranış kararlarının kaynağı [ADR 0001](../decisions/0001-mobile-sync-behavior-and-framework-constraints.md), kapsam kararlarının kaynağı [ADR 0002](../decisions/0002-first-vertical-slice-scope.md) ve ürün mimarisinin kaynağı `AGENTS.md`dir.

## Uygulanan temel

- `@kloda/sync-core`, 12/24 saatlik yerel zaman programı, erişim ve OS yeniden-deneme bütçeleri ile scheduled-run durum sözleşmelerini içerir.
- Electron tarafında SQLite journal, Electron `safeStorage` tabanlı credential vault, dar preload/IPC sınırı, WebDAV yazma doğrulaması ve recursive transfer runtime'ı vardır. Kaynak seçici birden çok klasör seçebilir; mevcut transfer runtime'ı seçilmiş kaynakların tümünü sırayla işler. Upload final hedefe doğrudan yazılmaz: journal önce temp remote path ile `pending_upload` kaydı oluşturur, dosya temp path'e `PUT` edilir ve final path'e `MOVE Overwrite:F` sonrası receipt yazılır. Belirsiz `MOVE` sonucu pending kaydı ve temporary nesne korunur; startup reconciliation henüz uygulanmamıştır.
- Electron renderer, kaynak → program → WebDAV kimlik bilgisi/testi → backup activity temel akışını uygular. Manual Sync Now ve desktop scheduler aynı runtime üzerinden single-flight çalışır; aynı anda ikinci upload açılmaz. Masaüstü otomatik çalışma, süreç yaşadığı sürece bir sonraki yerel zaman için `setTimeout` kurar; uyku sonrası kaçırılmış occurrence'u bir kez çalıştırır ve ikinci bir active run başlatmaz. OS düzeyinde dayanıklı scheduler değildir.
- Mobile, Expo development build ve yerel Expo Swift/Kotlin modülünü kullanır. Android schedule ayarını `SharedPreferences`a, iOS `UserDefaults`a yazar. Android Files seçimi kalıcı `content://` URI izni alır; iOS Files seçimi security-scoped bookmark saklar. Her seçilen Files kaynağı, native tercihte UUID, tür, görünen ad ve opaque erişim referansıyla ayrı kayıt olarak tutulur; kaldırılırken Android URI izni de bırakılır. Uygulama açılışında native katman Android'de kalıcı okuma iznini, iOS'ta bookmark'ın stale olmadığını ve security-scoped erişimi doğrular; erişimi kaybolan klasör UI'da tekrar seçilmesi gereken kaynak olarak gösterilir. `prepareSourceJobs` Android'de SAF ağacını, iOS'ta Files bookmark ve Photos kaynaklarını tarayarak platform SQLite `queued_source_file` tablosuna kaynak başına ayrı queued kayıtlar yazar; kaynak kaldırılınca kendi queue kayıtları da silinir.
- Mobile UI Files klasörü, iOS Photos kütüphanesi ve kullanıcı albümü seçimi, seçili kaynakların kaldırılması, schedule ayarı ve WebDAV HTTPS adresi/kimlik bilgisi formunu gösterir. iOS Photos erişimi `.readWrite` yetkisiyle istenir; sınırlı Photos yetkisi geçerli bir kaynak olarak korunur. Secret olmayan WebDAV endpoint, hedef klasör ve kullanıcı adı native tercihe yazılır; parola yalnız `expo-secure-store` ile platformun şifreli depolamasına yazılır. Test, hedef klasöre `PROPFIND`, benzersiz probe dizinine `MKCOL`, geçici dosyaya `PUT`, `MOVE` no-overwrite, `GET` read-back ve yalnız probe kaynaklarının `DELETE` temizliğini yürütür. Gerçek dosya aktarımı, Sync Now ve aktivite ekranı henüz mobile'da uygulanmamıştır.
- Mobile NativeWind v4, Electron renderer Tailwind CSS kullanır. Her iki uygulamada i18next/react-i18next ile `tr`, `en`, `de` locale dosyaları bulunur; JSX/TSX kullanıcı metni `t(id)` ile çözülür.

## Henüz uygulanmayan zorunlu işler

1. Mobile queue kayıtlarını gerçek transfer ve receipt/recovery durumlarıyla tamamlamak; gerçek dosya aktarımını ve Sync Now/aktivite ekranını uygulamak.
2. Android/iOS native scheduled execution, OS ertelemesi/iptali sonrası kalıcı run recovery ve iki ayrı retry bütçesini uygulamak.
3. Mobile onboarding'i storage ve backup activity ekranlarıyla tamamlamak; desktop transferini kesinti sonrası devam edebilecek hâle getirmek.
4. Stitch referansına karşı her iki platformun gerçek UI yüzeyini görsel olarak doğrulamak; ardından uçtan uca smoke ve bağımsız review yürütmek.

## Uygulama kısıtları ve açık riskler

- Bu slice yalnız WebDAV HTTPS kimlik doğrulaması, dizin erişimi ve yazma yeteneğini test eder. Başarılı test dış ağ erişimi veya CGNAT/relay kararı anlamına gelmez.
- Mobile WebDAV probe istekleri redirect'i hata olarak ele alır; kimlik bilgisinin başka bir origin'e yönlendirilmesine izin verilmez. Gerçek WebDAV endpoint'inde transport davranışı henüz smoke ile gözlenmemiştir.
- FolderSync migration eşleştirmesi, E2EE/key yönetimi, relay teknolojisi, AWS premium kapsamı ve NestJS backend rolü açık kararlardır; bu implementasyon çalışmaları bunları varsayamaz.
- Oluşturulmuş iOS projesi şu anda `IPHONEOS_DEPLOYMENT_TARGET = 16.4` kullanır. Bu, onaylanmış minimum iOS sürümü değildir; ADR 0001'deki eski cihaz desteği gereksinimi için release öncesinde bilinçli bir minimum sürüm ve uyumluluk planı gerekir.
- Mobile'da iOS bookmark ve Android URI kaynak kayıtlarında saklanır ve onboarding'de yeniden erişim doğrulanır; ancak bunlar henüz sync journal ile eşlenmiş veya iş kuyruğunda kullanılan bir `BackupSource` değildir.
