# P3-10 iOS temsilci (mobile.welcome → provider-generic) — 20.11.2026

Durum: **BLOCKED — capture koşulmadı.** İki bağımsız engel: (1) frozen referans görüntüsü eşleşmesi yok, (2) mevcut iOS fixture `ba35dad4…` güncel girdilerle geçersiz. Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Simulator/Metro/build/cihaz açılmadı; ürün/runner/matris değişmedi; M13-alt ve tam matris dokunulmadı. MANIFEST/CURRENT/plan işlenmedi. Commit/push yok. Check/tsc/lint/test tekrarlanmadı (registry-fix kanıtı geçerli).

## 1. Frozen Lovable JPG ↔ ready iOS ekran/dil/tema/boyut
`c144e98938da/manifest.json` yedi JPG listeler (`frozen-jpg.sha256`); hepsi 375/390 px genişlikte mobil tasarım ekranları:
| JPG | İçerik |
| --- | --- |
| `reference-mobile-status-setup.jpg` (375×942) | **Durum** (home) koyu tema, TR: "Henüz yedeklenmiyor", Kurulum adımları, alt sekme çubuğu + Lovable rozeti (görsel kontrol edildi) |
| `reference-mobile-safe-{light,dark}.jpg`, `reference-mobile-syncing-{light,dark}.jpg` | Durum ekranı varyantları (güvende/eşitleniyor), adlarına göre |
| `reference-mobile-photos.jpg`, `reference-lock-screen.jpg` | Fotoğraflar sekmesi; Live Activity/kilit ekranı |
Ready iOS satırları `mobile.welcome`, `mobile.provider-generic`, `mobile.settings`. **Hiçbirinin frozen JPG'si yok** (welcome/onboarding, hedef sağlayıcı ve ayarlar için görüntü yok; yalnız `/m/welcome`, `/m/connections/new/$provider`, `/m/settings` kaynak rotaları `page-map.json`'da). Ayrıca JPG'ler 375/390 px CSS-genişlik web ekran görüntüleridir; capture 1206×2622 px (3x) iPhone PNG'si — boyut/DPR eşleşmesi de yok; dil/tema/boyut çifti (tr/light/normal vs koyu 375) ayrıca tutmaz. Sonuç: görsel fark rubriği için **uygun frozen görüntü yok**; bu yüzden PASS/fark çıkarımı uydurulmadı. Kaynak-düzeyi (`views/mobile/*.reference`) karşılaştırma ayrı bir yöntemdir, bu dilimde yapılmadı.

## 2. Fixture geçerliliği (salt okunur, `fixture-verify.log`)
Mevcut runner `ios_build.verify_fixture(...)` → `problem: fixture inputs changed; prepare-ios required (run never builds)`.
`fixture-input-diff.log`: 247 kayıtlı girdi / 247 güncel; fark yalnız **2 anahtar**: `recipe` (yeni) ve `tools/ui-capture/ios.py` (eski). Yani ürün/native/Pods 245 girdisi eşit; fixture kimliği, P3-S1 capture/runner değişikliğiyle (recipe girdisi artık ios.py yerine `recipe` olarak hash'leniyor) geçersizleşti. Kök neden: runner tarifinin kimlik tanımı, ürün değil.
Ortam: `Kloda-Capture25-*` Simulator 0, yetim süreç yok. Fixture `.app` önbelleği (`~/Library/Caches/kloda-capture25/ba35dad4…`) dokunulmadı.

## 3. Kapı kararı
`run` fixture'ı yeniden üretmez (`prepare-ios` gerekir); kullanıcı talimatı yeni build/fixture yasakladığı için **BLOCKED**. Taze capture alınmadı; reuse yok (önceki G25 iOS PNG'si yalnız `mobile.settings` ve aday için zaten `recapture`).

## 4. Aidiyet / cleanup
Hiçbir süreç/cihaz/dosya başlatılmadı (yalnız python salt okunur sorguları, `-B -I`). Temizlenecek bir şey yok. Repo: yalnız bu dizin (`RESULT.md`, `fixture-verify.log`, `fixture-input-diff.log`, `frozen-jpg.sha256`).

## 5. Sonraki adım (DECISION → koordinatör/GPT, kanıta göre)
İki engel birlikte iOS native görsel kabulü şu an kapatır. Öneri sırası:
1. **Fixture:** yalnız `recipe` kimliği değiştiği için, mevcut onaylı `prepare-ios --out <yeni>` (mevcut tarif, ~4 dk) yeniden hazırlama kararı — build/fixture yasağı kullanıcıdan kalkarsa bir kez; aksi hâlde iOS native hücreleri BLOCKED kalır.
2. **Referans:** welcome/provider/settings için frozen JPG yok → görsel kabul ya kaynak-düzeyi (`views/mobile/*.reference`) karşılaştırma + açık fark rubriği ile ya da kullanıcı onaylı yeni referans görüntü ile yapılır. Şu haliyle Desktop ve iOS ready hücrelerinin hiçbiri frozen **görüntüye** bağlanamıyor.
Bu karar gelmeden P3-10 görsel PASS ve yeni temsilci koşusu önerilmez; kaynak-düzeyi (görüntüsüz) mobile.welcome karşılaştırması cihaz/build gerektirmeyen tek ilerleyen yoldur.
