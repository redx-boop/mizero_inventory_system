import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import { useDebounce } from '../utils/useDebounce';
import { useAuth } from '../context/AuthContext';
import { toastSuccess, toastError } from '../utils/toastUtils.jsx';
import {
  HiOutlinePencil, HiOutlineTrash, HiOutlinePlus,
  HiOutlineDownload, HiOutlineUpload, HiOutlineXCircle, HiOutlineCheckCircle,
  HiOutlineExclamation, HiOutlineChevronDown, HiOutlineChevronRight,
  HiOutlineCube, HiOutlineExclamationCircle, HiOutlineCurrencyDollar,
  HiOutlineViewList, HiOutlineRefresh
} from 'react-icons/hi';

const formatCurrency = (val) => {
  if (!val && val !== 0) return '-';
  const num = Number(val);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString(undefined, { minimumFractionDigits: 0 });
};

const formatCurrencyFull = (val) => {
  if (!val && val !== 0) return '-';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Inventory() {
  const { user, getUserDepartments } = useAuth();
  const userDeptIds = getUserDepartments();
  const isStaff = user?.role === 'staff' || user?.role_name === 'staff';
  const canManage = !isStaff;
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const [searchParams] = useSearchParams();

  // ── State ──
  const [groupedData, setGroupedData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: '', item_type: '', department_id: '',
    low_stock: searchParams.get('filter') === 'low-stock' ? 'true' : ''
  });
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const debouncedSearch = useDebounce(search, 400);

  // ── Modal state ──
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', category: '', unit: 'pcs', quantity: 0,
    minimum_stock: 0, unit_cost: '', currency: 'RWF',
    item_type: 'consumable', department_id: '', image: null
  });
  const [originalQuantity, setOriginalQuantity] = useState(0);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState('upload');
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importNonConsumableAction, setImportNonConsumableAction] = useState('skip');
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  // ── Data fetching ──
  const fetchGroupedItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.category) params.category = filters.category;
      if (filters.item_type) params.item_type = filters.item_type;
      if (filters.department_id) params.department_id = filters.department_id;
      if (filters.low_stock) params.low_stock = filters.low_stock;

      const { data } = await api.get('/items/grouped', { params });
      setGroupedData(data);

      // Auto-expand all departments that have items
      const deptsWithItems = data.departments.filter(d => d.item_count > 0);
      setExpandedDepts(new Set(deptsWithItems.map(d => d.id)));
    } catch {
      toastError('Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters]);

  useEffect(() => {
    fetchGroupedItems();
  }, [fetchGroupedItems]);

  useEffect(() => {
    fetchCategories();
    fetchDepartments();
  }, []);

  const fetchCategories = async () => {
    try { const { data } = await api.get('/items/categories'); setCategories(data); } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      if (['super_admin', 'admin'].includes(user?.role)) {
        setDepartments(data);
      } else {
        setDepartments(data.filter(d => userDeptIds.includes(d.id)));
      }
    } catch {}
  };

  // ── CRUD handlers ──
  const resetForm = () => {
    setForm({
      name: '', description: '', category: '', unit: 'pcs', quantity: 0,
      minimum_stock: 0, unit_cost: '', currency: 'RWF',
      item_type: 'consumable', department_id: '', image: null
    });
    setOriginalQuantity(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(form).forEach(([key, val]) => {
      if (key === 'image' && val instanceof File) formData.append('image', val);
      else if (key !== 'image') formData.append(key, val);
    });

    try {
      if (editing) {
        await api.put(`/items/${editing.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toastSuccess('Item updated');
      } else {
        await api.post('/items', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toastSuccess('Item created');
      }
      setShowModal(false);
      setEditing(null);
      resetForm();
      fetchGroupedItems();
      fetchCategories();
    } catch (error) {
      toastError(error.response?.data?.message || 'Failed to save item');
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setOriginalQuantity(item.quantity);
    setForm({
      name: item.name, description: item.description || '',
      category: item.category || '', unit: item.unit, quantity: '',
      minimum_stock: item.minimum_stock, unit_cost: item.unit_cost || '',
      currency: item.currency || 'RWF', item_type: item.item_type,
      department_id: item.department_id || '', image: null
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/items/${id}`);
      toastSuccess('Item deleted');
      fetchGroupedItems();
    } catch (error) {
      toastError(error.response?.data?.message || 'Failed to delete item');
    }
  };

  const handleBulkDelete = async (ids) => {
    if (!confirm(`Delete ${ids.length} items?`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/items/${id}`)));
      toastSuccess(`${ids.length} items deleted`);
      setSelectedIds([]);
      fetchGroupedItems();
    } catch {
      toastError('Failed to delete some items');
    }
  };

  // ── CSV handlers ──
  const handleExportCsv = async () => {
    try {
      const { data } = await api.get('/items/export/csv', { params: filters, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory.csv';
      a.click();
      toastSuccess('CSV exported');
    } catch {
      toastError('Failed to export CSV');
    }
  };

  const handlePreviewCsv = async (file) => {
    if (!file) return;
    setImportFile(file);
    setImportLoading(true);
    setImportError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/items/import/csv/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportPreview(data);
      setImportStep('preview');
    } catch (error) {
      setImportError(error.response?.data?.message || 'Failed to preview CSV');
      setImportStep('upload');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportCsv = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportError(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const params = importPreview?.predictedNonConsumableWarning > 0
        ? `?nonConsumableAction=${importNonConsumableAction}` : '';
      const { data } = await api.post(`/items/import/csv${params}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(data);
      setImportStep('result');
      fetchGroupedItems();
    } catch (error) {
      const errData = error.response?.data;
      if (errData?.errors) {
        setImportResult({ ...errData, errors: errData.errors });
        setImportStep('result');
      } else {
        setImportError(errData?.message || 'Failed to import CSV');
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { data } = await api.get('/items/export/csv/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory-import-template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toastSuccess('Template downloaded');
    } catch {
      toastError('Failed to download template');
    }
  };

  const resetImport = () => {
    setImportStep('upload');
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setImportError(null);
    setImportNonConsumableAction('skip');
  };

  // ── Toggle department expansion ──
  const toggleDept = (deptId) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  // ── Derived state ──
  const allItems = useMemo(() => {
    if (!groupedData?.departments) return [];
    const items = [];
    for (const dept of groupedData.departments) {
      for (const item of dept.items) {
        items.push(item);
      }
    }
    return items;
  }, [groupedData]);

  const totals = groupedData?.totals || { total_items: 0, total_quantity: 0, total_value: 0, low_stock_count: 0, department_count: 0 };

  // ── Filter options ──
  const categoryOptions = categories.map((c) => ({ value: c, label: c }));
  const typeOptions = [
    { value: 'consumable', label: 'Consumable' },
    { value: 'non-consumable', label: 'Non-Consumable' },
  ];
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  const quickFilters = [
    { label: 'All', active: !filters.category && !filters.item_type && !filters.department_id && !filters.low_stock,
      onClick: () => setFilters({ category: '', item_type: '', department_id: '', low_stock: '' }) },
    { label: 'Low Stock', active: filters.low_stock === 'true',
      onClick: () => setFilters({ ...filters, low_stock: filters.low_stock === 'true' ? '' : 'true' }) },
    { label: 'Consumable', active: filters.item_type === 'consumable',
      onClick: () => setFilters({ ...filters, item_type: filters.item_type === 'consumable' ? '' : 'consumable' }) },
    { label: 'Non-Consumable', active: filters.item_type === 'non-consumable',
      onClick: () => setFilters({ ...filters, item_type: filters.item_type === 'non-consumable' ? '' : 'non-consumable' }) },
  ];

  const activeFilterChips = [];
  if (filters.category) activeFilterChips.push({ key: 'category', label: 'Category', value: filters.category, onRemove: () => setFilters({ ...filters, category: '' }) });
  if (filters.item_type) activeFilterChips.push({ key: 'type', label: 'Type', value: filters.item_type, onRemove: () => setFilters({ ...filters, item_type: '' }) });
  if (filters.department_id) {
    const dept = departments.find(d => d.id == filters.department_id);
    activeFilterChips.push({ key: 'dept', label: 'Department', value: dept?.name || filters.department_id, onRemove: () => setFilters({ ...filters, department_id: '' }) });
  }
  if (filters.low_stock) activeFilterChips.push({ key: 'low', label: 'Low Stock', value: 'Active', onRemove: () => setFilters({ ...filters, low_stock: '' }) });

  const dataTableFilters = [
    { key: 'category', label: 'All Categories', value: filters.category, onChange: (v) => setFilters({ ...filters, category: v }), options: categoryOptions },
    { key: 'type', label: 'All Types', value: filters.item_type, onChange: (v) => setFilters({ ...filters, item_type: v }), options: typeOptions },
    { key: 'dept', label: 'All Departments', value: filters.department_id, onChange: (v) => setFilters({ ...filters, department_id: v }), options: departmentOptions },
  ];

  // ── Summary row for each item ──
  const itemColumns = [
    { key: 'sku', label: 'SKU', className: 'font-mono text-xs', hideOnMobile: true },
    { key: 'name', label: 'Name', className: 'font-medium',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          {row.image_url && (
            <img src={row.image_url} alt="" className="w-7 h-7 rounded-lg object-cover" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          )}
          <span>{val}</span>
        </div>
      )
    },
    { key: 'category', label: 'Category', hideOnMobile: true, render: (v) => v || '-' },
    { key: 'quantity', label: 'Qty',
      render: (val, row) => (
        <span className="font-semibold" style={val <= row.minimum_stock ? { color: 'var(--accent-red)' } : { color: 'var(--text-primary)' }}>
          {val}
        </span>
      )
    },
    ...(isStaff ? [] : [
      { key: 'unit_cost', label: 'Unit Cost', hideOnMobile: true,
        render: (v) => v ? <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCurrencyFull(v)}</span> : '-'
      },
    ]),
    { key: 'item_type', label: 'Type', hideOnMobile: true,
      render: (v) => (
        <span className={v === 'consumable' ? 'badge-info' : 'badge-success'}>{v}</span>
      )
    },
    ...(canManage ? [{
      key: 'actions', label: '', className: 'text-right w-20',
      render: (_, row) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleEdit(row)}
            className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(139, 158, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="Edit">
            <HiOutlinePencil className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button onClick={() => handleDelete(row.id)}
              className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--accent-red)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="Delete">
              <HiOutlineTrash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Inventory</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isStaff
              ? 'Browse inventory items in your departments'
              : 'Manage stock items, grouped by department'
            }
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
              <HiOutlineDownload className="w-4 h-4" /> Template
            </button>
          )}
          {canManage && (
            <button onClick={() => { resetImport(); setShowImportModal(true); }} className="btn-secondary flex items-center gap-2 text-sm">
              <HiOutlineUpload className="w-4 h-4" /> Import
            </button>
          )}
          {canManage && (
            <button onClick={() => { setEditing(null); resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
              <HiOutlinePlus className="w-4 h-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* ── Search + Quick Filters ── */}
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, SKU, or category..."
        filters={activeFilterChips}
        quickFilters={quickFilters}
        loading={loading}
      />

      {/* ── Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(139, 158, 255, 0.08)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{totals.total_items}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Items</p>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent-green)' }}>{totals.total_quantity}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Qty</p>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
          <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{formatCurrency(totals.total_value)}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Value</p>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent-red)' }}>{totals.low_stock_count}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Low Stock</p>
        </div>
      </div>

      {/* ── Department Groups ── */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6">
              <div className="h-6 w-48 rounded skeleton mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-10 rounded skeleton" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !groupedData || groupedData.departments.length === 0 ? (
        <div className="card py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <HiOutlineCube className="w-12 h-12" style={{ color: 'var(--text-disabled)' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>No items found</p>
            <p className="text-sm" style={{ color: 'var(--text-disabled)' }}>
              {search || Object.values(filters).some(Boolean)
                ? 'Try adjusting your search or filters'
                : 'Add your first item to get started'
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedData.departments.map((dept) => {
            const isExpanded = expandedDepts.has(dept.id);
            const visibleItems = dept.items;
            const deptLowStock = visibleItems.filter(i => Number(i.quantity) <= Number(i.minimum_stock));

            return (
              <div key={dept.id} className="card overflow-hidden">
                {/* ── Department Header ── */}
                <button
                  onClick={() => toggleDept(dept.id)}
                  className="w-full flex items-center gap-4 p-4 sm:px-6 sm:py-4 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  style={{ borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none' }}
                >
                  <div className={`p-2 rounded-lg transition-transform duration-200 ${isExpanded ? 'bg-primary/10' : ''}`}
                    style={{ backgroundColor: isExpanded ? 'rgba(139, 158, 255, 0.1)' : 'var(--bg-secondary)' }}>
                    {isExpanded
                      ? <HiOutlineChevronDown className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                      : <HiOutlineChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{dept.name}</h3>
                      {deptLowStock.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red)' }}>
                          {deptLowStock.length} low stock
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {dept.item_count} item{dept.item_count !== 1 ? 's' : ''}
                      {dept.total_quantity > 0 && ` • Qty ${dept.total_quantity}`}
                      {dept.total_value > 0 && ` • Value ${formatCurrency(dept.total_value)}`}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-xs font-semibold">
                    <span style={{ color: 'var(--text-muted)' }}>
                      {dept.item_count} items
                    </span>
                    <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', color: 'var(--accent-green)' }}>
                      Qty: {dept.total_quantity}
                    </span>
                    {dept.total_value > 0 && (
                      <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>
                        {formatCurrency(dept.total_value)}
                      </span>
                    )}
                    {deptLowStock.length > 0 && (
                      <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--accent-red)' }}>
                        {deptLowStock.length} low
                      </span>
                    )}
                  </div>
                </button>

                {/* ── Department Items ── */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    {visibleItems.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-sm" style={{ color: 'var(--text-disabled)' }}>No items in this department</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr>
                            {(canManage) && (
                              <th className="table-header w-10 px-3">
                                <input type="checkbox"
                                  checked={visibleItems.length > 0 && visibleItems.every(i => selectedIds.includes(i.id))}
                                  ref={(el) => {
                                    if (el) {
                                      const some = visibleItems.some(i => selectedIds.includes(i.id));
                                      const all = visibleItems.every(i => selectedIds.includes(i.id));
                                      el.indeterminate = some && !all;
                                    }
                                  }}
                                  onChange={() => {
                                    const allSelected = visibleItems.every(i => selectedIds.includes(i.id));
                                    if (allSelected) {
                                      setSelectedIds(prev => prev.filter(id => !visibleItems.some(i => i.id === id)));
                                    } else {
                                      const toAdd = visibleItems.filter(i => !selectedIds.includes(i.id)).map(i => i.id);
                                      setSelectedIds(prev => [...prev, ...toAdd]);
                                    }
                                  }}
                                  className="rounded" style={{ accentColor: 'var(--primary)' }} />
                              </th>
                            )}
                            {itemColumns.map((col) => (
                              <th key={col.key}
                                className={`table-header ${col.className || ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                          {visibleItems.map((item) => (
                            <tr key={item.id} className="table-row">
                              {(canManage) && (
                                <td className="table-cell w-10 px-3">
                                  <input type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => {
                                      if (selectedIds.includes(item.id)) {
                                        setSelectedIds(prev => prev.filter(id => id !== item.id));
                                      } else {
                                        setSelectedIds(prev => [...prev, item.id]);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded" style={{ accentColor: 'var(--primary)' }} />
                                </td>
                              )}
                              {itemColumns.map((col) => (
                                <td key={col.key}
                                  className={`table-cell ${col.className || ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                                  onClick={(e) => col.key === 'actions' && e.stopPropagation()}>
                                  {col.render ? col.render(item[col.key], item) : item[col.key] ?? '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-xl shadow-lg"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              {selectedIds.length} selected
            </span>
            {isAdmin && (
              <button onClick={() => handleBulkDelete(selectedIds)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'}>
                <HiOutlineTrash className="w-4 h-4 inline mr-1" /> Delete
              </button>
            )}
            <button onClick={() => setSelectedIds([])}
              className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Item' : 'Add New Item'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Category</label>
              <input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="categories" />
              <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="form-label">Unit *</label>
              <input className="form-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Item Type</label>
              <select className="form-input" value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
                <option value="consumable">Consumable</option>
                <option value="non-consumable">Non-Consumable</option>
              </select>
            </div>
            <div>
              <label className="form-label">{editing ? 'Current Quantity' : 'Quantity'}</label>
              {editing ? (
                <div className="form-input flex items-center gap-2" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'default' }}>
                  <span>{originalQuantity}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(use Stock In/Out)</span>
                </div>
              ) : (
                <input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="0" />
              )}
            </div>
            <div>
              <label className="form-label">Unit Cost</label>
              <input type="number" className="form-input" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} min="0" step="0.01" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select className="form-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="form-label">Minimum Stock</label>
              <input type="number" className="form-input" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: parseInt(e.target.value) || 0 })} min="0" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Department *</label>
              <select className="form-input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Import Modal ── */}
      <Modal isOpen={showImportModal} onClose={() => { setShowImportModal(false); resetImport(); }} title="Import Inventory from CSV" size="lg">
        {importStep === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(139, 158, 255, 0.05)', border: '1px solid rgba(139, 158, 255, 0.2)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--primary)' }}>Official CSV Format</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Your CSV must include these columns in any order:
              </p>
              <code className="block mt-2 text-xs px-3 py-2 rounded font-mono" style={{ backgroundColor: 'rgba(139, 158, 255, 0.1)', color: 'var(--text-primary)' }}>
                name, category, unit, quantity, minimum_stock, item_type, department, unit_cost, currency
              </code>
            </div>

            <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{ borderColor: 'var(--border-color)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(139, 158, 255, 0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              onClick={() => document.getElementById('csv-file-input').click()}>
              <HiOutlineUpload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {importFile ? importFile.name : 'Click to select CSV file'}
              </p>
              {importFile && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{(importFile.size / 1024).toFixed(1)} KB</p>}
              {!importFile && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Supports .csv files up to 10MB, max 5000 rows</p>}
              <input id="csv-file-input" type="file" accept=".csv" className="hidden"
                onChange={(e) => { const file = e.target.files[0]; if (file) handlePreviewCsv(file); }} />
            </div>

            {importError && (
              <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)' }}>
                <HiOutlineExclamation className="w-4 h-4 inline mr-1" />{importError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowImportModal(false); resetImport(); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {importStep === 'preview' && importPreview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{importPreview.totalRows}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Rows</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-green)' }}>{importPreview.validCount}</p>
                <p className="text-xs" style={{ color: 'var(--accent-green)' }}>Valid</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: importPreview.invalidCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)' }}>
                <p className="text-2xl font-bold" style={{ color: importPreview.invalidCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{importPreview.invalidCount}</p>
                <p className="text-xs" style={{ color: importPreview.invalidCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>Invalid</p>
              </div>
            </div>

            {importPreview.invalidRows?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent-red)' }}>
                  <HiOutlineXCircle className="w-4 h-4" />{importPreview.invalidCount} Row{importPreview.invalidCount > 1 ? 's' : ''} with Errors
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <table className="w-full text-xs">
                    <thead style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                      <tr><th className="px-3 py-2 text-left" style={{ color: 'var(--accent-red)' }}>Row</th><th className="px-3 py-2 text-left" style={{ color: 'var(--accent-red)' }}>Field</th><th className="px-3 py-2 text-left" style={{ color: 'var(--accent-red)' }}>Error</th></tr>
                    </thead>
                    <tbody>
                      {importPreview.invalidRows.map((err, i) => (
                        <tr key={i} className="table-row" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--accent-red)' }}>{err.row}</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{err.field}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--accent-red)' }}>{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importPreview.validCount > 0 && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <div className="flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>
                  <HiOutlineCheckCircle className="w-4 h-4" />{importPreview.validCount} Valid Row{importPreview.validCount > 1 ? 's' : ''} Ready to Import
                </div>
              </div>
            )}

            {importPreview.predictedConsumableMerge > 0 && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <p className="text-xs" style={{ color: 'var(--accent-indigo)' }}>
                  <strong>{importPreview.predictedConsumableMerge}</strong> consumable row{importPreview.predictedConsumableMerge > 1 ? 's' : ''} will be <strong>auto-merged</strong>.
                </p>
              </div>
            )}
            {importPreview.predictedNonConsumableWarning > 0 && (
              <div className="space-y-2">
                <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                  <p className="text-xs" style={{ color: '#92400e' }}>
                    <strong>⚠️ {importPreview.predictedNonConsumableWarning}</strong> non-consumable row{importPreview.predictedNonConsumableWarning > 1 ? 's' : ''} match existing items.
                  </p>
                </div>
                <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Handle duplicates:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: 'skip', label: 'Skip' }, { value: 'create', label: 'Create New' }, { value: 'update', label: 'Update' }].map(opt => (
                    <label key={opt.value}
                      className="flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all"
                      style={{ borderColor: importNonConsumableAction === opt.value ? 'var(--accent-orange)' : 'var(--border-color)', backgroundColor: importNonConsumableAction === opt.value ? 'rgba(249, 115, 22, 0.08)' : 'transparent' }}>
                      <input type="radio" name="ncAction" value={opt.value} checked={importNonConsumableAction === opt.value}
                        onChange={() => setImportNonConsumableAction(opt.value)} className="sr-only" />
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{opt.label}</p>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {importPreview.predictedRestored > 0 && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <p className="text-xs" style={{ color: 'var(--accent-green)' }}>♻️ <strong>{importPreview.predictedRestored}</strong> soft-deleted item{importPreview.predictedRestored > 1 ? 's' : ''} will be <strong>restored</strong>.</p>
              </div>
            )}

            <div className="flex gap-2 justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button onClick={() => setImportStep('upload')} className="btn-secondary text-sm">← Back</button>
              <div className="flex gap-2">
                <button onClick={() => { setShowImportModal(false); resetImport(); }} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleImportCsv} disabled={importPreview.validCount === 0 || importLoading}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                  {importLoading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Importing...</>
                  ) : (
                    <><HiOutlineUpload className="w-4 h-4" /> Import {importPreview.validCount} Row{importPreview.validCount > 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {importStep === 'result' && importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-green)' }}>{importResult.inserted || 0}</p>
                <p className="text-xs" style={{ color: 'var(--accent-green)' }}>Inserted</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-indigo)' }}>{importResult.merged || 0}</p>
                <p className="text-xs" style={{ color: 'var(--accent-indigo)' }}>Merged</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)' }}>
                <p className="text-2xl font-bold" style={{ color: '#92400e' }}>{importResult.restored || 0}</p>
                <p className="text-xs" style={{ color: '#92400e' }}>Restored</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: importResult.invalidSkipped > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)' }}>
                <p className="text-2xl font-bold" style={{ color: importResult.invalidSkipped > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{importResult.invalidSkipped || 0}</p>
                <p className="text-xs" style={{ color: importResult.invalidSkipped > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>Skipped</p>
              </div>
            </div>
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--accent-green)' }}>
              <HiOutlineCheckCircle className="w-4 h-4 inline mr-1" />{importResult.message}
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button onClick={() => { setShowImportModal(false); resetImport(); }} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
