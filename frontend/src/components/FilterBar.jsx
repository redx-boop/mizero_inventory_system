import { useState, useEffect, memo } from 'react';
import api from '../services/api';
import { HiOutlineSearch, HiOutlineX, HiOutlineCalendar } from 'react-icons/hi';

const FilterBar = memo(function FilterBar({
  onFilterChange,
  showSearch = true,
  searchPlaceholder = 'Search...',
  showDateRange = true,
  dateRangeLabel = 'Date',
  showStatus = false,
  statusOptions = [],
  statusLabel = 'Status',
  showDepartment = false,
  showItemFilter = false,
  showUserFilter = false,
  userFilterLabel = 'Created By',
  userFilterOptions,
  showSort = true,
  sortOptions = [],
  defaultSort = 'created_at',
  showAmountRange = false,
  amountLabel = 'Amount',
  showType = false,
  typeOptions = [],
  showPageSize = true,
  pageSize = 20,
  onPageSizeChange,
  extraFilters
}) {
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [items, setItems] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('');
  const [sortBy, setSortBy] = useState(defaultSort);
  const [sortOrder, setSortOrder] = useState('desc');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  useEffect(() => {
    if (showDepartment) {
      api.get('/departments').then(({ data }) => setDepartments(data)).catch(() => {});
    }
  }, [showDepartment]);

  useEffect(() => {
    if (showItemFilter && itemSearch.length >= 1) {
      const timer = setTimeout(async () => {
        try {
          const { data } = await api.get('/items', { params: { limit: 50, search: itemSearch } });
          setItems(data.items || data.records || data || []);
        } catch { setItems([]); }
      }, 300);
      return () => clearTimeout(timer);
    } else if (showItemFilter && itemSearch.length === 0) {
      setItems([]);
      setShowItemDropdown(false);
    }
  }, [itemSearch, showItemFilter]);

  function computeDateRange(preset) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const mondayStr = monday.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    switch (preset) {
      case 'today': return { from: today, to: today };
      case 'yesterday': return { from: yesterdayStr, to: yesterdayStr };
      case 'this_week': return { from: mondayStr, to: today };
      case 'this_month': return { from: monthStartStr, to: today };
      case 'custom': return { from: fromDate, to: toDate };
      default: return { from: '', to: '' };
    }
  }

  useEffect(() => {
    const { from, to } = computeDateRange(datePreset);
    const filters = {};
    if (search.trim()) filters.search = search.trim();
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (status) filters.status = status;
    if (departmentId) filters.department_id = departmentId;
    if (itemId) filters.item_id = itemId;
    if (userId) filters.user_id = userId;
    if (type) filters.type = type;
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;
    if (minAmount) filters.min_amount = minAmount;
    if (maxAmount) filters.max_amount = maxAmount;
    onFilterChange?.(filters);
  }, [search, datePreset, fromDate, toDate, status, departmentId, itemId, userId, type, sortBy, sortOrder, minAmount, maxAmount]);

  const resetFilters = () => {
    setSearch(''); setDatePreset(''); setFromDate(''); setToDate('');
    setStatus(''); setDepartmentId(''); setItemSearch(''); setItemId('');
    setUserId(''); setType(''); setMinAmount(''); setMaxAmount('');
    setSortBy(defaultSort); setSortOrder('desc');
  };

  const hasActiveFilters = search || datePreset || status || departmentId || itemId || userId || type || minAmount || maxAmount;

  const inputStyle = {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    outline: 'none',
  };

  return (
    <div className="card p-4 space-y-3" style={{ boxShadow: 'var(--shadow-xs)' }}>
      <div className="flex flex-wrap items-center gap-3">
        {showSearch && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-disabled)' }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <HiOutlineX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {showDateRange && (
          <div className="flex items-center gap-2">
            <HiOutlineCalendar className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="form-input w-auto">
              <option value="">All {dateRangeLabel}s</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        )}

        {showStatus && statusOptions.length > 0 && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input w-auto">
            <option value="">All {statusLabel}</option>
            {statusOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        )}

        {showType && typeOptions.length > 0 && (
          <select value={type} onChange={(e) => setType(e.target.value)} className="form-input w-auto">
            <option value="">All Types</option>
            {typeOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        )}

        {showDepartment && (
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="form-input w-auto">
            <option value="">All Departments</option>
            {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
        )}

        {showAmountRange && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{amountLabel}:</span>
            <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min"
              className="form-input" style={{ width: '5rem' }} min="0" step="0.01" />
            <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>-</span>
            <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max"
              className="form-input" style={{ width: '5rem' }} min="0" step="0.01" />
          </div>
        )}

        {showSort && sortOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-input w-auto">
              {sortOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="form-input" style={{ padding: '0.5rem', cursor: 'pointer', width: 'auto' }}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        )}

        {hasActiveFilters && (
          <button onClick={resetFilters} className="btn-secondary flex items-center gap-1 text-sm">
            <HiOutlineX className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {datePreset === 'custom' && (
        <div className="flex items-center gap-3">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }} />
          <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }} />
        </div>
      )}

      {showItemFilter && (
        <div className="relative">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Filter by Item:</label>
          <input type="text" value={itemSearch}
            onChange={(e) => { setItemSearch(e.target.value); setShowItemDropdown(true); setItemId(''); }}
            placeholder="Type item name or SKU..."
            style={{ ...inputStyle, width: '100%', maxWidth: '24rem' }}
            onFocus={() => itemSearch.length >= 1 && setShowItemDropdown(true)}
            onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)} />
          {itemId && (
            <span className="ml-2 text-xs" style={{ color: 'var(--accent-green)' }}>Selected: {items.find(i => String(i.id) === String(itemId))?.name || itemSearch}</span>
          )}
          {showItemDropdown && items.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-w-md rounded-lg shadow-lg max-h-48 overflow-y-auto"
              style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              {items.map((item) => (
                <button key={item.id} type="button"
                  onMouseDown={() => { setItemId(item.id); setItemSearch(`${item.name} (${item.sku})`); setShowItemDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{ color: String(item.id) === String(itemId) ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{item.sku}</span>
                  {item.quantity !== undefined && (
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>Qty: {item.quantity}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {extraFilters}

      {showPageSize && onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Rows per page:</span>
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} style={inputStyle}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      )}
    </div>
  );
});

export default FilterBar;
