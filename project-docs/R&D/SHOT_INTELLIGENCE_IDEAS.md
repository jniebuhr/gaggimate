# Shot Intelligence Ideas

Status: Candidate

This document captures ideas related to telemetry-assisted learning, user feedback, extraction intelligence, and historical analysis.

These are not active roadmap commitments.

---

# Core Principle

The system should learn from:

```text
telemetry
+
human outcome feedback
```

without becoming a fake AI assistant.

The goal is:

```text
historical extraction intelligence
```

not automated coffee judgement.

---

# Delayed Feedback Model

## Concept

After a brew completes:

```text
brew ends
↓
local delayed timer (~5 minutes)
↓
simple feedback prompt
↓
save outcome against telemetry
```

Reason:

Immediate feedback is unreliable because:

- temperature changes flavour
- aftertaste develops later
- milk drinks evolve while drinking
- palate adaptation occurs during consumption

A delayed lightweight interaction gives better signal quality.

---

# Layer 1 — Low Friction Feedback

Status: Strong Candidate

Initial design:

```text
👍 / 👎
```

Important:

This should remain optional and user-configurable.

Suggested settings:

- disabled
- simple mode
- advanced mode

Reason:

Low friction creates sustainable long-term data collection.

---

# Layer 2 — Optional Quick Tags

Status: Candidate

Optional quick taste tags:

- bitter
- sour
- hollow
- thin
- muddy
- balanced
- sweet
- silky
- harsh
- sharp
- flat
- overbearing

These should remain optional.

---

# Layer 3 — Advanced Notes

Status: Candidate

Advanced optional fields:

- grinder comments
- puck prep notes
- workflow notes
- roast observations
- extraction comments
- free text

This should extend the existing notes system rather than replacing it.

---

# Preference Intelligence

## Goal

Build historical understanding from real user outcomes.

Examples:

```text
You consistently preferred:
- lower pressure on this bean
- longer preinfusion
- shots between days 10–18
- lower puck-flow variance
```

or:

```text
Historically disliked:
- rapid flow collapse
- shots above 94°C
- this roast after week 5
```

Important:

This is telemetry correlation.

Not AI judgement.

---

# Bean Performance History

Status: Candidate

Potential historical metrics:

- bean age vs outcome
- roast age vs extraction stability
- favourite roast windows
- grinder drift over bean lifetime
- profile effectiveness per bean

Potential outputs:

```text
This bean historically performed best between days 8–16.
```

---

# Known Good Shots

Status: Candidate

Allow users to mark:

```text
reference shots
```

Potential uses:

- compare against reference curves
- compare against favourite shots
- compare profile revisions
- train consistency metrics

---

# Extraction Fingerprinting

Status: Candidate

Generate extraction signatures from telemetry.

Possible inputs:

- pressure curve
- flow curve
- puck-flow behaviour
- weight curve
- phase timing
- temperature stability

Potential outputs:

- similar historical shots
- repeatable shot groups
- anomaly detection
- consistency tracking

---

# Historical Clustering

Status: Candidate

Group shots by behaviour.

Examples:

- stable extractions
- channeling-prone shots
- slow-flow shots
- unstable pressure shots
- highly repeatable shots

---

# Community Intelligence (Future Candidate)

Status: Parked

Potential optional future direction:

```text
anonymous telemetry sharing
```

Examples:

```text
Users with this bean/profile
historically preferred lower pressure.
```

Important:

This should remain:

- optional
- anonymised
- privacy-first
- local-first by default

---

# Important Boundary

GaggiGo should:

- observe
- correlate
- visualise
- assist understanding

GaggiGo should NOT:

- automatically override machine runtime
- autonomously modify brew behaviour
- become opaque AI automation
