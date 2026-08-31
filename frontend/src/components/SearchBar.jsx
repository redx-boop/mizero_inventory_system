import { useState, useRef, useEffect } from 'react';
import { HiOutlineSearch, HiOutlineX, HiOutlineFilter } from 'react-icons/hi';

export default function SearchBar({
  value = '',
  onChange,
  placeholder = 'Search...',
  filters = [],
  quickFilters = [],
  onClear,
  loading = false,
  className = '',
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className={`relative flex items-center transition-all duration-200 rounded-lg ${focused ? 'ring-2 ring-offset-0' : ''}`}
        style={{
          boxShadow: focused ? '0 0 0 3px rgba(139, 158, 255, 0.15)' : 'none',
        }}>
        <div className="absolute left-3 flex items-center pointer-events-none">
          {loading ? (
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--primary)' }} />
          ) : (
            <HiOutlineSearch className="w-4 h-4" style={{ color: 'var(--text-disabled)' }} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all duration-150"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        {value && (
          <button
            onClick={() => {
              onChange?.('');
              onClear?.();
              inputRef.current?.focus();
            }}
            className="absolute right-3 p-0.5 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: 'var(--text-muted)' }}
          >
            <HiOutlineX className="w-4 h-4" />
          </button>
        )}
      </div>

      {quickFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((qf) => (
            <button
              key={qf.label}
              onClick={qf.onClick}
              className={qf.active ? 'chip chip-active' : 'chip chip-inactive'}
            >
              {qf.label}
            </button>
          ))}
        </div>
      )}

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <HiOutlineFilter className="w-3.5 h-3.5 mt-0.5" style={{ color: 'var(--text-muted)' }} />
          {filters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: 'rgba(139, 158, 255, 0.1)', color: 'var(--primary-dark)', boxShadow: 'inset 0 0 0 1px rgba(139, 158, 255, 0.3)' }}
            >
              {filter.label}: {filter.value}
              <button onClick={filter.onRemove} className="ml-0.5 hover:opacity-70">
                <HiOutlineX className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
