# Mac doğrulama maliyet değerlendirmesi — 17.11.2026

Pull: main `586a2fd5` → `508b3f04`, fast-forward; başlangıç çalışma ağacı temiz.
Kapsam: yalnız maliyet/önkoşul incelemesi. Test/build/lint çalıştırılmadı; yeni PASS yok.
1.4/B4 kapalıdır; Mac kuyruğundaki iş 1.4b/F1 fix2 ve 1.5 H15/P15'tir.
2.1/G1 bağımsız review kabulü korunur; tekrar test önerilmez.

## Ölçülmüş geçmiş / doğrulanmış ortam

- Yerel fix-r1r2 build-final/green/red logları: sıcak build 4/9/5 saniye.
  lint-3-scoped.log: 52 saniye, tam görev exit1 (scoped FTPS kabulü ayrı).
  Runtime loglarında güvenilir toplam wall-clock süresi yok; süre uydurulmadı.
- Xcode seçili, xcrun Swift derleyicisini çözüyor; JDK17, SDK API35, NDK,
  adb, Gradle wrapper, node_modules, eski AndroidTest çıktı ve FTPS asset mevcut.
  QEMU arm64 süreci çalışıyor; cihaz kilidi/izin/owned fixture hazır oluşu denenmedi.
  Disk 108.1 GiB boş. Android local.properties yok; SDK yolu ortam/build sırasında
  doğrulanmalı. Tam temiz build veya native matris başlatılmadı.
- fix2 final LF hash 6/6 eşit. 1.5 üç hash Windows CRLF biçimiyle 3/3 eşit;
  Mac LF farkı içerik değişikliği değildir.
- H15 scripti 19 üretim Swift kaynağı + stub + checks derler; seed/reopen için
  ayrı ayrı 20 saniye timeout vardır. swiftc timeout'u yok. Simulator, ağ sunucusu,
  tam iOS uygulama derlemesi gerekmez.

## Tahmin — mevcut kodun ilk seferde derlenip testlerin geçmesi koşuluyla

| İş | Makine koşusu tahmini | Hazırlık/kanıt dahil ajan oturumu |
|---|---|---|
| 1.5 H15/P15 tek host derleme + seed/reopen | 1–5 dakika | 5–10 dakika |
| F1 fix2 final/start varyant build, dar RED/GREEN, ilgili lint | 10–25 dakika | 30–60 dakika |
| 2.1/G1 | Tekrar yok | 0 |

Bunlar güncel benchmark değil; eski sıcak build, mevcut test beklemeleri ve
iş akışından çıkarılan planlama aralıklarıdır. Bağımsız review ve hata düzeltmesi
dahil değil. F1 compile/runtime hatası veya cache/native eksikliği olursa 60–120+
dakikaya çıkabilir; üst sınır garantisi yok. Yeni testlerin ilk compile/runtime'ı
henüz hiç yapılmadığından F1 belirsizliği yüksektir. Manifestte source-only kalan
owner fallback/delivery ve stale-result test anlam değişikliği de review'da açık
değerlendirilmelidir; yalnız suite GREEN kapanışı garanti etmez.

Token/Pro kota maliyeti UNKNOWN; dakika veya shell beklemesinden yüzde/token türetilmez.
1.5 düşük, F1 hata teşhisi çıkarsa yüksek ajan muhakeme maliyeti riski taşır.

## Öneri / kullanıcı kararı

1.5'i en fazla 10 dakikalık doğrulama penceresinde, hata halinde otomatik düzeltme
döngüsü açmadan ele almak ucuz seçenek. F1'i şimdi çalıştırma veya Faz3'e erteleme
kararını kullanıcı verir. Bu öneri mevcut F1→1.5 kuyruğunu kendiliğinden değiştirmez.
Tümü ertelenirse F1/1.5 doğrulama açık kalır; kabul/PASS yazılmaz. FO1 zaten Faz4'te.
Sıradaki: kullanıcı seçimi; bu oturumda hiçbir test başlatılmadı.

## Sonraki kullanıcı kararı ve ölçüm

Kullanıcı 1.5 için 10 dakika sınırını onayladı; F1 doğrulamasını Faz3'e taşıdı.
1.5 host komutu ilk koşuda **6.01 saniye, exit0**; H15/P15 PASS. Tahminin altında
tamamlandı; ürün değişikliği/düzeltme/tekrar yok. Kanıt backlog-1.5/mac-2026-11-17/.
F1 test/build/lint başlatılmadı. 1.5 bağımsız review açık; token/kota UNKNOWN.
