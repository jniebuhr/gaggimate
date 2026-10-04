# Brew-priority heater coordination

This independent feature is based on current upstream/master and reuses the earlier
heater-coordination implementation. It does not include the steam toggle/state-memory
controls or depend on the SPX hardware adaptation.

In `ControllerConfig`, `heaterPriorityControl` defaults to false. Dual-boiler
Max defaults to enabled. The WebUI Machine tab exposes Enable heater coordination
and the handover pause. Disable it for a machine whose electrical supply supports
both heaters simultaneously. Settings are persisted on both display and controller
and apply after a machine restart. The output owner remains present with priority
disabled so both heaters can receive ON requests. Single-boiler machines do not
instantiate the coordinator.

`heaterMinOffTime` specifies the cross-heater handover gap in milliseconds.
The upstream defaults (including Max) are 50 ms; the coordinator enforces a
20 ms minimum. Choose this from the SSR's worst-case drop-out time and the
drive circuit, not boiler size. Verify the required gap for the SSRs installed
in each machine before reducing the default.

## Operation

- Both PIDs continue computing their own PWM requests at the existing cadence.
- Only the coordinator task can switch coordinated outputs ON. It runs every
  10 ms; the heater tasks can still turn outputs OFF immediately.
- Brew wins whenever both request ON. Steam uses available brew PWM-off slots;
  full brew demand can starve steam heating.
- The outgoing output is switched OFF before the other can turn ON. The gap
  starts after the off write completes, and applies in both directions.
- Output mutexes serialize safety-off and coordinator writes. ON commands
  recheck the latest request, enable state and sensor fault status.
- Coordination is attached before heater tasks start. If its task cannot be
  created, both heaters remain inhibited and the controller enters shutdown.
- Brew autotuning suppresses steam throughout its heating and cooling phases.
  Steam autotuning is rejected while brew-priority coordination is enabled. Setpoint-off
  cancels active autotuning and clears its heater request.

PID gains, integral behavior, feedforward, NTC processing, pressure control,
are not retuned. A bounded HeaterCoordinationSettings command (payload tag 18)
carries the persisted machine configuration. Software PWM equality
now resolves to OFF (including a zero-duty request at the window boundary).
The existing PID anti-windup is not aware of externally denied steam heating;
steam recovery/overshoot under prolonged brew priority requires hardware checks.

Commanded output state is not a current measurement. This does not detect a
failed-on SSR or rising temperature while commanded off, nor does it replace
independent thermal/electrical protection. Actual handovers include task
scheduling and SSR turn-on latency in addition to the configured gap.
