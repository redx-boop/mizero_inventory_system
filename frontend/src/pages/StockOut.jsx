import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye, HiOutlinePrinter, HiOutlineDownload } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'date', label: 'Date' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'recipient', label: 'Recipient' },
  { value: 'department', label: 'Department' }
];

export default function StockOut() {
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
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptRecord, setReceiptRecord] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ item_id: '', quantity: 1, recipient: '', department: '', reason: '', date: today });

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || 1, limit: pageSize, ...filters };
      const { data } = await api.get('/stock-out', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch records'); }
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
      setDepartments(data);
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
      // Map selected department ID to department name (stock_out stores VARCHAR, not FK)
      const deptName = departments.find(d => d.id === Number(selectedDeptId))?.name || '';
      await api.post('/stock-out', { ...form, department: deptName });
      toast.success('Stock out recorded');
      setShowModal(false);
      setSelectedDeptId('');
      setForm({ item_id: '', quantity: 1, recipient: '', department: '', reason: '', date: today });
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record stock out');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Stock Out</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Issue inventory items to recipients and departments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Issue Stock
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, recipient, department..."
        showStatus={false}
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
                <th className="table-header">Date</th>
                <th className="table-header">Item</th>
                <th className="table-header">SKU</th>
                <th className="table-header">Quantity</th>
                <th className="table-header">Recipient</th>
                <th className="table-header">Department</th>
                <th className="table-header">Reason</th>
              <th className="table-header">Recorded By</th>
              <th className="table-header">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="table-cell font-medium">{r.item_name}</td>
                  <td className="table-cell font-mono text-xs">{r.item_sku}</td>
                  <td className="table-cell font-semibold text-red-600">-{r.quantity}</td>
                  <td className="table-cell">{r.recipient}</td>
                  <td className="table-cell">{r.department || '-'}</td>
                  <td className="table-cell">{r.reason || '-'}</td>
                  <td className="table-cell">{r.created_by_name || '-'}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedRecord(r); setShowDetail(true); }} className="text-gray-600 hover:text-blue-600" title="View Details">
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setReceiptRecord(r); setShowReceipt(true); }} className="text-green-600 hover:text-green-800" title="View Receipt">
                        <HiOutlinePrinter className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No records found</td></tr>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Issue Stock Out">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Department *</label>
            <select className="form-input" value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setForm({ ...form, item_id: '' }); }} required>
              <option value="">Select Department</option>
              {departments
                .filter(d => ['super_admin', 'admin'].includes(user?.role) || userDeptIds.includes(d.id))
                .map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Item *</label>
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
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date} disabled />
            </div>
          </div>
          <div>
            <label className="form-label">Recipient *</label>
            <input className="form-input" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Reason</label>
            <textarea className="form-input" rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Issue Stock</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Stock Out Details" size="md">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Date</label>
                <p className="font-medium">{new Date(selectedRecord.date).toLocaleDateString()}</p>
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
                <p className="font-semibold text-lg text-red-600">-{selectedRecord.quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Already Returned</label>
                <p className="font-semibold text-green-600">{selectedRecord.already_returned || 0}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Outstanding</label>
                <p className="font-semibold text-amber-600">{selectedRecord.remaining_qty ?? selectedRecord.quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Recipient</label>
                <p className="font-medium">{selectedRecord.recipient}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Department</label>
                <p className="font-medium">{selectedRecord.department || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Reason</label>
                <p className="font-medium">{selectedRecord.reason || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Recorded By</label>
                <p className="font-medium">{selectedRecord.created_by_name || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal isOpen={showReceipt} onClose={() => { setShowReceipt(false); setReceiptRecord(null); }} title="Receipt Preview" size="md">
        {receiptRecord && (
          <div className="space-y-4">
            {/* Receipt paper — forced white bg / black text, never inherits dark mode */}
            <div style={{ background: '#fff', color: '#000', border: '2px dashed #d1d5db', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div className="text-center mb-4">
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#000', margin: 0 }}>MIZERO INVENTORY HUB</h2>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0.25rem 0 0 0' }}>Stock Out Receipt</p>
              </div>
              <div style={{ borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', padding: '0.75rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Receipt #:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#000' }}>SOT-{String(receiptRecord.id).padStart(6, '0')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Date:</span>
                  <span style={{ fontWeight: 500, color: '#000' }}>{new Date(receiptRecord.date).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Item:</span>
                  <span style={{ fontWeight: 500, color: '#000' }}>{receiptRecord.item_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>SKU:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#000' }}>{receiptRecord.item_sku}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Quantity:</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>-{receiptRecord.quantity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Unit Cost (at time):</span>
                  <span style={{ fontFamily: 'monospace', color: '#000' }}>{receiptRecord.unit_cost_at_time ? Number(receiptRecord.unit_cost_at_time).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Total COGS:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#000' }}>{receiptRecord.total_cost ? Number(receiptRecord.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Recipient:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.recipient}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Department:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.department || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Reason:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.reason || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Recorded By:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.created_by_name || 'System'}</span>
                </div>
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', margin: '1rem 0 0 0' }}>Generated on: {new Date().toLocaleString()}</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={async () => {
                  try {
                    const { data: r } = await api.get(`/stock-out/${receiptRecord.id}/receipt`);
                    const doc = new jsPDF('portrait', 'mm', 'a4');
                    const pw = doc.internal.pageSize.getWidth();

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(18);
                    doc.text('MIZERO INVENTORY HUB', pw / 2, 20, { align: 'center' });
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(14);
                    doc.text('Stock Out Receipt', pw / 2, 28, { align: 'center' });

                    const lbl = (field, val) => [field, val];
                    const body = [
                      lbl('Receipt #:', `SOT-${String(r.id).padStart(6, '0')}`),
                      lbl('Date:', new Date(r.date).toLocaleDateString()),
                      lbl('Item:', r.item_name),
                      lbl('SKU:', r.item_sku),
                      lbl('Quantity:', `-${r.quantity}`),
                      lbl('Unit Cost:', r.unit_cost_at_time ? Number(r.unit_cost_at_time).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'),
                      lbl('Total COGS:', r.total_cost ? Number(r.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'),
                      lbl('Recipient:', r.recipient),
                      lbl('Department:', r.department || 'N/A'),
                      lbl('Reason:', r.reason || 'N/A'),
                      lbl('Recorded By:', r.created_by_name || 'System'),
                    ];

                    autoTable(doc, {
                      startY: 36,
                      body,
                      theme: 'grid',
                      styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
                      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 125 } },
                      margin: { left: 10, right: 10 },
                      tableWidth: 'auto',
                    });

                    const pageH = doc.internal.pageSize.getHeight();
                    const dateStr = new Date().toLocaleString();

                    // Signature block
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(60);
                    doc.text('Checked By: ________________________', 10, pageH - 42);
                    doc.text('Approved By: ______________________', 10, pageH - 30);
                    doc.setFontSize(8);
                    doc.setTextColor(120);
                    doc.text('(Signature)', 10, pageH - 37);
                    doc.text('(Signature)', 10, pageH - 25);

                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(`Generated on: ${dateStr}`, pw / 2, pageH - 14, { align: 'center' });

                    doc.save(`stockout-receipt-${r.id}.pdf`);
                    toast.success('Receipt downloaded');
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to download receipt');
                  }
                }}
                className="btn-primary flex items-center gap-2"
              >
                <HiOutlineDownload className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
