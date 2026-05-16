// web/src/pages/ShotToProfile/buildProfile.js

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
  const firstTemp = segments[0]?.temperature ?? 93;

  return {
    id: crypto.randomUUID(),
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
      temperature: Math.round(seg.temperature),
      pump: {
        target: seg.targetType,
        pressure: seg.targetType === 'pressure' ? seg.targetValue : -1,
        flow: seg.targetType === 'flow' ? seg.targetValue : -1,
      },
      transition: {
        type: 'linear',
        duration: 1.0,
        adaptive: false,
      },
      targets: [],
    })),
  };
}
