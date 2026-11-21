# P3-10 M13-alt — gerçek etkileşim yolu uygulanabilirliği (salt okunur, 20.11.2026)

Variant: `claude-agent/sonnet#medium` (Sonnet 5.5). Build/capture/fixture/cihaz/ürün/araç değişikliği yok; ref/fiber/DOM tekrarı yok. `mobile.settings-bottom` state_unavailable ve 5 FAIL korunur. MANIFEST/CURRENT/plan değişmedi.

## Sonuç (tek cümle)
iOS'ta **mevcut hiçbir yolla** "normal kullanıcı kaydırması + gerçek alt bölüm görünür" ayrı olarak kanıtlanamıyor: eksik somut yetenek **Simulator'a gerçek dokunma/kaydırma girdisi göndermek**; en dar kapsam, kalıcı olmayan tek bir izinli girdi enjeksiyon yolunun onaylanması.

## Gerçekler (kaynak/komut kanıtı)
1. **Alt bölüm gerçekten ekran dışında.** `SettingsPage` = `MobileSurface` içinde tek `ScrollView` (`widgets/mobile-surface/ui.tsx`); sırayla Yedekleme, Gizlilik, **Görünüm+Dil**, Arka plan, Kurulumu yeniden çalıştır, **Hakkında/sürüm** (`pages/settings/ui/settings-page.tsx`, 59 satır). Mevcut iOS PNG `backlog-2.5/ios-smoke/mobile.settings__tr__light__normal.png` (402×874 pt, fontScale 1) yalnız Yedekleme + Gizlilik'in başını gösterir; alt tab çubuğu içeriği keser → alt bölümler ekran dışı (yani M13-alt görsel olarak gerçek ve henüz görünür değil).
2. **Capture yolu girdi göndermez.** `tools/ui-capture/ios.py` yalnız `simctl ui appearance|content_size`, `launch --initialUrl`, `io screenshot` kullanır; ekranı Metro `/phase`+`/report` ile ilerletir. Kaydırma yalnız JS içi (ref/fiber/DOM) olabildi → 5/5 FAIL, tekrar yok.
3. **Host araçlarında dokunma/kaydırma yok:**
   - `xcrun simctl` alt komutları: `io` (yalnız ekran görüntüsü/kayıt), `ui` (appearance/content_size/increase_contrast), `launch/openurl/privacy/pbcopy/push/keychain/spawn…`; **tap/swipe/HID yok**.
   - `idb`, `idb_companion`, `maestro`, `cliclick`, `applesimutils`, `axe` kurulu değil (yeni kurulum yasak).
   - `osascript` var ama `System Events` sorgusu AppleEvent zaman aşımı (-1712) verdi → Erişilebilirlik/otomasyon izni doğrulanmadı; Simulator penceresine fare sürükleme **kanıtlanamadı** (izin vermek/istemek kullanıcı güvenlik kararı).
   - `xcodebuild` + `XCTRunner.app` mevcut ama repoda **UI test hedefi yok** (`apps/mobile/ios` içinde `*UITests*` yok); XCUITest = yeni hedef + yeni build + yeni imza → "yeni build/fixture" sınırı dışı.
4. **Fixture ek engeli:** `ba35dad4…` geçersiz (`recipe` girdisi; `ios-representative/RESULT.md`); ayrıca fixture dev-client menüsündeki yüzen "Tools" düğmesi (PNG'de sağ üstte) alt/üst ölçümü kirletir.
5. **Referans:** `lovable-c144-preview/mobile-settings.jpg` (506×1142 web tam sayfa) M13 yapısı içindir; native eş veya alt-durum kanıtı değil (README: web prototip, rozet kalabilir) → yalnız yapı karşılaştırması; PASS dayanağı olamaz.
6. **Android yolu ayrı platform:** adb `input swipe` + `uiautomator dump` ile gerçek kaydırma teorik olarak mümkün (adb mevcut, P3-02 ürün APK var), ama matrisin `android-legacy` sürücüsü çalıştırılamaz/tarihî ve satır iOS; Android iOS'un yerine kabul edilemez (plan §3 P3-10).

## Karar seçenekleri (koordinatör/GPT; kapsam değişikliği olduğu için benden bağımsız)
- **A. Dar izinli plan (öneri, yalnız kullanıcı onaylarsa):** tek kullanımlık, repo-dışı bir gerçek-girdi yolu — (1) önce `prepare-ios` ile geçerli fixture (recipe kimliği; ~4 dk, mevcut komut) **veya** P3-02 ürün Debug `.app` + dev-client; (2) sahipli run-created Simulator, `iPhone 17 Pro`, TR/light/normal (tek hücre; ardından en/de, dark, large için ayrı); (3) macOS erişilebilirlik izni açıkça verilirse `osascript`/Quartz ile Simulator penceresinde dikey sürükleme, aksi hâlde izinli minimal XCUITest hedefi (yeni build onayı); (4) ölçüt: kaydırma sonrası PNG'de "Hakkında/Yapılandırma sürümü" satırı alt tab çubuğunun üstünde tam görünür, bir önceki PNG'den farklı ve ilk PNG'de görünmezdi (iki PNG + hash), üst kenar sabit, taşma/kırpma yok, font/boyut ölçümü mevcut report'tan; (5) cleanup: simctl delete + Metro durdur + izin/yan etkileri geri al.
- **B. Mevcut durumda kal:** M13-alt `state_unavailable` + 5 FAIL; görsel kabul açık kalır; yeni yetenek yok.
- **C. Android ayrı satırı:** adb swipe + uiautomator dump ile Android M13-alt temsilcisi (ayrı kabul satırı, iOS yerine geçmez).

## Sonraki tek adım
Koordinatör/kullanıcı A (hangi girdi yolu: erişilebilirlik izni veya XCUITest build) / B / C'den birini seçsin; seçim gelmeden M13-alt koşusu açılmaz.
