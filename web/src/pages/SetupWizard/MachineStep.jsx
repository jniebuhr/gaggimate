import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { MachineProfileControl } from '../../components/MachineProfileControl.jsx';
import {
  currentProfileValues,
  machineBoardName,
  parseProfileSelection,
  profileToForm,
  profileProblems,
  confirmProfileApply,
  waitForMachineHardware,
  PROFILE_FIELDS,
} from '../../utils/machineProfiles.js';
import { useEffect, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { getCachedSettings, updateSettingsCache } from '../../services/ApiService.js';
import { requestSettings } from '../../utils/settingsRequest.js';
import { Spinner } from '../../components/Spinner.jsx';
import { splitPidString } from '../Settings/settingsForm.js';
import { InfoNote } from './InfoNote.jsx';
import { postSettings } from './setupState.js';

export function MachineStep({ onSaved, onDirty, onConfigure }) {
  const { t } = useLingui();
  const [formData, setFormData] = useState(() => {
    const settings = getCachedSettings() || {};
    return { ...settings, ...splitPidString(settings.pid) };
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let timer;
    const refresh = async () => {
      try {
        const settings = await requestSettings({}, 5000);
        if (cancelled) return;
        updateSettingsCache(settings);
        setFormData({ ...settings, ...splitPidString(settings.pid) });
        setLoadError('');
        if (settings.machineProfileBoard) {
          setLoading(false);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message);
      }
      timer = setTimeout(refresh, 1000);
    };
    refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const setFields = values => {
    setFormData(previous => ({ ...previous, ...values }));
    setApplied(false);
    setConfirmation(null);
    onDirty?.();
  };
  const caps = formData.machineProfileCapabilities || {};
  const detectedCapabilities = [
    { label: caps.dualBoiler ? t`Dual boiler` : t`Single boiler`, available: true },
    { label: t`Pressure control`, available: caps.pressure },
    { label: t`Hardware scales`, available: caps.hardwareScale },
    { label: t`Gear pump add-on`, available: caps.gearpumpAddon },
    { label: t`Alba add-on`, available: caps.albaAddon },
  ];
  const [resolvedProfile, setResolvedProfile] = useState(null);
  const selection = parseProfileSelection(formData.machineProfileSelection);
  const profile = selection?.settings
    ? selection
    : resolvedProfile?.id === selection?.id
      ? resolvedProfile
      : null;
  const problems = profile ? profileProblems(profile, formData) : [];
  const apply = async (confirmed = false) => {
    if (loading || !profile || saving || problems.length) return;
    setSaving(true);
    setError('');
    try {
      const appliedData = selection?.settings
        ? formData
        : { ...formData, ...profileToForm(profile) };
      const accepted = await confirmProfileApply(appliedData, changed => {
        if (confirmed && JSON.stringify(changed) === JSON.stringify(confirmation)) return true;
        setConfirmation(changed);
        return false;
      });
      if (!accepted) return;
      setConfirmation(null);
      const values = currentProfileValues(
        appliedData,
        formData.machineProfileCapabilities || {},
        !!formData.machineHardwareConfiguration,
      );
      await postSettings({
        ...values,
        machineProfileSelection: appliedData.machineProfileSelection || '',
      });
      setFormData(appliedData);
      updateSettingsCache(await waitForMachineHardware());
      setApplied(true);
      onSaved?.(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className='space-y-4'>
      <p className='text-sm opacity-70'>
        <Trans>Select your machine and apply recommended defaults.</Trans>
      </p>
      <MachineProfileControl
        formData={formData}
        setFields={setFields}
        onProfileResolved={setResolvedProfile}
        wizard
        disabled={saving || loading}
      />
      <button
        type='button'
        className='link link-primary text-left text-sm'
        disabled={saving}
        onClick={onConfigure}
      >
        <Trans>Machine not listed? Continue setup and configure it later.</Trans>
      </button>
      {loading && (
        <div role='status' className='flex items-center gap-2 text-sm opacity-70'>
          <Spinner size={4} />
          <Trans>Waiting for controller configuration…</Trans>
        </div>
      )}
      {loadError && (
        <p role='alert' className='text-error'>
          {loadError}
        </p>
      )}
      {error && (
        <InfoNote tone='error' title={t`Saving failed`}>
          {error}
        </InfoNote>
      )}
      {applied && <InfoNote tone='success' title={t`Machine settings saved`} />}
      {confirmation && (
        <InfoNote tone='warning' title={t`Replace these machine settings?`}>
          <ul className='list-inside list-disc'>
            {confirmation.map(([key, value]) => (
              <li key={key}>
                {PROFILE_FIELDS[key].label}: {String(value)}
              </li>
            ))}
          </ul>
          <div className='mt-3 flex justify-end gap-2'>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={saving}
              onClick={() => setConfirmation(null)}
            >
              <Trans>Cancel</Trans>
            </button>
            <button
              type='button'
              className='btn btn-primary'
              disabled={saving}
              onClick={() => apply(true)}
            >
              <Trans>Apply Preset</Trans>
            </button>
          </div>
        </InfoNote>
      )}
      <div className='flex justify-end'>
        <button
          type='button'
          className='btn btn-primary'
          disabled={loading || saving || !!confirmation || !profile || problems.length > 0}
          onClick={() => apply()}
        >
          {saving && (
            <>
              <Spinner size={4} />
              <Trans>Applying and waiting for controller…</Trans>
            </>
          )}
          {!saving && <Trans>Apply Preset</Trans>}
        </button>
      </div>
      {!loading && formData.machineProfileBoard && (
        <div className='border-base-content/10 space-y-2 border-t pt-4 text-sm'>
          <p className='font-medium'>
            <Trans>Detected board</Trans>: {machineBoardName(formData.machineProfileBoard, caps)}
          </p>
          <ul className='grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2'>
            {detectedCapabilities.map(({ label, available }) => (
              <li
                key={label}
                className={`flex items-center gap-2 ${available ? '' : 'opacity-40'}`}
              >
                <FontAwesomeIcon
                  icon={available ? faCheck : faMinus}
                  className={available ? 'text-success' : ''}
                />
                <span>{label}</span>
                <span className='sr-only'>{available ? t`Available` : t`Not detected`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
