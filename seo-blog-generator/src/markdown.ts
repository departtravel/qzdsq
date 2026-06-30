export function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // code inline
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // links
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
    // images — replace placeholder URLs with a styled placeholder
    .replace(/!\[([^\]]*)\]\(IMAGE_(\d+)_URL(?:\s+"([^"]*)")?\)/g,
      (_m, alt, num, caption) =>
        `<figure class="my-4"><div class="flex h-32 items-center justify-center rounded-lg bg-slate-100 text-slate-400 text-sm border border-dashed border-slate-300">📷 Image ${num} — ${alt}</div>${caption ? `<figcaption class="text-center text-xs text-slate-500 mt-1">${caption}</figcaption>` : ''}</figure>`)
    .replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg my-4 max-w-full" />')
    // unordered list
    .replace(/(?:^[-*]\s.+$\n?)+/gm, m =>
      '<ul>' + m.trim().split('\n').map(l => `<li>${l.replace(/^[-*]\s/, '')}</li>`).join('') + '</ul>')
    // ordered list
    .replace(/(?:^\d+\.\s.+$\n?)+/gm, m =>
      '<ol>' + m.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('') + '</ol>')
    // horizontal rule
    .replace(/^---$/gm, '<hr class="my-4 border-slate-200" />')
    // paragraphs — wrap non-tag lines
    .replace(/^(?!<[a-zA-Z\/])(.+)$/gm, '<p>$1</p>')
    // clean double blank lines inside tags
    .replace(/\n{3,}/g, '\n\n')
}
