import { memo } from 'react';

const Pagination = memo(function Pagination({ page, pages, onPageChange }) {
  if (pages <= 1) return null;

  const getPages = () => {
    const items = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    if (start > 1) items.push(1);
    if (start > 2) items.push('...');
    for (let i = start; i <= end; i++) items.push(i);
    if (end < pages - 1) items.push('...');
    if (end < pages) items.push(pages);
    return items;
  };

  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Page {page} of {pages}</p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
          onMouseEnter={(e) => { if (page > 1) { e.currentTarget.style.backgroundColor = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Prev
        </button>
        <div className="flex items-center gap-1">
          {getPages().map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-2 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className="w-9 h-9 text-sm font-medium rounded-lg border transition-all duration-150"
                style={{
                  backgroundColor: p === page ? 'var(--primary)' : 'transparent',
                  borderColor: p === page ? 'transparent' : 'var(--border-color)',
                  color: p === page ? '#FFFFFF' : 'var(--text-secondary)',
                  boxShadow: p === page ? 'var(--shadow-xs)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (p !== page) { e.currentTarget.style.backgroundColor = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; }
                }}
                onMouseLeave={(e) => {
                  if (p !== page) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }
                }}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
          onMouseEnter={(e) => { if (page < pages) { e.currentTarget.style.backgroundColor = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
        >
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
});

export default Pagination;
