# Gerçek kullanım bulguları — 05.11.2026

Kapsam: kullanıcının Android–Mac QR/aktarım ve WebDAV geri bildirimi. Bu kayıt inceleme ve öneridir; geliştirme/test sunucusu izni değildir. İncelenen kaynak HEAD78b0822 + önceki imzalama/tema çalışma ağacı. Bu incelemede uygulama kodu değiştirilmedi.

## A — PC aktarımı / açık

- Kullanıcı: telefon güven onayından sonra bağlantı tamamlanmadı; PC onayından sonra eşleşti. Aktarım tekrarlı durdu. Görsellerde os_interrupted, erişim denemesi3/5, OS yürütme1/5 ve candidate_stale açıklaması var.
- Kod: PC commit açık PC onayı ister. Telefon approve_phone yeniden eşleştirme/repair adayına bağlıdır. Gözlenen denemenin neden repair akışına girdiği logla doğrulanmadı; iki onay görünmesi tek başına bozuk protokol kanıtı değildir. Beklenen taraf/sıra/bekleniyor durumunu UI açıkça anlatmalı.
- Masaüstü logu `/tmp/kloda-desktop-dev-20261105.log`: yalnız “Kloda scheduled backup failed; occurrence remains pending.” Ayrıntılı kök neden yok.
- ADB ilk listede kullanıcı telefonunu gördü, logcat başlamadan bağlantı koptu. Android transfer logu alınamadı (çıktı boş); OS stop nedeni, crash, reload, lifecycle/route kaybı birbirinden ayrıştırılamadı. os_interrupted metni gerçek JobScheduler stopReason kanıtı sayılmamalı.
- Salt okunur gerçek PC journal incelemesi:12 Completed operation, toplam5.050.039bayt/offset;1 Receiving operation380bayt/offset0. PC Completed kaydı telefonun son ACK aldığını tek başına kanıtlamaz; uygulama düzeyi medya/manifest bütünü tamamlandı sayılmaz.
- Seçili kökteki cihaz klasörü `records.expected` public-key fingerprint'inin Base64URL kodlamasıyla birebir eşleşti. Medya adları içerik hash'i değil receiver'ın128bit rastgele operation ID'si; `{id}.media`. Özgün isim journal'daki name alanında tutulur.
-12media ve13part mevcut;12media/part çifti aynı inode'a hardlink. Kod retained part linkini yayın sahipliği kanıtı olarak tutar. Bunlar iki ayrı veri kopyası veya otomatik silinebilir çöp değildir;13.part tamamlanmamış işe aittir. Medya içeriği okunmadı, anahtar/export/reset/rename/delete yapılmadı.
- Ürün bulgusu: Finder'da özgün ad/uzantı ve cihaz etiketi görünmüyor. İç arşivi körlemesine yeniden adlandırmak yerine açık arşiv/geri-yükleme sunumu veya ayrıca tasarlanmış okunabilir export gerekir; mevcut journal/inode/publication bağları korunmalı.
- Sonraki dar teşhis: telefon tekrar erişilebilirken mevcut logcat + JobScheduler stop reason ve native journal durumlarını salt okunur al; UI/FGS/JobService/retry/foreground generation zamanlarını karşılaştır. Sonuç olmadan retry bütçesi veya güvenlik fence'leri gevşetilmez.

## B — WebDAV formu ve sunucu uyumu / açık

Kullanıcı başka uygulamadan ekranlar sundu: sunucu,port8083,yol/webdav/,NTLM domain; kendinden imzalı sertifika açık; güvensiz şifreler kapalı; expect-continue ve HTTP1.1 açık; auth Auto; p12/parola,CA sertifikası ve60s timeout alanları. Seçeneğin görünmesi sunucunun onu gerektirdiğini kanıtlamaz. Sunucuya bağlantı/credential gönderimi yapılmadı.

| Alan | Kloda kaynak bulgusu | Öneri |
| --- | --- | --- |
| Host/port | Formda ayrı port yok; endpoint tam URL. JS URL, Android HttpUrl ve iOS URLComponents portu engellemiyor. | Host/port alanlarını ayrıştır veya belirgin tam URL örneği ve oluşan URL önizlemesi göster. Port yokluğu kesin teknik engel diye raporlanmamalı. |
| Yol | Endpoint path + targetPath birleştirilir; targetPath boş olamaz. İlk PROPFIND hedef koleksiyonda207 bekler; mevcut olmayan hedef404 ile bağlantı hatasına düşer. | Sunucu DAV kökü ve yedek alt klasörü ayrımını anlat; yok/hedef izin hatasını göster. |
| TLS | HTTPS zorunlu, normal OS trust; özel CA/pin/self-signed hedef profili yok. | Önce gerçek sertifika hata nedenini göster; gerekiyorsa hedefe özgü CA import veya doğrulanmış pin tasarla. Genel trust-all kutusu önerilmez. |
| Auth | JS probe ve native aktarım preemptive Basic kullanır; kullanıcı/parola zorunlu. Android challenge authenticator kapalı; iOS server-trust dışı challenge iptal. NTLM/Digest/Auto ve domain seçimi yok. | Sunucunun WWW-Authenticate cevabıyla gereken yöntemi belirle; yalnız doğrulanmış ihtiyaç için destek planla. |
| Client cert | p12/sertifika parolası seçimi ve hedefe bağlı mTLS kimliği yok. | Yalnız sunucu zorunlu kılıyorsa native kasaya bağlı ayrı tasarım; server CA ile client cert karıştırılmamalı. |
| HTTP/Expect | HTTP1.1 veya Expect seçtiren ürün ayarı yok. | Gerçek protokol hatası kanıtlanmadan genel ayarlar ekleme. |
| Timeout | Kullanıcı ayarı yok; JS probe için açık uygulama timeout bütçesi yok, native istemciler kendi yapılandırmalarını kullanıyor. | Bağlantı/okuma/toplam test sürelerini sınırlı ve tutarlı belirle; timeout'u ayrı hata olarak göster. |
| Test sonucu | İlk PROPFIND hataları tek webdav_connection; sonraki MKCOL/PUT/MOVE/GET/DELETE başarısızlıkları probe_incomplete altında toplanır. | DNS/TCP/TLS/auth/404/405/timeout aşamasını ve güvenli HTTP durumunu göster; sır/log sızıntısı olmamalı. |
| İki istemci yolu | Ayar testi expo/fetch; gerçek Android/iOS aktarımı ayrı native istemciler. | CA/auth/timeout tercihlerinin test ve gerçek aktarımda aynı sonucu vermesi kabul ölçütü olmalı. |

Mevcut forma portlu giriş örneği (gerçek sunucu denemesi değildir): endpoint `https://sunucu-adresi:8083/webdav/`, targetPath `Kloda` → `https://sunucu-adresi:8083/webdav/Kloda/`. Sunucu bu protokolü sunmalı, sertifika hostname/trust doğrulamasını geçmeli, hedef koleksiyon mevcut ve erişilebilir olmalı.8083 sayısı tek başına HTTP/HTTPS veya auth türünü belirlemez.

Öncelik:1tam URL/port/yol açıklığı + aşamalı hata teşhisi;2gerçek sunucunun TLS/auth/collection ihtiyacını kullanıcı girişiyle doğrula;3yalnız gereken CA/pin/auth uyumunu ekle. Başka uygulamadaki tüm gelişmiş seçenekleri kopyalamak veya TLS kontrolünü kapatmak kapsam değildir.

## Kullanıcıyla değerlendirilmek üzere kaydedilen WebDAV akışı

05.11 kullanıcı “not al, geliştirme aşamalarında değerlendireceğiz” dedi; uygulama izni değildir. Önce hesap/endpoint bağlantısı ve kullanıcıya açılan kök doğrulanacak; sonra uzak klasör gezginiyle “Bu konumu kullan”, “Mevcut klasörü seç”, “Yeni klasör oluştur” seçenekleri değerlendirilecek. Ek alt klasör zorunlu olmayacak; `/webdav/` doğrudan seçilebilecek. Sunucu kullanıcıyı zaten kendi dizinine eşliyorsa fiziksel modem/disk yolu tekrar istenmeyecek. Olmayan klasör ancak açık kullanıcı seçimi ve MKCOL yetkisiyle oluşturulacak; bağlantı doğrulamasıyla yazma/temizleme testi ayrılacak. Görünen izinler ve kök sınırı sunucunun kullanıcı yetkileriyle sınırlıdır.

Son kullanıcı bildirimi: hedef Kloda klasörü yok; sonraki testte probe/temizlik tamamlanamadı uyarısı görüldü. Bu uyarı yazma zinciri başarısızlığı veya korunmuş önceki belirsizlik olabilir; hangi metodun başarısız olduğu doğrulanmadı. ADB bu defa erişilebilir; mevcut Kloda işlem logunda Metro WebSocket kopmaları var, WebDAV/TLS/HTTP aşamasını gösteren satır yok. Yeni sunucu testi veya temizlik yapılmadı.

Resmî genel kullanım kaynakları: [FolderSync hesap ve klasör seçimi](https://foldersync.io/docs/help/quickstart/), [WebDAV MKCOL standardı](https://www.rfc-editor.org/info/rfc4918/). Bunlar önerinin dayanağıdır, Kloda'da uygulanmış özellik değildir.

## Sınır ve devam

Bu kayıtta başarılı yeni sunucu testi/aktarım veya fix iddia edilmez. Başarılı eski testler tekrar edilmedi. Commit/push yok.
Sonraki sohbet: “AGENTS.md → CURRENT.md → field-findings-2026-11-05.md oku. Önce Android aktarım log erişimini ve WebDAV formunda tam endpoint/port/yol ile gerçek hata aşamasını doğrula. Kullanıcı geliştirme onayı vermeden kod veya sunucu verisi değiştirme; güvenlik kontrollerini gevşetme.”
