import { useCallback, useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Trans, useLingui } from '@lingui/react/macro';
import { plural, t } from '@lingui/core/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark';
import { Spinner } from '../../components/Spinner.jsx';
import { Markdown } from '../../components/Markdown.jsx';
import TabBar from '../../components/TabBar.jsx';

const API = 'https://api.github.com/repos/jniebuhr/gaggimate';

// `git describe` strings look like v1.8.0-12-gabc1234[-dirty]; a plain tag has no -g part. The device
// reports the latest version without its leading v (1.9.0), but the GitHub tag is v1.9.0.
const refOf = version => {
  const v = version?.replace(/-dirty$/, '');
  return v?.match(/-g([0-9a-f]+)$/)?.[1] ?? (/^\d/.test(v ?? '') ? `v${v}` : v);
};

async function gh(path) {
  const res = await fetch(`${API}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(20000), // a stalled request would otherwise keep the spinner forever
  });
  if (!res.ok)
    throw new Error(
      res.status === 403 ? 'GitHub rate limit reached' : `HTTP ${res.status} (${path})`,
    );
  return res.json();
}

// Unpaged, compare returns the newest 250 commits and total_commits; paging would not help, since
// page 1 always carries up to 300 file patches (MBs) and an older range belongs in the release tabs.
async function commitsSinceInstalled(installed, latest) {
  const base = refOf(installed);
  const head = refOf(latest);
  // An empty latestVersion means the device's update check failed or hasn't run yet, not "up to date".
  if (!base || !head) throw new Error(t`The firmware version is not known yet`);
  if (head === base) return { commits: [], total: 0 };
  const res = await gh(`compare/${base}...${head}`);
  return { commits: res.commits.reverse(), total: res.total_commits };
}

// feat(update)!: Subject -> { type: 'feat', scope: 'update', subject: 'Subject' }
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.*)$/;
// Machine-read refs (versions, commit type, hash) share one quiet mono style.
const REF = 'text-base-content/60 font-mono text-xs';
const plainVersion = v => v?.replace(/^v/, '');

function CommitCard({ commit: c }) {
  const [title, ...rest] = c.commit.message.split('\n');
  const body = rest.join('\n').trim();
  const [, type, scope, subject] = title.match(CONVENTIONAL) ?? [null, null, null, title];
  const date = new Date(c.commit.author.date).toLocaleDateString();

  return (
    <li className='border-base-content/10 bg-base-100 rounded-lg border p-3'>
      {type && <p className={`${REF} mb-1`}>{scope ? `${type} · ${scope}` : type}</p>}
      <p className='leading-snug font-medium'>{subject}</p>
      <p className='text-base-content/60 mt-1 flex flex-wrap gap-x-2 text-xs'>
        <span>{c.commit.author.name}</span>
        <span aria-hidden='true'>·</span>
        <time dateTime={c.commit.author.date}>{date}</time>
        <span aria-hidden='true'>·</span>
        <a
          href={c.html_url}
          target='_blank'
          rel='noopener noreferrer'
          className='link link-hover font-mono'
        >
          {c.sha.slice(0, 7)}
        </a>
      </p>
      {body && (
        <details className='mt-2'>
          <summary className='text-base-content/70 cursor-pointer text-xs'>
            <Trans>Details</Trans>
          </summary>
          <div className='border-base-content/10 mt-2 border-t pt-2'>
            <Markdown text={body} />
          </div>
        </details>
      )}
    </li>
  );
}

function CommitList({ commits, total, from, to }) {
  if (!commits.length) {
    return (
      <p className='text-base-content/70 text-sm'>
        <Trans>No new commits since the installed version</Trans>
      </p>
    );
  }
  return (
    <div className='space-y-3'>
      <p className={`${REF} flex flex-wrap gap-x-2 tabular-nums`}>
        <span className='break-all'>
          {plainVersion(from)} → {plainVersion(to)}
        </span>
        <span aria-hidden='true'>·</span>
        <span>{plural(total, { one: '# commit', other: '# commits' })}</span>
        {total > commits.length && (
          <>
            <span aria-hidden='true'>·</span>
            <span>
              <Trans>showing the newest {commits.length}</Trans>
            </span>
          </>
        )}
      </p>
      <ul className='space-y-2'>
        {commits.map(c => (
          <CommitCard key={c.sha} commit={c} />
        ))}
      </ul>
    </div>
  );
}

function Release({ release }) {
  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h4 className='font-semibold'>{release.name || release.tag_name}</h4>
        <a
          href={release.html_url}
          target='_blank'
          rel='noopener noreferrer'
          className='link link-hover text-base-content/60 text-xs'
        >
          <Trans>View on GitHub</Trans>
        </a>
      </div>
      <Markdown text={release.body} />
    </div>
  );
}

function PatchNotesModal({ title, onClose, children }) {
  const { t } = useLingui();
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portaled to <body> and lifted above the sidebar (z-9999) so the backdrop dims the whole page.
  return createPortal(
    <div
      className='modal modal-open z-[10000]'
      role='dialog'
      aria-modal='true'
      aria-labelledby='patchnotes-title'
    >
      <div className='modal-box flex max-h-[85vh] max-w-2xl flex-col gap-3'>
        <div className='flex items-center justify-between gap-2'>
          <h3 id='patchnotes-title' className='text-lg font-bold'>
            {title}
          </h3>
          <button
            type='button'
            className='btn btn-sm btn-circle btn-ghost'
            aria-label={t`Close`}
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        {children}
      </div>
      <button type='button' className='modal-backdrop' aria-label={t`Close`} onClick={onClose} />
    </div>,
    document.body,
  );
}

export function PatchNotes({ channel, installedVersion, latestVersion }) {
  const { t } = useLingui();
  const [isOpen, setOpen] = useState(false);
  const [tab, setTab] = useState('pending'); // nightly only: 'pending' | 'nightly' | 'stable'
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});

  const nightly = channel === 'nightly';
  const key = isOpen && (nightly ? tab : 'stable');
  // The versions are part of the key: "Save channel and refresh" delivers a new latestVersion later.
  const cacheKey = key === 'pending' ? `pending:${installedVersion}:${latestVersion}` : key;

  // Fetch only what is shown (and only once per key) so we don't burn the unauthenticated GitHub rate limit.
  useEffect(() => {
    if (!key || data[cacheKey] !== undefined || errors[cacheKey]) return;
    setData(d => ({ ...d, [cacheKey]: null })); // null = in flight, so a tab switch doesn't refetch
    const load =
      key === 'pending'
        ? commitsSinceInstalled(installedVersion, latestVersion)
        : gh(key === 'stable' ? 'releases/latest' : 'releases/tags/nightly');
    load
      .then(result => setData(d => ({ ...d, [cacheKey]: result })))
      .catch(e => {
        setData(({ [cacheKey]: _, ...d }) => d);
        setErrors(es => ({ ...es, [cacheKey]: e.message }));
      });
  }, [key, cacheKey, data, errors, installedVersion, latestVersion]);

  // Stable identity, so the modal's Escape listener isn't re-bound on every status tick re-render.
  const close = useCallback(() => setOpen(false), []);
  const open = () => {
    setTab('pending');
    setErrors({}); // reopening retries a failed load
    setOpen(true);
  };

  const current = cacheKey && data[cacheKey];
  const content = errors[cacheKey] ? (
    <div className='alert alert-error text-sm'>
      {t`Could not load release notes`}: {errors[cacheKey]}
    </div>
  ) : !current ? (
    <Spinner />
  ) : key === 'pending' ? (
    <CommitList {...current} from={installedVersion} to={latestVersion} />
  ) : (
    <Release release={current} />
  );

  return (
    <>
      <button type='button' className='link link-primary self-start text-sm' onClick={open}>
        <Trans>Release notes</Trans>
      </button>

      {isOpen && (
        <PatchNotesModal title={t`Release notes`} onClose={close}>
          {nightly && (
            <TabBar
              tabs={[
                { id: 'pending', label: t`Since the last update` },
                { id: 'nightly', label: t`All nightly changes` },
                { id: 'stable', label: t({ message: 'Stable', context: 'update channel' }) },
              ]}
              activeTab={tab}
              onTabChange={setTab}
            />
          )}
          <div
            id={nightly ? `panel-${tab}` : undefined}
            role={nightly ? 'tabpanel' : undefined}
            className='min-h-0 flex-1 overflow-y-auto'
          >
            {content}
          </div>
        </PatchNotesModal>
      )}
    </>
  );
}
