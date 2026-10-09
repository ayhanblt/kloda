<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer — your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<what to look up>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<what to look up>"` — run a separate `docs` command per distinct concept if the question spans multiple topics, unless it's about how they interact
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Be specific about what to look up in the library's documentation — specific and detailed queries return better results than vague single words, but keep each query to a single concept unless the question is about how concepts interact; combined multi-topic queries dilute ranking and return shallow results for each topic. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
Run Context7 CLI requests outside Codex's default sandbox. If a Context7 CLI command fails with DNS or network errors such as ENOTFOUND, host resolution failures, or fetch failed, rerun it outside the sandbox instead of retrying inside the sandbox.
<!-- context7 -->


## Subagent model routing

When delegating work:

- Use `fast` for mechanical, well-specified, low-risk work:
  simple edits, configuration, boilerplate, data/evidence collection,
  straightforward tests, repetitive implementation.

- Use `good` for work requiring judgment:
  non-trivial debugging, native integration, multi-file refactors,
  protocol/state logic, concurrency, persistence, recovery, or security-sensitive implementation.

Start with `fast` when the task is clearly mechanical.
Escalate to `good` if the fast worker stalls, discovers ambiguity, or requires design judgment.

Choose by the specific subtask's complexity, not by the subagent/session name.

## Usage-budget policy

Optimize for limited model usage and context budget.

Before spawning subagents or starting PoCs:
- Prefer the smallest experiment that can falsify or validate the current assumption.
- Do not build production-grade abstractions for a PoC unless the acceptance criteria explicitly require them.
- Avoid duplicating implementation in temporary PoC environments.
- Reuse existing code, fixtures, and agents whenever possible.
- Prefer one focused subagent over several parallel agents when parallelism does not materially shorten the critical path.
- Use cheaper models for mechanical, deterministic, low-risk subtasks.
- Use GPT-6.1 Sol Medium for normal implementation.
- Escalate to Sol High or Astra only when the task materially requires deeper reasoning.
- Do not run exhaustive build/test matrices before the minimal path works.
- Stop expanding scope once the PoC acceptance criteria are satisfied.
- If a task is likely to consume substantial usage, first state the minimal validation path and avoid speculative extra work.

The goal is not maximum implementation breadth per task; it is maximum validated progress per unit of model usage.

For routine/mechanical tasks, delegate to @smol:
- repository search
- file/symbol lookup
- evidence extraction
- simple edits
- repetitive test fixes
- documentation updates

Use @default only for tasks requiring judgment, multi-file reasoning, or design decisions.

## Execution flow
Continue through roadmap steps without waiting for user confirmation.

After completing a step:
- verify it with tests/build/checks,
- immediately continue to the next incomplete step,
- do not ask for approval between steps.

Stop only if:
- a new architectural decision is required,
- requirements conflict,
- a destructive/irreversible action is needed,
- progress is blocked by missing information or failing infrastructure.


