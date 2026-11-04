# 17 — native S3 bağlantısı için dar kapsam kararı /03.11.2026

Durum: **A kullanıcı tarafından03.11.2026 açıkça onaylandı; C/JNI kaynak diff’i uygulandı.** [Somut kaynak diff'i](evidence/s3-step17-preflight-2026-11-03/sansio-core/native-abi-proposal.patch). Yeni C/JNI kaynak exportları mevcut; native caller/app bağlantısı ve platform runtime kabulü sürüyor.

[AGENTS.md](../../AGENTS.md), Scope and capture discipline: “If implementation expands an approved decision (more files/lines, a new ABI, etc.), present the expanded diff and obtain explicit approval again.” Bu adım yeni native ABI ekliyor; rutin test/build için onay istenmiyor.

## A — önerilen dar bağlantı

`packages/s3-native`: bir C sembolü `kloda_s3_json_v1(kind,input,length,output,capacity,written)` ve tek JNI karşılığı `S3NativeEngine.process`. `kind=0` request hazırlama,1 create ACK,2 complete ACK sınıflandırma. 1MiB input/4MiB output üst sınırı; caller-owned, birbirinden ayrı buffer'lar; kısa buffer gerekli uzunluğu döndürür, yazmaz. Pointer/handle tutulmaz ve ağ açılmaz. İkinci sizing çağrısı yeniden imzalar. Null/taşma/unknown-field/kind/panic güvenli hata; renderer'a secret veya signed URL verilmez.

Açık serde_json1.0.145/zeroize1.9.1 ve opsiyonel mevcut jni0.21.1; exact Cargo.lock diff'te. Sign input secret/token geçici kopyaları ve köprü byte buffer'ları zeroize edilir. Caller orijinal native input/output'u da kullanım sonunda siler; bütün allocator/Url/serde ara kopyalarının sıfırlandığı iddiası yok.

Sonraki caller kapsamı: Android/iOS native vault+profil+journal sahipleri; mevcut OkHttp/URLSession redirect-kapalı/native context iptal örüntüsü; source/profile/credential generation kontrolü; own job/upload-ID/part/ACK kayıtları. Signed URL bearer niteliğinde, yalnız native kısa ömürlü bellekte. `Created` veya `CompletionAck` tek başına Completed değildir; durable ACK + aynı yetkili iş/bağlam + tam byte/hash readback gerekir. Kayıp completion ACK review'da kalır, readback eşitliği yükseltmez. Otomatik retry/adoption/overwrite yok.

Bu onay, A seçilirse, iki ayrı P5/C1 native profile/form/API bağlantısının17 kapsamındaki geliştirilmesine ve ilk tek Android arm64+iOS Simulator doğrulamasına izin verir; genel ürün etkinleştirme, yeni hesap/bucket/role/billing/provider app, cloud plaintext/E2EE veya fiziksel21 izni vermez. AWS credential modeli ve P5 vendor için ayrı mevcut soru/karar korunur. Varsayılan kapalı; gerçek cloud veri aktarımı politika kapıları çözülmeden açılmaz. Sonraki 6ABI matrisi yalnız bu ilk yol stabil olunca bir kez.

Öneri sınır kontrolleri:2 yeni C buffer/ACK testi+1 sign/strict-input testi PASS; JNI feature host Clippy ve C header syntax kontrolü. Bunlar Android JNI runtime/iOS ABI link veya native journal kabulü değildir. Kaynak/son test hashleri tek manifestte tutulur.

## B — ABI ekleme

Çekirdek+izole host kanıtları korunur;17 native caller/ürün bağlantısı açık kalır. Yeni bir SDK veya daha gevşek TLS/redirect politikası kendiliğinden seçilmez.
