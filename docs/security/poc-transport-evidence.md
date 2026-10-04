# Transport PoC — kalıcı kanıt ve sınırlar

Belgeleme tarihi: **2026-10-04**. Bu kayıt geçmiş çalıştırmaları konsolide eder; bu belgeleme sırasında build/test, deney, servis, cihaz veya cloud işlemi yapılmadı. Yeni mimari veya production cutover kararı değildir. Makine-okunur, allowlist ile çıkarılmış sonuçlar: [public özet](evidence/poc-transport-summary.json). Pairing/native TLS deneyleri ayrı [kanıt kaydındadır](poc-native-verification-evidence.md); onların iOS simulator başarıları aşağıdaki URLSession sonucunu değiştirmez.

## Kesin durum

| Aşama / gerçek platform | Çalıştırılmış sonuç | Kanıt sınırı |
|---|---|---|
| iOS LAN URLSession, iOS26.5 iPhone17 Pro **simulator**, host loopback | 1 build/UI-driver pass; 5 sonuç grubu `unsupported`; genel **inconclusive** | TLS'e ulaşmadan background session kurulumu başarısız; certificate önerisi **undetermined** |
| Ortak Rust motoru, macOS arm64 host | HTTPS8MiB/256MiB/1GiB; native WebRTC64MiB ve son8MiB evidence-contract smoke başarılı | Aynı desktop Wi-Fi interface'i; fiziksel Android veya farklı uplink remote kanıtı değil |
| Fiziksel Android API36, arm64-v8a → macOS Rust CLI receiver | **14 pass / 1 direct-connectivity inconclusive** | Genel `complete=false`, `productionReady=false`; çalışan Electron ürün receiver'ı veya Expo integration kanıtı değil |

**iOS: simulator inconclusive; physical-device validation pending; architecture retained; not production-ready.** Android TURN başarısı direct başarısı değildir. Mobil veri bu izole fiziksel PoC'de yasaktı; ürünün default-off/explicit-opt-in politikası ile testte tamamen kapalı oluşu farklı kapsamdır.

## iOS URLSession — gözlem ile planın ayrımı

Geçmiş ortam Xcode27.0/build27A266a, iOS26.5 simulator idi. iOS16.4 ve16.2 runtime'ları unavailable olarak kaydedilmişti; deployment target16.4, o sürümde çalıştırma değildir. Ayrı SwiftUI/Foundation uygulaması ve XCUITest driver gerçekten build edildi, açıldı, Home'a gidip yeniden aktive edildi. Bu Home olayı fiziksel suspension veya başarılı background upload değildir.

`com.apple.nsurlsessiond` bağlantısı **NSCocoaErrorDomain4097**, ardından **NSURLErrorDomain−1** verdi. Background `URLSessionUploadTask` kurulumu TLS handshake'ten önce başarısız oldu. Receiver final dosya almadı; source olarak8,388,608byte üretimi gözlendi, final SHA256 doğrulanmadı. Raporun tam altı grubu:

1. `native-build-and-ui-driver`: **pass**.
2. `background-file-upload`: **unsupported**, daemon kurulumu başarısız.
3. `trust-leaf-and-device-ca`: **unsupported**, iki aday da TLS'e ulaşmadı.
4. `cold-background-lifecycle`: **unsupported**, upload task kabulü olmadı.
5. `crypto-wire-and-receiver`: **unsupported**, encrypted frame acceptance/final hash gözlenmedi.
6. `storage-scale-and-fault-matrix`: **unsupported**, önkoşul hatasından sonra çalıştırılmadı.

Bu sonuç HTTPS/LAN mimarisinin imkânsızlığını, pin/CA adayının güvenliğini veya güvensizliğini kanıtlamaz. Certificate renewal/rotation, redirect307/308, forged receipt, lost ACK, pause/cancel/reconciliation,256MiB/1GiB staging ve OS-copy ölçümleri planlanmıştı, **bu iOS koşusunda geçmedi/kanıtlanmadı**. OS-copy attribution `not-observable`; staging scale `not-run`. Ayrı historical review, full-file `Data(contentsOf:)` hazırlığının bounded streaming production referansı olmadığını kaydetti; no-op pause/cancel ve transport-error-yoksa-complete davranışları sonraki motor için kabul edilmedi. Planın ayrıntılı protokolü gerçekleştirilmiş kabul matrisi gibi sunulmaz.

Apple'ın [background transfer](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background) ve [upload task](https://developer.apple.com/documentation/foundation/urlsessionuploadtask) belgelerindeki file-only upload, task creation sırasında temporary copy ve background redirect kısıtları kaynak araştırmasıdır; bu koşunun runtime kanıtı değildir. Queued/suspended task kopyaları, export, journal, residual cleanup ve safety reserve bütçeye girer.96MiB app-stage + olası64MiB task copy = **160MiB toplam fiziksel disk garantisi değildir**. Full backup'ı önceden ciphertext'e kopyalama yaklaşımı seçilmedi.

## Android fiziksel kabul matrisi

Final raporun15 üst düzey case'i aşağıdadır; alt test/adversary sayıları üst düzey pass sayısına eklenmez. Final case kayıtları2026-10-02 tarihli çalıştırma zamanlarını taşır.

| Case | Final durum | Gerçek kapsam / sınırlama |
|---|---|---|
| `native-link` | pass |10 create/close turu; Android threads28→28, handles0→0; host threads10→10, handles0→0 |
| `lan-8m` | pass |8MiB fiziksel HTTPS; source/final hash ve authenticated durable final |
| `lan-bounds` | pass |256MiB ve1GiB; sampled kaynak kullanımı ve bounded stage/queue |
| `tls-reject` | pass |Wrong CA, SAN, expired leaf, HTTP URL ve redirect fiziksel reddi; final completion yok |
| `integrity-reject` | pass |Fiziksel forged receipt/wrong-session receipt reddi; malformed wire/tag/offset/duplicate/conflict probe'ları **supplemental host** kanıtı |
| `ack-loss` | pass |Durable part/final ACK kaybı; authenticated status ile recover; ACKed payload yeniden upload edilmedi |
| `crash-resume` | pass |Sender/receiver gerçek process crash cut point'leri; journal/final intent/cancel recovery; source korunur |
| `lifecycle` | pass |Home +60s screen-sleep boyunca durable progress; force-stop sonrası otomatik restart yok, explicit Resume; deterministic timeout callback |
| `pause-cancel` | pass |Pause/resume, online/offline cancel cleanup, committed final korunması; cleanup pending gerçekten settled |
| `wifi-loss` | pass |Kullanıcının Wi-Fi off/on işlemi, `waiting_wifi/wifi_lost`,1 loss/5 native closure, aynı1GiB transferin devamı |
| `remote-direct` | **inconclusive** |Farklı Wi-Fi uplink'lerinde STUN-only8MiB, `paused/retry_exhausted`; final yok,256MiB direct denenmedi |
| `turn-udp` | pass |8MiB ve256MiB; iki uçta relay selected pair ve UDP relay protocol, doğru hash/receipt |
| `turn-tls443` | pass |8MiB ve256MiB; iki uçta relay/TLS stats; owned receiver'ın seçili Wi-Fi TCP443 established socket gözlemi |
| `transport-resume` | pass |İki ayrı256MiB transferde LAN→TURN UDP ve TURN UDP→LAN; aynı source/revision/transfer, her yönde önceki iki ciphertext kimliği korunur, ACKed reupload0 |
| `backpressure-storage` | pass |1MiB/s slow receiver; test quota ile storage pause/resume; kullanıcı diski doldurulmadı |

Final8MiB source/final SHA256 `cfea75527526299d2a185e41f98cc71829f98366e23998350068904eb9571182`;256MiB `b2399bed92750eca6f74923e06d8c9343e58f1718802ce3d3e21cc245a9b20e2`;1GiB `925e1d8e34e7645f0516b1cd9c61b9eb47c03f98bf396a7ae5ad999d9d9ba4c9`. Bunlar **sentetik fixture** hash'leridir; kullanıcı medya/hash kataloğu değildir. Native app streaming generator kaynağı oluşturdu; fixture payload USB/ADB ile yüklenmedi.

### Ölçümler

`lan-bounds`: Android peak PSS256MiB'de86,401,024byte,1GiB'de83,871,744byte. Desktop sampled RSS15,056,896 ve16,056,320byte. Stage peak97,536,788byte, submitted≤2, preparing≤1. App-buffer16,777,216byte **implementation bound**, allocator-measured peak değil; PSS/RSS sampled'dır. Bu sonuç toplam1TB, gerçek medya export'u, sustained throughput/batarya veya bütün cihazlar için sabit-memory garantisi değildir. Manuel network continuation aralığı için resource-peak iddiası yok.

Wi-Fi-loss koşusunda20 önceki durable ciphertext kimliği korundu; ACKed reupload0 ve authenticated final doğrulandı. Driver'ın beş dakikalık kullanıcı-action deadline'ı önce doldu; owned receiver yeniden açılıp **aynı journal** gerçek kullanıcı eylemiyle devam ettirildi. Bu uninterrupted CLI pass değildir. Cross-transport ilk yönde de deadline ve manuel kontrol aralığı açık tutuldu; reverse direction ayrı transferdi.

## Diagnostic chronology — eski başarısızlıklar silinmedi

- İlk host checkpoint11 Rust behavior test kaydetmişti; sonra12, stale-answer regression eklendikten sonra final **13 pass**, ayrıca parent regression'ın kullandığı1 ignored child-process helper. Bu **17-case Matrix verification** deneyiyle aynı suite değildir. Final Clippy exit0 fakat14 library warning; warning-free lint iddiası yok.
- Android native `Thread::BlockingCall` SIGSEGV gerçekten gözlendi; pinned Chromium relative-vtable ABI flag eşleştirmesi düzeltildikten sonra10 tur physical smoke geçti.
- İlk LAN fixture hard-link publish **EACCES13** verdi; sent/durable0. Android source/ciphertext/receiver publish, API30 libc wrapper'ına bağımlı olmayan atomic `renameat2(RENAME_NOREPLACE)` yoluna taşındı; macOS hard-link yolu korundu. Son transferler gerçekten tamamlandı.
- Source-generation timeout ve offline-cancel-not-reconciled koşuları başarısızdı. Driver görünür Activity kontrolünden önce ekranı uyandırdı; secure lock/ağ/battery ayarları değiştirilmedi. Cancel UI pending cleanup'ı poll etti ve driver gerçek `remoteCleanupPending=false` bekledi.
- Önce remote ICE provisioning ve ayrı ağ önkoşulları eksikti: **blocked prerequisites**, remote pass değil. Kullanıcı kısa ömürlü config sağladı ve ikinci Wi-Fi'nin metered classification'ını düzeltti; gerçek app binding geçtikten sonra native STUN public IPv4 adresleri iki uçta farklı gözlendi. UDP port farkı değil address farkı karşılaştırıldı.
- Wi-Fi-loss önceki action deadline'ları ve düşük hızda durable-part-progress başarısızlığı ayrı tutuldu. Daha sonraki1GiB/1MiB/s koşusu ve gerçek manuel devam sonuçları önceki attempt'leri başarılıya çevirmedi.
- Remote stale answer yanlış session routing ve receiver'ın recoverable handshake loss'ta kapanması ilk TURN koşularını bozdu. Current-session routing ve recoverable connection-loss handling düzeltildi; retired authenticated answer regression'ı current session'ı abort/impersonate edemedi. Source-preserving cancel fence sonrası yalnız retired encrypted signaling metadata quarantine edildi; Android inbox/journal silinmedi.
- Corrected direct8MiB yine tamamlanmadı. **Connectivity/NAT root cause unproven**; başarısız transfer source-preserving cancel edildi, stage temizlendi ve remote cleanup çalışan TURN UDP ile settled oldu. Bu yalnız cleanup sonucu, direct payload pass değil.
- İlk LAN→TURN continuation receiver `rtc_stats` **WOULD_BLOCK** pending durumunu terminal hata saydı. Yalnız pending stats isteği coalesce edildi; CLOSED/INVALID hata kalır, data/auth kontrolleri gevşetilmedi.
- APK upgrade/preflight sonrası diagnostic UI **transfer_identity_mismatch** gösterdi: latest snapshot persisted ID'yi kaybetmişti. Publish eksik ID'yi persisted transferId'den tamamlar, mevcut native ID'yi değiştirmez ve Activity guard gevşetilmez. Son iki cross-transport finali bu düzeltmeleri çalıştırdı.
- Owned receiver/metadata relay sonunda durduruldu ve receiver-test throttle temizlendi. İptal veya temizleme, başarısız payload koşusunu completed yapmaz.

## Motor, sürüm ve fixture sınırları

Tek Rust source/lock Android JNI diagnostic app ve macOS CLI receiver için iki native hedefte derlendi; HTTPS ve WebRTC aynı encryption/journal/receipt/final-commit motorunu kullandı. JS/Kotlin komut/status taşır, payload byte'ı veya ACK USB üzerinden taşınmaz. Test-only run/pair secret ve fixture CA trusted provisioning ile sağlandı; bu production SAS/account/enrollment veya key-management protokolü değildir. USB/ADB **provisioning + sealed authenticated SDP metadata signaling + diagnostic control/evidence export** içindir. ADB forward/reverse, payload/part receipt/final ACK taşıma kabul edilmedi; gerçek remote byte yolu Wi-Fi/TURN idi. USB metadata taşıması USB'siz production signaling kanıtı değildir.

Native WebRTC package: Shiguredo `m156.8078.1.0`, VERSIONS156.8078.1.0, upstream commit `8c12eb54fe9acf73684316880913d677ceccf1cb`; exact Chromium libc++/ABI tüketim sınırı korunur. Android package SHA256 `32e3b7441b11bfc42297bd46b1e03850c4a60198712c0e2e1c0e1ff429d18d3d`; macOS package `9cf2fed7b7c5a42dad77599db9c251fe52bcd9a16f0e1cb3531ed96f78148176` tarihsel plan pins'idir, burada paket binary'leri yeniden hash edilmedi. Motor lock SHA256 `645166578b30525e06bf54f13927acdd03af305023e8c307437de8dc53708b2c`. Final cross-transport APK'nin kayıtlı SHA256'sı `04a09c9c0cf4740c154ba9c7729d521de79bc08bc22a62742ada36258344c32b`; önceki remote-case APK `e9d7730ce88630c0a78feae478f55a2170e6019b33f04ac290e721740631b192`. Bunlar historical checkpoint attestations, bu turda native binary yeniden hash/build edilmedi.

Planın toolchain profili Java17/AGP8.12.0/Kotlin2.1.20/Gradle8.13/NDK27.1.12297006/CMake3.22.1/compile-targetSDK36/experimental minSdk24 idi. Bu plan beyanı final fiziksel API36/arm64 koşusundan ayrı tutulur; bütün toolchain bileşenlerinin burada yeniden runtime doğrulandığı iddia edilmez. Kullanıcının seçtiği **compatibility/support hedefi iOS16.4+ ve Android7+/API24** historical transport-analysis kaydında vardır; APK minSdk24 tek başına ürün minimum-OS onayı veya o minimumda başarı değildir. Release/toolchain compatibility ve minimum platform validation/approval kapıları açıktır.

## Physical-device-required ve production-gate

- iOS minimum/current **physical iPhone**: foreground/cold-background trust, gerçek iki cihaz LAN, suspension/screen lock, force-quit/system termination/reboot ayrı; first-unlock key/file access; redirect, receipt/reconciliation, gerçek temp-copy/residual/disk pressure, source export ve cellular-default-off.
- Android minimum/current, OEM/Doze/job quota; **gerçek six-hour OS quota çalıştırılmadı**. Deterministic callback bunun yerine geçmez. Lifecycle sleep sonucu bütün secure-lock/device durumlarını kanıtlamaz.
- Cellular byte'larının packet-level sıfırlığı, LAN-local packet capture, VPN/guest/client-isolation/IPv6/NAT64/proxy/DPI ve geniş direct-NAT matrisi yok. TURN TLS443 socket observation packet capture değildir.
- Native STUN cancellation host smoke gerçek request+teardown gözledi; fiziksel Wi-Fi-loss cancellation'ın ek kanıtı gibi sunulmaz. Gerçek forcedTURN seçilmiş iki Wi-Fi ağına aittir, evrensel NAT başarı oranı yok.
-100GB/1TB/çok küçük dosya,4GB+ source, credential expiry/renewal, multi-day perf/CPU/energy/thermal/egress ölçümleri, Photos/Files actual bytes, Expo/Electron ürün receiver lifecycle, Windows/Linux packaging ve production pairing/authority/fence hâlâ ayrı kapılar.
- Relay yalnız encrypted byte stream rolündedir; backend control plane dosya/medya katalog deposu değildir. Fixture crypto/wire tasarımı accepted production protocol sayılmaz. Production integration otomatik başlamaz.

## Kaynak envanteri ve arşivsel tekrar üretilebilirlik

Aşağıdaki original public dosyalar salt okunur incelendi ve **2026-10-04'te mevcut byte'ların SHA256'sı hesaplandı**. Source arşivlerinin tam içeriği repo'ya kopyalanmadı; private DB/key/epoch/state veya private endpoint/serial açılmadı/kopyalanmadı. Kaynaklar hâlâ ephemeral `/tmp` kökenlidir; hash kimlik doğrulamak için yeterlidir, dosyayı yeniden oluşturmak için yeterli değildir. **Repo bu self-contained sonuç/sınır kaydını ve sanitized case özeti tutar, tam ham log/xcresult/screenshot/source/binary replay paketini tutmaz.** `/tmp`/dış arşiv kaybolursa sonuçların anlamı burada kalır ama tam byte-for-byte deney tekrar üretimi mevcut arşiv olmadan mümkün değildir; bunu durable raw archive sağlandı diye sunma.

| Public kaynak | İncelenen içerik / hash |
|---|---|
| `/tmp/kloda-android-physical-poc.RORp1P/evidence/report.json` |15 final case,14 pass/1 inconclusive; `6c1f9921f76e3986e30b0198410e42bd5610718a42d3f82832f44882118cba7f` |
| aynı root `checkpoint.json` | Chronology/build/review/gates; `b31de67667696aa45485494a574f1a6e13176b5587128d45529d387c0684595e` |
| aynı root `host-proof.json` | Host-only5 successful transfer observations; `565890567435037c5be32291de141bd586f421af0df5e9f633e3b3945c46dc57` |
| aynı root `kloda-android-poc.tar.gz` | Arşiv byte hash; `d6a228100c2909f89f95d962bf5a224997efdfe151a7fba620f20bfe60f7c5c7` |
| `/tmp/kloda-lan-urlsession-poc.u1orxl/Evidence/report.json` |6 groups/platform/no final/undetermined; `649bdb59663e7d9575e1b8367f4a7e1ce10a5fa20f8ce63359ce54135fb9d0c2` |
| aynı root `Artifacts/kloda-lan-urlsession-poc-source.tgz` | Source archive byte hash; `345cafe91aa88c576bd4df3126a084ae163bf4aa24b85fd19db807082d99753d` |

Ek public kaynaklar: Android `evidence/remote-direct.json` (inconclusive/no256MiB/cancel distinction), `evidence/android-sdk-versions.txt` (vendor version/ABI pins); iOS `Evidence/review.md` (bounded-streaming ve plan-versus-runtime ayrımı). Tarihsel session kaynakları `local://kloda-android-poc-scope-freeze.md`, `local://kloda-android-physical-poc-plan.md`, `local://kloda-lan-urlsession-poc-plan.md`, `local://kloda-transport-analysis-plan.md`, `local://kloda-poc-engine-contract.md`: kapsam, fixture/signaling ve planned-only acceptance bağlamı. Bu linkler **provenance** içindir; hiçbir sonuç/karar yalnız bunlara başvurmayı gerektirmez.

İnceleme sırasında checkpoint'in ara review satırındaki “four remote cases remain open” ifadesi daha sonraki final15-case report tarafından superseded'dır: TURN UDP/TLS443 ve iki cross-transport yönü artık pass; yalnız direct inconclusive. Eski11/12 Rust test sayısı final13'e yükseldi; eski gözlemler yanlış değildi, farklı checkpoint'lerdi. No-op/full-file iOS taslakları acceptance kanıtı değildir. Bu konsolidasyon bu farklılıkları silmeden final durumu ayırır.
