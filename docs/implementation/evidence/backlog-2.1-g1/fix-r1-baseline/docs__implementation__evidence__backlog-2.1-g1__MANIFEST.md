# 2.1/G1 — Opus INITIAL uygulama manifesti / 16.11.2026

Sözleşme: [next-plan §2.1/G1](../../plans/next-plan.md) (tek goal + G1-01–07 tablosu orada; burada yeniden tanımlanmaz).
Durum: **FIX — G1-R1 açık.** 16.11 kullanıcı kararıyla G1-07 görsel karşılaştırması
Faz3'e **DEFERRED / NOT_RUN**; tek başına geliştirme engeli değil. [Aynı-sohbet incelemesi](review.md)
bağımsız kabul değildir; G1-R1 sonrasında ayrı GPT review gereklidir.
Checkbox açık; bağımsız GPT review yapılmadı. Self-review bağımsız kabul değildir. Commit/push yok.

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
| G1-07 | Render/a11y testleri mevcut. Bilinen filter biçimi sapması: **G1-R1 açık**. Görsel karşılaştırma (TR/EN/DE, light/dark, büyük yazı, Lovable eşlemesi) 16.11 kullanıcı kararıyla **Faz3 DEFERRED / NOT_RUN**; görsel PASS değil | G1-R1 AÇIK; görsel DEFERRED |

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

- Lovable M11 filtre bir header dropdown'ıdır; RN'de mevcut dropdown bileşeni olmadığından Geçmiş panelinin üstünde
  üç seçenekli radio segment olarak uyarlandı (yeni bağımlılık yok). Tarih grubu/saat/özet bilinçli olarak yok (D-G1).
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
| G1-R1 (P2) | G1-07 / M11 segment-filter biçimi korunur | Geçmiş seç → başlık filtresini aç → done/issues seç → kapat | ActivityPage header / ActivityJournalPanel filtre satırı | Başlık trigger/menu ve seçenek seçimi; Now'da menü yok, native action/status eklenmez; mevcut sınıflama korunur | Önce: kaynakta panel radio segmenti doğrulandı; yeni regression NOT_RUN. Sonra: NOT_RUN |

Yalnız G1-R1 düzeltmesi: onaylı başlık dropdown biçimine dön; yeni native/API/hook/bağımlılık
ve geniş test/fixture işi yok. Önce kök nedeni doğrula, dar regression, sonra gerekli
UI/spec düzenlemesi ve yalnız etkilenen kontroller. Mevcut filtre testlerinin radio varsayımı
uyarlanabilir; kabul kümeleri/ACK/yan-etki beklentileri gevşetilmez.
Görsel kapı Faz3'te kalır. Fix denemesi henüz yok (0); bağımsız review açık, checkbox açık.
