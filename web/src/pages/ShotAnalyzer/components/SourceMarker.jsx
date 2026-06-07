import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLaptopFile } from '@fortawesome/free-solid-svg-icons/faLaptopFile';
import { analyzerUiColors } from '../utils/analyzerUtils';
import { GmLogoIcon } from '../../../components/GmLogoIcon.jsx';

const SOURCE_MARKER_VARIANTS = {
  compact: {
    gmWidth: '0.84rem',
    gmHeight: '0.72rem',
    webSize: '0.72rem',
    wrapperClassName: 'inline-flex items-center justify-center',
  },
  library: {
    gmWidth: '0.84rem',
    gmHeight: '0.72rem',
    webSize: '0.72rem',
    wrapperClassName: 'inline-flex items-center justify-center',
  },
  large: {
    gmWidth: '1rem',
    gmHeight: '0.86rem',
    webSize: '0.9rem',
    wrapperClassName: 'inline-flex items-center justify-center',
  },
};

export function SourceMarker({ source, variant = 'compact' }) {
  // Central size map for the GM/Web source markers.
  const resolvedVariant = SOURCE_MARKER_VARIANTS[variant] || SOURCE_MARKER_VARIANTS.compact;
  const isGaggiMate = source === 'gaggimate';

  return (
    <span
      className={resolvedVariant.wrapperClassName}
      style={{ lineHeight: 0, overflow: 'visible' }}
    >
      <span className='sr-only'>{isGaggiMate ? 'GM' : 'WEB'}</span>
      {isGaggiMate ? (
        <GmLogoIcon
          width={resolvedVariant.gmWidth}
          height={resolvedVariant.gmHeight}
          style={{ color: analyzerUiColors.sourceBadgeGmText }}
        />
      ) : (
        <FontAwesomeIcon
          icon={faLaptopFile}
          style={{ color: analyzerUiColors.sourceBadgeWebText, fontSize: resolvedVariant.webSize }}
          aria-hidden='true'
        />
      )}
    </span>
  );
}
