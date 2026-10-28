# Mobil PC-first Stitch uyarlaması — 24 Ekim 2026

28Ekim güncellemesi: Bu belgedeki Stitch uyarlama kayıtları tarihsel kanıttır. Yeni ekranlarda [Lovable tasarımı](../ui/lovable-design-reference.md) bağlayıcı; mevcut native akışlar yeniden yazılmadan ona uyarlanır.

2026-10-28 **Mobil liste10 otomatik/izole kapsam:**108 test/11suite, lint/TS/iki export, tam iOS Simulator app build, Android Kotlin+modül K1 lint geçti. WebDAV probe belirsizliği mevcut profilde kalıcı; native typed disk-full ve safe-area/NativeWind/klavye/büyük-yazı görünümü düzeltildi. Native iOS görsel/256MiB staging örneği ve6 host görsel kontrol kaydedildi; fixture gerçek LAN/PC veya fiziksel kabul değildir. [Kapsam, kanıt, açıklar ve SDK config yan etkisi](mobile-integrated-step10-2026-10-28.md). Büyük koruma kopyasının receiver gecikmesi ölçülmedi; alan/cleanup, gerçek WebDAV sender, iPhone/OS/PC ve tam ekran okuyucu kabulü açık. [Android dar UI followup PASS](mobile-android-step10-followup-2026-10-28.md): normal debugging onayı,480×800 sentetik kaynak/PC/ACK/unknown ve farklı-PID profil/uyarı reopen doğrulandı; fiziksel/LAN kabulü değil. Liste11 başlatılmadı.


## Onaylanan eşleme

Kullanıcı mevcut Stitch renk, kart, tipografi hiyerarşisi ve gezinme dilinin mobil
PC-first mevcut işlevlere uyarlanmasını açıkça onayladı. Yeni Stitch ekranı
beklenmez; kaynak tasarımlar değiştirilmez. Bu karar yeni native authority,
background/provider/identity politikası veya fiziksel kabul onayı değildir.

| Ana akış | Mevcut işlev / sunum |
| --- | --- |
| Files/Photos kaynak seçimi | Mevcut native kaynak seçicileri ve izinler; Files select-all yok. Mevcut PairingButton ile48px hedef; kaydetme başarısızsa aynı adımda hata. |
| Bilgisayara bağlanma | Kaynak→ComputerPage varsayılanı; WebDAV credential/test ön koşulu değil. Warm-stone yüzey, yuvarlatılmış kartlar,680px içerik sınırı ve scroll. |
| QR ve cihaz güveni | Mevcut PairingPage/native status. Complete ancak exact record+fingerprint ve güncel hatasız/repair gerektirmeyen gözlemle gösterilir; error/background/uncertain eski başarıyı güncelmiş gibi korumaz. |
| Ayrı PC dosya izni | PC’de telefonu seçme→ayrı yedek klasörü→açık dosya erişim onayı açıklanır. Telefondan grant veya kendiliğinden onay yok. |
| Aktarım ve kalıcı geçmiş | Mevcut Activity ve sender/journal. Geçerli eşleşmeden sonra açık kullanıcı düğmesi Activity’ye gider; upload kendiliğinden başlamaz. Geçmiş/Activity pairing hatasında da erişilebilir. |
| Gelişmiş WebDAV | ComputerPage’de ayrı seçenek; mevcut test/config akışı korunur. Native PC başarısı değildir. |
| Program ve lifecycle | Saklanan12/24+saat preference otomatik yürütme diye sunulmaz. Mevcut foreground/pause sınırı açıkça belirtilir. |

ComputerPage yalnız local native pairing status okur; native receiver readiness,
çevrimiçi durumu veya dosya grant durumu uydurmaz. Güncel dosya yetkisi/erişimi
transfer sırasında mevcut native sözleşmeyle belirlenir. Başarısız refresh eski
fingerprint/başarı kartını kaldırır; stale/unmount/background yanıtları elenir.
iOS native bridge henüz olmadığından native_unsupported görünür kalır; ortak
UI/Expo iOS export iOS sender tamamlandı anlamına gelmez.

## Doğrulama ve sınırlar

Bu dilimde mobile8 suite/50 test, lint ve TypeScript exit0; iOS/Android Expo
JS export exit0. Ayrı kaynak review engelleyici bulgu bildirmedi.

[Seçilmiş sonuç/hash/görsel kanıt](evidence/mobile-pc-first-2026-10-24/result.json).
Mevcut React Native bileşeni testleri kaynak→PC varsayılanı, advanced WebDAV,
save failure, status refresh failure, stale background yanıtı, repair/eksik complete
kanıtı ve3 dili kapsar. PairingPage continuation için complete/foreground olumlu;
error/uncertain/repair/background/missing IDs/pending olumsuz regresyonlar eklendi.

Host önizleme6 kombinasyon: TR/EN/DE,320/768px; yatay taşma yok ve tüm düğmeler
≥48px. Gerçek RNTL render ağacından DOM yaklaşımıdır; native pixel/font/keyboard/
safe-area/screen-reader kabulü değildir. İkonlar bu adaptörde atlanır, Arial
kullanılır; Inter/native font ve gerçek Dynamic Type kabulü açık kalır. TR/EN/DE
çıktıları görülerek Stitch token/hiyerarşi/kart/boşluk ve metin sarması incelendi.

Native API/receiver/journal/retry/source suppression yeniden yazılmadı. UI-only
dilimde native build/cihaz/emulator/LAN/probe başlatılmadı; Rust clippy gerekli
kapsamda değildi. Önceki retry diliminin kanıtı ayrı kalır. Fiziksel duraklatma,
platform engelleri ve Git add/commit/push/reset/clean/stash yasağı sürer.

## Kalan sıra

İlk teslimde Android ve iOS zorunlu. Android mevcut foreground akışı korunurken
iOS native QR/identity-route adapter ve ortak Rust aktarım köprüsü gerçek eksiktir;
bunu sıradaki çekirdek iş olarak ele al. Android/iOS background/Live/program ve
kalıcı program/source revision ilişkisi, Android suppression/rebackup runtime,
mobile WebDAV atomik kayıt, gerçek platform/a11y/LAN kabulü açık kalır.
Medya E2EE/key lifecycle, account/recovery, remote, Files two-way/conflict/versions,
migration ve galeri kapsamı görünür backlog olarak korunur.
