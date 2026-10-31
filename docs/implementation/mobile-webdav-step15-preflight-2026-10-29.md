# Mobil WebDAV sender —15 hedefli ön değerlendirme /29 Ekim2026

Güncel: [native ara checkpoint ve AVD olayı](mobile-webdav-step15-native-checkpoint-2026-10-29.md). A/ADR0023onaylı; Photos sidecar yanıtı bekleniyor,15tamamlanmadı.

Tarihsel ön değerlendirme durumu: kaynak/karar değerlendirmesi yapıldı; byte sender implementasyonu ve yeni
runtime/test/build yapılmadı.14D1–D3yanıtları [ADR0022](../decisions/0022-advanced-destination-transport-and-credential-custody.md) ile kaydedildi;
onay tekrar istenmiyor.12/13Android runtime/native görsel, horizontal tab hareketi,
VoiceOver/landscape ve bütün fiziksel/platform kapıları korunur.

## Mevcut kaynakta doğrulananlar

- `apps/mobile/src/shared/api/webdav-settings.ts`: tek SecureStorev1profil,
  atomic readback, probe-warning ve past testedAt var. Native background sender'a
  hedef/credential revision yayını henüz yok; profil kaydı gönderim onayı değildir.
- `apps/mobile/src/shared/api/webdav.ts`: HTTPS/no-cookie/no-redirect probe,
  create-only temp+no-overwrite MOVE+readback, belirsiz probe recovery uyarısı var.
  Bu yalnız bağlantı testidir; gerçek source byte sender değildir.
- `apps/mobile/src/features/file-transfer/model/use-file-transfer.ts` içindeki
  `run`: `pairing.status()`→current PCrecordId/peer fingerprint→native fileTransfer.
  Configured WebDAV bağımsız bir hedef türü olarak bu yola katılmaz.
- Android `FilesRun`/`AndroidFilesRunWorker` ve `AndroidSyncJournal`: kalıcı
  PCrecord-bağlı run, immutable Filesjob, early result,5/60retry ve Pause var.
  `FilesRunContext` kaynak/program değişim-away/back revision'ını yakalıyor;
  WebDAVendpoint/account/password-generation bu binding'e dahil değil.
- iOS `IosAutomaticCoordinator.observed` yalnız gerçek complete pairing'den
  PCrecord saklıyor. `IosAutomaticPlan` tek `automatic_plan(id=1)` ve PCrecordId
  ile çalışıyor; `IosFilesRunner`/`IosPhotosRunner` PCprotokol receipt'lerine bağlı.
  WebDAV için sahte bir PCrecord/pair/grant üretmek bu yapıları kullanmak sayılmaz.
- Desktop `runWebDavFiles`/`finalizePendingUpload`: immutable snapshot, kalıcı
  target-scoped pending phase, source+relativepath+revision, no-overwrite
  publication ve exact-byte readback örnekleri mevcut. Unknown write/MOVE cevabı
  otomatik adoption/cleanup değildir (ADR0010). Nodefs/NodeHTTP kodu mobile'da
  çalışır diye etiketlenemez; mevcut sözleşme yeniden kullanılmalı.
- Frozen Lovable `mobile/connections.tsx`, primary/mirror/standby ve hedefine
  özel SyncNow demo yüzeyi içeriyor. Demo mirrored2/kapasite/states gerçek iş veya
  otomatik hedef dağıtımı yetkisi değil. İncelenen ürün/plan belgelerinde PC ile
  WebDAV birlikte ayarlıyken native schedule'ın hedef dağıtımı seçilmemiş.

## Hedef dağıtımı — kullanıcı kararı alındı

PC+WebDAV birlikte configured iken otomatik işler nereye çalışacak? WebDAV
kaydetme/probe başarısı kendiliğinden ek byte gönderme onayı olamaz. D3cihazda
credential saklama yanıtı da hangi hedefe otomatik veri kopyalanacağını seçmez.

|Seçenek|Üründeki somut davranış|Uygulama etkisi|
|---|---|---|
|A — Açıkça etkinleştirilen hedeflerin her biri|Kullanıcı PC/WebDAV için backup hedefini ayrı etkinleştirir. Seçilen her hedef bağımsız kopya, sonuç ve retry alır; erişilemeyen PC WebDAV'ın kendi fırsatını tüketmez. Otomatik gizli failover yok.|Per-target durable context/run/receipt; mevcut schedule/Pause kuralları her hedefte korunur. Demo primary/mirror rollerini gerçek iş olmadan başarıya çevirmez.|
|B — Tek etkin hedef, default PC|Kaydedilmiş bağlantılar arasından kullanıcı bir etkin backup hedefi seçer. Program ve genel SyncNow yalnız ona çalışır; hedef değişimi eski işi güvenle durdurur. Diğer bağlantıya otomatik kopya yok.|Bir etkin targetkind+identity; PC ve WebDAV typed ayrı context. Mevcut tek-target modeline daha yakın, çoklu mirror işi sonradan ayrıca seçilir.|
|C — İlk WebDAV dilimi yalnız explicit manuel|PCotomatik davranışı korunur; WebDAV yalnız kendi SyncNow eylemiyle başlar, durable recovery/retry yine vardır. WebDAV otomatik programı ayrıca açık kalır.|En dar ara teslim; tüm WebDAV otomatik kapsamını kapatmaz. Bu daraltma kullanıcı onayı olmadan seçilmedi.|

Kullanıcı **A** seçeneğini onayladı; [ADR0023](../decisions/0023-explicit-independent-backup-destinations.md) bağlayıcıdır. B/Cseçilmedi. Sender ve bağımsız hedef yürütmesi bu kararla devam eder; WebDAV kaydetmek tek başına opt-in değildir.

## Değişikliğin ulaşacağı yerler / en küçük doğrulama yolu

Seçimden sonra yalnız gereken native target+credential binding/journal/run/
retry, mevcut source snapshot/Photos hazırlığı, native WebDAV I/O, köprü/API,
hedefe özel UI+Activity+restore ve TR/EN/DE metin/fixture'ları güncellenecek.
PCauthority/QR/grant kanalı değiştirilmez. Credential değişikliği native işte
safe-stop ve eski ACK'i koruma gerektirir; testedAt current success sayılmaz.

Önce tek Fileskaynağı+tek disposable HTTPSDAVhedefi: snapshot/hash→durable
intent→conditional temp→no-overwrite publication ACK→exact final-byte readback→
receipt. Ardından yalnız etkilenmiş kesinti/kayıpPUT/MOVEcevabı/context-away-back/
foreign-final/restart/retry/Pause/restore no-overwrite yolları; Photos/OS fırsatı
kendi gerekli dar kontrolleriyle genişletilir. Mevcut Desktop fixture mekanizması
ve mobile journals kullanılır; yeni genel scheduler/SDK eklenmez.

Bu tur read-only kaynak keşfi + karar belgeleri. SerenaKloda/TypeScriptLSPetkinliği
ve sembol/referans araçları doğrulandı; Swift/Kotlin hedefli satır okumalarıyla
incelendi. Aynı ana ajan ayrı belge/kaynak review'u yaptı; bağımsız review değil.
Kişisel arşiv, native key/pin/cert/epoch/ACL, kullanıcı servisi veya Git durumu
üzerinde işlem yok. Git add/commit/push/reset/clean/stash yok; mevcut değişiklikler/13kanıtları korunur.
