export function MobileChartScrubber({
  active = false,
  ariaLabel,
  insets = { left: 0, right: 0 },
  max,
  min = 0,
  onInput,
  onPointerUpdate,
  scrubberRef,
  value,
  variant,
}) {
  const handlePointerDown = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPointerUpdate(event);
  };

  const handlePointerMove = event => {
    if (event.buttons !== 1 && event.pointerType !== 'touch') return;
    onPointerUpdate(event);
  };

  return (
    <div
      ref={scrubberRef}
      className={`shot-chart-mobile-scrubber shot-chart-mobile-scrubber--${variant} ${
        active ? 'shot-chart-mobile-scrubber--active' : ''
      }`}
      style={{
        marginLeft: `${insets.left}px`,
        marginRight: `${insets.right}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <div className='shot-chart-mobile-scrubber__track' aria-hidden='true' />
      <div className='shot-chart-mobile-scrubber__hint' aria-hidden='true'>
        Swipe
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step='0.1'
        value={value}
        className='shot-chart-mobile-scrubber__range'
        aria-label={ariaLabel}
        onInput={onInput}
      />
    </div>
  );
}
