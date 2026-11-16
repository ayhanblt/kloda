# G1 — bağımsız GPT review / 16.11.2026

## Sonuç: ACCEPTED — G1 geliştirme kapsamı (INITIAL + G1-R1)

Reviewer: **OpenAI GPT-6.1 Sol (`openai/gpt-6.1-sol`)**, kullanıcı tarafından
başlatılan bu ayrı GPT review sohbeti. Bu oturumda uygulama/ürün kodu değişikliği
yapılmadı; uygulama sohbetindeki self-review kabul sayılmadı. Oturum ID'si araç
bağlamında verilmedi, uydurulmadı.

Tek goal ve kabul kaynağı: `plans/next-plan.md §2.1/G1`, G1-01–07 ortak tablosu
ve 16.11 görsel erteleme kararı. Yalnız R1 fix'i değil, tüm G1 uygulaması topluca
incelendi. **Engelleyici bulgu yok; G1-R1 kapandı.** Yeni goal/beklenti eklenmedi.
Bu kabul üst F1/1.5, tam ürün/regresyon veya görsel/runtime PASS değildir.

### Gerçek diff / aidiyet

- Start ve review HEAD: `586a2fd51e61058053119dd8b1f3ecb65c4f7676`; staged boş.
- Tracked: `apps/mobile/src/pages/activity/ui/activity-page.tsx` ve
  `apps/mobile/src/shared/i18n/locales/{tr,en,de}.json`.
- Untracked ürün/test: `features/file-transfer/model/activity-journal{.ts,.spec.ts}`
  ve `pages/activity/ui/activity-journal-panel{.tsx,.spec.tsx}` (aynı mobile/src kökü).
- INITIAL `tracked.diff` + untracked kaynaklar, ardından `fix-r1/fix.diff` ve son
  çalışma ağacı birlikte incelendi. Sekiz tracked başlangıç snapshot'ının Git blob'u
  HEAD ile eşit; üç FIX başlangıç dosyasının SHA256'sı INITIAL final kaydıyla eşit.
  Son üç FIX hash'i ve değişmeyen beş INITIAL hash'i **8/8 MATCH**.
- F1 Android, 1.5, notices/harness ve diğer birikmiş belgeler bu review'a dahil değil.
  CURRENT yalnız G1 durum kaydı olarak değerlendirildi; ADR/ürün kararı değiştirilmedi.
  `apps/mobile/pnpm-lock.yaml` aidiyeti belirsiz untracked dosya; G1 kaynak kapsamı
  dışında bırakıldı, dokunulmadı. Dependency manifest değişikliği yok.

### Ortak kabul tablosunun toplu değerlendirmesi

| ID | Kaynak / mevcut kanıt ve karar |
|---|---|
| G1-01 | `activity-journal.ts:8–25` kesin kümeler, native sıra ve nesne verisini korur. Panel spec :49–69 sekme/filtre sonrası action/status/ftps.status sayısını korur. Selector + page regression kanıtları uygun; kabul |
| G1-02 | Selector :19–24 yalnız completed'ı done'a alır; ACK=size uploading/finalizing page spec :103–117'de dışarıda. Değişmeyen parser `file-transfer.ts:84–116` exact ACK/size ve kimlik/sayım sınırını korur; kabul |
| G1-03 | Panel :68–74 hasMore uyarısını tüm filtrelerde tutar, emptyLimited ayrıdır; spec :120–142 100/101 ve hasMore=false karşıtını doğrular. Now'da mevcut count/more retained-job açıklaması korunur; hayalî oturum/load-more yok; kabul |
| G1-04 | Panel :70–74 loading/error'ı boş başarıya çevirmez. Spec :144–164 geç background yanıtı→active hata→güncel yanıt yolunu kapsar. Hook :31–65 foreground/epoch/null/cleanup değişmedi; kabul |
| G1-05 | Page :26–34, :65–134 tek hook ve sabit Now wrapper'ını korur; hidden + iki native a11y prop'u var. Tab/filter handler'ları yalnız state değiştirir. Spec :166–184 ve mevcut lifecycle/automatic kontrolleri cleanup/pause sınırını korur; kabul |
| G1-06 | Page :34, :63–64 activity dışına journal taşımaz; :120–124 rebackup confirmation ve :131–133 backup/target/restore yolları korunur. Backups/destinations/owner_deleted/automatic suite kanıtı uygun; Home ham queue kullanımı değişmedi; kabul |
| G1-07 | Page :41–45 ve panel :15–43 M11 başlık trigger/dropdown + segment biçimini sağlar; R1 spec :72–101 aç/kapat/seçim/Now'da yokluk/yan-etki yokluğunu doğrular. TR/EN/DE render/key kontrolleri :197–218; token/Lucide/FSD, inline stil yokluğu ve ≤300 sınırı uygun. Render/a11y kabul; görsel Faz3 DEFERRED / NOT_RUN |

### Bulgular / invariant sayaçları

- **G1-R1, P2 — önceki bulgu, G1-07 / M11 segment-filter biçimi: RESOLVED.**
  Geçmiş→başlık trigger'ı→done/issues→kapanış yolu artık mevcut; paneldeki sürekli
  radio segment kaldırılmış. `ActivityFilterMenu` yerel open state'i ve page filter
  state'i dışında işlem yapmaz. Menü akışta açılır; native ek bağımlılık/API yok.
  Görsel eşdeğerliğin cihaz kanıtı bu kaynak incelemesinden türetilmez.
- Yeni engelleyici bulgu veya ayrı isteğe bağlı temizlik talebi yok.
- Invariant sayacı korunur: M11 biçimi fix deneme 1 kabul / 0 başarısız;
  test sorgusu düzeltmeleri ürün yaklaşımı başarısızlığı sayılmaz.

### Kanıt: taze inceleme / yeniden kullanılan koşular

**Taze reviewer doğrulaması:** `git status --short`, `git rev-parse HEAD`,
`git diff --cached --stat`; kapsamlı gerçek G1 diff/kaynak/test/caller incelemesi;
Get-FileHash ile 8/8 final + 3/3 FIX başlangıç eşleşmesi; `git hash-object` /
`git rev-parse HEAD:<path>` ile 8/8 baseline blob eşleşmesi; hook/parser/Home ve
mevcut dört caller spec'inde `git diff HEAD` boş; scoped `git diff --check` temiz.
Bunlar statik inceleme/aidiyet kontrolleridir, yeni runtime PASS değildir.

**REUSE:** INITIAL selector/page RED ve Jest39; FIX `r1-red.log` beklenen RED,
`r1-green.log` 1 PASS, `jest-affected.log` 6 suite / 40 PASS. Log özetleri ve ilgili
testlerin beklentileri incelendi. INITIAL/FIX `tsc.log` boş, manifest exit0 kaydı;
scoped ESLint loglarında yalnız çoklu-tsconfig uyarısı, manifest exit0 kaydı;
iki son export logunda iOS/Android bundle ve Exported çıktısı var. INITIAL
selector lint'i değişmediğinden reuse; FIX üç TS/TSX dosyasının lint'i mevcut.
Reviewer bu başarılı test/tsc/lint/export koşularını **tekrarlamadı (NOT_RUN)**.
Native kod değişmedi; önceki native invariant kanıtı yalnız prior PASS REUSE'dur.

### Açık kapılar / kapanış

G1-07 TR/EN/DE, light/dark, büyük yazı ve Lovable cihaz görsel karşılaştırması
**Faz3 DEFERRED / NOT_RUN**; tam a11y/performance, B1 JS→native entegrasyon,
gerçek OS/provider/fiziksel/signing/P5 ve Faz3–4 kapıları açık. Kalıcı batch
capture script açığı 2.5'te kalır. F1 fix2 → 1.5 Mac kuyruğu değişmedi.

CURRENT G1 checkbox'ı ve bu manifestin kabul kaydı aynı reviewer oturumunda
kapatılır. Ürün kodu/plan/ADR değişmez; commit/push yok. Sonraki bağımsız iş:
ayrı GPT plan sohbetinde **2.2/G2–G3**; henüz plan/uygulama başlatılmadı.

---

## Tarihî kayıt — aynı-sohbet incelemesi (bağımsız kabul değildir)

**Sonuç: G1-R1 scoped FIX gerekli; bağımsız kabul DEĞİL.**
Uygulama aynı sohbet bağlamında yapıldığı için ayrı oturum bağımsızlığı yoktur.
Manifestteki “Opus” etiketi bu sohbeti bağımsız uygulayıcı/reviewer ayrımı yapmaz.
Checkbox açık; ürün kodu bu incelemede değiştirilmedi. Commit/push yok.

## Sözleşme / kullanıcı kararı

Tek sözleşme `next-plan.md §2.1/G1`, G1-01–07. Görsel capture/karşılaştırma
16.11 kullanıcı kararıyla Faz3'e DEFERRED / NOT_RUN; geliştirme engeli değil.
Bu erteleme bilinen UI sapmasını kabul etmez; bağımsız review gereğini kaldırmaz.

## G1-R1 — P2 — Onaylı başlık filtresi ikinci segment kontrolüne çevrilmiş

- Konum: `apps/mobile/src/pages/activity/ui/activity-journal-panel.tsx:51–52`.
- Sözleşme: plan §2.1/G1 “M11 segment/filter biçimini koru”, G1-07.
- Kaynak referansı: `docs/ui/lovable-reference/c144e98938da/source/src/views/mobile/activity.tsx.reference:20–30`.
  Geçmiş'te header sağında mevcut seçimi gösteren dropdown trigger ve açılan seçenek listesi var.
- Gerçek uygulama: panel içinde sürekli görünen üçlü radio segmenti var; header trigger/menu yok.
  Manifest §Görsel/eşleme notları da bu değişimi doğruluyor. Hazır RN bileşeni bulunmaması
  tasarım değişikliğine yetki değil; D-G1 onayı tarih/kapsam uyarlamasıdır.
- Etki: ekran düzeni/etkileşimi onaylı M11'den sapar. Görsel test yapılmadan da kaynakta doğrulanır;
  capture ertelemesiyle kapanmaz.
- Dar çözüm: mevcut UI araçlarıyla header trigger/dropdown biçimini koru; sınıflama ve
  native yan-etki sözleşmesi aynı kalsın. Yeni bağımlılık/native API/hook gerekmez.
- Kanıt beklentisi: header trigger aç/kapat, filtre seçimi, Now'da filtre menüsünün bulunmaması,
  action/status çağrı sayısının değişmemesi; mevcut done/issues/empty/truncation kontrolleri.
  Fiziksel/görsel matris bu fix'e geri taşınmaz.

## Diğer ölçütler / kanıt sınırı

| ID | Kaynak/test incelemesi |
|---|---|
| G1-01 | Saf selector kesin kümeleri ve sırayı koruyor; queue mutasyonu yok. Page tab/filter testleri var |
| G1-02 | completed dışında success üretilmiyor; ACK=size uploading/finalizing testleri var; parser değişmedi |
| G1-03 | hasMore uyarısı ve emptyLimited tüm geçmiş filtrelerinde; totalJobs başarı/oturum sayısına çevrilmiyor |
| G1-04 | Hook değişmedi: queue okuma hatasında null, epoch ile geç yanıt elenir. Deferred/background/error testi var |
| G1-05 | Now wrapper mounted kalır, hidden ve iki native a11y gizleme prop'u var. Cleanup/hook değiştirilmedi |
| G1-06 | Backups kontrolü var; önceki backups/destinations/automatic/owner_deleted testleri reuse. Home ham queue kullanımı değişmedi |
| G1-07 | TR/EN/DE anahtarları eş, statik JSX literal metin yok, token/Lucide/FSD sınırları korunmuş. G1-R1 açık; görsel Faz3 DEFERRED |

HEAD `586a2fd51e61058053119dd8b1f3ecb65c4f7676`; staged boş.
Sekiz kaynak hash'i uygulama `source-final.sha256` ile birebir doğrulandı.
`jest-affected.log`: 6 suite/39 PASS; tsc boş log ve önceki exit0 kaydı,
ESLint yalnız çoklu tsconfig uyarısı, iOS/Android export logları mevcut.
Bu sonuçlar **önceki uygulama kanıtı REUSE**, yeni reviewer test/build PASS'i değil.
Native invariant reuse ve Faz3–4 fiziksel/release kapıları korunur.

## Tek sonraki adım

Mevcut Opus uygulama sohbetinde:
`/implement — AGENTS → CURRENT → backlog-2.1-g1/review.md ve MANIFEST §İnceleme /
scoped FIX yönlendirmesi. Yalnız G1-R1: M11 başlık dropdown filtresini geri getir;
regression → minimum fix → etkilenen kontroller. G1-07 görsel Faz3 DEFERRED;
F1/1.5/native/hook/parser değişmez. REVIEW/unchecked bırak; commit/push yok.`

Ardından ayrı GPT sohbetinde bağımsız review. Başarısız fix sayacı 0, sıfırlama yok.
