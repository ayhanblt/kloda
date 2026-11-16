# 2.1/G1 — Opus INITIAL uygulama manifesti / 16.11.2026

Sözleşme: [next-plan §2.1/G1](../../plans/next-plan.md) (tek goal + G1-01–07 tablosu orada; burada yeniden tanımlanmaz).
Durum: **REVIEW / ACCEPTED — G1 geliştirme goal'u INITIAL + G1-R1 birlikte bağımsız GPT review ile kabul edildi.**
16.11 kullanıcı kararıyla G1-07 görsel karşılaştırması Faz3'e **DEFERRED / NOT_RUN**;
görsel veya tam ürün PASS değildir. [Bağımsız review ve tarihî inceleme](review.md).
- [x] **2.1/G1 geliştirme kabulü** — G1-01–06 ve G1-07 render/a11y karşılandı; R1 kapandı.
Self-review kabul yerine kullanılmadı. Commit/push yok.

## Başlangıç / diff kapsamı

- Start HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`; staged boş (`baseline/staged.txt`).
- Başlangıç dirty/untracked listesi `baseline/status.txt`: F1 Android, 1.5 ve belge diff'leri — bu işe ait değil, dokunulmadı.
  `apps/mobile/src` başlangıçta temizdi.
- Değiştirilen tracked dosyaların başlangıç içerikleri `baseline/` altında (CURRENT dahil), hash `baseline/sha256.txt`.
- İşe ait tracked diff (`tracked.diff`): `pages/activity/ui/activity-page.tsx`, `shared/i18n/locales/{tr,en,de}.json`.
- İşe ait untracked: `features/file-transfer/model/activity-journal{.ts,.spec.ts}`,
  `pages/activity/ui/activity-journal-panel{.tsx,.spec.tsx}`, bu dizin; CURRENT'te yalnız G1 satırı.
- Native, hook (`use-file-transfer`), parser/API, Home, mevcut spec dosyaları DEĞİŞMEDİ.
- Final hash: `source-final.sha256`. Satır (yorum/boş hariç) `lines.txt`: hepsi ≤300 (en büyük 173).

## Ölçüt → kanıt → durum

| ID | Kanıt (fresh, bu tur) | Durum |
|---|---|---|
| G1-01 | Selector RED (`g1-01-selector-red.log`, modül yok) → GREEN; sayfa regression baseline page ile RED (`g1-01-page-red-baseline.log`: Now'da 2 fazla completed) → GREEN. Kesin kümeler, native sıra, tab/filter'da action/status/ftps.status çağrı sayısı sabit | KARŞILANDI |
| G1-02 | ACK=size uploading ve finalizing Completed'a girmez, yalnız native completed girer (selector + page); mevcut exact-progress testi korunur | KARŞILANDI |
| G1-03 | 100 queued/total101: tüm filtrelerde emptyLimited + limited, `empty` yok; hasMore=false karşıtı `empty`; load-more yok | KARŞILANDI |
| G1-04 | Deferred status → loading (boş değil); background sırasında geç completed yanıtı epoch ile elenir; active sonrası queue_unavailable alert, boş değil; sonraki okuma güncel; pause yok | KARŞILANDI |
| G1-05 | Geçmiş'te Now mounted (includeHiddenElements ile var) ama a11y'den gizli; ftps.status remount yok; bg/active'de pause/cancelRestore yok; departure'da cancelRestore 1, pause 0; mevcut lifecycle/automatic spec'leri GREEN | KARŞILANDI |
| G1-06 | Backups/embedded'de tab/scope/satır yok; backups-page, destinations, owner_deleted confirmation (activity-page.spec) GREEN; Home hook değişmedi | KARŞILANDI |
| G1-07 | Render/a11y testleri mevcut. Filter biçimi G1-R1 FIX ile M11 header dropdown'a döndü (`fix-r1/`, R1 RED→GREEN). Görsel karşılaştırma (TR/EN/DE, light/dark, büyük yazı, Lovable eşlemesi) 16.11 kullanıcı kararıyla **Faz3 DEFERRED / NOT_RUN**; görsel PASS değil | Render/a11y bağımsız review KABUL; görsel DEFERRED |

## Komutlar / loglar (hepsi bu dizinde)

| Komut (workdir) | Log | Sonuç |
|---|---|---|
| `pnpm test -- --runTestsByPath <selector spec>` (apps/mobile) | `g1-01-selector-red.log` | RED beklenen (exit 1) |
| Baseline page geçici geri yüklenip `-t G1-01` | `g1-01-page-red-baseline.log` | RED beklenen; final dosya geri yüklendi, hash `581956cf…` |
| Yeni iki spec | `g1-new-specs-run{1,2}.log` → `run3.log` | run1/2 test-sorgu hataları (tablist rolü, çift başlık) yalnız spec'te düzeltildi; run3 12/12 |
| 6 spec: yeni 2 + activity-page/automatic/destinations/backups | `jest-affected.log` | 6 suite / 39 test PASS |
| `pnpm exec tsc --noEmit` (apps/mobile) | `tsc.log` | exit 0 |
| Kök `node_modules/.bin/eslint.cmd` 5 değişen TS/TSX | `eslint-scoped.log` | exit 0 (yalnız çoklu tsconfig uyarısı) |
| `pnpm exec expo export --platform ios|android --output-dir %TEMP%\kloda-g1-export\…` | `export-{ios,android}.log` | iki platform Bundled/exit 0. `pnpm run build` ile aynı export; repo'da ignore'suz `dist/` oluşmasın diye çıktı dizini dışarıda |

Parser suite değişmediği için tekrar koşulmadı. Tam repo Jest/native/build Faz3'te.

## Reuse / ertelenen

- Native journal/ACK/tombstone ve iOS journal/run kanıtı: araştırma §3 prior PASS REUSE (native-free iş). Mock UI testleri gerçek-OS journal PASS'i değildir.
- B1 JS→native runtime, fiziksel/OS, provider, signing/P5, tam a11y/performance: Faz3–4 açık. F1 fix2 / 1.5 Mac kuyruğu değişmedi.

## Görsel/eşleme notları (review için)

- INITIAL'daki üç seçenekli panel radio uyarlaması G1-R1 ile reddedildi ve FIX'te
  M11 başlık dropdown'ına döndü. Tarih grubu/saat/özet bilinçli olarak yok (D-G1).
- Geçmiş'te Pause/Sync now kontrolleri gizli; restore sürerken iptal butonu iki sekmede de görünür.
- owner_deleted satırı Geçmiş'te salt-okunur; rebackup aksiyonu yalnız Şu an'da.

## Sayaç

İki-deneme sayacı: ürün yaklaşımı için başarısız fix yok (0). Spec sorgu düzeltmeleri ürün fix'i değildir.

## İnceleme / scoped FIX yönlendirmesi — 16.11

Kaynak hash'lerinin sekizi `source-final.sha256` ile eşleşti. Önceki Jest39/tsc/lint/export
kanıtları reuse; incelemede test/build tekrarlanmadı. Başlangıç kayıtları `review-baseline/`.
Yeni görülen `apps/mobile/pnpm-lock.yaml` aidiyeti belirsiz untracked dosyadır;
G1 kaynak diff'ine dahil edilmedi, silinmedi/değiştirilmedi.

| Bulgu | Invariant | Olay sırası | Sembol | Regression | Önce / sonra |
|---|---|---|---|---|---|
| G1-R1 (P2) | G1-07 / M11 segment-filter biçimi korunur | Geçmiş seç → başlık filtresini aç → done/issues seç → kapat | ActivityPage header / ActivityJournalPanel filtre satırı → `ActivityFilterMenu` | `G1-R1 keeps the M11 History filter as a header dropdown…` | Önce: RED `fix-r1/r1-red.log` (panel radio mevcut, :78). Sonra: GREEN `fix-r1/r1-green.log` |

Yalnız G1-R1 düzeltmesi: onaylı başlık dropdown biçimine dön; yeni native/API/hook/bağımlılık
ve geniş test/fixture işi yok. Önce kök nedeni doğrula, dar regression, sonra gerekli
UI/spec düzenlemesi ve yalnız etkilenen kontroller. Mevcut filtre testlerinin radio varsayımı
uyarlanabilir; kabul kümeleri/ACK/yan-etki beklentileri gevşetilmez.
Görsel kapı Faz3'te kalır. Fix denemesi henüz yok (0); bağımsız review açık, checkbox açık.

## G1-R1 FIX sonucu — 16.11 (Opus)

- Start HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`, staged boş. Başlangıç içerikleri/hash/status:
  `fix-r1-baseline/` (üç ürün/spec dosyası + CURRENT + MANIFEST). `apps/mobile/pnpm-lock.yaml` untracked, aidiyeti belirsiz; dokunulmadı.
- Kök neden kaynakta doğrulandı: filtre `ActivityJournalPanel` içinde radio grubu, header'da trigger/menü yoktu.
- Fix (deneme 1, sayaç 1 başarılı / 0 başarısız): `ActivityFilterMenu` — Geçmiş'te header sağında mevcut seçimi gösteren
  trigger (`button`, `expanded`, hint=filtrele) + ChevronDown; açılınca header içinde akışta `menu` ve üç `menuitem`
  (`checked`, Check ikonu); seçim filtreyi değiştirip menüyü kapatır. Geçmiş'te marka metni yerine trigger (Lovable gibi);
  Now'da trigger yok. Panel radio grubu kaldırıldı; sınıflama/selector/hook/locale değişmedi (yeni anahtar yok).
  Menü Modal/absolute değil: Android'de ebeveyn dışı dokunma kaybı ve inline stil gereksinimi olmadan en dar çözüm.
- Spec: filtre helper'ı trigger→menuitem yoluna uyarlandı; kabul kümeleri/ACK/yan-etki beklentileri aynı.
  İlk GREEN koşusu test-sorgu sınırıyla düştü (odaklanmayan `menu` kapsayıcısı role sorgusunda eşleşmez; tablist ile aynı) —
  sorgu etiket+rol kontrolüne çevrildi; ürün fix'i sayılmaz.
- Diff: `fix-r1/fix.diff` (baseline→final, üç dosya). Final hash `fix-r1/source-final.sha256`. Satır `fix-r1/lines.txt` (en büyük 204).
- Değişmeyen G1 dosyaları (selector+spec, üç locale) önceki `source-final.sha256` ile eşit — REUSE.

| Komut | Log (`fix-r1/`) | Sonuç |
|---|---|---|
| `-t G1-R1` baseline kodla | `r1-red.log` | RED beklenen |
| `-t G1-R1` fix sonrası | `r1-green.log` | 1 PASS |
| 6 etkilenen spec (G1 ikisi + activity-page/automatic/destinations/backups) | `jest-affected.log` | 6 suite / 40 PASS |
| `pnpm exec tsc --noEmit` | `tsc.log` | exit 0 |
| Kök ESLint, üç değişen dosya | `eslint-scoped.log` | exit 0 (çoklu tsconfig uyarısı) |
| `expo export` ios/android → `%TEMP%\kloda-g1r1-export` | `export-{ios,android}.log` | iki platform Bundled, exit 0 |

Açık/ertelenen: G1-07 görsel Faz3 DEFERRED / NOT_RUN; Faz3–4 native/fiziksel kapılar. Self-review bağımsız kabul değildir.

## Bağımsız GPT kapanışı — 16.11

- Reviewer GPT-6.1 Sol (`openai/gpt-6.1-sol`), ayrı kullanıcı-başlatılmış GPT sohbeti;
  session ID bağlamda yok. HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`, staged boş.
- [review.md](review.md): INITIAL + FIX gerçek tracked/untracked diff'i ve G1-01–07
  topluca kabul; yeni engelleyici bulgu yok. G1-R1 / M11 biçimi RESOLVED.
- Taze statik doğrulama: 8/8 son kaynak hash'i, 3/3 FIX başlangıç hash'i ve 8/8
  baseline HEAD blob'u eşit; komşu hook/parser/Home/caller spec diff'i boş.
  Scoped diff whitespace temiz. Test/lint/tsc/export yeniden çalıştırılmadı;
  son 40/40 ve kayıtlı lint/tsc/iki export kanıtları REUSE.
- Invariant bazlı sayaç: M11 segment/filter biçimi 1 kabul edilmiş fix denemesi,
  0 başarısız fix; önceki tur kayıtları tarihîdir, sayaç sıfırlanmadı.
- G1-07 görsel Faz3 DEFERRED / NOT_RUN ve tüm diğer açık Faz3–4 kapıları korunur.
  Üst F1/1.5 kapanmadı. Sonraki bağımsız kapsam 2.2/G2–G3 GPT planıdır; başlatılmadı.
