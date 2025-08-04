import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import homekitImage from '../../assets/homekit.png';
import Card from '../../components/Card.jsx';
import { timezones } from '../../config/zones.js';
import { computed } from '@preact/signals';
import { machine } from '../../services/ApiService.js';

const ledControl = computed(() => machine.value.capabilities.ledControl);

export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [gen] = useState(0);
  const [formData, setFormData] = useState({});
  const {
    isLoading,
    data: fetchedSettings,
  } = useQuery(`settings/${gen}`, async () => {
    const response = await fetch(`/api/settings`);
    const data = await response.json();
    return data;
  });

  const formRef = useRef();

  useEffect(() => {
    if (fetchedSettings) {
      // Initialize standbyDisplayEnabled based on standby brightness value
      // but preserve it if it already exists in the fetched data
      const settingsWithToggle = {
        ...fetchedSettings,
        standbyDisplayEnabled:
          fetchedSettings.standbyDisplayEnabled !== undefined
            ? fetchedSettings.standbyDisplayEnabled
            : fetchedSettings.standbyBrightness > 0,
      };
      setFormData(settingsWithToggle);
    } else {
      setFormData({});
    }
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
      if (key === 'standbyDisplayEnabled') {
        value = !formData.standbyDisplayEnabled;
        // Set standby brightness to 0 when toggle is off
        const newFormData = {
          ...formData,
          [key]: value,
        };
        if (!value) {
          newFormData.standbyBrightness = 0;
        }
        setFormData(newFormData);
        return;
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
      const formDataToSubmit = new FormData(form);

      // Ensure standbyBrightness is included even when the field is disabled
      if (!formData.standbyDisplayEnabled) {
        formDataToSubmit.set('standbyBrightness', '0');
      }

      if (restart) {
        formDataToSubmit.append('restart', '1');
      }
      const response = await fetch(form.action, {
        method: 'post',
        body: formDataToSubmit,
      });
      const data = await response.json();

      // Only preserve standbyDisplayEnabled if brightness is greater than 0
      // If brightness is 0, let the useEffect recalculate it based on the saved value
      const updatedData = {
        ...data,
        standbyDisplayEnabled: data.standbyBrightness > 0 ? formData.standbyDisplayEnabled : false,
      };

      setFormData(updatedData);
      setSubmitting(false);
    },
    [setFormData, formRef, formData]
  );

  const onExport = useCallback(() => {
    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(formData, undefined, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'settings.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [formData]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = JSON.parse(e.target.result);
        setFormData(data);
      };
      reader.readAsText(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <form
      key="settings"
      ref={formRef}
      method="post"
      action="/api/settings"
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-12"
    >
      <div className="sm:col-span-12 flex flex-row items-center gap-2">
        <h2 className="text-2xl font-bold flex-grow">Settings</h2>
        <button
          type="button"
          onClick={onExport}
          className="btn btn-ghost btn-sm"
          title="Export Settings"
        >
          <i className="fa fa-file-export" />
        </button>
        <label
          htmlFor="settingsImport"
          className="btn btn-ghost btn-sm cursor-pointer"
          title="Import Settings"
        >
          <i className="fa fa-file-import" />
        </label>
        <input onChange={onUpload} className="hidden" id="settingsImport" type="file" accept=".json,application/json" />
      </div>
      
      <Card xs={12} lg={6} title="Temperature settings">
        <div className="form-control">
          <label htmlFor="targetSteamTemp" className="block text-sm font-medium mb-2">
            Default Steam Temperature (°C)
          </label>
          <input
            id="targetSteamTemp"
            name="targetSteamTemp"
            type="number"
            className="input input-bordered w-full"
            placeholder="135"
            value={formData.targetSteamTemp}
            onChange={onChange('targetSteamTemp')}
          />
        </div>

        <div className="form-control">
          <label htmlFor="targetWaterTemp" className="block text-sm font-medium mb-2">
            Default Water Temperature (°C)
          </label>
          <input
            id="targetWaterTemp"
            name="targetWaterTemp"
            type="number"
            className="input input-bordered w-full"
            placeholder="80"
            value={formData.targetWaterTemp}
            onChange={onChange('targetWaterTemp')}
          />
        </div>
      </Card>
      
      <Card xs={12} lg={6} title="User preferences">
        <div className="form-control">
          <label htmlFor="startup-mode" className="block text-sm font-medium mb-2">
            Startup Mode
          </label>
          <select id="startup-mode" name="startupMode" className="select select-bordered w-full" onChange={onChange('startupMode')}>
            <option value="standby" selected={formData.startupMode === 'standby'}>
              Standby
            </option>
            <option value="brew" selected={formData.startupMode === 'brew'}>
              Brew
            </option>
          </select>
        </div>
        
        <div className="form-control">
          <label htmlFor="standbyTimeout" className="block text-sm font-medium mb-2">
            Standby Timeout (s)
          </label>
          <input
            id="standbyTimeout"
            name="standbyTimeout"
            type="number"
            className="input input-bordered w-full"
            placeholder="0"
            value={formData.standbyTimeout}
            onChange={onChange('standbyTimeout')}
          />
        </div>

        <div className="divider">Predictive scale delay</div>
        <div className="text-sm opacity-70 mb-4">
          Shuts off the process ahead of time based on the flow rate to account for any dripping or delays in the control.
        </div>

        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">Auto Adjust</span>
            <input
              id="delayAdjust"
              name="delayAdjust"
              value="delayAdjust"
              type="checkbox"
              className="toggle toggle-primary"
              checked={!!formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />
          </label>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label htmlFor="brewDelay" className="block text-sm font-medium mb-2">
              Brew (ms)
            </label>
            <input
              id="brewDelay"
              name="brewDelay"
              type="number"
              step="any"
              className="input input-bordered w-full"
              placeholder="0"
              value={formData.brewDelay}
              onChange={onChange('brewDelay')}
            />
          </div>
          <div className="form-control">
            <label htmlFor="grindDelay" className="block text-sm font-medium mb-2">
              Grind (ms)
            </label>
            <input
              id="grindDelay"
              name="grindDelay"
              type="number"
              step="any"
              className="input input-bordered w-full"
              placeholder="0"
              value={formData.grindDelay}
              onChange={onChange('grindDelay')}
            />
          </div>
        </div>

        <div className="divider">Switch control</div>
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">Use momentary switches</span>
            <input
              id="momentaryButtons"
              name="momentaryButtons"
              value="momentaryButtons"
              type="checkbox"
              className="toggle toggle-primary"
              checked={!!formData.momentaryButtons}
              onChange={onChange('momentaryButtons')}
            />
          </label>
        </div>
      </Card>
      
      <Card xs={12} lg={6} title="System preferences">
        <div className="form-control">
          <label htmlFor="wifiSsid" className="block text-sm font-medium mb-2">
            WiFi SSID
          </label>
          <input
            id="wifiSsid"
            name="wifiSsid"
            type="text"
            className="input input-bordered w-full"
            placeholder="WiFi SSID"
            value={formData.wifiSsid}
            onChange={onChange('wifiSsid')}
          />
        </div>
        
        <div className="form-control">
          <label htmlFor="wifiPassword" className="block text-sm font-medium mb-2">
            WiFi Password
          </label>
          <input
            id="wifiPassword"
            name="wifiPassword"
            type="password"
            className="input input-bordered w-full"
            placeholder="WiFi Password"
            value={formData.wifiPassword}
            onChange={onChange('wifiPassword')}
          />
        </div>
        
        <div className="form-control">
          <label htmlFor="mdnsName" className="block text-sm font-medium mb-2">
            Hostname
          </label>
          <input
            id="mdnsName"
            name="mdnsName"
            type="text"
            className="input input-bordered w-full"
            placeholder="Hostname"
            value={formData.mdnsName}
            onChange={onChange('mdnsName')}
          />
        </div>
        
        <div className="form-control">
          <label htmlFor="timezone" className="block text-sm font-medium mb-2">
            Timezone
          </label>
          <select id="timezone" name="timezone" className="select select-bordered w-full" onChange={onChange('timezone')}>
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone} selected={formData.timezone === timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </div>
        
        <div className="divider">Clock</div>
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">Use 24h Format</span>
            <input
              id="clock24hFormat"
              name="clock24hFormat"
              value="clock24hFormat"
              type="checkbox"
              className="toggle toggle-primary"
              checked={!!formData.clock24hFormat}
              onChange={onChange('clock24hFormat')}
            />
          </label>
        </div>
      </Card>
      
      <Card xs={12} lg={6} title="Machine settings">
        <div className="form-control">
          <label htmlFor="pid" className="block text-sm font-medium mb-2">
            PID Values (Kp, Ki, Kd)
          </label>
          <input
            id="pid"
            name="pid"
            type="text"
            className="input input-bordered w-full"
            placeholder="2.0, 0.1, 0.01"
            value={formData.pid}
            onChange={onChange('pid')}
          />
        </div>
        
        <div className="form-control">
          <label htmlFor="temperatureOffset" className="block text-sm font-medium mb-2">
            Temperature Offset
          </label>
          <div className="input-group">
            <input
              id="temperatureOffset"
              name="temperatureOffset"
              type="number"
              className="input input-bordered"
              placeholder="0"
              value={formData.temperatureOffset}
              onChange={onChange('temperatureOffset')}
            />
            <span className="btn btn-square">°C</span>
          </div>
        </div>
        
        <div className="form-control">
          <label htmlFor="pressureScaling" className="block text-sm font-medium mb-2">
            Pressure sensor rating
          </label>
          <div className="text-xs opacity-70 mb-2">Enter the bar rating of the pressure sensor being used</div>
          <div className="input-group">
            <input
              id="pressureScaling"
              name="pressureScaling"
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              className="input input-bordered"
              min="0"
              step="any"
              value={formData.pressureScaling}
              onChange={onChange('pressureScaling')}
            />
            <span className="btn btn-square">bar</span>
          </div>
        </div>
        
        <div className="form-control">
          <label htmlFor="steamPumpPercentage" className="block text-sm font-medium mb-2">
            Steam Pump Assist
          </label>
          <div className="text-xs opacity-70 mb-2">What percentage to run the pump at during steaming</div>
          <div className="input-group">
            <input
              id="steamPumpPercentage"
              name="steamPumpPercentage"
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              className="input input-bordered"
              min="0"
              step="any"
              value={formData.steamPumpPercentage}
              onChange={onChange('steamPumpPercentage')}
            />
            <span className="btn btn-square">%</span>
          </div>
        </div>
      </Card>
      
      <Card xs={12} lg={6} title="Display settings">
        <div className="form-control">
          <label htmlFor="mainBrightness" className="block text-sm font-medium mb-2">
            Main Brightness (1-16)
          </label>
          <input
            id="mainBrightness"
            name="mainBrightness"
            type="number"
            className="input input-bordered w-full"
            placeholder="16"
            min="1"
            max="16"
            value={formData.mainBrightness}
            onChange={onChange('mainBrightness')}
          />
        </div>

        <div className="divider">Standby Display</div>
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">Enable standby display</span>
            <input
              id="standbyDisplayEnabled"
              name="standbyDisplayEnabled"
              value="standbyDisplayEnabled"
              type="checkbox"
              className="toggle toggle-primary"
              checked={formData.standbyDisplayEnabled}
              onChange={onChange('standbyDisplayEnabled')}
            />
          </label>
        </div>

        <div className="form-control">
          <label htmlFor="standbyBrightness" className="block text-sm font-medium mb-2">
            Standby Brightness (0-16)
          </label>
          <input
            id="standbyBrightness"
            name="standbyBrightness"
            type="number"
            className="input input-bordered w-full"
            placeholder="8"
            min="0"
            max="16"
            value={formData.standbyBrightness}
            onChange={onChange('standbyBrightness')}
            disabled={!formData.standbyDisplayEnabled}
          />
        </div>
        
        <div className="form-control">
          <label htmlFor="standbyBrightnessTimeout" className="block text-sm font-medium mb-2">
            Standby Brightness Timeout (seconds)
          </label>
          <input
            id="standbyBrightnessTimeout"
            name="standbyBrightnessTimeout"
            type="number"
            className="input input-bordered w-full"
            placeholder="60"
            min="1"
            value={formData.standbyBrightnessTimeout}
            onChange={onChange('standbyBrightnessTimeout')}
          />
        </div>
        
        <div className="form-control">
          <label htmlFor="themeMode" className="block text-sm font-medium mb-2">
            Theme
          </label>
          <select
            id="themeMode"
            name="themeMode"
            className="select select-bordered w-full"
            value={formData.themeMode}
            onChange={onChange('themeMode')}
          >
            <option value={0}>Dark Theme</option>
            <option value={1}>Light Theme</option>
          </select>
        </div>
      </Card>
      
      {ledControl.value && (
        <Card xs={12} lg={6} title="Sunrise Settings">
          <div className="text-sm opacity-70 mb-4">
            Set the colors for the LEDs when in idle mode with no warnings.
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label htmlFor="sunriseR" className="block text-sm font-medium mb-2">
                Red (0 - 255)
              </label>
              <input
                id="sunriseR"
                name="sunriseR"
                type="number"
                className="input input-bordered w-full"
                placeholder="16"
                min="0"
                max="255"
                value={formData.sunriseR}
                onChange={onChange('sunriseR')}
              />
            </div>
            <div className="form-control">
              <label htmlFor="sunriseG" className="block text-sm font-medium mb-2">
                Green (0 - 255)
              </label>
              <input
                id="sunriseG"
                name="sunriseG"
                type="number"
                className="input input-bordered w-full"
                placeholder="16"
                min="0"
                max="255"
                value={formData.sunriseG}
                onChange={onChange('sunriseG')}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label htmlFor="sunriseB" className="block text-sm font-medium mb-2">
                Blue (0 - 255)
              </label>
              <input
                id="sunriseB"
                name="sunriseB"
                type="number"
                className="input input-bordered w-full"
                placeholder="16"
                min="0"
                max="255"
                value={formData.sunriseB}
                onChange={onChange('sunriseB')}
              />
            </div>
            <div className="form-control">
              <label htmlFor="sunriseW" className="block text-sm font-medium mb-2">
                White (0 - 255)
              </label>
              <input
                id="sunriseW"
                name="sunriseW"
                type="number"
                className="input input-bordered w-full"
                placeholder="16"
                min="0"
                max="255"
                value={formData.sunriseW}
                onChange={onChange('sunriseW')}
              />
            </div>
          </div>
          
          <div className="form-control">
            <label htmlFor="sunriseExtBrightness" className="block text-sm font-medium mb-2">
              External LED (0 - 255)
            </label>
            <input
              id="sunriseExtBrightness"
              name="sunriseExtBrightness"
              type="number"
              className="input input-bordered w-full"
              placeholder="16"
              min="0"
              max="255"
              value={formData.sunriseExtBrightness}
              onChange={onChange('sunriseExtBrightness')}
            />
          </div>
          
          <div className="form-control">
            <label htmlFor="emptyTankDistance" className="block text-sm font-medium mb-2">
              Distance from sensor to bottom of the tank
            </label>
            <input
              id="emptyTankDistance"
              name="emptyTankDistance"
              type="number"
              className="input input-bordered w-full"
              placeholder="16"
              min="0"
              max="1000"
              value={formData.emptyTankDistance}
              onChange={onChange('emptyTankDistance')}
            />
          </div>
          
          <div className="form-control">
            <label htmlFor="fullTankDistance" className="block text-sm font-medium mb-2">
              Distance from sensor to the fill line
            </label>
            <input
              id="fullTankDistance"
              name="fullTankDistance"
              type="number"
              className="input input-bordered w-full"
              placeholder="16"
              min="0"
              max="1000"
              value={formData.fullTankDistance}
              onChange={onChange('fullTankDistance')}
            />
          </div>
        </Card>
      )}
      
      <Card xs={12} title="Plugins">
        <div className="space-y-4">
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xl font-medium">Homekit</span>
              <label className="label cursor-pointer">
                <input
                  id="homekit"
                  name="homekit"
                  value="homekit"
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={!!formData.homekit}
                  onChange={onChange('homekit')}
                />
              </label>
            </div>
            {formData.homekit && (
              <div className="flex flex-col gap-4 items-center justify-center mt-4 pt-4 border-t border-base-300">
                <img src={homekitImage} alt="Homekit Setup Code" />
                <p className="text-center">Open the Homekit App, find your GaggiMate device and scan the setup code above to add it.</p>
              </div>
            )}
          </div>
          
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xl font-medium">Boiler Refill Plugin</span>
              <label className="label cursor-pointer">
                <input
                  id="boilerFillActive"
                  name="boilerFillActive"
                  value="boilerFillActive"
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={!!formData.boilerFillActive}
                  onChange={onChange('boilerFillActive')}
                />
              </label>
            </div>
            {formData.boilerFillActive && (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-base-300">
                <div className="form-control">
                  <label htmlFor="startupFillTime" className="block text-sm font-medium mb-2">
                    On startup (s)
                  </label>
                  <input
                    id="startupFillTime"
                    name="startupFillTime"
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="0"
                    value={formData.startupFillTime}
                    onChange={onChange('startupFillTime')}
                  />
                </div>
                <div className="form-control">
                  <label htmlFor="steamFillTime" className="block text-sm font-medium mb-2">
                    On steam deactivate (s)
                  </label>
                  <input
                    id="steamFillTime"
                    name="steamFillTime"
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="0"
                    value={formData.steamFillTime}
                    onChange={onChange('steamFillTime')}
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xl font-medium">Smart Grind Plugin</span>
              <label className="label cursor-pointer">
                <input
                  id="smartGrindActive"
                  name="smartGrindActive"
                  value="smartGrindActive"
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={!!formData.smartGrindActive}
                  onChange={onChange('smartGrindActive')}
                />
              </label>
            </div>
            {formData.smartGrindActive && (
              <div className="space-y-4 mt-4 pt-4 border-t border-base-300">
                <p className="text-sm opacity-70">
                  This feature controls a Tasmota Plug to turn off your grinder after the target has been reached.
                </p>
                <div className="form-control">
                  <label htmlFor="smartGrindIp" className="block text-sm font-medium mb-2">
                    Tasmota IP
                  </label>
                  <input
                    id="smartGrindIp"
                    name="smartGrindIp"
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="0"
                    value={formData.smartGrindIp}
                    onChange={onChange('smartGrindIp')}
                  />
                </div>
                <div className="form-control">
                  <label htmlFor="smartGrindMode" className="block text-sm font-medium mb-2">
                    Mode
                  </label>
                  <select id="smartGrindMode" name="smartGrindMode" className="select select-bordered w-full" onChange={onChange('smartGrindMode')}>
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
          </div>

          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xl font-medium">Home Assistant (MQTT)</span>
              <label className="label cursor-pointer">
                <input
                  id="homeAssistant"
                  name="homeAssistant"
                  value="homeAssistant"
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={!!formData.homeAssistant}
                  onChange={onChange('homeAssistant')}
                />
              </label>
            </div>
            {formData.homeAssistant && (
              <div className="space-y-4 mt-4 pt-4 border-t border-base-300">
                <p className="text-sm opacity-70">
                  This feature allows connection to a Home Assistant or MQTT installation and push the current state.
                </p>
                <div className="form-control">
                  <label htmlFor="haIP" className="block text-sm font-medium mb-2">
                    MQTT IP
                  </label>
                  <input
                    id="haIP"
                    name="haIP"
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="0"
                    value={formData.haIP}
                    onChange={onChange('haIP')}
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="haPort" className="block text-sm font-medium mb-2">
                    MQTT Port
                  </label>
                  <input
                    id="haPort"
                    name="haPort"
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="0"
                    value={formData.haPort}
                    onChange={onChange('haPort')}
                  />
                </div>
                
                <div className="form-control">
                  <label htmlFor="haUser" className="block text-sm font-medium mb-2">
                    MQTT User
                  </label>
                  <input
                    id="haUser"
                    name="haUser"
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="user"
                    value={formData.haUser}
                    onChange={onChange('haUser')}
                  />
                </div>
                
                <div className="form-control">
                  <label htmlFor="haPassword" className="block text-sm font-medium mb-2">
                    MQTT Password
                  </label>
                  <input
                    id="haPassword"
                    name="haPassword"
                    type="password"
                    className="input input-bordered w-full"
                    placeholder="password"
                    value={formData.haPassword}
                    onChange={onChange('haPassword')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      <div className="col-span-12 space-y-4">
        <div className="alert alert-info">
          <span>Some options like WiFi, NTP and managing Plugins require a restart.</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <a href="/" className="btn btn-outline">
            Back
          </a>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting && <Spinner size={4} />}
            Save
          </button>
          <button
            type="submit"
            name="restart"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={(e) => onSubmit(e, true)}
          >
            Save and Restart
          </button>
        </div>
      </div>
    </form>
  );
}
