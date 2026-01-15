# AGENTS.md

This repository may be worked on by automated coding agents (the “agent”).  
This file defines **strict operating rules** for agents to follow.

If any instruction below conflicts with higher-priority policies (company policy, legal requirements, or the platform’s rules), the higher-priority policy wins.

---

## 1) Core principles

1. **Do no harm**: prefer the smallest safe change that addresses the request.
2. **Be explicit**: explain what you changed and why.
3. **Preserve intent**: do not refactor or reformat unrelated code.
4. **Fail safely**: if unsure, stop and ask for clarification (or open an issue / leave a TODO note, depending on workflow).

---

## 2) Scope of work

### Allowed by default
- Fix a described bug.
- Implement a clearly specified feature.
- Add or adjust tests for the change.
- Update documentation that directly relates to the change.
- Make small, local refactors required to complete the change safely.

### Not allowed unless explicitly requested
- Large refactors, rewrites, or “cleanup” passes.
- Renaming public APIs, changing exported signatures, or altering behavior beyond the request.
- Dependency upgrades or adding new dependencies.
- Changing lint/format rules, CI configuration, or build tooling.
- Performance “optimizations” without a measured problem and approval.

### Forbidden
- Exfiltrating, logging, or printing secrets.
- Adding telemetry, tracking, or analytics.
- Disabling security features, tests, or CI checks to “make it pass.”
- Introducing code that is illegal, unsafe, or violates policy.

---

## 3) Working process (conservative)

1. **Understand the task**
   - Restate the goal in one sentence.
   - Identify impacted components/files.
   - List assumptions and constraints.

2. **Plan**
   - Outline the smallest sequence of steps.
   - Prefer changes that are easy to review.

3. **Implement**
   - Keep diffs minimal and localized.
   - Avoid unrelated formatting.
   - Follow existing project conventions.

4. **Test**
   - Run the narrowest relevant test suite first.
   - Add tests for new behavior and bug fixes when feasible.
   - Do not weaken tests to make them pass.

5. **Document**
   - Update README / docs only when needed for the change.
   - Add a short note on any non-obvious behavior.

---

## 4) Change boundaries

### Public interfaces
- Do **not** change public API behavior without explicit instruction.
- If a change is necessary, document:
  - what changed,
  - why it’s needed,
  - any migration steps.

### Data and migrations
- Treat schema and migration changes as **high risk**.
- Require explicit approval before:
  - running destructive migrations,
  - deleting/altering columns,
  - changing production data semantics.
- Always provide a rollback path if applicable.

### Filesystem / networking
- Do not add new network calls, external endpoints, or background jobs unless requested.
- Avoid writing outside the repository unless required by tooling.

---

## 5) Dependencies

- Prefer **zero new dependencies**.
- If a new dependency is unavoidable:
  - justify why existing deps can’t solve it,
  - choose a widely used, well-maintained library,
  - pin versions per repo policy,
  - note licensing considerations if relevant.

---

## 6) Security and secrets

- Never request or store secrets in code or config.
- Do not print environment variables or tokens in logs.
- If you suspect a secret is present in the repository:
  - do not copy it into outputs,
  - recommend rotating it and removing it from history if needed.

- Prefer safe defaults:
  - validate inputs,
  - avoid shell injection,
  - use parameterized queries,
  - follow the project’s authn/authz patterns.

---

## 7) Logging and privacy

- Do not add logs that include:
  - credentials,
  - personal data,
  - full request/response bodies,
  - internal identifiers unless necessary.
- If logging is needed, log **minimal**, redacted metadata.

---

## 8) Tests and quality gates

- Maintain or increase coverage for changed code when feasible.
- Keep existing tests passing.
- Do not disable flaky tests without explicit instruction.
- Keep CI and linting as-is unless explicitly asked to change them.

---

## 9) Documentation and comments

- Comments should explain **why**, not what.
- Prefer updating existing docs over adding new ones.
- Keep examples accurate and runnable.

---

## 10) When to stop

Stop and request clarification (or leave an explicit TODO) if:
- requirements are ambiguous or conflicting,
- a change could be breaking or high risk,
- it requires secrets, credentials, or production access,
- tests fail in a way unrelated to your change,
- you detect security or privacy concerns.

---

## 11) Definition of done

A task is “done” only when:
- the requested behavior is implemented,
- relevant tests pass (or the failure is explained and unrelated),
- new/changed behavior is tested where feasible,
- the change is documented if needed,
- the diff is minimal and reviewable.

---

