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
          <label htmlFor="startup-mode" className="block font-medium text-[#333333]">
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
          <label htmlFor="targetDuration" className="block font-medium text-[#333333]">
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
          <label htmlFor="targetBrewTemp" className="block font-medium text-[#333333]">
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
          <label htmlFor="targetSteamTemp" className="block font-medium text-[#333333]">
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
          <label htmlFor="targetWaterTemp" className="block font-medium text-[#333333]">
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
          <label htmlFor="temperatureOffset" className="block font-medium text-[#333333]">
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
          <b>Preinfusion</b>
        </div>

        <div className="flex flex-row gap-4">
          <div className="flex-auto">
            <label htmlFor="infusePumpTime" className="block font-medium text-[#333333]">
              Water flow (sec)
            </label>
            <input
                id="infusePumpTime"
                name="infusePumpTime"
                type="number"
                className="input-field"
                placeholder="0"
                value={formData.infusePumpTime}
                onChange={onChange('infusePumpTime')}
            />
          </div>
          <div className="flex-auto">
            <label htmlFor="infuseBloomTime" className="block font-medium text-[#333333]">
              Bloom time (sec)
            </label>
            <input
                id="infuseBloomTime"
                name="infuseBloomTime"
                type="number"
                className="input-field"
                placeholder="0"
                value={formData.infuseBloomTime}
                onChange={onChange('infuseBloomTime')}
            />
          </div>
        </div>

        <div>
          <b>Integrations</b>
        </div>

        <div class="flex flex-row items-center gap-4">
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
                class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <p>Homekit</p>
        </div>

        <div>
          <b>System Settings</b>
          <label htmlFor="wifiSsid" className="block font-medium text-[#333333]">
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
          <label htmlFor="wifiPassword" className="block font-medium text-[#333333]">
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
          <label htmlFor="mdnsName" className="block font-medium text-[#333333]">
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
          <label htmlFor="pid" className="block font-medium text-[#333333]">
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

        <div class="text-sm text-[#666666]">Some options like WiFi, NTP or integrations require a restart.</div>

        <div class="flex justify-center mt-6 flex-row gap-1">
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
