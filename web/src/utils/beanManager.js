const BEANS_STORAGE_KEY = 'gaggimate-beans';
const BEAN_SELECTION_EVENTS_KEY = 'gaggimate-bean-selection-events';
const ACTIVE_BEAN_SELECTION_KEY = 'gaggimate-active-bean-selection';
const LEGACY_BEAN_MIGRATION_KEY = 'gaggimate-beans-migrated';

function normalize(text) {
  return String(text || '')
    .trim()
    .toLowerCase();
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function dispatchBeansChanged(detail = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('beans-library-changed', { detail }));
  }
}

export function parseQuantity(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function normalizeBeanPayload(beanInput = {}) {
  const now = Date.now();
  return {
    id: String(beanInput.id || '').trim(),
    name: String(beanInput.name || '').trim(),
    roaster: String(beanInput.roaster || '').trim(),
    roastLevel: String(beanInput.roastLevel || '').trim(),
    roastDate: String(beanInput.roastDate || '').trim(),
    origin: String(beanInput.origin || '').trim(),
    process: String(beanInput.process || '').trim(),
    notes: String(beanInput.notes || '').trim(),
    quantity: parseQuantity(beanInput.quantity),
    archived: !!beanInput.archived,
    createdAt: Number(beanInput.createdAt) || now,
    updatedAt: Number(beanInput.updatedAt) || now,
  };
}

function sortBeans(beans) {
  return [...beans].sort((a, b) => {
    if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
    if ((b.updatedAt || 0) !== (a.updatedAt || 0)) return (b.updatedAt || 0) - (a.updatedAt || 0);
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function listLegacyBeans() {
  const beans = readJson(BEANS_STORAGE_KEY, []);
  return Array.isArray(beans) ? sortBeans(beans.map(normalizeBeanPayload)) : [];
}

function saveLegacyBeans(beans) {
  writeJson(BEANS_STORAGE_KEY, sortBeans((beans || []).map(normalizeBeanPayload)));
  dispatchBeansChanged(listLegacyBeans());
}

function upsertLegacyBean(bean) {
  const normalizedBean = normalizeBeanPayload(bean);
  const beans = listLegacyBeans();
  const nextBeans = beans.some(existing => existing.id === normalizedBean.id)
    ? beans.map(existing => (existing.id === normalizedBean.id ? { ...existing, ...normalizedBean } : existing))
    : [normalizedBean, ...beans];
  saveLegacyBeans(nextBeans);
  return normalizedBean;
}

function removeLegacyBean(beanId) {
  const nextBeans = listLegacyBeans().filter(bean => bean.id !== beanId);
  saveLegacyBeans(nextBeans);
  return nextBeans;
}

function hasConnectedApi(apiService) {
  return !!(apiService?.socket && apiService.socket.readyState === WebSocket.OPEN);
}

async function requestBeans(apiService, payload) {
  if (!apiService) return null;
  const response = await apiService.request(payload);
  if (response?.error) {
    throw new Error(response.error);
  }
  return response;
}

async function listDeviceBeans(apiService) {
  const response = await requestBeans(apiService, { tp: 'req:beans:list' });
  const beans = Array.isArray(response?.beans) ? response.beans.map(normalizeBeanPayload) : [];
  return sortBeans(beans);
}

export async function migrateLegacyBeansToDevice(apiService) {
  const legacyBeans = listLegacyBeans();
  if (!hasConnectedApi(apiService)) {
    return legacyBeans;
  }

  let deviceBeans;
  try {
    deviceBeans = await listDeviceBeans(apiService);
  } catch {
    return legacyBeans;
  }

  const migrationComplete = readJson(LEGACY_BEAN_MIGRATION_KEY, false);
  const shouldHydrateDevice = legacyBeans.length > 0 && !migrationComplete && deviceBeans.length === 0;

  if (!shouldHydrateDevice) {
    if (!migrationComplete) {
      writeJson(LEGACY_BEAN_MIGRATION_KEY, true);
    }
    return deviceBeans;
  }

  for (const bean of legacyBeans) {
    await saveBean(apiService, bean, { suppressEvent: true, deviceOnly: true });
  }

  writeJson(LEGACY_BEAN_MIGRATION_KEY, true);
  dispatchBeansChanged();

  try {
    return await listDeviceBeans(apiService);
  } catch {
    return legacyBeans;
  }
}

export async function listBeans(apiService) {
  const legacyBeans = listLegacyBeans();
  if (!hasConnectedApi(apiService)) {
    return legacyBeans;
  }

  try {
    return await listDeviceBeans(apiService);
  } catch {
    return legacyBeans;
  }
}

export async function exportBeanData(apiService) {
  return {
    beans: await listBeans(apiService),
    selectionEvents: readJson(BEAN_SELECTION_EVENTS_KEY, []),
    activeSelection: getCurrentBeanSelection(),
  };
}

export async function restoreBeanData(apiService, data) {
  const nextBeans = Array.isArray(data?.beans) ? data.beans.map(normalizeBeanPayload) : [];

  if (apiService) {
    for (const bean of nextBeans) {
      await saveBean(apiService, bean, { suppressEvent: true });
    }
    dispatchBeansChanged();
  } else {
    saveLegacyBeans(nextBeans);
  }

  writeJson(
    BEAN_SELECTION_EVENTS_KEY,
    Array.isArray(data?.selectionEvents) ? data.selectionEvents : [],
  );
  writeJson(ACTIVE_BEAN_SELECTION_KEY, data?.activeSelection || null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bean-selection-changed', { detail: data?.activeSelection || null }),
    );
  }
}

export async function saveBean(apiService, beanInput, options = {}) {
  const bean = normalizeBeanPayload({
    ...beanInput,
    id: beanInput.id || createId('bean'),
    updatedAt: Date.now(),
  });

  if (!bean.name) return null;

  if (!hasConnectedApi(apiService)) {
    return upsertLegacyBean(bean);
  }

  try {
    const response = await requestBeans(apiService, { tp: 'req:beans:save', bean });
    const savedBean = normalizeBeanPayload(response?.bean || bean);
    if (!options.deviceOnly) {
      upsertLegacyBean(savedBean);
    }
    if (!options.suppressEvent) {
      dispatchBeansChanged(savedBean);
    }
    return savedBean;
  } catch (error) {
    if (options.deviceOnly) {
      throw error;
    }
    return upsertLegacyBean(bean);
  }
}

export async function removeBean(apiService, beanId, options = {}) {
  if (!hasConnectedApi(apiService)) {
    const nextBeans = removeLegacyBean(beanId);
    const activeBean = getCurrentBeanSelection();
    if (activeBean?.beanId === beanId) {
      clearCurrentBeanSelection();
    }
    return nextBeans;
  }

  try {
    await requestBeans(apiService, { tp: 'req:beans:delete', id: beanId });
    removeLegacyBean(beanId);
  } catch (error) {
    if (options.deviceOnly) {
      throw error;
    }
    const nextBeans = removeLegacyBean(beanId);
    const activeBean = getCurrentBeanSelection();
    if (activeBean?.beanId === beanId) {
      clearCurrentBeanSelection();
    }
    return nextBeans;
  }

  const activeBean = getCurrentBeanSelection();
  if (activeBean?.beanId === beanId) {
    clearCurrentBeanSelection();
  }
  const beans = await listBeans(apiService);
  if (!options.suppressEvent) {
    dispatchBeansChanged(beans);
  }
  return beans;
}

export async function syncBeanUsageFromNotes(apiService, previousNotes, nextNotes) {
  if (!apiService) return null;

  const beans = await listBeans(apiService);
  const previousDose = parseQuantity(previousNotes?.doseIn) || 0;
  const nextDose = parseQuantity(nextNotes?.doseIn) || 0;

  const resolveBean = notes => {
    const beanId = String(notes?.beanId || '').trim();
    const beanType = normalize(notes?.beanType);
    if (beanId) {
      return beans.find(bean => bean.id === beanId) || null;
    }
    if (!beanType) return null;
    return beans.find(bean => normalize(bean.name) === beanType) || null;
  };

  const previousBean = resolveBean(previousNotes);
  const nextBean = resolveBean(nextNotes);

  const updates = new Map();

  const queueAdjustment = (bean, delta) => {
    if (!bean || !Number.isFinite(delta) || delta === 0) return;
    const current = updates.get(bean.id) || { ...bean };
    const currentQuantity = parseQuantity(current.quantity);
    if (currentQuantity === null) return;
    current.quantity = Math.max(0, Math.round((currentQuantity + delta + Number.EPSILON) * 100) / 100);
    updates.set(bean.id, current);
  };

  if (previousBean?.id && nextBean?.id && previousBean.id === nextBean.id) {
    queueAdjustment(nextBean, previousDose - nextDose);
  } else {
    queueAdjustment(previousBean, previousDose);
    queueAdjustment(nextBean, -nextDose);
  }

  for (const bean of updates.values()) {
    await saveBean(apiService, bean, { suppressEvent: true });
  }

  if (updates.size > 0) {
    dispatchBeansChanged();
  }

  return nextBean || null;
}

export function getLastBeanSelectionForProfile(profile) {
  const profileId = String(profile?.id || profile?.profileId || '');
  const profileName = normalize(profile?.label || profile?.name || profile?.profileLabel || '');
  const events = readJson(BEAN_SELECTION_EVENTS_KEY, []);

  return events
    .filter(event => {
      if (profileId && String(event.profileId || '') === profileId) return true;
      return profileName && normalize(event.profileLabel) === profileName;
    })
    .sort((a, b) => Number(b.selectedAtMs || 0) - Number(a.selectedAtMs || 0))[0];
}

export function recordBeanSelection({ profileId, profileLabel, bean }) {
  if (!bean?.id || !bean?.name) return null;

  const events = readJson(BEAN_SELECTION_EVENTS_KEY, []);
  const nextEvent = {
    id: createId('bean-selection'),
    profileId: String(profileId || ''),
    profileLabel: String(profileLabel || ''),
    beanId: bean.id,
    beanName: bean.name,
    beanRoaster: bean.roaster || '',
    beanOrigin: bean.origin || '',
    beanProcess: bean.process || '',
    selectedAtMs: Date.now(),
  };

  const nextEvents = [nextEvent, ...events].slice(0, 500);
  writeJson(BEAN_SELECTION_EVENTS_KEY, nextEvents);
  writeJson(ACTIVE_BEAN_SELECTION_KEY, nextEvent);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bean-selection-changed', { detail: nextEvent }));
  }
  return nextEvent;
}

export function getCurrentBeanSelection() {
  return readJson(ACTIVE_BEAN_SELECTION_KEY, null);
}

export function clearCurrentBeanSelection() {
  writeJson(ACTIVE_BEAN_SELECTION_KEY, null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bean-selection-changed', { detail: null }));
  }
}

function resolveSelectionEventForShot(shot) {
  const events = readJson(BEAN_SELECTION_EVENTS_KEY, []);
  const shotProfile = normalize(shot?.profile || shot?.profileName || '');
  const shotTimestampMs = Number(shot?.timestamp || 0) * 1000;

  if (!shotProfile || !Number.isFinite(shotTimestampMs) || shotTimestampMs <= 0) {
    return null;
  }

  return (
    events
      .filter(event => normalize(event.profileLabel) === shotProfile)
      .filter(event => Number(event.selectedAtMs || 0) <= shotTimestampMs)
      .sort((a, b) => Number(b.selectedAtMs || 0) - Number(a.selectedAtMs || 0))[0] || null
  );
}

export function inferBeanForShot(shot) {
  if (shot?.beanName) return shot.beanName;
  if (shot?.beanType) return shot.beanType;
  if (shot?.notes?.beanType) return shot.notes.beanType;
  return resolveSelectionEventForShot(shot)?.beanName || '';
}

export function inferBeanIdForShot(shot) {
  if (shot?.beanId) return shot.beanId;
  if (shot?.notes?.beanId) return shot.notes.beanId;
  return resolveSelectionEventForShot(shot)?.beanId || '';
}
