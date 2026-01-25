import { useCallback } from 'preact/hooks';

/**
 * A reusable RGBW Color Picker component with LED color simulation.
 *
 * @param {Object} props
 * @param {Object} props.value - Object containing { r, g, b, w } values (0-255).
 * @param {Function} props.onChange - Callback function called with the updated color object.
 * @param {string} [props.label] - Optional label for the component.
 * @param {boolean} [props.isWhiteOnly] - If true, only shows the White channel control.
 */
export function RGBWColorPicker({ value, onChange, label, isWhiteOnly = false }) {
  const { r = 0, g = 0, b = 0, w = 0 } = value || {};

  const handleSliderChange = useCallback(
    (channel, newValue) => {
      onChange({
        ...value,
        [channel]: parseInt(newValue, 10),
      });
    },
    [value, onChange],
  );

  // Simulation logic:
  // For RGBW: Blend RGB with White (scaled for visibility).
  // For White Only: Use White value to create a grayscale intensity.
  const simulatedR = isWhiteOnly ? w : Math.min(255, r + 3 * w);
  const simulatedG = isWhiteOnly ? w : Math.min(255, g + 3 * w);
  const simulatedB = isWhiteOnly ? w : Math.min(255, b + 3 * w);

  const allChannels = [
    { key: 'r', label: 'Red', colorClass: 'range-error' },
    { key: 'g', label: 'Green', colorClass: 'range-success' },
    { key: 'b', label: 'Blue', colorClass: 'range-info' },
    { key: 'w', label: 'White', colorClass: 'range-white' },
  ];

  // Filter channels based on the isWhiteOnly option
  const visibleChannels = isWhiteOnly ? allChannels.filter(c => c.key === 'w') : allChannels;

  return (
    <div className='border-base-300 rounded-box bg-base-100 flex flex-col gap-4 border p-4 shadow-sm'>
      <div className='flex flex-row gap-4' aria-label={label ? `Color Picker for ${label}` : 'Color Picker'}  >
        {label && <h3 className='text-lg font-bold'>{label}</h3>}
        {/* LED Preview */}
        <div className='flex items-center gap-4'>
          <div className='relative'>
            <div
              className='border-base-content/20 h-6 w-6 rounded-full border shadow-inner'
              style={{
                backgroundColor: `rgb(${simulatedR}, ${simulatedG}, ${simulatedB})`,
                boxShadow:
                  (isWhiteOnly ? w : r + g + b + w) > 0
                    ? `0 0 ${10 + w / 20}px rgba(${simulatedR},${simulatedG},${simulatedB}, 0.4)`
                    : 'none',
              }}
            />
          </div>
        </div>
      </div>

      <div className={`grid gap-3 ${isWhiteOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {visibleChannels.map(({ key, label: chLabel, colorClass }) => (
          <div key={key} className='flex flex-col gap-1'>
            <div className='flex items-center justify-between text-sm font-medium'>
              <span>{chLabel}</span>
              <span className='badge badge-sm font-mono'>{value[key] || 0}</span>
            </div>
            <input
              aria-label={`${chLabel} slider`}
              type='range'
              min='0'
              max='255'
              value={value[key] || 0}
              onInput={e => handleSliderChange(key, e.target.value)}
              className={`range range-sm ${colorClass}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
