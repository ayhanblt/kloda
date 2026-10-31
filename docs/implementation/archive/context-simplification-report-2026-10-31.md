# Context simplification report — 31.10.2026

AGENTS: tek başlangıç AGENTS→CURRENT→aktif ADR/checkpoint bölümleri; eski el kitapları hedefli referans. Single-agent/model/effort/lower-usage, execution, Git ve UI kuralları korundu; security kodunda ilgili ADR zorunlu. Context7 komut ayrıntısı hedefli referansa taşındı; belge sonrası geliştirmeye dönüş yalnız açık kullanıcı isteğiyle. Yeni toplu yakalama ve scope büyümesinde geniş diff/yeniden onay kuralı eklendi.

CURRENT: 5986 bayt;21 satır durum, aktif16a, gerçek D6/D7/düzeltilmişD8 onayı, açık runtime/platform kapıları, ADR kapsamları ve kesin devam noktası. Kalıcı capture script/komut yok; kullanıcının açık yanıtıyla bekleyen kaydedildi.

Arşiv:8 tam gövde, SHA256 önce/sonra eşit; [tam hashler ve 570 açık/karar satırı](migration-check.md). Hiçbir kaynak/ADR/evidence/.omp gövdesi değişmedi. Göreli yollar 64 belge uyumluluk yönlendirmesi/alias ile korunur; bunlar ek belge kopyası/active checkpoint taşıması değildir.

D8: ilk tek-satır onayı genişletilmiş kapsama sayılmadı. Ayrı açık kullanıcı yanıtı “A — Düzeltilmiş SDK girişi ve dar native köprüyü onayla”, bu sohbet31.10.2026; [tam iz](migration-check.md#d8-approval-trace). Bekleyen D8 onayı yok; kod geri alınmadı.

Ignore: .expo dev logs, ham *.log ve evidence raster çıktıları .gitignore/.ignore kapsamına alındı. Kaynak/fixture/snapshot/JSON/patch/README korunur.50 takipli ham çıktı git rm --cached ile diskte tutulur; index silmeleri commit edilmez. [Tam yollar ve gruplar](worktree-groups-2026-10-31.md).

Commitler: tamamlanan kaynak/izole grup `e21915b8e753521df2e55d9a60c6770eda39d947`; UI `20443c24bdb5dee49ee4a07bcb51497ee03606f3`; ayrı doküman commit’i bu raporu içerir.16a/D8 ve gürültü commit edilmez; push yok. Ortak Android dispatcher’da non-SMB hunk’ları commit edildi, SMB dalı worktree’de tutuldu.

Zorunlu okuma: eski AGENTS+OMP+Codex handoff 102577 bayt; yeni AGENTS+CURRENT 13416 bayt; aktif ADR22/ADR26-D6–D8/checkpoint bölümleri dahil 19787 bayt. On-demand tarih/evidence tekrar varsayılan okumaya eklenmedi.

Kontrol: Markdown link/path/fragment ve byte/hash kapsamı çalışma ağacında doğrulandı; son sayımlar nihai raporda. Markdown lint/formatter kurulu değil: NOT_RUN. Kod testleri bu docs-only görev için NOT_RUN; eski sonuçlar taze PASS sayılmadı. Kaynak/ADR/evidence koruma hash listesinde1558 dosya değişmedi. Sonraki iş: yeni başlangıç sırasıyla16a profil/vault–OS LAN–seçili Files yetki/generation bağı;17’ye geçiş yok.
