# GaggiGo Patch Protocol

## Purpose

This document defines the safe workflow for modifying GaggiGo during the hardening and stabilization phase.

The goal is to keep terminal workflows fast while preventing:

- broken string-literal patching
- CRLF/LF mismatch failures
- incorrect path assumptions
- accidental no-op commits
- architecture drift
- blind edits without verification

The architecture work itself has been stable.
The biggest source of wasted time was unsafe patch delivery.

---

# Core Rule

```text
Inspect first.
Patch second.
Verify third.
Commit fourth.
```

Never skip verification.

---

# Correct Working Directory Rules

Always confirm working directory before patching.

```powershell
pwd
git status
```

## If current directory is:

```text
C:\Users\ed\GaggiGo
```

Use paths like:

```text
web/src/...
```

## If current directory is:

```text
C:\Users\ed\GaggiGo\web
```

Use paths like:

```text
src/...
```

Many earlier failures came from accidental:

```text
web/web/src/...
```

path duplication.

---

# Terminal Workflow Standard

Preferred workflow:

```text
1. inspect
2. patch narrowly
3. verify
4. diff
5. commit
6. push
7. verify remote
```

---

# Required Verification Steps

After every patch:

```powershell
git --no-pager diff -- <file>
```

And usually:

```powershell
Select-String -Path "<file>" -Pattern "<new code marker>"
```

Never commit if:

```text
- git diff is empty
- patch script reported failure
- expected markers do not exist
```

---

# Safe Patch Strategy

## Avoid

Unsafe giant string replacement:

```powershell
$content.Replace("huge exact block", "new huge exact block")
```

Why this fails:

- CRLF vs LF differences
- spacing changes
- comment changes
- indentation mismatch
- tiny formatting drift

This caused many no-op patches.

---

# Preferred Patch Strategy

Use:

- small regex replacements
- guarded patch scripts
- exact function targeting
- small scoped edits

Preferred pattern:

```js
if (!pattern.test(s)) {
  throw new Error('Target not found');
}
```

Patch scripts must fail loudly if target content does not exist.

---

# Patch Scope Rules

Patch:

- one import
- one function
- one condition
- one return path
- one logical block

Avoid giant multi-function replacements.

---

# VS Code vs Terminal Guidance

## Terminal is preferred for:

- small surgical patches
- grep/search
- verification
- git operations
- reproducible scripted changes
- audit-friendly work

## VS Code is preferred for:

- large rewrites
- UI restructuring
- JSX layout changes
- multi-function edits
- large formatting changes

---

# Commit Rules

Never commit directly after patch execution.

Always:

```powershell
git diff
```

before:

```powershell
git add
git commit
git push
```

---

# Remote Verification Rule

After pushing:

```text
verify GitHub remote state
```

Do not assume:

- push succeeded correctly
- patch actually applied
- local state equals remote state

Use:

```text
repo inspection
file inspection
or direct remote verification
```

---

# Recommended Runtime Workflow

```powershell
npm run dev -- --host
```

Then validate:

```text
online
offline
refresh
reconnect
cache behaviour
```

before considering architecture changes.

---

# Current Project Rule

```text
GaggiMate hydrates the local mirror.
GaggiGo renders cache-first.
```

Do not reintroduce:

- repeated live analysis fetches
- parallel cache architectures
- uncontrolled runtime writes
- machine-control drift

---

# Current Engineering Priority

Current project phase:

```text
Hardening and cleanup before sync/archive work.
```

Current priorities:

1. offline empty-state polish
2. cache/source indicator clarity
3. terminal/proxy noise reduction
4. dead-code audit
5. ApiService safe-boundary mapping

No feature expansion before this stabilisation work is complete.
