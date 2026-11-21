---
description: Faz3–Faz4 tek ekip girişinden kaldığı yerden devam
agent: kloda-team
model: openai/gpt-6.2-sol
subagent: false
---

İstek: $ARGUMENTS

AGENTS.md Faz3–Faz4 ekip kararıyla çalış. CURRENT aktif ekip checkpoint'inden
devam et; tarihî "sonraki iş" metinlerini güncel talimat sayma.
"devam" mevcut fazı yürütme yetkisidir; yeni goal veya sayaç sıfırlaması değildir.
Faz belirtilmişse o fazın durumunu doğrula; Faz4 başlangıcında önce fiziksel
planı hazırla, sonra Sonnet'in cihaz yönergelerini kullanıcıya ilet.
Başka açık kullanıcı Sonnet sohbetini eşzamanlı çalıştırma; mevcut disk kanıtından
tek ekip Sonnet alt oturumunu devral. Rutin plan/test/review/FIX geçişlerini
kullanıcıya sormadan yönet. Zorunlu kapsam veya fiziksel eylem soruları korunur.
Kurulum doğrulaması istenmişse yalnız yapılandırmayı kontrol et, regresyon başlatma.
