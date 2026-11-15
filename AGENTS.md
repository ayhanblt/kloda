## Kloda project context

Current UI source of truth is the user-approved [Lovable design](docs/ui/lovable-design-reference.md), superseding the legacy Stitch folder. Preserve strict visual mapping, TR/EN/DE translation keys for all static user-facing text, Tailwind/existing NativeWind with shared global CSS (no new inline/page styles), Lucide, FSD/component boundaries and the existing300-line ESLint limit excluding comments/blank lines. Native OS/SwiftUI exceptions require an explicit decision.

## Single startup rule

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
  and a single explicitly selected low-risk Sonnet implementation pilot.
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
- Product-code investigation, implementation and independent review stay with
  their main agents; no coding/review delegation or automatic Astra invocation.
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
