import './style.css';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';

export function Scales() {
  const [key, setKey] = useState(0);
  const [intervalHandle, setIntervalHandle] = useState(0);
  const [scaleData, setScaleData] = useState([]);
  useEffect(() => {
    setIntervalHandle(setInterval(() => {
      setKey(Date.now().valueOf());
    }, 10000));
  }, [setIntervalHandle]);
  const {
    isLoading,
    isError,
    error,
    data: fetchedScales = [],
  } = useQuery(`scales-${key}`, async () => {
    const response = await fetch(`/api/scales/list`);
    const data = await response.json();
    return data;
  });
  const {
    isInfoLoading,
    isInfoError,
    infoError,
    data: connectedScale = [],
  } = useQuery(`scale-info-${key}`, async () => {
    const response = await fetch(`/api/scales/info`);
    const data = await response.json();
    return data;
  });

  useEffect(() => {
    if (!connectedScale || fetchedScales.length === 0) {
      return;
    }
    const scales = connectedScale.connected ? [connectedScale] : fetchedScales;
    setScaleData(scales);
  }, [connectedScale, fetchedScales]);

  const onScan = useCallback(async() => {
    const response = await fetch('/api/scales/scan', {
      method: 'post',
    });
    const data = await response.json();
  }, []);

  const onConnect = useCallback(async(uuid) => {
    const data = new FormData();
    data.append('uuid', uuid);
    const response = await fetch('/api/scales/connect', {
      method: 'post',
      body: data
    });
    const json = await response.json();
  }, []);

  return (
    <>
      <h2 className="text-3xl font-semibold mb-4 text-[#333333]">Bluetooth Scales</h2>
      <div
          className="flex flex-col gap-4 w-full max-w-md border-b border-[#CCCCCC] pb-4"
      >

        {scaleData.length === 0 && (
            <div className="max-w-md border-gray-200 border-y text-gray-500 text-center py-8 flex flex-row items-center justify-center gap-4">
              Scanning for scales <Spinner size={4} />
            </div>
        )}
        {scaleData.length > 0 && (
            <ul className="max-w-md divide-y divide-gray-200 dark:divide-gray-700 border-gray-200 border-y pt-3 sm:pt-4">
              {scaleData.map((scale, i) => (
                  <li key={i} className="pb-3 sm:pb-4">
                    <div className="flex items-center space-x-4 rtl:space-x-reverse">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
                          {scale.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate dark:text-gray-400">
                          {scale.uuid}
                        </p>
                      </div>
                      <div className="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white">
                        {scale.connected && (
                            <div className="rounded-full bg-gray-50 border border-gray-300 p-4 text-green-600">
                              <svg width={20} height={20} xmlns="http://www.w3.org/2000/svg"
                                   viewBox="0 0 448 512">
                                <path
                                    fill="currentColor"
                                    d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
                              </svg>
                            </div>
                        )}
                        {!scale.connected && (
                            <button type="submit" className="menu-button-sm" onClick={onConnect.bind(null, scale.uuid)}>
                              Connect
                            </button>
                        )}
                      </div>
                    </div>
                  </li>
              ))}
            </ul>
        )}

        <div className="flex justify-center mt-6 flex-row gap-1">
          <a href="/" className="menu-button">
            Back
          </a>
          <button type="submit" className="menu-button" onClick={onScan}>
            Scan
          </button>
        </div>
      </div>
    </>
  );
}