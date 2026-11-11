// Save only the changed Smart Dose setting; other Settings edits remain drafts.
export async function saveSmartDoseSetting(key, value, fetcher = fetch) {
  if (
    ![
      'smartDoseActive',
      'smartDoseAutomagic',
      'smartDoseScale',
      'manualDoseScale',
      'dosingCupEnabled',
      'portafilterEnabled',
      'portafilterScale',
      'smartDoseMode',
    ].includes(key)
  ) {
    throw new Error('Unknown Smart Dose setting');
  }
  const body = new FormData();
  body.append(key, String(value));
  const response = await fetcher('/api/settings', { method: 'POST', body });
  if (!response.ok) throw new Error('Save failed');
  const settings = await response.json();
  if (settings[key] !== value) throw new Error('Setting was not saved');
  return settings;
}

// Match the coordinator's configuration rules. Derive from saved settings so
// availability updates after autosave even with the plugin disabled or offline.
export function smartDoseModes(settings, hardwareSupported = true) {
  const cup = Number(settings.dosingCupWeight || 0);
  const pf = Number(settings.portafilterWeight || 0);
  const cupHardware = hardwareSupported && settings.smartDoseScale === 'hardware';
  const pfHardware = hardwareSupported && settings.portafilterScale === 'hardware';
  const cupConfigured =
    (settings.dosingCupEnabled ?? true) &&
    Number.isFinite(cup) &&
    cup > 0 &&
    cup <= 2000 &&
    (!cupHardware || hardwareSupported);
  const portafilterConfigured =
    (settings.portafilterEnabled ?? true) &&
    Number.isFinite(pf) &&
    pf > 0 &&
    pf <= 2000 &&
    (!pfHardware || hardwareSupported);
  const automaticAvailable =
    cupConfigured &&
    portafilterConfigured &&
    (cupHardware !== pfHardware || (cup < pf && cup + 1.2 < pf + 5 - 0.2));
  const allowed = {
    cup: cupConfigured,
    portafilter: portafilterConfigured,
    automatic: automaticAvailable,
  };
  const preference = settings.smartDoseMode || '';
  const mode =
    ['cup', 'automatic', 'portafilter'].includes(preference) && allowed[preference]
      ? preference
      : automaticAvailable
        ? 'automatic'
        : cupConfigured
          ? 'cup'
          : portafilterConfigured
            ? 'portafilter'
            : 'none';
  return { mode, cupConfigured, portafilterConfigured, automaticAvailable };
}
