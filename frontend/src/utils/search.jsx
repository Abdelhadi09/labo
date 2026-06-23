// Text normalization for fuzzy search across service names, codes, and keywords
export function normalize(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '');
}

// Match services against query: every word must appear somewhere
export function matchesQuery(service, query) {
  if (!query.trim()) return true;
  const q = normalize(query);
  const haystack = normalize(
    [service.name, service.code, service.keywords || ''].join(' ')
  );
  return q.split(/\s+/).every(word => haystack.includes(word));
}

// Highlight first word of query in text (JSX component)
export function highlight(text, query) {
  if (!query.trim()) return text;
  const word = query.trim().split(/\s+/)[0];
  const normWord = normalize(word);
  const normText = normalize(text);
  const idx = normText.indexOf(normWord);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(10,147,150,0.18)', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + word.length)}
      </mark>
      {text.slice(idx + word.length)}
    </>
  );
}
