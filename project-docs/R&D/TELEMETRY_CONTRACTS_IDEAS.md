# Telemetry Contracts Ideas

Status: Candidate

This document captures ideas for shared Gaggi ecosystem data contracts.

These notes are not active implementation work.

---

# Core Principle

Do not merge repos into one monolith.

Merge language first:

- shared telemetry terms
- shared event names
- shared shot schema
- shared profile schema
- shared scale packet schema
- shared versioning rules

---

# Future Candidate: GaggiCore

A future shared specification repo could exist as:

```text
GaggiCore
```

Purpose:

- shared contracts
- shared schema docs
- example fixtures
- versioned telemetry vocabulary

It should not contain UI or runtime logic.

---

# Candidate Contract Types

## Shot Contract

Possible fields:

```json
{
  "id": "string",
  "timestamp": "unixSeconds",
  "profileId": "string",
  "profileName": "string",
  "profileVersion": "string",
  "durationMs": "number",
  "samples": [],
  "events": [],
  "notes": {},
  "source": "gaggimate|gaggibre|browser|imported"
}
```

---

## Sample Contract

Possible fields:

```json
{
  "t": "milliseconds",
  "pressure": "bar",
  "targetPressure": "bar",
  "flow": "mlPerSecond",
  "targetFlow": "mlPerSecond",
  "puckFlow": "mlPerSecond",
  "temperature": "celsius",
  "targetTemperature": "celsius",
  "weight": "grams",
  "weightFlow": "gramsPerSecond",
  "phase": "number",
  "phaseName": "string"
}
```

---

## Event Contract

Possible event types:

- phase_start
- phase_end
- shot_start
- shot_stop
- channeling_detected
- adaptive_correction
- target_change
- scale_connected
- scale_disconnected
- sensor_warning
- user_annotation

Example:

```json
{
  "type": "adaptive_correction",
  "t": 12500,
  "severity": "info",
  "label": "Flow correction",
  "data": {
    "targetFlow": 2.3,
    "actualFlow": 3.1,
    "pumpAdjustment": -0.08
  }
}
```

---

## Profile Contract

Possible fields:

```json
{
  "id": "string",
  "name": "string",
  "version": "string",
  "createdAt": "isoDate",
  "updatedAt": "isoDate",
  "phases": [],
  "source": "gaggimate|gaggibre|browser|imported"
}
```

---

## Scale Packet Contract

Possible fields:

```json
{
  "source": "gaggistop",
  "timestamp": "milliseconds",
  "weight": "grams",
  "flow": "gramsPerSecond",
  "stable": "boolean",
  "battery": "optionalNumber",
  "signal": "optionalNumber"
}
```

---

# Why This Matters

Shared contracts allow:

- GaggiMate to execute safely
- GaggiBre to enrich telemetry
- GaggiStop to provide weight data
- GaggiGo to analyse and visualise everything locally

without coupling all repos together.

---

# Graduation Rule

Contracts should only become active roadmap work after:

1. current cleanup/hardening phase is complete
2. existing data shapes are audited
3. fixtures are collected from real shots
4. compatibility with GaggiMate/GaggiBre/GaggiGo is checked
