import { useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { Spinner } from '../../components/Spinner.jsx';
import { Markdown } from '../../components/Markdown.jsx';

const API = 'https://api.github.com/repos/jniebuhr/gaggimate';

// `git describe` strings look like v1.8.0-12-gabc1234[-dirty]; a plain tag has no -g part.
const refOf = version => version?.match(/-g([0-9a-f]+)/)?.[1] ?? version?.replace(/-dirty$/, '');

async function gh(path) {
  const res = await fetch(`${API}/${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok)
    throw new Error(res.status === 403 ? 'GitHub rate limit reached' : `HTTP ${res.status}`);
  return res.json();
}

// shortcut: compare returns at most 250 commits, enough for a nightly span; page it if that ever stops being true.
const commitsBetween = async (base, head) =>
  (await gh(`compare/${base}...${head}`)).commits.reverse();

async function loadStable() {
  const release = await gh('releases/latest');
  return { release };
}

async function loadNightly(installed, latest) {
  const stable = await gh('releases/latest');
  const installedRef = refOf(installed);
  const latestRef = refOf(latest);
  const [local, pending] = await Promise.all([
    commitsBetween(stable.tag_name, installedRef),
    latestRef && latestRef !== installedRef ? commitsBetween(installedRef, latestRef) : [],
  ]);
  return { stableTag: stable.tag_name, local, pending };
}

function CommitList({ commits }) {
  if (!commits.length) {
    return (
      <p className='text-base-content/70 text-sm'>
        <Trans>No commits.</Trans>
      </p>
    );
  }
  return (
    <ul className='space-y-2'>
      {commits.map(c => {
        const [title, ...rest] = c.commit.message.split('\n');
        const body = rest.join('\n').trim();
        const head = (
          <>
            <span className='font-medium'>{title}</span>
            <span className='text-base-content/50 ml-2 font-mono text-xs'>{c.sha.slice(0, 7)}</span>
          </>
        );
        return (
          <li key={c.sha}>
            {body ? (
              <details className='bg-base-200 rounded-lg p-3'>
                <summary className='cursor-pointer'>{head}</summary>
                <div className='mt-2'>
                  <Markdown text={body} />
                </div>
              </details>
            ) : (
              <div className='bg-base-200 rounded-lg p-3'>{head}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PatchNotes({ channel, installedVersion, latestVersion }) {
  const { t } = useLingui();
  const [view, setView] = useState(null); // 'stable' | 'nightly'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({});

  // Fetch only on click (and only once per view) so we don't burn the unauthenticated GitHub rate limit.
  const show = async which => {
    setView(which);
    setError('');
    if (data[which]) return;
    setLoading(true);
    try {
      const result =
        which === 'stable'
          ? await loadStable()
          : await loadNightly(installedVersion, latestVersion);
      setData(d => ({ ...d, [which]: result }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const current = view && data[view];

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          className='btn btn-secondary btn-sm flex-auto'
          onClick={() => show('stable')}
        >
          <Trans>Latest stable patchnotes</Trans>
        </button>
        {channel === 'nightly' && (
          <button
            type='button'
            className='btn btn-secondary btn-sm flex-auto'
            onClick={() => show('nightly')}
          >
            <Trans>Nightly patchnotes</Trans>
          </button>
        )}
      </div>

      {loading && <Spinner />}
      {error && (
        <div className='alert alert-error text-sm'>
          {t`Could not load patchnotes`}: {error}
        </div>
      )}

      {current && view === 'stable' && (
        <div className='max-h-96 overflow-y-auto'>
          <h4 className='mb-2 font-semibold'>{current.release.name || current.release.tag_name}</h4>
          <Markdown text={current.release.body} />
        </div>
      )}

      {current && view === 'nightly' && (
        <div className='max-h-96 space-y-4 overflow-y-auto'>
          <section>
            <h4 className='mb-2 font-semibold'>
              <Trans>Installed, not in stable ({current.stableTag})</Trans>
            </h4>
            <CommitList commits={current.local} />
          </section>
          <section>
            <h4 className='mb-2 font-semibold'>
              <Trans>Included in the next update</Trans>
            </h4>
            <CommitList commits={current.pending} />
          </section>
        </div>
      )}
    </div>
  );
}
