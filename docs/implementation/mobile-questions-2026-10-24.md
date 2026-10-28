# Mobil karar ve açık iş listesi — 24 Ekim 2026

2026-10-28 **Bağlayıcı tasarım ve Live Activities güncellemesi:** [Lovable proje/revizyonu](../ui/lovable-design-reference.md) MCP ile erişildi; kullanıcı bu tasarımı kesin UI kaynağı olarak onayladı. Eski Stitch kaynak değil tarihsel kanıt. Mevcut max-lines300 (yorum/boş satır hariç), TR/EN/DE metin anahtarları, Tailwind/NativeWind+global CSS, Lucide ve FSD/component kuralları teyit edildi. [Güncel plan](expanded-execution-plan-2026-10-28.md):18 bulut sonrası19 iOS Live Activities,20 bütünleşik hazırlık,21 son fiziksel kabul. Önceki20-adım özetler tarihsel. Ayrıntılı tasarım alımı/native uyarlama henüz başlamadı; klasör kaldırma yeni asset/source capture sonrasında. Bu güncellemede test/build/cihaz/Lovable üretimi yok.


2026-10-28 **Kullanıcı onaylı plan genişletmesi:** [Güncel20-adım sıra](expanded-execution-plan-2026-10-28.md).1–10 önceki kanıt sınırlarıyla korunur;11 Lovable/Stitch alımı,12 ana akış/kurulumu atla,13 galeri/detay,14 teknik karar matrisi,15 mobil WebDAV gönderici,16 SMB/SFTP/FTP,17 S3uyumlu/AmazonS3,18 diğer10bulut,19 bütünleşik/platform hazırlığı,20 toplu fiziksel kabul. Tüm42 tasarım kalemi ve16 protokol/sağlayıcı seçeneği izlenir; FTP/SFTP/auth/SDK/lisans/maliyet kararları verilmiş sayılmaz. Tasarım kullanıcıdan bekleniyor; bu güncellemede geliştirme/test/build/cihaz veya Lovable üretim komutu yok. Eski11 kabul atıfları tarihsel; kabul en sona taşındı.

Yeni soruların somut kapsamı [planın karar kapılarında](expanded-execution-plan-2026-10-28.md#karar-kapıları--şimdi-varsayılmayacaklar) tutulur. Sağlayıcı başına inceleme bitmeden auth/protokol desteği tahmin edilmez.

2026-10-28 **Mobil liste10 otomatik/izole kapsam:**108 test/11suite, lint/TS/iki export, tam iOS Simulator app build, Android Kotlin+modül K1 lint geçti. WebDAV probe belirsizliği mevcut profilde kalıcı; native typed disk-full ve safe-area/NativeWind/klavye/büyük-yazı görünümü düzeltildi. Native iOS görsel/256MiB staging örneği ve6 host görsel kontrol kaydedildi; fixture gerçek LAN/PC veya fiziksel kabul değildir. [Kapsam, kanıt, açıklar ve SDK config yan etkisi](mobile-integrated-step10-2026-10-28.md). Büyük koruma kopyasının receiver gecikmesi ölçülmedi; alan/cleanup, gerçek WebDAV sender, iPhone/OS/PC ve tam ekran okuyucu kabulü açık. [Android dar UI followup PASS](mobile-android-step10-followup-2026-10-28.md): normal debugging onayı,480×800 sentetik kaynak/PC/ACK/unknown ve farklı-PID profil/uyarı reopen doğrulandı; fiziksel/LAN kabulü değil. Liste11 başlatılmadı.


**27 Ekim liste6 takip:** [iOS Files kaynak/izole kanıt](ios-files-step6-2026-10-27.md) tamamlandı. Yeni ürün/güvenlik kararı seçilmedi; ADR0016/19/20 korundu. Gerçek provider/iCloud/iPhone-PC, orphan staging alanı ve güvenilir rebackup referansı bulunmayan durumlar açık kabul sınırlarıdır; otomatik retry/background liste8. Sıradaki liste7 Photos.

**27 Ekim güncel:** iOS locality sorusu kullanıcı onayıyla [ADR0020](../decisions/0020-ios-local-network-admission-and-native-pairing.md) kapsamında çözüldü. [Liste5 kaynak/Simulator ve gerçek app smoke tamam](ios-native-pairing-step5-2026-10-27.md); aşağıdaki eski açık-karar kayıtları tarihsel. iPhone/gerçek PC LAN ve sonraki liste6–8 hâlâ açık.

**26 Ekim takip:** Kullanıcı yalnız disposable API36 emülatörünü onayladı; [11 grup + ayrı-PID reopen doğrulandı](android-runtime-step4-2026-10-26.md). Aşağıdaki eski izin-bekleniyor/runtime-NOT_RUN kayıtları25Ekim tarihsel kapsamıdır. Gerçek PC/Doze/eskiOS/16KB/fiziksel kapıları bu sonuçla kapanmadı.

**Sonraki takip:** [lint kapanışı ve statik uyumluluk kanıtı](android-lint-and-compatibility-2026-10-25.md) ile explicit K1 tam lint ve dört ABI ELF16KB kontrolü PASS; aşağıdaki eski K2 BLOCKED kaydı tarihsel olarak korunur. Gerçek OS/cihaz kabulü ve kaynak tüketimi açıktır.

Kullanıcı [11-adım yürütme listesini](mobile-execution-checklist-2026-10-24.md) sabitledi. Liste1 iş/ayar ve liste2 arka plan owner/kuyruk otomatik/host kapsamda tamamlandı; liste3 kaynak uygulandı. Android lint araç engeli ve gerçek Android runtime kabulü açık. iOS kararı ayrı engeldir, bağımsız Android sırasının yerine geçmez.

Kullanıcı: onaylı bağımsız işlere adımlar arasında durmadan devam et; yeni karar
sorularını sabah toplu sun. Bu kayıt test veya platform kabulü değildir.

## Tamamlanan dar dilimler

- Android foreground kalıcı erişim retry ve doğru Activity görünümü: ayrı23 Ekim
  kanıtı; cihaz/background/program yürütme kabulü değil.
- Onaylı mobil PC-first Stitch uyarlaması:50 mobile test, lint/typecheck,
  iOS/Android JS export ve6 host önizleme; iOS native sender yapılmış sayılmaz.
- iOS bağımsız native ABI sözleşmesi/Swift decoder/paketleme çalışması:
  [güncel devir](ios-native-bridge-2026-10-24.md) sonuçları esas alınır. Gerçek
  owner/key/route/ağ/simulator/cihaz çalıştırılmaz. Platform kapıları açık kalır.

- İzinli iOS26.5 simulator: gerçek Rust/Swift ABI, decoder ve C-stub ownership
  exit0; [kapsam](ios-simulator-validation-2026-10-24.md). Canlı QR/aktarım veya
  gerçek cihaz kabulü değil; eski OS runtime açık.

- iOS native elapsed clock: mevcut Apple gövdesi iOS'a bağlandı; simulator2 clock
  ve7 ABI regresyon PASS. [Güncel provider/LAN kanıtı](ios-native-provider-progress-2026-10-24.md).

## Tek yeni karar konusu — iOS locality sözleşmesi

Önceki dar Network.framework tasarım sorusu kullanıcının sonraki adım talimatıyla
incelendi; [sonuç ve kanıt](ios-lan-transport-design-2026-10-24.md). Aynı tasarım
onayı tekrar sorulmayacak. localOnly yalnız inbound, proxy tercihi fallback'e
izin verir; byte adaptörü before-connect direct/no-gateway/change kanıtını sağlamaz.

**Yeni konu:** mevcut katı V1 koşullarıyla iOS LAN kanıtı beklenerek engelli mi
tutulacak, yoksa iOS'a özel desteklenen API'lere dayanan farklı locality güvenlik
sözleşmesinin garantiler/kayıplar/riskler içeren somut önerisi mi hazırlanacak?
İkinci yön henüz onaylanmadı; policy gevşetilmez, production bağlantı açılmaz.
İlk yön iOS teslimini tamamlamaz; bağımsız Android işleri ilerleyebilir.

## Karar değil, açık uygulama/kabul işleri

- iOS provider/installation backup exclusion ve gerçek foreground/lifetime bağları;
  C ABI’nin Expo/Swift uygulamaya güvenli kaydı. ABI derlemesi bunları sağlamaz.
- Files/Photos native queue, snapshot/ACK/resume, import/restore ve ADR0019
  suppression/rebackup; Android kaynakları yeniden yazılmaz, iOS'a yapılmış sayılmaz.
- iOS uygulama linkinde mevcut Swift system SQLite ile Rust bundled SQLite
  sembol/gerçek provider bağının doğrulanması gerekir; ayrı statik ABI paketinin
  linklenmesi final-app SQLite sağlayıcısı kabulü değildir. Henüz çözüm seçilmedi.
- Android/iOS background/Live/schedule, kalıcı OS retry ve ayar/program bağlamı;
  current phone providers kilitli cihaz background desteği kanıtı değildir.
- Android ADR0019 runtime, eski/current OS ve fiziksel/LAN/a11y/font kabulü.
- Mobile WebDAV atomik credential/config/test kaydı liste9 kaynak/izole doğrulamada tamam: [kanıt ve açık kabul](mobile-webdav-step9-2026-10-28.md). Byte sender, gerçek HTTPS/Android runtime ve yarım probe uyarısının restart kalıcılığı/reconciliation açık; ayrı advanced kapsam.
- Windows D3/diğer Desktop platform engelleri ayrı oturum/kayıtlarda açık.
- Media E2EE/key lifecycle, account/recovery, remote erişim, Files two-way/
  conflict/versions, migration ve geniş galeri/backlog sessizce düşürülmedi.

Git add/commit/push/reset/clean/stash yok. Kullanıcı arşivi/anahtar/pin/epoch/
authority verileri açılmadı veya değiştirilmedi. Fiziksel duraklatma sürer.

## 25 Ekim — liste3 yeni somut ürün sorusu

Otomatik plan/Live yürütmesi bağlanırken mevcut “Duraklat” yalnız mevcut çalışmayı
mı durduracak (sonraki planlı/Live fırsatta tekrar çalışabilir), yoksa kullanıcı
“Devam” diyene kadar otomatik yedeklemeyi de mi kapatacak? Mevcut manuel kuyruk
kodu bu davranışı belirlemiyor. Kullanıcı otomatik duruşun da Devam seçilene kadar sürmesini onayladı; Android
kaynak/host doğrulaması [liste3 kaydındadır](android-scheduling-2026-10-25.md). Bu soru mevcut5/60 erişim veya5/hedef5dk OS bütçesi kararını değiştirmez.

Liste3 kapanış sınırı: full Android lint, mevcut react-native-worklets KaModule
araç çökmesinde BLOCKED; gizlenmedi. Otomatik OS/runtime/cihaz kabulü liste4'te
açık. iOS locality kararı hâlâ yanıt gerektirir; yeni policy uygulanmadı.

Live fallback geniş arşivi tekrar okuyabilir; per-run üyelik metadata'sı dosya×çalışma
ile büyür. IO/pil/DB büyüklüğü ve retention/optimizasyon kabulü liste4/10'da açık,
gerekli iştir. Temizlik politikası kendiliğinden eklenmedi.

## Liste4 takip —25 Ekim

[Statik/host sonuç ve kaynak tüketimi](android-validation-step4-2026-10-25.md). Yalnız disposable API36 emülatöründe runtime için ayrı kullanıcı izni soruldu; yanıt bekleniyor. Fiziksel duraklatma aynı. Metadata retention/özetleme veya Live tarama sıklığı değiştirilmedi;8.000dosya×12run sentetik üyelik modeli yaklaşık15MB ek kayıt gösterir. Gerçek Android pil/disk kabulü açık. iOS locality sorusu ayrıca korunur.

## 26 Ekim fiziksel çalışma

Kullanıcı physical liste4 onayını verdi, USB yetkilendirdi; receiver bu Mac, telefon günlük profil. [İlerleme](android-physical-step4-2026-10-26.md). Bekleyen somut bilgiler: telefon manuel unlock/ekran açık; Apple Developer üyeliği/provisioning. Mevcut Electron entitlements/team/profile yok. Kişisel medya tarayan testler çalıştırılmaz; testte yerel4 grup ve PID reopen geçti. FGS visible/focus önkoşulu sağlanamadı. Scope dışı platform/physical grupları açılmadı.

### Fiziksel soruların yanıtı ve kapanan telefon kapsamı

Kullanıcı ücretli Apple Developer üyeliği olmadığını teyit etti; Mac receiver signing/readiness engelli kalır. Manuel unlock sonrası aynı test APK’sıyla5 yerel grup PASS; bildirim izni geri alındı, yeni test paketi kaldırıldı. Unlock sorusu çözüldü; bu konuda yeniden onay istenmez. GerçekAndroid-Macaktarım yapılmadı. [Final durum](android-physical-step4-2026-10-26.md).
