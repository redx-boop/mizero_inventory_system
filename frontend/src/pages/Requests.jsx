import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineArchive, HiOutlineEye, HiOutlinePrinter, HiOutlineDownload } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'status', label: 'Status' },
  { value: 'requester_name', label: 'Requester' }
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'allocated', label: 'Allocated' }
];

export default function Requests() {
  const { user, getUserDepartments, hasRole } = useAuth();
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
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateTarget, setAllocateTarget] = useState(null);
  const [allocateForm, setAllocateForm] = useState({ quantity: 1, notes: '' });
  const [form, setForm] = useState({ item_id: '', quantity: 1, justification: '' });

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || 1, limit: pageSize, ...filters };
      const { data } = await api.get('/requests', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch requests'); }
  }, [filters, pageSize]);

  const fetchItems = async (deptId) => {
    try {
      const { data } = await api.get('/items', { params: { limit: 1000, department_id: deptId } });
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
    try {
      await api.post('/requests', form);
      toast.success('Request submitted');
      setShowModal(false);
      setForm({ item_id: '', quantity: 1, justification: '' });
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    }
  };

  const openAllocate = (request) => {
    setAllocateTarget(request);
    setAllocateForm({ quantity: request.quantity, notes: '' });
    setShowAllocateModal(true);
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    if (!allocateTarget) return;
    try {
      await api.put(`/requests/${allocateTarget.id}/review`, {
        status: 'allocated',
        allocated_quantity: allocateForm.quantity,
        notes: allocateForm.notes || undefined
      });
      toast.success(`Allocated ${allocateForm.quantity} of ${allocateTarget.item_name}`);
      setShowAllocateModal(false);
      setAllocateTarget(null);
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to allocate request');
    }
  };

  const handleReview = async (id, status) => {
    try {
      await api.put(`/requests/${id}/review`, { status });
      toast.success(`Request ${status}`);
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to review request');
    }
  };

  const statusBadge = (status) => {
    const styles = {
      pending: 'badge-warning',
      approved: 'badge-info',
      rejected: 'badge-danger',
      allocated: 'badge-success'
    };
    return <span className={styles[status] || 'badge-info'}>{status}</span>;
  };

  const canReview = hasRole('super_admin', 'admin', 'stock_manager');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Stock Requests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Submit and review inventory requests from staff</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> New Request
        </button>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, requester..."
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
                <th className="table-header">Date</th>
                <th className="table-header">Requester</th>
                <th className="table-header">Item</th>
                <th className="table-header">Requested</th>
                <th className="table-header">Allocated</th>
                <th className="table-header">Remaining</th>
                <th className="table-header">Justification</th>
              <th className="table-header">Status</th>
              <th className="table-header">Details</th>
              {canReview && <th className="table-header">Actions</th>}
            </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="table-cell">{r.requester_name}</td>
                  <td className="table-cell font-medium">{r.item_name}</td>
                  <td className="table-cell">{r.quantity}</td>
                  <td className="table-cell">{r.allocated_quantity || '-'}</td>
                  <td className="table-cell">{(r.quantity - (r.allocated_quantity || 0)) > 0 ? (r.quantity - (r.allocated_quantity || 0)) : '-'}</td>
                  <td className="table-cell max-w-[200px] truncate">{r.justification || '-'}</td>
                  <td className="table-cell">{statusBadge(r.status)}</td>
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
                  {canReview && (
                    <td className="table-cell">
                      {(r.status === 'pending' || r.status === 'approved') && (
                        <div className="flex gap-1 flex-wrap">
                          {r.status === 'pending' && (
                            <button onClick={() => handleReview(r.id, 'approved')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">
                              Approve
                            </button>
                          )}
                          <button onClick={() => openAllocate(r)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1">
                            <HiOutlineArchive className="w-3 h-3" /> Allocate
                          </button>
                          {r.status === 'pending' && (
                            <button onClick={() => handleReview(r.id, 'rejected')} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">
                              Reject
                            </button>
                          )}
                        </div>
                      )}
                      {(r.status !== 'pending' && r.status !== 'approved') && (
                        <span className="text-xs text-gray-400">Reviewed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!records.length && <tr><td colSpan={canReview ? 9 : 8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No requests found</td></tr>}
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

      {/* New Request Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Stock Request">
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
              {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku}){item.quantity !== undefined ? ` - Available: ${item.quantity}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Quantity *</label>
            <input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="1" required />
          </div>
          <div>
            <label className="form-label">Justification</label>
            <textarea className="form-input" rows="3" value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} placeholder="Why do you need this item?" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Submit Request</button>
          </div>
        </form>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal isOpen={showReceipt} onClose={() => { setShowReceipt(false); setReceiptRecord(null); }} title="Receipt Preview" size="md">
        {receiptRecord && (
          <div className="space-y-4">
            {/* Receipt paper — forced white bg / black text, never inherits dark mode */}
            <div style={{ background: '#fff', color: '#000', border: '2px dashed #d1d5db', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div className="text-center mb-4">
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#000', margin: 0 }}>MIZERO INVENTORY HUB</h2>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0.25rem 0 0 0' }}>Stock Request Receipt</p>
              </div>
              <div style={{ borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', padding: '0.75rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Receipt #:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#000' }}>REQ-{String(receiptRecord.id).padStart(6, '0')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Date:</span>
                  <span style={{ fontWeight: 500, color: '#000' }}>{new Date(receiptRecord.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Requester:</span>
                  <span style={{ fontWeight: 500, color: '#000' }}>{receiptRecord.requester_name}</span>
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
                  <span style={{ fontWeight: 600, color: '#000' }}>{receiptRecord.quantity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Status:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Justification:</span>
                  <span style={{ maxWidth: '200px', textAlign: 'right', color: '#000' }}>{receiptRecord.justification || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.125rem 0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Reviewed By:</span>
                  <span style={{ color: '#000' }}>{receiptRecord.reviewer_name || 'Not yet reviewed'}</span>
                </div>
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', margin: '1rem 0 0 0' }}>Generated on: {new Date().toLocaleString()}</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={async () => {
                  try {
                    const { data: r } = await api.get(`/requests/${receiptRecord.id}/receipt`);
                    const doc = new jsPDF('portrait', 'mm', 'a4');
                    const pw = doc.internal.pageSize.getWidth();

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(18);
                    doc.text('MIZERO INVENTORY HUB', pw / 2, 20, { align: 'center' });
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(14);
                    doc.text('Stock Request Receipt', pw / 2, 28, { align: 'center' });

                    const lbl = (field, val) => [field, val];
                    const body = [
                      lbl('Receipt #:', `REQ-${String(r.id).padStart(6, '0')}`),
                      lbl('Date:', new Date(r.created_at).toLocaleDateString()),
                      lbl('Requester:', r.requester_name),
                      lbl('Item:', r.item_name),
                      lbl('SKU:', r.item_sku),
                      lbl('Quantity:', String(r.quantity)),
                      lbl('Justification:', r.justification || 'N/A'),
                      lbl('Status:', r.status.toUpperCase()),
                      lbl('Reviewed By:', r.reviewer_name || 'Not yet reviewed'),
                    ];
                    if (r.reviewed_at) {
                      body.push(lbl('Reviewed At:', new Date(r.reviewed_at).toLocaleString()));
                    }

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

                    doc.save(`request-receipt-${r.id}.pdf`);
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

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Request Details" size="md">
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
                <label className="text-xs text-gray-500 uppercase tracking-wide">Requester</label>
                <p className="font-medium">{selectedRecord.requester_name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Requested</label>
                <p className="font-semibold text-lg">{selectedRecord.quantity}</p>
              </div>
              {selectedRecord.allocated_quantity > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Allocated</label>
                  <p className="font-semibold text-lg text-green-600">{selectedRecord.allocated_quantity}</p>
                </div>
              )}
              {selectedRecord.quantity - (selectedRecord.allocated_quantity || 0) > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Remaining</label>
                  <p className="font-semibold text-lg text-amber-600">{selectedRecord.quantity - (selectedRecord.allocated_quantity || 0)}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                <div>{statusBadge(selectedRecord.status)}</div>
              </div>
            </div>
            {selectedRecord.justification && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Justification</label>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selectedRecord.justification}</p>
              </div>
            )}
            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Reviewed By</label>
                <p className="font-medium">{selectedRecord.reviewer_name || 'Not yet reviewed'}</p>
              </div>
              {selectedRecord.reviewed_at && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Reviewed At</label>
                  <p className="font-medium">{new Date(selectedRecord.reviewed_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Allocate Modal */}
      <Modal isOpen={showAllocateModal} onClose={() => { setShowAllocateModal(false); setAllocateTarget(null); }} title="Allocate Stock">
        {allocateTarget && (
          <form onSubmit={handleAllocate} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <span className="font-medium">{allocateTarget.item_name}</span> — Requested by{' '}
              <span className="font-medium">{allocateTarget.requester_name}</span>
              <br />
              Total requested: <span className="font-semibold">{allocateTarget.quantity}</span>
            </div>

            <div>
              <label className="form-label">Quantity to Allocate *</label>
              <input
                type="number"
                className="form-input"
                value={allocateForm.quantity}
                onChange={(e) => setAllocateForm({ ...allocateForm, quantity: parseInt(e.target.value) || 0 })}
                min="1"
                max={allocateTarget.quantity}
                required
              />
              <p className="text-xs text-gray-500 mt-1">You can allocate less than the requested amount. Max: {allocateTarget.quantity}</p>
            </div>

            <div>
              <label className="form-label">Reason / Notes</label>
              <textarea
                className="form-input"
                rows="3"
                value={allocateForm.notes}
                onChange={(e) => setAllocateForm({ ...allocateForm, notes: e.target.value })}
                placeholder="e.g. Partial allocation — only 80 in stock"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowAllocateModal(false); setAllocateTarget(null); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <HiOutlineArchive className="w-4 h-4" /> Allocate {allocateForm.quantity}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
