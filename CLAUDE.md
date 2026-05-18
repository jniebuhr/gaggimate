# CLAUDE.md

Project guidance for Claude Code. Technical architecture details are in [AGENTS.md](AGENTS.md).

## Workflow: Linear Issue Tracking

**Every piece of work must have a Linear issue before or alongside implementation.**

This applies to:
- New features
- Bug fixes
- Improvements / refactors
- Documentation updates
- Hardware changes

### When to create issues

- Identifying a bug while reading code → create a Linear issue immediately
- Starting any implementation task → create the issue first, then implement
- Receiving a vague request → clarify scope, then create the issue
- Spotting technical debt or a missing test → log it as a Linear issue so it isn't lost

### Issue quality requirements

Every issue must include:

1. **Clear title** — one sentence describing the outcome, not the task (e.g. "BLE scale reconnects after display wake" not "fix ble")
2. **Goal / Problem** — why this matters; what breaks or is missing today
3. **Implementation notes** — relevant file paths, architectural constraints, API details
4. **Acceptance criteria** — a checkbox list of concrete, verifiable conditions that define done

### Linear workspace details

- **Team**: Carlos Hernández (key: `CAR`)
- **Project**: Gaggimate (for all firmware, web UI, hardware, and docs work)
- **Labels to apply**: choose from `Bug`, `Feature`, `Improvement` plus one of `firmware`, `web-ui`, `hardware`, `documentation`
- **Priority**: set honestly — `Urgent` for regressions/safety, `High` for user-facing breakage, `Medium` for planned features, `Low` for polish

### Process

1. Create the Linear issue (via MCP tools or the Linear app)
2. Note the issue ID (e.g. `CAR-42`) in your commit messages and PR description
3. Move the issue to **In Progress** when work starts, **Done** when the PR merges
