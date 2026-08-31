import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineDownload, HiOutlineEye } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'borrow_date', label: 'Borrow Date' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'status', label: 'Status' },
  { value: 'borrower_name', label: 'Borrower' }
];

const STATUS_OPTIONS = [
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'returned', label: 'Returned' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' }
];

export default function Borrowings() {
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
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ item_id: '', borrower_name: '', borrower_phone: '', quantity: 1, borrow_date: today, due_date: '' });

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || 1, limit: pageSize, ...filters };
      const { data } = await api.get('/borrowings', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch borrowings'); }
  }, [filters, pageSize]);

  const fetchItems = async (deptId) => {
    try {
      const { data } = await api.get('/items', { params: { limit: 1000, item_type: 'non-consumable', department_id: deptId } });
      setItems(data.items);
    } catch {}
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate submissions
    if (!selectedDeptId) {
      toast.error('Please select a department');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/borrowings', { ...form, department_id: selectedDeptId });
      toast.success('Borrowing recorded');
      setShowModal(false);
      setSelectedDeptId('');
      setForm({ item_id: '', borrower_name: '', borrower_phone: '', quantity: 1, borrow_date: today, due_date: '' });
      fetchRecords();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to record borrowing';
      toast.error(msg);
      // If CSRF-related, log detail for debugging
      if (error.response?.status === 403 && msg.toLowerCase().includes('csrf')) {
        console.warn('CSRF token issue — retry handled by api.js interceptor');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceipt = async (id) => {
    if (!localStorage.getItem('token')) {
      toast.error('You must be logged in to download receipts');
      return;
    }
    try {
      const { data: b } = await api.get(`/borrowings/${id}/receipt`);
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('MIZERO INVENTORY HUB', pw / 2, 20, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.text('Borrowing Receipt', pw / 2, 28, { align: 'center' });

      const lbl = (field, val) => [field, val];
      const body = [
        lbl('Receipt #:', `BRR-${String(b.id).padStart(6, '0')}`),
        lbl('Borrow Date:', new Date(b.borrow_date).toLocaleDateString()),
        lbl('Due Date:', new Date(b.due_date).toLocaleDateString()),
        lbl('Borrower Name:', b.borrower_name),
        lbl('Borrower Phone:', b.borrower_phone || 'N/A'),
        lbl('Item:', b.item_name),
        lbl('SKU:', b.item_sku),
        lbl('Quantity:', String(b.quantity)),
        lbl('Replacement Value:', b.unit_cost_at_time ? Number(b.unit_cost_at_time * b.quantity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'),
        lbl('Status:', b.status.toUpperCase()),
      ];

      autoTable(doc, {
        startY: 36,
        body,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 125 } },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto',
      });

      const pageH = doc.internal.pageSize.getHeight();
      const dateStr = new Date().toLocaleString();

      // Signature block
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text('Checked By: ________________________', 20, pageH - 42);
      doc.text('Approved By: ______________________', 20, pageH - 30);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('(Signature)', 20, pageH - 37);
      doc.text('(Signature)', 20, pageH - 25);

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated on: ${dateStr}`, pw / 2, pageH - 14, { align: 'center' });

      doc.save(`borrowing-receipt-${b.id}.pdf`);
      toast.success('Receipt downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download receipt');
    }
  };

  const statusBadge = (status) => {
    const styles = {
      borrowed: 'badge-warning',
      returned: 'badge-success',
      overdue: 'badge-danger',
      damaged: 'badge-warning',
      lost: 'badge-danger'
    };
    return <span className={styles[status] || 'badge-info'}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Borrowings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track non-consumable items lent out to borrowers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> New Borrowing
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, borrower name..."
        showStatus={true}
        statusOptions={STATUS_OPTIONS}
        statusLabel="Status"
        showDepartment={false}
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
                <th className="table-header">Borrower</th>
                <th className="table-header">Phone</th>
                <th className="table-header">Item</th>
                <th className="table-header">Qty</th>
                <th className="table-header">Borrow Date</th>
                <th className="table-header">Due Date</th>
                <th className="table-header">Status</th>
                <th className="table-header">Recorded By</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium">{r.borrower_name}</td>
                  <td className="table-cell">{r.borrower_phone || '-'}</td>
                  <td className="table-cell">{r.item_name}</td>
                  <td className="table-cell">{r.quantity}</td>
                  <td className="table-cell">{new Date(r.borrow_date).toLocaleDateString()}</td>
                  <td className="table-cell">{new Date(r.due_date).toLocaleDateString()}</td>
                  <td className="table-cell">{statusBadge(r.status)}</td>
                  <td className="table-cell">{r.created_by_name || '-'}</td>
                  <td className="table-cell">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => { setSelectedRecord(r); setShowDetail(true); }} className="text-gray-600 hover:text-blue-600" title="View Details">
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                      <button onClick={() => downloadReceipt(r.id)} className="text-blue-600 hover:text-blue-800" title="Download Receipt">
                        <HiOutlineDownload className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No borrowings found</td></tr>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Borrowing">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Department *</label>
            <select className="form-input" value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setForm({ ...form, item_id: '' }); }} required>
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Item * (Non-Consumable only)</label>
            <select className="form-input" value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} required disabled={!selectedDeptId}>
              <option value="">{selectedDeptId ? 'Select Item' : 'Select a department first'}</option>
              {items.map((item) => <option key={item.id} value={item.id} disabled={item.quantity !== undefined && item.quantity < 1}>{item.name} ({item.sku}){item.quantity !== undefined ? ` - Available: ${item.quantity}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Quantity *</label>
              <input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="1" required />
            </div>
            <div>
              <label className="form-label">Borrow Date</label>
              <input type="date" className="form-input" value={form.borrow_date} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Borrower Name *</label>
              <input className="form-input" value={form.borrower_name} onChange={(e) => setForm({ ...form, borrower_name: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Borrower Phone</label>
              <input className="form-input" value={form.borrower_phone} onChange={(e) => setForm({ ...form, borrower_phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">Due Date *</label>
            <input type="date" className="form-input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Borrowing'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Borrowing Details" size="md">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Borrower Name</label>
                <p className="font-medium">{selectedRecord.borrower_name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Phone</label>
                <p className="font-medium">{selectedRecord.borrower_phone || '-'}</p>
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
                <label className="text-xs text-gray-500 uppercase tracking-wide">Quantity</label>
                <p className="font-semibold text-lg">{selectedRecord.quantity}</p>
              </div>
              {selectedRecord.unit_cost_at_time > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Replacement Value</label>
                  <p className="font-semibold text-lg text-orange-600">
                    {Number(selectedRecord.unit_cost_at_time * selectedRecord.quantity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                <div>{statusBadge(selectedRecord.status)}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Borrow Date</label>
                <p className="font-medium">{new Date(selectedRecord.borrow_date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Due Date</label>
                <p className="font-medium">{new Date(selectedRecord.due_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Recorded By</label>
                <p className="font-medium">{selectedRecord.created_by_name || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Receipt #</label>
                <p className="font-medium font-mono text-sm">BRR-{String(selectedRecord.id).padStart(6, '0')}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
