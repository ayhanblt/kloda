# Windows Codex — ayrı standart hesap için paket hazırlığı

Güncel kullanıcı onayı2026-10-21: ayrı yeni standart hesap, mevcut ACL/guard/veriye dokunmadan disposable D1. Eski sandbox collision-retry prompt'unun yerine bu metni kullan.

```text
Repo: C:\Users\ayhan\Desktop\projects\kloda

AGENTS.md, .omp/AGENTS.md, güncel ADR0015/16, handoff ve
 docs/implementation/windows-d1-native-user-handoff.md belgesini oku.
Yalnız bu belgenin A aşamasını tamamla: 14-source hash doğrulama,
locked/no-run Windows derleme, beş exact ignored list kontrolü,
minimal binary bundle ve kullanıcı için hash-pinned tek çalışma bloğu.
Paket/yönerge için ayrı güvenlik ve sonuç review yap.

Bu mevcut hesapta native context preflight veya mutating fixture çalıştırma.
Hesabı otomatik oluşturma; kullanıcıya B/C için gerçek paket yolu,
manifest SHA256 ve tek çalıştırma bloğunu ver. Kullanıcı yeni standart
hesaba kendisi geçecek. Paket üretildiğini test PASS diye yazma.

AppData/keys/config/arşiv/full local-evidence kopyalama. ACL/owner/guard,
sandbox config veya ExecutionPolicy değiştirme. Git mutation, cleanup,
owner/TPM/probe veya genel fiziksel kabul başlatma. Yeni hesapta bile
policy reddi olabileceğini açık tut; garanti verme.

A tamamlanınca build/list/package sonuçlarını ve runtime NOT_RUN'u raporla.
Burada dur; sonraki aşama kullanıcı oturum değişimidir.
```
