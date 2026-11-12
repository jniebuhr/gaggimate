// Types for the device WebSocket (/ws). Type-only module: import with
// `/** @typedef {import('./machineTypes.js').MachineState} MachineState */`.
// Wire shapes mirror WebSocketHandler.cpp on the firmware and docs/websocket-api.yaml.

/**
 * Firmware warning state (`warn` entry of evt:status).
 * @typedef {object} WarningStateFrame
 * @property {string} k Warning key, matches WarningManager on the firmware.
 * @property {number} [l] Level, see WARNING_LEVEL.
 * @property {boolean} [a] Whether the warning is currently active.
 */

/**
 * @typedef {object} WarningState
 * @property {string} key
 * @property {number} level
 * @property {boolean} active
 */

/**
 * Progress of the running or last process (`process` of evt:status).
 * @typedef {object} ProcessProgress
 * @property {0 | 1} a Active.
 * @property {'brew' | 'infusion' | 'grind'} [s] Stage.
 * @property {string} [l] Phase label.
 * @property {number} [e] Elapsed ms since the process started.
 * @property {0 | 1} [u] Utility (non-espresso) profile.
 * @property {'volumetric' | 'time'} [tt] Target type of the current phase.
 * @property {number} [pt] Phase target: grams or ms, depending on `tt`.
 * @property {number} [pp] Phase progress in the same unit as `pt`.
 */

/**
 * One scale reading in a SmartDoseStatus; weights are only sent while connected.
 * @typedef {object} SmartDoseMeasurement
 * @property {'hardware' | 'bluetooth'} source
 * @property {boolean} connected
 * @property {number} calibration Tare weight of the accessory.
 * @property {boolean} manual Scale used for manual dosing.
 * @property {number} [gross]
 * @property {number} [raw]
 * @property {number} [weight]
 */

/**
 * SmartDose state from SmartDosePlugin::status. When disabled only the boolean
 * flags are sent, all false.
 * @typedef {object} SmartDoseStatus
 * @property {boolean} enabled
 * @property {boolean} connected
 * @property {boolean} available
 * @property {boolean} blinking
 * @property {boolean} adjustable
 * @property {number} [weight] Dose weight.
 * @property {number} [gross] Weight above the tare baseline.
 * @property {number} [doseIn] Dose of the selected profile.
 * @property {number} [cupWeight]
 * @property {number} [portafilterWeight]
 * @property {'hardware' | 'bluetooth'} [source]
 * @property {'manual' | 'portafilter' | 'cup'} [accessory]
 * @property {'hardware' | 'bluetooth'} [manualSource]
 * @property {'cup' | 'portafilter' | 'none'} [owner]
 * @property {'taring' | 'filling' | 'removing' | 'ready' | 'idle'} [phase]
 * @property {string} [mode] Effective mode: cup, portafilter or automatic.
 * @property {string} [modePreference] Mode from settings.
 * @property {boolean} [automaticAvailable]
 * @property {boolean} [cupConfigured]
 * @property {boolean} [portafilterConfigured]
 * @property {boolean} [automagic]
 * @property {SmartDoseMeasurement} [manual]
 * @property {SmartDoseMeasurement} [cup] Only when the cup is configured.
 * @property {SmartDoseMeasurement} [portafilter] Only when the portafilter is configured.
 * @property {boolean} [stable] Reading is stable and the dose valid.
 */

/**
 * One evt:status frame as sent by the firmware. Frames are partial: telemetry
 * keys arrive every tick, state keys only when they change (see ApiService._onStatus).
 * @typedef {object} StatusFrame
 * @property {'evt:status'} tp
 * @property {number} [ct] Current temperature.
 * @property {number} [tt] Target temperature.
 * @property {number} [cst] Current steam temperature.
 * @property {number} [tst] Target steam temperature.
 * @property {boolean} [sa] Steam heater active.
 * @property {boolean} [sca] Steam controls available.
 * @property {number} [pr] Current pressure.
 * @property {number} [pt] Target pressure.
 * @property {number} [fl] Current pump flow.
 * @property {number} [tf] Target flow.
 * @property {number} [pf] Puck flow.
 * @property {number} [pkr] Puck resistance.
 * @property {number} [pw] Pump power.
 * @property {number} [hp] Heater power.
 * @property {number} [cw] Active scale weight.
 * @property {number} [bw] Bluetooth scale weight.
 * @property {number} [wp] Water pumped.
 * @property {number} [wl] Water level in percent.
 * @property {number} [tof] ToF distance.
 * @property {boolean} [awl] Alba water level available.
 * @property {boolean} [htl] Tank level sensor present.
 * @property {boolean | null} [tlo] Tank level OK, null without a sensor.
 * @property {boolean} [hsl] Steam boiler level sensor present.
 * @property {boolean | null} [sbl] Steam boiler low, null without a sensor.
 * @property {number} [rssi] Controller link RSSI.
 * @property {number} [lat] Controller round-trip latency in ms, -1 until measured.
 * @property {number} [rtx] Controller frames retransmitted since boot.
 * @property {ProcessProgress | null} [process]
 * @property {number} [m] Mode.
 * @property {string} [p] Selected profile label.
 * @property {string} [puid] Selected profile id.
 * @property {number} [tw] Target weight of the selected profile.
 * @property {0 | 1} [bt] Brew target is volumetric.
 * @property {number} [btd] Brew target duration.
 * @property {0 | 1} [bta] Volumetric measurement available.
 * @property {number} [gtd] Grind target duration.
 * @property {number} [gtv] Grind target volume.
 * @property {0 | 1} [gt] Grind target is volumetric.
 * @property {0 | 1} [gact] Grind active.
 * @property {boolean} [bc] Bluetooth scale connected.
 * @property {number | null} [sbat] Scale battery, null when unknown.
 * @property {string} [scaleSource] Active scale source name.
 * @property {SmartDoseStatus} [smartDose]
 * @property {boolean} [up] Firmware update available.
 * @property {WarningStateFrame[]} [warn]
 * @property {{ s?: string, m?: string, c?: number }} [sys] System state key, message and error code.
 * @property {boolean} [cp] Capability: pressure.
 * @property {boolean} [cd] Capability: dimming.
 * @property {boolean} [led] Capability: LED control.
 * @property {boolean} [tofc] Capability: ToF sensor.
 * @property {boolean} [gp] Capability: gear pump addon.
 * @property {boolean} [db] Capability: dual boiler.
 * @property {boolean} [hs] Capability: hardware scale.
 * @property {boolean} [sd] SD card present.
 */

/**
 * @typedef {object} SystemStatus
 * @property {string} state
 * @property {string} message
 * @property {number} code
 */

/**
 * Status as the UI sees it: evt:status frames merged onto the last known status.
 * @typedef {object} MachineStatus
 * @property {number} currentTemperature
 * @property {number} targetTemperature
 * @property {number} currentSteamTemperature
 * @property {number} targetSteamTemperature
 * @property {boolean} [steamActive]
 * @property {boolean} [steamControlsAvailable]
 * @property {number} [currentPressure]
 * @property {number} [targetPressure]
 * @property {number} currentFlow
 * @property {number} targetFlow
 * @property {number} [targetWeight]
 * @property {number} [activeTargetWeight] Target weight while a process runs, else 0.
 * @property {number} mode
 * @property {string} selectedProfile
 * @property {string | null} selectedProfileId
 * @property {boolean} [brewTarget]
 * @property {number} brewTargetDuration
 * @property {boolean} [volumetricAvailable]
 * @property {number} grindTargetDuration
 * @property {number} grindTargetVolume
 * @property {number} grindTarget
 * @property {boolean} grindActive
 * @property {number} [currentWeight]
 * @property {SmartDoseStatus} [smartDose]
 * @property {boolean} [albaWaterLevelAvailable]
 * @property {boolean} [hasTankLevel]
 * @property {boolean | null} [tankLevelOK]
 * @property {boolean} [hasSteamLevel]
 * @property {boolean | null} [steamBoilerLow]
 * @property {boolean} [bluetoothConnected]
 * @property {string} [activeScaleSource]
 * @property {number | null} [scaleBattery]
 * @property {ProcessProgress | null} process
 * @property {number} [rssi]
 * @property {number} [lat]
 * @property {number} [rtx]
 * @property {number} [tofDistance]
 * @property {number} [currentPumpPower]
 * @property {number} [currentBoilerPower]
 * @property {number} [currentPuckResistance]
 * @property {number} [currentPuckFlow]
 * @property {number} [currentCoffeeVolume]
 * @property {boolean} update
 * @property {WarningState[]} warnings
 * @property {SystemStatus | null} system
 * @property {number} [hardwareScaleCell1Weight]
 * @property {number} [hardwareScaleCell2Weight]
 * @property {boolean} [hardwareScaleCell1Valid]
 * @property {boolean} [hardwareScaleCell2Valid]
 * @property {Date} [timestamp] When the last frame was merged.
 */

/**
 * @typedef {object} Capabilities
 * @property {boolean} pressure
 * @property {boolean} dimming
 * @property {boolean} dualBoiler
 * @property {boolean} hardwareScale
 * @property {boolean} sdCard
 * @property {boolean} [ledControl]
 * @property {boolean} [tof]
 * @property {boolean} [gearpumpAddon]
 */

/**
 * BLE scale lifecycle from evt:scale:* events.
 * @typedef {object} ScaleState
 * @property {boolean} scanning
 * @property {{ address: string, reason: string, at: number } | null} connectError
 * @property {{ address: string, name: string, at: number } | null} disconnected
 */

/**
 * A chart history point: a status snapshot without process and warnings.
 * @typedef {Omit<MachineStatus, 'process' | 'warnings'>} HistoryEntry
 */

/**
 * @typedef {object} MachineState
 * @property {boolean} connected
 * @property {MachineStatus} status
 * @property {Capabilities} capabilities
 * @property {ScaleState} scale
 * @property {HistoryEntry[]} history Last 600 telemetry points.
 */

/**
 * Any message on the socket. `tp` is `req:*` (client request), `res:*` (its
 * answer, matched by `rid`) or `evt:*` (push from the device).
 * @typedef {{ tp: string, rid?: string, [key: string]: any }} SocketMessage
 */

export {};
