import React from 'react';

/** Escape HTML entities. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline: bold, italic, code, links (http/https only). */
function renderInline(text: string): string {
  let s = escapeHtml(text);

  // code first
  s = s.replace(/`([^`]+)`/g, '<code class="ha-md__code">$1</code>');

  // bold **text** or __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // italic *text* or _text_ (avoid matching inside words loosely)
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // links [label](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a class="ha-md__a" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return s;
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(line.trim()) && line.includes('-');
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function renderTable(rows: string[]): string {
  if (rows.length < 2) return '';
  const header = splitTableRow(rows[0]!);
  const bodyRows = rows.slice(2).map(splitTableRow);
  const th = header
    .map((c) => `<th>${renderInline(c)}</th>`)
    .join('');
  const trs = bodyRows
    .map(
      (cells) =>
        `<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`
    )
    .join('');
  return `<div class="ha-md__table-wrap"><table class="ha-md__table"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

/**
 * Markdown leve e seguro para bolhas do assistente (sem HTML cru do modelo).
 */
export function markdownToSafeHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  function flushList() {
    if (!listType || listItems.length === 0) return;
    const tag = listType;
    out.push(
      `<${tag} class="ha-md__list">${listItems
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join('')}</${tag}>`
    );
    listType = null;
    listItems = [];
  }

  while (i < lines.length) {
    const line = lines[i]!;

    // fenced code
    if (line.trim().startsWith('```')) {
      if (inCode) {
        out.push(
          `<pre class="ha-md__pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
        );
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      i += 1;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    // table block
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]!)
    ) {
      flushList();
      const tableLines = [line, lines[i + 1]!];
      i += 2;
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim()) {
        tableLines.push(lines[i]!);
        i += 1;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    // hr
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      flushList();
      out.push('<hr class="ha-md__hr" />');
      i += 1;
      continue;
    }

    // headings
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = Math.min(heading[1]!.length + 1, 4); // h2–h5 visually
      out.push(
        `<h${level} class="ha-md__h ha-md__h${level}">${renderInline(
          heading[2]!
        )}</h${level}>`
      );
      i += 1;
      continue;
    }

    // unordered list
    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    if (ul) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ul[1]!);
      i += 1;
      continue;
    }

    // ordered list
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ol) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ol[1]!);
      i += 1;
      continue;
    }

    // blank
    if (!line.trim()) {
      flushList();
      i += 1;
      continue;
    }

    // paragraph (merge consecutive non-empty non-special lines)
    flushList();
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !lines[i]!.trim().startsWith('#') &&
      !lines[i]!.trim().startsWith('```') &&
      !/^\s*[-*•]\s+/.test(lines[i]!) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]!) &&
      !(
        lines[i]!.includes('|') &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1]!)
      )
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    out.push(`<p class="ha-md__p">${renderInline(para.join(' '))}</p>`);
  }

  flushList();
  if (inCode && codeBuf.length) {
    out.push(
      `<pre class="ha-md__pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
    );
  }

  return out.join('\n');
}

type Props = {
  content: string;
  className?: string;
};

export const ChatMarkdown: React.FC<Props> = ({ content, className }) => {
  const html = markdownToSafeHtml(content);
  return (
    <div
      className={`ha-md ${className || ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
