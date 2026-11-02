#16c explicit FTPS — dar ön eleme /02.11.2026

16a+16b uygulama/izole kapanışından sonra yalnız doküman ön elemesi başladı. Ürün kodu, dependency, ABI, test sunucusu veya güven politikası değişmedi. SDK seçilmedi; sürüm/lisans/advisory/platform kabulü henüz yok.

Onaylı ADR0022 D1: explicit AUTH TLS, control+data şifreleme/PROT P, tam sertifika+hostname doğrulama, LAN-only. Plain FTP/clear data/CCC/downgrade, implicit FTPS, private-CA/custom pin yok. SFTP Windows kurulumu FTPS sunucusu değildir; yeni kurulum veya kişisel hesap izni varsayılmaz.

Mevcut P3 adayı libcurl için Context7 resolve+resmî curl rehberi okundu. [USE_SSL](https://curl.se/libcurl/c/CURLOPT_USE_SSL.html) CURLUSESSL_ALL ile tüm iletişimi zorunlu şifreler; TRY ve yalnız CONTROL onaylı profili karşılamaz. [Açık socket callback](https://curl.se/libcurl/c/CURLOPT_OPENSOCKETFUNCTION.html) resolved adresi reddetmeye veya önceden bağlı socket sağlamaya izin verir. Bunlar mevcut native LAN authority/context/generation sahibinin control ve her passive data socket için korunmasını tek başına kanıtlamaz.

Kritik ucuz eleme: [RFC959 §4.1.3](https://www.rfc-editor.org/rfc/rfc959#section-4.1.3) STOR mevcut içeriği değiştirir; STOU sunucu tarafından seçilen benzersiz adı yanıtta verir. Buradan standart STOR veya kontrolsüz RNFR/RNTO ile no-overwrite/kalıcı publication sağlandığı çıkarılamaz. Kaybolan yanıt sonrası path/hash adoption veya kör retry yok. STOU, sunucu destekli exclusive publication veya doğrulanmış başka bir mevcut mekanizma ancak durable receipt/fresh readback/kesinti testiyle değerlendirilebilir; henüz çözüm kabul edilmedi.

Sıradaki: tek exact adayın kaynak/lisans/advisory elemesi ve tek disposable host üzerinde no-overwrite+lost-ACK/control+data route/TLS negatif kontrollerinin uygulanabilirliğini doğrula. Kritik yayın/trust şartı geçmeden mobile ABI/ürün matrisi açma. Yeni mimari/güven politikası gerekiyorsa somut diff/karar kullanıcıya sunulur.16c tamamlanmadı;17 başlamadı.
