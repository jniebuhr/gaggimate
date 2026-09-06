import PropTypes from 'prop-types';

// Inline one of the display's warning SVGs so it follows the text color.
export function WarningIcon({ icon, title, className = '' }) {
  const svg = icon
    .replace(/ id="[^"]*"| data-name="[^"]*"/g, '')
    .replace('<svg ', '<svg fill="currentColor" width="1em" height="1em" ');
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

WarningIcon.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
};
