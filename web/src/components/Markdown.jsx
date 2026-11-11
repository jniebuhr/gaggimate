// Tiny Markdown renderer for GitHub release notes and commit messages: headings, bullet lists,
// paragraphs, **bold**, `code`, [links](url), bare URLs and @mentions. It builds elements instead of
// HTML strings, so untrusted text can never inject markup. shortcut: no tables, nested lists, or
// numbered lists; swap in markdown-to-jsx if release notes ever need them.

const INLINE =
  /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)<]+)|@([\w-]+)/g;

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

export function Markdown({ text }) {
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
    } else {
      list = null;
      if (!para) blocks.push((para = { type: 'p', lines: [] }));
      para.lines.push(line);
    }
  }

  return (
    <div className='space-y-2 text-sm'>
      {blocks.map(b =>
        b.type === 'h' ? (
          <h5 className={b.level <= 2 ? 'mt-3 text-base font-semibold' : 'mt-2 font-semibold'}>
            {inline(b.text)}
          </h5>
        ) : b.type === 'ul' ? (
          <ul className='list-disc space-y-1 pl-5'>
            {b.items.map(i => (
              <li>{inline(i)}</li>
            ))}
          </ul>
        ) : (
          <p>{inline(b.lines.join(' '))}</p>
        ),
      )}
    </div>
  );
}
