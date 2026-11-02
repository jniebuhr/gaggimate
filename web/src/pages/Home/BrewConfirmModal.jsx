import PropTypes from 'prop-types';
import { createPortal } from 'preact/compat';
import { Trans, useLingui } from '@lingui/react/macro';
import { WarningIcon } from '../../components/WarningIcon.jsx';
import { WARNING_LEVEL } from '../../utils/warnings.js';

// Portaled to <body> and lifted above the sidebar (z-9999) so the backdrop dims the whole page.
export function BrewConfirmModal({ warnings, onBack, onIgnore }) {
  const { t } = useLingui();
  return createPortal(
    <div
      className='modal modal-open z-[10000]'
      role='dialog'
      aria-modal='true'
      aria-labelledby='brew-confirm-title'
    >
      <div className='modal-box'>
        <h3 id='brew-confirm-title' className='text-lg font-bold'>
          <Trans>Start brew anyway?</Trans>
        </h3>
        <p className='text-base-content/70 py-2 text-sm'>
          <Trans>The following warnings are currently active:</Trans>
        </p>
        <ul className='space-y-2'>
          {warnings.map(w => (
            <li key={w.key} className='flex items-center gap-3'>
              <WarningIcon
                icon={w.icon}
                className={`text-xl ${w.level === WARNING_LEVEL.ERROR ? 'text-error' : 'text-warning'}`}
              />
              <span className='flex-1 text-sm'>{w.label}</span>
            </li>
          ))}
        </ul>
        <div className='modal-action'>
          <button type='button' className='btn' onClick={onBack}>
            <Trans>Back</Trans>
          </button>
          <button type='button' className='btn btn-error' onClick={onIgnore}>
            <Trans>Start anyway</Trans>
          </button>
        </div>
      </div>
      <button type='button' className='modal-backdrop' aria-label={t`Close`} onClick={onBack} />
    </div>,
    document.body,
  );
}

BrewConfirmModal.propTypes = {
  warnings: PropTypes.array.isRequired,
  onBack: PropTypes.func.isRequired,
  onIgnore: PropTypes.func.isRequired,
};
