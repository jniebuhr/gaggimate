import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { isNumber } from 'chart.js/helpers';
import './style.css';

export function StandardProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;
  const onFieldChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };
  const onPhaseChange = (index, value) => {
    const newData = {
      ...data,
    };
    newData.phases[index] = value;
    onChange(newData);
  };

  const onPhaseAdd = () => {
    onChange({
      ...data,
      phases: [
        ...data.phases,
        {
          phase: 'brew',
          name: 'New Phase',
          pump: 100,
          valve: 1,
          duration: 0,
        },
      ],
    });
  };

  const onPhaseRemove = (index) => {
    const newData = {
      ...data,
      phases: [],
    };
    for (let i = 0; i < data.phases.length; i++) {
      if (i !== index) {
        newData.phases.push(data.phases[i]);
      }
    }
    onChange(newData);
  };

  return (
    <>
      <Card sm={12}>
        <div className="pb-3 flex flex-col gap-2 p-2 lg:p-6">
          <div>
            <label htmlFor="label" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
              Label
            </label>
            <input
              id="label"
              name="label"
              className="input-field"
              value={data?.label}
              onChange={(e) => onFieldChange('label', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="description" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
              Description
            </label>
            <input
              id="description"
              name="description"
              className="input-field"
              value={data?.description}
              onChange={(e) => onFieldChange('description', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="temperature" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
              Temperature
            </label>
            <div className="flex">
              <input
                id="temperature"
                name="temperature"
                type="number"
                className="input-field addition"
                value={data?.temperature}
                onChange={(e) => onFieldChange('temperature', e.target.value)}
              />
              <span className="input-addition">°C</span>
            </div>
          </div>
        </div>
        <div className="p-2 lg:p-6 pb-3">
          <h3 className="text-lg font-bold">Phases</h3>
        </div>
        <div className="p-2 lg:p-6 flex flex-col">
          {data.phases.map((value, index) => (
            <>
              {index > 0 && (
                <div className="p-2 flex flex-col items-center">
                  <i className="fa fa-chevron-down text-lg" />
                </div>
              )}
              <Phase
                key={index}
                phase={value}
                onChange={(phase) => onPhaseChange(index, phase)}
                onRemove={() => onPhaseRemove(index)}
                pressureAvailable={pressureAvailable}
              />
            </>
          ))}
          <div className="pt-4 flex flex-row justify-center">
            <div className="flex flex-row gap-4 menu-button" onClick={() => onPhaseAdd()}>
              <i className="fa fa-plus text-xl" />
              <span className="text-lg">Add phase</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-2">
          <button type="submit" className="menu-button flex flex-row gap-2" onClick={() => onSave(data)} disabled={saving}>
            <span>Save</span>
            {saving && <Spinner size={4} />}
          </button>
        </div>
      </Card>
    </>
  );
}

function Phase({ phase, onChange, onRemove, pressureAvailable }) {
  const onFieldChange = (field, value) => {
    onChange({
      ...phase,
      [field]: value,
    });
  };
  const onVolumetricTargetChange = (value) => {
    if (value === 0) {
      onChange({
        ...phase,
        targets: null,
      });
      return;
    }
    onChange({
      ...phase,
      targets: [
        {
          type: 'volumetric',
          value: value,
        },
      ],
    });
  };
  const targets = phase?.targets || [];
  const volumetricTarget = targets.find((t) => t.type === 'volumetric') || {};
  const targetWeight = volumetricTarget?.value || 0;

  const pumpPower = isNumber(phase.pump) ? phase.pump : 100;
  const pressure = !isNumber(phase.pump) ? phase.pump.pressure : 0;
  const flow = !isNumber(phase.pump) ? phase.pump.flow : 0;
  const mode = isNumber(phase.pump) ? (phase.pump === 0 ? 'off' : 'power') : phase.pump.target;

  return (
    <div className="bg-gray-50 border-[#ccc] border p-2 lg:p-4 rounded-md grid grid-cols-12 gap-4 dark:bg-slate-700 dark:border-slate-800">
      <div className="col-span-12 md:col-span-4 flex flex-row items-center">
        <select className="select-field" onChange={(e) => onFieldChange('phase', e.target.value)}>
          <option value="preinfusion" selected={phase.phase === 'preinfusion'}>
            Pre-Infusion
          </option>
          <option value="brew" selected={phase.phase === 'brew'}>
            Brew
          </option>
        </select>
      </div>
      <div className="col-span-12 md:col-span-8 flex flex-row gap-2 align-center">
        <input
          className="input-field"
          placeholder="Name..."
          value={phase.name}
          onChange={(e) => onFieldChange('name', e.target.value)}
        />
        <a
          href="javascript:void(0)"
          data-tooltip="Delete this phase"
          onClick={() => onRemove()}
          className="hidden md:flex group items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 active:border-red-200"
        >
          <span className="fa fa-trash" />
        </a>
      </div>
      <div className="col-span-12 flex flex-col">
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Duration</label>
        <div className="flex">
          <input
            className="input-field addition"
            type="number"
            min="1"
            value={phase.duration}
            onChange={(e) => onFieldChange('duration', e.target.value)}
          />
          <span className="input-addition">s</span>
        </div>
      </div>
      <div className="col-span-12 flex flex-col">
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Volumetric Target</label>
        <div className="flex">
          <input
            className="input-field"
            type="number"
            value={targetWeight}
            onChange={(e) => onVolumetricTargetChange(parseFloat(e.target.value))}
          />
          <span className="input-addition">g</span>
        </div>
      </div>
      <div className="col-span-12 flex flex-col">
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Valve</label>
        <div className="inline-flex rounded-md">
          <span className={`mode-selector ${!phase.valve && 'selected'}`} onClick={() => onFieldChange('valve', 0)}>
            Closed
          </span>
          <span className={`mode-selector ${phase.valve && 'selected'}`} onClick={() => onFieldChange('valve', 1)}>
            Open
          </span>
        </div>
      </div>
      <div className="col-span-12 grid gap-2">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 col-span-12">Pump</label>
        <div className="inline-flex rounded-md col-span-12">
          <span className={`mode-selector ${mode === 'off' && 'selected'}`} onClick={() => onFieldChange('pump', 0)}>
            Off
          </span>
          <span
            className={`mode-selector ${mode === 'power' && 'selected'}`}
            onClick={() => mode !== 'power' && onFieldChange('pump', 100)}
          >
            Power
          </span>
          {pressureAvailable && (
            <>
              <span
                className={`mode-selector ${mode === 'pressure' && 'selected'}`}
                onClick={() => mode !== 'pressure' && onFieldChange('pump', { target: 'pressure', pressure: 0, flow: 0 })}
              >
                Pressure <sup>PRO</sup>
              </span>
              <span
                className={`mode-selector ${mode === 'flow' && 'selected'}`}
                onClick={() => mode !== 'flow' && onFieldChange('pump', { target: 'flow', pressure: 0, flow: 0 })}
              >
                Flow <sup>PRO</sup>
              </span>
            </>
          )}
        </div>
        {mode === 'power' && (
          <div className="col-span-12 flex flex-col">
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Pump Power</label>
            <div className="flex">
              <input
                className="input-field"
                type="number"
                step="1"
                min={0}
                max={100}
                value={pumpPower}
                onChange={(e) => onFieldChange('pump', parseFloat(e.target.value))}
              />
              <span className="input-addition">%</span>
            </div>
          </div>
        )}
        {(mode === 'pressure' || mode === 'flow') && (
          <>
            <div className="col-span-12 md:col-span-6 flex flex-col">
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                Pressure {mode === 'pressure' ? 'Target' : 'Limit'}
              </label>
              <div className="flex">
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={pressure}
                  onChange={(e) => onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })}
                />
                <span className="input-addition">bar</span>
              </div>
            </div>
            <div className="col-span-12 md:col-span-6 flex flex-col">
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                Flow {mode === 'flow' ? 'Target' : 'Limit'}
              </label>
              <div className="flex">
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={flow}
                  onChange={(e) => onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })}
                />
                <span className="input-addition">g/s</span>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="block md:hidden col-span-12 mb-2">
        <a
          href="javascript:void(0)"
          onClick={() => onRemove()}
          className="group items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 active:border-red-200"
        >
          Delete
        </a>
      </div>
    </div>
  );
}
