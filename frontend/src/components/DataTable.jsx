import { useState, useMemo } from 'react';
import {
  HiOutlineSortAscending, HiOutlineSortDescending, HiOutlineSearch,
  HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineDotsVertical,
  HiOutlineDownload, HiOutlineFilter, HiOutlineSelector, HiOutlineViewList
} from 'react-icons/hi';

/**
 * Reusable DataTable component — mobile responsive with card view on small screens
 *
 * @param {object} props
 * @param {Array} props.columns - [{ key, label, sortable, render, className, hideOnMobile, mobileLabel }]
 * @param {Array} props.data - Array of row objects
 * @param {number} props.page - Current page
 * @param {number} props.pages - Total pages
 * @param {function} props.onPageChange - Page change handler
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.selectable - Enable row selection
 * @param {Array} props.selectedIds - Currently selected row IDs
 * @param {function} props.onSelectionChange - Selection change handler
 * @param {Array} props.bulkActions - [{ label, icon, onClick, color }]
 * @param {string} props.searchPlaceholder - Search input placeholder
 * @param {function} props.onSearch - Search handler
 * @param {string} props.searchValue - Current search value
 * @param {Array} props.filters - [{ key, label, options, value, onChange }]
 * @param {string} props.emptyMessage - Message when no data
 * @param {function} props.onExport - Export handler
 * @param {string} props.exportLabel - Export button label
 * @param {function} props.onRowClick - Row click handler
 * @param {string} props.rowKey - Row key field (default: 'id')
 * @param {boolean} props.compact - Compact mode with smaller padding
 */
export default function DataTable({
  columns = [],
  data = [],
  page = 1,
  pages = 1,
  onPageChange,
  loading = false,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue = '',
  filters = [],
  emptyMessage = 'No data found',
  onExport,
  exportLabel = 'Export',
  onRowClick,
  rowKey = 'id',
  compact = false,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [mobileView, setMobileView] = useState('table'); // 'table' | 'cards'

  const allSelected = useMemo(
    () => data.length > 0 && data.every((row) => selectedIds.includes(row[rowKey])),
    [data, selectedIds, rowKey]
  );

  const someSelected = useMemo(
    () => selectedIds.length > 0 && !allSelected,
    [selectedIds.length, allSelected]
  );

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleSelectAll = () => {
    if (allSelected) onSelectionChange?.([]);
    else onSelectionChange?.(data.map((row) => row[rowKey]));
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) onSelectionChange?.(selectedIds.filter((i) => i !== id));
    else onSelectionChange?.([...selectedIds, id]);
  };

  // Client-side sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey], bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ column }) => {
    if (!column.sortable) return null;
    if (sortKey !== column.key) return <HiOutlineSortAscending className="w-3.5 h-3.5 ml-1" style={{ color: 'var(--text-disabled)' }} />;
    return sortDir === 'asc'
      ? <HiOutlineSortAscending className="w-3.5 h-3.5 ml-1" style={{ color: 'var(--primary)' }} />
      : <HiOutlineSortDescending className="w-3.5 h-3.5 ml-1" style={{ color: 'var(--primary)' }} />;
  };

  // Non-mobile columns (excluding hideOnMobile)
  const visibleCols = columns.filter(c => !c.hideOnMobile);
  // Primary column is the first visible one (for card view title)
  const primaryCol = visibleCols[0] || columns[0];

  if (loading) {
    return (
      <div className="rounded-xl border shadow-sm" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <div className={compact ? 'p-4 space-y-3 animate-pulse' : 'p-6 space-y-4 animate-pulse'}>
          <div className="flex gap-4">
            {Array.from({ length: Math.min(columns.length, 4) }).map((_, i) => (
              <div key={i} className="h-4 rounded flex-1 skeleton" />
            ))}
          </div>
          {Array.from({ length: compact ? 3 : 6 }).map((_, r) => (
            <div key={r} className="flex gap-4">
              {Array.from({ length: Math.min(columns.length, 4) }).map((_, c) => (
                <div key={c} className="h-6 rounded flex-1 skeleton" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: View Toggle + Search + Filters + Export */}
      {(onSearch || filters.length > 0 || onExport) && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Mobile view toggle */}
          <button
            onClick={() => setMobileView((v) => (v === 'table' ? 'cards' : 'table'))}
            className="btn-secondary flex items-center gap-2 text-sm lg:hidden"
            title={mobileView === 'table' ? 'Switch to card view' : 'Switch to table view'}
          >
            {mobileView === 'table' ? <HiOutlineViewList className="w-4 h-4" /> : <HiOutlineSelector className="w-4 h-4" />}
            {mobileView === 'table' ? 'Cards' : 'Table'}
          </button>

          {onSearch && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                className="form-input pl-10"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          )}
          {filters.length > 0 && (
            <>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-secondary flex items-center gap-2 text-sm"
                style={showFilters ? { backgroundColor: 'rgba(139, 158, 255, 0.1)', color: 'var(--primary)', borderColor: 'rgba(139, 158, 255, 0.3)' } : {}}
              >
                <HiOutlineFilter className="w-4 h-4" /> Filters
              </button>
              {showFilters && filters.map((f) => (
                <select key={f.key} className="form-input w-auto" value={f.value} onChange={(e) => f.onChange(e.target.value)}>
                  <option value="">{f.label}</option>
                  {f.options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ))}
            </>
          )}
          {onExport && (
            <button onClick={onExport} className="btn-secondary flex items-center gap-2 text-sm">
              <HiOutlineDownload className="w-4 h-4" /> {exportLabel}
            </button>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectable && selectedIds.length > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ backgroundColor: 'rgba(139, 158, 255, 0.08)', border: '1px solid rgba(139, 158, 255, 0.2)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{selectedIds.length} selected</span>
          <div className="flex gap-2 ml-auto">
            {bulkActions.map((action) => {
              const Icon = action.icon;
              const color = action.color || 'blue';
              const colorStyles = {
                red: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--accent-red)', hover: 'rgba(239, 68, 68, 0.2)' },
                green: { bg: 'rgba(34, 197, 94, 0.1)', text: 'var(--accent-green)', hover: 'rgba(34, 197, 94, 0.2)' },
                blue: { bg: 'rgba(139, 158, 255, 0.1)', text: 'var(--primary)', hover: 'rgba(139, 158, 255, 0.2)' },
              };
              const cs = colorStyles[color] || colorStyles.blue;
              return (
                <button key={action.label} onClick={() => action.onClick(selectedIds)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: cs.bg, color: cs.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cs.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = cs.bg}
                >
                  {Icon && <Icon className="w-4 h-4" />} {action.label}
                </button>
              );
            })}
            <button onClick={() => onSelectionChange?.([])} className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>Clear</button>
          </div>
        </div>
      )}          {/* ── DESKTOP TABLE VIEW ── */}
      <div className={`${mobileView === 'cards' ? 'hidden' : 'hidden sm:block'} table-container`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {selectable && (
                  <th className="table-header w-10 px-3">
                    <input type="checkbox" checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      className="rounded"
                      style={{ accentColor: 'var(--primary)' }} />
                  </th>
                )}
                {columns.map((col) => (
                  <th key={col.key}
                    className={`table-header ${col.sortable ? 'cursor-pointer select-none' : ''} ${col.className || ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                    onMouseEnter={(e) => { if (col.sortable) e.currentTarget.style.color = 'var(--primary)'; }}
                    onMouseLeave={(e) => { if (col.sortable) e.currentTarget.style.color = ''; }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center">
                      {col.label}
                      <SortIcon column={col} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {sortedData.map((row, idx) => (
                <tr key={row[rowKey]} onClick={() => onRowClick?.(row)}
                  className={`table-row ${onRowClick ? 'cursor-pointer' : ''}`}>
                  {selectable && (
                    <td className="table-cell w-10 px-3">
                      <input type="checkbox" checked={selectedIds.includes(row[rowKey])}
                        onChange={() => toggleSelect(row[rowKey])} onClick={(e) => e.stopPropagation()}
                        className="rounded"
                        style={{ accentColor: 'var(--primary)' }} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key}
                      className={`table-cell ${col.className || ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${compact ? 'py-2' : ''}`}
                      onClick={(e) => col.key === 'actions' && e.stopPropagation()}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
              {!sortedData.length && (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12">
                    <div className="empty-state">
                      <HiOutlineViewList className="w-10 h-10" style={{ color: 'var(--text-disabled)' }} />
                      <p className="empty-state-text">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && onPageChange && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Page {page} of {pages}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { if (page > 1) { e.currentTarget.style.backgroundColor = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
                <HiOutlineChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const items = [];
                  const start = Math.max(1, page - 2);
                  const end = Math.min(pages, page + 2);
                  if (start > 1) items.push(1);
                  if (start > 2) items.push('...');
                  for (let i = start; i <= end; i++) items.push(i);
                  if (end < pages - 1) items.push('...');
                  if (end < pages) items.push(pages);
                  return items;
                })().map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-2 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>...</span>
                  ) : (
                    <button key={p} onClick={() => onPageChange(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-150`}
                      style={p === page
                        ? { backgroundColor: 'var(--primary)', color: '#FFFFFF', boxShadow: 'var(--shadow-xs)' }
                        : { border: '1px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        if (p !== page) { e.currentTarget.style.backgroundColor = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; }
                      }}
                      onMouseLeave={(e) => {
                        if (p !== page) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }
                      }}
                    >{p}</button>
                  )
                )}
              </div>
              <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
                className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { if (page < pages) { e.currentTarget.style.backgroundColor = 'var(--card-hover)'; e.currentTarget.style.borderColor = 'var(--primary)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
                <HiOutlineChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE CARD VIEW ── */}
      <div className={`${mobileView === 'table' ? 'sm:hidden' : 'lg:hidden'} space-y-3`}>
        {sortedData.map((row) => (
          <div key={row[rowKey]}
            onClick={() => onRowClick?.(row)}
            className={`rounded-xl border shadow-sm overflow-hidden ${onRowClick ? 'cursor-pointer' : ''}`}
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
            {/* Checkbox + Primary field row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              {selectable && (
                <input type="checkbox" checked={selectedIds.includes(row[rowKey])}
                  onChange={() => toggleSelect(row[rowKey])} onClick={(e) => e.stopPropagation()}
                  className="rounded shrink-0 focus:ring-2"
                  style={{ accentColor: 'var(--primary)' }} />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {primaryCol.render ? primaryCol.render(row[primaryCol.key], row) : (row[primaryCol.key] ?? '-')}
                </span>
              </div>
            </div>

            {/* Detail fields */}
            <div className="px-4 py-2 space-y-1.5">
              {visibleCols.slice(1).map((col) => (
                <div key={col.key} className="flex items-center justify-between text-xs">
                  <span className="font-medium w-1/3" style={{ color: 'var(--text-muted)' }}>{col.mobileLabel || col.label}</span>
                  <span className="text-right w-2/3 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                  </span>
                </div>
              ))}
              {columns.filter(c => c.hideOnMobile).map((col) => (
                <div key={col.key} className="flex items-center justify-between text-xs">
                  <span className="font-medium w-1/3" style={{ color: 'var(--text-muted)' }}>{col.mobileLabel || col.label}</span>
                  <span className="text-right w-2/3 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions for mobile */}
            {columns.find(c => c.key === 'actions') && (
              <div className="px-4 py-2 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border-light)' }}>
                {columns.find(c => c.key === 'actions').render?.(row[rowKey], row)}
              </div>
            )}
          </div>
        ))}

        {!sortedData.length && (
          <div className="flex flex-col items-center gap-2 py-12" style={{ color: 'var(--text-muted)' }}>
            <HiOutlineDotsVertical className="w-8 h-8" style={{ color: 'var(--text-disabled)' }} />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        )}

        {/* Mobile pagination */}
        {pages > 1 && onPageChange && (
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Prev</button>
              <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
