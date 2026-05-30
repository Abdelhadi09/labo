import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination bar.
 * Props:
 *   page        – current 1-based page
 *   totalPages  – total number of pages
 *   total       – total item count (for display)
 *   limit       – items per page
 *   onPageChange(newPage) – callback
 */
export default function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Build page number buttons: always show first, last, current ± 1, with ellipsis
  const pages = [];
  const addPage = (n) => { if (!pages.includes(n) && n >= 1 && n <= totalPages) pages.push(n); };
  addPage(1);
  addPage(page - 1); addPage(page); addPage(page + 1);
  addPage(totalPages);
  pages.sort((a, b) => a - b);

  // Insert null as ellipsis marker
  const withEllipsis = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withEllipsis.push(null);
    withEllipsis.push(pages[i]);
  }

  return (
    <div style={S.wrapper}>
      <span style={S.info}>{from}–{to} sur {total}</span>

      <div style={S.controls}>
        <button
          style={{ ...S.btn, ...(page === 1 ? S.btnDisabled : {}) }}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
        >
          <ChevronLeft size={15} />
        </button>

        {withEllipsis.map((p, i) =>
          p === null ? (
            <span key={`e${i}`} style={S.ellipsis}>…</span>
          ) : (
            <button
              key={p}
              style={{ ...S.btn, ...(p === page ? S.btnActive : {}) }}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          style={{ ...S.btn, ...(page === totalPages ? S.btnDisabled : {}) }}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Page suivante"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

const S = {
  wrapper: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', borderTop: '1px solid var(--border)',
    flexWrap: 'wrap', gap: 8,
  },
  info: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  controls: { display: 'flex', alignItems: 'center', gap: 4 },
  btn: {
    minWidth: 32, height: 32, padding: '0 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, border: '1.5px solid var(--border)',
    background: 'white', color: 'var(--text-dark)',
    fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-body)', transition: 'all 0.12s',
    WebkitTapHighlightColor: 'transparent',
  },
  btnActive: {
    background: 'var(--teal)', borderColor: 'var(--teal)',
    color: 'white', fontWeight: 700,
  },
  btnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  ellipsis: { fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0 2px' },
};