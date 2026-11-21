# P3-11 erişilebilirlik/performans — tek temsilci (20.11.2026)

Durum: **PARTIAL.** Perf alt temsilcisi (host sentetik kaynak maliyeti) taze ölçüldü, baseline ile eşleşti; **eşik yok → ölçüm, PASS değil**. Erişilebilirlik ve gerçek UI timing/CPU/bellek temsilcisi hazır yol olmadığından NOT_RUN.
Variant metadata: `claude-agent/sonnet#medium` (Sonnet 5.5); reasoning_effort sayısından sonuç çıkarılmadı.

## Aidiyet
Başlangıç: `adb devices` boş; qemu/emulator/simulator/vite/playwright sürücüsü yok (görünenler Claude/OpenCode uygulama süreçleri, dokunulmadı). Çalıştırdığım süreç kısa ömürlü host python'u; bitişte yetim süreç/cihaz/dosya yok (cleanup: yok-gerekli). Aday: canlı ağaç HEAD `508b3f04` + dirty; ölçülen kaynaklar (`tools/check-android-resource-costs.py`, `test-android-saf.py`, `test-android-schedule.py`) `git status` temiz, son commit 28 Eki.

## Eşleme (reuse)
- G1/G456/G24 render/a11y: P3-10 görsel kolu M13-alt `state_unavailable`, G1-07/G456-07/G24-07 görsel kabul **açık** (MANIFEST). Reuse edilecek geçerli yeni a11y kanıtı yok; yeniden koşulmadı.
- Fixture/provenance: P3-00/02 P3-S0 ve APK hash'leri (`1f873905…` eski B3, `2966a0d0…` P3-02) değişmedi, bu dilimde kullanılmadı.

## Seçilen temsilci ve neden
Odak/rol/ad/durum/büyük yazı için **hazır otomasyon yok**: `tools/ui-capture/ios.py` yalnız büyük yazı boyutu uygular (`accessibility-extra-extra-extra-large`) ve görüntü yakalar; erişilebilirlik ağacı okuyucusu yok; iOS Simulator/Android emülatör a11y okuyucu bayrakları bu ortamda kapalı, TalkBack/VoiceOver sürücüsü yok. Yeni araç/SDK kurulumu yasak → a11y **NOT_RUN**.
Performans için tek hazır, baseline'lı yol: `check-android-resource-costs.py` (gerçek Kotlin scanner + üretim `files_run_job` SQL'i, sentetik veri, cihaz/arşiv yok).

## Komut / exit
`python3 -B tools/check-android-resource-costs.py` → **exit 0**, 5.06 s (`resource-costs.log`, `resource-costs.exit`).

| Ölçüt | Taze | Baseline (`android-validation-step4-2026-10-25.md`) | Fark |
| --- | --- | --- | --- |
| API24 8000 dosya: provider sorgusu | 1 | 1 (sonra) | 0 |
| API24 8000 dosya: cursor ziyareti | 8001 | 8001 (sonra) | 0 |
| API29 8000 dosya: sorgu/ziyaret/membership | 1 / 8001 / 8000 | aynı kontrat | 0 |
| 8000 dosya × 12 run: üyelik satırı | 96000 | 96.000 | 0 |
| SQLite artışı (12 run) | 15.073.280 B | 15.073.280 B | 0 (toplam 15.818.752 B) |

Baseline'daki "15.073.280 byte" birebir; girdi/kaynak aynı olduğundan karşılaştırılabilir. Bu bir **host sentetik** ölçümdür: gerçek UI açılış/etkileşim, CPU/bellek, üretim DB toplamı, pil/OS süresi **değildir**; platform/variant ikamesi yapılmadı (iOS/Desktop/Android UI için sayılmaz). Eşik tanımlı olmadığından PASS/bütçe iddiası yok.

## Açık / NOT_RUN (bağımlı kontroller)
- Klavye/odak, rol/ad/durum/hata, kontrast, büyük yazı için erişilebilirlik ağacı kanıtı; TalkBack; iOS EN/DE Bağlantılar/kurtarma VoiceOver.
- Gerçek UI açılış/etkileşim zamanı, CPU/bellek, uygulama I/O ve journal ölçümü (aynı fixture+cihaz+baseline gerektirir; hazır ölçer yok).
- Fiziksel pil/ısıl ve üretim OS ölçümü.

## Sonraki adım
Koordinatör: P3-11 satırını PARTIAL yaz (perf host eşleşmesi reuse/taze, a11y+UI ölçümü NOT_RUN, neden: hazır a11y/UI-perf aracı ve sahipli yeniden-kullanılabilir baseline yok). Yeni araç/kapsam ancak kullanıcı kararıyla (ör. onaylı a11y okuyucu veya Faz4 fiziksel ölçüm). Sıradaki bağımsız Faz3 satırı koordinatör sırasına göre.
