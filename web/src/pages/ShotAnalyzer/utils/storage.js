import { ANALYZER_DB_KEYS } from './constants';

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

function getSortValue(item, sortKey) {
  if (sortKey === 'data.rating') return item.data?.rating || 0;
  if (sortKey === 'duration') return Number.parseFloat(item.duration || 0);
  return item[sortKey] ?? '';
}

export const getSortedLibrary = (collectionKey, options = {}) => {
  const { search = '', sortKey = 'shotDate', sortOrder = 'desc' } = options;
  const raw = loadFromStorage(collectionKey, []);
  const orderMult = sortOrder === 'asc' ? 1 : -1;

  let items = raw;
  if (search) {
    const searchLower = search.toLowerCase();
    items = raw.filter(item => {
      const name = (item.name || '').toLowerCase();
      const profile = (item.profileName || '').toLowerCase();
      return name.includes(searchLower) || profile.includes(searchLower);
    });
  }

  return items.sort((a, b) => {
    let valA = getSortValue(a, sortKey);
    let valB = getSortValue(b, sortKey);

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return -1 * orderMult;
    if (valA > valB) return 1 * orderMult;
    return 0;
  });
};

export const saveToLibrary = (collection, fileName, data) => {
  const library = loadFromStorage(collection, []);
  const displayName =
    collection === ANALYZER_DB_KEYS.PROFILES && data.label ? data.label : fileName;

  const existingIndex = library.findIndex(item => item.name === displayName);

  const entry = {
    name: displayName,
    fileName,
    saveDate: Date.now(),
    shotDate: data.timestamp ? data.timestamp * 1000 : Date.now(),
    profileName: data.profile || 'Manual/Unknown',
    duration: data.samples?.length
      ? ((data.samples[data.samples.length - 1].t - data.samples[0].t) / 1000).toFixed(1)
      : 0,
    data,
  };

  if (existingIndex > -1) {
    library[existingIndex] = entry;
  } else {
    library.push(entry);
  }

  saveToStorage(collection, library);
};

export const deleteFromLibrary = (collection, name) => {
  const library = loadFromStorage(collection, []);
  const filtered = library.filter(i => i.name !== name);
  saveToStorage(collection, filtered);
};

export const clearLibrary = collection => {
  saveToStorage(collection, []);
};
