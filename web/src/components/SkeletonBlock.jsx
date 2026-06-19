import PropTypes from 'prop-types';

export function SkeletonBlock({ className = '' }) {
  return <div className={`shimmer ${className}`} />;
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
};
