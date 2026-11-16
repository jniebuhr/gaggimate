// Tiny Markdown renderer for GitHub release notes and commit messages: headings, bullet lists,
// paragraphs, **bold**, `code`, [links](url), bare URLs and @mentions. It builds elements instead of
// HTML strings, so untrusted text can never inject markup. shortcut: no tables, nested lists, or
// numbered lists; swap in markdown-to-jsx if release notes ever need them.

import { memo } from 'preact/compat';

// Bare URLs don't end in sentence punctuation; a mention isn't part of an email (a@b.com) or npm scope (@a/b).
const INLINE =
  /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)<]*[^\s)<.,;:!?])|(?<![\w.])@([\w-]+)(?![\w/-])/g;

const linkClass = 'link link-primary break-all';

function Link({ href, children }) {
  return (
    <a href={href} target='_blank' rel='noopener noreferrer' className={linkClass}>
      {children}
    </a>
  );
}

function inline(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, bold, code, label, href, url, user] = m;
    if (bold) out.push(<strong>{inline(bold)}</strong>);
    else if (code) out.push(<code className='bg-base-300 rounded px-1'>{code}</code>);
    else if (label) out.push(<Link href={href}>{label}</Link>);
    else if (url) {
      const pr = url.match(/\/pull\/(\d+)$/);
      out.push(<Link href={url}>{pr ? `#${pr[1]}` : url}</Link>);
    } else out.push(<Link href={`https://github.com/${user}`}>@{user}</Link>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MarkdownView({ text }) {
  const blocks = [];
  let list = null;
  let para = null;
  const flush = () => {
    list = para = null;
  };
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    const item = line.match(/^\s*[*-]\s+(.*)/);
    if (heading) {
      flush();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
    } else if (item) {
      para = null;
      if (!list) blocks.push((list = { type: 'ul', items: [] }));
      list.items.push(item[1]);
    } else if (!line.trim()) {
      flush();
    } else if (list && /^\s/.test(line)) {
      // An indented line continues a wrapped bullet (commit bodies wrap at ~72 columns).
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      list = null;
      if (!para) blocks.push((para = { type: 'p', lines: [] }));
      para.lines.push(line);
    }
  }

  return (
    <div className='space-y-2 text-sm'>
      {blocks.map((b, n) =>
        b.type === 'h' ? (
          <h5
            key={n}
            className={b.level <= 2 ? 'mt-3 text-base font-semibold' : 'mt-2 font-semibold'}
          >
            {inline(b.text)}
          </h5>
        ) : b.type === 'ul' ? (
          <ul key={n} className='list-disc space-y-1 pl-5'>
            {b.items.map((i, k) => (
              <li key={k}>{inline(i)}</li>
            ))}
          </ul>
        ) : (
          <p key={n}>{inline(b.lines.join(' '))}</p>
        ),
      )}
    </div>
  );
}

// Memoized: the settings page re-renders on every machine status tick, and release bodies are long.
export const Markdown = memo(MarkdownView);
