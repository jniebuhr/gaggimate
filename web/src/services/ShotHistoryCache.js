let cachedShotHistory = null;

export const getCachedShotHistory = () => cachedShotHistory;

export const setCachedShotHistory = history => {
  cachedShotHistory = history;
};

export const clearCachedShotHistory = () => {
  cachedShotHistory = null;
};
