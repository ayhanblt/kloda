# Backlog 1.5 — dar araştırma / 16.11.2026

Sözleşme: [next-plan.md §1.5](next-plan.md#15--regresyon-hazırlığı-uygulama-sözleşmesi--16112026).
Bu ek goal/kabul kaynağı veya uygulama yetkisi değildir.

## L15 — kaynak engeli

Önceki kanıt:
`../evidence/s3-native-step17-2026-11-03/verification-2026-11-04/license-source.json`
üç tam metni eksik kaydeder; cesu8 tek exact-tree araması sonuçsuzdur.
Mevcut notices hâlâ aynı üç unavailable bölümünü içeriyor.
04.11 notices/inventory/JNI metni hash'leri LF-normalize mevcut içerikle eşit;
Windows CRLF byte farkı içerik değişikliği sanılmadı. Eski JNI araması tekrarlanmadı.

Dar dış soru: cesu8 1.1.0, instant-xml 0.7.7, instant-xml-macros 0.7.2 için
sürüme bağlanmış tam lisans metni resmî kaynaktan temin edilebiliyor mu?
Araştırma proje kodundan bağımsızdır; kod/kök neden ana GPT tarafından incelendi.

Delegasyon: `opencode/inkling-2-small-free#low`, katalog aktif ve input/output/cache
fiyatı 0; tek çağrı, fallback yok. Session `ses_e1c9abb40ffeQL84qBNXXZ7Dj0`.
Usage UNKNOWN; araçtan güvenilir başlangıç/bitiş/süre metriği yok.
Alt ajanın yaklaşık saatleri ölçüm olarak kullanılmadı; yüzde tasarruf iddiası yok.

| Paket | Alt ajan bulgusu | Ana GPT doğrulaması / sınır |
|---|---|---|
| cesu8 1.1.0 | Archive'da LICENSE metinleri/VCS info yok; COPYRIGHT-RUST.txt crate'e ait tam MIT/Apache metni değil; exact v1.1.0 tag yok | [Resmî version API](https://crates.io/api/v1/crates/cesu8/1.1.0) doğrudan açıldı: `"license":"Apache-2.0/MIT"`, checksum `6d43a04d8753f35258c91f8ec639f792891f748a1edbd759cf1dcea3382ad83c`. Beyan doğrulandı; archive/tag yokluğu bu tur ana ajan tarafından yeniden indirilmedi, eski eksik kanıt korunur. |
| instant-xml 0.7.7 | `.cargo_vcs_info` revision `726fdd6e6cdff738a861d9ce7375c92621ef982c`; archive ve exact upstream'de tam metin yok | [Exact recursive tree](https://api.github.com/repos/djc/instant-xml/git/trees/726fdd6e6cdff738a861d9ce7375c92621ef982c?recursive=1) doğrudan açıldı; `"truncated":false`, LICENSE/COPYING/NOTICE dosyası yok. Archive→revision eşlemesi alt ajan bulgusu; pozitif provenance kabulü için yeterli sayılmadı. |
| instant-xml-macros 0.7.2 | Revision `d3101874c2ba1b4081d581590d43736de9b5e67c`; aynı metin boşluğu | [Exact recursive tree](https://api.github.com/repos/djc/instant-xml/git/trees/d3101874c2ba1b4081d581590d43736de9b5e67c?recursive=1) ana ajan tarafından açıldı; `"truncated":false`, lisans dosyası yok. Revision eşlemesi yine alt ajan raporu; kapanış kanıtı değil. |

İlk araştırmanın sonucu (aşağıdaki netleştirme ile daraltıldı): lisans beyanı ≠ exact tam metin.
Genel MIT/Apache şablonu veya latest-branch metni crate'in exact upstream metni
diye sunulamaz. Yeni dependency/vendor değişimi en küçük çözüm değildir ve kapsam dışıdır.
Upstream'den doğrulanabilir metin temini veya alternatif lisans-kabul politikası
kullanıcı kararı gerektirir; ikincisi bu sözleşmede onaylanmış değildir.
İlk taslak bu nedenle READY değildi; bu sonuç aşağıdaki resmî lisans koşullarıyla supersede edildi.
Kullanıcı kararı olmadan upstream issue açma/iletişim kurma yetkisi çıkarılmaz.

### L15 netleştirme — orijinal LICENSE dosyası şart değil

Kullanıcı, Apache-2.0 yoluna göre plan güncellemesini istedi; uygulamayı yasakladı.
Dar dış soru: ayrı LICENSE dosyası yokken standart Apache metni ve gerçek mevcut
bildirimlerle dağıtım yükümlülüğü karşılanabilir mi?
Tek ek çağrı: `opencode/inkling-2-small-free#low`,
session `ses_e1c8de4b9ffeLm9JJDQWFg3Y6g`; fallback yok, usage/süre UNKNOWN.
Alt ajanın “güvenli/yeterli” hukuk garantisi ve slash söz dizimine dayalı yorumu
kabul kanıtı sayılmadı; ana GPT aşağıdaki birincil metinleri doğrudan doğruladı.

- [Apache-2.0 §4(a–d)](https://www.apache.org/licenses/LICENSE-2.0.txt):
  “give any other recipients … a copy of this License”; yazarın kendi LICENSE
  dosyasını bulma şartı yok. §4(b) değiştirilmiş dosyalara bildirim; §4(c)
  dağıtılan türev kaynakta ilgili mevcut atıfları koruma; §4(d) varsa NOTICE
  bildirimlerini aktarma şartını getirir. Standart metin kaynağı ile paket beyanı ayrılır.
- [cesu8 1.1.0 README](https://docs.rs/crate/cesu8/1.1.0/source/README.md):
  “The new code in this project is distributed under the same terms.”
  Rust kökenini ve aynı koşulların yeni koda uygulanmasını açıklar; dosya adı
  README'de LICENSE-RUST.txt diye geçse de yayımlanan ağaçta COPYRIGHT-RUST.txt vardır.
- [cesu8 1.1.0 COPYRIGHT-RUST.txt](https://docs.rs/crate/cesu8/1.1.0/source/COPYRIGHT-RUST.txt):
  “Apache … or the MIT license … at your option”; “copyright 2014, The Rust
  Project Developers”. Bu gerçek mevcut bildirim yok sayılamaz. Dosyanın tamamındaki
  ilgisiz Rust bileşen listesi cesu8 bağımlılık listesi olarak yorumlanmaz.
- [instant-xml-macros 0.7.2 resmî version API](https://crates.io/api/v1/crates/instant-xml-macros/0.7.2):
  `"license":"Apache-2.0 OR MIT"` ana GPT tarafından doğrudan doğrulandı.
  instant-xml 0.7.7 aynı beyanı önceki araştırmada taşır; tekrar arşiv matrisi yapılmadı.

Seçilen sonuç: Apache-2.0 seçeneği + resmî standart tam metin + mevcut gerçek
bildirimlerin korunması. Yeni upstream dosyası/izin talebi veya lisans riski feragati
gerekmez; yanlış bir “exact upstream dosyası” atfı da yapılmaz. Kesin hukuki garanti değildir.
Kalan dar kontrol: üç sürümün mevcut kaynaklarında ilgili ek bildirim/NOTICE varsa
korunması ve dependency değişikliği bulunup bulunmadığının uygulamada kaydı.
Metin mevcut THIRD_PARTY_NOTICES içinde tutulur; yeni lisans dosyası veya paket yükseltme yok.
Dağıtılan uygulamayla sunulması §20'de release kabul şartıdır; belge güncellemesi
gerçek release paketinin denetlendiği veya dağıtımın bütünüyle kabul edildiği anlamına gelmez.
Önceki “yalnız exact upstream tam metinle READY” koşulu kaldırıldı; aynı soru tekrar araştırılmaz.

## H15 — proje içi kök neden / araştırma değil

03.11 `recovery29-2-2026-11-03.json` host kırılmasını açık kaydeder:
URLSession/macOS SDK optional uyumsuzluğu ve sonradan gelen IosCloudTarget referansı.
Güncel host script hâlâ HTTP client derliyor; publication testinde client yalnız
`encode` için kullanılıyor. Recovery host scripti zaten transport dışı izolasyon
ve üretimden OAuth kinds çıkarma desenini kullanıyor.
Journal init `createImports()` çağırıyor, mevcut WebDAV scriptinin closure'ında
`IosRecoveryImportJournal.swift` yok. Üretim fonksiyonunu stub'lamak yerine gerçek
dosyayı eklemek en küçük doğru bağlantıdır. Ürün state machine değişikliği yok.

## B15 — korunan sınır

Review B2 app binary nm kontrolünü ister; mevcut checker Rust static archive'ı tarar.
Swift marker ayrı derlenir. En küçük çözüm §20'ye artifact-bağlı kabul prosedürü
eklemektir; yeni checker/fixture veya şimdi release build gerekmiyor.
Stripped/araç-hatalı çıktı marker yokluğu sayılmaz; release gate OPEN tutulur.
