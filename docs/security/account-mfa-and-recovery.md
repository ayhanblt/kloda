# Hesap, MFA, işlem doğrulaması ve recovery sözleşmesi

Belgeleme tarihi: 2026-10-04. [ADR 0006](../decisions/0006-account-mfa-and-recovery-policy.md) için kabul edilmiş güvenlik davranışını ve açık production gate'lerini saklar. Bu belge bir uygulanmış API/DB schema veya çalıştırılmış kabul testi değildir. Sağlayıcı özellikleri sessiondaki belge araştırmasıdır; bu konsolidasyonda live Supabase projesi/SDK/servis kurulmadı veya denenmedi.

## 1. Sağlayıcı ve gizlilik

**Supabase Auth + Postgres** seçildi; **NestJS** korunur, barındırma ayrı seçimdir. Hesap/cihaz/eşleşme metadata'sı merkezde tutulabilir; dosya byte'ları ve uç private encryption/possession key'leri tutulmaz. Plaintext dosya/album kataloğu, medya hash listesi veya merkezi dosya indeksi kurulmaz; listeleme izinli PC alanından yapılır. [PC/Photos metadata sözleşmesi](../product/computer-backup-files-and-photos.md) bu gizlilik sınırını tamamlar.

| Session kaynak araştırması | Tasarım sonucu / kanıt sınırı |
|---|---|
| Supabase parola salt+bcrypt; leaked-password kontrolü Pro+ | Kendi parola tablosu/hash algoritması yok; ücretli koruma varsayılan mevcut sayılmaz. |
| Auth TOTP ve aal1/aal2 | Opt-in MFA server-side uygulanır; SDK feature varlığı çalışan Kloda enforcement değildir. |
| Access JWT + dönen refresh token | İmza/issuer/audience/expiry/session doğrulanır, decode yeterli değildir. JWT parola saldırısını önlemez; rate-limit/parola/MFA/revoke ayrı. |
| Sign-out refresh yetkisini keser | Hâlihazırdaki access JWT expiry'ye kadar kriptografik olarak geçerli kalabilir; security state kontrolü gerekir. |
| Single-session-per-user | Mobil + PC birlikte kullanım için açılmaz. |
| Auth rate limits/Turnstile | Kendi backend limitleri doğrudan erişilebilir Auth endpoint'ini kendiliğinden korumaz. Auth ve Kloda girişleri ayrı değerlendirilir. |
| RLS / service_role | En az yetki ve RLS; service_role RLS bypass edebilir, yalnız backend'de. Admin bağlantısıyla query yapan NestJS kendi user/device authorization'ını uygular. |
| Edge Functions süre/CPU sınırları | Managed Auth/Postgres NestJS hosting'i yerine otomatik geçmez; dosya transport veya kalıcı relay Edge Functions'a taşınmaz. |
| Experimental passkey | İlk uygulama TOTP; production için tek zorunlu giriş yöntemi değildir, no-op passkey düğmesi eklenmez. |

Çalınmış/ele geçirilmiş uç cihaz riskini JWT/TOTP tek başına çözmez. Supabase JWT veya Cloudflare tunnel token E2EE key'i değildir. Hesap recovery private dosya key'lerini geri üretmez veya merkezden dağıtmaz.

## 2. Güven katmanları ve yüksek riskli işlem

| Katman | Kabul koşulu | Yerine geçemediği katman |
|---|---|---|
| Hesap session | Supabase user/session, trusted JWT validation ve güncel security/revocation state | PC onayı, peer key veya dosya alanı yetkisi |
| Cihaz güveni | Aynı hesap + belirli cihaz kimliğine bağlanmış PC onayı + izinli alan ve iptal edilebilir kalıcı kayıt | Yalnız login/cihaz adı veya server signaling |
| İşlem step-up | Taze ispat yalnız ilgili user/session/device/**işleme** bağlı; kısa ömür, tek kullanım, replay reject | Başka yüksek riskli işlem, genel AAL yükseltmesi veya dosya E2EE |
| Dosya kanalı | Bilateral peer doğrulaması ve güncel scope/operation authority | Supabase JWT/TOTP veya tunnel token |

Yeni istemci onayı, recovery/güvenlik ayarı değişikliği ve MFA kapatma gibi yüksek riskli işlerde aktif JWT/eski AAL2 bulunması taze step-up yerine geçmez. Cihaz onayı için alınan yetki MFA kapatamaz. İspatın tazeliği/güvence seviyesi ayrı değerlendirilir; her yerde “TOTP mi?” hardcode edilmez, fakat passkey veya yeni yöntem bu belgeyle benimsenmez. Face ID/Touch ID yalnız app kilidini açıyorsa server MFA yapılmış değildir.

### MFA kapalı hesap

- Mevcut parola yeniden doğrulanır **ve mevcut doğrulanmış e-postaya** tek kullanımlık kod gönderilir. Email değişiminde yalnız yeni adres kontrolü yeterli değildir.
- İspat user/session/device/işleme bağlanır; sınırlı ömürlü ve tek kullanımlı authorization olur. Exact süre/wire claim/ticket schema bu kayıtla seçilmez.
- Code/ticket loglanmaz; denemeler sınırlıdır. Bu kanıt TOTP/AAL2 diye etiketlenmez.
- Supabase email OTP flow session üretebilir; “kodu doğruladı, tüm işlere izin ver” yaklaşımı yoktur. Operation binding ve MFA açıkken bypass olmaması release gate olarak doğrulanır.

### MFA açık hesap ve normal kullanım

MFA tamamlanmadan normal hesap erişimi verilmez; yalnız UI kilidi yeterli değildir. Onaylı cihazda geçerli session ile normal backup/remote erişim her seferinde TOTP/biometri/user-presence istemez. Otomatik backup'ı her upload'da etkileşimli unlock ile bölmek seçilmedi.

## 3. İsteğe bağlı MFA onboarding

MFA ilk kurulum/normal yerel veya remote kullanım için genel zorunluluk değildir; güçlü opt-in önerisidir. Onboarding'de bir kez:

> Hesabını daha güvenli hale getir
>
> Kloda'ya yeni bir cihaz bağlanırken ikinci bir doğrulama isteyerek dosyalarını koru.
>
> [MFA'yı etkinleştir] [Şimdilik geç]

tr/en/de karşılıkları i18next locale dosyalarında bulunur. “Şimdilik geç” kaynak/program/PC onayı akışını engellemez; AAL veya security authority yükseltmez. Sonradan güvenlik ayarından açılabilir. Enroll → ilk başarılı TOTP doğrulaması bitmeden UI “MFA açık” demez. Peer pairing QR'ının zorunlu olmaması TOTP authenticator kurulumu için QR/manual secret kullanımını yasaklamaz; amaçlar farklıdır. Recovery reset sonrası zorunlu reenrollment'da “Şimdilik geç” yoktur.

## 4. MFA kaybında recovery sırası

1. **Tek kullanımlık recovery codes** birincil yöntemdir; MFA kurulumunda güvenli saklama istenir. Mevcut parolayı bilen, authenticator'ı kayıp kullanıcının kurtarma kanıtıdır; kod tek başına genel hesap parolası veya dosya key'i değildir.
2. **İkinci bağımsız authenticator** önerilir. Aynı kaybolabilecek cihazda iki uygulama bağımsız yedek değildir. Çalışan ikinci faktörle normal MFA doğrulaması tam recovery reset gerektirmez; kullanıcı kayıp faktörü güvenli biçimde değiştirebilir.
3. Tüm kodlar/faktörler kayıpsa **support-assisted recovery** son çaredir. Email erişimi, IP, device adı, geçmiş bilgisi veya support kanaati tek başına reset vermez.
4. Support yolu **önceden güvenilmiş cihazın kayıtlı private key'iyle taze challenge possession kanıtı + mevcut doğrulanmış email erişimi + tutarlı ek hesap sahipliği sinyalleri** birlikte ister. Önceden güvenilmiş cihaz yoksa veya kanıtlar çelişkiliyse güvenli otomatik reset yoktur.
5. Key cihazı terk etmez; support private key, dosya içeriği veya şifreleme key'i istemez. Kanıt/karar sınırlı erişimli audit kaydına alınır, şüpheli denemede reset yapılmaz. Operatör yalnız doğrulama akışını çalıştırır; client Admin API key veya serbest factor-delete endpoint'i almaz.

### Support için 24 saat hold

- Talep başında **mevcut doğrulanmış email** ve ulaşılabilen **önceden güvenilmiş cihazlar** bilgilendirilir; iptal/itiraz yolu sunulur. Yeni email veya talep sırasında eklenen cihaz eski trusted kanalın yerine geçmez.
- En erken reset: **talep başlangıcından 24 saat geçmiş + gerekli kanıtlar/manuel onay tamam + çözülmemiş iptal/itiraz yok**. Sürenin dolması reset hakkı değildir; yetersiz kanıt zamanla yeterli olmaz, riskli durum ek manuel inceleme ister.
- Talep açmak tek başına hesap/cihazları iptal etmez; saldırganın recovery talebiyle hesabı kilitlemesine izin verilmez. Kalıcı recovery-only kısıt ancak kabul edilmiş recovery kanıtından sonra reset uygulanırken konur.
- Review süre dolmadan başlayabilir; final reset tüm koşulları bekler. İtiraz/iptal/review/reset geçişleri yarışta tutarlıdır; iptal edilen talep timer ile yeniden uygulanamaz.
- Code self-service ve kayıtlı bağımsız backup factor **24 saat beklemez**. Code reset tam revoke/reenrollment'a tabidir; çalışan backup factor ile normal AAL2 login kendiliğinden bütün cihazları sıfırlamaz.
- Bu support güvenlik beklemesi ADR0003 offline LAN authorization penceresinden farklıdır; birbirini açmaz/uzatmaz.

## 5. Kabul edilen recovery reset sırası

Aşağıdaki adlar mantıksal güvenlik durumlarıdır, mevcut repository sembolü/endpoint/schema olduğu iddia edilmez.

| Sıra | Zorunlu davranış / hata sınırı |
|---|---|
| Kabul edilmiş kanıt tüketimi | Code atomik tek kullanım veya bütün koşulları tamamlanmış support kararı; ikinci bağımsız reset yaratılmaz. |
| Önce durable recovery-only fence | `recovery_required` tasarım durumu: normal hesap/dosya/device authorization kapalı; yalnız sınırlı recovery/enrollment. |
| Eski faktör ve code iptali | Supabase Admin API ile **tam eski MFA factor listesi** kaldırılır; tüm eski recovery code seti iptal edilir. Kayıp/ele geçirilmiş ikinci faktör bırakılmaz. |
| Session iptali | Bütün aktif hesap session refresh yetkileri sonlandırılır. Eski step-up yetkileri tekrar kullanılmaz. |
| Cihaz/pair iptali | Eski erişim/eşleşme onaylarının merkezi authority'si iptal edilir; geçmiş kimlikler audit için kalabilir, aktif yetki değildir. |
| Partial failure | Supabase + Kloda DB tek transaction değildir: aşamalar durable/idempotent ve fail-closed olur. Factor delete/global sign-out başarısızken “recovery tamamlandı” yoktur. |
| Yeniden giriş | Sonlandırılmış session enroll için kullanılmaz. Birincil giriş yeniden yapılır; recovery-only kısıtını aşmaz. |
| Zorunlu reenrollment | Yeni TOTP enroll + ilk başarılı doğrulama + yeni code setinin güvenli teslimi tamamlanmadan kısıt kaldırılmaz; skip yoktur. |
| Dosya erişiminin yeniden kurulması | Yeni MFA login eski pair'i canlandırmaz. PC'de yeniden onay + bilateral peer doğrulaması gerekir. |
| Korunan veri | Dosyalar ve mevcut uç private key'leri silinmez; kayıp key sunucudan geri üretilmez. |

### Access JWT ve offline PC sınırı

Global sign-out eski access JWT'lerini expiry öncesi kriptografik olarak iptal etmez. NestJS, varsa doğrudan erişilebilir DB/RLS ve PC file channel recovery/revocation state'i uygular; yalnız UI veya JWT expiry beklemek yeterli değildir. Verilmiş PC grant'leri merkezi recovery'den bağımsız sonsuza dek yaşayamaz.

Erken source kaydındaki **tüm PC yollarında anında merkezi recovery iptali** hedefi, sonradan [ADR 0003](../decisions/0003-secure-pairing-and-offline-authorization.md) ile nitelendirildi: merkez unreachable olan, önceden doğrulanmış **aynı scope LAN** peer'da, trusted elapsed upper `<24h` ve güncel token/install continuity koşulları birlikte varsa yalnız kalan pencere kullanılabilir. Central revoke offline PC'ye anında bildirilemez; öğrendiğinde durable deny uygulanır. PC local revoke hemen keser. Merkez açık deny döndürüyorsa eski offline allow'a fallback yoktur. Yeni cihaz/pair/scope/recovery/remote authorization bu istisnaya girmez. Böylece erişilebilen enforcement yollarının reset sırasında kapanması ile ulaşılamayan PC'nin sınırlı gecikmesi karıştırılmaz.

[ADR 0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md) merkez–PC authority/fence paylaşımını tanımlar; journal/file varlığı erişim yetkisi değildir, geçerli durable final sonradan iptal diye silinmez. Bu belge bu protokolü tekrar seçmez.

## 6. Experimental recovery-code production kararı

Session araştırmasında genel MFA referansı recovery code desteklenmediğini söylerken özel JavaScript generate referansı **`auth.experimental.recoveryCodes: true`** ve **`supabase.auth.mfa.recoveryCodes.generate()`**, plaintext'in yalnız bir kez verilmesini belgeliyordu. “Native feature hiç yok” sonucu yanlış; “generate örneği var, production hazır” sonucu da yanlış. Dashboard hesabının recovery feature'ı uygulama hesabıyla karıştırılmaz.

Önce kullanılacak gerçek proje/Auth sürümü ve JS SDK desteği birlikte doğrulanır. Aşağıdakiler açık **release gate**'lerdir:

- Production destek/uyumluluk taahhüdü; verify/tek kullanımlı consumption API.
- Eşzamanlı aynı-code isteklerinin yalnız bir kez kabulü; rate limit; eski setin yenilemede atomik iptali.
- Secret'ların log/DB/support sızıntısından korunması; yeni plaintext bir kez güvenli gösterilir, support paneli/loglar okuyamaz.
- Mevcut MFA varken consumption authority; factor-reset/global-logout/zorunlu reenrollment semantiği ve mobil+desktop SDK uyumu.
- Native yol genel AAL2 session üretse bile Kloda recovery-only/reset gate'ini atlayamaması; doğrudan Supabase endpoint'lerinin aynı policy'yi bypass etmemesi.

Gate'ler geçmezse production native experimental feature'a bağlanmaz. Seçilmiş **aynı** recovery-code davranışı Kloda backend'inde kriptografik rastgele kod üretimi, yalnız tek yönlü hash saklama, atomik tüketim, sınırlı deneme ve set yenilemede iptalle uygulanır. Bu koşullu fallback kabul edilmiş politikadır; algoritma/format/DB schema veya çalışan custom endpoint değildir. İki paralel sistem kurulmaz; native support varlığını değerlendirmeden custom çözüm başlatılmaz.

## 7. Secret storage ve entegrasyon sınırları

Session source incelemesi çalışan yeni auth implementasyonu göstermiyordu:

- API boş Nest `AppModule`/bootstrap idi; authentication backend'i var sayılmaz. [ADR0004](../decisions/0004-certificate-bound-capability-and-authority-responsibilities.md) role onayı bir endpoint implementasyonu değildir.
- Electron main/preload dar komut/snapshot bridge korunur. Auth secret/refresh token renderer'a açılmaz, raw arbitrary fs/URL/IPC yetkisi verilmez.
- Desktop safeStorage ve Linux `basic_text` reddi mevcut örnektir; account session WebDAV credential anahtarına yazılmaz, ayrı namespace gerekir.
- Mobile SecureStore WebDAV password için kullanılıyordu; account session ayrı key'ler ister. Native background storage ile etkileşimli biometric storage ayrı değerlendirilir; her upload'da biometric gerektirmek otomatik backup'ı bozar. OS storage seçimi tek başına non-exportable/hardware-backed/background uygunluğu kanıtlamaz.
- Sync-core interval/config/runtime portları account/MFA/device trust değildir. Placeholder native type dosyası gerçek API sayılmaz; empty auth adapter/no-op başarılı sonuç eklenmez.
- Backend interface→application→domain, infrastructure→domain port sınırı ve dosya başına tek use-case korunur; application katmanına Supabase SDK import edilmez. Native/key/hosting/schema ayrıntıları ayrıca tasarlanır.

## 8. Çalıştırılmamış kabul hedefleri

| ID | Gelecekte kanıtlanacak consumer-visible davranış |
|---|---|
| A01 | MFA kapalı yüksek riskli işte yalnız JWT/parola yeterli değil; doğru password+email code yalnız bağlı işlemde. Yanlış/eski/replay code ret. |
| A02 | MFA açık giriş completion öncesi normal access yok; eski AAL2 taze hassas işlem açmaz. Onaylı session normal otomatik backup'ı yeniden TOTP ile bölmez. |
| A03 | Aynı recovery code concurrent iki istekte yalnız bir reset başlatır; kesinti sonrası aynı işlem güvenle devam eder. |
| A04 | Reset access/refresh/old step-up ile normal API/DB/PC access açmaz; partial provider failure fail-closed ve gerçek state görünürdür. Offline PC için ADR0003 delay sınırı ayrı raporlanır. |
| A05 | Eski bütün factors/code sets/device approvals iptal; yeni MFA+code teslimi skip edilemez; code secret bir kez gösterilir, log/support'ta okunmaz. |
| A06 | Support yalnız email/stolen session/new device ile reset vermez; eski trusted-device ispatı fresh/replay-resistant ve key uçta. |
| A07 | Support 24h öncesi ret; 24h dolsa da eksik kanıt/approval/itiraz ret. Son anda cancel vs reset güvenli; cancelled timer yeniden reset yapmaz. Talep açmak DoS lockout yaratmaz. |
| A08 | Code/bağımsız backup-factor self-service beklemez; backup-factor normal login bütün cihazları resetlemez. Code reset revoke+mandatory reenroll uygular. |
| A09 | Recovery sonrası yeni login eski pairing'i diriltmez; PC onayı/peer doğrulaması gerekir; dosyalar/key'ler silinmez veya serverdan geri üretilmez. |
| A10 | Experimental native code doğrudan Supabase yolundan Kloda policy'yi bypass edemez; atomik consume/renew/rate-limit ve gerçek SDK/provider uyumu doğrulanır. |
| A11 | Operation-binding başka action/session/device'e taşınmaz; email-change yalnız yeni adresle açılamaz; MFA açıkken email OTP policy bypass yapmaz. |

Bu hedeflerin hiçbiri bu belgelemede çalıştırılmadı. Fiziksel Android transport veya native SAS/TLS kanıtı Supabase/MFA/recovery runtime acceptance değildir; hesap enrollment, trusted mapping, OS key storage ve production custody/hosting gate'leri açık kalır.

## 9. Kaynak haritası

| Session kaynağı | Bölüm/satır ve major claim |
|---|---|
| `local://kloda-computer-backup-plan.md` | 53–64 provider/Supabase resmi bulguları/MFA; 67–85 onboarding/katmanlar; 88–96 tarihsel integration boşlukları; 100–112 step-up/recovery sıra/support; 114–128 reset/native fallback; 130–147 acceptance/24h hold/device revoke; 242–261 confidential metadata/keys. |
| `local://kloda-security-discussion-plan.md` | 9–16 relay confidential hedefi, HTTPS/storage farkı ve bitmemiş upload; 35–37 danışma ≠ implementasyon. |
| ADR0003 | Offline LAN ve merkezi revoke/recovery delay, local revoke, file/key preservation; erken bütün PC yollarında anında revoke hedefini daraltır. |
| ADR0004 | Kabul edilmiş Nest control–PC enforcement ve açık production/enrollment/custody gate'leri; Supabase seçim ≠ çalışan entegrasyon. |

Session-local yollar tarihsel provenance'dır; durable politika/edge-case bu belgenin içindedir. Özgün kaynaklar ve PoC'ler değiştirilmedi. Aşağıdaki resmi URL'ler source sessionda okunmuş özelliklerin dayanağıdır; bu konsolidasyon yeni provider doğrulaması yapmaz:

- [Supabase TOTP/AAL/MFA](https://supabase.com/docs/guides/auth/auth-mfa), [JavaScript MFA genel referansı](https://supabase.com/docs/reference/javascript/auth-mfa), [experimental recovery generate](https://supabase.com/docs/reference/javascript/auth-mfa-recovery-codes-generate).
- [Password security](https://supabase.com/docs/guides/auth/password-security), [sessions](https://supabase.com/docs/guides/auth/sessions), [sign-out/access JWT sınırı](https://supabase.com/docs/guides/auth/signout).
- [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA/Turnstile](https://supabase.com/docs/guides/auth/auth-captcha), [RLS/service-role](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Experimental passkeys](https://supabase.com/docs/guides/auth/passkeys), [Edge Functions limits](https://supabase.com/docs/guides/functions/limits).
