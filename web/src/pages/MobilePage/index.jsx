import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';

const status = computed(() => machine.value.status);

// SVG icons styled after the circular display's white-on-dark icon set
function BrewIcon({ active }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
      {/* Cup body */}
      <path d="M10 20h28l-3 16H13L10 20z" />
      {/* Handle */}
      <path d="M38 24h4a4 4 0 010 8h-4" />
      {/* Saucer */}
      <line x1="7" y1="38" x2="41" y2="38" />
      {/* Steam curls */}
      <path d="M18 14 Q20 10 18 6" strokeWidth="2" />
      <path d="M24 14 Q26 10 24 6" strokeWidth="2" />
      <path d="M30 14 Q32 10 30 6" strokeWidth="2" />
    </svg>
  );
}

function SteamIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
      {/* Three wavy vertical lines */}
      <path d="M14 38 Q17 30 14 22 Q11 14 14 6" />
      <path d="M24 38 Q27 30 24 22 Q21 14 24 6" />
      <path d="M34 38 Q37 30 34 22 Q31 14 34 6" />
    </svg>
  );
}

function WaterIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
      {/* Three water drops */}
      <path d="M14 18 Q14 8 8 8 Q2 8 2 18 Q2 24 8 26 Q14 24 14 18z" transform="translate(6 8)" />
      <path d="M14 18 Q14 8 8 8 Q2 8 2 18 Q2 24 8 26 Q14 24 14 18z" transform="translate(20 8)" />
      <path d="M14 18 Q14 8 8 8 Q2 8 2 18 Q2 24 8 26 Q14 24 14 18z" transform="translate(13 -6)" />
    </svg>
  );
}

function GrindIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
      {/* Coffee bean: oval with curved split line */}
      <ellipse cx="24" cy="24" rx="16" ry="20" transform="rotate(-20 24 24)" />
      <path d="M14 14 Q20 24 26 34" transform="rotate(-20 24 24) translate(2 0)" />
    </svg>
  );
}

function StandbyIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
      <path d="M24 8 L24 24" />
      <path d="M16 12 A14 14 0 1 0 32 12" />
    </svg>
  );
}

const zeroPad = (n, p) => String(n).padStart(p, '0');
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${zeroPad(Math.floor(s / 60), 1)}:${zeroPad(s % 60, 2)}`;
}

const MODES = [
  { id: 1, label: 'Brew', Icon: BrewIcon },
  { id: 2, label: 'Steam', Icon: SteamIcon },
  { id: 3, label: 'Water', Icon: WaterIcon },
  { id: 4, label: 'Grind', Icon: GrindIcon },
];

const MODE_NAMES = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];

export function MobilePage() {
  const apiService = useContext(ApiServiceContext);
  const s = status.value;
  const mode = s.mode ?? 0;
  const processInfo = s.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo?.e && !active;
  const brew = mode === 1;
  const canActivate = mode === 1 || mode === 3 || mode === 4;

  const currentTemp = s.currentTemperature ?? 0;
  const targetTemp = s.targetTemperature ?? 0;
  const currentPressure = s.currentPressure ?? 0;
  const targetPressure = s.targetPressure ?? 0;

  // Gauge fill percentages
  const tempPct = Math.min(100, Math.max(0, (currentTemp / 140) * 100));
  const pressPct = Math.min(100, Math.max(0, (currentPressure / 12) * 100));

  const changeMode = useCallback(
    newMode => apiService.send({ tp: 'req:change-mode', mode: newMode }),
    [apiService],
  );
  const activate = useCallback(
    () => apiService.send({ tp: 'req:process:activate' }),
    [apiService],
  );
  const deactivate = useCallback(
    () => apiService.send({ tp: 'req:process:deactivate' }),
    [apiService],
  );
  const clear = useCallback(
    () => apiService.send({ tp: 'req:process:clear' }),
    [apiService],
  );

  const handleAction = () => {
    if (active) deactivate();
    else if (finished) clear();
    else activate();
  };

  const actionIcon = active ? faPause : finished ? faCheck : faPlay;
  const actionColor = active ? '#ef4444' : finished ? '#22c55e' : '#3b82f6';
  const actionBg = active ? '#450a0a' : finished ? '#052e16' : '#0c1a3d';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#080808',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* ── Top bar: readings ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px 8px',
          background: '#0f0f0f',
          borderBottom: '1px solid #1f1f1f',
          flexShrink: 0,
        }}
      >
        {/* Temperature */}
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#f87171', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
            {currentTemp.toFixed(1)}°C
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            → {targetTemp}°C
          </div>
        </div>

        {/* Mode name */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#6b7280' }}>
            {MODE_NAMES[mode] ?? 'Unknown'}
          </div>
          {s.selectedProfile && (mode === 1) && (
            <div style={{ fontSize: 12, color: '#d1d5db', marginTop: 2, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.selectedProfile}
            </div>
          )}
        </div>

        {/* Pressure */}
        <div style={{ lineHeight: 1.1, textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#60a5fa', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
            {currentPressure.toFixed(1)} bar
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            → {targetPressure.toFixed(1)} bar
          </div>
        </div>
      </div>

      {/* ── Middle row: side gauges + content ─────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left gauge: Temperature (red) */}
        <div
          style={{
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            background: '#0d0d0d',
            borderRight: '1px solid #1a1a1a',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: '#f87171', letterSpacing: '0.1em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginBottom: 6 }}>
            {Math.round(currentTemp)}°C
          </span>
          <div
            style={{
              flex: 1,
              width: 12,
              background: '#1a1a1a',
              borderRadius: 6,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${tempPct}%`,
                background: 'linear-gradient(to top, #ef4444, #f97316)',
                borderRadius: 6,
                transition: 'height 0.6s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: '#6b7280', marginTop: 6 }}>0°</span>
        </div>

        {/* Center content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 12px 8px',
            overflow: 'hidden',
          }}
        >
          {/* 2×2 mode buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              flex: 1,
            }}
          >
            {MODES.map(({ id, label, Icon }) => {
              const isActive = mode === id;
              return (
                <button
                  key={id}
                  onClick={() => changeMode(id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? '#111d2e' : '#131313',
                    border: `2px solid ${isActive ? '#3b82f6' : '#222'}`,
                    borderRadius: 20,
                    color: isActive ? '#ffffff' : '#6b7280',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    padding: '12px 8px',
                    gap: 8,
                  }}
                >
                  <Icon active={isActive} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Process info (when brewing/active) */}
          {(active || finished) && brew && processInfo && (
            <div
              style={{
                marginTop: 10,
                background: '#111',
                borderRadius: 12,
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.1em' }}>
                  {processInfo.s === 'brew' ? 'BREWING' : 'PREINFUSION'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{processInfo.l}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#6b7280' }}>Elapsed</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatDuration(processInfo.e ?? 0)}</div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {active && processInfo && processInfo.pt > 0 && (
            <div
              style={{
                height: 4,
                background: '#222',
                borderRadius: 2,
                marginTop: 6,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (processInfo.pp / processInfo.pt) * 100)}%`,
                  background: '#3b82f6',
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          )}
        </div>

        {/* Right gauge: Pressure (blue) */}
        <div
          style={{
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            background: '#0d0d0d',
            borderLeft: '1px solid #1a1a1a',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: '#60a5fa', letterSpacing: '0.1em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginBottom: 6 }}>
            {currentPressure.toFixed(1)}
          </span>
          <div
            style={{
              flex: 1,
              width: 12,
              background: '#1a1a1a',
              borderRadius: 6,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${pressPct}%`,
                background: 'linear-gradient(to top, #2563eb, #60a5fa)',
                borderRadius: 6,
                transition: 'height 0.6s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: '#6b7280', marginTop: 6 }}>0</span>
        </div>
      </div>

      {/* ── Bottom: action button ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 16px 20px',
          background: '#0f0f0f',
          borderTop: '1px solid #1f1f1f',
          flexShrink: 0,
          gap: 6,
        }}
      >
        {canActivate ? (
          <button
            onClick={handleAction}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: actionBg,
              border: `3px solid ${actionColor}`,
              color: actionColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FontAwesomeIcon icon={actionIcon} />
          </button>
        ) : (
          <div style={{ height: 72, display: 'flex', alignItems: 'center', color: '#4b5563', fontSize: 13 }}>
            {mode === 0 ? 'Machine is ready' : mode === 2 ? (
              Math.abs(targetTemp - currentTemp) < 5 ? 'Steam ready' : 'Preheating…'
            ) : ''}
          </div>
        )}

        {/* Connection indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#374151', fontSize: 11 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: machine.value.connected ? '#22c55e' : '#ef4444',
            }}
          />
          {machine.value.connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
}
