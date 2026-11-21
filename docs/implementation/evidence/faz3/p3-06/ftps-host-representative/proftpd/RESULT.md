# P3-06 FTPS-1 — alternatif fixture: ProFTPD (21.11.2026, Sonnet Medium)

Sonuç: **HOST YEŞİL (FTPS-1 temsilcisi).** vsftpd 3.0.5 (her TLS oturumundan sonra ana süreç SIGSEGV/139; [RESULT.md](../RESULT.md)) yerine resmi Ubuntu 24.04 arm64 deposundan `proftpd-core` + `proftpd-mod-crypto` **1.3.8.b+dfsg-1ubuntu0.1** (noble-updates/universe; Ubuntu güvenlik/bakım güncellemesi, [candidates.log](candidates.log)); pure-ftpd yalnız noble ilk sürüm 1.0.50 olduğundan elenmiştir. Aynı sayaç/kanıt korunur: vsftpd kararlılık denemesi 2 başarısız (yeniden denenmedi, gdb/ptrace/crash tetikleme yok).

## Provenance / izolasyon
- Base `ubuntu:24.04` `sha256:fe815609…`, edinim ağlı geçici konteynerde (`apt-get --download-only --no-install-recommends`, .deb sha256: [debs-b.sha256](debs-b.sha256)); kurulum `--network none` `dpkg -i` ([install-b.log](install-b.log)); yerel imaj `kloda-p3-06-ftps-pro:2dc9d74b` `sha256:8e6060ae…a27b` arm64. Modül `mod_tls` 2.9.2 `proftpd-mod-crypto` paketindedir (core'da yok).
- Konteyner `kloda-p3-06-ftps-pro-2dc9d74b`: yalnız `127.0.0.1:27449` (kontrol), `27450-27451` (pasif), privileged yok, host ağı yok, restart politikası yok, test CA/sertifika/parola önceki scratch'ten (CA public sha256 `722370f2539e9b33553e3295799ea39d65038cf904f87a0caf5686175c518dc0`; özel anahtar/parola repo/logda yok, 0600 scratch).
- Konfig [proftpd.conf.final](proftpd.conf.final): explicit TLS (`TLSRequired on`, TLS1.2/1.3), `DefaultRoot`, tek kullanıcı `kloda_probe`, anonim yok; SystemLog/TLSLog `/var/log/proftpd`.

## Kök neden notları (yol sorunları, çözüldü)
`PassivePorts` ≥2 port ister (27450–27451); `/tmp` altındaki scoreboard/log "world-writable" reddi → `/var/run`, `/var/log/proftpd`.

## TLS oturum yeniden kullanımı (açık, fixture-only)
Varsayılan (reuse zorunlu) + `TLSSessionCache shm` ile Python `ftplib` veri bağlantısı yine reddedildi: `client did not reuse TLS session`; istemci kontrol oturumunda ID(32 B)+bilet vardı ([probe-reuse.py](probe-reuse.py)). vsftpd ile aynı sınıf → ortak etken istemci/OpenSSL 3.0.15 eşleşmesi şüphesi, kanıtlanmadı. **Fixture-only** `TLSOptions NoSessionReuseRequired` (vsftpd'de `require_ssl_reuse=NO` ile aynı, loopback/geçici) ile geçti; CA/hostname doğrulaması, gerçek auth, TLS minimum korunur. [Reuse gerekli konfig](proftpd.conf.reuse-required) kayıtlı. Android istemcisinin davranışı bilinmiyor.

## Normal pozitif transfer ve sağlıklı kapanış
İki bağımsız oturum ([probe-pro-1.json](probe-pro-1.json), [-2](probe-pro-2.json)): `ssl.create_default_context(cafile=CA)`, `check_hostname`, `CERT_REQUIRED`, `localhost`, TLS1.2 `ECDHE-RSA-AES256-GCM-SHA384`, explicit AUTH TLS + PROT P + pasif; 1048576 B, sha256 `631b84027d6b9e52b539c4e8373622d23032dfadc64d60af87339c9037e4f769`, `SIZE`=1048576, readback aynı; konteyner içinde `sha256sum` iki dosyada aynı. İki QUIT sonrası konteyner `running`, çökme yok (vsftpd'de her oturumda 139). Host TLS probe'u (`probe.py`) `vsftpd` kanıtıyla aynı.

## Servis durumu / Android için sahipli state
Servis **çalışır bırakıldı** (konteyner yukarıdaki ad; yeniden başlatma politikası yok). Scratch `/private/tmp/kloda-p3-06-ftps-2dc9d74b` (0700): `pki/ca.pem` (public), `confp/server.key`, `confp/pw` (0600) yalnız sonraki tek Android normal temsilcisi için; sürümlenmez. Temizlik: `docker rm -f kloda-p3-06-ftps-pro-2dc9d74b; docker rmi kloda-p3-06-ftps-pro:2dc9d74b kloda-p3-06-ftps:2dc9d74b; rm -rf /private/tmp/kloda-p3-06-ftps-2dc9d74b`.

## Tek sonraki adım
FTPS-2: güncel `packages/ftps-native` + bu test CA ile arm64 `android-jni,owned-fixture` test `.so` ve `androidTest` APK (ayrılmış test kopyası), ardından `adb reverse` 27449/27450/27451 ve tek Android normal aktarım. Henüz başlanmadı; `require_ssl_reuse` Android istemcisiyle ilk gerçek sınav.
