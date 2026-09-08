# ADC acquisition and pressure control

`ControllerConfig::adcRates` defines the requested samples/second for ADS1115
channels 0, 1, 2, and 3. Zero disables a channel. The total must be between 1
and 570 SPS when an ADC is instantiated; invalid allocations fail initialization
with an error log. Standard boards do not instantiate an ADC and use all zeros.

| Configuration | Channel 0 | Channel 1 | Channel 2 | Channel 3 |
| --- | ---: | ---: | ---: | ---: |
| GM Standard Rev 1.x / 2.x / 3.x | 0 | 0 | 0 | 0 |
| GM Pro Rev 1.0 / 1.1 / Lego | 500 | 0 | 0 | 0 |
| GM Max (default) | 500 | 0 | 35 | 35 |
| Pressure plus fast auxiliary | 500 | 50 | 0 | 0 |
| Pressure plus three auxiliaries | 500 | 50 | 10 | 10 |

For example, set `.adcRates = {500, 50, 10, 10}` after `.capabilites` in a
board configuration. Assigning a rate enables acquisition only: the machine
must still instantiate and route the appropriate sensor for that channel.
GM Max currently instantiates pressure on 0 and NTCs on 2 and 3.

The ADC remains at 860 SPS internally, 400 kHz I2C, and single-shot mode. A
one-shot `esp_timer` notifies an ADC task after 1400 us; the timer callback
does no I2C or filtering. The task verifies conversion readiness, retries if
needed, and starts the next due channel before delivering the previous result.
Absolute deadlines preserve requested average rates across normal multiplexing
jitter. A delay of 10 ms resynchronizes a channel instead of replaying old work.
Rates are targets, not hard real-time guarantees. Overhead or load can lower
the achieved rate. Every ten seconds the log reports per-channel SPS, failed
transactions/conversion timeouts, and schedule resynchronizations (`missed`).

## Pressure controller

Pressure is averaged over each controller interval and then fed into the
controller's own Kalman filter. The two-state telemetry filter consumes the
same average separately. Its sample time and rate leak are adjusted by elapsed
time, following the supplied ADC patch. The controller uses the gm-max-pro
pressure process-noise setting `(2 * sampleTime)^2`; this is a filtering change
as well as a cadence change and needs shot validation on the target machine.

Control defaults to 60 Hz (17, 17, 16 ms repeating). Set
`.pressureControlRate = PressureControlRate::Hz50` after `.adcRates` in the
board's `ControllerConfig` for 50 Hz mains; this uses 20 ms intervals.
Use `PressureControlRate::Hz60` for 60 Hz. The selected value is passed to
the sensor and pump controller at construction, without a build-flag override.
Changing these source defaults still requires rebuilding firmware; there is
no web UI setting or live rate switching in this change.
PSM still independently handles zero crossings. Neither
schedule is phase-locked to mains. A 60 Hz controller can operate with a 50 Hz
pump, but matching the nominal averaging window to the mains period improves
rejection of periodic ripple. Pulse skipping creates additional lower-frequency
variation, so period matching does not eliminate all ripple.

Pressure derivatives use elapsed sample-window time; control integration and
the pumped-water counter use elapsed controller time. Missing ADC windows do
not repeatedly update the measurement filter with stale input. This does not
introduce a new pressure-sensor shutdown policy.

## NTC compatibility

`ControllerConfig::ntcTiming` contains one `NtcTiming` per ADS channel, used only
for channels with an instantiated NTC. Each entry specifies `updateIntervalMs`
(20..1000 ms) and `smoothingTimeConstantMs` (finite, nonnegative; zero bypasses
smoothing). The generic defaults are 250 ms and 1120.355 ms respectively.
Max explicitly uses 100 ms updates for channels 2 and 3, normally averaging
3–4 conversions at 35 SPS. A 50 SPS fast NTC could average about five per
100 ms update. Acquisition rates and processing intervals are independent;
faster processing cannot manufacture readings when the ADC is slower.

For example, `{100, 250.0f}` selects 100 ms updates and a 250 ms smoothing
time constant. This is a tuning option, not a hardware-validated recommendation.
Max retains 1120.355 ms smoothing, equivalent to the original alpha=0.2 at
250 ms, while publishing more frequently with a shorter averaging window.
Alpha is calculated from actual elapsed time. The first valid reading seeds
the filter directly rather than ramping from zero. No-data iterations do not
re-filter cached data. Electrical calibration, heater PID and SSR timing are
unchanged. Rail samples and non-finite temperatures are rejected before filtering.

Fault history is time-weighted: 2500 ms of invalid input within the latest
5000 ms triggers the existing shutdown callback, independent of the processing
interval. Each fresh averaged reading classifies the elapsed interval since
the previous reading; fault transitions therefore have acquisition/update-time
resolution. Runs of equal validity are coalesced. This preserves the intended
duration of the original 10-invalid-out-of-20, 250 ms window, without shortening
it for fast NTCs. Missing acquisition separately times out after the largest
of one second, three requested ADC periods, and three processing intervals.
An invalid timing configuration also invokes shutdown. Faults are latched.
Each ADC average is a consuming read: assign one owner per channel and let
other consumers read that sensor's published value.

## Validation

Run `pio run -e controller` and `pio test -e native -f test_puckflow_latch`.
The existing tests cover successive-shot estimator behavior. Additional local
checks exercised scheduler allocations, disabled channels, transaction latency,
stall recovery, both configured controller rates, and missing measurements;
the temporary ADC test suite is intentionally not included in the PR.
Local NTC checks also cover sustained/intermittent faults, rolling history
expiry, variable update intervals and smoothing equivalence.

After flashing, verify approximately 500/0/35/35 SPS on GM Max, with zero
errors and missed deadlines during normal shots. Compare pressure, pump duty,
and NTC stability under normal BLE/telemetry load. Host simulation and a build
cannot establish actual ADC throughput or thermal/control-loop stability.
