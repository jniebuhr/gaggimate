export const saveToStorage = (key, value, storage = localStorage) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save "${key}" to localStorage:`, e);
  }
};

export const loadFromStorage = (key, defaultValue = null, storage = localStorage) => {
  try {
    const item = storage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Failed to load "${key}" from localStorage:`, e);
    return defaultValue;
  }
};
