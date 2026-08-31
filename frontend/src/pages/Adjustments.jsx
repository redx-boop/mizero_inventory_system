import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye } from 'react-icons/hi';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'adjustment_type', label: 'Adjustment Type' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'reason', label: 'Reason' }
];

const TYPE_OPTIONS = [
  { value: 'increase', label: 'Increase' },
  { value: 'decrease', label: 'Decrease' }
];

export default function Adjustments() {
  const { user, getUserDepartments } = useAuth();
  const userDeptIds = getUserDepartments();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form, setForm] = useState({ item_id: '', adjustment_type: 'increase', quantity: 1, reason: '', notes: '' });

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || 1, limit: pageSize, ...filters };
      const { data } = await api.get('/adjustments', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch adjustments'); }
  }, [filters, pageSize]);

  useEffect(() => { fetchRecords(1); fetchDepartments(); }, [filters, pageSize]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchItems(selectedDeptId);
    } else {
      setItems([]);
    }
  }, [selectedDeptId]);

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

  const fetchItems = async (deptId) => {
    try {
      const { data } = await api.get('/items', { params: { limit: 1000, department_id: deptId } });
      setItems(data.items);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/adjustments', form);
      toast.success('Adjustment recorded');
      setShowModal(false);
      setForm({ item_id: '', adjustment_type: 'increase', quantity: 1, reason: '', notes: '' });
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Adjustment failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Stock Adjustments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Correct inventory levels by recording increases or decreases</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> New Adjustment
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, reason..."
        showStatus={false}
        showType={true}
        typeOptions={TYPE_OPTIONS}
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
                <th className="table-header">Date</th>
                <th className="table-header">Item</th>
                <th className="table-header">Type</th>
                <th className="table-header">Quantity</th>
                <th className="table-header">Reason</th>
              <th className="table-header">By</th>
              <th className="table-header">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="table-cell font-medium">{r.item_name}</td>
                  <td className="table-cell">
                    <span className={r.adjustment_type === 'increase' ? 'badge-success' : 'badge-danger'}>
                      {r.adjustment_type}
                    </span>
                  </td>
                  <td className={`table-cell font-semibold ${r.adjustment_type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                    {r.adjustment_type === 'increase' ? '+' : '-'}{r.quantity}
                  </td>
                  <td className="table-cell">{r.reason}</td>
                  <td className="table-cell">{r.created_by_name || '-'}</td>
                  <td className="table-cell">
                    <button onClick={() => { setSelectedRecord(r); setShowDetail(true); }} className="text-blue-600 hover:text-blue-800" title="View Details">
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No adjustments found</td></tr>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Stock Adjustment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Department *</label>
            <select className="form-input" value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setForm({ ...form, item_id: '' }); }} required>
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Item *</label>
            <select className="form-input" value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} required disabled={!selectedDeptId}>
              <option value="">{selectedDeptId ? 'Select Item' : 'Select a department first'}</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku}){item.quantity !== undefined ? ` - Qty: ${item.quantity}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Adjustment Type *</label>
              <select className="form-input" value={form.adjustment_type} onChange={(e) => setForm({ ...form, adjustment_type: e.target.value })}>
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
              </select>
            </div>
            <div>
              <label className="form-label">Quantity *</label>
              <input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="1" required />
            </div>
          </div>
          <div>
            <label className="form-label">Reason *</label>
            <select className="form-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required>
              <option value="">Select Reason</option>
              <option value="inventory_correction">Inventory Correction</option>
              <option value="damage">Damage</option>
              <option value="lost">Lost</option>
              <option value="found">Found</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Adjustment</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Adjustment Details" size="md">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Date</label>
                <p className="font-medium">{new Date(selectedRecord.created_at).toLocaleString()}</p>
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
                <label className="text-xs text-gray-500 uppercase tracking-wide">Adjustment Type</label>
                <span className={selectedRecord.adjustment_type === 'increase' ? 'badge-success' : 'badge-danger'}>
                  {selectedRecord.adjustment_type}
                </span>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Quantity</label>
                <p className={`font-semibold text-lg ${selectedRecord.adjustment_type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedRecord.adjustment_type === 'increase' ? '+' : '-'}{selectedRecord.quantity}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Reason</label>
                <p className="font-medium capitalize">{selectedRecord.reason?.replace(/_/g, ' ')}</p>
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
