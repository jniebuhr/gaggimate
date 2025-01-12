import './style.css';
import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

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
      if (key === 'homeAssistant') {
        value = !formData.homeAssistant;
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
    [setFormData, formRef]
  );

  if (isLoading) {
    return (
      <div class="p-16 flex flex-row items-center">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <h2 class="text-3xl font-semibold mb-4 text-[#333333]">Settings</h2>

      <form
          ref={formRef}
          method="post"
          action="/api/settings"
          class="flex flex-col gap-4 w-full max-w-md border-b border-[#CCCCCC] pb-4"
          onSubmit={onSubmit}
      >
        <div>
          <b>User Preferences</b>
        </div>
        <div>
          <label for="startup-mode" className="block font-medium text-[#333333]">
            Startup Mode
          </label>
          <select id="startup-mode" name="startupMode" class="input-field" onChange={onChange('startupMode')}>
            <option value="standby" selected={formData.startupMode === 'standby'}>
              Standby
            </option>
            <option value="brew" selected={formData.startupMode === 'brew'}>
              Brew
            </option>
          </select>
        </div>

        <div>
          <label for="targetDuration" className="block font-medium text-[#333333]">
            Default Duration (sec)
          </label>
          <input
              id="targetDuration"
              name="targetDuration"
              type="number"
              className="input-field"
              placeholder="30"
              value={formData.targetDuration}
              onChange={onChange('targetDuration')}
          />
        </div>

        <div>
          <label for="targetBrewTemp" className="block font-medium text-[#333333]">
            Default Brew Temperature (°C)
          </label>
          <input
              id="targetBrewTemp"
              name="targetBrewTemp"
              type="number"
              className="input-field"
              placeholder="93"
              value={formData.targetBrewTemp}
              onChange={onChange('targetBrewTemp')}
          />
        </div>

        <div>
          <label for="targetSteamTemp" className="block font-medium text-[#333333]">
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
          <label for="targetWaterTemp" className="block font-medium text-[#333333]">
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
          <label for="temperatureOffset" className="block font-medium text-[#333333]">
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

        <div>
          <b>Integrations</b>
        </div>

        <div className="flex flex-row items-center gap-4">
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
                className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <p>Homekit</p>
        </div>

        <div className="flex flex-row items-center gap-4">
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
                className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <p>Home Assistant</p>
        </div>

        {
          formData.homeAssistant && (
                <>
                  <div>
                    <label htmlFor="haIP" className="block font-medium text-[#333333]">
                      Home Assistant IP
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

                  <div>
                    <label htmlFor="haPort" className="block font-medium text-[#333333]">
                      Home Assistant Port
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
                  <div>
                    <label htmlFor="haUser" className="block font-medium text-[#333333]">
                      Home Assistant User
                    </label>
                    <input
                        id="haUser"
                        name="haUser"
                        type="text"
                        className="input-field"
                        placeholder="0"
                        value={formData.haUser}
                        onChange={onChange('haUser')}
                    />
                  </div>
                  <div>
                    <label htmlFor="haPassword" className="block font-medium text-[#333333]">
                      Home Assistant Password
                    </label>
                    <input
                        id="haPassword"
                        name="haPassword"
                        type="password"
                        className="input-field"
                        placeholder="0"
                        value={formData.haUser}
                        onChange={onChange('haPassword')}
                    />
                  </div>
                </>
            )
        }

        <div>
          <b>System Settings</b>
          <label for="wifiSsid" className="block font-medium text-[#333333]">
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
          <label for="wifiPassword" className="block font-medium text-[#333333]">
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
          <label for="mdnsName" className="block font-medium text-[#333333]">
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
          <label for="pid" className="block font-medium text-[#333333]">
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

        <div className="text-sm text-[#666666]">Some options like WiFi, NTP, Homekit and MQTT require a restart.</div>

        <div className="flex justify-center mt-6 flex-row gap-1">
          <a href="/" class="menu-button">
            Back
          </a>
          <button type="submit" class="menu-button flex flex-row gap-2" disabled={submitting}>
            Save
            {submitting && <Spinner size={4}/>}
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
      </form>
    </>
  );
}
