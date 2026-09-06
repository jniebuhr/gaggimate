import { useContext, useEffect, useState } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { activeWarnings, parseWarningStates } from '../../utils/warnings.js';
import { BrewConfirmModal } from './BrewConfirmModal.jsx';

// Shows the brew confirmation whenever the controller asks for it, whichever UI or button started the brew.
// It closes when any UI answers: a cancel event, or the brew actually starting.
export function BrewConfirmHost() {
  const apiService = useContext(ApiServiceContext);
  const [warnings, setWarnings] = useState(null);
  const processActive = !!machine.value.status.process?.a;

  useEffect(() => {
    const confirmId = apiService.on('evt:brew:confirm', m =>
      setWarnings(activeWarnings(parseWarningStates(m.warn))),
    );
    const cancelId = apiService.on('evt:brew:confirm:cancel', () => setWarnings(null));
    return () => {
      apiService.off('evt:brew:confirm', confirmId);
      apiService.off('evt:brew:confirm:cancel', cancelId);
    };
  }, [apiService]);

  useEffect(() => {
    if (processActive) setWarnings(null);
  }, [processActive]);

  if (!warnings) return null;
  return (
    <BrewConfirmModal
      warnings={warnings}
      onBack={() => {
        setWarnings(null);
        apiService.send({ tp: 'req:brew:confirm:cancel' });
      }}
      onIgnore={() => {
        setWarnings(null);
        apiService.send({ tp: 'req:process:activate', ignoreWarnings: true });
      }}
    />
  );
}
