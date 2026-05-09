import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';

const linkStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dm-fg-dim)',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
};

const hamburgerStyle = {
  ...linkStyle,
  padding: 0,
};

export function PageShell({ children, navOpen, onNavToggle }) {
  return (
    <div
      className='dm-shell'
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--dm-line-strong)',
        boxShadow: '0 36px 80px -48px rgba(0,0,0,0.92)',
      }}
    >
      {/* Integrated header — same style as DashboardMerged */}
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
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
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
          <a aria-label='github' rel='noopener noreferrer' href='https://github.com/jniebuhr/gaggimate' target='_blank' style={linkStyle}>
            <FontAwesomeIcon icon={faGithub} style={{ fontSize: 16 }} />
          </a>
          <a aria-label='discord' rel='noopener noreferrer' href='https://discord.gaggimate.eu/' target='_blank' style={linkStyle}>
            <FontAwesomeIcon icon={faDiscord} style={{ fontSize: 16 }} />
          </a>
          <button
            type='button'
            onClick={onNavToggle}
            aria-expanded={navOpen}
            aria-controls='app-navigation-drawer'
            aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
            style={hamburgerStyle}
          >
            <svg fill='currentColor' viewBox='0 0 20 20' style={{ width: 18, height: 18 }}>
              <path fillRule='evenodd' d='M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z' clipRule='evenodd' />
            </svg>
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: '16px', background: 'var(--dm-bg-1)' }}>
        {children}
      </div>
    </div>
  );
}
