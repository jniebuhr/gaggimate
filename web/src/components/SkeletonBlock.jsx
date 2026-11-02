// @ts-check
import PropTypes from 'prop-types';

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('preact').JSX.CSSProperties} [props.style]
 */
export function SkeletonBlock({ className = '', style }) {
  return (
    <div
      aria-hidden='true'
      className={`shimmer${className ? ` ${className}` : ''}`}
      style={style}
    />
  );
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};
