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
      <Card sm={12} title="Profile Information">
        <div className="form-control">
          <label htmlFor="label" className="block text-sm font-medium mb-2">
            Label
          </label>
          <input
            id="label"
            name="label"
            className="input input-bordered w-full"
            value={data?.label}
            onChange={(e) => onFieldChange('label', e.target.value)}
          />
        </div>
        <div className="form-control">
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description
          </label>
          <input
            id="description"
            name="description"
            className="input input-bordered w-full"
            value={data?.description}
            onChange={(e) => onFieldChange('description', e.target.value)}
          />
        </div>
        <div className="form-control">
          <label htmlFor="temperature" className="block text-sm font-medium mb-2">
            Temperature
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
      </Card>

      <Card sm={12} title="Brew Phases">
        <div className="space-y-4">
          {data.phases.map((value, index) => (
            <div key={index}>
              {index > 0 && (
                <div className="flex flex-col items-center py-2">
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
            <button className="btn btn-outline gap-2" onClick={onPhaseAdd}>
              <i className="fa fa-plus" />
              <span>Add phase</span>
            </button>
          </div>
        </div>
      </Card>

      <div className="sm:col-span-12 flex flex-col sm:flex-row gap-2">
        <a href="/profiles" className="btn btn-outline">
          Back
        </a>
        <button type="submit" className="btn btn-primary gap-2" onClick={() => onSave(data)} disabled={saving}>
          <span>Save</span>
          {saving && <Spinner size={4} />}
        </button>
      </div>
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
    <div className="bg-base-200 border border-base-300 p-4 rounded-lg space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="block text-sm font-medium mb-2">
            Phase Type
          </label>
          <select 
            className="select select-bordered w-full" 
            onChange={(e) => onFieldChange('phase', e.target.value)}
            value={phase.phase}
          >
            <option value="preinfusion">Pre-Infusion</option>
            <option value="brew">Brew</option>
          </select>
        </div>
        <div className="form-control">
          <label className="block text-sm font-medium mb-2">
            Phase Name
          </label>
          <div className="flex gap-2">
            <input
              className="input input-bordered flex-1"
              placeholder="Name..."
              value={phase.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
            />
            <button
              onClick={onRemove}
              className="btn btn-sm btn-ghost text-error"
              title="Delete this phase"
            >
              <i className="fa fa-trash" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control">
          <label className="block text-sm font-medium mb-2">
            Duration
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
        <div className="form-control">
          <label className="block text-sm font-medium mb-2">
            Volumetric Target
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
      </div>

      <div className="form-control">
        <label className="block text-sm font-medium mb-2">
          Valve
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

      <div className="form-control">
        <label className="block text-sm font-medium mb-2">
          Pump Mode
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
      </div>

      {mode === 'power' && (
        <div className="form-control">
          <label className="block text-sm font-medium mb-2">
            Pump Power
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="block text-sm font-medium mb-2">
              Pressure {mode === 'pressure' ? 'Target' : 'Limit'}
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
          <div className="form-control">
            <label className="block text-sm font-medium mb-2">
              Flow {mode === 'flow' ? 'Target' : 'Limit'}
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
        </div>
      )}
    </div>
  );
}
