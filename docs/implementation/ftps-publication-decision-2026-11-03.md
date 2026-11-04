#16c — yayın sözleşmesi kararı /03.11.2026

Durum: uygulama öncesi mimari kapı. TLS fixture onayı yalnız test trust istisnasıdır; yayın sözleşmesini değiştirmez.

Doğrulananlar: standart STOR owned sentinel’ı ezdi. libcurl8.23.0 upload CUSTOMREQUEST ile STOU seçmiyor. pyftpdlib2.1.0 STOU mkstemp ile ayrı ad oluşturuyor; bu, flush veya kalıcı commit kanıtı değildir. ProFTPD rolling kaynak normal STOR’da O_TRUNC; HiddenStores O_EXCL yalnız staging için. Pure-FTPd rolling ftpd.c ve ProFTPD mod_site_misc.c keşfi gerekli açık commit/flush sözleşmesini ortaya koymadı. Rolling kaynaklar exact sunucu kabulü değildir; bütün FTPS sunucularının imkânsızlığı iddia edilmez.

Gerekli garanti: same-target exclusive create; bilinen kalıcı yazım+yayın ACK; cevap adı/request/job/credential-context makbuz bağı; fresh readback; unknown create/commit sonrası otomatik adoption/retry yok. 226 veya hash readback tek başına bu garantiler değildir.

Karar A — mevcut güvenlik sözleşmesini koru, FTPS’yi engelli tut: ürün güvenliği zayıflamaz;16c çalışır adapter kabulü açık kalır. Sonraki ilerleme için bu garantileri belgeli sunucu/uzantı gerekir. Yeni SDK/fork/mobil build yapılmaz.

Karar B — ayrı, sunucu tarafı publication uzantısını TASARLAMA kapsamını aç: yalnız tasarım+somut diff hazırlanır. Capability/version, request-bound exclusive staging, file+directory durability, no-replace publish ve durable idempotent receipt/recovery sözleşmesi tarif edilir. Henüz sunucu deploy’u, ürün ABI’si, SDK fork veya uygulama onayı değildir. Mevcut standart FTPS sunucuları bu ek capability yoksa engelli kalır. Dağıtım/bakım kapsamı büyür; otomatik uygulanmaz.

Daha düşük garantiyle STOR+226/hash kabul etme önerilmez; yeni güven politikası kararı olmadan uygulanmaz.

Kaynaklar:
- https://curl.se/libcurl/c/CURLOPT_CUSTOMREQUEST.html
- https://raw.githubusercontent.com/proftpd/proftpd/master/modules/mod_xfer.c
- https://raw.githubusercontent.com/proftpd/proftpd/master/contrib/mod_site_misc.c
- https://raw.githubusercontent.com/jedisct1/pure-ftpd/master/src/ftpd.c
- pyftpdlib2.1.0 FTPHandler.ftp_STOU (kurulu exact fixture kaynağı)

Başarılı eski testler ve TLS fixture yeniden koşulmadı. Yeni sunucu, ürün kodu veya dependency eklenmedi. AGENTS: “Stop only if: a new architectural/security-policy decision is required”; mevcut SMB patch istisnası FTPS fork izni değildir.
