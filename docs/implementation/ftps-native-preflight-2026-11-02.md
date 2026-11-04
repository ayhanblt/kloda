#16c explicit FTPS — dar ön eleme /03.11.2026

Merge tamam: main `67701e7`; push yok, origin/main `50ae92e`. Önceden staged start.log silme ve untracked Claude worktree alanı korundu. Ürün/SDK dependency/ABI veya güven politikası değiştirilmedi;17 başlamadı.

ADR0022 D1 korunur: explicit AUTH TLS, control+data şifreleme/PROT P, tam sertifika+hostname doğrulama, LAN-only. Plain/implicit FTP, CCC/clear data/downgrade, private-CA/custom pin onaylı değil. SFTP sunucusu FTPS fixture değildir; yeni kişisel hesap/cihaz/Photos izni yok.

## Exact aday ve yeni dar kanıt

[Tek manifest](evidence/ftps-preflight-2026-11-03/manifest.json): resmî kaynak arşivinden **libcurl8.23.0**, SHA256 `8dadd7d2536a314f982ad05a651b713f426bf7d02cc2c76cffb9796f2218e6c5`. COPYING/SPDX curl incelendi; dağıtımda notice korunur. [Exact sürüm advisory sayfası](https://curl.se/docs/vuln-8.23.0.html) gözlem anında0 yayımlanmış curl açığı bildiriyor. PGP imzası bağımsız doğrulanmadı; tam dependency/TLS backend/platform kabulü verilmedi. Context7 sorgusu+exact kaynak/resmî API karşılaştırıldı.

Yeni iki sentetik loopback **negatif davranış doğrulaması** PASS; host C çağırıcısı unmodified8.23.0 statik libcurl ile derlendi. Gerçek hesap yok; upload boş ve sunucu aktarım öncesi550 ile reddediyor. Test fixture’ının plain komut yolu ürün için plain FTP izni veya FTPS kabulü değildir.

- `UPLOAD + CUSTOMREQUEST=STOU` → **STOR candidate**, exit25. Upload kaynakta STOR/APPE; CUSTOMREQUEST FTP listelemesini değiştirir. [API](https://curl.se/libcurl/c/CURLOPT_CUSTOMREQUEST.html). Standart STOR no-overwrite değildir; önce exists kontrolü/UUID veya denetimsiz rename bunu düzeltmez.
- `USE_SSL=ALL + FTPSSLAUTH=TLS`, AUTH TLS reddi → **AUTH SSL**, ardından exit64. USER/PASS gönderilmedi. Bu seçenek TLS-first sırasıdır, TLS-only değildir. [API](https://curl.se/libcurl/c/CURLOPT_FTPSSLAUTH.html). AUTH SSL fiili tek başına SSLv3 kullanımı demek değildir; ADR’deki exact AUTH TLS/fallback sınırını sessiz genişletme.

Ham kaynak/derleme logları `/private/tmp/kloda-ftps16c-preflight`; küçük C/Python probe ve hashler manifest yanında korunur. Host configure `--disable-everything` bayrağını tanımadı; tüm protokoller derlendi, minimal dependency kabulü yok. Libtool uyarıları var; build/link+iki yeni probe başarılı. İlk CLI harness olmayan bir seçenek kullandı, sunucu bağlantısı kurmadı; C public API ile düzeltilmiş sonuçlar esas. Başarılı eski testler yeniden koşulmadı.

## Açık kapılar / sonraki dar iş

**Libcurl’ün doğrudan STOU ve TLS-only seçenekleri olduğu varsayımı elendi; bütün libcurl+sunucu tasarımları imkânsız ilan edilmedi.** Henüz uygun yayın/trust yolu yok; ürün/mobil matris açılmaz. STOU desteği tek başına flush/durability, yanıt adını makbuza bağlama veya lost-ACK kapanışı değildir.

Sıradaki: SDK yaması olmadan tek sunucu/capability üzerinde atomik exclusive-create+durable publication ve strict AUTH TLS yolunun mümkün olup olmadığını kaynak/sözleşme düzeyinde ele. Genel STOR/rename, path/hash adoption ve kör retry kabul edilmez. Olumlu fixture için onaylı trust profilini karşılayan endpoint/cert ve native control+her passive data socket route/context sahibi ayrıca gerekir. Yeni SDK fork/ABI/güven politikası gerekiyorsa önce somut kapsam/diff ve açık onay; mevcut SMB patch istisnası FTPS’ye taşınmaz. Bu taskta yeni istisna/patch seçilmedi.

Gerçek TLS/cert/hostname/PROT P, route-generation, no-clobber/durable/lost-ACK runtime ve mobile ABI/ürün kabulü NOT_RUN. Genel12/20/21 ve bağımsız son review açık; ayrı aynı-agent değerlendirme bağımsız review değildir.16c tamamlanmadı.

Yeni sohbet mesajı:
> /Users/ayhanblt/Desktop/projects/kloda içinde AGENTS.md → docs/implementation/CURRENT.md → docs/implementation/ftps-native-preflight-2026-11-02.md oku. Gerçek HEAD/dirty durumunu dar kontrol et;16c’de exact libcurl8.23.0’ın kaydedilmiş iki negatif probe’unu ve başarılı eski testleri tekrarlama. SDK yaması olmadan tek sunucu/capability ile exclusive-create+durable publication ve strict AUTH TLS yolunun uygulanabilirliğini ele. Kritik yol çözülmeden ürün/ABI/matris açma; yeni fork/ABI/politika gerekiyorsa somut kapsam/diff hazırla ve açık onay bekle. Task sonunda tek kısa checkpoint ve yeni sohbet promptu yazıp dur.

## Ek ilerleme — kullanıcı tüm16c’ye devam+izole CA onayı /03.11

Kullanıcı artık ara task sınırında durmadan tüm16c’nin düşük harcamayla ilerletilmesini istedi. Yalnız disposable loopback/test sürecinde CA güveni açık onaylı; ürün/sistem trust istisnası değildir. [TLS fixture kaydı](evidence/ftps-preflight-2026-11-03/tls-fixture.json): pyftpdlib2.1.0+pyOpenSSL25.3.0 isolated venv, exact libcurl8.23.0. Explicit TLS+PROT P listing PASS; unknown CA+hostname mismatch exit60; clear data exit13/550 ile reddedildi. Başarılı sonuçlar kayıttan kullanıldı, tekrar koşulmadı. İlk harness clear-data için yanlışlıkla8 bekledi;13 gerçek güvenli red olarak kaydedildi, yalnız henüz koşulmamış STOR kontrolü devamda çalıştırıldı.

**Standart STOR güvenlik kapısı FAIL:** owned sentinel içeriği overwrite oldu. TLS başarısı exclusive/durable publication kabulü değildir. Server terminate+wait yapıldı; fixture CA/server private keyleri kaldırıldı. Ürün/ABI/Photos/17 başlamadı.

ProFTPD alternatif ön elemesi: upstream master mod_xfer.c normal STOR open yolunda O_CREAT/O_TRUNC kullanır; HiddenStores staging O_EXCL olsa bile final no-clobber/durability buradan çıkmaz. Bu rolling kaynak keşiftir, exact sunucu kabulü değildir. Kaynak: https://raw.githubusercontent.com/proftpd/proftpd/master/modules/mod_xfer.c . AllowOverwrite ayarı tek başına yarış-güvenli exclusive/durable kanıt kabul edilmedi.

Sonraki gerekli çözüm hâlâ exclusive-create+flush/no-replace receipt ve strict AUTH TLS yoludur. SDK fork/yeni sunucu uzantısı veya güven politikasını genişletme uygulanmadı. İzole CA onayı bunları kapsamaz. Genel CA/gerçek LAN+native route+lost-ACK/mobil/bağımsız kabul kapıları açık.

## Mimari kapı /03.11

Kaynak ön elemesi exclusive create ile durability’nin ayrı gereklilikler olduğunu netleştirdi. Gerekli garantiyi sağlayan yayın yolu henüz seçilemedi; [somut karar kapsamı](ftps-publication-decision-2026-11-03.md): A mevcut sözleşmeyle FTPS engelli, B ayrı sunucu uzantısının yalnız tasarım/diff kapsamını açma. Ürün güvenliğini düşürme/fork/ABI yapılmadı. Başarılı kontroller tekrarlanmadı. Mimari karar gelmeden ürün/matris açılmaz.

## Güncel karar ve temsilî pratik yol /03.11

Kullanıcı özel eklentiyi reddetti, pratik kontrol profilini açık onayladı; ADR0022 son bölümü artık FTPS yayın kabulünün yetkili kaynağıdır. Önceki zorunlu atomic no-clobber/remote fsync engeli FTPS için bu kararla aşılmıştır; eski A/B karar belgesi artık karar bekleyen kapı değildir. Native route/generation/TLS ve belirsiz ACK güvenli duruşu korunur.

[Yeni pratik fixture kanıtı](evidence/ftps-preflight-2026-11-03/practical-result.json): Python protokol fixture’ında AUTH TLS+PROT P, mevcut isimde upload yapmama, yeni UUID isimle226 ACK ve taze tam readback size/SHA256 eşleşmesi PASS; sentinel korundu. Bu native libcurl adapter kabulü değildir. İlk koşular test sertifikasındaki AKI/CA keyUsage eksikliği nedeniyle reddedildi; doğrulama kapatılmadan sertifika uzantıları düzeltildi, yalnız başarısız yeni yol tekrarlandı. Server kapandı, özel anahtarlar silindi.

Sıradaki uygulama işi: exact native istemci/sahip sınırını seç; strict AUTH TLS ile control+her passive data socket route/context bağını tek hostta doğrula, ardından ayrı FTPS native journal/vault/Files/restore/queue/ürün bağlantısına geç. Eski başarılı probe’ları tekrar etme.16c henüz tamamlanmadı.

## Native aday —03.11

SDK yamasız exact suppaftp12.2.1 + rustls-ring adayı incelendi. Public connect_with_stream/passive_stream_builder, into_secure içindeki AUTH TLS/PBSZ0/PROT P ile kontrol+her veri socket’ini dış sahibine bırakıyor. [Native aday manifesti](evidence/ftps-preflight-2026-11-03/native-candidate/manifest.json).66 registry bağımlılığı OSV querybatch eşleşme0; declared MIT OR Apache-2.0, tam dependency license/platform kabulü açık. Python OSV isteği yerel CA deposu hatası verdi; TLS doğrulaması kapatılmadan sistem curl güven deposuyla tamamlandı.

Yeni Rust host prototipi build+configured control socket/EPSV callback/upload/fresh full readback PASS. Ayrı data-owner denial ve farklı IP’yi bağlantıdan önce red assertion PASS. Önceden başarılı testler tekrarlanmadı. Bu prototip loopback/test CA ve sentetik owner kullanır; gerçek OS route/generation ya da production trust kabulü değildir. Ürün dependency/ABI eklenmedi; fixture kapandı, private keyler silindi.

Devam: adayı tam license/dependency kabulünden geçir; FTPS’ye özgü bound control/data native sahip kontratını mevcut Android/iOS route ömrüyle uygula; journal/vault/pratik upload+readback/lost-ACK, Files/restore/queue/Photos ve ürün bağlantısını tamamla.16c açık.


03.11 kapanış: bu dosya tarihî ön elemedir. Güncel16c uygulama/izole kabul sonucu ve açık genel kapılar yalnız [tek checkpoint](ftps-native-checkpoint-2026-11-03.md) ve onun manifestindedir. Tarihî açık ifadeleri güncel durum sayma.
