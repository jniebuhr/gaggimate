import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons/faRotateRight';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { requestSettings, requestJson } from '../utils/settingsRequest.js';
import { Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { downloadJson } from '../utils/download.js';
import { machine } from '../services/ApiService.js';
import {
  MACHINE_PROFILES,
  MAX_PROFILE_BYTES,
  normalizeProfile,
  parseProfileSelection,
  profileProblems,
  profileToForm,
  currentProfileValues,
  changedProfileValues,
  profileSupported,
  PROFILE_FIELDS,
} from '../utils/machineProfiles.js';

// The wizard and Machine tab deliberately share the same catalog and import/apply behavior.
export function MachineProfileControl({
  formData,
  setFields,
  wizard = false,
  disabled = false,
  onProfileResolved,
}) {
  const { t } = useLingui();
  const fileInput = useRef();
  const [activeId, setActiveId] = useState(null);
  const refreshActive = () =>
    requestSettings()
      .then(saved => {
        setActiveId(parseProfileSelection(saved.machineProfileSelection)?.id || '');
      })
      .catch(() => setActiveId(null));
  useEffect(() => {
    refreshActive();
  }, [formData.machineProfileSelection]);
  const [error, setError] = useState('');
  const [imported, setImported] = useState([]);
  const [definitionHashes, setDefinitionHashes] = useState({});
  const updateCatalog = useCallback(profiles => {
    if (!Array.isArray(profiles)) throw new Error('Invalid machine profile library response.');
    setDefinitionHashes(Object.fromEntries(profiles.map(profile => [profile.id, profile.hash])));
    setImported(
      profiles.filter(profile => !MACHINE_PROFILES.some(builtin => builtin.id === profile.id)),
    );
  }, []);
  const [busy, setBusy] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [libraryReload, setLibraryReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoadingLibrary(true);
    setLibraryError('');
    requestJson('/api/machine-profiles')
      .then(profiles => {
        if (!cancelled) updateCatalog(profiles);
      })
      .catch(err => {
        if (!cancelled) setLibraryError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingLibrary(false);
      });
    return () => {
      cancelled = true;
    };
  }, [updateCatalog, libraryReload]);
  const selection = useMemo(
    () => parseProfileSelection(formData.machineProfileSelection),
    [formData.machineProfileSelection],
  );
  const [resolvedImport, setResolvedImport] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const selected = parseProfileSelection(formData.machineProfileSelection);
    setProfileMissing(false);
    if (!selected || selected.settings || MACHINE_PROFILES.some(p => p.id === selected.id)) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    requestJson(`/api/machine-profiles?id=${encodeURIComponent(selected.id)}`)
      .then(profile => {
        if (!cancelled) setResolvedImport(normalizeProfile(profile));
      })
      .catch(() => {
        if (!cancelled) setProfileMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.machineProfileSelection, imported]);
  const selected = selection?.settings
    ? selection
    : MACHINE_PROFILES.find(p => p.id === selection?.id) ||
      (resolvedImport?.id === selection?.id ? resolvedImport : null);
  useEffect(() => {
    onProfileResolved?.(selected);
  }, [selected, onProfileResolved]);
  const selectedName = selected?.name || selection?.id;
  const profiles = [...MACHINE_PROFILES, ...imported];
  if (selection && !profiles.some(p => p.id === selection.id))
    profiles.push(selected || { id: selection.id, name: selection.id });
  const controllerKnown = !!(formData.machineProfileBoard || machine.value.hardware);
  const compatibleProfiles = [];
  const incompatibleProfiles = [];
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const profile of profiles) {
    const incompatible =
      controllerKnown && profileProblems(profile, formData, machine.value).length > 0;
    (incompatible ? incompatibleProfiles : compatibleProfiles).push(profile);
  }
  const updated = !!(
    selection?.hash &&
    definitionHashes[selection.id] &&
    selection.hash !== definitionHashes[selection.id]
  );
  const problems = selected ? profileProblems(selected, formData, machine.value) : [];
  const currentValues = currentProfileValues(
    formData,
    formData.machineProfileCapabilities || machine.value.capabilities,
    !!formData.machineHardwareConfiguration,
  );
  const changedKeys = new Set(
    selected ? changedProfileValues(selected, currentValues).map(([key]) => key) : [],
  );
  const modified = selected && problems.length === 0 && !updated && changedKeys.size > 0;
  const formatValue = (key, value) => {
    if (typeof value === 'boolean') return value ? t`Enabled` : t`Disabled`;
    if (key.endsWith('Resistance')) return `${value / 1000} kΩ`;
    if (PROFILE_FIELDS[key]?.label.includes('(°C)')) return `${value} °C`;
    return String(value);
  };

  const selectProfile = async id => {
    setBusy(true);
    try {
      setError('');
      let profile = profiles.find(p => p.id === id);
      if (profile && !profile.settings)
        profile = normalizeProfile(
          await requestJson(`/api/machine-profiles?id=${encodeURIComponent(id)}`),
        );
      const unsupported = Object.fromEntries(
        Object.keys(PROFILE_FIELDS)
          .filter(
            key =>
              !profileSupported(
                key,
                formData.machineProfileCapabilities || {},
                !!formData.machineHardwareConfiguration,
              ),
          )
          .map(key => [key, undefined]),
      );
      setFields({
        ...unsupported,
        ...(profile ? profileToForm(profile) : { machineProfileSelection: '' }),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const importProfile = async event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_PROFILE_BYTES) throw new Error(t`Profile is too large.`);
      const profile = normalizeProfile(JSON.parse(await file.text()));
      if (MACHINE_PROFILES.some(p => p.id === profile.id))
        throw new Error(t`Use a different ID for a customized built-in profile.`);
      if (
        imported.some(p => p.id === profile.id) &&
        !window.confirm(t`Replace this imported profile?`)
      )
        return;
      const body = new URLSearchParams({
        profile: JSON.stringify(profile),
        replace: imported.some(p => p.id === profile.id) ? '1' : '0',
      });
      await requestJson('/api/machine-profiles', { method: 'POST', body });
      updateCatalog(await requestJson('/api/machine-profiles'));
      // Replacing the applied file must not silently prefill its new values.
      if (selection?.id !== profile.id) setFields(profileToForm(profile));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const exportSavedProfile = async () => {
    try {
      const saved = await requestSettings();
      if (saved.machineHardwareReady === false)
        throw new Error(
          t`Wait for the controller to confirm the applied configuration before exporting.`,
        );
      const name = window.prompt(
        t`Name for the exported configuration`,
        selectedName || t`Custom machine`,
      );
      if (!name) return;
      const id = `custom-${Date.now()}`;
      const savedProfile = parseProfileSelection(saved.machineProfileSelection);
      const profile = normalizeProfile({
        schemaVersion: 1,
        id,
        name,
        revision: 1,
        ...(savedProfile?.locks ? { locks: savedProfile.locks } : {}),
        requires: {
          dualBoiler: !!saved.machineProfileCapabilities?.dualBoiler,
          pressure: !!saved.machineProfileCapabilities?.pressure,
        },
        settings: currentProfileValues(
          saved,
          saved.machineProfileCapabilities,
          !!saved.machineHardwareConfiguration,
        ),
      });
      downloadJson(profile, `${id}.json`);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  const canDelete =
    selection &&
    activeId !== null &&
    selection.id !== activeId &&
    imported.some(p => p.id === selection.id) &&
    !MACHINE_PROFILES.some(p => p.id === selection.id);
  const deleteImportedProfile = async () => {
    if (!canDelete || !window.confirm(t`Delete this imported profile?`)) return;
    setBusy(true);
    try {
      await requestJson(`/api/machine-profiles?id=${encodeURIComponent(selection.id)}`, {
        method: 'DELETE',
      });
      setImported(current => current.filter(p => p.id !== selection.id));
      setFields({ machineProfileSelection: '' });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className='space-y-3'>
      <div className='form-control w-full'>
        {!wizard && (
          <span className='label'>
            <Trans>Machine configuration</Trans>
          </span>
        )}
        <div className='flex items-center gap-2'>
          <select
            className='select select-bordered min-w-0 flex-1'
            value={selection?.id || ''}
            disabled={disabled || busy || loadingLibrary}
            onFocus={refreshActive}
            aria-label={wizard ? t`Configuration Preset` : t`Machine configuration`}
            onChange={event => selectProfile(event.currentTarget.value)}
          >
            {wizard ? (
              <option value='' disabled>{t`Select a configuration preset`}</option>
            ) : (
              <option value=''>{t`Custom`}</option>
            )}
            {compatibleProfiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
            {incompatibleProfiles.length > 0 && (
              <optgroup label={t`-- Incompatible --`} className='text-base-content/50'>
                {incompatibleProfiles.map(profile => (
                  <option key={profile.id} value={profile.id} className='text-base-content/50'>
                    {profile.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type='button'
            className='text-primary hover:bg-primary/10 cursor-pointer rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
            title={t`Import configuration`}
            aria-label={t`Import configuration`}
            disabled={disabled || busy || loadingLibrary}
            onClick={() => fileInput.current.click()}
          >
            <FontAwesomeIcon icon={faFileImport} />
          </button>
          {!wizard && (
            <>
              <button
                type='button'
                className='text-base-content/50 hover:text-info hover:bg-info/10 cursor-pointer rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
                title={t`Export saved configuration`}
                aria-label={t`Export saved configuration`}
                disabled={disabled || busy || loadingLibrary}
                onClick={exportSavedProfile}
              >
                <FontAwesomeIcon icon={faFileExport} />
              </button>
              <button
                type='button'
                className='text-error hover:bg-error/10 disabled:text-base-content/30 cursor-pointer rounded-md p-2 transition-colors disabled:cursor-not-allowed'
                title={t`Delete imported profile`}
                aria-label={t`Delete imported profile`}
                disabled={disabled || busy || loadingLibrary || !canDelete}
                onClick={deleteImportedProfile}
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </>
          )}
        </div>
      </div>
      {updated && (
        <div role='status' className='text-warning flex items-center gap-2 text-sm'>
          <span>
            <Trans>Profile has been updated - please reload.</Trans>
          </span>
          <button
            type='button'
            className='hover:bg-warning/10 rounded-md p-1'
            aria-label={t`Reload updated profile`}
            title={t`Reload updated profile`}
            disabled={disabled || busy || loadingProfile}
            onClick={() => selectProfile(selection.id)}
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
        </div>
      )}
      {selection && !selected && !loadingProfile && profileMissing && (
        <p role='status' className='text-warning text-sm'>
          <Trans>
            The applied profile is unavailable. Your saved machine settings are unchanged.
          </Trans>
        </p>
      )}
      {!wizard && (
        <p className='text-sm opacity-70'>
          <Trans>
            Selecting a profile prefills the values. Save to apply. Choose Custom to edit machine
            values.
          </Trans>
        </p>
      )}
      {!wizard && selected && (
        <div className='text-sm'>
          {modified && (
            <div role='status' className='machine-profile-difference flex items-center gap-2'>
              <span>
                <Trans>
                  Settings differ from this profile. Reload to restore profile defaults.
                </Trans>
              </span>
              <button
                type='button'
                className='hover:bg-warning/10 rounded-md p-1'
                aria-label={t`Restore profile defaults`}
                title={t`Restore profile defaults`}
                disabled={disabled || busy || loadingProfile}
                onClick={() => selectProfile(selection.id)}
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
          )}
          <details className='mt-2'>
            <summary>
              <Trans>Profile values</Trans>
            </summary>
            <dl className='grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 pt-2'>
              {Object.entries(selected.settings).map(([key, value]) => {
                const changed = changedKeys.has(key) && currentValues[key] !== undefined;
                return (
                  <Fragment key={key}>
                    <dt>{(PROFILE_FIELDS[key]?.label || key).replace('(Ω)', '(kΩ)')}</dt>
                    <dd className={changed ? 'machine-profile-difference font-medium' : ''}>
                      {formatValue(key, value)}
                      {changed && <> → {formatValue(key, currentValues[key])}</>}
                    </dd>
                  </Fragment>
                );
              })}
            </dl>
          </details>
        </div>
      )}
      {problems.length > 0 && (
        <div role='alert' className='alert alert-warning block'>
          {problems.map(problem => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}
      <input
        ref={fileInput}
        type='file'
        accept='.json,application/json'
        className='hidden'
        onChange={importProfile}
      />
      {error && (
        <p role='alert' className='text-error'>
          {error}
        </p>
      )}
      {libraryError && (
        <div role='alert' className='text-error flex items-center gap-2 text-sm'>
          <span>{libraryError}</span>
          <button
            type='button'
            className='hover:bg-error/10 rounded-md p-1'
            aria-label={t`Retry`}
            title={t`Retry`}
            disabled={disabled || busy || loadingLibrary}
            onClick={() => setLibraryReload(value => value + 1)}
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
        </div>
      )}
    </div>
  );
}
