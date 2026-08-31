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
  { value: 'recipient', label: 'Recipient' },
  { value: 'issued_quantity', label: 'Issued Qty' },
  { value: 'returned_quantity', label: 'Returned Qty' }
];

export default function Leftovers() {
  const { user, getUserDepartments } = useAuth();
  const userDeptIds = getUserDepartments();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stockOuts, setStockOuts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form, setForm] = useState({ stock_out_id: '', returned_quantity: 1, notes: '' });
  const [selectedStockOut, setSelectedStockOut] = useState(null);

  const filteredStockOuts = selectedDeptId === 'all'
    ? stockOuts
    : selectedDeptId
      ? stockOuts.filter(so => String(so.item_department_id ?? '') === String(selectedDeptId))
      : [];

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || 1, limit: pageSize, ...filters };
      const { data } = await api.get('/leftovers', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch leftovers'); }
  }, [filters, pageSize]);

  useEffect(() => { fetchRecords(1); fetchStockOuts(); fetchDepartments(); }, [filters, pageSize]);

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

  const fetchStockOuts = async () => {
    try {
      const { data } = await api.get('/stock-out', { params: { limit: 1000 } });
      setStockOuts(data.records);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leftovers', form);
      toast.success('Leftover return recorded');
      setShowModal(false);
      setSelectedStockOut(null);
      setForm({ stock_out_id: '', returned_quantity: 1, notes: '' });
      fetchRecords();
    } catch (error) {
      const errData = error.response?.data;
      let msg = errData?.message || 'Failed to record leftover return';
      // Show detailed debug info when available
      if (errData?.issued !== undefined) {
        msg += ` (Issued: ${errData.issued}, Already returned: ${errData.already_returned ?? 0}, Attempting: ${errData.attempting_return})`;
      }
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Leftover Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Return unused stock from issued items back to inventory</p>
        </div>
        <button onClick={() => { setShowModal(true); fetchStockOuts(); }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Return Leftover
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, recipient..."
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
                <th className="table-header">Date</th>
                <th className="table-header">Item</th>
                <th className="table-header">Recipient</th>
                <th className="table-header">Issued</th>
                <th className="table-header">Returned</th>
                <th className="table-header">Notes</th>
              <th className="table-header">Recorded By</th>
              <th className="table-header">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="table-cell font-medium">{r.item_name}</td>
                  <td className="table-cell">{r.recipient}</td>
                  <td className="table-cell">{r.issued_quantity}</td>
                  <td className="table-cell font-semibold text-green-600">{r.returned_quantity}</td>
                  <td className="table-cell">{r.notes || '-'}</td>
                  <td className="table-cell">{r.created_by_name || '-'}</td>
                  <td className="table-cell">
                    <button onClick={() => { setSelectedRecord(r); setShowDetail(true); }} className="text-blue-600 hover:text-blue-800" title="View Details">
                      <HiOutlineEye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No leftovers found</td></tr>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Return Leftover Stock">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Department</label>
            <select className="form-input" value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setForm({ ...form, stock_out_id: '' }); }}>
              <option value="">Select Department</option>
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {selectedDeptId === '' && (
              <p className="text-xs text-amber-600 mt-1">Tip: Select &quot;All Departments&quot; to see all stock-out records, or pick a specific department to filter.</p>
            )}
          </div>
          <div>
            <label className="form-label">Stock Out Record *</label>
            <select className="form-input" value={form.stock_out_id}
              onChange={(e) => {
                const so = (selectedDeptId === 'all' ? stockOuts : filteredStockOuts).find(s => String(s.id) === e.target.value);
                setSelectedStockOut(so || null);
                setForm({ ...form, stock_out_id: e.target.value, returned_quantity: 1 });
              }}
              required disabled={!selectedDeptId}>
              <option value="">{selectedDeptId ? 'Select Stock Out' : 'Select a department first'}</option>
              {(selectedDeptId === 'all' ? stockOuts : filteredStockOuts).map((so) => {
                const remaining = so.remaining_qty ?? so.quantity;
                return remaining > 0 ? (
                  <option key={so.id} value={so.id}>
                    {so.item_name} → {so.recipient} (Issued: {so.quantity} | Remaining: {remaining})
                  </option>
                ) : null;
              })}
            </select>
            {selectedStockOut && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>Originally issued:</span>
                  <span className="font-semibold">{selectedStockOut.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Already returned:</span>
                  <span className="font-semibold">{selectedStockOut.already_returned || 0}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                  <span className="font-medium">Available to return:</span>
                  <span className="font-semibold text-green-700">{(selectedStockOut.remaining_qty ?? selectedStockOut.quantity)}</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="form-label">Returned Quantity *</label>
            <input type="number" className="form-input" value={form.returned_quantity}
              onChange={(e) => setForm({ ...form, returned_quantity: parseInt(e.target.value) || 0 })}
              min="1" max={selectedStockOut ? (selectedStockOut.remaining_qty ?? selectedStockOut.quantity) : 99999} required />
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
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Leftover Return Details" size="md">
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
                <label className="text-xs text-gray-500 uppercase tracking-wide">Recipient</label>
                <p className="font-medium">{selectedRecord.recipient}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Issued Quantity</label>
                <p className="font-semibold">{selectedRecord.issued_quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Returned Quantity</label>
                <p className="font-semibold text-lg text-green-600">{selectedRecord.returned_quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Total Already Returned</label>
                <p className="font-semibold text-green-600">{selectedRecord.already_returned || 0}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Still Outstanding</label>
                <p className="font-semibold text-amber-600">{selectedRecord.remaining_qty ?? 0}</p>
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
