// Shared constants for Home page components
export const MODE_LABELS = ['STANDBY', 'BREW', 'STEAM', 'WATER', 'GRIND'];
export const MODE_SUBTITLES = {
  0: 'System idle',
  1: 'Ready to extract',
  2: 'Steam staging',
  3: 'Water ready',
  4: 'Grind staging',
};

// Format number with optional decimal places
export function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}