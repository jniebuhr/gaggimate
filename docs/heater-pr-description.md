# Configurable heater coordination

Dual-boiler machines with limited supply power can prevent both heaters being enabled simultaneously. Reuses the previous coordinator on current upstream, preserves brew priority and break-before-make handover, and exposes enabled/disabled plus handover delay in WebUI machine settings. Disabled mode permits simultaneous heating. Settings persist on the controller and are loaded before either heater task starts; changes apply after a machine restart.

Steam toggling/state memory and machine sensor/refill/system-LED configuration belong to adapt/spx-hardware. This branch retains upstream PID, pressure and NTC scheduling. Native host tests cover arbitration, simultaneous-heating mode, shutdown veto, switch-off failure, timing wrap and stress; firmware builds cover display and controller. Hardware timing still requires machine validation.
