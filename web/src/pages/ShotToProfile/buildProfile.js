import uuidv4 from '../../utils/uuid.js';

/**
 * @typedef {Object} Segment
 * @property {string}  name           - Phase name (user-edited)
 * @property {number}  startIdx       - First sample index (inclusive)
 * @property {number}  endIdx         - Last sample index (exclusive)
 * @property {number}  durationSeconds
 * @property {'pressure'|'flow'} targetType
 * @property {number}  targetValue    - bar or ml/s
 * @property {number}  temperature    - °C
 */

/**
 * @param {string}    profileName
 * @param {Segment[]} segments
 * @returns {Object}  profile object ready to pass to ProfileEdit
 */
export function buildProfile(profileName, segments) {
  if (!segments?.length) throw new Error('buildProfile requires at least one segment');
  const firstTemp = segments[0]?.temperature ?? 93;

  return {
    id: uuidv4(),
    label: profileName,
    description: '',
    type: 'pro',
    temperature: Math.round(firstTemp),
    favorite: false,
    selected: false,
    utility: false,
    phases: segments.map(seg => ({
      name: seg.name,
      phase: 'brew',
      valve: 1,
      duration: seg.durationSeconds,
      // per-phase temperature enables ramping in 'pro' profiles; top-level is the default/display value
      temperature: Math.round(seg.temperature),
      pump: {
        target: seg.targetType,
        pressure: seg.targetType === 'pressure' ? seg.targetValue : 0,
        flow: seg.targetType === 'flow' ? seg.targetValue : 0,
      },
      transition: {
        type: 'instant',
        duration: 0,
        adaptive: false,
      },
      targets: [],
    })),
  };
}
