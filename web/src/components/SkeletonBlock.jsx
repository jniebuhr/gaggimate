import PropTypes from 'prop-types';

export function SkeletonBlock({ className = '' }) {
  return <div aria-hidden='true' className={`shimmer${className ? ` ${className}` : ''}`} />;
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
};
