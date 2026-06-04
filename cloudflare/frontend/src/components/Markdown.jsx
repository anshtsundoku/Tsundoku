// Minimal markdown renderer — only the syntax our legal pages use:
// #/##/### headings, paragraphs, bullet lists, [links](url), and `inline code`.
// Intentionally tiny; not a general-purpose markdown engine.

function renderInline(text, keyPrefix) {
  const nodes = [];
  // Split on links [text](url) and `code`, keeping the delimiters.
  const re = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(
        <a key={`${keyPrefix}-a-${i}`} href={m[2]} target="_blank" rel="noreferrer"
           className="text-wood underline hover:text-ink transition-colors">
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-c-${i}`} className="font-mono text-sm bg-wood/10 px-1.5 py-0.5 rounded">
          {m[3]}
        </code>,
      );
    }
    last = re.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ source }) {
  const lines = String(source || '').split('\n');
  const blocks = [];
  let para = [];
  let list = [];

  const flushPara = () => {
    if (para.length) {
      const key = `p-${blocks.length}`;
      blocks.push(
        <p key={key} className="text-muted leading-relaxed mb-4">{renderInline(para.join(' '), key)}</p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const key = `ul-${blocks.length}`;
      blocks.push(
        <ul key={key} className="list-disc pl-5 mb-4 space-y-1 text-muted leading-relaxed">
          {list.map((item, idx) => <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>)}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    if (line.startsWith('### ')) {
      flushPara(); flushList();
      blocks.push(<h3 key={`h3-${blocks.length}`} className="text-ink font-bold text-lg tracking-tight mt-6 mb-2">{renderInline(line.slice(4), `h3-${blocks.length}`)}</h3>);
    } else if (line.startsWith('## ')) {
      flushPara(); flushList();
      blocks.push(<h2 key={`h2-${blocks.length}`} className="text-ink font-bold text-xl tracking-tight mt-8 mb-3">{renderInline(line.slice(3), `h2-${blocks.length}`)}</h2>);
    } else if (line.startsWith('# ')) {
      flushPara(); flushList();
      blocks.push(<h1 key={`h1-${blocks.length}`} className="text-ink font-bold text-3xl sm:text-4xl tt-title tracking-tight leading-none mb-6">{renderInline(line.slice(2), `h1-${blocks.length}`)}</h1>);
    } else if (line.startsWith('- ')) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
