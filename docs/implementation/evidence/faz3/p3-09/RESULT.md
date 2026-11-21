# P3-09 Android yerinde yükseltme — önkoşul eşleme (20.11.2026)

Durum: **PARTIAL / NOT_RUN (runtime koşulmadı)** — salt okunur önkoşul eşlemesi; AVD başlatılmadı, APK kurulmadı, veri değişmedi.
Variant metadata: bu çağrı `claude-agent/sonnet#medium` (Sonnet 5.5); reasoning_effort sayısından sonuç çıkarılmadı.

## Başlangıç aidiyeti
`adb devices` boş; çalışan emülatör/qemu yok (yalnız adb fork-server 45927, bana ait değil, dokunulmadı). Başka oturumun süreç/cihazı sonlandırılmadı. Kendi başlattığım tek süreç (`find / -name *.apk`) sonlandırıldı.

## Eşleşen önkoşullar
| Önkoşul | Sonuç | Kanıt |
| --- | --- | --- |
| Eski APK | **VAR, kanıtlı**: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, sha256 `1f873905da7f…98145`, 11 Kas 20:38, flag'siz B1/B3 varyantı, kaynak HEAD `650ec17f` | `evidence/b3-zeroize-2026-11-11/manifest.json` (startHead, sha256) ; P3-02 RESULT §2 aynı hash'i anıyor; `shasum -a 256` yeniden eşleşti (exit 0) |
| Paket kimliği | Eski ve taze: `com.kloda.app`, versionCode 1, versionName 0.0.0, arm64-v8a | `aapt2 dump badging` (build-tools 36.0.0) |
| İmza uyumu | **Eşit**: ikisi de v-imzalı, signer SHA-256 `fac61745dc09…3b9c` (debug keystore) | `apksigner verify --print-certs` |
| Taze aday | P3-02 APK `/private/tmp/kloda-p3-02/.../app-debug.apk` sha256 `2966a0d07bc6…dbfa` (dosya var, hash eşit); P3-02 artefaktı korundu | `android-artifacts.sha256` |
| Not | Aynı versionCode (1) → `install -r` debuggable debug imzalı için geçerli olur ama sürüm-artışı kanıtı vermez; "upgrade" yalnız aynı kimlik+imza+veri korunumu olarak sınanır. | |

## Eksik önkoşullar (koşuyu engelleyen)
1. **Onaylı normal yükseltme tarifi yok.** next-plan §3 P3-09 yalnız hedefi söyler; `faz3-research` satır 141 komut vermez. Tek temsilci için komut dizisi tanımlı değil.
2. **Sentetik mevcut kurulu durum yok.** Hedef/ayar/journal/fiş için eski APK'ya yazan hazır, izinli bir seed yolu yok (eski APK'nın androidTest'i yok; mevcut androidTest APK'sı taze adaya bağlı). UI ile tohumlama kapsamdaki "fixture yok" kuralını ihlal eder veya uydurma olur.
3. **AVD aidiyeti/kalıcılık çelişkisi.** Sahipli AVD `KlodaFtps16c` (API35 arm64) yalnız `-read-only` kullanıldı (p3-12 RESULT); read-only oturum çıkışta durumu atar, bu yüzden eski kur → tohumla → yükselt → doğrula tek boot oturumunda yapılmalı. `KlodaCloud18` user 0 `RUNNING_LOCKED`; `Pixel_9_Pro` aidiyeti kanıtlanmadı. Veri silme/kalıcı AVD yazımı yok kuralıyla uyumlu tek aday `KlodaFtps16c` read-only; ama madde 1–2 olmadan koşulmadı.
4. Recovery UI alt kontrolü: mevcut normal, kullanıcı yetkili Android göster/kopyala kanıtı **yok** (Kotlin migration/`recovery29` birim sınırı, yerine geçmez). Sır gösterme/kopyalama/loglama yapılmadı; NOT_RUN.

## Komut/exit
Yalnız salt okunur: `ls`, `grep`, `shasum -a 256`, `aapt2 dump badging`, `apksigner verify --print-certs`, `adb devices` — hepsi exit 0. Build/install/emülatör yok. Test/FIX sayaçları değişmedi.

## Cleanup / reuse
Cleanup gerekmedi (cihaz/süreç/dosya başlatılmadı). Reuse: B3 eski APK hash/HEAD, P3-02 taze APK hash'leri. Taze: imza/paket eşlemesi.

## Sonraki tek adım (DECISION → koordinatör)
GPT, P3-09 için tek temsilci tarifini belirlesin: (a) sentetik durumu eski APK'ya nasıl tohumlayacağı (mevcut izinli mekanizma/onaylı küçük androidTest veya UI adımı), (b) `KlodaFtps16c -read-only` tek oturum içinde `adb install` (eski) → tohum → `adb install -r` (taze `2966a0d0…`) → korunum doğrulaması, (c) aynı versionCode'un kabulü. Yoksa P3-09 açık kalır; sıradaki bağımsız satır P3-11.
