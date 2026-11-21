# Backlog 2.5 / D25-M — kalıcı batch UI capture runner

Durum: **FIX-R1 / ONAYLI, AYNI OPUS SOHBETİNE DEVİR** (CURRENT kutusu işaretsiz).
Son kayıt ve açık kabul satırları: [review.md](review.md#kabul-ve-kanıt-özeti).
Sözleşme: [next-plan §2.5](../../plans/next-plan.md) (G25-01–06). Araştırma:
[2.5-batch-capture-research](../../plans/2.5-batch-capture-research.md).
Rol: Opus uygulama; Sonnet 5.5 yalnız `tools/ui-capture/{matrix.json,matrix.py,test_matrix.py}` yazıcısı.

## Başlangıç / diff kapsamı

- Start HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`; staged boş (başlangıç ve son).
- Başlangıç kaydı `baseline/` (status 202 satır, CURRENT.start, allowlist başlangıçta ABSENT).
- **Diff yalnız yeni untracked dosyalar** (tracked dosya değişikliği yok; CURRENT/MANIFEST hariç):
  `tools/capture-ui.py`, `tools/ui-capture/{common,desktop,ios,matrix,test_matrix,test_capture}.py`,
  `tools/ui-capture/{ios_fixture.rb,matrix.json}`, `apps/mobile/capture/{entry.tsx,screens.tsx,protocol.ts,tsconfig.json}`
  + bu kanıt dizini. Son hash: `final-files.sha256`; Sonnet dosyaları `sonnet/files.sha256` ile OK.
- Önceden kirli ağaç (2.1–2.4, F1 vb.) değişmedi: `baseline/status.txt` ↔ `status-final.txt`
  (2.5 yolları dışı) birebir. Ürün `apps/mobile/ios` git status önce/sonra aynı
  (`logs/product-ios-status.*`). Ürün/App/package/Metro/Babel/Podfile/Xcode proje değişikliği yok.

## Kabul → kanıt

| ID | Kanıt (taze, bu oturum) | Sonuç |
| --- | --- | --- |
| G25-01 | `tools/capture-ui.py list` (47 satır/564 hücre; deferred/state_unavailable ayrık, cihaz açmaz); `sonnet/test_matrix.log` + `logs/unittest.log` (seçim/duplicate/eksik locale) | PASS (runner) |
| G25-02 | Desktop `desktop-smoke/` settings/TR/light/1440 PNG 1440x1000, lang/theme/hash/heading, bridge çağrısı ve console hatası yok, renderer taze; iOS `ios-fixture-r2/fixture.json` READY (readback 8/8) + `ios-smoke/` M13 settings/TR/light/normal PNG 1206x2622, rapor language tr/light/fontScale 1/fonts/active/layout, `driverKind native-component-fixture`. Her iki PNG gözle kontrol edildi | PASS (tek temsilci, iki sürücü) |
| G25-03 | `logs/ios-smoke-resume.log` reuse (exit 0); değişen-hash/UNKNOWN karşıtları `test_matrix` (`test_recapture_lists_changed_file`, `test_unknown_is_never_reused_even_when_equal`, eksik locale prefix) | PASS |
| G25-04 | `desktop-stale-negative/` stale renderer → BLOCKED exit 2 (capture yok); `test_capture` `_verdict` enjeksiyonu (lang/theme/hash/bridge/console/PNG), `report_problems` (dil/tema/fontScale/fontError/appState/screen), `final_status` önceliği, CLI desktop `--size large` → exit 2 tarayıcısız; timeout'lar sabit (Metro 90s, phase 60s) | PASS |
| G25-05 | `test_capture` (no-clobber, lock, phase geri/CLEANED+hata reddi, cleanup retry, path escape/overwrite, runID/phase/nonce stale rapor + PhaseServer stale sayacı, device resolve intent/UDID/isim değişimi, süreç aidiyeti/PID reuse); native: `ios-interrupt/` SIGTERM → FAIL+tam cleanup CLEANED exit 1; `ios-hardkill/` SIGKILL → yetim Metro ve Simulator kalıcı kayıttan `cleanup --run` ile kapatıldı/silindi, sonuç FAIL (PASS iddiası yok). Simulator listesi önce/sonra birebir (`logs/simulators.*`), yalnız `Kloda-Capture25-<runID>` oluşturulup silindi | PASS |
| G25-06 | Bu manifest + loglar; ürün/native/tam görsel PASS iddiası yok | Bağımsız review kaydedildi; goal açık |

Komutlar ve loglar (`logs/`): `unittest.{log,exit}` (42 test OK; `python3 -I -B -m unittest discover -s tools/ui-capture -p 'test_*.py'`),
`check-2` (`capture-ui.py check` exit 0), `eslint-capture` (exit 0), `tsc-pre.log` (capture tsconfig exit 0),
`ruby-syntax` (OK), `line-whitespace.log` (tüm dosyalar ≤300 kod satırı; trailing ws/tab yok),
`desktop-vite-build`, `desktop-smoke`, `desktop-stale-negative`, `prepare-ios{.attempt1,}`, `ios-smoke`,
`ios-smoke-resume`, `ios-interrupt{,-cleanup}`, `ios-hardkill{,-cleanup}`. Pycache bırakılmadı.

## Uygulama sırasında kök neden + düzeltmeler (review için)

1. **Süreç aidiyeti (sözleşme sapması, onay/inceleme gerekli):** macOS 26.6 `KERN_PROCARGS2` başka
   süreçlerin ortamını döndürmüyor (ölçüm: buffer yalnız argv; `ps -E` marker'ı göstermiyor).
   Plan "live child handle veya start-time+run marker" diyordu; env marker okunamadığı için tüm Metro
   üyeleri yabancı sayılıp cleanup her zaman fail-closed olurdu (test RED ile kanıtlandı).
   Yeni kural (`common.stop_owned_group/_classify`): lider live handle veya kayıtlı `lstart` ile
   kanıtlanır; üyeler aynı PGID + pid/start ile lidere ata zinciri; zombi bağlar ama canlı sayılmaz;
   kanıtsız tek üye varsa hiç sinyal gönderilmez. `KLODA_CAPTURE_RUN` ortamı hâlâ set edilir
   (tanılama), doğrulama kanıtı değildir. Hard-kill native koşusu bu yolu kanıtladı.
2. **Fixture link hatası (deneme 1, `ios-fixture/` BUILD_FAILED):** generic Simulator hedefi x86_64
   de linkliyor; yerel Rust xcframework'leri yalnız arm64-simulator dilimi içeriyor
   (`ld: library 'kloda_ftps_native' not found`, lipo ile doğrulandı). Düzeltme: xcodebuild
   `ARCHS=arm64 ONLY_ACTIVE_ARCH=YES` → `ios-fixture-r2/` READY. Bu host Apple Silicon varsayımıdır.
3. Scratch konumu sapması: ağır mirror/DerivedData `~/Library/Caches/kloda-capture25/<fixtureID>`
   (`--scratch`), Metro'nun docs altındaki GB'larca ağacı taramasını ve haste çakışmasını önlemek için.
   `fixture.json`/`xcodebuild.log`/readback `--out` altında. Mevcut scratch: başarısız deneme
   `25e36775…` 6.0G, READY `ba35dad4…` 3.3G; geniş rm yapılmadı (silme kullanıcı kararı).

## Bilinen sınırlar / açık kapılar

- iOS PNG'de Expo dev-launcher yüzen "Tools" düğmesi sağ üstte görünür (debug fixture artefaktı);
  kaldırmak ürün/Expo yapılandırması değişikliği gerektirir, kapsam dışı. Görsel karşılaştırmada not edilmeli.
- Desktop yakalaması sentetik renderer'dır (Electron/OS tray/paket değil); desktop `large` hücreleri
  `state_unavailable`. iOS fixture ürün imzalama/Keychain kabulü değildir; Android sürücüsü yok.
- Yalnız tek temsilci hücreler koşuldu; tam matris koşusu ve G1-07/G456-07/G24-07 görsel
  karşılaştırmaları **Faz3 DEFERRED / NOT_RUN** kalır. F1 fix2, FO1 Faz4, step19/OS/fiziksel/release kapıları açık.
- Self-review bağımsız review değildir. Token/kota UNKNOWN.

## INITIAL review — 18.11.2026

[Bulgular](review.md#engelleyici-bulgular): G25-R1 cleanup transaction/result,
G25-R2 OS/process ownership, G25-R3 capture provenance/reuse, G25-R4 çıktı/deadline,
G25-R5 matrix inventory. INITIAL ret=1; bu invariant ailelerinin her birinde başarısız
FIX=0. G25-01–05 açık, G25-06 review kaydı mevcut ama goal kapanmadı. Yukarıdaki PASS'ler
yalnız uygulama kanıtının sınırlarını gösterir; bağımsız satır kabulü değildir.
Taze: 13/13 hash, iki PNG hash/boyut, `review-probes.log` cihazsız karşıtları ve
`review-tsc.{log,exit}` exit 0. Önceki dar build, lint, test ve native smoke reuse.
Sıradaki: aynı GPT review sohbetinde önce G25-R2 aidiyet sözleşmesi DECISION; sonra
tek toplu scoped FIX devri. Full matris/Faz3–4/step19 ve release kapıları değişmedi.

## FIX-R1 — onaylı toplu devir

- **Kullanıcı onayı:** Desktop/iOS için yerel gözetici; public CLI kaybında gözetici
  doğrulanmış temizliği tamamlar. Gözetici de kaybolursa kanıtlanamayan sürece PID'ye
  dayanarak sinyal yok; RESTORE_PENDING/nonzero korunur. Bağımsız aidiyeti kanıtlanan
  Simulator temizlenebilir. [Dar karar](../../plans/next-plan.md#g25-r2-onaylı-fix-kararı)
  §Mobil lifecycle 6'nın süreç aidiyeti yöntemini günceller; yeni goal yok.
- **Araştırma:** GPT-6 Luna (`openai/gpt-6-luna`, `ses_e114944a6ffeNMMR3a3JE0vnZU`),
  macOS sonrası süreç kimliği/sinyal sözleşmesi. XNU private unique ID alanı kimlik
  kıyasına yarar; ana GPT [Apple `kill(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kill.2.html)
  belgesinde PID hedefini ve [POSIX `_Exit`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/_Exit.html)
  metninde parent/reap sınırını doğruladı. macOS 26'da kimliğe bağlı sinyal API'si
  doğrulanmadı; private API'ye dayanılmıyor. Süre/token ölçümü yok; fallback yok.
- **Uygulama sırası:** [G25-R1–R5](review.md#engelleyici-bulgular) tek tur; her biri
  için kök neden → dar karşıt → minimum fix → etkilenen normal/recovery/hata yolları.
  INITIAL ret=1; R1 cleanup transaction, R2 process ownership, R3 provenance/reuse,
  R4 çıktı/deadline ve R5 inventory ailelerinin her birinde başarısız FIX=0.
- **Başlangıç:** HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`,
  `final-files.sha256` INITIAL sınırı; scoped FIX başlamadan gerçek tracked/staged/
  untracked delta ve yeni kanıt kaydedilir. Etkilenmeyen eski kanıtlar reuse; yeni
  runtime/build sonucu bu devirde yok. Faz3/Faz4/step19/OS/fiziksel/release ertelemeleri
  ve gerekli bağımsız GPT review korunur. Ürün kodu, yeni dependency ve geniş diff yok.
