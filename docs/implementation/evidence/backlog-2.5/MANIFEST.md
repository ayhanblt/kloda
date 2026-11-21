# Backlog 2.5 / D25-M — kalıcı batch UI capture runner

Durum: **FIX-R5 bağımsız REVIEW / ACCEPTED — D25-M runner goal'u kapandı** (CURRENT [x]).
Uygulama kaydı: [§FIX-R3 uygulama](#fix-r3-uygulama--sonnet-55-18112026) (önceki: [§FIX-R2](#fix-r2-uygulama--opus-18112026), [§FIX-R1](#fix-r1-uygulama--opus-18112026)).
Son kayıt ve açık kabul satırları: [review.md §FIX-R4](review.md#fix-r4-bağımsız-devam-reviewu--19112026).
19.11 kullanıcı onayı: [G25-R2 sadeleştirme — onaylı FIX-R5](../../plans/next-plan.md#g25-r2-sadeleştirme--onaylı-fix-r5).
Nonterminal sahiplik kaybında otomatik offline kapanışı daraltma ve yalnız
`tools/ui-capture/test_recovery.py` eklenerek allowlist 16→17 onaylandı.
Mevcut küçük Sonnet sohbetinde yalnız R2/G25-05 FIX-R5; R1/R3/R4/R5 açılmaz.
Sonuç aynı bağımsız GPT review'a; kabul yok, R2 başarısız FIX sayacı 4 korunur.
Bu plan incelemesinde kod/test/build değiştirilmedi/çalıştırılmadı; reviewer kanıtı reuse.
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

## FIX-R1 uygulama — Opus, 18.11.2026

Kanıt kökü `fix-r1/`. Başlangıç `fix-r1/baseline/` (HEAD 508b3f04, staged boş, INITIAL 13/13 hash OK).
Son: `fix-r1/final-files.sha256` (16 dosya), staged boş; 2.5 dışı status başlangıçla birebir.
Sayaç: INITIAL ret=1; R1–R5 ailelerinde başarısız FIX=0 (bu tur deneme 1).

**Kapsam genişlemesi (kullanıcı onaylı, bu sohbet):** 300 satır sınırı için yalnız yapısal
bölme — `tools/ui-capture/supervision.py` (kesinti/CLI izleme, süreç aidiyeti), `ios_build.py`
(fixture prepare/verify), `test_supervision.py`. Diğer 13 dosya allowlist içinde.
Sonnet 5.5 (aynı oturum) yalnız matrix üçlüsü yazıcısı: `fix-r1/sonnet/{HANDOFF.md,files.sha256}` (hash OK).

| Bulgu | Kök neden → düzeltme | Karşıt / kanıt |
| --- | --- | --- |
| G25-R1 | Kayıt lock'tan önce okunuyordu; retry yalnız `running`'i deniyordu; teardown hatası kayda geçmiyordu. → `Run.open` önce lock sonra okur; her cleanup tüm terminal olmayan kayıtları yeniden doğrular, `_finish` çözülmemiş süreçte CLEANED vermez; Desktop kapanışı `desktop.cleanup`'ta, hata → cleanup error/exit 3; `runError`/`interrupted` → PASS yok; CLEANED tekrar event'i yazılmaz | `test_open_reads_after_lock`, `test_phase_rules_and_retry`, `test_supervisor_lost_then_retry`, `test_teardown_failure_is_cleanup_failure`, `test_recovered_run_is_never_pass`, `StatusTests` |
| G25-R2 | Onaylı karar: run başına gözetici. `run` = ince istemci; `_supervise` ayrı oturumda lock fd'sini ve tüm süreçlerin **reap edilmemiş** handle'larını tutar (lider reap edilmeden PGID yeniden kullanılamaz; başka oturumdan gruba katılım EPERM — ölçüldü). Kayıt Popen'dan önce `launching`; sinyal/kayıt kritik bölgede ertelenir. CLI SIGINT/TERM/SIGKILL → pipe EOF → gözetici temizler, **CLEANED+FAIL**. Gözetici yoksa hiç sinyal yok: yalnız PID ve grup yokluğu kanıtlanırsa `gone`, aksi **RESTORE_PENDING+nonzero**; Desktop browser'ı sürücü kapanışı doğrulanmadıkça aynı. `lstart`/ata zinciri/env marker yetki değil (kaldırıldı) | `test_live_group_stopped_after_leader_exit`, `test_unrecorded_launch_not_signalled`, `test_reaped_handle_not_signalled`, `test_foreign_cannot_join_owned_group`, `test_lost_desktop_supervisor_stays_pending` (2× exit 3, resume 3), `test_public_cli_sigkill_supervisor_cleans` (gerçek Chromium, cihazsız); native `ios-cli-sigkill/` CLI exit 137 → gözetici CLEANED+FAIL, Metro 0, Simulator listesi birebir |
| G25-R3 | Resume yalnız row+locale hash'e bakıyordu; mtime build kanıtı değildi. → resume: PASS + row ready/driver/screen eşitliği + fingerprint (row tanımı, driver kaynakları, shell tab anahtarları, app.json — Sonnet) + PNG run-root/digest/boyut + ölçüm yeniden doğrulama + provenance (Desktop stamp, iOS fixture kimliği). Desktop: `prepare-desktop` mevcut Vite build'ini çalıştırıp çıktıyı kaynak digest'iyle damgalar; stamp yok/uyuşmaz → BLOCKED | `test_resume_rejects_changed_row`, `test_paths_and_artifacts`, `test_build_stamp`, `test_fixture_identity`, Sonnet `test_matrix` (33); `desktop-resume`/`ios-resume` reuse exit 0 |
| G25-R4 | PNG yalnız başlık; viewport/font yok; timeout'suz simctl/body; AppState snapshot. → tam PNG (CRC/IEND/pixel verisi); Desktop innerWidth/16px kök font/fonts loaded/Inter + PNG genişlik=viewport; simctl/ps/segedit timeout'lu, Metro bundle mutlak deadline, açık uçlu `fonts.ready` kaldırıldı; entry AppState aboneliği + artan `sample`; host ekran görüntüsünden **sonra** daha yeni sample ister, PNG oranı ölçülen ekranla eşleşmeli | `PngTests`, `test_verdict`, `ReportTests`; `ios-smoke` before sample 0 → after 3 |
| G25-R5 | Envanter eksikleri → Sonnet: `desktop.backup-storage`, cloud nextcloud/password/oauth satırları, jobs/backup ref düzeltmesi, `list` override detayı, frozen page-map (12 hücre) testi. 50 satır / 600 hücre; hazır iOS seti değişmedi | `fix-r1/sonnet/test_matrix.log`, `list.json` |

**Komutlar / loglar (`fix-r1/logs/`, gerçek exit):** unittest 56 OK (`unittest`), `check` 0, capture
tsc 0, ESLint 0, Ruby syntax 0, satır sayıları `line-counts.txt` (en büyük common 273), whitespace yok,
pycache yok. `prepare-desktop` 0 → `desktop-smoke` PASS (1440×1000, lang/theme/hash/innerWidth/16px/
Inter, bridge çağrısı yok, browser `stopped`) → `desktop-resume` reuse. `prepare-ios` 0 → `ios-fixture`
READY readback 8/8, ürün `apps/mobile/ios` status önce/sonra aynı → `ios-smoke` PASS (1206×2622,
TR/light/fontScale 1/active) → `ios-resume` reuse; `ios-cli-sigkill` yukarıda. PNG'ler gözle kontrol edildi.

**Ara bulgu ve düzeltme:** ilk Desktop smoke'ta (`desktop-smoke-abort/`) sonuç PASS yazıldıktan sonra
gözetici kapanışta abort etti (daemon izleyici buffered stdin kilidini tutuyordu). Kök neden doğrulandı;
izleyici ham `os.read` kullanır; tekrar koşu temiz, `supervisorExit` artık raporda.

**Yeniden build gerekçesi:** INITIAL fixture girdileri `ios.py`'nin tamamını hash'liyordu; R2–R4 runtime
değişiklikleri onu geçersiz kıldı. Yeni tarif hash'i yalnız build adımlarının kaynağı + ayarlar
(`ios_build._recipe`); böylece sonraki runtime/JS düzeltmeleri native rebuild gerektirmez.

**Bilinen sınırlar / açık:** gözetici de SIGKILL edilirse yetim Metro/Chromium'a sinyal yok, kayıt
RESTORE_PENDING kalır ve elle müdahale gerekir (onaylı fail-closed). Gruptan `setsid` ile ayrılan
torunlar izlenmez. RED kanıtı INITIAL kodda reviewer `review-probes.log`'dur; INITIAL dosya içerikleri
saklanmadığı için yeni testler INITIAL'a karşı koşulamadı. `matrix.json` 310 satır (JSON; 300 sınırı
Python/TS'ye uygulanıyor). Scratch: 5.9G (başarısız INITIAL deneme), 3.3G (eski READY), 3.4G (yeni READY)
`~/Library/Caches/kloda-capture25`; silme kullanıcı kararı. Expo "Tools" overlay sınırı, tam matris ve
  Faz3 görselleri (G1-07/G456-07/G24-07), F1 fix2, FO1 Faz4, step19/OS/fiziksel/release kapıları değişmedi.

## FIX-R1 review ve FIX-R2 devri

[Devam bulguları](review.md#fix-r1-devam-bulguları): G25-R1 abnormal sonuç,
G25-R2 bootstrap/EOF, G25-R3 build stamp/tarif ve locale reuse,
G25-R4 mutlak deadline/PNG/screenshot ölçümü açık. G25-R5 scoped çözüldü;
G25-01 kanıtı kabul, G25-02–05 açık ve G25-06 goal kapanışı yok.
INITIAL ret=1; G25-R1–R4 invariant ailelerinde başarısız FIX=1, G25-R5=0.
Taze 16/16 final hash, PNG hash, Simulator before/after listing karşılaştırması ve
`fix-r1/reviewer-probes.log`; önceki 56 test/lint/typecheck/build ve temsilciler reuse.

**Sonraki tek tur:** mevcut Opus sohbetinde **FIX-R2 / G25-R1–R4**; dar RED →
minimum düzeltme → etkilenen yollar. Başlangıç referansı `fix-r1/final-files.sha256`,
uygulama başlangıcında gerçek HEAD/staged/untracked kaydı alınır. Onaylı gözetici,
fail-closed ve 16 dosya sınırı aynen geçerli; scope/ADR değişikliği yok. Aynı
yaklaşım/invariant ikinci kez başarısızsa GPT değerlendirmesi. G25-R5 ve etkilenmeyen
kontroller yeniden açılmaz; Faz3/F1/FO1/step19/OS/fiziksel/release kapıları değişmedi.

## FIX-R2 uygulama — Opus, 18.11.2026

Uygulayıcı: Claude Opus 5.5 (aynı implementasyon sohbeti; 18.11 model geçiş kararından önce başlayan koşu).
Kanıt kökü `fix-r2/`. Başlangıç `fix-r2/baseline/` (HEAD 508b3f04, staged boş, FIX-R1 16/16 hash OK,
16 kaynak kopyası `baseline/src/`). Son `fix-r2/final-files.sha256`; FIX-R1→R2 tam fark `fix-r2.diff`
(10 dosya). Aynı 16 dosya, yeni dosya yok; staged boş; 2.5 dışı status birebir. G25-R5 açılmadı:
matrix üçlüsü, `ios_fixture.rb`, `screens.tsx`, `tsconfig.json` FIX-R1 ile byte-aynı.
Sayaç: INITIAL ret=1; R1–R4 başarısız FIX=1 (FIX-R1), bu tur deneme 2 — ret olursa GPT tasarım değerlendirmesi.

| Bulgu | Kök neden → minimum düzeltme | Karşıt (RED FIX-R1 → GREEN) |
| --- | --- | --- |
| G25-R1 | Public CLI gözetici çıkış kodunu yalnız yazdırıyordu. → `_settle`: kalıcı sonuç yalnız gözetici tam o sonucun koduyla çıktıysa geçerli; aksi halde kayda `supervisorAbnormal` + `runError` (lock alınarak), CLEANED ise sonuç FAIL, rapor asla PASS/BLOCKED değil; `resume` böyle run'ı reuse etmez. Normal FAIL/BLOCKED/RESTORE_PENDING(3) kodu korunur | `test_abnormal_supervisor_exit_never_pass` (-6 → 1, FAIL, resume `supervisor`), `test_normal_supervisor_exit_kept` |
| G25-R2 | Handler'lar EOF izleyicisinden sonra; armed değilken sinyal düşüyordu; erken EOF capture'ı durdurmuyordu. → `supervision.install()` Run.open/izleyiciden **önce**; armed değil/kritik bölgede sinyal **pending** tutulur, `arm(True)` ve kritik bölge çıkışı yükseltir; `arm` try içinde + `parent_gone` kontrolü sürücüden önce; except'te önce disarm; erken kesintide tüm seçili hücreler açık FAIL. Grup dışına kaçan torunlar: `escaped()` ppid zinciriyle sinyalden önce tespit, **sinyal yok**, canlı kalırsa cleanup hatası (`escaped` kaydı). Desktop browser: launch argv işaretiyle (yalnız konum bulma, yetki değil) Chromium PID/PGID kaydı; driver kapanışından sonra başarı yalnız PID ve grup yokluğuyla (`gone`), gözetici kaybında aynı doğrulama | `test_bootstrap_signal_kept_pending`, `test_early_cli_loss_launches_nothing` (stdin EOF → süreç kaydı yok, CLEANED+FAIL), `test_escaped_descendants_found`, `test_escaped_descendant_fails_cleanup_unsignalled`, `test_public_cli_sigkill_supervisor_cleans` (browser PID kayıtlı → `gone`) |
| G25-R3 | Damga girdilerinde Inter yoktu; resume güncel tüm-ağaç digest'i istiyordu; tarif `_link_all`'ı kapsamıyordu. → Desktop girdileri + `assets/fonts/inter`, `tsconfig.json`, `sync-core/package.json`; resume: yakalama anında taze damga + `src` dışı build girdilerinin (`global_hash`: font/lock/config/sync-core) eşitliği, satır ilgisi matrix fingerprint'inde (ilgisiz locale → reuse). Tarif = `ios_build.py` modülünün tamamı eksi yalnız `verify_fixture`; `ios.py`/JS tarif dışı | `test_inputs_outside_src_and_resume` (locale edit → reuse, font → recapture), `test_recipe_covers_build_helpers_only` (`_recipe()` digest eşitliği) |
| G25-R4 | Blocking read mutlak deadline'ı aşabiliyordu; filter byte doğrulanmıyordu; gecikmiş aynı-phase ACK "sonra" sayılabiliyordu. → `wait_bundle`: indirme worker'da, deadline'da soket shutdown, EOF zamanı da deadline içinde olmalı; PNG: her scanline filter ≤4, color/depth eşleşmesi, compression/filter/interlace 0; probe protokolü: her phase host probe token'ı taşır, ekran görüntüsünden **sonra** `reprobe()`, "sonra" raporu yalnız yeni token'ı yankılayan rapor (yeni phase fetch'inden sonra ölçülmüş); `sample` kaldırıldı, iç tekrar-gönderme tick'i rapora girmez | `PngTests` (filter 255, depth, filter method), `test_metro_deadline_is_absolute` (damlalı/geç EOF 1 s sınırda <1.5 s red), `test_match_and_server` (geç eski-probe raporu yeni probe için yok sayılır) |

**RED:** yeni testler FIX-R1 kaynak kopyasına karşı `logs/red-against-fix-r1.log`: 32 testte 3 FAIL + 11 ERROR
(çoğu yeni API yokluğu; davranış RED'i ayrıca reviewer `fix-r1/reviewer-probes.log`). **GREEN:** `logs/unittest.log`
65 OK (Sonnet matrix 33 dahil, değişmedi). `check` 0, capture tsc 0, ESLint 0, satır sayıları `line-counts.txt`
(en büyük test_capture 286, common 283), whitespace/tab yok, pycache yok.

**Temsilciler (taze):** `prepare-desktop` 0 (girdi kümesi değişti) → `desktop-smoke` PASS, PNG FIX-R1 ile
byte-aynı, browser PID kayıtlı ve `gone` → `desktop-resume` reuse 0. `prepare-ios` 0 → `ios-fixture` READY 8/8
(rebuild zorunlu: tarif tanımı bu turda bulgu gereği değişti), ürün `apps/mobile/ios` status aynı →
`ios-smoke` PASS 1206×2622, before/after probe farklı, active, fontScale 1; Metro `stopped`, kaçan torun yok,
watchman başlatılmadı → `ios-resume` reuse 0. `ios-cli-sigkill`: CLI exit 137 → gözetici CLEANED+FAIL,
Metro 0, Simulator listesi önce/sonra birebir. PNG gözle kontrol edildi.

**Sınırlar / açık:** gözetici de SIGKILL edilirse yetim süreçlere sinyal yok, RESTORE_PENDING (onaylı).
Playwright node sürücüsü ve kayıtsız Chrome yardımcıları ayrı kayıt değil; doğrulama browser PID+grubudur
(yardımcılar aynı grupta). Sinyalden önce zaten launchd'ye geçmiş torunlar `escaped` ile görülmez.
Scratch `~/Library/Caches/kloda-capture25`: 5.9G+3.3G+3.2G eski, 3.4G yeni READY; silme kullanıcı kararı.
Expo "Tools" overlay, tam matris, Faz3 görselleri (G1-07/G456-07/G24-07), F1 fix2, FO1 Faz4,
  step19/OS/fiziksel/release kapıları değişmedi.

## FIX-R3 review ve DECISION

[Engelleyiciler](review.md#fix-r3-engelleyici-bulgular): G25-R1 geç CLI
kesintisi hâlâ onay üretiyor; G25-R2 launch hatasında kanıtsız `gone` ve
kaçak kaydı teardown'dan sonra; G25-R4 boş zorunlu PLTE kabul ediliyor.
G25-R3 scoped çözüldü, G25-R5 unchanged. INITIAL ret=1; R1/R2/R4
başarısız FIX=3; R3 tarihî başarısız FIX=2; R5=0.
Taze: FIX-R2 baseline ve diff replay/final 16/16, PNG/Simulator/iOS status
eşleşmesi, `fix-r3/reviewer-probes.log` cihazsız karşıtları. 72 test, dar
kontroller, fixture, temsilci/smoke/resume/SIGKILL reuse. G25-02–05 açık,
G25-06 goal kapanmadı. Faz3/F1/FO1/step19 ve gerçek OS/fiziksel/release
kapıları değişmedi. **Tek sonraki adım:** aynı GPT sohbetinde DECISION;
kesinti/commit ve cleanup kanıt sırasını yeniden değerlendir, otomatik
dördüncü FIX devri yok.

## FIX-R4 — onaylı DECISION ve scoped devir

**Kota kesintisi sonrası KISMİ devir:** [fix-r4/handoff/CONTINUE.md](fix-r4/handoff/CONTINUE.md).
Güncel 16 kaynak hash'i ve 7 dosyalık R3→yarım R4 diff'i aynı dizinde.
Son kayıtlı koşu 68 test/1 FAIL (`fix-r4/logs/unittest.log`, exit 1); audit yeni
test/build çalıştırmadı ve kabul vermedi. Python satır sınırı şu an uygun (max 299).
Kullanıcı büyük bağlam yerine temiz Sonnet sohbetine dar devri onayladı; aşağıdaki
"mevcut sohbet" yönlendirmesi bu devam için geçersiz, FIX/sayaç/kapsam aynı.

Kullanıcı tek CLI onay karar noktasını ve teardown öncesi kalıcı kaçak kaydını
onayladı. [Sözleşme ve karşıtlar](../../plans/next-plan.md#fix-r4-onaylı-decision--onay-noktası-ve-teardown-öncesi-kayıt):
karar öncesi teslim edilmiş/bekleyen kesinti onayı engeller; karar sonrası
kesinti ancak atomik yazım tamamlandıysa onayı bozmaz. Gözlenen kaçak teardown
öncesi kalıcıdır; yazım veya sahiplik kanıtı yoksa nonzero/pending ve sinyal yok.

G25-R1/R2/R4 için **tek FIX-R4**; [son bulgular](review.md#fix-r3-engelleyici-bulgular).
Başlangıç HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`, `fix-r3/final-files.sha256`
referans; yeni başlangıç status/gerçek diff kaydedilir. Mevcut 16 dosya içinde
dar RED → minimum fix → GREEN; normal yol ispatlanamazsa kapsam kararı.
Ana uygulayıcı Sonnet 5.5, mevcut uygulama sohbeti. INITIAL ret=1; R1/R2/R4
başarısız FIX=3; R3 çözüldü (geçmiş=2), R5 değişmedi (=0). Ürün kodu,
fixture/tarif ve ertelenmiş kapılar değişmedi; devirde runtime/build NOT_RUN.

**19.11 checkpoint:** `finalized()` test fixture selection düzeltildi.
`fix-r4/logs/unittest-final.{log,exit}` 68/68 OK, exit 0; güncel
`fix-r4/handoff/source-final.sha256` 16/16 eşleşti. Başarılı suite yeniden
koşturulmadı. Desktop cleanup/iOS phase temsilci ve resume **NOT_RUN**;
review-ready değil, kabul ve sayaçlar değişmedi.

**19.11 temsilciler (taze; `fix-r4/logs/`, 68/68 reuse):** `prepare-desktop` 0 (mevcut Vite build, native yok) →
`desktop-smoke` PASS exit 0 (1440×1000; `playwright-driver`+`browser` ayrı, ikisi `gone`; cleanup 3 adım/0 hata;
`confirmation` var) → `desktop-resume` reuse 0. Mevcut `fix-r2/ios-fixture` ile (rebuild yok) `ios-smoke` PASS
exit 0 (1206×2622; Metro `stopped`; cleanup 6/6; `confirmation` var) → `ios-resume` reuse 0.
Ürün `apps/mobile/ios` status ve Simulator listesi önce/sonra aynı. Tam matris/SIGKILL tekrarı yok
(SIGKILL FIX-R3 `ios-cli-sigkill` reuse; FIX-R4 saf SIGKILL testi 68/68 içinde). Review-ready; kutu açık,
bağımsız GPT review bekler. Sayaçlar/ertelemeler değişmedi.

### 19.11 bağımsız FIX-R4 review

[G25-R2 engelleyicisi](review.md#fix-r4-engelleyici-bulgu): write-ahead
yazımı hatasından sonra retry `escaped:null` ile çöküyor veya önceki kaçak
listesi nedeniyle yeni gözlenen canlı kaçağı unutup `CLEANED` yazıyor.
G25-05 açık; G25-R1/R4 scoped çözüldü, R3/R5 yeniden açılmadı. Taze
baseline/final 16/16, PNG ve cihaz durum kaydı karşılaştırması, cihazsız
`fix-r4/reviewer-{retry,confirmation-and-png}.log`; 68/68 ve smoke/resume reuse.
INITIAL ret=1; R2 başarısız FIX=4, R1/R4 tarihî 3, R3 tarihî 2, R5=0.
Sonraki tek adım aynı GPT sohbetinde G25-R2 DECISION; otomatik FIX-R5 yok.
2.5 ve ertelenmiş Faz3/F1/FO1/step19/OS/fiziksel/release kapıları açık.

**19.11 FIX-R5 (G25-R2, onaylı; sayaç R2=4 korunur; `fix-r5/`):** `supervision.py` iki minimum değişiklik:
(1) `_persist_strays` yeni birleşik gözlemi yazım hatasında geri almaz ve her denemede yeniden `save()` eder
(RAM eşitliği durable kanıt değil; `escaped: null` → `or []`); (2) canlı unreaped handle yok + kayıt terminal değil
→ `verify_absent` yerine `unverified` pending, sinyal yok (driver-managed Desktop `verify_absent` yolu değişmedi).
`WriteAheadTests` → yeni `test_recovery.py` (16→17 dosya) + 3 yeni karşıt: yazım hatası+tekrar, yazılamayan gözlem→
gözetici kaybı→iki cleanup+resume exit 3, `escaped: null`. `test_supervisor_lost_then_retry` pending'e uyarlandı.
RED (R4 davranışlı varyantta; `logs/red-r4-behaviour*.log`): 3 yeni + 1 uyarlanan FAIL. GREEN: tam Python suite
**71/71 OK exit 0** (`logs/unittest.*`; 68+3), en büyük dosya 292 satır (`logs/line-counts.txt`), hash
`source-final.sha256`. Cihaz/native/smoke/resume tekrarı yok (19.11 smoke/resume, fixture reuse; Desktop receipt ve
iOS Simulator cleanup testleri suite içinde). Review-ready, kabul değil; kutu açık.

### 19.11 bağımsız FIX-R5 kapanışı

[Review ve G25-01–06 kanıt eşlemesi](review.md#fix-r5-bağımsız-devam-reviewu--19112026):
G25-R2/G25-05 scoped fix kabul edildi; önceki satır kabul/kanıtlarıyla 2.5
runner geliştirme goal'u kapandı. 17/17 final hash ve üç cihazsız iOS
retry karşıtı taze (`fix-r5/logs/reviewer-ios-retry.log`); 71/71 suite,
smoke/resume/fixture ve değişmeyen dar kontroller reuse. RED, eski
davranışlı varyant ve bağımsız FIX-R4 karşıtı, birebir final kopya değil.
INITIAL ret=1, R2 tarihî başarısız FIX=4; diğer sayaçlar korunur.
Tam matris/Faz3 görselleri ve F1 fix2, FO1 Faz4, step19, gerçek OS/fiziksel/
release kapıları açık. Sonraki iş yeni GPT plan sohbetinde Faz3; burada başlatılmadı.

## FIX-R2 review ve DECISION

[Engelleyiciler](review.md#fix-r2-engelleyici-bulgular): G25-R1 durable exit
onayı, G25-R2 kaçak torun/driver cleanup retry, G25-R3 çizilen locale anahtarı,
G25-R4 PNG chunk doğrulaması. G25-R5/G25-01 scoped kabulü değişmedi;
G25-02–05 açık, G25-06 goal kapanmadı. INITIAL ret=1; R1–R4 başarısız FIX=2,
R5=0. Taze: FIX-R1 16/16 kaynak kopyası, diff replay 16/16 ve final/PNG hash;
`fix-r2/reviewer-probes-followup.log` cihazsız karşıtları. 65 test ve dar
lint/typecheck/build/smoke/resume/SIGKILL kanıtı reuse; tam matris ve tüm
ertelenmiş kapılar korunur. **Tek sonraki adım:** aynı GPT review sohbetinde
DECISION; üçüncü FIX devri yok. Historical implementer Opus 5.5; sonraki
uygulama varsa güncel AGENTS model yönlendirmesi yalnız ileriye dönük.

## Onaylı DECISION ve scoped devir

Kullanıcı G25-R1/R2 için ayrı kalıcı çıkış onayını ve kanıtlanamayan süreçte
RESTORE_PENDING davranışını onayladı. [Karar ve durum geçişleri](../../plans/next-plan.md#g25-r1r2-onaylı-decision--kalıcı-çıkış-onayı-ve-kaynak-bazlı-cleanup)
önceki geçersiz varsayımların yerini alır: temizlik sonucu başarı yetkisi değildir;
root PID/PGID yokluğu başka kaynakların kapanışını kanıtlamaz. Mevcut Playwright
start/stop yolu ve süreç tablosuyla kaynak bazlı kayıt mevcut 16 dosya içinde
sınanabilir. Yeni API/dependency, scope veya ürün dosyası gerekmez; desteklenen
normal yol bu sınırda doğrulanamazsa workaround değil GPT kapsam kararı.

**FIX-R3 tek scoped tur:** [G25-R1–R4](review.md#fix-r2-engelleyici-bulgular),
start HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`,
başlangıç hash seti `fix-r2/final-files.sha256`; taze başlangıç status/diff
kaydı ve RED → minimum fix → dar GREEN. Mevcut uygulama sohbetinde ana
Sonnet 5.5 (`claude-agent/sonnet`); hassas cleanup/finalizasyon ana uygulayıcıda.
INITIAL ret=1, R1–R4 başarısız FIX=2, R5=0; karar bunları sıfırlamaz.
G25-R5 inventory/G25-01 değişmez; R3 yalnız reuse fingerprint'i ve karşıtı.
Bu devirde runtime/build NOT_RUN; geçerli fixture reuse, Faz3/F1/FO1/step19
ve bağımsız GPT review kapıları korunur.

## FIX-R3 uygulama — Sonnet 5.5, 18.11.2026

Uygulayıcı: Claude Sonnet 5.5 (`claude-agent/sonnet`, ana uygulayıcı; bu devirde alt ajan kullanılmadı).
Kanıt kökü `fix-r3/`. Başlangıç `fix-r3/baseline/` (HEAD 508b3f04, staged boş, FIX-R2 16/16 hash OK, 16 kaynak
kopyası `baseline/src/`). Son `fix-r3/final-files.sha256`; FIX-R2→R3 fark `fix-r3.diff` (8/16 dosya). Aynı 16 dosya,
yeni dosya/dependency/ürün dosyası yok; staged boş; 2.5 dışı status birebir. G25-R5 açılmadı (matrix.py,
test_matrix mantığı ve `ios*`, `apps/mobile/capture/*` byte-aynı; yalnız `matrix.json` desktop.settings `localeKeys`).
Sayaç: INITIAL ret=1; R1–R4 başarısız FIX=2 (karar sıfırlamadı), bu tur FIX-R3. Reddedilirse GPT tasarım değerlendirmesi.
Onaylı DECISION'ın tüm gerekleri **16 dosya içinde** uygulanabildi; kapsam kararı için durma gerekmedi.

| Bulgu | Kök neden → minimum düzeltme (onaylı karar uyarınca) | Karşıt (RED FIX-R2 → GREEN) |
| --- | --- | --- |
| G25-R1 | Gözeticinin yazdığı `CLEANED/PASS` tek başına geçerliydi; onayı yalnız canlı CLI bekliyordu, kayıt bırakmıyordu. → Gözetici **provisional** `finalization {gen, result}` yazar (`confirmation` boş). Yalnız doğrudan bekleyen, kesilmemiş CLI, **run lock'u altında**, kilit öncesi gördüğü nesille aynı nesli ve gözeticinin tam beklenen çıkış kodunu doğrularsa `confirmation {runID, gen, exit}` yazar (`common.confirmed`). Onaysız (CLI öldü/kesildi, çıkış uyuşmaz, nesil değişti, eski şema) → sonuç `unconfirmed` → cleanup doğrulanmışsa **CLEANED+FAIL**; offline `cleanup`/`resume` onay üretemez; `resume` onaysız run'ı reuse etmez (`unconfirmed`) | `test_matching_exit_is_confirmed_with_run_and_generation`, `test_cli_loss_exit_mismatch_and_generation_change_never_confirm` (CLI kesildi / exit uyuşmaz / lock yarışında nesil değişimi), `test_offline_cleanup_cannot_confirm_and_resume_refuses` (RED: `CLEANED/PASS` exit 0), `test_confirmed_result_survives_offline_cleanup`, gerçek normal CLI koşusu `confirmed` |
| G25-R2 | `verify_absent` yalnız kök PID/PGID yokluğuna bakıyordu; ilk cleanup'ın `escaped` kaydı okunmuyordu; Playwright sürücüsü ayrı kayıt değildi. → `verify_absent`: kök PID + (varsa) grup + kayıtlı **escaped torunların tümü** yoksa başarı, aksi `unverified`/pending, sinyal yok; `stop_owned` önceki denemelerin strayını korur. Desktop: `launch()` iki **ayrı intent** (driver `start()` öncesi, Chromium `launch()` öncesi) ve ayrı **receipt** (sürücü: gözeticinin doğrudan çocuğu, `/playwright/driver/` benzersiz gözlemi; Chromium: argv işaretiyle benzersiz gözlem — yalnız bulmak için, sinyal yetkisi değil); normal yol mevcut `browser.close()` + `playwright.stop()`, sonra her biri **ayrı** PID yokluğuyla doğrulanır; kimlik yok/belirsiz → receipt yok → pending; başarısız `start()/launch()` + hiç çocuk gözlenmemişse `gone`, çok aday `unverified` | `test_escaped_descendant_blocks_every_retry` (RED: CLEANED), `test_driver_and_browser_get_separate_receipts`, `test_browser_gone_driver_alive_or_unknown_stays_pending`, `test_intents_precede_start_and_launch`, `test_public_cli_sigkill_supervisor_cleans` (iki receipt `gone`) |
| G25-R3 | Satır fingerprint'i çizilen `ui.language`/`ui.languages.*` anahtarlarını içermiyordu. → `desktop.settings.localeKeys`'e iki önek; ilgisiz anahtar reuse | `test_desktop_settings_fingerprint_covers_rendered_language_keys` (RED: eşit digest; görünen dil adı/açıklama → recapture, `zzUnrelatedKey` → aynı) |
| G25-R4 | Yalnız CRC/boyut/filter; chunk yapısı doğrulanmıyordu (IEND verisi vb.). → `png_info`: tek IHDR ilk, tek **boş** IEND son, IDAT bitişik, bilinmeyen kritik chunk yok, PLTE ≤1 ve IDAT öncesi (palet imgelerde şart, gri tonlamada yasak, uzunluk %3) | `PngTests` (RED: `iend_data` kabul; `dup_ihdr`, `split_idat`, `critical`, `plte_gray/missing/after`; CRC-geçerli ancillary geçerli kalır; gerçek Desktop+iOS PNG'leri geçerli) |

**RED:** yeni testler FIX-R2 kopyasına karşı `logs/red-against-fix-r2.log`: 6 FAIL + 7 ERROR (davranış RED'leri yukarıda;
ERROR'lar yeni API yokluğu ve geçici kopyada olmayan uygulama ağacı). Önce cihazsız RED, sonra minimum düzeltme.
**GREEN:** `logs/unittest.log` 72 OK (Sonnet matrix 33 dahil). `check` 0, `list` 50 satır/600 hücre; TS/Ruby/ESLint dosyaları
değişmediği için önceki 0 kayıtları reuse. Satır sayıları `logs/line-counts.txt` (en büyük common 299, test dosyaları ≤300), whitespace/tab ve pycache yok.
Bir test gerçek Chromium/Playwright'ı gözetici dışı (test işlemi) başlatır; süreç sızıntısı kontrol edildi (0).

**Temsilciler (taze, fixture reuse — `ios_build.py` ve fixture girdileri değişmedi, rebuild yok):**
`desktop-smoke` PASS (1440×1000, PNG FIX-R2 ile byte-aynı; `playwright-driver` ve `browser` ayrı pid, ikisi `gone`;
`confirmation` yazıldı) → `desktop-resume` reuse 0. `ios-smoke` PASS (1206×2622, cleanup 6/6, Metro `stopped`, kaçak yok,
`confirmation` var) → `ios-resume` reuse 0. `ios-cli-sigkill`: CLI exit 137 → gözetici CLEANED+**FAIL**, `unconfirmed`,
Metro 0, Simulator listesi önce/sonra birebir, ürün `apps/mobile/ios` status aynı; o run'ın `resume`'u 1 (reuse yok).

**Sınırlar / açık:** gözetici de SIGKILL edilirse yetim süreçlere sinyal yok, RESTORE_PENDING (onaylı). `escaped` kaydı
yalnız PID listesi (kimlik/başlangıç zamanı yok): aynı PID başka süreç olarak yeniden kullanılırsa run pending kalır
(fail-closed; sinyal yok, elle müdahale). Sinyalden önce zaten launchd'ye geçmiş torunlar görülmez. Desktop receipt'leri
gözlem+kapanış kanıtıdır, imza/aidiyet kanıtı değil. Scratch `~/Library/Caches/kloda-capture25`: 4 fixture (~15.8G), silme
kullanıcı kararı. Expo "Tools" overlay, tam matris, Faz3 görselleri (G1-07/G456-07/G24-07), F1 fix2, FO1 Faz4,
step19/OS/fiziksel/release kapıları değişmedi.
