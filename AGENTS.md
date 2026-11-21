## Kloda project context

Current UI source of truth is the user-approved [Lovable design](docs/ui/lovable-design-reference.md), superseding the legacy Stitch folder. Preserve strict visual mapping, TR/EN/DE translation keys for all static user-facing text, Tailwind/existing NativeWind with shared global CSS (no new inline/page styles), Lucide, FSD/component boundaries and the existing300-line ESLint limit excluding comments/blank lines. Native OS/SwiftUI exceptions require an explicit decision.

## Single startup rule

### Faz3–Faz4 ekip yürütmesi — kullanıcı kararı, 20.11.2026

Faz3/Faz4 için kullanıcı `/ekip devam` ile başlatır; kurulum kendi başına koşu
yetkisi değildir. Tek ana GPT koordinatör, Sonnet uygulama/test alt oturumu ve
uygulamadan ayrı GPT reviewer alt oturumu kullanılır. Kullanıcı rol oturumlarını
açmaz veya aralarında mesaj taşımaz. Yerleşik subagent mekanizması kullanılır;
eklenti, servis veya ikinci görev takip sistemi eklenmez.
Bu bölüm, bu iki fazda eski kullanıcı-başlatmalı rol devirleri, alt görevde durma,
otomatik kabul delegasyonu yasağı ve rutin scoped FIX için tekrar onay istemesiyle
çelişen kuralları supersede eder. Bağımsız GPT kabulü korunur.

- İşleyiş: **bul → kök nedene göre grupla → çöz → dar doğrula**. Aynı neden için
  hücre başına FIX açma; çözülebilir hataları faz sonuna yığma. Ürün/test/ortam
  bulgularını ayır; state_unavailable/blocked çözüm veya PASS değildir.
- Mevcut sözleşme, kabul ID'leri, kanıtlar ve sayaçlar korunur. Kapsam içi düzeltme
  için GPT mevcut plana hedef dosya/sembol ve dar doğrulamayı yazar, Sonnet'e
  otomatik devreder. Yeni özellik, kabul gevşetme, güvenlik/ürün davranış değişimi,
  geniş refactor veya onaylı dosya sınırı dışı değişiklik kullanıcı kararıdır.
- Teknik belirsizlik ve iki başarısız aynı yaklaşım önce koordinatöre gelir;
  üçüncü kör deneme yok. GPT kapsam içinde farklı, kanıtlı tasarımı netleştirebilir;
  yetki dışında karar gerekiyorsa kullanıcıya tek somut soru sorar. Sayaç sıfırlanmaz.
- Test sırası, rutin scoped düzeltme, review/FIX devri kullanıcıya sorulmaz.
  Kullanıcı teyidi (20.11): olağan hata düzeltmesini ekip mevcut kabul ve yetki
  içinde doğrudan yürütür; yöntem seçimi tek başına kullanıcı kararı değildir.
  Teknik tasarım seçeneklerini önce koordinatör çözer.
  Yıkıcı işlem, yeni maliyet/erişim, kapsam/ürün/güvenlik kararı veya gerçek
  altyapı engelinde durulur. Kullanıcıdan gereken fiziksel eylem ayrıca beklenir.
- Tek kaynak mevcut plan+faz manifestidir; koordinatör rol oturum ID'lerini,
  mevcut aday/diff ve tek sonraki adımı orada tutar. Yazıcı ve ortak cihaz/build
  koşusu aynı anda tektir. Review sırasında Sonnet yazmaz/koşmaz.
- Bağlamı görev sınırlarında yönet: Aynı odaklı FIX/review devamında mevcut
  oturumu kullan. Bir bağımsız kontrol bittiğinde bağlam birikmişse ve araç
  destekliyorsa sıkıştır; eski bağlam yeni işe gerekmiyorsa veya sıkıştırma
  yeterli değilse mevcut manifestteki kısa checkpoint'ten yeni rol oturumuna
  geç. Her alt kontrolde otomatik yeni sohbet açma; uzun transcript veya
  geçmiş ham logları taşıma. Kanıt, sayaç ve model ayarı değişmez; önceki yazıcı
  bitmeden yenisini başlatma. Rutin geçişi kullanıcıya yaptırma.
- Faz4 planı mevcut onaylı fiziksel kabul kapsamından hazırlanır; rutin plan
  onayı için durulmaz. Sonnet gerekli anda telefon/USB/ağ/ekran kilidi adımlarını,
  beklenen gözlemi ve güvenli komutu kısa sırayla hazırlar; koordinatör kullanıcıya
  aynen iletir. Kullanıcı yanıtı aynı Sonnet oturumuna döner. PIN/parola istenmez;
  cihaz sahipliği, veri silme ve hesap izinleri varsayılmaz.
- Faz3 zorunlu açıklarıyla kapanmaz; bağımsız GPT kabulünden sonra tek sonuç
  raporu verilir. Faz4 ayrı kullanıcı başlangıcıyla aynı ekip düzeninde yürür.
  Kota/araç kesintisinde mevcut manifest checkpoint'iyle devam edilir; limitsiz
  arka plan yürütme veya garantili tamamlanma iddiası yok.

Read in this order: (1) AGENTS.md, (2) [CURRENT.md](docs/implementation/CURRENT.md),
(3) only the ADR/checkpoint sections CURRENT lists for the active step.
[archive/omp-AGENTS.md](docs/implementation/archive/omp-AGENTS.md) (former `.omp/AGENTS.md`), Codex migration/old handoffs and the full expanded execution plan
are on-demand references: read only a relevant section, never mandatory whole-file
startup input. They are repository documents, not an OMP runtime dependency. ADR0016 is current V1 LAN authority; ADR0017 is current Photos metadata/import recovery. Preserve their scoped supersession of older central-authorization requirements.

ADR0018 is the approved Windows/macOS/Linux Desktop background lifecycle: retain authorized native receipt across UI departure; separately invalidate foreground invitation/approval work. Never restore close-on-blur as the receiver lifecycle or bypass foreground grant fences. Linux requires a usable visible control before hiding; provider/signing/storage and physical gates remain open.

OMP-only model/agent aliases (`@smol`, `@default`, `fast`, `good`), internal URIs and tool names below are not assumed configured in OpenCode or Codex CLI. Use available CLI capabilities; preserve the project/security workflow rather than inventing equivalent tools or silently changing model configuration.

For documentation/audit-only requests, report and stop unless the user explicitly requests a return to already-authorized development afterward.

<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer — your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

When this policy applies, read the [targeted Context7 command reference](docs/implementation/archive/context7-command-reference.md) for resolution, version selection, quota and network-failure rules.
<!-- context7 -->


## Balanced delivery — user decision, 2026-11-16

- Implementation model transition (2026-11-18, latest user decision): after the
  currently running Opus work completes, use Sonnet 5.5 (`claude-agent/sonnet`)
  as main implementation/FIX agent and Haiku 5.5 (`claude-agent/haiku`) for
  implementation research/read-only support and bounded low-risk coding under
  execution-budget.md §4. Keep the current Opus run and its Sonnet delegation intact.
  Sensitive work stays with main Sonnet; unresolved design returns to GPT.
  GPT-6.2 Sol planning/independent review and Luna support remain unchanged.
  Preserve effort, acceptance, single-writer and failed-fix counters; no automatic
  Opus escalation. This supersedes older Opus-main/Sonnet-support role labels below
  and in existing handoffs for subsequent work, not historical reviewer evidence.
  Reuse the existing implementation conversation where appropriate; model changes
  do not restart the task. Report the actual implementer model in new handoffs.

- Main GPT model update (2026-11-18): use GPT-6.2 Sol (`openai/gpt-6.2-sol`)
  wherever GPT-6.1 Sol was selected for future planning/review. Use the standard
  model, not Fast/Ultrafast; preserve existing reasoning effort. Opus, Sonnet
  and Luna routing stays unchanged. Historical reviewer/model evidence records
  retain the model that actually performed the work.

- Continuation handoffs (2026-11-18): startup commands are for a new role session
  or work item. For same-task/role continuation, reuse unchanged instructions and
  contract already in context; read changed CURRENT/manifest sections and new
  review/diff/evidence. Check freshness narrowly when uncertain; reload necessary
  sections if changed or absent from context. Do not blindly trust stale context.
  Emit one short copy-paste continuation message with actual finding IDs and paths,
  not AGENTS→CURRENT startup instructions or command + duplicated long body.
  Users should not have to rewrite handoffs. Reissuing a command does not reset work.

- Research model routing (2026-11-18): planning/design and review research subagents use
  `openai/gpt-6-luna`; implementation/FIX subagents use `claude-agent/sonnet`
  (Sonnet 5.5, replacing Haiku). Main model/effort and independent review stay unchanged.
  Authorized read-only support: prior evidence discovery, affected-caller tracing,
  acceptance-to-test mapping. Same phase-based models; bounded repository reads
  under research-pilot.md. These support tasks remain read-only; the bounded low-risk
  Sonnet implementation exception below is separate. Acceptance is never delegated.
  Continue independent work in parallel; wait for dependent results, do not duplicate
  subagent research. No per-subtask approval or mandatory three-agent ceremony.

- Simplicity and evidence reuse (user clarification): before proposing a new test,
  fixture or implementation, check the relevant existing evidence against the diff.
  Reuse unaffected results; state the concrete changed/uncovered behavior before
  any repeat. Do not redo work because of a new session or missing old infrastructure.
  Keep one current next action; internal test branches are not user-managed tasks.
  Honor explicit deferrals without reopening them as development blockers; distinguish
  prior PASS, fresh PASS and deferred checks. Prefer the smallest sufficient solution.

- One task, one goal, one shared acceptance/state-transition table: finding → GPT
  solution plan → Opus implementation and verification → independent GPT review.
  Acceptance rows (FL/FS/FW etc.) are internal checks, not separate tasks, approvals
  or review sessions. Continue through the approved scope without per-row prompts.
- Opus knows review criteria before coding and checks behavior, affected callers,
  code cleanliness/standards and relevant tests/lint/typecheck/build before handoff.
  Required missing evidence blocks review-ready; explicitly deferred gates remain
  visible and are never silently waived. Self-review is not independent acceptance.
- Review returns one consolidated, evidenced list against the shared contract.
  Opus verifies root cause, reproduces with a regression, fixes and checks affected
  paths; external uncertainty uses bounded research under research-pilot.md.
  No blind patching or guarantee of one-pass success. Design/scope conflicts return
  to GPT; normal scoped fixes do not require a new plan or another approval.
- Reuse the existing Opus implementation and GPT review conversations for fixes.
  Separate the roles, not every turn. New sessions are for a new independent task,
  a role with no existing conversation, or demonstrated context degradation.
- execution-budget.md governs cost: 15000 output tokens is an internal efficiency
  checkpoint, not an approval stop; UNKNOWN alone never stops approved work.
  Stop for scope/product/security decisions, contract conflicts, missing information
  or infrastructure, destructive actions requiring permission, or two failed fixes
  of the same approach/invariant. Counters survive sessions.
- Report task + phase + remaining scope + whether a user decision is needed;
  do not make users coordinate individual tests. Preserve parent-task visibility.
- This decision supersedes conflicting budget, per-substep session/approval and
  single-documentation-pilot rules in older plans, manifests and global guidance.
  It does not change product scope, acceptance evidence, model/effort or physical gates.

## Low-risk delegation and validation — user decision, 2026-11-18

- Starting with the next work cycle, use execution-budget.md §4–5: plan identifies
  bounded low-risk work for direct Sonnet 5.5 implementation under `/implement`.
  Main Opus coordinates and verifies; no duplicate detailed Opus implementation
  before delegation. One writer per file, no concurrent shared build/device runs.
  Sensitive/concurrency/recovery work stays with Opus. Independent GPT acceptance
  remains mandatory. No new approval per routine bounded subtask.
- Research/read-only limits remain for research tasks; only the explicitly assigned
  low-risk implementation task may edit allowlisted files and run selected checks.
- Select validation once from diff/acceptance, reuse evidence/commands, run narrow
  compile/typecheck before costly runtime, inspect normal/recovery/error callers
  before review. Update selection only for changed behavior or unresolved findings.
- Existing in-progress review and its handoff stay unchanged. The old separate
  implementation pilot command and one-pilot restriction are retired. This section
  supersedes older coding-delegation bans, not scope/security/failed-attempt gates.

## Roles and workflow — user decision, 2026-11-09

- Harness: OpenCode v2. Roles run in separate, user-started sessions:
  GPT plans and reviews; Claude (Opus) implements. Earlier role splits
  (Codex implementer, Claude design-only or Claude owning steps 18–20) are void.
- Order: (1) one-time review of past work, (2) finish remaining development,
  including Lovable transfer gaps, (3) one full regression run, (4) physical
  acceptance per the 20–21 collection and field findings.
- Every work item starts from a GPT plan: goal, files/flows, behavior to
  preserve, narrowest validation. Open product decisions go through `grill-me`.
- Implementer handoff to review: start HEAD, diff scope (tracked + untracked),
  commands run with log paths under `docs/implementation/evidence/`, fresh vs.
  reused evidence, open gates. Review findings return only as scoped fixes.
- A GPT review of the real diff in a separate session counts as the
  independent review gate. A same-session self-review still does not.
- Review closeout clarification (2026-11-11): stay in OpenCode. Opus handles
  implementation, scoped verification and handoff; it leaves the item unchecked
  and awaiting GPT review. The separate GPT reviewer records its review and,
  only on acceptance, updates CURRENT/the relevant manifest and checks the item.
  No extra Opus session for administrative closeout. Review may edit those
  records, never product code; unresolved acceptance gates remain explicit.
  Plans identify target files/symbols, expected behavior changes and acceptance
  criteria, separating verified findings from assumptions.
- This section supersedes any conflicting older role or automatic-continuation
  text in this file or in archived handoffs.

## Session boundary clarification — user decision, 2026-11-11

- Shared goal contract (2026-11-15): GPT defines one observable goal, explicit
  non-goals, stable acceptance IDs and the relevant state/event/expected-result
  table in the work item's plan. Implementation and independent review use that
  same contract; the existing manifest maps IDs to evidence/open status. Do not
  duplicate or silently redefine the goal. Close only when all required criteria
  are evidenced; a budget stop is partial, not completion. Existing explicit
  deferred physical/release gates stay visible. This does not authorize unlimited
  work, bypassing stops, or changing scope to claim completion.

- Execution quality/cost gates (2026-11-12): planning and implementation use
  `docs/implementation/execution-budget.md`: resolved design before coding,
  one representative regression/minimum fix before expansion, a 15000-output-token
  internal efficiency checkpoint (thinking included; UNKNOWN is not a stop),
  and bounded low-risk Sonnet delegation under the 18.11 policy.
  Never invent usage or silently lower security checks/model effort. This policy
  supersedes automatic continuation only at its specified stop gates. Existing
  F1 is not the lightweight-model pilot; a further rejected clock-fix review needs
  GPT root-cause/design clarification before another implementation handoff.

- State-aware handoff (2026-11-12): /implement reads CURRENT first and routes to
  INITIAL or scoped FIX; it must not inject/reapply the whole original plan for
  a review correction. REVIEW/completed/unapproved states do not authorize coding.
  Review owns the current state and exact review/manifest pointers. FIX starts
  with an invariant/event-sequence regression on the shared production path;
  expected behavior comes from approved acceptance, never from faulty code.
  Track failed fixes by invariant in the existing manifest, not just finding ID.
  Two failed fixes of the same approach require design reassessment; new finding
  IDs and sessions do not reset the count. Preserve security checks and user scope
  approvals; these routing rules do not automatically launch another session.

- Compact context policy (2026-11-11): CURRENT is only the active checkpoint,
  backlog and decision/evidence pointers; do not append full plans or history.
  Historical CURRENT records and research appendices are on-demand, section-only
  references, never mandatory startup input. Future next-plan files contain the
  executable contract; long research lives in an item-specific linked appendix.
  Aim for 100–150 plan lines without omitting safety invariants or acceptance
  criteria. Do not reread a full plan already injected by a command unless it
  changed. Discover symbols/callers first, read whole files when necessary for
  correctness, and keep raw verification logs on disk. Existing approved active
  F1 plan is not retroactively shortened during implementation.

- This clarification supersedes older instructions requiring a new session at
  every substep or research checkpoint. One work item per session does not mean
  one question or tool phase per session.
- Keep planning, read-only research, design clarification and plan updates for
  the same item in the same GPT session. A research checkpoint is not an
  automatic handoff to implementation: state whether the plan is ready.
- Use a separate Opus session for implementation. Keep scoped coding,
  verification and fixes to its own implementation within the approved plan in
  that session. Scope/security-policy changes require a plan decision, not an
  implementer rewrite of the approved design.
- Use a separate GPT session for independent review. Keep review clarification,
  evidence completion and administrative closeout in that review session.
- Reuse each role's existing session for this work item; create one if absent.
  Start a new session for a new independent work item. Context
  degradation may justify a compact handoff; do not restart merely for a substep.
  A new session never resets the two-failed-attempt stop rule.
- End task updates with: `Durum: ...`, `Devam: AYNI SOHBET / YENİ SOHBET / DUR —
  kullanıcı kararı`, `Rol: GPT plan / Opus uygulama / GPT review`, and the exact
  next command or prompt. For a finished task, give the next step and stop;
  for an unresolved same-role substep, continue here unless user input is needed.

## Single-agent and usage policy — user decision, 2026-10-29

- Research delegation authorized 2026-11-16 in plan, implementation and review:
  use lower-cost subagents for bounded external questions independent of private
  project context, under `docs/implementation/research-pilot.md`. No quota-reset
  condition or per-question approval. No synthetic research to exercise a pilot.
- Product-code decisions and independent review stay with their main agents;
  read-only support and the 18.11 low-risk implementation exception are allowed.
  No acceptance delegation or automatic Astra invocation.
- Keep the main model and effort unchanged.
- Use Serena for targeted symbol/caller/reference discovery when useful; verify
  project activation and available tools first. It does not replace ADRs.
- Use the single startup rule above. Do not load the entire chat, enumerate/read
  all documents, or replay historical evidence by default.
- Reuse existing mechanisms/fixtures. State the smallest validation path before
  substantial work; prove one representative path before broadening a matrix.
- Batch routine checks; repeat only checks affected by a change or unresolved
  failure. Do not redo full capture/build matrices after every cosmetic edit.
- Perform a separate review pass after implementation. A same-agent review is
  not an independent-agent review; report that distinction honestly. If a gate
  truly requires independent review, report it instead of launching another agent.
- Run the relevant tests/lint/typecheck/build and scoped isolated smoke; never
  trade away security, recovery or accessibility to reduce usage.

## Lower-usage execution policy — user-approved, 2026-10-30

- Apply cheap elimination first: exact candidate/version, license/advisory and one
  strict host path before expanding a platform matrix. A failed critical gate
  blocks wider builds until its cause/direction is resolved.
- After candidate acceptance, validate one Android arm64 and one iOS Simulator
  target first. Run the required full matrix once at a stable checkpoint; repeat
  only checks affected by semantic changes or an unresolved failure. Preserve all
  security, recovery, accessibility and platform acceptance requirements.
- Read only the current compact checkpoint and directly relevant symbols/callers.
  Do not reload old histories, already-read manuals, whole files or broad web
  pages when a targeted section suffices. Keep raw logs on disk; return status
  and the relevant small error excerpt to context.
- Reuse validated toolchain/fixture commands; check compiler/rustdoc/Clippy and
  fixture readiness once before testing. Diagnose the current blocker before
  opening another implementation branch.
- Maintain one short current handoff pointer and one evidence manifest per work
  group. Avoid duplicating long status histories across documents. Report actual
  acceptance criteria completed; do not turn routine choices into approval gates.

## Task boundaries and lower usage — user decision, 2026-11-02

- This user decision supersedes automatic continuation and older repeat-check defaults.
- Batch independent checks and reads in one tool call. Keep raw logs on disk; return only status and a small relevant error excerpt.
- Verify fixture/server/permissions and one representative path before expanding a build or platform matrix.
- Do not repeat successful tests. Reuse their recorded source/variant hashes and results; identify any changed or uncovered behavior explicitly rather than silently treating old evidence as current.
- At the whole-task/role handoff, write one compact checkpoint and exact prompt;
  stop before the next independent task. Internal acceptance rows are not task boundaries.

## Scope and capture discipline

- If implementation expands an approved decision (more files/lines, a new ABI,
  etc.), present the expanded diff and obtain explicit approval again. Never
  count the old approval as authorization for expanded scope.
- Visual validation defaults to scripted batch capture. Screen-by-screen browser
  navigation is only for diagnosing a specific defect. Track the missing durable
  capture script as pending in CURRENT; do not invent a runnable command.

## Execution flow
Follow the order in "Roles and workflow"; do not start a work item without
its GPT plan. Update CURRENT, not a growing history, after a meaningful work group.

After completing a task:
- report its acceptance using existing successful evidence without rerunning it,
- write one short checkpoint with exact next scope and remaining gates,
- direct the user to a new conversation and stop; do not start the next task here.

Stop only if:
- a new architectural/security-policy decision is required,
- requirements conflict,
- a destructive/irreversible action is needed,
- progress is blocked by missing information or failing infrastructure.


## Development Workflow

- Treat the current ADRs and implementation handoff as authoritative.
- Read the relevant ADR before modifying security-sensitive code.
- Preserve PC-first offline LAN behavior and PC-local ACL.
- Never reintroduce JWT/KMS as a LAN prerequisite.
- Do not change unresolved recovery or remote policies.
- Prefer minimal changes and existing abstractions.
- Review security-sensitive changes in a separate pass; disclose any unmet independent-review gate.
- Defer physical acceptance to the documented acceptance gate.
- Never report unperformed tests as PASS.
- Do not add, commit, push, reset, clean, or stash Git changes
  unless explicitly instructed.
- Update handoff documentation when completing a meaningful work group.
