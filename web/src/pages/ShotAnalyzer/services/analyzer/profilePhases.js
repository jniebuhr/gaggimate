/** Resolve recorded phase identities once, before target and skip analysis. */
const normalizeName = name =>
  String(name || '')
    .trim()
    .toLowerCase();

export function resolveProfilePhaseIndices(phaseNumbers, phaseNameMap, profileData) {
  const profilePhases = profileData?.phases || [];
  const matches = new Map();
  // A recorded index is usable only when its name agrees with this profile.
  for (const number of phaseNumbers) {
    const name = normalizeName(phaseNameMap.get(number) ?? phaseNameMap.get(Number(number)));
    const index = Number(number);
    if (
      Number.isInteger(index) &&
      profilePhases[index] &&
      name &&
      normalizeName(profilePhases[index].name) === name
    ) {
      matches.set(number, index);
    }
  }
  let previousIndex = -1;
  for (let position = 0; position < phaseNumbers.length; position++) {
    const number = phaseNumbers[position];
    const indexedMatch = matches.get(number);
    if (indexedMatch !== undefined) {
      previousIndex = indexedMatch;
      continue;
    }
    const nextNumber = phaseNumbers.slice(position + 1).find(value => matches.has(value));
    const nextIndex = nextNumber === undefined ? profilePhases.length : matches.get(nextNumber);
    const name = normalizeName(phaseNameMap.get(number) ?? phaseNameMap.get(Number(number)));
    const candidates = profilePhases
      .map((phase, index) => ({ phase, index }))
      .filter(
        ({ phase, index }) =>
          index > previousIndex && index < nextIndex && name && normalizeName(phase.name) === name,
      );
    // Repeated names without a reliable recorded index remain unmatched.
    if (candidates.length === 1) {
      matches.set(number, candidates[0].index);
      previousIndex = candidates[0].index;
    }
  }
  return matches;
}

export function getProfilePhaseDisplayName(profileData, profileIndex, fallbackName) {
  if (profileIndex == null) return fallbackName;
  const phase = profileData.phases[profileIndex];
  const repeated =
    profileData.phases.filter(item => normalizeName(item.name) === normalizeName(phase.name))
      .length > 1;
  return repeated ? `${phase.name} · ${profileIndex + 1}` : phase.name;
}
