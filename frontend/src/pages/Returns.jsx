import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye } from 'react-icons/hi';
import { formatCurrency } from '../utils/format';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'return_date', label: 'Return Date' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'borrower_name', label: 'Borrower' },
  { value: 'returned_quantity', label: 'Returned Qty' }
];

export default function Returns() {
  const { user, getUserDepartments } = useAuth();
  const userDeptIds = getUserDepartments();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [borrowings, setBorrowings] = useState([]);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedBorrowing, setSelectedBorrowing] = useState(null);
  const [form, setForm] = useState({ borrowing_id: '', returned_quantity: 1, condition: 'good', notes: '', return_date: new Date().toISOString().split('T')[0] });

  // Build a map of borrowing_id -> department_id from items
  const borrowingDeptMap =
    borrowings.length && items.length
      ? borrowings.reduce((map, b) => {
          const item = items.find(i => i.id === b.item_id);
          if (item) map[b.id] = item.department_id ?? '';
          return map;
        }, {})
      : {};

  const filteredBorrowings = selectedDeptId === 'all'
    ? borrowings
    : selectedDeptId
      ? borrowings.filter(b => String(borrowingDeptMap[b.id]) === String(selectedDeptId))
      : [];

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || 1, limit: pageSize, ...filters };
      const { data } = await api.get('/returns', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch returns'); }
  }, [filters, pageSize]);

  useEffect(() => { fetchRecords(1); fetchBorrowings(); fetchItems(); fetchDepartments(); }, [filters, pageSize]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
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

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/items', { params: { limit: 1000 } });
      setItems(data.items);
    } catch {}
  };

  const fetchBorrowings = async () => {
    try {
      const { data } = await api.get('/borrowings', { params: { limit: 1000, status: 'borrowed' } });
      setBorrowings(data.records);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.condition === 'damaged' || form.condition === 'lost') {
        // Damaged (half price) and lost (full price) are recorded as liabilities, NOT returns
        const { data } = await api.post('/damage-liabilities', {
          borrowing_id: form.borrowing_id,
          returned_quantity: form.returned_quantity,
          liability_type: form.condition,
          notes: form.notes
        });
        toast.success(data.message);
      } else {
        await api.post('/returns', form);
        toast.success('Return recorded');
      }
      setShowModal(false);
      setSelectedBorrowing(null);
      setForm({ borrowing_id: '', returned_quantity: 1, condition: 'good', notes: '', return_date: new Date().toISOString().split('T')[0] });
      fetchRecords();
      fetchBorrowings();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to record';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Returns</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage returned borrowed items and their condition</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Record Return
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, borrower..."
        showStatus={false}
        showSort={true}
        sortOptions={SORT_OPTIONS}
        defaultSort="created_at"
        showPageSize={true}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <tr>
                <th className="table-header">Return Date</th>
                <th className="table-header">Item</th>
                <th className="table-header">Borrower</th>
                <th className="table-header">Returned Qty</th>
                <th className="table-header">Condition</th>
                <th className="table-header">Notes</th>
              <th className="table-header">Recorded By</th>
              <th className="table-header">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">{new Date(r.return_date).toLocaleDateString()}</td>
                  <td className="table-cell font-medium">{r.item_name}</td>
                  <td className="table-cell">{r.borrower_name}</td>
                  <td className="table-cell">{r.returned_quantity}</td>
                  <td className="table-cell">
                    <span className={{
                      good: 'badge-success',
                      damaged: 'badge-warning',
                      lost: 'badge-danger'
                    }[r.item_condition] || 'badge-info'}>{r.item_condition}</span>
                  </td>
                  <td className="table-cell">{r.notes || '-'}</td>
                  <td className="table-cell">{r.created_by_name || '-'}</td>
                  <td className="table-cell">
                    <button onClick={() => { setSelectedRecord(r); setShowDetail(true); }} className="text-blue-600 hover:text-blue-800" title="View Details">
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No returns found</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {records.length ? ((pagination.page - 1) * pageSize) + 1 : 0}-{Math.min(pagination.page * pageSize, pagination.total)} of {pagination.total} records
          </span>
          <Pagination page={pagination.page} pages={pagination.pages} onPageChange={(p) => {
            setPagination(prev => ({ ...prev, page: p }));
            fetchRecords(p);
          }} />
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Return">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Department</label>
            <select className="form-input" value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setSelectedBorrowing(null); setForm({ ...form, borrowing_id: '' }); }}>
              <option value="">Select Department</option>
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {selectedDeptId === '' && (
              <p className="text-xs text-amber-600 mt-1">Tip: Select &quot;All Departments&quot; to see all borrowings, or pick a specific department to filter.</p>
            )}
          </div>
          <div>
            <label className="form-label">Borrowing *</label>
            <select className="form-input" value={form.borrowing_id}
              onChange={(e) => {
                const b = (selectedDeptId === 'all' ? borrowings : filteredBorrowings).find(bor => String(bor.id) === e.target.value);
                setSelectedBorrowing(b || null);
                setForm({ ...form, borrowing_id: e.target.value, returned_quantity: 1 });
              }}
              required disabled={!selectedDeptId}>
              <option value="">{selectedDeptId ? 'Select Borrowing' : 'Select a department first'}</option>
              {(selectedDeptId === 'all' ? borrowings : filteredBorrowings).map((b) => {
                const remaining = b.remaining_qty ?? b.quantity;
                return remaining > 0 ? (
                  <option key={b.id} value={b.id}>
                    {b.borrower_name} - {b.item_name} (Issued: {b.quantity} | Remaining: {remaining})
                  </option>
                ) : null;
              })}
            </select>
            {selectedBorrowing && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>Originally issued:</span>
                  <span className="font-semibold">{selectedBorrowing.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Already returned:</span>
                  <span className="font-semibold">{selectedBorrowing.already_returned || 0}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                  <span className="font-medium">Available to return:</span>
                  <span className="font-semibold text-green-700">{selectedBorrowing.remaining_qty ?? selectedBorrowing.quantity}</span>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{form.condition === 'damaged' ? 'Damaged Qty *' : form.condition === 'lost' ? 'Lost Qty *' : 'Returned Qty *'}</label>
              {(form.condition === 'damaged' || form.condition === 'lost') && (
                <p className="text-xs text-amber-600 mb-1">Only the {form.condition === 'lost' ? 'lost' : 'damaged'} quantity (max: {selectedBorrowing?.remaining_qty ?? '-'})</p>
              )}
              <input type="number" className="form-input" value={form.returned_quantity}
                onChange={(e) => setForm({ ...form, returned_quantity: parseInt(e.target.value) || 0 })}
                min="1" max={selectedBorrowing ? (selectedBorrowing.remaining_qty ?? selectedBorrowing.quantity) : 99999} required />
              {selectedBorrowing && (form.condition === 'damaged' || form.condition === 'lost') && form.returned_quantity > 0 && (
                <div className="mt-1 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  Unit Cost: {formatCurrency(selectedBorrowing.unit_cost_at_time || 0)} RWF
                  {' × '}{form.returned_quantity} = <strong>{formatCurrency(form.returned_quantity * parseFloat(selectedBorrowing.unit_cost_at_time || 0))} RWF</strong>
                  {' → '}{form.condition === 'lost' ? '100% Liability' : '50% Liability'}: <strong>{formatCurrency(form.returned_quantity * parseFloat(selectedBorrowing.unit_cost_at_time || 0) * (form.condition === 'lost' ? 1 : 0.5))} RWF</strong>
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Return Date</label>
              <input type="date" className="form-input" value={form.return_date} disabled />
            </div>
          </div>
          <div>              <label className="form-label">Condition *</label>
            <select className="form-input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value, returned_quantity: 1 })}>
              <option value="good">Good — return to inventory</option>
              <option value="damaged">Damaged — record as liability (pay half price)</option>
              <option value="lost">Lost — record as liability (pay full price)</option>
            </select>
            {(form.condition === 'damaged' || form.condition === 'lost') && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <p className="font-medium">⚠ This will NOT be recorded as a return.</p>
                {form.condition === 'damaged' ? (
                  <p className="mt-1">A <strong>damage liability</strong> will be created for <strong>{selectedBorrowing?.borrower_name || 'the borrower'}</strong>.
                  They must pay <strong>half</strong> the replacement cost. Use the <strong>Damage Liabilities</strong> page to track and mark as paid.</p>
                ) : (
                  <p className="mt-1">A <strong>loss liability</strong> will be created for <strong>{selectedBorrowing?.borrower_name || 'the borrower'}</strong>.
                  They must pay the <strong>full</strong> replacement cost. Use the <strong>Damage Liabilities</strong> page to track and mark as paid.</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Return</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Return Details" size="md">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Return Date</label>
                <p className="font-medium">{new Date(selectedRecord.return_date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Item</label>
                <p className="font-medium">{selectedRecord.item_name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">SKU</label>
                <p className="font-medium font-mono text-sm">{selectedRecord.item_sku}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Borrower</label>
                <p className="font-medium">{selectedRecord.borrower_name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Returned Quantity</label>
                <p className="font-semibold text-lg text-green-600">{selectedRecord.returned_quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Total Borrowed</label>
                <p className="font-semibold">{selectedRecord.borrowing_quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Already Returned (Total)</label>
                <p className="font-semibold text-green-600">{selectedRecord.already_returned || 0}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Still Outstanding</label>
                <p className="font-semibold text-amber-600">{selectedRecord.remaining_qty ?? 0}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Condition</label>
                <span className={{
                  good: 'badge-success',
                  damaged: 'badge-warning',
                  lost: 'badge-danger'
                }[selectedRecord.item_condition] || 'badge-info'}>{selectedRecord.item_condition}</span>
              </div>
            </div>
            {selectedRecord.notes && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Notes</label>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedRecord.notes}</p>
              </div>
            )}
            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Recorded By</label>
                <p className="font-medium">{selectedRecord.created_by_name || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
