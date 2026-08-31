import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye, HiOutlineDownload, HiOutlinePrinter } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const SUPPLIER_TYPES = ['Donated', 'Supplied', 'Consignment', 'School Garden', 'Borrowed', 'Vendor', 'Donor', 'Other'];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'date', label: 'Date' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'unit_price', label: 'Unit Price' },
  { value: 'reference_number', label: 'Reference' }
];

export default function StockIn() {
  const { user, getUserDepartments } = useAuth();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptRecord, setReceiptRecord] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ item_id: '', quantity: 1, unit_price: '', supplier_id: '', supplier: '', supplier_type: '', reference_number: '', notes: '', date: today, department_id: '' });
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [suppliers, setSuppliers] = useState([]);

  const userDeptIds = getUserDepartments();
  const showDeptFilter = userDeptIds.length > 1 || ['super_admin', 'admin'].includes(user?.role);

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || pagination.page, limit: pageSize, ...filters };
      const { data } = await api.get('/stock-in', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch records'); }
  }, [pagination.page, filters, pageSize]);

  useEffect(() => {
    fetchRecords(1);
    if (showDeptFilter) fetchDepartments();
    if (showDeptFilter && selectedDeptId) {
      fetchItems(selectedDeptId);
    } else if (!showDeptFilter) {
      fetchItems();
    }
  }, [filters, pageSize]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
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
      const params = { limit: 1000 };
      if (deptId) params.department_id = deptId;
      const { data } = await api.get('/items', { params });
      setItems(data.items);
    } catch {}
  };

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers/all');
      setSuppliers(data);
    } catch {}
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock-in', { ...form, supplier_id: form.supplier_id || undefined, department_id: selectedDeptId || undefined });
      toast.success('Stock in recorded');
      setShowModal(false);
      setForm({ item_id: '', quantity: 1, unit_price: '', supplier_id: '', supplier: '', supplier_type: '', reference_number: '', notes: '', date: today, department_id: '' });
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record stock in');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Stock In</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Record and track incoming inventory from suppliers and other sources</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Add Stock In
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, supplier, reference..."
        dateRangeLabel="Inbound Date"
        showStatus={false}
        showDepartment={false}
        showItemFilter={false}
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
                <th className="table-header">Unit Price</th>
                <th className="table-header">Total Cost</th>
                <th className="table-header">Supplier</th>
                <th className="table-header">Type</th>
                <th className="table-header">Reference</th>
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
                  <td className="table-cell font-semibold text-green-600">+{r.quantity}</td>
                  <td className="table-cell font-mono text-xs">{r.unit_price ? Number(r.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</td>
                  <td className="table-cell font-mono text-xs">{r.total_cost ? Number(r.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</td>
                  <td className="table-cell">{r.supplier || '-'}</td>
                  <td className="table-cell"><span className="badge-info text-xs">{r.supplier_type || '-'}</span></td>
                  <td className="table-cell">{r.reference_number || '-'}</td>
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
              {!records.length && <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No records found</td></tr>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Stock In" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Department selection for multi-department users */}
          {showDeptFilter && (
            <div>
              <label className="form-label">Department *</label>
              <select className="form-input" value={selectedDeptId} onChange={(e) => { setSelectedDeptId(e.target.value); setForm({ ...form, item_id: '' }); fetchItems(e.target.value); }} required>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Item *</label>
            <select className="form-input" value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} required>
              <option value="">{showDeptFilter && !selectedDeptId ? 'Select a department first' : 'Select Item'}</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku}){item.quantity !== undefined ? ` - Qty: ${item.quantity}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Quantity *</label>
              <input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="1" required />
            </div>
            <div>
              <label className="form-label">Unit Price *</label>
              <input type="number" className="form-input" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} min="0" step="0.01" placeholder="0.00" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date} disabled />
            </div>
            <div></div>
          </div>            <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Supplier</label>
              <select className="form-input" value={form.supplier_id} onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, supplier_id: val });
                if (val) {
                  const selected = suppliers.find(s => s.id === parseInt(val));
                  if (selected) {
                    // Map supplier types: normalize case and common patterns
                    let mappedType = selected.supplier_type || '';
                    // Convert snake_case to Title Case for readability
                    if (mappedType) {
                      mappedType = mappedType
                        .split('_')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
                    }
                    // Check if the mapped type exists in our options, fallback to empty
                    const typeExists = SUPPLIER_TYPES.some(t => t.toLowerCase() === mappedType.toLowerCase());
                    setForm(prev => ({
                      ...prev,
                      supplier_id: val,
                      supplier: selected.name,
                      supplier_type: typeExists ? mappedType : (prev.supplier_type || mappedType)
                    }));
                  }
                } else {
                  setForm(prev => ({ ...prev, supplier_id: '', supplier: '', supplier_type: '' }));
                }
              }}>
                <option value="">-- Select Registered Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.city ? ` (${s.city})` : ''}{s.contact_person ? ` — ${s.contact_person}` : ''}
                  </option>
                ))}
              </select>
              {/* Contact details card when a supplier is selected */}
              {(() => {
                const selectedSupplier = form.supplier_id
                  ? suppliers.find(s => s.id === parseInt(form.supplier_id))
                  : null;
                return selectedSupplier ? (
                <div className="mt-2 p-2.5 rounded-lg text-xs space-y-1 border" style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}>
                  {selectedSupplier.contact_person && (
                    <div className="flex items-center gap-1.5">
                      <span>👤</span>
                      <span>{selectedSupplier.contact_person}</span>
                    </div>
                  )}
                  {selectedSupplier.email && (
                    <div className="flex items-center gap-1.5">
                      <span>📧</span>
                      <span className="font-mono">{selectedSupplier.email}</span>
                    </div>
                  )}
                  {selectedSupplier.phone && (
                    <div className="flex items-center gap-1.5">
                      <span>📞</span>
                      <span>{selectedSupplier.phone}</span>
                    </div>
                  )}
                  {selectedSupplier.city && (
                    <div className="flex items-center gap-1.5">
                      <span>📍</span>
                      <span>{selectedSupplier.city}{selectedSupplier.address ? ` — ${selectedSupplier.address}` : ''}</span>
                    </div>
                  )}
                </div>
              ) : null;
              })()}
              <p className="text-xs text-gray-500 mt-1">Or type a custom supplier name below</p>
            </div>
            <div>
              <label className="form-label">Custom Supplier Name</label>
              <input className="form-input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Or type supplier name" disabled={!!form.supplier_id} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Supplier Type</label>
              <select className="form-input" value={form.supplier_type} onChange={(e) => setForm({ ...form, supplier_type: e.target.value })}>
                <option value="">Select Type</option>
                {SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div></div>
          </div>
          <div>
            <label className="form-label">Reference Number</label>
            <input className="form-input" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Stock In</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Stock In Details" size="md">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Date</label>
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
                <p className="font-semibold text-lg text-green-600">+{selectedRecord.quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Supplier</label>
                <p className="font-medium">{selectedRecord.supplier || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Supplier Type</label>
                <p className="font-medium">{selectedRecord.supplier_type || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Reference</label>
                <p className="font-medium">{selectedRecord.reference_number || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Recorded By</label>
                <p className="font-medium">{selectedRecord.created_by_name || '-'}</p>
              </div>
            </div>
            {selectedRecord.notes && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Notes</label>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedRecord.notes}</p>
              </div>
            )}
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
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0.25rem 0 0 0' }}>Stock In Receipt</p>
              </div>
              <div style={{ borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', padding: '0.75rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Receipt #:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#000' }}>SIN-{String(receiptRecord.id).padStart(6, '0')}</span>
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
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>+{receiptRecord.quantity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Unit Price:</span>
                  <span style={{ fontFamily: 'monospace', color: '#000' }}>{receiptRecord.unit_price ? Number(receiptRecord.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Total Cost:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#000' }}>{receiptRecord.total_cost ? Number(receiptRecord.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Supplier:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.supplier || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Type:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.supplier_type || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Reference:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.reference_number || 'N/A'}</span>
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
                    const { data: r } = await api.get(`/stock-in/${receiptRecord.id}/receipt`);
                    const doc = new jsPDF('portrait', 'mm', 'a4');
                    const pw = doc.internal.pageSize.getWidth();

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(18);
                    doc.text('MIZERO INVENTORY HUB', pw / 2, 20, { align: 'center' });
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(14);
                    doc.text('Stock In Receipt', pw / 2, 28, { align: 'center' });

                    const lbl = (field, val) => [field, val];
                    const body = [
                      lbl('Receipt #:', `SIN-${String(r.id).padStart(6, '0')}`),
                      lbl('Date:', new Date(r.date).toLocaleDateString()),
                      lbl('Item:', r.item_name),
                      lbl('SKU:', r.item_sku),
                      lbl('Quantity:', `+${r.quantity}`),
                      lbl('Unit Price:', r.unit_price ? Number(r.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'),
                      lbl('Total Cost:', r.total_cost ? Number(r.total_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'),
                      lbl('Supplier:', r.supplier || 'N/A'),
                      lbl('Supplier Type:', r.supplier_type || 'N/A'),
                      lbl('Reference:', r.reference_number || 'N/A'),
                      lbl('Recorded By:', r.created_by_name || 'System'),
                    ];
                    if (r.notes) body.push(lbl('Notes:', r.notes));

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

                    doc.save(`stockin-receipt-${r.id}.pdf`);
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
