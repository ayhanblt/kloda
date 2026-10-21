# Windows-only devir ve seçilmiş kanıt review’ı — 2026-10-21

Ayrı salt okunur review, handoff/prompt/kanıt dosyalarını inceledi. İlk geçişte bozuk Windows repo yolu, seçilmiş kanıt prosedüründe kuralla çelişen kişisel absolute path ve FAIL/UNKNOWN sonrasında başarı izlenimi verebilen kapanış ifadesi bulundu. Üçü düzeltildi; reviewer son hâli kaynak üzerinden tekrar doğruladı. Kalan dört exact testi birer kez/fail-stop yürütüp raporlayarak durma kapsamına uygun; yeni bulgu/kapsam genişlemesi yok.

Root ayrıca yeni relative link hedefleri, JSON parse,10 frozen public normalized SHA256, dört NOT_RUN test adının mevcut source fonksiyonlarıyla eşleşmesi, Windows repo yolunun doğruluğu, curated alanda kişisel absolute path yokluğu, .gitignore’ın HEAD ile byte eşitliği, .local-evidence’ın ignored kalması ve yeni dosyaların Git’e eklenebilirliğini salt okunur doğruladı. Bu kontroller **doküman/kanıt hazırlığı** kapsamındadır; yeni native test/ürün kabulü değildir.

Bu görevde reviewer ve root test/build/Windows/owner/probe çalıştırmadı; native kaynaklar değişmedi. D1 kaynak/transfer review’ları results.json içinde ayrı tarihsel provenance ile tutulur. Git add/commit/push yapılmadı. Belgeler ancak kullanıcı tarafından aktarılırsa diğer makinede bulunur; tüm local archive’ın yedeği değildir.
