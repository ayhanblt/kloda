# 2.1/G1 — hedefli kaynak ve kanıt incelemesi / 16.11.2026

Bu ek araştırmadır; tek goal, kabul ID'leri ve durum tablosu
[next-plan §2.1/G1](next-plan.md#21g1--mobil-etkinlik-uygulama-sözleşmesi-taslağı--16112026)
içindedir. Uygulama yetkisi değildir. Ana ajan GPT; dış araştırma NOT_NEEDED:
soru üçüncü taraf API sözdizimi değil, repository'nin mevcut native veri sözleşmesidir.
research-pilot.md okundu; yapay dış soru/subagent/model değişimi üretilmedi.

## 1. Doğrulanmış mevcut yol

İnceleme HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`; dirty tree korundu.
`git diff --name-only HEAD -- apps/mobile/src apps/mobile/modules/my-module/ios`
ve AndroidFilesQueue/AndroidSyncJournal hedefleri boş: bu alanlarda bekleyen ürün diff'i yok.
F1 Android job/scheduler/test diff'i; 1.5 harness/notices/kanıt diff'i ayrı ve dokunulmadı.
Önceki native/JS PASS'leri HEAD'e otomatik eşit sayılmadı.

| Kaynak / sembol | Doğrulanmış sonuç |
|---|---|
| `apps/mobile/src/pages/activity/ui/activity-page.tsx:21–26,100–120` — ActivityPage | Tek scroll; `useFileTransfer().queue.jobs` doğrudan çiziliyor. `view=backups`, embedded ve target aynı bileşeni kullanıyor. |
| `apps/mobile/src/features/file-transfer/model/use-file-transfer.ts:26–67` — read/effect | Foreground'da saniyelik status + photoStatus; mounted/foreground/epoch ile geç yanıt elenir. Ayrılırken upload pause değil cancelRestore çağrılır. |
| `apps/mobile/src/shared/api/file-transfer.ts:85–116,216–224` | queueStatus → strict parser; job state/ACK/size/ID/count/hasMore doğrulanır. En fazla 100 kayıt; tarih, cursor veya geçmiş filtresi yok. |
| Android `KlodaPairingModule.kt:61` → `AndroidFilesQueue.status:53–64` | Automatic durum eklenir; Files journal + Photos publication tombstone listesi birleştirilip tekrar 100'e kesilir. |
| Android `AndroidSyncJournal.kt:204–220` | Tüm job sayısı; non-completed önce, completed için ters rowid; owner_deleted overlay; worker yokken transient state paused sunulur. |
| Android `AndroidPhotoManifestJournal.kt:141–148` | publication status yalnız owner_deleted kayıtlarıdır; bütün başarılı Photos publication geçmişi değildir. |
| iOS `KlodaPairingModule.swift:158–162` → `IosFilesQueue.status:41–60` | filesJobs().prefix(100), latest run + automatic/notification metadata. İlk idle okumada mevcut recovery çalışır. |
| iOS `IosFilesJournal.swift:5–18,41–43` | files_job'da tarih yok; `ORDER BY id`. Bu rastgele ID sırası kronoloji değildir. |
| iOS `IosFilesRunJournal.swift:28–34,50–68` | latest run rowid ile seçilir; run listesi/tarih alanı yok. retryAt aktarım zamanı değildir. |

K = `apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync/`;
S = `apps/mobile/modules/my-module/ios/`; üstteki native dosyalar bu dizinlerdedir.
queueStatus zaten tamamen yan-etkisiz değildir: Android runs.invalidate, iOS idle recovery
mevcut davranışıdır. G1 bunları değiştirmeyecek; yeni sekme bunlara ek okuma başlatmayacak.
CompletedBackups/listBackups uzak mevcut yedek kataloğudur, aktarım olay geçmişi değildir;
geçmiş sekmesi için onu çağırmak ağ/yetki/restore kapsamını gereksiz genişletir.
Photos kaynak metadata tarihi de aktarım tarihi yerine kullanılamaz.

## 2. Etkilenen çağıranlar ve görsel sözleşme

- `useFileTransfer` ayrıca `pages/home/model/use-home-status.ts:10–28` tarafından
  kullanılır; ortak queue'yu UI için filtrelemek Home sayımlarını/durumunu bozar.
- `widgets/own-backups/own-backups.tsx` hook'un restore/list/cancel yüzünü tüketir.
  `backups-page.spec.tsx` embedded/target başlığı, geri dönüş ve upload satırı
  izolasyonunu; activity-destinations/automatic spec'leri hedef fan-out ve pause'u kapsar.
- SMB/SFTP/FTPS issue panellerinin hook cleanup'ları request cancel eder
  (ör. `use-ftps-items.ts:11–24`). Sekmede unmount/remount, yalnız sunum değişimi değildir.
  Öneride bu paneller Şu an ağacında mounted kalır, Geçmiş'te `hidden` ile gizlenir;
  görünmez içerik accessibility ağacına/focus'a sızmamalıdır.
- Dondurulmuş `docs/ui/lovable-reference/c144e98938da/source/src/views/mobile/activity.tsx.reference`
  :17–37 segment + all/done/issues; :107–140 tarih grupları, saat ve özetler gösterir.
  Demo store, örnek saat/sayaç/hedef adları veri kanıtı değildir.
- Tam eşleme için native'de yeni event/timestamp/retention ve provider birleşimi gerekir.
  Bunun legacy bilinmeyen tarihler, tamamlanma tanımı ve migration tasarımı çözülmüş değildir.
  Sadece iki sekme eklemek bu eksikleri kapatmaz; taslak açık kapsam kararı bekler.

## 3. Eski kanıt ↔ mevcut kaynak/diff eşlemesi

Yeni test/fixture önermeden manifestler okundu; SHA256 ham ve CRLF→LF karşılaştırıldı.
EOL farkı semantik değişiklik veya tekrar gerekçesi sayılmadı. Bu incelemede test/build yok.

| Kanıt | Sonuç / yeniden kullanım sınırı / tekrar gerekçesi |
|---|---|
| `evidence/android-runtime-2026-10-26/result.json`, README | Önceki 11 grup + farklı PID reopen PASS. PhotoManifestPublisher, PhotoManifestJournal, FilesTransfer LF hash'leri birebir aynı. ACK/tombstone/retained journal davranışının bu sınırlı kanıtı REUSE; güncel tüm Queue/Expo zinciri PASS denmez. Salt sunum önerisi bu kodu değiştirmez; tam native suite tekrarı gerekmez. |
| `evidence/ios-files-2026-10-27/source-sha256.json`, result/README | IosFilesJournal LF `f2b9c650…`, FilesRunJournal `9bbd343c…` aynı. Önceki journal/run retention/recovery kanıtı ilgili değişmeyen yollar için REUSE. Fixture28'in tamamını bugünkü bütün uygulama PASS'i sayma. |
| Aynı iOS kaynak listesi: IosFilesQueue | Eski `50d66a05…` → mevcut LF `7c7cc5f3…`; DEĞİŞİKLİKTEN ETKİLENMİŞ. Bugünkü queueStatus/automatic/notification bileşimi için 27.10 build/runtime taze kanıt değildir. G1 native-free önerisi ayrıca Swift değişikliği gerektirmez. |
| Aynı iOS kaynak listesi: ActivityPage / hook / parser / spec'ler | Hepsi CHANGED; aşağıda tam mevcut LF hash'leri. Eski 65/8 JS PASS bugünkü UI için yeterli değil. Yeni segment sınıflaması, truncation/empty ve görünürlük değişimi somut dar JS tekrar gerekçesidir. |
| `evidence/cloud18-nextcloud-2026-10-31/destination-texts-2026-11-03.json` | Önceki Jest218/tsc/ESLint + Android/iOS hedefe bağlı Backups görsel PASS. Eski hedef/restore kanıtı REUSE; yeni segment burada yok. Ortak ActivityPage değişeceği için mevcut backups spec'i dar etkilenen-caller kontrolüdür; gerçek provider aktarımı tekrar gerekmez. |
| `evidence/jest-1.2-2026-11-11/manifest.json` | S3 diagnostic AppState test onarımı PASS; dinleyicileri toplama/remove örüntüsü REUSE. G1 ürün veya gerçek native journal UI kanıtı DEĞİLDİR; S3 testini sırf yeni sohbet diye yeniden koşma. |
| `claude-review-2026-11-11.md:38–40` | G1 eksikliği ve gerçek journal gereği doğrulanmış finding; tamamlanma kanıtı yok. |
| Yeni sekme/filter + gerçek journal'dan bu yeni görünüm | EKSİK. Mock UI testleri journal'ın OS kalıcılığını ispatlamaz; journal kanıtıyla sunum kanıtı ayrı raporlanır. B1 JS→native runtime ve tam native entegrasyon Faz3 kapısı olarak açık kalır; G1 bahanesiyle yeni fiziksel/fixture koşusu açılmaz. |

Mevcut LF hash'leri (tam değer, 16.11 salt-okunur karşılaştırma):

| Dosya | SHA256 |
|---|---|
| `src/pages/activity/ui/activity-page.tsx` | `1ecfb2257bd8620f2b617eda935684140b339f037d332fc63422fc55a823e558` |
| `src/pages/activity/ui/activity-page.spec.tsx` | `811c2d3b2b6e2378a311d3b919c6aebc0495cd55951d874a5752f0c03628c568` |
| `src/features/file-transfer/model/use-file-transfer.ts` | `4986350a7994d73260056ab450a0f4a08b294371756eca0a09d3d8f7db096acf` |
| `src/shared/api/file-transfer.ts` | `42d049dbba1b51da3e9375ce780e97663d8351e2789bb4c1f3a851d792a66058` |
| `src/shared/api/file-transfer.spec.ts` | `cdee1208ae2b7fd9e042e28fc9af13809bb198bf4a6935cc942b7361640039aa` |

`src/` üstte `apps/mobile/src/` anlamındadır. Android eski kayıt HEAD'i `34dcbb8…`;
hedefli `git diff --stat` Queue/SyncJournal/Activity/hook'un aradan beri değiştiğini
doğruladı. Hash'i eşit alt dosyadan bütün çağıranlara PASS taşınmadı.
Mevcut test dosyası veya eski dış fixture'ın taşınmamış olması tekrar nedeni değildir.
F1 FO1 ertelemesi, 1.5 H15/P15 ve release/fiziksel kapıları aynen korunur.

## 4. Windows / Mac ve karar sınırı

Önerilen JS-only yol için Windows: selector/UI/i18n, etkilenen Jest, tsc, scoped
ESLint ve iOS/Android JS export. Export native derleme değildir.
Mac: iOS native kaynak değişirse Swift compile + Simulator build/runtime zorunlu;
bu seçenek mevcut taslağın yetkisi değildir. iOS native/a11y görsel capture Windows
Jest'le karşılanamaz; mevcut Faz3/4 kapısı, script eksikliği ve fiziksel sınırlar korunur.
Yeni araç/SDK/fixture kurulumu veya tam regresyon bu incelemede önerilmedi/çalıştırılmadı.
Gerekirse yalnız mevcut izinli ortam ve komut kanıtı devralınır; runnable capture komutu uydurulmaz.
Tek karar: sözleşmedeki D-G1 kapsam uyarlaması; yalnız onaydan sonra uygulama devri.
