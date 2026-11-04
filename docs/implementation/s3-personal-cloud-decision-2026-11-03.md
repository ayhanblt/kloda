# 17 — kişisel bulut verisi için açık ürün kararı

Durum: A kullanıcı tarafından04.11.2026 açıkça onaylandı: “V1: TLS + AWS SSE-S3 ile ilerle”. V1 ürün kodu bu modelle sürdürülecek; gerçek kişisel aktarım uygulamadaki açık kaynak/hedef etkinleştirmesine bağlıdır.

Önceki onay scoped native key custody ve tek sentetik gerçek AWS testiydi;04.11 A seçimi V1 kişisel bulut veri modelini de belirledi. Tek4097byte AWS publication/full readback/own staging restore PASS; kişisel Files/Photos veya genel backup etkinleştirilmedi. ADR0022 “Step17 scoped credential/test approval” ve “Preserved boundaries” kişisel bulut/E2EE/key lifecycle kararını açık bırakır.

## Somut seçenekler

A. Amazon S3 V1: doğrudan HTTPS/TLS + bucket’ın AWS SSE-S3 ayarı; Kloda ayrıca istemci tarafında şifrelemez. AWS ve yetkili AWS hesap erişimleri nesne içeriğini okuyabilir. Native credential custody, bucket/prefix/profile/source/job bağları ve explicit opt-in korunur. Bu seçim nodelete/retention veya bilinmeyen ACK adoption yetkisi vermez. P5 sağlayıcısının at-rest güvencesi ayrıca doğrulanır; AWS SSE-S3 diğer vendorlara varsayılmaz. Mevcut byte/hash pipeline en az değişiklikle sürdürülebilir.

B. Kişisel veri aktarımından önce Kloda E2EE: anahtar üretimi/saklama, yedekleme-kurtarma/cihaz kaybı, metadata gizliliği, şifreli nesne formatı ve plaintext-source/ciphertext-wire integrity bağları için ayrı somut mimari/ADR gerekir. TLS ve native credential custody bunun yerine geçmez. Daha kapsamlı iş ve yeni testler gerektirir; henüz seçilmiş algoritma/anahtar kurtarma politikası yok.

C. Şimdilik mevcut sınır: yapılandırma, sentetik test ve native transport/recovery kanıtları; kişisel bulut yedeklemesi/enable/Photos/OS otomatik çalışma kapalı kalır. 17 genel ürün kabulü açık raporlanır.

Her seçenekte kişisel veri aktarımı uygulamadaki açık kaynak/hedef etkinleştirmesine bağlıdır. Fiziksel21, üretim signing/custody, bağımsız review,2crate lisans metni ve kalan platform/matris kapıları ayrıca korunur. LAN sözleşmeleri değişmez. Gerçek AWS başarılı testini veya ücretli kaynak kapsamını otomatik genişletme.
