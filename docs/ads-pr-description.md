# Configurable ADS channel rates and averaged 50/60 Hz pressure control

Target: `gaggimate/gaggimate-contrib:feature/gaggimate-max`

## Summary

- Configure the requested SPS independently for all four ADS1115 channels;
  zero disables acquisition. GM Max defaults to `{500, 0, 35, 35}`.
- Use timer-notified, readiness-checked single-shot acquisition at the ADS's
  860 SPS setting, with a conservative 570 SPS aggregate requested budget.
- Average pressure conversions per controller interval. Default to 60 Hz,
  with a typed 50/60 Hz selection in `ControllerConfig`, and use elapsed time for filtering,
  derivatives, control integration and pumped-water integration.
- Preserve the supplied ADC patch's time-adjustable telemetry Kalman filter
  approach. Port the gm-max-pro pressure process-noise setting separately.
- Configure NTC processing intervals and smoothing per ADC channel. Max uses
  100 ms updates with the established smoothing time constant. Preserve the
  five-second fault-history duration with time-weighted invalid-input accounting.
  Keep electrical calibration, heater PID and SSR timing unchanged; reject rail
  samples and detect missing acquisition. Seed the filter from the first valid
  reading instead of ramping from zero.
- Report achieved channel rates and acquisition errors every ten seconds.

See [ads-sampling.md](ads-sampling.md) for configuration, behavior changes,
ownership rules and hardware validation guidance.

## Validation

- Controller firmware builds with the configurable 50/60 Hz implementation.
- Two existing successive-shot puck-flow regression tests pass.
- Three additional local scheduler/configuration/control checks pass, covering
  both configured rates. The temporary ADC test suite is excluded from this PR.
- `git diff --check` passes.
- Local NTC timing, smoothing and fault-duration checks pass.

Hardware validation remains necessary: confirm achieved SPS under normal
telemetry load, inspect pressure/pump-duty behavior on shots, and verify NTC
stability and fault handling. No firmware was flashed as part of this change.

## Scope

Controller-side changes only. No OTA, display, protocol, heater PID cadence,
or PSM zero-cross switching changes. Channel-rate configuration alone does
not instantiate additional sensors; board-specific sensor routing is retained.
