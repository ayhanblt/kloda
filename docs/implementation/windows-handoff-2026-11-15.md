# Windows devam checkpoint'i — 15.11.2026

Aktif iş: CURRENT.md FIX/READY, yalnız 1.4b/F1 R13/R14. Sözleşme:
`plans/f1-r13-r14-clock-reconcile-fix.md`. R13 temsilci/minimum fix önce;
R14 sonra yalnız etkilenmiş doğrulama. S3 henüz kabul edilmedi; FTPS F1 ayrı açık.
B1/Jest/B3/B4 kabul kayıtları korunur. Bu kayıt ve toplu commit bir release/PASS değildir.

## Windows'a taşınan / taşınmayan

Git clone/pull ile kaynak, proje AGENTS, .opencode komut/skill dosyaları, planlar,
manifest ve izlenen kanıtlar gelir. OpenCode sohbet geçmişi ve global home ayarları,
provider oturum açmaları Git'te değildir. Windows'ta sağlayıcılara yeniden giriş
yap, komutların model ID'lerinin kullanılabilirliğini doğrula; gizli auth dosyalarını
repoya kopyalama. Proje kökünü OpenCode'da aç; eski transcript'i taşımak gerekmez.

Ignored .log/APK/native artifact/fixture, node_modules, üretilmiş Android/iOS
projeleri ve macOS emulator/SDK yolları bu push ile taşınmaz. Kanıt manifestinde
adı geçmesi Windows'ta dosyanın mevcut olduğu anlamına gelmez. Eksik kanıtı PASS
sayma; gerekiyorsa Mac'teki kayıtları hedefli getir veya yalnız etkilenen doğrulamayı
yeniden üret. Hiçbir fixture hesabı/gerçek kullanıcı verisi/anahtarı otomatik taşıma.

## İlk Windows sohbeti (GPT / salt-okunur ortam kontrolü)

“AGENTS.md → CURRENT.md aktif işi → windows-handoff-2026-11-15.md oku.
Yalnız R13/R14 uygulaması için Windows ortam/fixture hazır oluşunu kontrol et:
Git/Node paket yöneticisi/JDK/Android SDK ve disposable emulator, gerekli mevcut
native artifact ve kayıtlı scoped komutların Windows karşılıkları. Mac mutlak
yollarını veya emulator-5590'ı varsayma. Eksik kurulumları ve kanıtları listele;
onaysız kurulum, ürün değişikliği, tam build veya test matrisi yok. Hazırsa yeni
Opus /implement devri ver; değilse en küçük ortam hazırlığını belirt.”

Windows Android/JS/Desktop çalışmasına uygundur; Xcode/iOS derleme doğrulaması
Mac'te kalır. İki makinede aynı işin eşzamanlı uygulanmasını önle; makine değişmeden
önce mevcut değişikliği commit/push, diğerinde temiz ağaçta pull ile al.

## Goal önerisi — yeni kapsam kararı değil

“F1'i bitir” yerine R13 için stale stop'un yeni owner/fence'i değiştirmemesi ve
R14 için kanıtlanmış clock commit'in yeniden CAS/due hesabı yapmaması gözlenebilir
hedeflerdir. Her hedef: başlangıç→olay→beklenen state/yan etki + negatif test +
korunan komşular. Review mevcut sözleşmeye bağlanır; yeni ürün hedefi sessizce
eklenmez. Kabul engelleri düşürülmez. Kalıcı çözüm yalnız goal etiketi değil,
ortak state-transition tablosu ve aynı invariant ailesinin tüm ilgili girişlerinin
hedefli doğrulanmasıdır. Yeni mimari/refactor kapsamı ayrıca onay gerektirir.
