import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { isNumber } from 'chart.js/helpers';

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
        <div className="flex flex-col gap-6 p-4">
          <div className="form-control">
            <label htmlFor="label" className="label">
              <span className="label-text text-base-content">Label</span>
            </label>
            <input
              id="label"
              name="label"
              className="input input-bordered"
              value={data?.label}
              onChange={(e) => onFieldChange('label', e.target.value)}
            />
          </div>
          <div className="form-control">
            <label htmlFor="description" className="label">
              <span className="label-text text-base-content">Description</span>
            </label>
            <input
              id="description"
              name="description"
              className="input input-bordered"
              value={data?.description}
              onChange={(e) => onFieldChange('description', e.target.value)}
            />
          </div>
          <div className="form-control">
            <label htmlFor="temperature" className="label">
              <span className="label-text text-base-content">Temperature</span>
            </label>
            <div className="input-group">
              <input
                id="temperature"
                name="temperature"
                type="number"
                className="input input-bordered"
                value={data?.temperature}
                onChange={(e) => onFieldChange('temperature', e.target.value)}
              />
              <span className="btn btn-square btn-disabled">°C</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-lg font-bold text-base-content mb-2">Phases</h3>
        </div>
        <div className="p-4 flex flex-col gap-6">
          {data.phases.map((value, index) => (
            <div key={index}>
              {index > 0 && (
                <div className="p-4 flex flex-col items-center">
                  <i className="fa fa-chevron-down text-lg text-base-content/60" />
                </div>
              )}
              <Phase
                phase={value}
                onChange={(phase) => onPhaseChange(index, phase)}
                onRemove={() => onPhaseRemove(index)}
                pressureAvailable={pressureAvailable}
              />
            </div>
          ))}
          <div className="flex flex-row justify-center pt-4">
            <button className="btn btn-outline gap-2" onClick={() => onPhaseAdd()}>
              <i className="fa fa-plus" />
              <span>Add phase</span>
            </button>
          </div>
        </div>
        <div className="p-4 flex flex-row gap-4">
          <a href="/profiles" className="btn btn-ghost">
            Back
          </a>
          <button type="submit" className="btn btn-primary gap-2" onClick={() => onSave(data)} disabled={saving}>
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
    <div className="bg-base-200 border border-base-300 p-6 rounded-lg grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-4 flex flex-row items-center">
        <select className="select select-bordered w-full" onChange={(e) => onFieldChange('phase', e.target.value)}>
          <option value="preinfusion" selected={phase.phase === 'preinfusion'}>
            Pre-Infusion
          </option>
          <option value="brew" selected={phase.phase === 'brew'}>
            Brew
          </option>
        </select>
      </div>
      <div className="col-span-12 md:col-span-8 flex flex-row gap-4 align-center">
        <input
          className="input input-bordered flex-1"
          placeholder="Name..."
          value={phase.name}
          onChange={(e) => onFieldChange('name', e.target.value)}
        />
        <button
          data-tooltip="Delete this phase"
          onClick={() => onRemove()}
          className="btn btn-sm btn-ghost text-error hidden md:flex"
        >
          <i className="fa fa-trash" />
        </button>
      </div>
      <div className="col-span-12 form-control">
        <label className="label">
          <span className="label-text text-base-content">Duration</span>
        </label>
        <div className="input-group">
          <input
            className="input input-bordered"
            type="number"
            min="1"
            value={phase.duration}
            onChange={(e) => onFieldChange('duration', e.target.value)}
          />
          <span className="btn btn-square btn-disabled">s</span>
        </div>
      </div>
      <div className="col-span-12 form-control">
        <label className="label">
          <span className="label-text text-base-content">Volumetric Target</span>
        </label>
        <div className="input-group">
          <input
            className="input input-bordered"
            type="number"
            value={targetWeight}
            onChange={(e) => onVolumetricTargetChange(parseFloat(e.target.value))}
          />
          <span className="btn btn-square btn-disabled">g</span>
        </div>
      </div>
      <div className="col-span-12 form-control">
        <label className="label">
          <span className="label-text text-base-content">Valve</span>
        </label>
        <div className="join">
          <button
            className={`join-item btn btn-sm ${!phase.valve ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onFieldChange('valve', 0)}
          >
            Closed
          </button>
          <button
            className={`join-item btn btn-sm ${phase.valve ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onFieldChange('valve', 1)}
          >
            Open
          </button>
        </div>
      </div>
      <div className="col-span-12 form-control">
        <label className="label">
          <span className="label-text text-base-content">Pump</span>
        </label>
        <div className="join">
          <button
            className={`join-item btn btn-sm ${mode === 'off' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onFieldChange('pump', 0)}
          >
            Off
          </button>
          <button
            className={`join-item btn btn-sm ${mode === 'power' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => mode !== 'power' && onFieldChange('pump', 100)}
          >
            Power
          </button>
          {pressureAvailable && (
            <>
              <button
                className={`join-item btn btn-sm ${mode === 'pressure' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => mode !== 'pressure' && onFieldChange('pump', { target: 'pressure', pressure: 0, flow: 0 })}
              >
                Pressure <sup>PRO</sup>
              </button>
              <button
                className={`join-item btn btn-sm ${mode === 'flow' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => mode !== 'flow' && onFieldChange('pump', { target: 'flow', pressure: 0, flow: 0 })}
              >
                Flow <sup>PRO</sup>
              </button>
            </>
          )}
        </div>
        {mode === 'power' && (
          <div className="col-span-12 form-control">
            <label className="label">
              <span className="label-text text-base-content">Pump Power</span>
            </label>
            <div className="input-group">
              <input
                className="input input-bordered"
                type="number"
                step="1"
                min={0}
                max={100}
                value={pumpPower}
                onChange={(e) => onFieldChange('pump', parseFloat(e.target.value))}
              />
              <span className="btn btn-square btn-disabled">%</span>
            </div>
          </div>
        )}
        {(mode === 'pressure' || mode === 'flow') && (
          <>
            <div className="col-span-12 md:col-span-6 form-control">
              <label className="label">
                <span className="label-text text-base-content">Pressure {mode === 'pressure' ? 'Target' : 'Limit'}</span>
              </label>
              <div className="input-group">
                <input
                  className="input input-bordered"
                  type="number"
                  step="0.01"
                  value={pressure}
                  onChange={(e) => onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })}
                />
                <span className="btn btn-square btn-disabled">bar</span>
              </div>
            </div>
            <div className="col-span-12 md:col-span-6 form-control">
              <label className="label">
                <span className="label-text text-base-content">Flow {mode === 'flow' ? 'Target' : 'Limit'}</span>
              </label>
              <div className="input-group">
                <input
                  className="input input-bordered"
                  type="number"
                  step="0.01"
                  value={flow}
                  onChange={(e) => onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })}
                />
                <span className="btn btn-square btn-disabled">g/s</span>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="block md:hidden col-span-12">
        <button onClick={() => onRemove()} className="btn btn-sm btn-ghost text-error w-full">
          <i className="fa fa-trash mr-2" />
          Delete
        </button>
      </div>
    </div>
  );
}
