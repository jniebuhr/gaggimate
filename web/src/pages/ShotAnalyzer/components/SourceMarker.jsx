import { useId } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLaptopFile } from '@fortawesome/free-solid-svg-icons/faLaptopFile';
import { analyzerUiColors } from '../utils/analyzerUtils';

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

function GmLogoIcon({ width, height }) {
  const clipPathId = useId();

  // Keep the tricolor fill from the delivered asset, but bind the dark outline
  // to currentColor so the icon remains readable across light and dark themes.
  return (
    <svg
      viewBox='0 0 118 101'
      width={width}
      height={height}
      style={{ display: 'block', flexShrink: 0, color: analyzerUiColors.sourceBadgeGmText }}
      aria-hidden='true'
    >
      <defs>
        <clipPath id={clipPathId}>
          <path d='M125.292 65.821L125.292 72.921L131.376 77.953L138.355 77.953L145.134 72.373L145.134 65.821L125.292 65.821Z' />
        </clipPath>
      </defs>

      <g transform='matrix(4.16667,0,0,4.16667,-514.15,-242.59)'>
        <g clipPath={`url(#${clipPathId})`}>
          <g transform='matrix(1,0,0,1,0,-71.661)'>
            <rect x='125.291' y='137.481' width='20.409' height='12.132' fill='#119246' />
          </g>
          <g transform='matrix(1,0,0,1,0,-71.661)'>
            <rect x='132.094' y='137.481' width='13.606' height='12.132' fill='#ffffff' />
          </g>
          <g transform='matrix(1,0,0,1,0,-71.661)'>
            <rect x='138.898' y='137.481' width='6.803' height='12.132' fill='#ce2c38' />
          </g>
        </g>
      </g>

      <g transform='matrix(4.16667,0,0,4.16667,98.2125,58.8708)'>
        <path
          d='M0 -4.037L-0.136 -4.037C0.451 -5.69 -0.639 -7.438 -2.569 -7.94C-2.883 -8.021 -3.208 -8.066 -3.536 -8.074L-20.035 -8.074C-26.459 -7.698 -22.392 0.657 -20.729 2.939C-19.214 4.904 -16.638 6.078 -13.888 6.055L-9.684 6.055C-6.98 6.076 -4.441 4.941 -2.917 3.027L0 3.027C5.673 2.934 6.787 -4.217 0 -4.037M-9.684 4.037L-13.888 4.037C-15.842 4.059 -17.675 3.231 -18.757 1.838C-19.398 1.312 -22.989 -6.055 -20.035 -6.055L-3.536 -6.055C-3.208 -6.056 -2.895 -5.937 -2.676 -5.727C-2.444 -5.508 -2.332 -5.214 -2.369 -4.92C-3.032 -0.622 -4.28 3.846 -9.684 4.037M0 1.009L-1.664 1.009C-1.18 0.032 -0.803 -0.982 -0.54 -2.019C0.885 -2.1 2.461 -1.801 2.357 -0.865C2.278 0.197 1.242 1.02 0 1.009M-12.935 -11.101L-12.935 -13.12C-12.935 -13.677 -12.407 -14.129 -11.756 -14.129C-11.105 -14.129 -10.577 -13.677 -10.577 -13.12L-10.577 -11.101C-10.577 -10.544 -11.105 -10.092 -11.756 -10.092C-12.407 -10.092 -12.935 -10.544 -12.935 -11.101M-8.22 -11.101L-8.22 -13.12C-8.22 -13.677 -7.693 -14.129 -7.042 -14.129C-6.391 -14.129 -5.863 -13.677 -5.863 -13.12L-5.863 -11.101C-5.863 -10.544 -6.391 -10.092 -7.042 -10.092C-7.693 -10.092 -8.22 -10.544 -8.22 -11.101M-17.649 -11.101L-17.649 -13.12C-17.649 -13.677 -17.121 -14.129 -16.47 -14.129C-15.819 -14.129 -15.292 -13.677 -15.292 -13.12L-15.292 -11.101C-15.292 -10.544 -15.82 -10.093 -16.471 -10.093C-17.121 -10.093 -17.648 -10.545 -17.649 -11.101M0 9.083C0 9.64 -0.528 10.092 -1.179 10.092L-22.392 10.092C-23.043 10.092 -23.571 9.64 -23.571 9.083C-23.571 8.525 -23.043 8.073 -22.392 8.073L-1.179 8.073C-0.528 8.073 0 8.525 0 9.083'
          fill='currentColor'
          fillRule='nonzero'
        />
      </g>
    </svg>
  );
}

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
        <GmLogoIcon width={resolvedVariant.gmWidth} height={resolvedVariant.gmHeight} />
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
