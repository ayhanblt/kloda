# SFTP16b — uygulama ve izole kapanış /02.11.2026

16b uygulaması ve bu aşamanın izole kabulü tamamlandı. [Tek kanıt manifesti](evidence/sftp-closure-step16b-2026-11-01/manifest.json), [review kaynak snapshotı](evidence/sftp-closure-step16b-2026-11-01/source-hashes.json). Ön eleme tarihî referanstır; devam noktası bu belgedir. SFTP varsayılan kapalıdır; genel ürün aktivasyonu verilmedi.

## Tamamlanan kapsam

Exact russh0.65.0/ring + russh-sftp3.0.1; bağımsız exact host+port SHA256 pin, plain Ed25519, pin eşleşmesinden sonra kullanıcı adı/parola. Native vault/profil generation, consuming bound FD, mevcut numeric LAN route sahibi, ayrı SFTP journal/Files/Photos manifesti/own katalog/download/restore/review, queue/schedule/native OS sahipleri ve TR/EN/DE ürün formu bağlandı. TOFU/key import/agent yok. `sftp_enabled` kendi journal transaction’ındadır. `backup_destination` şema/CHECK/user_version ve Claude worktree’si değiştirilmedi.

Exclusive staging, bounded WRITE ACK, zorunlu advertised+explicit fsync ACK ve CLOSE ACK, no-overwrite rename ve taze hash/size okunması korunur. Ayrı aynı-agent review, parent kontrolü sırasında yetki düşerse rename öncesi kontrolün eskimesini yakaladı: native receipt kontrolü parent/open ve hemen rename öncesine eklendi. Eski kodda negatif kontrol hatayı gösterdi; düzeltilmiş gerçek OpenSSH testi PASS. Kayıp ACK/bilinmeyen create otomatik adoption veya kör retry yetkisi vermez.

## Toplu doğrulama

- Mobil lint/TypeScript;7 SFTP UI/API testi; tam mobil suite179 PASS/3 eski düğme beklentisi düzeltildi, etkilenen App grubu18/18 PASS; toplam182 test kapsandı.
- Rust yol testi/Clippy/format, gerçek bound host publication/read+Swift journal seed/reopen/failure fences/profile; Android Kotlin ve Expo dahil iOS native typecheck PASS. Son fence ile dört Android ABI JNI/C export+16KB ve iki iOS arm64 dilim/XCFramework yeniden paketlendi. Tam Simulator app build PASS; üretim signing kabulü değildir.
- Android mevcut JNI ile SAF source/reuse/version/keep-both/download/restore, codec cross-protocol reddi, ürün factory/service ve kendi OS Job’u PASS. İki platform admission/unconfigured negatif kontrolleri gerçek OS delivery sayılmaz.
- Android exact kullanıcı onaylı1PNG Photos: resource/manifest, favorite revision, download/restore/repeat/reopen, stale/unknown-create güvenli duruş PASS. Yalnız receipt-owned medya ve yeni izinler temizlendi.
- iOS gerçek Windows LAN `192.168.1.54:2222/upload`: gerçek Source/Restore picker bookmark,4097 byte yayın/taze download/restore/tekrar ve ayrı süreç reopen PASS; Keychain test profili kaldırıldı.
- iOS exact kullanıcı onaylı Photos:1PNG+albüm, gerçek resource/manifest yayın/download/import, üç restore çağrısı ve ayrı süreç reopen PASS; tam2 asset+2 albüm, kimlik doğrulamalı cleanup+post-fetch0 PASS. Simulator’ın30 albüm uyarısı native exact-ID üyelik1+1 kanıtıyla karşılaştırıldı; yalnız2 fotoğraf silindi. İlk izin bekleme hatalarında medya ledger’ı yoktu; yeni kaynak körlemesine oluşturulmadı.
- Exact211 registry dependency için OSV eşleşmesi0; inventory/notices hazır. Bu sıfır zafiyet garantisi değildir.
- Native TR/EN/DE/max Almanca font batch ekranları PASS. Klavye üstünde secure/editable alan CUA ile gözlendi; ayrı klavye screenshot dosyası eksik. Tam VoiceOver/görsel kabulü değildir.

## Temizlik ve korunan kapılar

Kaynak600 parola dosyası+boş dizini silindi; iki fixture Keychain profili kaldırıldı, yeni Photos izni sıfırlandı. Owned Simulator ve Android5584 kapatıldı; diğer ortamlar değişmedi. Windows test sunucusu uzaktan shell’e kapalıdır ve hâlâ çalışır: kullanıcı Windows PowerShell’de `Stop-Service sshd` ile durdurmalıdır. Remote test UUID dosyaları ve yerel makbuzlar kanıt olarak tutuldu.

Aynı-agent ayrı review tamamdır; kullanıcı kararıyla gerçek bağımsız Claude review en sondadır. Genel12/20/21: kalıcı tüm-ekran batch capture, tam a11y/VoiceOver, gerçek OS background teslim/lock, üretim signing/device custody ve fiziksel/perf kabulü açıktır. Bunlar16b izole testleriyle kapatılmadı.

Sıradaki iş16c explicit FTPS ön elemesidir; [ADR0022](../decisions/0022-advanced-destination-transport-and-credential-custody.md) FTPS trust/control+data sınırını oku.16c ürün uygulaması henüz başlamadı;17’ye geçilmez.
