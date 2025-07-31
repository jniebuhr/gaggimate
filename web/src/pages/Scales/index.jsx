import { useState, useEffect, useCallback } from 'preact/hooks';
import { useQuery } from 'preact-fetching';

export function Scales() {
  const [key, setKey] = useState(0);
  const [scaleData, setScaleData] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  
  useEffect(() => {
    const intervalHandle = setInterval(() => {
      setKey(Date.now().valueOf());
    }, 10000);
    
    return () => clearInterval(intervalHandle);
  }, []);
  
  const {
    isLoading,
    isError,
    data: fetchedScales = [],
  } = useQuery(`scales-${key}`, async () => {
    const response = await fetch(`/api/scales/list`);
    const data = await response.json();
    return data;
  });
  
  const {
    isInfoLoading,
    isInfoError,
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

  const onScan = useCallback(async () => {
    setIsScanning(true);
    try {
      await fetch('/api/scales/scan', {
        method: 'post',
      });
      // Refresh the data after scan
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const onConnect = useCallback(async (uuid) => {
    try {
      const data = new FormData();
      data.append('uuid', uuid);
      await fetch('/api/scales/connect', {
        method: 'post',
        body: data,
      });
      // Refresh the data after connection
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-base-content">Bluetooth Scales</h1>
        <p className="text-base-content/70 mt-2">Connect and manage your Bluetooth scales</p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between mb-6">
            <h2 className="card-title">Available Scales</h2>
            <button 
              className={`btn btn-primary ${isScanning ? 'loading' : ''}`}
              onClick={onScan}
              disabled={isScanning}
            >
              {isScanning ? 'Scanning...' : 'Scan for Scales'}
            </button>
          </div>

          {isLoading || isInfoLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
              <span className="ml-3 text-base-content/70">Loading scales...</span>
            </div>
          ) : isError || isInfoError ? (
            <div className="alert alert-error">
              <span>Error loading scales. Please try again.</span>
            </div>
          ) : scaleData.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="text-6xl text-base-content/30">⚖️</div>
                <div>
                  <h3 className="text-lg font-medium text-base-content">No scales found</h3>
                  <p className="text-base-content/70">Click "Scan for Scales" to discover Bluetooth scales nearby</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {scaleData.map((scale, i) => (
                <div key={i} className="card bg-base-200 shadow-sm">
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base-content">{scale.name}</h3>
                        <p className="text-sm text-base-content/60 font-mono">{scale.uuid}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        {scale.connected ? (
                          <div className="badge badge-success gap-2">
                            Connected
                          </div>
                        ) : (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => onConnect(scale.uuid)}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {scaleData.length > 0 && (
        <div className="alert alert-info">
          <span>Scales are automatically refreshed every 10 seconds. Use the scan button to discover new devices.</span>
        </div>
      )}
    </div>
  );
}
