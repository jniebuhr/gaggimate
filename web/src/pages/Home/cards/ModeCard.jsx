import PropTypes from 'prop-types';
import { ModeTab } from '../ModeTab.jsx';

export function ModeCard({ mode, modes, changeMode, compact = false, locked = false }) {
  return (
    <div className='bg-base-200/70 @container flex h-9 w-full shrink-0 gap-0.5 rounded-full p-0.5'>
      {modes.map(m => (
        <ModeTab
          key={m.id}
          mode={m}
          active={mode === m.id}
          onClick={() => changeMode(m.id)}
          rotation={m.iconRotation}
          compact={compact}
          disabled={locked}
        />
      ))}
    </div>
  );
}

ModeCard.propTypes = {
  mode: PropTypes.number.isRequired,
  modes: PropTypes.arrayOf(PropTypes.object).isRequired,
  changeMode: PropTypes.func.isRequired,
  compact: PropTypes.bool,
  locked: PropTypes.bool,
};
