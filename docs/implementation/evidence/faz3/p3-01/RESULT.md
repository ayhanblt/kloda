# P3-01 eksik kısım — paketlenen JS, çeviri parity, statik kurallar (20.11.2026)

Durum: **PASS (kendi kapsamında; sınırlar aşağıda).** Variant metadata: `claude-agent/sonnet#medium` (Sonnet 5.5); reasoning_effort sayısından sonuç çıkarılmadı. Ürün/test dosyası, P3-02 artefaktı, ana MANIFEST/CURRENT/plan değişmedi; release/yayın yok. Commit/push, ayrı review yok.

## Aynı-girdi eşlemesi (reuse)
MANIFEST P3-01 satırı: mobil Jest 322/322, Desktop Vitest 377/377, mobil+Desktop `tsc` (3 proje), mobil+Desktop `npm run lint` hepsi **taze PASS, exit 0** (`logs/p3-01-*`). Bunlar **tekrar koşulmadı**. Lint kuralları (`eslint.config.mjs`): `max-lines` 300 (boş/yorum hariç, `src/**/*.{ts,tsx}` + Desktop `electron/**`) ve `eslint-plugin-boundaries` FSD katman izinleri (app→pages→widgets→features→entities→shared) → ≤300 satır ve FSD yön kontrolü lint exit 0 ile kapsanır.
Girdi eşitliği: klon `/private/tmp/kloda-p3-02` ↔ canlı `apps/mobile/src`, `apps/desktop/src`, `App.tsx`, `package.json`, `metro.config.js`, `babel.config.cjs`, `app.json`, `global.css`, `tailwind.config.js` `diff -rq`/`cmp` **boş**. Export klondan alındı (ürün/canlı `apps/mobile/dist` dokunulmadı).

## Eksik kontroller — taze sonuçlar
| Kontrol | Komut | Exit | Sonuç |
| --- | --- | --- | --- |
| Android paketlenen JS | klon `apps/mobile`: `CI=1 ../../node_modules/.bin/expo export --platform android --output-dir /private/tmp/p3-01-export/android` | **0** | `AppEntry-0f69d32b….hbc` (6.2 MB) |
| iOS paketlenen JS | aynı, `--platform ios` | **0** | `AppEntry-ceff0ef7….hbc` (6.2 MB) |
| TR/EN/DE parity (mobil+Desktop) | `python3 -I` yerel betik (`logs/p3-01-i18n-parity.py.txt`, repo dışı koşu) | **0** | mobil 694/694/694, Desktop 433/433/433 anahtar; eksik 0, `{{değişken}}` kümesi uyuşmazlığı 0, boş değer 0. Mobilde 9 string-olmayan değer (dizi/nesne türü) parity'ye giriyor, farklılık yok. |
| Lucide/ikon, Tailwind/NativeWind, stil | `python3 -I` statik tarama (151 non-spec dosya: mobil src+App.tsx, Desktop src+electron) | **0** | `lucide-react-native` 24 + `lucide-react` 9 import; başka ikon kütüphanesi 0; `StyleSheet.create` 0; `<style>`/styled-components/emotion 0; `style={{` 0. NativeWind: `babel.config.cjs` `nativewind/babel` + `jsxImportSource`, `metro.config.js` `withNativeWind` mevcut. |
| ≤300 satır (ham) | aynı tarama | 0 | tek ham >300: `apps/desktop/electron/runtime/pairing.ts` 305 satır; kural boş/yorum satırlarını saymaz ve lint exit 0 → ihlal yok (bilgi amaçlı). |
Loglar: `logs/p3-01-export-{android,ios}.{log,exit}`, `logs/p3-01-i18n-parity.{log,exit}`, `logs/p3-01-static-scan.{log,exit}`, `p3-01/export-hbc.sha256`.

## Dürüst kapsam sınırları
- Export **paketleme/derleme** kanıtıdır: Metro/Hermes bundle üretildi; çalışma zamanı davranışı değil (P3-03 ayrı kapsam).
- Parity yalnız anahtar/`{{var}}`/boşluk; çeviri kalitesi veya kullanılmayan/eksik `t()` çağrıları ve **sabit (hard-coded) kullanıcı metni** bu taramayla denetlenmedi → açık (ayrı kontrol gerekirse mevcut test/izin gerekir).
- Tailwind/NativeWind kontrolü yapı + yasak desen taramasıdır (yeni inline/StyleSheet yok); className uygunluğu veya görsel eşleme değildir (P3-10 alanı). Satır içi stil taraması yalnız `style={{`'i yakalar (`style={nesne}` değil).
- Desktop renderer `vite build` ve Desktop main ayrı (P3-00/02); önceki "iki CSS TS2882 exit 2" bu koşuda üretilmedi (MANIFEST notu), nedeni araştırılmadı.
- Android tam lint ve P3-05 ayrı.

## Cleanup
Yalnız kısa ömürlü host süreçleri; çalışan süreç yok (`pgrep expo export` boş). İzole çıktı `/private/tmp/p3-01-export/{android,ios}` (~6 MB ×2) bırakıldı (koordinatör istemedikçe silinmedi). Repo: yalnız yeni `evidence/faz3/p3-01/`, `logs/p3-01-{export-*,i18n-parity*,static-scan*}`; ürün dosyası değişmedi.

## Sonraki adım
Koordinatör MANIFEST'te P3-01 "açık" satırını güncellesin: paketlenen JS + parity + statik kurallar PASS (scoped); açık kalan: sabit metin/kullanılmayan anahtar taraması ve Desktop TS2882 fark nedeni. Sonra sıradaki bağımsız Faz3 satırına geçilir.
