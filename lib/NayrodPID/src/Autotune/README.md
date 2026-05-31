# Autotune

This module figures out four numbers — `Kp`, `Ki`, `Kd`, and `Kff` — so the PID
controller in `Heater` can hold the boiler at the temperature you set, without
big swings, and without big dips when you pull a shot.

You don't have to know what those four numbers do yet. The job of the autotuner
is to **poke the boiler with full power, watch how it responds, and use that
response to compute the four numbers**. This file explains how.

## What the boiler looks like to the autotuner

A boiler isn't just a "thing that gets hot." It has two distinct behaviours
that show up clearly in a step response:

1. **Integrator behaviour.** The heater is a constant power source. While it's
   on, energy keeps piling into the water. The temperature doesn't *settle* at
   some new value the way a thermostat-with-a-radiator would — it just keeps
   rising. Mathematically, the temperature is roughly the *integral* of the
   power. That is why we call this an "integrator plant."
2. **A small parasitic lag.** The thermometer is bolted to the *outside* of the
   boiler shell. When the water heats up, the metal shell has to warm up first,
   then the thermometer tip catches up a moment later. From the thermometer's
   point of view, every change is delayed by a few seconds. That delay is a
   "first-order lag" with a time constant we call **τ₂**.

Add those together and the plant is an "integrator with lag." It's important
that we identified it correctly: most off-the-shelf PID auto-tuners assume a
simpler model (a tank that fills toward a target — called FOPDT), and when you
fit that wrong model to a boiler you end up with a tiny derivative gain
`Kd ≈ 1`. The hand-tuned gains that actually keep this hardware steady use
`Kd ≈ 400`. The model has to match the physics, or the numbers come out wrong
by hundreds of times.

## What the autotuner identifies

Three numbers describe the plant. Once we know them, we can compute the PID
gains from a formula.

| Symbol | Meaning | Units |
|---|---|---|
| `L` | **Dead time.** From the moment the heater turns on to the moment the temperature visibly starts rising. | seconds |
| `k'` | **Process gain at full power.** The maximum rate at which temperature rises while the heater is at 100%. | °C / second |
| `τ₂` | **Parasitic lag.** Time constant of the thermometer-on-shell delay. | seconds |

The state machine that finds these lives in `Autotune.cpp`, split into four
phases:

1. `primeBaselineSlope` (`Autotune.cpp:71`) — record what the temperature is
   doing before we touch anything. This gives us the noise floor.
2. `handlePreReactionSample` (`Autotune.cpp:84`) — turn the heater on, wait for
   the temperature to actually start moving. The moment it does is `L`.
3. `handlePostReactionSample` (`Autotune.cpp:109`) — keep watching while the
   slope grows, then levels off. The level-off slope is `k'`.
4. `finalizeInflection` (`Autotune.cpp:142`) — recover `τ₂` from the shape of
   the rising curve, then compute the four PID gains.

## Step 1 — Detect the reaction (find `L`)

We can't just say "the temperature changed, the heater must be working." A
thermocouple has noise. A single-bit jitter at 0.25 °C/sample looks like a
slope of 0.25 °C/s for one tick. So we do two things:

1. **Fit a slope over a moving window**, not a one-sample difference.
   `computeSlope` (`Autotune.cpp:251`) does a least-squares line fit through
   the last `N` (temperature, time) pairs. The slope of that line is much less
   noisy than `(latest − previous) / Δt`.
2. **Require the slope to stay above a threshold for several samples in a row**
   before we declare "the boiler reacted." The threshold is
   `epsilon = 0.1 °C/s` (`Autotune.h:78`) — about twice the sensor's
   single-bit noise floor — and we need 5 consecutive confirmations
   (`Autotune.h:81`) before believing it. One stray noisy sample no longer
   triggers a false reaction.

The time from "heater on" to "first sample of the confirmed streak" is `L`.

## Step 2 — Capture peak slope (find `k'`)

While the heater is still at 100%, the slope of the temperature curve is still
changing — it grows toward a maximum. Why? Because of τ₂. The thermometer is
catching up to the water; once it has caught up, the slope it reports matches
the rate at which the water is actually heating, and stops increasing.

We watch the *slope of the slope*. When it gets near zero (and the temperature
has risen by at least 10 °C, so we're not just seeing noise on a flat curve),
the boiler has reached its full reaction rate. That rate is `k'`.

## Step 3 — Recover `τ₂` by exponential peeling

Now the clever part. For an integrator-with-lag plant driven by a step, the
slope of the temperature follows an exponential approach toward `k'`:

```
slope(t) = k' · ( 1 − e^(−(t − L) / τ₂) )
```

We don't know τ₂ — that's what we're trying to find. But we can rearrange:

```
k' − slope(t)  =  k' · e^(−(t − L) / τ₂)
```

Take the natural log of both sides:

```
ln( k' − slope(t) )  =  ln(k')  −  (t − L) / τ₂
```

That is the equation of a **straight line** in `t`, with slope `−1/τ₂`. So if
you take every (time, slope) sample collected during the rise, plot
`ln(k' − slope)` against `t`, and fit a line through the points, the slope of
that line is `−1/τ₂`. Flip the sign, take the reciprocal, you have τ₂.

This trick is called **exponential peeling** and dates to Riggleman (1947); it
shows up in pharmacokinetics every time someone fits a multi-compartment
model. The implementation is in `identifyTau2` (`Autotune.cpp:193`).

A few practical guards:

- The first few samples (where `slope ≈ 0`) and the last few (where
  `slope ≈ k'`) are dominated by noise — `ln(k' − slope)` blows up at one end
  and goes to `−∞` at the other. We keep only samples where the "deficit"
  `k' − slope` is between 5% and 95% of `k'`.
- If we have fewer than 8 usable samples, or τ₂ comes out implausible (less
  than half a second, or larger than `L`), we fall back to `τ₂ = 0.2·L` — a
  rough rule that is wrong but not dangerous.

## Step 4 — Compute PID gains (the SIMC rule)

With `L`, `k'`, `τ₂` in hand, we compute the four PID numbers. The recipe is
**SIMC** — Skogestad's "Simple Internal Model Control" tuning rule (Skogestad,
*J. Process Control* 13:291, 2003). For an integrator-with-lag plant, the
parallel-form PID gains are:

```
τc = 1.5 · L                 (closed-loop time constant — see below)

Kp = 1 / ( k' · (τc + L) )   stiffness: how hard to push back per °C of error
Ti = 4 · (τc + L)            integral time: how long to remember past error
Td = τ₂                      derivative time: how far ahead to look
Ki = Kp / Ti                 derived from clamped Kp (see safety nets)
```

Source: `computeControllerGains` (`Autotune.cpp:148`).

The single design knob is **τc**, the desired closed-loop time constant.
Smaller τc means a snappier controller that reacts hard to disturbances but
will overshoot and ring. Larger τc means a calmer, more robust controller that
takes longer to recover. Skogestad's "smooth robust" default — the one we use
— is `τc = 1.5·L`. It's a reliable middle ground for thermal plants without
having to retune for every machine.

### Why this rule is offset-invariant

Some espresso setups apply a +7 °C "display offset" that maps the
shell-mounted thermocouple reading to an estimated water temperature. That
offset is a *constant*. All three identified parameters — `k'`, `L`, `τ₂` —
are derived from *rates of change* and *durations*, not from absolute
temperature values. A constant offset cancels out of every formula above.
Different machines come back with different gains because the physics is
genuinely different (heater wattage, thermal mass, shell bonding), not because
of measurement bias.

## Kff — feedforward from heater wattage

`Kff` does not come from `k'`, `L`, or `τ₂`. It is a separate gain that says
"if I expect a known heat loss of `H` watts (cold water flowing in during a
shot), how much extra duty cycle should I command to compensate?" That mapping
depends on the *individual machine's heater power*, which the plant
identification cannot recover on its own.

`Heater.cpp:201` derives it from the wattage the user enters in the Web UI:

```
Kff = 1000 / heaterWattage
```

The 1000 comes from `TUNER_OUTPUT_SPAN`, the controller's full-scale duty
output. Worked example: a Gaggia Classic Pro 2019 has a 680 W boiler, so

```
Kff = 1000 / 680 ≈ 1.47
```

If the user does not supply a wattage, `Kff` stays at 0 and the controller
behaves as if there were no feedforward — the same as before this feature
existed.

## Safety nets

Identification can fail in many ways: a sensor wire could break mid-test, the
boiler might already be hot enough that the slope never crosses the
confirmation threshold, the user might hit "stop." In every failure path,
**we must not write zeros to the persistent gain storage** — that would brick
the controller until the user re-tuned by hand.

- Each phase has its own timeout. If we overshoot it, `timedOut` flips on
  (`Autotune.h:113`) and the Heater's `loopAutotune` notices it via
  `isTimedOut()` *before* it would call the gain-write callback. The previous
  PID gains are preserved.
- During the test, every iteration re-checks the sensor's error state. The
  MAX31855 returns 0 °C on a fault, which would otherwise look to the
  autotuner like a perfectly stable but cold boiler.
- Computed gains are clamped before being written: `Kp ∈ [0.02, 0.30]` and
  `Kd ∈ [0.05, 0.80]` (`Autotune.cpp:180`). Heater multiplies by 1000 when
  applying these, so the on-machine ranges are `Kp ∈ [20, 300]` and
  `Kd ∈ [50, 800]`. `Ki` is derived *from the clamped* `Kp` so the SIMC
  invariant `Ki = Kp/Ti` still holds at the clamp edges.
- The setter functions (`setEpsilon`, `setRequiredConfirmations`, `setTimeOut`,
  `setWindowsize`) snap zero, negative, and non-finite inputs to safe
  defaults. A malformed BLE message can't wedge the state machine.

## Tunable knobs (override via `Heater::setupAutotune`)

| Knob | Default | Range | Meaning |
|---|---|---|---|
| Test duration | 120 s | 30–300 | Hard cap on the whole identification test. |
| Slope window `N` | 4 (Heater overrides to 6) | 4–20 | Number of samples in the moving slope fit. |
| `epsilon` | 0.1 °C/s | — | Slope threshold above the noise floor for "boiler reacted." |
| `requiredConfirmations` | 5 | — | How many consecutive samples must clear `epsilon`. |
| Heater wattage | (user-supplied) | 300–1500 W | Drives the `Kff = 1000/W` derivation. 0 = skip Kff. |

## Running an autotune

From the Web UI's Autotune page: enter the test duration, slope window, and —
if you know it — the heater wattage. Hit start. The Heater drives the boiler
to full power, the autotuner watches the response, and on success the four
gains are written to NVS and announced over BLE. On any failure (timeout,
sensor fault, identification implausible) the previous gains are preserved
and the UI shows an "Autotune Failed" card.

## References

- Skogestad, S. (2003). *Simple analytic rules for model reduction and PID
  controller tuning.* Journal of Process Control, 13(4), 291–309. — The SIMC
  tuning rule we use, including the integrator-with-lag formulas and the
  `τc = 1.5·L` default.
- Riggleman, D. (1947). *Methods of analysis of multi-compartment systems.* —
  Original published source for exponential peeling as a parameter
  identification technique.
