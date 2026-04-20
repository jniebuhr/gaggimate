import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';

export function MatterCard() {
  const [info, setInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/matter/info', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => setInfo(data))
      .catch(e => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!info?.qrPayload) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(info.qrPayload, { width: 256, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(e => setError(e.message || String(e)));
  }, [info?.qrPayload]);

  const renderBody = () => {
    if (loading) {
      return <p className='text-sm opacity-70'>Loading…</p>;
    }
    if (error) {
      return (
        <p className='text-sm text-error'>
          Failed to load Matter info: {error}
        </p>
      );
    }
    if (!info?.started) {
      return (
        <p className='text-sm opacity-70'>
          Matter stack is not running yet. Connect the device to Wi-Fi (non-AP mode) and reload.
        </p>
      );
    }
    if (info.commissioned) {
      return (
        <div className='space-y-2'>
          <p className='text-sm'>
            Device is commissioned on {info.fabricCount} fabric{info.fabricCount === 1 ? '' : 's'}.
          </p>
          <p className='text-sm opacity-70'>
            Re-commissioning requires decommissioning from every controller first (remove the
            accessory in Apple Home / Google Home / etc.). On the next boot the commissioning window
            will reopen and this pane will show the QR code again.
          </p>
        </div>
      );
    }
    return (
      <div className='flex flex-col items-center justify-center gap-4'>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt='Matter commissioning QR code'
            className='bg-white p-2'
            width={256}
            height={256}
          />
        ) : (
          <p className='text-sm opacity-70'>Generating QR code…</p>
        )}
        <div className='text-center'>
          <p className='text-sm opacity-70'>Manual pairing code</p>
          <p className='font-mono text-lg'>{formatManualCode(info.manualCode)}</p>
        </div>
        <p className='text-center text-sm opacity-70'>
          Open the Home app (Apple Home, Google Home, Alexa, SmartThings, etc.), choose Add
          Accessory, and scan the QR or enter the manual code. Make sure your phone is on the
          same Wi-Fi network as this device.
        </p>
        {info.vendorId && info.productId ? (
          <p className='text-xs opacity-50'>
            VID 0x{info.vendorId.toString(16).toUpperCase().padStart(4, '0')} · PID 0x
            {info.productId.toString(16).toUpperCase().padStart(4, '0')} · Discriminator{' '}
            {info.discriminator}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className='bg-base-200 rounded-lg p-4'>
      <div className='flex items-center justify-between'>
        <span className='text-xl font-medium'>Matter</span>
        <button
          type='button'
          className='btn btn-ghost btn-xs'
          onClick={load}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      <div className='border-base-300 mt-4 border-t pt-4'>{renderBody()}</div>
    </div>
  );
}

// Matter manual pairing codes are 11 digits; render as "XXXX-XXX-XXXX" for legibility.
function formatManualCode(code) {
  if (!code || code.length !== 11) return code || '';
  return `${code.slice(0, 4)}-${code.slice(4, 7)}-${code.slice(7)}`;
}
