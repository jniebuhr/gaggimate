import './style.css';
import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import homekitImage from '../../assets/homekit.png';
import Card from '../../components/Card.jsx';
import { timezones } from '../../config/zones.js';

export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [gen, setGen] = useState(0);
  const [formData, setFormData] = useState({});
  const {
    isLoading,
    isError,
    error,
    data: fetchedSettings,
  } = useQuery(`settings/${gen}`, async () => {
    const response = await fetch(`/api/settings`);
    const data = await response.json();
    return data;
  });

  const formRef = useRef();

  useEffect(() => {
    setFormData(fetchedSettings || {});
  }, [fetchedSettings]);

  const onChange = (key) => {
    return (e) => {
      let value = e.currentTarget.value;
      if (key === 'homekit') {
        value = !formData.homekit;
      }
      if (key === 'boilerFillActive') {
        value = !formData.boilerFillActive;
      }
      if (key === 'smartGrindActive') {
        value = !formData.smartGrindActive;
      }
      if (key === 'smartGrindToggle') {
        value = !formData.smartGrindToggle;
      }
      if (key === 'homeAssistant') {
        value = !formData.homeAssistant;
      }
      if (key === 'momentaryButtons') {
        value = !formData.momentaryButtons;
      }
      if (key === 'delayAdjust') {
        value = !formData.delayAdjust;
      }
      if (key === 'clock24hFormat') {
        value = !formData.clock24hFormat;
      }
      setFormData({
        ...formData,
        [key]: value,
      });
    };
  };

  const onSubmit = useCallback(
    async (e, restart = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formData = new FormData(form);
      if (restart) {
        formData.append('restart', '1');
      }
      const response = await fetch(form.action, {
        method: 'post',
        body: formData,
      });
      const data = await response.json();
      setFormData(data);
      setSubmitting(false);
    },
    [setFormData, formRef],
  );

  if (isLoading) {
    return (
      <div class="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <form key="settings" ref={formRef} method="post" action="/api/settings" onSubmit={onSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12">
          <h2 className="text-2xl font-bold">Settings</h2>
        </div>
        <Card xs={12} lg={6} title="Temperature settings">
            <div>
              <label htmlFor="targetSteamTemp" className="block font-medium text-gray-700 dark:text-gray-400">
                Default Steam Temperature (°C)
              </label>
              <input
                id="targetSteamTemp"
                name="targetSteamTemp"
                type="number"
                className="input-field"
                placeholder="135"
                value={formData.targetSteamTemp}
                onChange={onChange('targetSteamTemp')}
              />
            </div>

            <div>
              <label htmlFor="targetWaterTemp" className="block font-medium text-gray-700 dark:text-gray-400">
                Default Water Temperature (°C)
              </label>
              <input
                id="targetWaterTemp"
                name="targetWaterTemp"
                type="number"
                className="input-field"
                placeholder="80"
                value={formData.targetWaterTemp}
                onChange={onChange('targetWaterTemp')}
              />
            </div>

            <div>
              <label htmlFor="temperatureOffset" className="block font-medium text-gray-700 dark:text-gray-400">
                Temperature Offset (°C)
              </label>
              <input
                id="temperatureOffset"
                name="temperatureOffset"
                type="number"
                className="input-field"
                placeholder="0"
                value={formData.temperatureOffset}
                onChange={onChange('temperatureOffset')}
              />
            </div>
        </Card>
        <Card xs={12} lg={6} title="Pressure settings">
          <div>
            <label htmlFor="pressureScaling" className="block font-medium text-gray-700 dark:text-gray-400">
              Pressure scaling factor <small>Value depends on the pressure sensor being used.</small>
            </label>
            <input
              id="pressureScaling"
              name="pressureScaling"
              type="number"
              inputmode="decimal"
              placeholder="0.0"
              className="input-field"
              min="0"
              step="any"
              value={formData.pressureScaling}
              onChange={onChange('pressureScaling')}
            />
          </div>
        </Card>
        <Card xs={12} lg={6} title="User preferences">
          <div>
            <label htmlFor="startup-mode" className="block font-medium text-gray-700 dark:text-gray-400">
              Startup Mode
            </label>
            <select id="startup-mode" name="startupMode" className="input-field" onChange={onChange('startupMode')}>
              <option value="standby" selected={formData.startupMode === 'standby'}>
                Standby
              </option>
              <option value="brew" selected={formData.startupMode === 'brew'}>
                Brew
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="standbyTimeout" className="block font-medium text-gray-700 dark:text-gray-400">
              Standby Timeout (s)
            </label>
            <input
              id="standbyTimeout"
              name="standbyTimeout"
              type="number"
              className="input-field"
              placeholder="0"
              value={formData.standbyTimeout}
              onChange={onChange('standbyTimeout')}
            />
          </div>


          <div>
            <b>Predictive scale delay</b>
          </div>
          <div>
            <small>Shuts off the process ahead of time based on the flow rate to account for any dripping or delays in the control.</small>
          </div>

          <div className="flex flex-row gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="delayAdjust"
                name="delayAdjust"
                value="delayAdjust"
                type="checkbox"
                className="sr-only peer"
                checked={!!formData.delayAdjust}
                onChange={onChange('delayAdjust')}
              />
              <div
                className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
            <p>Auto Adjust</p>
          </div>
          <div className="flex flex-row gap-4">
            <div className="flex-auto">
              <label htmlFor="brewDelay" className="block font-medium text-gray-700 dark:text-gray-400">
                Brew (ms)
              </label>
              <input
                id="brewDelay"
                name="brewDelay"
                type="number"
                className="input-field"
                placeholder="0"
                value={formData.brewDelay}
                onChange={onChange('brewDelay')}
              />
            </div>
            <div className="flex-auto">
              <label htmlFor="grindDelay" className="block font-medium text-gray-700 dark:text-gray-400">
                Grind (ms)
              </label>
              <input
                id="grindDelay"
                name="grindDelay"
                type="number"
                className="input-field"
                placeholder="0"
                value={formData.grindDelay}
                onChange={onChange('grindDelay')}
              />
            </div>
          </div>

          <div>
            <b>Switch control</b>
          </div>
          <div className="flex flex-row gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="momentaryButtons"
                name="momentaryButtons"
                value="momentaryButtons"
                type="checkbox"
                className="sr-only peer"
                checked={!!formData.momentaryButtons}
                onChange={onChange('momentaryButtons')}
              />
              <div
                className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
            <p>Use momentary switches</p>
          </div>

        </Card>
        <Card xs={12} lg={6} title="System preferences">
          <div>
            <label htmlFor="wifiSsid" className="block font-medium text-gray-700 dark:text-gray-400">
              WiFi SSID
            </label>
            <input
              id="wifiSsid"
              name="wifiSsid"
              type="text"
              className="input-field"
              placeholder="WiFi SSID"
              value={formData.wifiSsid}
              onChange={onChange('wifiSsid')}
            />
          </div>
          <div>
            <label htmlFor="wifiPassword" className="block font-medium text-gray-700 dark:text-gray-400">
              WiFi Password
            </label>
            <input
              id="wifiPassword"
              name="wifiPassword"
              type="password"
              className="input-field"
              placeholder="WiFi Password"
              value={formData.wifiPassword}
              onChange={onChange('wifiPassword')}
            />
          </div>
          <div>
            <label htmlFor="mdnsName" className="block font-medium text-gray-700 dark:text-gray-400">
              Hostname
            </label>
            <input
              id="mdnsName"
              name="mdnsName"
              type="text"
              className="input-field"
              placeholder="Hostname"
              value={formData.mdnsName}
              onChange={onChange('mdnsName')}
            />
          </div>
          <div>
            <label htmlFor="timezone" className="block font-medium text-gray-700 dark:text-gray-400">
              Timezone
            </label>
            <select id="timezone" name="timezone" className="input-field" onChange={onChange('timezone')}>
              {
                timezones.map(timezone => (
                  <option key={timezone} value={timezone} selected={formData.timezone === timezone}>
                    {timezone}
                  </option>
                ))
              }
            </select>
          </div>
        <div>
            <b>Clock</b>
        </div>
        <div className="flex flex-row gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="clock24hFormat"
                name="clock24hFormat"
                value="clock24hFormat"
                type="checkbox"
                className="sr-only peer"
                checked={!!formData.clock24hFormat}
                onChange={onChange('clock24hFormat')}
              />
              <div
                className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
            <p>Use 24h Format</p>
          </div>
          <div>
            <label htmlFor="pid" className="block font-medium text-gray-700 dark:text-gray-400">
              PID Values (Kp, Ki, Kd)
            </label>
            <input
              id="pid"
              name="pid"
              type="text"
              className="input-field"
              placeholder="2.0, 0.1, 0.01"
              value={formData.pid}
              onChange={onChange('pid')}
            />
          </div>
        </Card>
        <Card xs={12} title="Plugins">
          <div className="flex flex-col rounded-lg divide-y divide-[#ccc] border-[#ccc] dark:border-gray-600 dark:divide-gray-600 border">
            <div className="flex flex-row w-full gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="homekit"
                  name="homekit"
                  value="homekit"
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!formData.homekit}
                  onChange={onChange('homekit')}
                />
                <div
                  className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
              <p>Homekit</p>
            </div>
            {formData.homekit && (
              <div className="p-4 flex flex-col gap-4 items-center justify-center">
                <img src={homekitImage} alt="Homekit Setup Code" />
                <p>Open the Homekit App, find your GaggiMate device and scan the setup code above to add it.</p>
              </div>
            )}
            <div className="flex flex-row w-full gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="boilerFillActive"
                  name="boilerFillActive"
                  value="boilerFillActive"
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!formData.boilerFillActive}
                  onChange={onChange('boilerFillActive')}
                />
                <div
                  className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
              <p>Boiler Refill Plugin</p>
            </div>
            {formData.boilerFillActive && (
              <div className="p-4 flex flex-row gap-4">
                <div className="flex-auto">
                  <label htmlFor="startupFillTime" className="block font-medium text-gray-700 dark:text-gray-400">
                    On startup (s)
                  </label>
                  <input
                    id="startupFillTime"
                    name="startupFillTime"
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={formData.startupFillTime}
                    onChange={onChange('startupFillTime')}
                  />
                </div>
                <div className="flex-auto">
                  <label htmlFor="infuseBloomTime" className="block font-medium text-gray-700 dark:text-gray-400">
                    On steam deactivate (s)
                  </label>
                  <input
                    id="steamFillTime"
                    name="steamFillTime"
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={formData.steamFillTime}
                    onChange={onChange('steamFillTime')}
                  />
                </div>
              </div>
            )}
            <div className="flex flex-row w-full gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="smartGrindActive"
                  name="smartGrindActive"
                  value="smartGrindActive"
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!formData.smartGrindActive}
                  onChange={onChange('smartGrindActive')}
                />
                <div
                  className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
              <p>Smart Grind Plugin</p>
            </div>
            {formData.smartGrindActive && (
              <div className="p-4 flex flex-col gap-4">
                <p className="flex-auto">
                  This feature controls a Tasmota Plug to turn off your grinder after the target has been reached.
                </p>
                <div className="flex-auto">
                  <label htmlFor="smartGrindIp" className="block font-medium text-gray-700 dark:text-gray-400">
                    Tasmota IP
                  </label>
                  <input
                    id="smartGrindIp"
                    name="smartGrindIp"
                    type="text"
                    className="input-field"
                    placeholder="0"
                    value={formData.smartGrindIp}
                    onChange={onChange('smartGrindIp')}
                  />
                </div>
                <div className="flex-auto">
                  <label htmlFor="smartGrindMode" className="block font-medium text-gray-700 dark:text-gray-400">
                    Mode
                  </label>
                  <select id="smartGrindMode" name="smartGrindMode" className="input-field" onChange={onChange('smartGrindMode')}>
                    <option value="0" selected={formData.smartGrindMode?.toString() === '0'}>
                      Turn off at target
                    </option>
                    <option value="1" selected={formData.smartGrindMode?.toString() === '1'}>
                      Toggle off and on at target
                    </option>
                    <option value="2" selected={formData.smartGrindMode?.toString() === '2'}>
                      Turn on at start, off at target
                    </option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-row w-full gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="homeAssistant"
                  name="homeAssistant"
                  value="homeAssistant"
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!formData.homeAssistant}
                  onChange={onChange('homeAssistant')}
                />
                <div
                  className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
              <p>Home Assistant (MQTT)</p>
            </div>
            {formData.homeAssistant && (
              <div className="p-4 flex flex-col gap-4">
                <p className="flex-auto">
                  This feature allows connection to a Home Assistant or MQTT installation and push the current state.
                </p>
                <div className="flex-auto">
                  <label htmlFor="haIP" className="block font-medium text-gray-700 dark:text-gray-400">
                    MQTT IP
                  </label>
                  <input
                    id="haIP"
                    name="haIP"
                    type="text"
                    className="input-field"
                    placeholder="0"
                    value={formData.haIP}
                    onChange={onChange('haIP')}
                  />
                </div>

                <div className="flex-auto">
                  <label htmlFor="haPort" className="block font-medium text-gray-700 dark:text-gray-400">
                    MQTT Port
                  </label>
                  <input
                    id="haPort"
                    name="haPort"
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={formData.haPort}
                    onChange={onChange('haPort')}
                  />
                </div>
                <div className="flex-auto">
                  <label htmlFor="haUser" className="block font-medium text-gray-700 dark:text-gray-400">
                    MQTT User
                  </label>
                  <input
                    id="haUser"
                    name="haUser"
                    type="text"
                    className="input-field"
                    placeholder="user"
                    value={formData.haUser}
                    onChange={onChange('haUser')}
                  />
                </div>
                <div className="flex-auto">
                  <label htmlFor="haPassword" className="block font-medium text-gray-700 dark:text-gray-400">
                    MQTT Password
                  </label>
                  <input
                    id="haPassword"
                    name="haPassword"
                    type="password"
                    className="input-field"
                    placeholder="password"
                    value={formData.haPassword}
                    onChange={onChange('haPassword')}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
        <div className="col-span-12 gap-2 flex flex-col">

          <div className="text-sm text-[#666666]">Some options like WiFi, NTP and managing Plugins require a restart.</div>

          <div className="flex justify-start flex-row gap-1">
            <a href="/" className="menu-button">
              Back
            </a>
            <button type="submit" className="menu-button flex flex-row gap-2" disabled={submitting}>
              Save
              {submitting && <Spinner size={4} />}
            </button>
            <input
              type="submit"
              name="restart"
              className="menu-button"
              value="Save and Restart"
              disabled={submitting}
              onClick={(e) => onSubmit(e, true)}
            />
          </div>
        </div>
      </form>
  );
}
