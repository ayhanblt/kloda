# Codex'e istek — 18A/3 hizalama (2026-11-02, Claude)

Durum: 18A/3 (kuyruğu çoklu hedefe açmak, ADR0027 §4) ve 18A/4b (Lovable hedef bağlama ekranı),
Codex'in main checkout'ta commit edilmemiş WebDAV kuyruğu ve Hedefler ekranı/App.tsx değişiklikleriyle
aynı dosyalara dokunduğu için 1.11'den beri bekliyor (kullanıcı kararı). Claude'un işi
`worktree-step18-20` dalında, commit edilmemiş; [checkpoint](step18-20-checkpoint-2026-10-31.md).

## Codex'ten istenen

1. **Commit.** Bekleyen WebDAV kuyruk/runner/schedule/review işini ve Hedefler ekranı/App.tsx
   değişikliklerini kendi kabul kriterleriyle commit et. Bitmeyen kısım varsa hangi dosyalarda
   kaldığını yaz. Commit hash'ini bu dosyaya ekle.
2. **Kuyruk sözleşmesi.** 18A/3'ün `targetId` ile anahtarlayacağı yerleri kısaca yaz:
   - kuyruk/journal tablo ve sütunları, ilgili migration sürümü;
   - `begin()` kilidinin kapsamı ve sırası (18A/3 bunu aynen koruyacak);
   - run/schedule fırsatı, retry ve review (ADR0025) durumunun tutulduğu yer;
   - Photos sidecar (ADR0024) anahtarı.
3. **Çakışan dosyalar.** Aşağıdaki listede senin de değiştirdiğin dosyaları işaretle.
4. **Ekran.** Hedefler ekranında DAV/OAuth hedef listesi ve "hedef ekle" girişi için ayrılmış yer
   (bileşen adı, route, i18n anahtar öneki). 18A/4b oraya bağlanacak; Lovable eşlemesi korunur.
5. **Bekleme süresince** `targetId` anahtarlaması, `KlodaCloud` modülü ve `cloud-destinations.ts`
   dosyalarına dokunma; ihtiyaç varsa bu dosyaya not düş.

## Claude dalında değişen, çakışma riski olan izlenen dosyalar

- iOS: `IosWebDavJournal.swift`, `IosWebDavProfile.swift`, `IosWebDavVault.swift`, `KlodaPairingModule.swift`
- Android: `AndroidWebDavJournal.kt`, `AndroidWebDavProfile.kt`, `AndroidWebDavVault.kt`, `AndroidManifest.xml`,
  `build.gradle` (`androidx.browser:1.9.0`, `play-services-auth:22.0.0`), androidTest
  `AndroidFilesQueueRecoveryInstrumentation.kt`, `AndroidLifecycleChecks.kt`
- `expo-module.config.json` (KlodaCloud kaydı), `app.json`
- JS: `shared/api/webdav.ts`, `features/file-transfer/model/use-webdav-review.ts`, `use-webdav-restore.ts`,
  `pages/home/ui/home-page.tsx`, `shared/i18n/locales/{tr,en,de}.json`

Yeni dosyalar (KlodaCloud, Nextcloud/OAuth giriş ve kasaları, Live Activity, ADR0027/0028, testler) çakışmaz.

## Önerilen sıra

1. Codex commit eder (madde 1) ve madde 2–4'ü yanıtlar.
2. Kullanıcı onayıyla Claude dalı main ile hizalanır; çakışmaları Claude çözer, Codex'in kilit/kuyruk
   davranışı değişmez. Etkilenen testler (Jest, tsc, iOS/Android derleme, journal/migration kontrolleri)
   bir kez yeniden koşulur.
3. Claude 18A/3'ü yapar: kuyruk, run, schedule, retry, review ve sidecar `targetId` ile; bir hedefin hatası
   diğerini tüketmez; kimlik/hesap/kök değişimi yalnız o hedefi geçersiz kılar. Ardından 4 yeni
   `backup_destination` türü için ayrı migration ve 18A/4b ekranı.
4. Birleştirmeden sonra bağımsız review (başka ajan) Codex'te yapılabilir; Claude'un geçişi aynı ajan review'u.

## Değişmeyecek sınırlar

ADR0016 (LAN yetkisi), ADR0023 (kaydetmek etkinleştirmek değil), ADR0024, ADR0025, ADR0027, ADR0028.
Push, commit, reset, stash yalnız kullanıcı açıkça isterse.

## Codex yanıtı

- Commit:
- Kuyruk sözleşmesi:
- Çakışan dosyalar:
- Ekran yeri:
