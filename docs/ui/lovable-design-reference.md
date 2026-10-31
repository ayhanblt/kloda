# Kloda — bağlayıcı Lovable tasarım referansı

30 Ekim2026 UI ara paketi: kullanıcının güncel Lovable tasarımı bu revizyonla
bağlayıcıdır. Roadmap sırası ve11/12/13/15/20/21 kabul kapıları değişmez.

- Proje UUID: `222ef478-8826-4712-b3c4-9703a823f69d`.
- Yayın kimliği: `lovp_58pzgrcxca9eprfz8zt9sjhg5h`; MCP latest screenshot URL ve
  yayındaki Edit with Lovable bağlantısı aynı kimliği doğrular. Ayrı proje değildir.
- MCP adı: **Kloda Secure Photo & Sync**; ürün adı **Kloda: Secure Photos & Sync**.
- Revizyon: `c144e98938da96f698f378972290ff3d1dd311eb`.
- Yayın: https://kloda-secure-photo-sync.lovable.app
- Dondurulmuş [manifest](lovable-reference/c144e98938da/manifest.json),
  [rota haritası](lovable-reference/c144e98938da/page-map.json),
  [ekran farkları](lovable-reference/c144e98938da/screen-diff.md),
  [uyarlama bulguları](lovable-reference/c144e98938da/adaptation-findings.json).
- Snapshot172kaynak dosyasıdır; script/install/build çalıştırılmaz. JPEG kaynakları
  özgün browser byte'larıdır; görüntülerdeki demo state gerçek Kloda verisi değildir.
- Önceki cb1143 snapshot Git dışı yerel ZIP’e hash/readback doğrulamasıyla arşivlenip
  kaldırıldı: [emeklilik kaydı](lovable-reference/c144e98938da/lovable-retirement.json).
  Bu ZIP bağımsız yedek değildir.

## Uygulama sözleşmesi

Renkler, tipografi, logo, spacing, bileşen biçimleri, navigasyon, durumlar ve
hareketler onaylı Lovable tasarımına uyarlanır. Genel bir benzeri yapılmaz. Yeni
revizyon geldiğinde revizyon/diff kaydı güncellenir; değişen ekranlar karşılaştırılır.
Ekran ailesi başına karşılaştırmalı görsel, responsive/a11y ve işlevsel kabul gerekir.
Native OS veya güvenlik sınırı birebir görsel/etkileşimi engellerse fark açıkça
bildirilir; tasarım sessizce değiştirilmez ve güvenlik gevşetilmez.

Lovable çıktısı web prototipidir: TanStack/backend/demo-store veya fixture QR/job
state mevcut Kloda native mimarisinin yerine geçirilmez. Demo %68 ilerleme,
saat, cihaz adı ve tamamlandı durumu gerçek native gözlem yerine kullanılamaz.
CSS/ikon/component kodu ayrıca kalite kurallarına uyarlanır; örneğin prototipteki
hardcoded marka/zaman/yüzde metinleri doğrudan sayfa kopyalamayı meşrulaştırmaz.
Tasarım onayı güvenlik, bulut auth, gerçek platform desteği veya fiziksel kabul değildir.

## Kod kuralları —28 Ekim teyidi

- Kullanıcıya görünen sabit metinler TR/EN/DE çeviri kaynaklarında tutulur.
  Başlık, düğme, placeholder, aria/a11y label, tooltip, toast, hata ve onay metni
  sayfa/JSX içine gömülmez. Kullanıcı dosya adı/kimlik gibi gerçek dinamik veri
  uydurulmaz; className ve teknik ID çeviri metni değildir.
- Sayfa/bileşen stilleri Tailwind; React Native’de mevcut NativeWind yolu.
  Yeni inline style/style prop, sayfa içi CSS veya sayfa içi StyleSheet eklenmez.
  Gerekli ortak CSS/token/keyframe global katmanda; dinamik varyantlar sınıf eşlemesi.
  Mevcut legacy stiller ilgili ekran uyarlanırken ele alınır; toplu alakasız rewrite yok.
  Native OS/SwiftUI uzantısına bu kural teknik olarak uygulanamıyorsa önce somut
  uyumsuzluk ve dar istisna kararı kullanıcıya sunulur; istisna varsayılmaz.
- Lucide ikonları; SVG logo varyantları ve azaltılmış hareket korunur.
- Frontend FSD, backend Clean Architecture/tek use-case dosyası korunur.
  Tek JSX içine bütün ekran/akış doldurulmaz; sorumluluk bazlı component/hook ayrımı.
- Mevcut zorunlu max-lines: **300**, boş satır/yorumlar hariç;
  `eslint.config.mjs` max-lines/error; `.omp/AGENTS.md` CI fail kuralı.
  Markdown bu sayıyı burada açıklar; yeni farklı bir limit icat edilmedi.
  Kodu sıkıştırmak veya tek satırlık dev JSX ile limiti aşmak çözüm değildir.

## Yeni kilit ekranı kapsamı

`src/routes/lock-screen.tsx` / `src/views/lock-screen.tsx`, iOS canlı etkinlik/
compact ada ve Android bildirim kartının **demo** görsellerini içerir.
Kullanıcının yeni geliştirme onayı **iOS Live Activities** içindir; Android’de yeni
Live Activities API’si var sayılmaz, mevcut servis bildirimi ayrı kalır.

Geliştirme19’da: ActivityKit/WidgetKit uygunluk ve extension/signing/deployment,
mevcut gerçek job/ACK/run bağlantısı, pause/wait/error/end/stale state, uygulamaya
geçiş ve kilit ekranı mahremiyeti değerlendirilecek. Lock ekranındaki dosya/hedef/
cihaz bilgisinin kapsamı ayrıca netleştirilecek. Karttaki Pause/Resume düğmesi native
OS/API/foreground ve mevcut yetki sınırları doğrulanmadan çalışır gösterilmez.
Live Activity upload yetkisi/background zamanı yaratmaz; gizli dosya okunmasını,
WhenUnlocked/Complete kontrollerini veya mevcut retry politikasını aşmaz.
Remote push/APNs veya yeni backend bu tasarımdan otomatik türetilmez.

## Yerel snapshot ve eski Stitch klasörü

[11. adım alım raporu](../implementation/lovable-design-intake-step11-2026-10-28.md)
ve [yerel frozen kaynak/asset snapshot’ı](lovable-reference/c144e98938da/README.md)
hazırdır:151 kaynak,7 doğrulanmış JPEG ve6 web önizleme capture. Kapsam/uyarlama
bulguları ve native karşılıklar raporda; kaynaklar app içine taşınmadı.

Kullanıcının kaldırma izniyle `stitch_private_photo_cloud/` kaldırıldı.15tasarım
ve5Finder metadata önce Git-dışı yerel ZIP’e alınıp hash/readback doğrulandı;
[geri dönüş/yedek kaydı](lovable-reference/c144e98938da/stitch-retirement.json).
Yerel arşivin bağımsız yedeği yok; source-of-truth artık Lovable’dır. Tarihsel
Stitch raporları geçmiş kanıt olarak korunur; yeni tasarım sayılmaz.

28 Ekim12 uyarlaması: [ortak kabuk/akış, gerçek kanıt ve açık native görsel kapıları](../implementation/lovable-ui-step12-2026-10-28.md). Galeri13 ve provider14+ ayrıdır; prototip demo durumları authority/veri kaynağı değildir.
