// Matches the system profile IDs in ProfileManager.h; these are seeded by the firmware and cannot be deleted.
export const SYSTEM_PROFILE_IDS = ['flush', 'descale'];

export const isSystemProfile = id => SYSTEM_PROFILE_IDS.includes(id);
