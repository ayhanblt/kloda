# P3-06-FTPS-1 — host temsilcisi (21.11.2026, Sonnet Medium)

Sonuç: **PARTIAL.** Normal explicit FTPS (kontrol + pasif veri, gerçek CA/hostname doğrulaması, gerçek auth) ile 1 MiB sentetik upload/readback **boyut+SHA eşleşti**, ancak (a) vsftpd 3.0.5'te `require_ssl_reuse=NO` gerekti, (b) vsftpd ana süreci her TLS oturumundan sonra SIGSEGV (exit 139) ile düşüyor → servis çalışır bırakılamadı. Android'e geçilmedi. Commit/push yok; repo kodu/asset değişmedi (yalnız bu evidence dizini).

## Kaynak/provenance
- Base: yerel `ubuntu:24.04` `sha256:fe815609…f852` (arm64, 24.04.5, created 2026-10-25). Paket: `vsftpd 3.0.5-0ubuntu3.1` arm64, `http://ports.ubuntu.com/ubuntu-ports noble-updates/main` (apt, imzalı depo; policy çıktısı `acquire.log`). `--no-install-recommends` bağımlılıkları: adduser, libwrap0, netbase; .deb sha256'ları `debs.sha256`.
- Edinim ağlı geçici konteynerde (`apt-get install --download-only`); kurulum **`--network none`** konteynerde `dpkg -i`, `docker commit` → yerel imaj `kloda-p3-06-ftps:2dc9d74b` (`sha256:f51ccb42…39d6`, arm64). Servis konteyneri yalnız `127.0.0.1:27449` (kontrol) ve `127.0.0.1:27450` (tek sabit pasif port), privileged/host network yok, `--cap-drop ALL`+minimal ekleme, `no-new-privileges`.
- Test PKI (host `openssl` 4.1.0): CA RSA-3072 (3 gün), sunucu RSA-2048 SAN `DNS:localhost, IP:127.0.0.1`, EKU serverAuth, 2 gün. **Public CA sha256 (dosya) `722370f2539e9b33553e3295799ea39d65038cf904f87a0caf5686175c518dc0`**, X.509 parmak izi `0F:24:27:08:…:6D:6B`. CA özel anahtarı konteynere girmedi; sunucu anahtarı/parola 0600 scratch'te, log/repo'da değil. `test-ca-public.pem` yalnız public sertifika.

## Komut/sonuç özeti (log: bu dizin + scratch `/private/tmp/kloda-p3-06-ftps-2dc9d74b/logs`)
| Adım | Sonuç |
|---|---|
| apt download / `dpkg -i` (network none) / commit | exit 0 / 0 / 0 |
| İlk PKI (AKI yok) | RED: Python strict `Missing Authority Key Identifier` → PKI'ya SKI/AKI eklendi (doğrulama gevşetilmedi), `openssl verify -x509_strict -verify_hostname localhost` OK |
| Konfig | `ssl_tlsv1_1/_1_2/_1_3` 3.0.5'te geçersiz (sessiz exit 2) → kaldırıldı; `ssl_tlsv1/sslv2/sslv3=NO` |
| Probe A (TLS1.3, default reuse) | `522 SSL connection failed: session reuse required`; konteyner exit 139 |
| Probe B (client TLS1.2, default reuse) | BrokenPipe; exit 139 (A/B `probe-*.err.tail`) |
| Ayrım: caps/no-new-privileges kaldırıldı; `vsftpd_log_file/max_*` kaldırıldı | aynı BrokenPipe + 139 → kök neden capability/log/limit değil |
| **Probe C** `require_ssl_reuse=NO`, client TLS1.2 (`ssl.create_default_context(cafile=CA)`, `check_hostname`, `CERT_REQUIRED`, host `localhost`) | **exit 0**: `TLSv1.2 ECDHE-RSA-AES256-GCM-SHA384`, payload 1048576 B sha256 `631b8402…e4f769`, sunucu `SIZE`=1048576, readback 1048576 B aynı SHA (`probe-success.json`); bağımsız: `docker cp` ile alınan dosya host'ta 1048576 B, aynı SHA |
| Düz banner/QUIT oturumu | master ayakta kalır → çökme TLS veri oturumuna bağlı |
| Probe D (tekrar) | probe exit 0, sonra master yine 139 |

## Açık kök neden / sayaç
1. Default `require_ssl_reuse=YES` Python ftplib (TLS1.3 ve 1.2) ile uyumsuz; relax edilen yalnız bu sunucu seçeneği, CA/hostname doğrulaması korunuyor. vsftpd ≤3.0.5 reuse kontrolü için yayımlı bir danışma notu var (VulnCheck 30.10.2026); loopback+geçici fixture'da kabul, üretim sunucusu değil.
2. **vsftpd master SIGSEGV (139) TLS oturumundan sonra: kök neden kanıtlanmadı** (gdb/strace yok, ek paket yok; çökme zamanlaması probe tamamlandıktan sonra). Aynı yaklaşımda ≥2 başarısız servis-kararlılık denemesi → üçüncü deneme yok, sayaç korunur (host FTPS-1 servis kararlılığı: 2 başarısız, farklı hipotez eleme kayıtları yukarıda).
3. Servis şu an **durdu** (konteyner `kloda-p3-06-ftps-2dc9d74b` exited, port boş); sunucu dosyası konteynerde kaldı. Scratch `/private/tmp/kloda-p3-06-ftps-2dc9d74b` (0700; `pki/*.key`, `conf/pw`, `conf/server.key` 0600) reuse için tutuldu; sonraki Android kapsamı bununla sınırlı. Temizlik: `docker rm kloda-p3-06-ftps-2dc9d74b; docker rmi kloda-p3-06-ftps:2dc9d74b; rm -rf /private/tmp/kloda-p3-06-ftps-2dc9d74b`.

## DECISION (koordinatör), tek soru
Android'in tek aktarımı için her oturumda master çöküşü kabul edilebilir mi? Öneri: `docker run --restart on-failure:5` ile aynı vsftpd'yi yeniden başlatıp fixture-only çökmeyi belgeleyerek devam (kod/sunucu değişikliği yok; Android tek transfer başarısı ya da hata kanıtı yine gerçek), **veya** FTPS-1'i bu PARTIAL ile kapatıp Android'i durdur. Android client TLS1.3 + reuse davranışı bilinmiyor; `require_ssl_reuse=NO` kalıcı gerekebilir. Android build/koşu yapılmadı.

## Çökme sınırı — salt-okunur zamanlama incelemesi (21.11, yeni koşu yok)
Kaynak: scratch log mtime'ları (µs), `docker events` (`die 139`) ve `State.FinishedAt`; hepsi UTC, mevcut A–D koşuları.

| Koşu | İstemci çıkışı (log mtime) | `die 139` olayı | Fark |
|---|---|---|---|
| A (TLS1.3, reuse=YES) | 00:06:57.169 | 00:06:57.293 | 0,124 s |
| B (TLS1.2, reuse=YES) | 00:07:05.778 | 00:07:05.894 | 0,116 s |
| C (reuse=NO, başarılı) | 00:07:16.327 | 00:07:16.471 | 0,145 s |
| D (reuse=NO, başarılı) | 00:07:37.914 | 00:07:38.044 (`FinishedAt` 00:07:37.914028) | 0,130 s |

Ayrılabilen: (1) `die 139` = PID 1 (vsftpd ana süreç) sinyalle ölmüş; docker logs boş, OOM yok. (2) D'de çıkış zamanı istemci kapanışıyla (stdout `flush` Python çıkışında, `f.quit()` sonrası) ms düzeyinde aynı; yani ölüm **veri aktarımı/readback tamamlandıktan ve kontrol QUIT/EOF'tan sonra** — aktarım ortasında değil. (3) Fark dört koşuda ~0,12–0,15 s sabit (docker olay gecikmesi); başarılı ve başarısız (522/BrokenPipe) koşularda da ölüm istemci bittiği anla hizalı → çökme veri baytlarının doğruluğundan bağımsız, **TLS oturumunun sonlanmasıyla** ilişkili. Düz (TLS'siz) QUIT oturumunda ölüm yok.

İspatlanamayan: veri TLS bağlantısının kapanışı mı, kontrol TLS'in kapanışı mı, QUIT yanıtı mı, çocuk işlem çıkışı → ana işlemde SIGCHLD yolu mu tetikliyor; hangi PID SIGSEGV aldı (işlem ağacı oturum sırasında hiç örneklenmedi: `docker top` yalnız oturum başlamadan önce ana süreci gösterdi; `FinishedAt` ile istemci saati arasında VM/host saat kayması ölçülmedi). Core/backtrace yok (gdb/strace yok).

**Tek farklı kapsam-içi tanı yolu (uygulanmadı):** mevcut sunucu/konfig/imaj ve mevcut `probe.py` ile, `QUIT`'ten önce kontrol bağlantısını açık tutan (ör. 5 s) bir istemci varyantı + aynı konteynerde kısa `docker exec sh` ile `/proc/*/stat` (pid, ppid, durum) ve zaman damgasını sürekli kaydeden iç döngü. Ayırır: ana süreç veri kapanışında mı, yoksa QUIT/kontrol kapanışında mı düşüyor ve düşen PID ana mı çocuk mu. Yeni konfig/güvenlik değişikliği, paket veya Android yok; tek koşu, koordinatör onayıyla.

## Kontrollü kapanış tanısı (21.11, tek koşu; ürün FIX/kararlılık denemesi veya PASS değil)
Aynı imaj `kloda-p3-06-ftps:2dc9d74b`, aynı `vsftpd.conf.final` (diff boş), cap/güvenlik/restart değişikliği yok; tek normal istemci (`probe-diag.py`, TLS1.2, CA+hostname doğrulamalı). Olaylar: `diag-events.txt` (host saati), `diag-samples.txt` (konteyner içi bash döngüsü, `/proc/*/stat`, yalnız değişimde; konteyner saati). Sonuç: istemci exit 0, byte+SHA eşleşti (`match=True`), konteyner yine exit 139 (`FinishedAt` 00:11:09.1175).

Zaman çizelgesi (konteyner saati, µs; host saatine göre ofset ölçümü ±~40 ms belirsiz: `clock-offset.txt` konteynerin host'a göre −10…+34 ms olabileceğini verir; **sıra** sıkı, **mutlak karşılaştırma** değil):
| Olay | Gözlem |
|---|---|
| bağlantı (host `connect` …864.0519) | 864.0510 PID1 uyanır; 864.0513 **46** (ppid 1) doğar; 864.0515 **47** (ppid 46); 48 (ppid 46) giriş sonrası 864.0772 |
| STOR/RETR veri kapanışı (host …864.0985 / …864.1146) | 864.110'a kadar 46/47/48 canlı; **PID 1 `S` (uyur) kalır**, çökme yok |
| 5 s bekleme (veri kapalı, kontrol açık) | 864.110 → 869.116 hiçbir PID değişimi yok; PID1 `S`, 46/47/48 canlı |
| QUIT (host `quit_send` …869.1205, 221 …869.1216) | 869.1160 47+48 uyanır; **869.1163: 48 çıkar, 46+47 R**; **869.1165: 46 ve 47 çıkar, PID1 `R`** (SIGCHLD ile uyanış), ardından örnekleme biter (konteyner öldü); docker `FinishedAt` 869.1175 |

Ayrılan: (1) Çökme **veri TLS kapanışında değil** — veri kapandıktan 5 s sonra ana süreç hâlâ sağlıklı. (2) Çökme **normal QUIT/kontrol kapanışında**: oturum işlemleri (48, 46, 47) çıkar, ≈0,2 ms sonra ana süreç (PID 1) R durumuna geçer, ≈1 ms sonra konteyner 139 ile biter. (3) Ana süreç oturum ağacının dışında (46'nın ebeveyni); tek işi çocuk çıkışını (SIGCHLD) işlemek → çökme ana sürecin oturum-sonu/SIGCHLD işleme yolunda.
Ayrılamayan: Örnekleme **sinyal alan PID'yi kanıtlamaz** (PID1'in `R`'den sonra yok olduğu görüldü, `Z`/sinyal bilgisi yok; 139 PID1 çıkış durumu, docker'ın init için bildirdiği değer); hangi vsftpd fonksiyonu/işlev (SIGCHLD işleyicisi mi, yoksa başka bir ana-süreç yolu mu) çöküyor kanıtsız; 46/47/48 çıkış durumları da bilinmiyor. Zaman tabanı: host saatinde olay/ konteyner (VM) saatinde örnek → sıralama konteyner içi örneklerden, istemci olayları yalnız kaba hizalama (10–40 ms).

Aidiyetli koşu durduruldu (konteyner exited 139, port 27449/27450 boş, örnekleyici konteynerle öldü). Reuse: başarılı host byte+SHA (C/D ve bu koşu aynı `631b8402…e4f769`), 2 başarısız kararlılık denemesi sayacı korunur.

**Kapsam içi kanıtlı çözüm yok → PARTIAL.** Somut eksik önkoşul: çöken fonksiyonu veren backtrace (core/gdb yok). **Tek sonraki adım (koordinatör kararı):** aynı geçici konteynerde yalnız Ubuntu 24.04 `gdb` paketinin resmi depodan edinimi ve `SYS_PTRACE` ile ana sürece `gdb -p 1` bağlanıp tek oturum kapanışında SIGSEGV backtrace'i alınması; konfig/sunucu/güvenlik değişikliği veya zafiyet reproduksiyonu olmaz. Reddedilirse FTPS-1 bu PARTIAL ile kalır, Android durur.
