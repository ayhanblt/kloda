# Araştırma kullanım kontrolü ve model kararı — 18.11.2026

- Gerçek tamamlanan çağrı: `ses_e1e8ca0d3ffeYnNVN07wrjxG67`, Inkling Small low.
  Konu JobService completion/stop sözleşmesi. Ana ajan resmi kaynakla void finish,
  stop sonrası finish gerekmemesi ve retry cevabını doğruladı. Desteksiz "diskte
  retry intent zorunlu" çıkarımı reddedildi; Context7 sayaçları tutarsızdı.
  Sonuç: yararlı ama denetim gerektiren kısmi başarı; kusursuz cevap veya ölçülmüş
  maliyet tasarrufu değil. Kayıt: f1-ftps-automatic-lock-2026-11-15/fix-r1r2/design-research.md.
- Önceki stop-completion araştırması da session kimliğiyle kayıtlıdır:
  aynı dizinde research-stop-completion.md. G1 araştırma eki dış subagent ihtiyacı
  olmadığını kaydeder; her planın subagent çalıştırdığı sonucu çıkarılmaz.
- Katalog: `openai/gpt-6-luna` / GPT-6 Luna active;
  `claude-agent/haiku` / Haiku 5.5 active. Fiyat alanları boş; token/kota UNKNOWN.
- Kullanıcı kararı: plan/tasarım araştırması Luna; uygulama/FIX araştırması Haiku.
  Ana modeller/frontmatter değişmedi. Bu iki modelle yeni araştırma çalıştırılmadı;
  gerçek ihtiyaçta yeni yönlendirme kullanılacak. Son kullanıcı kararıyla review
  araştırması da Luna'ya taşındı; bağımsız kabul ana GPT'de kalır.
- Araştırma dışı delegasyon kademeli hedef; henüz kod/test/review pilot kapsamı
  onaylanmadı. Süreç dosyaları güncellendi; ürün/kabul durumu değiştirilmedi.
