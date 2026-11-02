import PropTypes from 'prop-types';

export function SkeletonBlock({ className = '', style }) {
  return (
    <div
      aria-hidden='true'
      className={className ? `shimmer ${className}` : 'shimmer'}
      style={style}
    />
  );
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};
