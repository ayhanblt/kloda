# ADR 0005 — Bilgisayar öncelikli genel dosya ve Photos yedekleme

> **Current V1 LAN override — 2026-10-13:** [ADR0016](0016-v1-pc-local-file-authority.md) replaces the account/enrollment/step-up/central capability prerequisites below with separate explicit PC-selected backup-scope approval and native local ACL; no folder means pairing only. Defaults allow photo-upload/status/finalize/list OWN backup/user-triggered restore, not delete/other-peer/outside-root. Broader Files behaviors below remain product intentions, not permissions granted by this ACL. Remote transport preference remains unchanged; FINAL remote authorization and recovery/central revocation versus offline PC/local grants are OPEN. No receiver/ACL implementation is claimed.

- Belgeleme tarihi: 2026-10-04; session kararlarının özgün günleri ayrı ayrı kayıtlı değil.
- Durum: Ürün davranışı kabul edildi; ürün implementasyonu ve remote dağıtım kabulü tamamlanmadı.
- Karar sahibi: Ayhan

2026-10-07 scoped supersession: [ADR0013](0013-qr-based-local-lan-pairing.md) ilk trust'ın QR-optional/account-first ifadesini backend-independent yerel QR ile değiştirir. Account file eligibility, dosya/Photos davranışı ve remote yönü korunur.

## Bağlam

NAS/WebDAV-first ilk dilimden sonra ana ürün odağı, router portu açtırmadan telefondan kullanıcının kendi bilgisayarına güvenli **genel dosya** yedeklemeye çevrildi. [ADR 0002](0002-first-vertical-slice-scope.md) tarihsel WebDAV dilimini kaydeder; o dilimin tamamlandığını veya yeni PC alıcısının mevcut olduğunu söylemez.

## Karar

1. PC ana hedeftir; WebDAV ve SMB gelişmiş seçenekler olarak korunur. SMB LAN-only kalır. İlk peer trust PC'nin yerel QR invitation'ını telefonda tarama, actual mutual TLS possession/PC SPKI eşitliği/aynı-channel secret proof ve explicit PC approval ile iki durable local pin kurma akışıdır; internet/backend/login gerekmez. File access için aynı Kloda hesabıyla eligibility, enrollment/step-up, bilgisayarda izinli alıcı klasör/scope seçimi ve capability ayrı gereklidir. Offline QR trust bu dosya grant'ini yaratmaz. Peer trust [ADR0013](0013-qr-based-local-lan-pairing.md), dosya yetkisi [ADR0003](0003-secure-pairing-and-offline-authorization.md) / [ADR0004](0004-certificate-bound-capability-and-authority-responsibilities.md) kapsamındadır.
2. **Live varsayılandır:** OS izin verdiğinde ilk fırsatta çalışır; kesintisiz gerçek zamanlı çalışma sözü değildir. 12/24 saat + yerel saat alternatifi seçildiğinde değişiklik tespiti anında upload başlatmaz, programın yürütme fırsatı beklenir. **Sync Now** ayrı kalır; manuel çalıştırma programı kaydırmaz. ADR 0001'in OS sınırları ve iki ayrı retry bütçesi korunur.
3. Temel mod tek yönlü backup + izinli PC alanında uzaktan listeleme/indirmedir. PC alanına elle eklenen dosyalar da telefonda görünür ve indirilebilir. Kullanıcı seçimiyle **Files çift yönlü sync** açılabilir; Photos'a uygulanmaz. Genel dosya desteği bütün telefon dosya sistemine erişim yetkisi değildir; birden fazla kaynak açıkça seçilir, Files için “Tümünü seç” eklenmez.
4. Files'ta çift yönlü silme geri alınabilir olarak yayılır; trash **30 gün**, normal güncellemelerin önceki sürümleri de **30 gün** korunur. Bağımsız değişikliklerde varsayılan iki sürümü korumaktır; başarılı koruma sonrası sync tamamlanabilir, açık conflict sayısı ayrı kalır. Korumasız silme/overwrite, sessiz retention kısaltma veya retry ile çoğalan conflict yoktur.
5. Duplicate/migrasyon yöntemi **SHA-256 içerik hash'i + kalıcı kayıt**tır. Yaklaşık 8.000 FolderSync dosyası ad/tarih/boyut eşitliğiyle atlanmaz; ilk gerçek byte doğrulamasından sonra mevcut içerik backup kaydına bağlanabilir. Bu seçim kullanıcının mevcut arşivinin tarandığı/değiştirildiği iddiası değildir.
6. Photos **backup-first** kalır: PC'deki değişiklik/silme Photos'a otomatik yansımaz. Tekil/toplu ve tüm erişilebilir Photos yedeğini kullanıcı başlatmalı geri yükleme desteklenir. Orijinal medya/resource'lar ile erişilebilir kullanıcı albümleri/üyelik/favori metadata'sı ayrı korunur; bu galeri/arama kapsamı veya tüm iPhone/iCloud state restore kararı değildir.
7. PC dosyaları Finder/Explorer ile kullanılabilen normal dosyalardır; immutable koruma kopyaları PC'de ayrı tutulur. Dosya/medya ve organizasyon metadata'sı uzak aktarımda E2EE kapsamındadır. PC at-rest gizliliği OS disk şifrelemesi/yerel erişim kontrolüne dayanır; Kloda encrypted-vault ürünü seçilmedi.

Ayrıntılı edge-case, retention, conflict, restore ve kaynak eşlemesi [ürün davranışı kaydında](../product/computer-backup-files-and-photos.md) normatif olarak korunur.

## Remote karar sınırı

Cloudflare Tunnel tarihsel tercih olarak kalır; TURN ile aynı ürün değildir. [ADR0012](0012-kloda-owned-p256-device-identity.md) remote için **WebRTC/DTLS + signed signaling/fingerprint + Kloda device mutual proof**, mümkünse direct P2P ve **Cloudflare TURN yalnız relay fallback** yönünü seçti. Bu provider setup/native adoption/background proof değildir. Kullanıcıdan router/DNS ayarı veya sağlayıcı hesabı istenmez; relay dosya saklamaz/plaintext okuyamaz. PC kapalı/uykudaysa cloud file store olmadan transfer tamamlanmaz, kaynak telefonda bekler.

Hosting, Cloudflare TURN credential/bootstrap/cost/limits/redundancy, dağıtılabilir native stack, signaling/DTLS↔Kloda identity/session binding ve gerçek account enrollment/platform/background kanıtları production gate'tir. WebRTC-only kesintisiz background garantisi seçilmedi. TLS/DTLS channel security zorunludur; varsa payload encryption ek defense-in-depth'tir, kanal yerine geçmez. Advanced WebDAV/SMB sınırları değişmez.

## Kanıt ve sonuç

Bu belgeleme yalnız mevcut karar/kanıt kayıtlarını konsolide eder; kod, test, build, cihaz veya cloud deneyi çalıştırılmadı. Baseline mobil/desktop dilimi tamamlandı sayılmaz. Fiziksel Android izole transport kaydı **14 pass / 1 direct-connectivity inconclusive**, `complete: false`, production-ready false; iOS simulator inconclusive / physical-device validation pending olarak kalır. Bunlar Files conflict/versioning, gerçek Photos restore veya hesap entegrasyonu kanıtı değildir.

## Kaynaklar ve tarihsel geçiş

- `local://kloda-computer-backup-plan.md` §§Context, Hesap güvenliği, Files, Photos, İçerik kimliği, Photos backup modeli, Şifreleme güven sınırları; durable içeriği ve satır eşlemesi ayrıntılı kayıttadır.
- `local://kloda-security-discussion-plan.md` §§Doğrulanmış durum/Verification: relay gizliliği hedefi HTTPS probe'unun veya tamamlanmış mobil upload'ın kanıtı değildir.
- `local://kloda-first-vertical-slice-plan.md` §§Context, Aktarım güvenliği, Verification: Live/migrasyon/versiyonlama dışlaması ilk dilime aitti; güncel ürün politikasını veto etmez.
- `local://kloda-transport-analysis-plan.md` §§Context/Tartışma sonucu ve `local://kloda-android-poc-scope-freeze.md` §§Verified checkpoint: remote aday ve sınırlı deney statüleri. Session-local yollar yalnız tarihsel provenance'dır; kararın anlaşılması onlara bağlı değildir.
