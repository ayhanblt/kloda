# ADR0029 bekleyen UI — TR/EN/DE metin taslağı (4.11, ONAY BEKLİYOR)

Kapsam: checkpoint "Sıradaki" 10. madde. Mevcut `recovery.*` anahtarları ve `RecoveryCodePanel` yeniden kullanılır;
native/JS API değişmez (`renew`, `status`, `importCatalog`). Lovable eşlemesi: `MobilePanel` + `PairingButton` +
mevcut grup giriş alanı stili; Lucide `RefreshCw` (yenile), `KeyRound` (kod girişi), `TriangleAlert` (doğrulanamadı).

## A. Yenileme (Ayarlar → Bulut yedekleri için kurtarma kodu, onaylı kodun altında)

| Anahtar | TR | EN | DE |
|---|---|---|---|
| `recovery.renew` | Yeni kod oluştur | Create a new code | Neuen Code erstellen |
| `recovery.renewTitle` | Yeni kurtarma kodu oluşturulsun mu? | Create a new recovery code? | Neuen Wiederherstellungscode erstellen? |
| `recovery.renewBody` | Yeni kodu onaylayana kadar mevcut kodun geçerli kalır. Onayladıktan sonra bu telefondaki tüm bulut yedekleri, her hedefin bir sonraki yedeklemesinde yeni kodla yeniden kaydedilir. | Your current code stays valid until you confirm the new one. After that, every cloud backup on this phone is recorded again under the new code on each destination's next backup. | Dein aktueller Code bleibt gültig, bis du den neuen bestätigst. Danach werden alle Cloud-Sicherungen dieses Telefons bei der nächsten Sicherung jedes Ziels unter dem neuen Code neu erfasst. |
| `recovery.renewLimit` | Eski kodla yazılmış kayıtlar bulutta kalır; eski kodu bilen biri, hedefe erişimi varsa yenilemeden önceki yedekleri hâlâ geri yükleyebilir. | Records written with the old code stay in the cloud; anyone who knows the old code and can access the destination can still restore backups made before the renewal. | Mit dem alten Code geschriebene Einträge bleiben in der Cloud; wer den alten Code kennt und Zugriff auf das Ziel hat, kann Sicherungen von vor der Erneuerung weiterhin wiederherstellen. |
| `recovery.renewPromptReason` | Yeni kurtarma kodunu görmek için telefonunun kilidini aç. | Unlock your phone to see your new recovery code. | Entsperre dein Telefon, um deinen neuen Wiederherstellungscode zu sehen. |
| `recovery.renewTitleShown` | Yeni kurtarma kodun | Your new recovery code | Dein neuer Wiederherstellungscode |
| `recovery.renewConfirm` | Yeni kodu onayla | Confirm new code | Neuen Code bestätigen |
| `recovery.renewCancel` | Vazgeç, eski kodu koru | Cancel, keep the old code | Abbrechen, alten Code behalten |
| `recovery.renewDone` | Yeni kod etkin. Eski kodu artık saklaman gerekmez. | The new code is active. You no longer need to keep the old one. | Der neue Code ist aktiv. Den alten musst du nicht mehr aufbewahren. |

Akış: `renew` → Alert (`renewTitle`, `renewBody` + `renewLimit`, `ui.conn.cancel` / `recovery.renew`) → kilit istemi →
panel yeni kodla, onay düğmesi `renewConfirm`; `renewCancel` = gizle (bekleyen sır kalır, eski kod geçerli).

## B. 29/1 öncesi etkin hedefler (durum `none` + en az bir etkin bulut hedefi)

Bağlantılar listesinin üstünde ve Ayarlar kurtarma sayfasında (`coversNone` yerine) aynı panel.

| Anahtar | TR | EN | DE |
|---|---|---|---|
| `recovery.legacyTitle` | Bulut yedeklerin henüz korunmuyor | Your cloud backups aren't protected yet | Deine Cloud-Sicherungen sind noch nicht geschützt |
| `recovery.legacyBody` | Bu hedefler kurtarma kodundan önce etkinleştirildi. Kod oluşturmazsan telefonunu kaybettiğinde bu yedekleri yeni bir cihazda Kloda ile geri yükleyemezsin. Yedekleme bu arada devam eder. | These destinations were enabled before recovery codes existed. Without a code, you can't restore these backups with Kloda on a new device if you lose this phone. Backups continue in the meantime. | Diese Ziele wurden vor Einführung der Wiederherstellungscodes aktiviert. Ohne Code kannst du diese Sicherungen bei Verlust des Telefons nicht mit Kloda auf einem neuen Gerät wiederherstellen. Die Sicherung läuft in der Zwischenzeit weiter. |
| `recovery.legacyAction` | Kurtarma kodu oluştur | Create recovery code | Wiederherstellungscode erstellen |
| `recovery.confirmOnly` | Onayla | Confirm | Bestätigen |

Panel açılınca mevcut `RecoveryCodePanel` (onay düğmesi `confirmOnly`; hedef zaten etkin, yeniden etkinleştirme yok).

## C. Yeni cihazda kod girişi (bulut kartında, hedef eklendikten sonra; etkin olması gerekmez)

| Anahtar | TR | EN | DE |
|---|---|---|---|
| `recovery.importEntry` | Eski telefonun yedeklerini getir | Bring in your old phone's backups | Sicherungen deines alten Telefons übernehmen |
| `recovery.importTitle` | Eski telefonun kurtarma kodunu gir | Enter your old phone's recovery code | Gib den Wiederherstellungscode deines alten Telefons ein |
| `recovery.importBody` | Kloda bu hedefte eski telefonun yedek kayıtlarını kodla doğrular. Doğrulanan yedekleri "Yedekleri gör" altında geri yükleyebilirsin. Kod bu telefonda saklanmaz. | Kloda uses the code to verify your old phone's backup records on this destination. You can restore verified backups under "View backups". The code is not stored on this phone. | Kloda prüft mit dem Code die Sicherungseinträge deines alten Telefons auf diesem Ziel. Bestätigte Sicherungen kannst du unter „Backups anzeigen" wiederherstellen. Der Code wird auf diesem Telefon nicht gespeichert. |
| `recovery.importField` | Kurtarma kodu | Recovery code | Wiederherstellungscode |
| `recovery.importHint` | Büyük/küçük harf, boşluk ve tire fark etmez. | Upper or lower case, spaces and hyphens don't matter. | Groß-/Kleinschreibung, Leerzeichen und Bindestriche spielen keine Rolle. |
| `recovery.importSubmit` | Doğrula ve getir | Verify and bring in | Prüfen und übernehmen |
| `recovery.importWorking` | Yedek kayıtları doğrulanıyor… | Verifying backup records… | Sicherungseinträge werden geprüft… |
| `recovery.importDone` | {{count}} dosya geri yüklemeye hazır. | {{count}} files ready to restore. | {{count}} Dateien bereit zur Wiederherstellung. |
| `recovery.importNone` | Bu kodla bu hedefte yedek kaydı bulunamadı. Doğru hedefi ve kodu seçtiğini kontrol et. | No backup records for this code were found on this destination. Check that you chose the right destination and code. | Für diesen Code wurden auf diesem Ziel keine Sicherungseinträge gefunden. Prüfe, ob Ziel und Code stimmen. |
| `transfer.errors.recovery_code_invalid` | Bu kurtarma kodu geçerli değil. Yazım hatası olabilir; tüm grupları kontrol et. | This recovery code isn't valid. There may be a typo; check every group. | Dieser Wiederherstellungscode ist ungültig. Vielleicht ein Tippfehler; prüfe alle Gruppen. |

`importDone` i18next çoğul (`_one`/`_other`); TR tek biçim. Sayı = `imported` (dosya fişi sayısı). `importNone` = `chains == 0`.

## D. Doğrulanamayan delta bildirimi (`unverified > 0`, içe aktarma sonucunun altında)

| Anahtar | TR | EN | DE |
|---|---|---|---|
| `recovery.unverifiedTitle` | Bazı yedekler doğrulanamadı | Some backups could not be verified | Einige Sicherungen konnten nicht geprüft werden |
| `recovery.unverifiedBody` | Bulutta bazı yedek kayıtları eksik ya da değiştirilmiş. Bunlardaki dosyalar Kloda ile geri yüklenemez; dosyalar sağlayıcıda durmaya devam eder. Doğrulanan yedekler etkilenmez. | Some backup records in the cloud are missing or were changed. Files in them can't be restored with Kloda; they remain with the provider. Verified backups are not affected. | Einige Sicherungseinträge in der Cloud fehlen oder wurden verändert. Die Dateien darin lassen sich nicht mit Kloda wiederherstellen; sie bleiben beim Anbieter. Bestätigte Sicherungen sind nicht betroffen. |

Sayı gösterilmez (`unverified` delta sayısıdır, dosya sayısı değil).

## Doğrulama yolu (onaydan sonra)

Jest (yeni hook + sayfa durumları: none+etkin, renew bekleyen, import sonuç/hata/unverified), tsc, ESLint (300 satır);
bir iOS arm64 Simulator + bir Android toplu TR yakalaması. 29/2–29/4 native testleri tekrarlanmaz (native değişmez).

## 29/5 ek — "Yedekleri gör" giriş metni (`destinations.restore.hint`, kullanıcı 4.11 "Onaylıyorum", uygulandı)

Mevcut metin yalnız bu cihazın fişlerini anlatıyor; 29/4'ten beri içe aktarılmış fişler de aynı listede. İkinci cümle
anlam olarak aynı kalır (TR'de "Restore" → "Geri yükleme", onaylı içe aktarma metniyle uyum için).

| Dil | Öneri |
| --- | --- |
| TR | Bu cihazın tamamlanmış yedekleri ve eski telefonun kurtarma koduyla doğrulanan yedekler listelenir. Geri yükleme, uzaktaki byte’ları yeniden doğrular ve seçtiğiniz klasörde mevcut dosyanın üzerine yazmaz. |
| EN | Lists this device’s completed backups and backups verified with your old phone’s recovery code. Restore verifies remote bytes again and preserves existing files in the folder you choose. |
| DE | Aufgelistet werden abgeschlossene Sicherungen dieses Geräts und Sicherungen, die mit dem Wiederherstellungscode deines alten Telefons bestätigt wurden. Wiederherstellen prüft entfernte Bytes erneut und erhält vorhandene Dateien im gewählten Ordner. |
