import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function StandardProfileForm({ data, onChange }) {
  const onFieldChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };
  const onPhaseChange = (index, value) => {

  };

  const onPhaseAdd = () => {
    onChange({
      ...data,
      phases: [
        ...data.phases,
        {
          phase: 'brew',
          name: 'New Phase',
          pump: 1,
          valve: 1,
          duration: 0
        }
      ]
    })
  };

  return (
    <>
      <Card sm={12}>
        <div className="p-6 pb-3 flex flex-col gap-2">
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
        <div className="p-6 pb-3">
          <h3 className="text-lg font-bold">Phases</h3>
        </div>
        <div className="p-6 flex flex-col">
          {
            data.phases.map((value, index) => (
              <>
                {
                  index > 0 && <div className="p-2 flex flex-col items-center">
                    <i className="fa fa-chevron-down text-lg" />
                  </div>
                }
                <Phase key={index} phase={value} onChange={(phase) => onPhaseChange(index, phase)} />
              </>
            ))
          }
          <div className="pt-4 flex flex-row justify-center">
            <div className="flex flex-row gap-4 menu-button" onClick={() => onPhaseAdd()}>
              <i className="fa fa-plus text-xl" />
              <span className="text-lg">Add phase</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-2">
          <button type="submit" className="menu-button">
            Save
          </button>
        </div>
      </Card>
    </>
  );
}

function Phase({ phase }) {
  const targets = phase?.targets || [];
  const volumetricTarget = targets.find(t => t.type === 'volumetric') || {};
  const targetWeight = volumetricTarget?.value || 0;
  return (
    <div className="bg-gray-50 border-[#ccc] border p-4 rounded-md grid grid-cols-12 gap-4 dark:bg-slate-700 dark:border-slate-800">
      <div className="md:col-span-4 flex flex-row items-center">
        <select className="select-field">
          <option value="preinfusion" selected={phase.phase === 'preinfusion'}>
            Pre-Infusion
          </option>
          <option value="brew" selected={phase.phase === 'brew'}>
            Brew
          </option>
        </select>
      </div>
      <div className="md:col-span-8 flex flex-col align-center">
        <input
          className="input-field"
          placeholder="Name..."
          value={phase.name}
        />
      </div>
      <div className="md:col-span-6 flex flex-row gap-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            value=""
            type="checkbox"
            className="sr-only peer"
            checked={!!phase.pump}
          />
          <div
            className="w-9 h-5 pt-0.5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
        <span>Pump</span>
      </div>
      <div className="md:col-span-6 flex flex-row gap-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            value=""
            type="checkbox"
            className="sr-only peer"
            checked={!!phase.valve}
          />
          <div
            className="w-9 h-5 pt-0.5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
        <span>Valve</span>
      </div>
      <div className="col-span-12 flex flex-col">
        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Duration</label>
        <div className="flex">
          <input
            className="input-field addition"
            type="number"
            value={phase.duration}
          />
          <span className="input-addition">s</span>
        </div>
      </div>
      {
        phase.phase === 'brew' && <div className="col-span-12 flex flex-col">
          <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Volumetric Target</label>
          <div className="flex">
            <input
              className="input-field"
              type="number"
              value={targetWeight}
            />
            <span className="input-addition">g</span>
          </div>
        </div>
      }
    </div>
  );
}
