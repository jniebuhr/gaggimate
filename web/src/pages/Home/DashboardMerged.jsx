// D · Merged design — multi-ring gauge + live extraction graph + recipe targets.
// Ring (top-left) | Recipe + targets (top-right) | Full-width graph (bottom).

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useProcessActions } from '../../hooks/useProcessActions.js';
import { useProfileData } from '../../hooks/useProfileData.js';
import { listBeans, recordBeanSelection, parseQuantity } from '../../utils/beanManager.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';
import PropTypes from 'prop-types';

const DOSE_KEY = 'gaggimate-dose-grams';
const YIELD_KEY = 'gaggimate-target-weight';
const DEFAULT_DOSE = 18.0;
const DEFAULT_YIELD = 36.0;
const MODE_NAMES = ['STANDBY', 'BREW', 'STEAM', 'WATER', 'GRIND'];

const PRESSURE_MAX = 12;
const FLOW_MAX = 6;
const TEMP_MIN = 0;
const TEMP_MAX = 105;
const RING_TOTAL_ARC = 300;
const RING_START_ANGLE = 210;

const status = computed(() => machine.value.status);

// ── SVG ring path helpers ───────────────────────────────────────────────────

function arcPath(cx, cy, r, frac) {
  if (frac <= 0) return '';
  const clamped = Math.min(1, frac);
  const a0 = (RING_START_ANGLE * Math.PI) / 180;
  const a1 = ((RING_START_ANGLE + RING_TOTAL_ARC * clamped) * Math.PI) / 180;
  const large = RING_TOTAL_ARC * clamped > 180 ? 1 : 0;
  const x0 = (cx + r * Math.cos(a0)).toFixed(2);
  const y0 = (cy + r * Math.sin(a0)).toFixed(2);
  const x1 = (cx + r * Math.cos(a1)).toFixed(2);
  const y1 = (cy + r * Math.sin(a1)).toFixed(2);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function trackPath(cx, cy, r) {
  return arcPath(cx, cy, r, 1);
}

function tickPath(cx, cy, r, frac) {
  const a = ((RING_START_ANGLE + RING_TOTAL_ARC * Math.min(1, Math.max(0, frac))) * Math.PI) / 180;
  const x0 = (cx + (r - 6) * Math.cos(a)).toFixed(2);
  const y0 = (cy + (r - 6) * Math.sin(a)).toFixed(2);
  const x1 = (cx + (r + 6) * Math.cos(a)).toFixed(2);
  const y1 = (cy + (r + 6) * Math.sin(a)).toFixed(2);
  return `M ${x0} ${y0} L ${x1} ${y1}`;
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmt(n, dec = 1) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(dec);
}

function fmtTimer(totalSecs) {
  const s = Math.max(0, Math.round(totalSecs));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ModeRail({ active, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {MODE_NAMES.map((name, idx) => (
        <button
          key={name}
          type='button'
          onClick={() => onSelect(idx)}
          style={{
            padding: '5px 9px',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'var(--dm-font-mono)',
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            border: `1px solid ${idx === active ? 'rgba(215,25,33,0.6)' : 'var(--dm-line)'}`,
            background: idx === active ? 'rgba(215,25,33,0.12)' : 'transparent',
            color: idx === active ? 'var(--dm-accent)' : 'var(--dm-fg-dim)',
          }}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

ModeRail.propTypes = { active: PropTypes.number, onSelect: PropTypes.func };

function StatusPill({ ledClass, label, value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span className={`dm-led ${ledClass}`} />
      <span
        style={{
          fontFamily: 'var(--dm-font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'var(--dm-fg-dim)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--dm-font-mono)',
          fontSize: 10,
          color: 'var(--dm-fg)',
          letterSpacing: '0.04em',
        }}
      >
        {value}
      </span>
    </span>
  );
}

StatusPill.propTypes = { ledClass: PropTypes.string, label: PropTypes.string, value: PropTypes.string };

function PhaseChip({ label, isActive, isDone }) {
  return (
    <span
      className={isActive ? 'dm-pulse' : ''}
      style={{
        fontFamily: 'var(--dm-font-mono)',
        fontSize: 9,
        letterSpacing: '0.18em',
        padding: '4px 8px',
        borderRadius: 4,
        border: `1px solid ${isActive ? 'rgba(215,25,33,0.5)' : 'var(--dm-line)'}`,
        background: isActive ? 'rgba(215,25,33,0.10)' : 'transparent',
        color: isActive ? 'var(--dm-accent)' : isDone ? 'var(--dm-fg-dim)' : 'var(--dm-fg-faint)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

PhaseChip.propTypes = { label: PropTypes.string, isActive: PropTypes.bool, isDone: PropTypes.bool };

function TargetBar({ color, label, cur, tgt, unit, frac, tgtFrac }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: 'var(--dm-font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            color,
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 10 }}>
          <span style={{ color: 'var(--dm-fg)' }}>{cur}</span>
          <span style={{ color: 'var(--dm-fg-faint)' }}> / {tgt} {unit}</span>
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 5,
          background: 'var(--dm-bg-3)',
          borderRadius: 3,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${Math.min(100, Math.max(0, frac * 100))}%`,
            background: color,
            borderRadius: 3,
          }}
        />
        {tgtFrac != null && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              left: `${Math.min(100, Math.max(0, tgtFrac * 100))}%`,
              width: 2,
              background: 'var(--dm-fg-dim)',
              borderRadius: 1,
            }}
          />
        )}
      </div>
    </div>
  );
}

TargetBar.propTypes = {
  color: PropTypes.string,
  label: PropTypes.string,
  cur: PropTypes.string,
  tgt: PropTypes.string,
  unit: PropTypes.string,
  frac: PropTypes.number,
  tgtFrac: PropTypes.number,
};

function RingLegend({ color, label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--dm-font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--dm-fg-dim)',
          }}
        >
          {label}
        </span>
      </span>
      <span
        style={{
          fontFamily: 'var(--dm-font-display)',
          fontSize: 13,
          color: 'var(--dm-fg)',
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
}

RingLegend.propTypes = { color: PropTypes.string, label: PropTypes.string, value: PropTypes.string };

// Editable NumBlock: big display number + ± stepper buttons, click-to-type
function EditableNumBlock({ label, value, unit, hint, accent, step, min, max, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const commit = useCallback(
    raw => {
      const parsed = parseQuantity(String(raw).replace(unit, '').trim());
      if (parsed !== null && parsed >= min && parsed <= max) onCommit(parsed);
      setEditing(false);
    },
    [unit, min, max, onCommit]
  );

  const adjust = useCallback(
    delta => {
      const next = Math.round((value + delta + Number.EPSILON) * 100) / 100;
      onCommit(Math.max(min, Math.min(max, next)));
    },
    [value, min, max, onCommit]
  );

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          fontFamily: 'var(--dm-font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'var(--dm-fg-dim)',
          marginBottom: 3,
        }}
      >
        {label}
      </div>

      {editing ? (
        <input
          ref={inputRef}
          type='text'
          defaultValue={value.toFixed(1)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit(e.target.value);
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'ArrowUp') { e.preventDefault(); adjust(step); setEditing(false); }
            if (e.key === 'ArrowDown') { e.preventDefault(); adjust(-step); setEditing(false); }
          }}
          style={{
            width: 72,
            fontFamily: 'var(--dm-font-display)',
            fontSize: 26,
            fontWeight: 700,
            color: accent || 'var(--dm-fg)',
            background: 'var(--dm-bg-2)',
            border: '1px solid var(--dm-accent)',
            borderRadius: 4,
            padding: '2px 4px',
            outline: 'none',
            lineHeight: 1,
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            style={{
              fontFamily: 'var(--dm-font-display)',
              fontSize: 28,
              color: accent || 'var(--dm-fg)',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              cursor: 'text',
              borderBottom: '1px dashed rgba(232,232,232,0.2)',
            }}
          >
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 10, color: 'var(--dm-fg-dim)' }}>
            {unit}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 2 }}>
            <button
              type='button'
              onClick={e => { e.stopPropagation(); adjust(step); }}
              style={stepperBtnStyle}
              aria-label={`Increase ${label}`}
            >
              ▲
            </button>
            <button
              type='button'
              onClick={e => { e.stopPropagation(); adjust(-step); }}
              style={stepperBtnStyle}
              aria-label={`Decrease ${label}`}
            >
              ▼
            </button>
          </div>
        </div>
      )}

      {hint && (
        <div style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 9, color: 'var(--dm-fg-faint)', marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const stepperBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 11,
  padding: 0,
  background: 'var(--dm-bg-3)',
  border: '1px solid var(--dm-line)',
  borderRadius: 2,
  color: 'var(--dm-fg-dim)',
  fontSize: 7,
  cursor: 'pointer',
  lineHeight: 1,
};

EditableNumBlock.propTypes = {
  label: PropTypes.string,
  value: PropTypes.number,
  unit: PropTypes.string,
  hint: PropTypes.string,
  accent: PropTypes.string,
  step: PropTypes.number,
  min: PropTypes.number,
  max: PropTypes.number,
  onCommit: PropTypes.func,
};

// Inline dropdown for profile / bean selection
function SelectDropdown({ label, options, activeId, activeLabel, onSelect, loading, error, onClose }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 50,
        marginTop: 4,
        minWidth: 240,
        background: 'var(--dm-bg-2)',
        border: '1px solid var(--dm-line-strong)',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid var(--dm-line)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--dm-font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--dm-fg-dim)',
          }}
        >
          {label}
        </span>
        <button
          type='button'
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--dm-fg-dim)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            padding: '2px 4px',
          }}
          aria-label='Close'
        >
          ✕
        </button>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {loading ? (
          <div
            style={{
              padding: '14px 12px',
              fontFamily: 'var(--dm-font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--dm-fg-faint)',
            }}
          >
            LOADING...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '14px 12px',
              fontFamily: 'var(--dm-font-mono)',
              fontSize: 9,
              color: 'var(--dm-accent)',
            }}
          >
            {error.toUpperCase()}
          </div>
        ) : options.length === 0 ? (
          <div
            style={{
              padding: '14px 12px',
              fontFamily: 'var(--dm-font-mono)',
              fontSize: 9,
              color: 'var(--dm-fg-faint)',
            }}
          >
            NO OPTIONS
          </div>
        ) : (
          options.map(opt => {
            const isActive = opt.id === activeId || opt.name === activeLabel;
            return (
              <button
                key={opt.id || opt.name}
                type='button'
                onClick={() => onSelect(opt)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '9px 12px',
                  textAlign: 'left',
                  background: isActive ? 'rgba(215,25,33,0.12)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--dm-line)',
                  fontFamily: 'var(--dm-font-mono)',
                  fontSize: 11,
                  color: isActive ? 'var(--dm-accent)' : 'var(--dm-fg)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {isActive && '▸ '}
                {opt.label || opt.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

SelectDropdown.propTypes = {
  label: PropTypes.string,
  options: PropTypes.array,
  activeId: PropTypes.string,
  activeLabel: PropTypes.string,
  onSelect: PropTypes.func,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func,
};

function GraphLegend({ color, label, value, dashed }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--dm-font-mono)',
        fontSize: 9,
        letterSpacing: '0.10em',
      }}
    >
      <span
        style={{
          width: 14,
          height: 0,
          borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span style={{ color: 'var(--dm-fg-dim)' }}>{label}</span>
      {value && <span style={{ color: 'var(--dm-fg)' }}>{value}</span>}
    </span>
  );
}

GraphLegend.propTypes = {
  color: PropTypes.string,
  label: PropTypes.string,
  value: PropTypes.string,
  dashed: PropTypes.bool,
};

// ── Graph SVG ───────────────────────────────────────────────────────────────

const GW = 1200, GH = 240, GP_L = 44, GP_R = 44, GP_T = 12, GP_B = 22;
const G_INNER_W = GW - GP_L - GP_R;
const G_INNER_H = GH - GP_T - GP_B;

// Left axis: pressure 0–12 bar, flow 0–4 g/s (shared scale via normalisation)
function pToY(p) {
  return GP_T + G_INNER_H - (p / 12) * G_INNER_H;
}
function fToY(f) {
  return GP_T + G_INNER_H - (f / 4) * G_INNER_H;
}
// Right axis: temperature 0–110 °C
const TEMP_GRAPH_MAX = 110;
function tempToY(t) {
  return GP_T + G_INNER_H - (Math.max(0, t) / TEMP_GRAPH_MAX) * G_INNER_H;
}

function buildGraphPaths(entries) {
  if (entries.length < 2) return null;

  const first = entries[0].timestamp.getTime();
  const last = entries[entries.length - 1].timestamp.getTime();
  const duration = Math.max(last - first, 1);

  function tToX(t) {
    return GP_L + ((t - first) / duration) * G_INNER_W;
  }

  let pd = '', fd = '', tpd = '', tempd = '';
  let prevHadTarget = false;

  entries.forEach((h, i) => {
    const x = tToX(h.timestamp.getTime()).toFixed(1);
    const cmd = i === 0 ? 'M' : 'L';
    pd    += `${cmd}${x} ${pToY(h.currentPressure || 0).toFixed(1)} `;
    fd    += `${cmd}${x} ${fToY(Math.min(h.currentFlow || 0, 4)).toFixed(1)} `;
    tempd += `${cmd}${x} ${tempToY(h.currentTemperature || 0).toFixed(1)} `;
    if (h.targetPressure > 0) {
      const ty = pToY(h.targetPressure).toFixed(1);
      tpd += `${prevHadTarget ? 'L' : 'M'}${x} ${ty} `;
      prevHadTarget = true;
    } else {
      prevHadTarget = false;
    }
  });

  const curX = tToX(last).toFixed(1);
  const lastEntry = entries[entries.length - 1];
  const curPY = pToY(lastEntry.currentPressure || 0).toFixed(1);

  return { pd, fd, tpd, tempd, curX, curPY };
}

// ── Main component ──────────────────────────────────────────────────────────

export default function DashboardMerged({ navOpen = false, onNavToggle }) {
  const api = useContext(ApiServiceContext);
  const s = status.value;
  const processInfo = s.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo?.e && !active;
  const history = machine.value.history;
  const connected = machine.value.connected;

  const [isFlushing, setIsFlushing] = useState(false);
  const lastProcessTypeRef = useRef(null);
  const isGrind = s.mode === 4;

  const actions = useProcessActions(api, isGrind, setIsFlushing, lastProcessTypeRef);

  const { profileData } = useProfileData(api, s.mode === 1, s.selectedProfileId);

  // Connected scale name
  const [scaleName, setScaleName] = useState(null);
  useEffect(() => {
    if (!s.bluetoothConnected) { setScaleName(null); return; }
    fetch('/api/scales/info')
      .then(r => r.json())
      .then(d => setScaleName(d?.name || null))
      .catch(() => setScaleName(null));
  }, [s.bluetoothConnected]);

  // Dose — localStorage-backed, editable
  const [dose, setDoseState] = useState(() => {
    try { return parseQuantity(localStorage.getItem(DOSE_KEY)) ?? DEFAULT_DOSE; } catch { return DEFAULT_DOSE; }
  });
  const setDose = useCallback(val => {
    const v = Math.max(1, Math.min(50, val));
    setDoseState(v);
    try { localStorage.setItem(DOSE_KEY, String(v)); } catch {}
  }, []);

  // Target yield — localStorage-backed + API
  const [yieldTarget, setYieldState] = useState(() => {
    try { return parseQuantity(localStorage.getItem(YIELD_KEY)) ?? (s.brewTargetVolume || DEFAULT_YIELD); } catch { return DEFAULT_YIELD; }
  });
  const setYield = useCallback(val => {
    const v = Math.max(5, Math.min(120, val));
    setYieldState(v);
    try { localStorage.setItem(YIELD_KEY, String(v)); } catch {}
    try { api.send({ tp: 'req:change-brew-target', target: v }); } catch {}
  }, [api]);

  // Profile dropdown
  const [activeDropdown, setActiveDropdown] = useState(null); // 'profile' | 'bean' | null
  const [profileOptions, setProfileOptions] = useState([]);
  const [beanOptions, setBeanOptions] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingBeans, setLoadingBeans] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [beanError, setBeanError] = useState(null);

  const loadProfiles = useCallback(async () => {
    if (profileOptions.length > 0) return;
    setLoadingProfiles(true); setProfileError(null);
    try {
      const res = await api.request({ tp: 'req:profiles:list' });
      setProfileOptions((res?.profiles || []).filter(p => !p.archived));
    } catch { setProfileError('Failed to load'); }
    finally { setLoadingProfiles(false); }
  }, [api, profileOptions.length]);

  const loadBeans = useCallback(async () => {
    setLoadingBeans(true); setBeanError(null);
    try {
      const beans = await listBeans(api);
      setBeanOptions((beans || []).filter(b => !b.archived));
    } catch { setBeanError('Failed to load'); }
    finally { setLoadingBeans(false); }
  }, [api]);

  const openProfileDropdown = useCallback(() => {
    loadProfiles();
    setActiveDropdown(d => d === 'profile' ? null : 'profile');
  }, [loadProfiles]);

  const openBeanDropdown = useCallback(() => {
    loadBeans();
    setActiveDropdown(d => d === 'bean' ? null : 'bean');
  }, [loadBeans]);

  const handleProfileSelect = useCallback(async opt => {
    try {
      await api.request({ tp: 'req:profiles:select', id: opt.id });
      setActiveDropdown(null);
    } catch { console.error('profile select failed'); }
  }, [api]);

  const handleBeanSelect = useCallback(opt => {
    try {
      api.send({ tp: 'req:beans:select', name: opt.name });
      recordBeanSelection({
        profileId: machine.value.status.selectedProfileId,
        profileLabel: machine.value.status.selectedProfile,
        bean: opt,
      });
      setActiveDropdown(null);
    } catch { console.error('bean select failed'); }
  }, [api]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!activeDropdown) return;
    const handler = () => setActiveDropdown(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeDropdown]);

  // Track brew start time for graph range
  const brewStartRef = useRef(null);
  useEffect(() => {
    if (active && brewStartRef.current === null) {
      brewStartRef.current = new Date();
    } else if (!active && !finished) {
      brewStartRef.current = null;
    }
  }, [active, finished]);

  // Sensor values with safe fallbacks
  const pressure = s.currentPressure || 0;
  const targetPressure = s.targetPressure || 9;
  const flowVal = s.currentFlow || 0;
  const targetFlow = s.targetFlow || 2;
  const tempVal = s.currentTemperature || 0;
  const targetTemp = s.targetTemperature || 93;
  const currentWeight = s.currentWeight || 0;
  const mode = s.mode ?? 0;

  // Target yield/time
  const targetWeight = yieldTarget;
  const targetShotSecs = s.brewTargetDuration > 0
    ? Math.round(s.brewTargetDuration / 1000)
    : 32;

  // Elapsed time
  const elapsedSecs = Math.round((processInfo?.e || 0) / 1000);

  // Current phase label
  const currentPhaseLabel = processInfo?.l?.trim() || null;

  // Phase list from profile (named phases only — no fake fallback)
  const profilePhases = useMemo(() => {
    if (Array.isArray(profileData?.phases) && profileData.phases.length > 0) {
      return profileData.phases.map(p => p.name || 'Phase');
    }
    return [];
  }, [profileData]);

  // Index of current phase in profile list (case-insensitive)
  const currentPhaseIdx = currentPhaseLabel && profilePhases.length > 0
    ? profilePhases.findIndex(p => p.toLowerCase() === currentPhaseLabel.toLowerCase())
    : -1;

  // When no profile phases exist or no name matched, fall back to showing the
  // raw machine label as the only chip (only while active)
  const showFallbackChip = active && currentPhaseLabel && (profilePhases.length === 0 || currentPhaseIdx === -1);

  // Mode selector
  const onModeSelect = useCallback(
    idx => {
      try {
        api.send({ tp: 'req:change-mode', mode: idx });
      } catch {}
    },
    [api]
  );

  // Ring geometry
  const RING_SIZE = 300;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const stroke = 16;
  const gap = stroke + 6;
  const rOuter = RING_SIZE / 2 - stroke / 2 - 4;
  const rMid = rOuter - gap;
  const rInner = rMid - gap;

  // Graph history slice
  const graphHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    if (brewStartRef.current) {
      const start = brewStartRef.current;
      return history.filter(h => h.timestamp >= start);
    }
    const cutoff = new Date(Date.now() - 60000);
    return history.filter(h => h.timestamp >= cutoff);
  }, [history]);

  const graphPaths = useMemo(() => buildGraphPaths(graphHistory), [graphHistory]);

  // Boiler pill: green if stable, amber if heating
  const boilerStable = targetTemp > 0 && tempVal >= targetTemp;
  // Heating: only flash in BREW (1), STEAM (2), WATER (3) — not STANDBY or GRIND
  const isHeating =
    (mode === 1 || mode === 2 || mode === 3) &&
    !active &&
    !finished &&
    targetTemp > 0 &&
    tempVal < targetTemp;
  // STEAM flashes yellow; BREW and WATER flash red
  const heatingColor = mode === 2 ? 'var(--dm-warn)' : 'var(--dm-accent)';

  return (
    <div
      className='dm-shell'
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Top header: branding + nav links */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--dm-line)',
          background: 'var(--dm-bg-2)',
          gap: 12,
        }}
      >
        <button
          type='button'
          onClick={onNavToggle}
          aria-expanded={navOpen}
          aria-controls='app-navigation-drawer'
          aria-label='Open navigation menu'
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 10, background: 'var(--dm-accent)', color: '#fff', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--dm-font-display)', fontSize: 16, fontWeight: 700 }}>G</span>
          </span>
          <span style={{ lineHeight: 1.2 }}>
            <span style={{ fontFamily: 'var(--dm-font-display)', fontSize: 18, fontWeight: 700, color: 'var(--dm-fg)', letterSpacing: '0.06em' }}>
              GAGGI<span style={{ fontWeight: 400 }}>MATE</span>
            </span>
            <span style={{ display: 'block', fontFamily: 'var(--dm-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--dm-fg-faint)', textTransform: 'uppercase' }}>
              Live espresso control
            </span>
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <a
            aria-label='github'
            rel='noopener noreferrer'
            href='https://github.com/jniebuhr/gaggimate'
            target='_blank'
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'transparent', color: 'var(--dm-fg-dim)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
          >
            <FontAwesomeIcon icon={faGithub} style={{ fontSize: 16 }} />
          </a>
          <a
            aria-label='discord'
            rel='noopener noreferrer'
            href='https://discord.gaggimate.eu/'
            target='_blank'
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'transparent', color: 'var(--dm-fg-dim)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
          >
            <FontAwesomeIcon icon={faDiscord} style={{ fontSize: 16 }} />
          </a>
          <button
            type='button'
            onClick={onNavToggle}
            aria-expanded={navOpen}
            aria-controls='app-navigation-drawer'
            aria-label='Open navigation menu'
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'transparent', color: 'var(--dm-fg-dim)', border: 'none', cursor: 'pointer' }}
          >
            <svg fill='currentColor' viewBox='0 0 20 20' style={{ width: 18, height: 18 }}>
              <path fillRule='evenodd' d='M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z' clipRule='evenodd' />
            </svg>
          </button>
        </div>
      </div>

      {/* Sub-header: mode rail + status pills + phase strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid var(--dm-line)',
          gap: 12,
          flexWrap: 'wrap',
          background: 'var(--dm-bg-1)',
        }}
      >
        <ModeRail active={mode} onSelect={onModeSelect} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <StatusPill
            ledClass={connected ? 'dm-led--ok' : 'dm-led--warm'}
            label='ONLINE'
            value={connected ? 'WIFI' : 'OFFLINE'}
          />
          <span
            style={{ width: 1, height: 14, background: 'var(--dm-line)', display: 'inline-block' }}
          />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {showFallbackChip ? (
              <PhaseChip key='__fallback' label={currentPhaseLabel} isActive isDone={false} />
            ) : (
              profilePhases.map((p, i) => (
                <PhaseChip
                  key={p}
                  label={p}
                  isActive={active && i === currentPhaseIdx}
                  isDone={active && currentPhaseIdx > 0 && i < currentPhaseIdx}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top row: ring | recipe + targets */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${RING_SIZE + 48}px 1fr`,
          borderBottom: '1px solid var(--dm-line)',
        }}
      >
        {/* Ring panel */}
        <div
          style={{
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid var(--dm-line)',
            background: 'var(--dm-bg-0)',
          }}
        >
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            style={{ width: RING_SIZE, height: RING_SIZE, overflow: 'visible' }}
          >
            {/* Track rings */}
            <path
              d={trackPath(cx, cy, rOuter)}
              fill='none'
              stroke='rgba(255,255,255,0.06)'
              strokeWidth={stroke}
              strokeLinecap='round'
            />
            <path
              d={trackPath(cx, cy, rMid)}
              fill='none'
              stroke='rgba(255,255,255,0.06)'
              strokeWidth={stroke}
              strokeLinecap='round'
            />
            <path
              d={trackPath(cx, cy, rInner)}
              fill='none'
              stroke='rgba(255,255,255,0.06)'
              strokeWidth={stroke}
              strokeLinecap='round'
            />

            {/* Pressure ring (outer, green) */}
            {pressure > 0 && (
              <path
                d={arcPath(cx, cy, rOuter, pressure / PRESSURE_MAX)}
                fill='none'
                stroke='var(--dm-good)'
                strokeWidth={stroke}
                strokeLinecap='round'
              />
            )}
            <path
              d={tickPath(cx, cy, rOuter, targetPressure / PRESSURE_MAX)}
              stroke='rgba(232,232,232,0.65)'
              strokeWidth='2'
            />

            {/* Flow ring (middle, amber/yellow) */}
            {flowVal > 0 && (
              <path
                d={arcPath(cx, cy, rMid, flowVal / FLOW_MAX)}
                fill='none'
                stroke='var(--dm-warn)'
                strokeWidth={stroke}
                strokeLinecap='round'
              />
            )}
            <path
              d={tickPath(cx, cy, rMid, Math.min(1, targetFlow / FLOW_MAX))}
              stroke='rgba(232,232,232,0.55)'
              strokeWidth='2'
            />

            {/* Temp ring (inner, red) */}
            <path
              d={arcPath(cx, cy, rInner, (tempVal - TEMP_MIN) / (TEMP_MAX - TEMP_MIN))}
              fill='none'
              stroke='var(--dm-accent)'
              strokeWidth={stroke}
              strokeLinecap='round'
            />
            <path
              d={tickPath(cx, cy, rInner, (targetTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN))}
              stroke='rgba(232,232,232,0.55)'
              strokeWidth='2'
            />

            {/* Center: shot timer when active, temp when idle */}
            <text
              x={cx}
              y={cy - 26}
              fontSize='9'
              fill='rgba(232,232,232,0.5)'
              fontFamily='var(--dm-font-mono)'
              textAnchor='middle'
              letterSpacing='3'
            >
              {active || finished ? 'SHOT TIME' : 'TEMPERATURE'}
            </text>
            <text
              x={cx}
              y={cy + 16}
              fontSize={active || finished ? 52 : 40}
              fill={isHeating ? heatingColor : 'var(--dm-fg)'}
              fontFamily='var(--dm-font-display)'
              textAnchor='middle'
              letterSpacing='2'
              fontWeight='700'
              style={isHeating ? { animation: 'dm-pulse 1.2s ease-in-out infinite' } : undefined}
            >
              {active || finished ? fmtTimer(elapsedSecs) : fmt(tempVal, 1)}
            </text>
            <text
              x={cx}
              y={cy + 40}
              fontSize='9'
              fill={active ? 'var(--dm-good)' : isHeating ? heatingColor : 'rgba(232,232,232,0.45)'}
              fontFamily='var(--dm-font-mono)'
              textAnchor='middle'
              letterSpacing='2'
              style={isHeating ? { animation: 'dm-pulse 1.2s ease-in-out infinite' } : undefined}
            >
              {active
                ? currentPhaseLabel
                  ? `${currentPhaseLabel} · ${Math.max(0, targetShotSecs - elapsedSecs)}s LEFT`
                  : `${Math.max(0, targetShotSecs - elapsedSecs)}s LEFT`
                : finished
                  ? 'FINISHED'
                  : isHeating
                    ? `HEATING · TGT ${fmt(targetTemp)}°`
                    : `TGT ${fmt(targetTemp)}°`}
            </text>
          </svg>

          <div style={{ marginTop: 10, display: 'flex', gap: 18 }}>
            <RingLegend color='var(--dm-good)'   label='PRESS' value={`${fmt(pressure)} bar`} />
            <RingLegend color='var(--dm-warn)'   label='FLOW'  value={`${fmt(flowVal)} g/s`} />
            <RingLegend color='var(--dm-accent)' label='TEMP'  value={`${fmt(tempVal)}°`} />
          </div>
        </div>

        {/* Recipe + targets panel */}
        <div
          style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minWidth: 0,
            background: 'var(--dm-bg-0)',
          }}
        >
          {/* Bean + profile — clickable to swap */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div
              style={{
                fontFamily: 'var(--dm-font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--dm-fg-dim)',
                marginBottom: 5,
              }}
            >
              TODAY'S RECIPE · TAP TO EDIT
            </div>

            {/* Bean name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type='button'
                onClick={openBeanDropdown}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--dm-font-display)',
                  fontSize: 22,
                  color: 'var(--dm-fg)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  borderBottom: `1px dashed ${activeDropdown === 'bean' ? 'var(--dm-accent)' : 'rgba(232,232,232,0.2)'}`,
                }}
              >
                {s.selectedBean || 'No bean selected'}
              </button>
              <span
                style={{
                  fontFamily: 'var(--dm-font-mono)',
                  fontSize: 9,
                  color: 'var(--dm-fg-faint)',
                  letterSpacing: '0.12em',
                }}
              >
                ▾
              </span>
            </div>

            {/* Profile row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <button
                type='button'
                onClick={openProfileDropdown}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--dm-font-mono)',
                  fontSize: 10,
                  color: 'var(--dm-fg-dim)',
                  borderBottom: `1px dashed ${activeDropdown === 'profile' ? 'var(--dm-accent)' : 'transparent'}`,
                }}
              >
                {s.selectedProfile || 'No profile selected'}
              </button>
              <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 8, color: 'var(--dm-fg-faint)' }}>▾</span>
            </div>

            {/* Bean dropdown */}
            {activeDropdown === 'bean' && (
              <SelectDropdown
                label='SELECT BEAN'
                options={beanOptions}
                activeLabel={s.selectedBean}
                onSelect={handleBeanSelect}
                loading={loadingBeans}
                error={beanError}
                onClose={() => setActiveDropdown(null)}
              />
            )}

            {/* Profile dropdown */}
            {activeDropdown === 'profile' && (
              <SelectDropdown
                label='SELECT PROFILE'
                options={profileOptions}
                activeId={s.selectedProfileId}
                onSelect={handleProfileSelect}
                loading={loadingProfiles}
                error={profileError}
                onClose={() => setActiveDropdown(null)}
              />
            )}
          </div>

          {/* Dose → Yield → Scales */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto 1fr',
              gap: 10,
              alignItems: 'center',
              padding: '12px 0',
              borderTop: '1px solid var(--dm-line)',
              borderBottom: '1px solid var(--dm-line)',
            }}
          >
            <EditableNumBlock
              label='DOSE'
              value={dose}
              unit='g'
              step={0.1}
              min={1}
              max={50}
              onCommit={setDose}
            />
            <span style={{ fontFamily: 'var(--dm-font-display)', fontSize: 20, color: 'var(--dm-fg-faint)' }}>›</span>
            <EditableNumBlock
              label='YIELD'
              value={targetWeight}
              unit='g'
              hint={`1 : ${(targetWeight / Math.max(dose, 1)).toFixed(2)}`}
              step={0.5}
              min={5}
              max={120}
              onCommit={setYield}
            />
            <span style={{ fontFamily: 'var(--dm-font-display)', fontSize: 20, color: 'var(--dm-fg-faint)' }}>›</span>
            <div>
              <div style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--dm-fg-dim)', marginBottom: 3 }}>
                SCALES
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span
                  style={{
                    fontFamily: 'var(--dm-font-display)',
                    fontSize: 28,
                    color: s.bluetoothConnected ? 'var(--dm-good)' : 'var(--dm-fg-faint)',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {s.bluetoothConnected ? fmt(currentWeight) : '—'}
                </span>
                <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 10, color: 'var(--dm-fg-dim)' }}>g</span>
              </div>
              <div style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 9, color: 'var(--dm-fg-faint)', marginTop: 2 }}>
                {s.bluetoothConnected ? (scaleName || 'CONNECTED') : 'NOT CONNECTED'}
              </div>
            </div>
          </div>

          {/* Target bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <TargetBar
              color='var(--dm-good)'
              label='PRESSURE'
              cur={fmt(pressure)}
              tgt={fmt(targetPressure)}
              unit='bar'
              frac={pressure / PRESSURE_MAX}
              tgtFrac={targetPressure / PRESSURE_MAX}
            />
            <TargetBar
              color='var(--dm-warn)'
              label='FLOW'
              cur={fmt(flowVal)}
              tgt={fmt(targetFlow)}
              unit='g/s'
              frac={flowVal / FLOW_MAX}
              tgtFrac={Math.min(1, targetFlow / FLOW_MAX)}
            />
            <TargetBar
              color='var(--dm-accent)'
              label='TEMP'
              cur={fmt(tempVal)}
              tgt={fmt(targetTemp)}
              unit='°C'
              frac={(tempVal - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)}
              tgtFrac={(targetTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)}
            />
          </div>

          {/* Yield bar + action button */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px',
              gap: 14,
              alignItems: 'stretch',
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--dm-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    color: 'var(--dm-fg-dim)',
                  }}
                >
                  YIELD
                </span>
                <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 10 }}>
                  <span
                    style={{
                      fontFamily: 'var(--dm-font-display)',
                      fontSize: 20,
                      color: 'var(--dm-fg)',
                      fontWeight: 700,
                    }}
                  >
                    {fmt(currentWeight)}
                  </span>
                  <span style={{ color: 'var(--dm-fg-dim)', marginLeft: 5 }}>
                    / {targetWeight.toFixed(1)}g · 1:
                    {(currentWeight / Math.max(dose, 1)).toFixed(2)}
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 2, height: 10 }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 1,
                      background:
                        i / 40 < currentWeight / Math.max(targetWeight, 1)
                          ? 'var(--dm-accent)'
                          : 'var(--dm-bg-3)',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type='button'
              onClick={active ? actions.deactivate : finished ? actions.clear : actions.activate}
              style={{
                background: active
                  ? 'var(--dm-accent)'
                  : finished
                    ? 'var(--dm-good)'
                    : 'rgba(215,25,33,0.14)',
                color: active || finished ? '#fff' : 'var(--dm-accent)',
                border:
                  active || finished ? 'none' : '1px solid rgba(215,25,33,0.4)',
                fontFamily: 'var(--dm-font-display)',
                fontSize: 13,
                letterSpacing: '0.18em',
                padding: '10px 8px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                boxShadow: active ? '0 6px 18px rgba(215,25,33,0.22)' : 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
            >
              {active ? 'STOP SHOT' : finished ? 'CLEAR' : 'START SHOT'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: full-width live extraction graph */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'var(--dm-bg-0)',
          flex: 1,
          minHeight: 140,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--dm-font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--dm-fg-dim)',
            }}
          >
            LIVE EXTRACTION
          </span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <GraphLegend color='var(--dm-accent)' label='TEMP'     value={`${fmt(tempVal)}°C`} />
            <GraphLegend color='var(--dm-good)'   label='PRESSURE' value={`${fmt(pressure)} bar`} />
            <GraphLegend color='var(--dm-warn)'   label='FLOW'     value={`${fmt(flowVal)} g/s`} />
            <GraphLegend color='rgba(232,232,232,0.42)' label='TARGET' dashed />
          </div>
        </div>

        <div
          className='dm-scan'
          style={{
            flex: 1,
            position: 'relative',
            border: '1px solid var(--dm-line)',
            borderRadius: 8,
            background: 'var(--dm-bg-0)',
            overflow: 'hidden',
          }}
        >
          <svg
            viewBox={`0 0 ${GW} ${GH}`}
            preserveAspectRatio='none'
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            {/* Left axis: pressure/flow grid lines (0–12 bar) */}
            {[0, 3, 6, 9, 12].map(p => {
              const y = pToY(p).toFixed(1);
              return (
                <g key={p}>
                  <line
                    x1={GP_L}
                    x2={GW - GP_R}
                    y1={y}
                    y2={y}
                    stroke='rgba(255,255,255,0.05)'
                    strokeDasharray='2 4'
                  />
                  <text
                    x={GP_L - 5}
                    y={parseFloat(y) + 3}
                    fontSize='9'
                    fill='rgba(124,184,118,0.55)'
                    fontFamily='var(--dm-font-mono)'
                    textAnchor='end'
                  >
                    {p}
                  </text>
                </g>
              );
            })}

            {/* Right axis: temperature labels (0–110 °C) */}
            {[0, 30, 60, 90, 110].map(t => {
              const y = tempToY(t).toFixed(1);
              return (
                <text
                  key={t}
                  x={GW - GP_R + 5}
                  y={parseFloat(y) + 3}
                  fontSize='9'
                  fill='rgba(215,25,33,0.55)'
                  fontFamily='var(--dm-font-mono)'
                  textAnchor='start'
                >
                  {t}°
                </text>
              );
            })}

            {graphPaths ? (
              <>
                {/* Target pressure (dashed, faint) */}
                {graphPaths.tpd && (
                  <path
                    d={graphPaths.tpd}
                    fill='none'
                    stroke='rgba(232,232,232,0.35)'
                    strokeWidth='1.5'
                    strokeDasharray='3 3'
                  />
                )}
                {/* Flow line (yellow/amber) */}
                {graphPaths.fd && (
                  <path
                    d={graphPaths.fd}
                    fill='none'
                    stroke='var(--dm-warn)'
                    strokeWidth='1.5'
                  />
                )}
                {/* Pressure line (green) */}
                {graphPaths.pd && (
                  <path
                    d={graphPaths.pd}
                    fill='none'
                    stroke='var(--dm-good)'
                    strokeWidth='2'
                  />
                )}
                {/* Temperature line (red, hero) */}
                {graphPaths.tempd && (
                  <path
                    d={graphPaths.tempd}
                    fill='none'
                    stroke='var(--dm-accent)'
                    strokeWidth='2.5'
                  />
                )}
                {/* Playhead (only during active brew) */}
                {active && graphPaths.curX && (
                  <>
                    <line
                      x1={graphPaths.curX}
                      x2={graphPaths.curX}
                      y1={GP_T}
                      y2={GP_T + G_INNER_H}
                      stroke='rgba(232,232,232,0.3)'
                      strokeWidth='1'
                    />
                    <circle
                      cx={graphPaths.curX}
                      cy={graphPaths.curPY}
                      r='4'
                      fill='var(--dm-good)'
                      stroke='#000'
                      strokeWidth='1.5'
                    />
                  </>
                )}
              </>
            ) : (
              <text
                x={GW / 2}
                y={GH / 2}
                fontSize='11'
                fill='rgba(232,232,232,0.25)'
                fontFamily='var(--dm-font-mono)'
                textAnchor='middle'
                letterSpacing='3'
              >
                NO DATA
              </text>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
