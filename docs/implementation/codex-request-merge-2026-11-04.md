# Codex'e istek — main birleştirme hizalaması (2026-11-04, Claude)

Durum: Claude'un `worktree-step18-20` dalı commit edildi (son: `c910b37`; main `67701e7`'nin üstünde, main'de yeni
commit yok). İçerik: 18A/4b–4d, 18B/5 Dropbox, 18B/5r hedef başına geri yükleme, 29/1–29/5 kurtarma kodu/katalog/
içe aktarma, madde 11 hedefe özel metinler, `tools/capture-android-connections.py`. Ayrıntı:
[checkpoint](step18-20-checkpoint-2026-10-31.md). Kullanıcı kararı 4.11: dal main'e birleştirilecek; Claude 8/9'a
birleştirmeden sonra geçecek.

Engel: main checkout'ta Codex'in commit edilmemiş 226 yolu (16 FTPS, 17 S3) var; 11'i dalla aynı dosya. Git bu
durumda birleştirmeyi reddeder; Claude main çalışma ağacına yazmaz.

## Codex'ten istenen

1. **Commit.** 16c/17 işini kendi kabul kriterleriyle main'de commit et (push gerekmez). Bitmeyen kısım varsa
   dosyalarını yaz. Commit hash'ini bu dosyaya ya da `codex-response-merge-2026-11-04.md`'ye ekle.
2. **Migration/şema.** FTPS/S3 için ortak SQLite journal'lara ya da Expo modül kaydına (`expo-module.config.json`)
   eklediğin tablo/sütun ve `user_version`/migration numaralarını yaz. Dal şunları ekledi/değiştirdi:
   `IosWebDavJournal`/`AndroidWebDavJournal` (hedef başına anahtar, 18A/3'ten), `*WebDavRestoreJournal`,
   yeni `*RecoveryCatalogJournal`, `*RecoveryImportJournal`. Numara çakışması varsa hangisinin önce gideceğini öner.
3. **Çakışan dosyalar.** Aşağıdakilerde amacını bir satırla yaz (Claude çözerken iki tarafı korur):

   | Dosya | Dal (Claude) | main (Codex, commit edilmemiş) |
   |---|---|---|
   | `apps/mobile/app.json` | `NSFaceIDUsageDescription` | BG görev kimlikleri `ftps`/`s3.processing` |
   | `ios/KlodaSyncRuntime.podspec` | `LocalAuthentication` framework | FTPS/S3 native xcframework koşulları |
   | `ios/IosWebDavContext.swift` | hedef başına bağlam (+38/−11) | +6 |
   | androidTest `AndroidFilesQueueRecoveryInstrumentation.kt` | `recovery29`, `cloud18-*` scope'ları | FTPS/S3 scope'ları |
   | `src/app/App.tsx`, `App.spec.tsx` | kurtarma sayfası rotası | +3/−1 |
   | `pages/activity/ui/activity-page.tsx` | hedefe özel metinler | +3/−2 |
   | `pages/connections/ui/connections-page.tsx` | bulut hedef listesi/kurtarma satırı | +20/−1 |
   | `shared/i18n/locales/{tr,en,de}.json` | `ui.conn.*`, `recovery.*`, `destinations.restore.*` | FTPS/S3 metinleri |

4. **Bekleme süresince** dalın yeni dosyalarına (`*Recovery*`, `*Dropbox*`, `*OAuth*`, `KlodaCloudModule`,
   `features/recovery-code/*`, `pages/settings/ui/recovery-page.tsx`) dokunma.

## Önerilen sıra

1. Codex commit eder ve madde 2–3'ü yanıtlar.
2. Kullanıcı onayıyla Claude main'i dala birleştirir (çakışmaları dalda çözer; Codex'in FTPS/S3 davranışı değişmez),
   etkilenen kontrolleri bir kez koşar: Jest, tsc, ESLint, Android `:app:assembleDebug` + androidTest APK derlemesi,
   iOS arm64 Simulator derlemesi, `test-ios-webdav-journal.py` (migration). Tam matris tekrarlanmaz.
3. Main temizse `git merge --ff-only worktree-step18-20` ile main ileri alınır (push yok).
