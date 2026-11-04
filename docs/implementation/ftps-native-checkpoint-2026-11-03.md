# 16c FTPS — uygulama ve izole kabul kapanışı /03.11.2026

Main HEAD `67701e7895ca9d7d5d7efe66d23b09954a8bf690`; origin/main `50ae92e`. Fast-forward tamamlandı. FTPS değişiklikleri commit edilmedi/push edilmedi. Önceden staged `apps/mobile/.expo/dev/logs/start.log` silmesi ve Claude worktree alanı korundu.17 başlamadı.

## Sonuç

16c uygulama ve kullanıcıca onaylanan izole kabul kapsamı tamamlandı; varsayılan kapalı. [Tek manifest](evidence/ftps-native-step16c-2026-11-03/manifest.json), [iOS owned runtime](evidence/ftps-native-step16c-2026-11-03/ios-owned-runtime.json), [Android runtime](evidence/ftps-native-step16c-2026-11-03/android-sources-final.log), [Photos cleanup](evidence/ftps-native-step16c-2026-11-03/android-photos-cleanup.json), [UI](evidence/ftps-native-step16c-2026-11-03/ui-check.json).

ADR0022 son FTPS kararı: özel sunucu eklentisi yok. Var olan ad pratik listing kontrolüyle reddedilir/yeni ad seçilir; transfer ACK ve yeni tam boyut/SHA256 readback doğrulanır. Eşzamanlı yazara karşı atomik no-overwrite veya elektrik kesintisinde kalıcılık garantisi verilmez. Belirsiz sonuç review’da kalır; kör retry/hash-only adoption yok. AUTH TLS/PROT P/tam sertifika+hostname/LAN/source/profile/native custody kontrolleri korunur.

Exact suppaftp12.2.1/rustls-ring ve public webpki-roots1.0.11; consuming-FD C/JNI, aynı peer için native data-socket callback,3 aşamalı journal; ayrı Android/iOS vault/Files/Photos/own restore/queue/schedule/OS ve TR/EN/DE form+katalog+review bağlantısı tamam. Ortak backup_destination migration’ı yok. Opt-in bayrakları varsayılan false. Üretim paketleyici owned-fixture trust marker’ını reddeder.

## Geçen yeni kontroller

- Host pratik yayın/negatifler/lost-ACK, C ABI/FD tüketimi, tek yeni deterministik iOS control-lease/data-port/invalidation kontrolü; Clippy/format.
- Yeni3 Jest suite/7 test + yalnız yeni FTPS App route testi; TS/scoped lint; Swift source/restore reopen ve Photos metadata/retry/CAS sözleşmeleri.
- Android4ABI/16KB ve iOS arm64 device+Simulator public-root paketleri. Son Android FTPS açık arm64 app ve instrumentation build; son generated BG config/all-native-flags iOS app build PASS. Xcode simulator Keychain yetkili varyantta native FTPS status ve form PASS.
- Android owned Files/JNI, Keystore/profile, SAF/reuse/collision/review/queue/source revoke/own restore/ledger reopen/recovery, Photos codec, gerçek product factory/service ve JobScheduler Files grupları PASS.
- Android exact68-byte Photos seed/yayın/download/import/tekrar/yeni restore-owner/unknown-intent kontrolleri PASS. İzin geri alımı sonrası Android süreci `permissions revoked` nedeniyle kapattı; body PASS kaydı, exact2URI post-delete boş ve READ_MEDIA izinleri false ayrıca doğrulandı. Medya yeniden oluşturulmadı. Ayrı süreç Photos reopen iddiası yalnız iOS içindir.
- iOS gerçek Files picker+4097-byte publish/readback/restore/tekrar/ayrı süreç reopen PASS. Exact Photos1resource+1manifest/tekrar/no duplicate/ayrı süreç reopen PASS; yalnız kimlik+üyelik+byte doğrulanmış2asset+2album temizliği PASS.
- TR/EN/DE canlı native FTPS formu, maskeli sentetik parola/klavye kontrolü PASS. En büyük yazıda etiketler ve secure-field odak incelendi; mevcut ortak alt menü taşması genel12/20’de açık, tam a11y kabulü sayılmaz.

Android fixture hatası teşhis edildi: emulator Wi-Fi link hızı değişikliği mevcut route generation’ını değiştiriyordu. Yalnız owned AVD RSSI poll geçici sabitlendi, sonunda3000ms geri alındı. Çoklu FTPS TLS oturumları için yalnız fixture completion wait180s oldu; ürün5s wire timeout/native fence değişmedi. Eski kopyadan kalan test Job ID beklentisi2710/2711’e düzeltildi. Başarılı eski testler tekrarlanmadı; başarısız/henüz kapsanmayan kapsamlar sürdürüldü. Son Android paketi JNI’nin eşdeğer Clippy düzeltmesiyle yeniden üretildi; iOS’ta bu Android-only değişikliğin ABI etkisi yok.

## Temizlik ve review

Yalnız `KlodaFtps16c/emulator-5584` ve `Kloda-Ftps16c-Disposable/61A45399-D0F9-43C0-B356-E1EF6712E960` kullanıldı. Exact owned medya, test Keychain/TCC/geçici parola girdileri temiz; loopback sunucu kapalı, CA/server özel anahtarları yok. Android geçici portlar/RSSI/adbd ve iOS yazı boyutu geri alındı, iki owned cihaz kapalı; Cloud18 cihazlarına dokunulmadı. Test archive ve yerel makbuzlar kanıt için korundu. Sistem güven deposu değişmedi.

Ayrı aynı-agent review: wire FD/TLS/path/publication; native journal/custody/route/source/profile admission; exported module/pause/lifecycle çağıranları ve opt-in/fixture paket ayrımı incelendi. Yeni açık engelleyici bulgu kalmadı. Bu, bağımsız Claude review değildir.

## Açık genel kapılar

Gerçek public-CA/gerçek LAN FTPS sunucusu yok; özel test CA’sı+sinyetik iOS loopback route gerçek LAN kabulü değildir. Physical21/release signing/gerçek iOS OS delivery/provider/lock/storage/ağ çeşitleri, genel12/20 tam capture/reader/büyük-yazı navigasyon/perf/pil/alan ve en sondaki bağımsız Claude review açık. Bunlar kapanmış veya ürün genel aktivasyonu verilmiş sayılmaz.

Yeni sohbet başlangıcı: `AGENTS.md → docs/implementation/CURRENT.md → docs/implementation/ftps-native-checkpoint-2026-11-03.md oku. Gerçek HEAD/dirty durumu kontrol et;16c uygulama/izole kabul kapanışını ve açık genel kapıları koru. Başarılı testleri/Photos fixture’ını tekrarlama.17 veya bağımsız review için kullanıcının yeni görev kapsamından ilerle; commit/push yapma.`
