---
description: Backlog'daki tek iş için GPT planı
model: openai/gpt-6.2-sol
---

Yeni oturum/iş başlangıcında AGENTS.md → CURRENT.md backlog'unu oku.
Aynı işte değişen karar/plan bölümlerinden devam et; bağlamdaki değişmeyen talimatları
tekrar yükleme. Eksik veya değişmiş bölümü oku; güncellik belirsizse dar diff/hash kontrolü yap.
Yalnız $ARGUMENTS için çalış; mevcut planın açıklaması/düzeltmesi yeni plan işi değildir.

Tasarımı execution-budget.md §1'deki dört ilkeyle kur: en küçük yeterli çözüm,
kritik belirsizliği önce çözme, uygulanabilir dosya/sorumluluk dağılımı ve aynı
invariant tekrar dönüyorsa yama yerine sadeleştirme. Bu ayrı bir onay aşaması değildir.
Doğrulanmış bulguyla varsayımı ayır; kritik konu açıksa aynı GPT sohbetinde hedefli
araştırmayla çöz veya somut karar ihtiyacını bildir. Hazır olmayan tasarıma READY verme.

Tek sözleşme yaz: gözlenebilir goal/non-goals; dosya-sembol-değişiklik; korunacak
davranış; sabit kabul ID'leri; ilgili olay sırası (başlangıç → olay/kesinti → kalıcı
sonuç/OS yan etkisi → dar test). Uygulama/review aynı tabloyu kullanır; kabul satırları
ayrı görev veya onay değildir. Temizlik/sorumluluk, proje standartları ve gerekli
test/lint/typecheck/build kanıtını dahil et; ertelenmiş kapıları ayrı göster.

Yeni kod/test/fixture önermeden mevcut kanıtı diff'e göre reuse/etkilenmiş/eksik ayır.
§5 uyarınca diff→yol→kontrol→reuse seçimini bir kez yap; hazır komut ve önkoşullarla
ilk temsilci→dar uygulama→etkilenen genişletme sırasını ver. Yeni sohbet/kayıp fixture
tekrar gerekçesi değildir. Onaylı ertelemeyi yeniden açma; §3 bütçe/iki-deneme
kurallarını uygula, UNKNOWN/15000'i ek onay kapısına dönüştürme.

Gereken dış araştırma veya salt-okunur kanıt/caller/test eşlemesini research-pilot.md
uyarınca Luna'ya (`openai/gpt-6-luna`) ver; kritik iddiayı doğrula, araştırmayı tekrarlama.
Bağımsız işe devam et; her işte alt ajan şartı yok. Uygulama Sonnet 5.5; §4'e göre
uygun düşük-riskli işi Haiku'ya ayırıyorsan dosya sınırı/tek yazar/kabul/komutları belirt.
Hassas iş ana uygulayıcıda; sırf delegasyon için işi bölme.

Planı docs/implementation/plans/next-plan.md'ye kısa sözleşme olarak yaz; aktif
scoped düzeltmede yalnız ilgili bölümü güncelle. Hedef 100–150 satır üstü yükü azaltmak,
bu uzunluğu doldurmak değil. Uzun araştırma gerekirse <iş-kimliği>-research.md'ye;
geçmişi başlangıca yükleme. Bu plan/araştırma eki dışında dosya veya kod değiştirme;
commit/push yok. Mevcut FIX-R4 sözleşme/devrine yeni süreç şartı ekleme.

Kullanıcıya yalnız iş, tek somut engel (yoksa yok) ve sonraki adımı özetle;
test/kanıt ayrıntılarını sözleşme ve manifestte tut. Hazır/hazır değil durumunu belirt.
Kapanış biçimi: Durum; Devam (AYNI SOHBET / YENİ SOHBET / DUR — kullanıcı
kararı); Rol; tam komut/prompt. Yalnız onaylı hazır planı ana uygulayıcıya devret;
aynı işin mevcut uygulama sohbetini kullan, yoksa yeni sohbet için /implement öner.
