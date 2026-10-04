# ADR 0006 — Hesap sağlayıcısı, isteğe bağlı MFA ve recovery politikası

- Belgeleme tarihi: 2026-10-04; özgün session seçimlerinin ayrı tarihleri kayıtlı değil.
- Durum: Sağlayıcı ve güvenlik davranışı kabul edildi; entegrasyon/production kabulü tamamlanmadı.
- Karar sahibi: Ayhan

## Karar

1. **Supabase Auth + Postgres** hesap sağlayıcısı/metadata deposudur. NestJS korunur; hosting ayrı karardır. Kendi parola tablosu/hash implementasyonu kurulmaz. Auth/DB hesap, cihaz ve eşleşme metadata'sını tutabilir; dosya byte'ları, uç private key'leri, plaintext medya/album kataloğu veya medya hash listesi tutulmaz. Dosya listeleme izinli PC alanındadır.
2. MFA genel kurulum/normal yerel veya remote kullanım için zorunlu değildir; güçlü önerilen **opt-in TOTP** sunulur. MFA açılmış hesapta doğrulama tamamlanmadan normal hesap erişimi yoktur. Onaylı session/cihazda her remote işlem/otomatik backup için tekrar TOTP/biometri istenmez. Enroll + ilk başarılı doğrulama öncesi UI “MFA açık” demez.
3. Yeni istemci onayı, recovery/güvenlik ayarı değişimi ve MFA kapatma gibi yüksek riskli işlemler **taze, kullanıcı/session/device/işlem-bağlı step-up** ister. Eski JWT/AAL2 yeterli değildir. MFA kapalı hesapta mevcut parola + **mevcut doğrulanmış e-postaya** tek kullanımlık kod seçildi; bu TOTP/AAL2 diye etiketlenmez, yeni adres tek başına yeterli değildir. Kısa ömürlü, tek kullanımlı işlem yetkisi başka işleme taşınamaz/replay edilemez.
4. MFA kaybında sıra: **tek kullanımlık recovery codes** → önerilen **ikinci bağımsız authenticator** → son çare **support-assisted recovery**. Recovery code mevcut parolayı bilen ama authenticator'ı kayıp kullanıcı içindir; genel giriş parolası veya dosya anahtarı değildir. Çalışan ikinci faktörle normal giriş tam reset gerektirmez.
5. Supabase experimental recovery-code API varlığı kaynakta belgelenmiştir; production uygunluğu kanıtlanmadı. Native destek/atomik tüketim/SDK/policy-bypass gate'leri geçerse tek sistem kullanılır. Geçmezse aynı davranış backend'de kriptografik rastgele kod + tek yönlü hash + atomik tüketim + sınırlı deneme + set yenilemede iptalle uygulanır. İki paralel recovery sistemi veya sırf genel dokümanda yok denildi diye erken custom implementasyon yoktur.
6. Support reset önceden güvenilmiş cihaz key'inin taze possession kanıtı + mevcut doğrulanmış e-posta + tutarlı ek sahiplik sinyalleri + manuel onay ister. Yalnız email/IP/cihaz adı/geçmiş bilgisi/operatör kanaati veya çalınmış session yeterli değildir. Private key, dosya içeriği veya şifreleme key'i support'a verilmez.
7. Support için **24 saat security hold**: talep başlangıcından 24 saat **ve** tamamlanmış kanıt/manuel onay **ve** çözülmemiş itiraz/iptal yokluğu gerekir. Süre dolması reset hakkı değildir. Eski doğrulanmış email/ulaşılabilen eski güvenilmiş cihazlar bilgilendirilir. Talep açılması tek başına hesabı/cihazları kilitlemez. Code/backup-factor self-service bu beklemeye tabi değildir.
8. Kabul edilen recovery reset önce kalıcı recovery-only kısıtı koyar; tüm eski MFA faktörleri/code setleri, aktif session refresh yetkileri ve cihaz/eşleşme onayları iptal edilir. Yeni birincil giriş recovery kısıtını aşmaz. Yeni TOTP + ilk doğrulama + yeni code setinin güvenli teslimi olmadan normal erişim açılmaz; burada “Şimdilik geç” yoktur. MFA ile yeniden giriş eski pairing'i canlandırmaz: PC onayı + peer doğrulaması yeniden gerekir. Dosyalar/uç private key'leri silinmez veya sunucudan geri üretilmez.

## Enforcement ve kanıt sınırı

JWT decode/signature/expiry, hesap oturumu, device trust, operation step-up ve E2EE ayrı katmanlardır. UI-only engel yeterli değildir. Global sign-out mevcut access JWT'lerini kriptografik olarak anında iptal etmez; NestJS, varsa direct DB/RLS ve PC enforcement gerekir. **Çevrimdışı PC'ye merkezi recovery anında ulaştırılamaz:** ADR 0003'ün mevcut aynı-scope LAN için dar kalan `<24h` istisnası erken tüm-PC-anında-iptal hedefini nitelendirir. Yerel revoke/öğrenilmiş deny hemen uygulanır; remote/new pair/recovery bu istisnaya giremez. Support hold ile offline erişim penceresi farklı saatlerdir.

Ayrıntılı state sırası, concurrency, native/custom recovery gate'leri, secret storage sınırı ve çalıştırılmamış kabul hedefleri [hesap güvenliği sözleşmesinde](../security/account-mfa-and-recovery.md) korunur. [ADR 0003](0003-secure-pairing-and-offline-authorization.md) pairing/recovery delay; [ADR 0004](0004-certificate-bound-capability-and-authority-responsibilities.md) merkez–PC authority paylaşımının kaynağıdır; burada yeniden protokol seçilmez.

Bu kayıt uygulanmış Auth backend, MFA UI, recovery endpoint, native storage veya production güvenliği iddiası değildir. Experimental passkey production bağımlılığı, dummy passkey düğmesi, yeni MFA servisi/hosting/KMS seçimi yoktur. Bu belgelemede kod/deney/build/test çalıştırılmadı.

## Dayanak

`local://kloda-computer-backup-plan.md` 47–147: sağlayıcı, MFA/step-up, recovery, reset, experimental fallback ve hold seçimleri; 242–261: metadata/key gizliliği. Ayrıntılı belge aynı iddiaları kalıcı metin ve resmî kaynak bağlantılarıyla taşır. Session-local kaynak yalnız tarihsel provenance'dır, kararın tek kalıcı bağımlılığı değildir. Sağlayıcı belgelerindeki özellikler session araştırmasıdır; güncel service/project/SDK behavior ve release gates bu konsolidasyonda yeniden doğrulanmadı.
