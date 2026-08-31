import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  HiOutlineEye, HiOutlineCurrencyDollar, HiOutlinePlus, HiOutlineCheckCircle,
  HiOutlineXCircle, HiOutlineDownload, HiOutlineFilter, HiOutlineSearch,
  HiOutlinePrinter
} from 'react-icons/hi';
import { formatCurrency } from '../utils/format';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date' },
  { value: 'liability_amount', label: 'Liability Amount' },
  { value: 'amount_paid', label: 'Amount Paid' },
  { value: 'balance', label: 'Balance' },
  { value: 'status', label: 'Status' },
  { value: 'liability_type', label: 'Type' },
  { value: 'item_name', label: 'Item Name' },
  { value: 'borrower_name', label: 'Borrower' },
  { value: 'replacement_cost', label: 'Replacement Cost' }
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' }
];

const TYPE_OPTIONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' }
];

function statusBadge(status) {
  const styles = {
    pending: 'badge-warning',
    unpaid: 'badge-danger',
    partially_paid: 'badge-info',
    paid: 'badge-success',
    waived: 'badge-info'
  };
  const labels = {
    pending: 'Pending',
    unpaid: 'Unpaid',
    partially_paid: 'Partially Paid',
    paid: 'Paid',
    waived: 'Waived'
  };
  return <span className={styles[status] || 'badge-info'}>{labels[status] || status}</span>;
}

function typeBadge(type) {
  return type === 'lost'
    ? <span className="badge-danger">Lost</span>
    : <span className="badge-warning">Damaged</span>;
}

export default function DamageLiabilities() {
  const { user, getUserDepartments } = useAuth();
  const userDeptIds = getUserDepartments();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentHist, setShowPaymentHist] = useState(false);

  // Record Liability modal
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [borrowings, setBorrowings] = useState([]);
  const [liabilityForm, setLiabilityForm] = useState({ borrowing_id: '', liability_type: 'damaged', quantity: 1, notes: '' });
  const [selectedLiabilityBorrowing, setSelectedLiabilityBorrowing] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [items, setItems] = useState([]);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLiability, setPaymentLiability] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ payment_amount: '', notes: '' });

  const fetchRecords = useCallback(async (pageNum) => {
    try {
      const params = { page: pageNum || pagination.page, limit: pageSize, ...filters };
      const { data } = await api.get('/damage-liabilities', { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch { toast.error('Failed to fetch liabilities'); }
  }, [pagination.page, filters, pageSize]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  useEffect(() => { fetchRecords(1); }, [filters, pageSize]);

  const openPaymentModal = (liability) => {
    setPaymentLiability(liability);
    const remainingBal = (liability.balance ?? liability.liability_amount - liability.amount_paid);
    setPaymentForm({ payment_amount: remainingBal > 0 ? String(remainingBal) : '', notes: '' });
    setShowPaymentModal(true);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!paymentLiability) return;
    const payAmt = parseFloat(paymentForm.payment_amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    try {
      const { data } = await api.post(`/damage-liabilities/${paymentLiability.id}/pay`, {
        payment_amount: payAmt,
        notes: paymentForm.notes
      });
      toast.success(data.message);
      setShowPaymentModal(false);
      setPaymentLiability(null);
      fetchRecords();
    } catch (error) {
      const errData = error.response?.data;
      let msg = errData?.message || 'Failed to record payment';
      if (errData?.remaining !== undefined) {
        msg += ` (Remaining balance: ${errData.remaining})`;
      }
      toast.error(msg);
    }
  };

  const openPaymentHistory = async (liability) => {
    try {
      const { data } = await api.get(`/damage-liabilities/${liability.id}/payments`);
      setPaymentHistory(data);
      setSelectedRecord(liability);
      setShowPaymentHist(true);
    } catch {
      toast.error('Failed to load payment history');
    }
  };

  const openLiabilityModal = async () => {
    try {
      const [borrowRes, deptRes] = await Promise.all([
        api.get('/borrowings', { params: { limit: 1000 } }),
        api.get('/departments')
      ]);
      setBorrowings(borrowRes.data.records.filter(b => b.status === 'borrowed'));
      if (['super_admin', 'admin'].includes(user?.role)) {
        setDepartments(deptRes.data);
      } else {
        setDepartments(deptRes.data.filter(d => userDeptIds.includes(d.id)));
      }
      setShowLiabilityModal(true);
    } catch {}
  };

  const borrowingDeptMap = borrowings.length && items.length
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

  useEffect(() => {
    if (selectedDeptId) {
      const params = { limit: 1000, item_type: 'non-consumable' };
      if (selectedDeptId !== 'all') params.department_id = selectedDeptId;
      api.get('/items', { params }).then(({ data }) => setItems(data.items)).catch(() => {});
    }
  }, [selectedDeptId]);

  const handleRecordLiability = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/damage-liabilities', {
        borrowing_id: liabilityForm.borrowing_id,
        returned_quantity: liabilityForm.quantity,
        liability_type: liabilityForm.liability_type,
        notes: liabilityForm.notes
      });
      toast.success(data.message);
      setShowLiabilityModal(false);
      setLiabilityForm({ borrowing_id: '', liability_type: 'damaged', quantity: 1, notes: '' });
      setSelectedLiabilityBorrowing(null);
      setSelectedDeptId('');
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record');
    }
  };

  const handleWaiveLiability = async (liability) => {
    if (!window.confirm(`Are you sure you want to waive the ${liability.liability_type === 'lost' ? 'loss' : 'damage'} liability for ${liability.borrower_name} (${liability.item_name})? This cannot be undone.`)) return;
    try {
      const { data } = await api.post(`/damage-liabilities/${liability.id}/waive`, { reason: 'Waived by admin' });
      toast.success(data.message);
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to waive liability');
    }
  };

  const downloadReceipt = async (liability) => {
    try {
      const { data } = await api.get(`/damage-liabilities/${liability.id}/receipt`);
      // Generate a professional PDF receipt (similar to borrowing receipt)
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('MIZERO INVENTORY HUB', pw / 2, 20, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.text(data.liability_type === 'lost' ? 'LOSS LIABILITY RECEIPT' : 'DAMAGE LIABILITY RECEIPT', pw / 2, 28, { align: 'center' });

      const lbl = (field, val) => [field, val];
      const body = [
        lbl('Receipt #:', `LBL-${String(data.id).padStart(6, '0')}`),
        lbl('Date:', new Date(data.created_at).toLocaleDateString()),
        lbl('Type:', data.liability_type === 'lost' ? 'LOST' : 'DAMAGED'),
        lbl('Borrower:', data.borrower_name),
        lbl('Phone:', data.borrower_phone || 'N/A'),
        lbl('Item:', data.item_name),
        lbl('SKU:', data.item_sku),
        lbl('Quantity:', String(data.quantity)),
        lbl('Unit Cost:', `${formatCurrency(data.unit_cost)} RWF`),
        lbl('Replacement Cost:', `${formatCurrency(data.replacement_cost)} RWF`),
        lbl('Liability %:', `${data.liability_percentage || 50}%`),
        lbl('Liability Amount:', `${formatCurrency(data.liability_amount)} RWF`),
        lbl('Amount Paid:', `${formatCurrency(data.amount_paid || 0)} RWF`),
        lbl('Balance:', `${formatCurrency(data.balance ?? data.liability_amount - (data.amount_paid || 0))} RWF`),
        lbl('Status:', (data.status || '').replace(/_/g, ' ').toUpperCase()),
      ];

      if (data.paid_at) {
        body.push(lbl('Paid On:', new Date(data.paid_at).toLocaleDateString()));
      }

      autoTable(doc, {
        startY: 36,
        body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 100 } },
        margin: { left: 8, right: 8 },
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

      doc.save(`liability-receipt-${data.id}.pdf`);
      toast.success('PDF receipt downloaded');
    } catch (err) {
      toast.error('Failed to download receipt');
    }
  };

  // Summary metrics
  const totalLiabilityAmount = records.reduce((sum, r) => sum + (Number(r.liability_amount) || 0), 0);
  const totalPaidAmount = records.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
  const totalBalance = records.reduce((sum, r) => sum + (Number(r.balance) || 0), 0);
  const damageCases = records.filter(r => r.liability_type === 'damaged').length;
  const lossCases = records.filter(r => r.liability_type === 'lost').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Damage & Loss Liabilities</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track damaged and lost items, manage payments and waivers</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openLiabilityModal} className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" /> Record Liability
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {(totalLiabilityAmount > 0 || totalBalance > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 border-l-4 border-l-red-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Liability</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalLiabilityAmount)}</p>
            <p className="text-xs text-gray-400">{damageCases} damage, {lossCases} loss</p>
          </div>
          <div className="card p-3 border-l-4 border-l-green-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Paid</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaidAmount)}</p>
          </div>
          <div className="card p-3 border-l-4 border-l-amber-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding Balance</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="card p-3 border-l-4 border-l-blue-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cases</p>
            <p className="text-xl font-bold text-blue-600">{records.length}</p>
          </div>
        </div>
      )}

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by item, SKU, borrower name..."
        showStatus={true}
        statusOptions={STATUS_OPTIONS}
        statusLabel="Status"
        showType={true}
        typeOptions={TYPE_OPTIONS}
        showAmountRange={true}
        amountLabel="Liability"
        showSort={true}
        sortOptions={SORT_OPTIONS}
        defaultSort="created_at"
        showPageSize={true}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Type</th>
                <th className="table-header">Item</th>
                <th className="table-header">Borrower</th>
                <th className="table-header">Replacement Cost</th>
                <th className="table-header">Liability %</th>
                <th className="table-header">Liability Amount</th>
                <th className="table-header">Amount Paid</th>
                <th className="table-header">Balance</th>
                <th className="table-header">Status</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((r) => {
                const replCost = Number(r.replacement_cost) || 0;
                const liabAmt = Number(r.liability_amount) || 0;
                const paidAmt = Number(r.amount_paid) || 0;
                const balance = Number(r.balance) || (liabAmt - paidAmt);
                const liabPct = Number(r.liability_percentage) || 0;
                return (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="table-cell">{typeBadge(r.liability_type)}</td>
                    <td className="table-cell font-medium max-w-[160px] truncate" title={r.item_name}>{r.item_name}</td>
                    <td className="table-cell">{r.borrower_name}</td>
                    <td className="table-cell font-mono text-sm">{formatCurrency(replCost)}</td>
                    <td className="table-cell text-center">{liabPct}%</td>
                    <td className="table-cell font-mono font-semibold text-red-600">{formatCurrency(liabAmt)}</td>
                    <td className="table-cell font-mono text-green-600">{formatCurrency(paidAmt)}</td>
                    <td className="table-cell font-mono font-semibold text-amber-600">{formatCurrency(balance)}</td>
                    <td className="table-cell">{statusBadge(r.status)}</td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => { setSelectedRecord(r); setShowDetail(true); }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                          <HiOutlineEye className="w-4 h-4" />
                        </button>
                        {r.status !== 'paid' && r.status !== 'waived' && (
                          <button onClick={() => openPaymentModal(r)}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Record Payment">
                            <HiOutlineCheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {r.status !== 'paid' && r.status !== 'waived' && (
                          <button onClick={() => handleWaiveLiability(r)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Waive Liability">
                            <HiOutlineXCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => downloadReceipt(r)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download Receipt">
                          <HiOutlineDownload className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!records.length && (
                <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No liabilities found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {records.length ? ((pagination.page - 1) * pageSize) + 1 : 0}-{Math.min(pagination.page * pageSize, pagination.total)} of {pagination.total} records
          </span>
          <Pagination page={pagination.page} pages={pagination.pages}
            onPageChange={(p) => {
              setPagination(prev => ({ ...prev, page: p }));
              fetchRecords(p);
            }} />
        </div>
      </div>

      {/* Record Liability Modal */}
      <Modal isOpen={showLiabilityModal} onClose={() => { setShowLiabilityModal(false); setSelectedLiabilityBorrowing(null); }} title="Record Liability">
        <form onSubmit={handleRecordLiability} className="space-y-4">
          <div>
            <label className="form-label">Department</label>
            <select className="form-input" value={selectedDeptId}
              onChange={(e) => { setSelectedDeptId(e.target.value); setLiabilityForm({ ...liabilityForm, borrowing_id: '' }); }}>
              <option value="">Select Department</option>
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Borrower & Item *</label>
            <select className="form-input" value={liabilityForm.borrowing_id}
              onChange={(e) => {
                const b = (selectedDeptId === 'all' ? borrowings : filteredBorrowings).find(bor => String(bor.id) === e.target.value);
                setSelectedLiabilityBorrowing(b || null);
                setLiabilityForm({ ...liabilityForm, borrowing_id: e.target.value, quantity: 1 });
              }}
              required disabled={!selectedDeptId}>
              <option value="">{selectedDeptId ? 'Select borrowing' : 'Select a department first'}</option>
              {(selectedDeptId === 'all' ? borrowings : filteredBorrowings).map((b) => {
                const remaining = b.remaining_qty ?? b.quantity;
                return remaining > 0 ? (
                  <option key={b.id} value={b.id}>
                    {b.borrower_name} - {b.item_name} (Remaining: {remaining})
                  </option>
                ) : null;
              })}
            </select>
            {selectedLiabilityBorrowing && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <div className="flex justify-between"><span>Borrowed:</span><span className="font-semibold">{selectedLiabilityBorrowing.quantity}</span></div>
                <div className="flex justify-between"><span>Already returned:</span><span className="font-semibold">{selectedLiabilityBorrowing.already_returned || 0}</span></div>
                <div className="flex justify-between border-t border-red-200 pt-1 mt-1"><span className="font-medium">Available:</span><span className="font-semibold text-red-700">{selectedLiabilityBorrowing.remaining_qty ?? selectedLiabilityBorrowing.quantity}</span></div>
              </div>
            )}
          </div>
          <div>
            <label className="form-label">Type *</label>
            <div className="flex gap-3">
              <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                liabilityForm.liability_type === 'damaged'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" name="liability_type" value="damaged"
                  checked={liabilityForm.liability_type === 'damaged'}
                  onChange={() => setLiabilityForm({ ...liabilityForm, liability_type: 'damaged' })}
                  className="sr-only" />
                <div className="text-center">
                  <span className="font-semibold text-amber-700">Damaged</span>
                  <p className="text-xs text-amber-600 mt-1">Pays 50% of replacement cost</p>
                </div>
              </label>
              <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                liabilityForm.liability_type === 'lost'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" name="liability_type" value="lost"
                  checked={liabilityForm.liability_type === 'lost'}
                  onChange={() => setLiabilityForm({ ...liabilityForm, liability_type: 'lost' })}
                  className="sr-only" />
                <div className="text-center">
                  <span className="font-semibold text-red-700">Lost</span>
                  <p className="text-xs text-red-600 mt-1">Pays 100% of replacement cost</p>
                </div>
              </label>
            </div>
          </div>
          <div>
            <label className="form-label">Affected Quantity *</label>
            <p className="text-xs text-gray-500 mb-1">Enter only the number of items that are {liabilityForm.liability_type === 'lost' ? 'lost' : 'damaged'} (max: {selectedLiabilityBorrowing?.remaining_qty ?? '-'})</p>
            <input type="number" className="form-input" value={liabilityForm.quantity}
              onChange={(e) => setLiabilityForm({ ...liabilityForm, quantity: parseInt(e.target.value) || 0 })}
              min="1" max={selectedLiabilityBorrowing ? (selectedLiabilityBorrowing.remaining_qty ?? selectedLiabilityBorrowing.quantity) : 99999} required />
            {selectedLiabilityBorrowing && liabilityForm.quantity > 0 && (
              <div className="mt-1 p-2 bg-blue-50 rounded text-xs text-blue-700">
                Replacement Cost: {formatCurrency(liabilityForm.quantity * parseFloat(selectedLiabilityBorrowing.unit_cost_at_time || 0))} RWF
                {' → '}{liabilityForm.liability_type === 'lost' ? '100%' : '50%'} Liability: <strong>{formatCurrency(liabilityForm.quantity * parseFloat(selectedLiabilityBorrowing.unit_cost_at_time || 0) * (liabilityForm.liability_type === 'lost' ? 1 : 0.5))} RWF</strong>
              </div>
            )}
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows="2" value={liabilityForm.notes}
              onChange={(e) => setLiabilityForm({ ...liabilityForm, notes: e.target.value })} />
          </div>
          {liabilityForm.liability_type === 'lost' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <p className="font-semibold text-red-800">⚠ This item was reported lost. A loss liability will be created.</p>
              <p className="text-red-700 mt-1">The borrower must pay the <strong>full replacement cost</strong>.</p>
            </div>
          )}
          {liabilityForm.liability_type === 'damaged' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="font-semibold text-amber-800">⚠ This item was returned damaged. A damage liability will be created.</p>
              <p className="text-amber-700 mt-1">The borrower must pay <strong>50% of the replacement cost</strong>.</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowLiabilityModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">
              {liabilityForm.liability_type === 'lost' ? 'Record Loss' : 'Record Damage'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); setPaymentLiability(null); }} title="Record Liability Payment" size="md">
        {paymentLiability && (
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Item</label>
                  <p className="font-medium">{paymentLiability.item_name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Borrower</label>
                  <p className="font-medium">{paymentLiability.borrower_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Type</label>
                  <div>{typeBadge(paymentLiability.liability_type)}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                  <div>{statusBadge(paymentLiability.status)}</div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-2 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Liability Amount</label>
                  <p className="font-semibold text-lg text-red-600">
                    {formatCurrency(paymentLiability.liability_amount)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Already Paid</label>
                  <p className="font-semibold text-lg text-green-600">
                    {formatCurrency(paymentLiability.amount_paid || 0)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Balance</label>
                  <p className="font-semibold text-lg text-amber-600">
                    {formatCurrency(paymentLiability.balance ?? (paymentLiability.liability_amount - (paymentLiability.amount_paid || 0)))}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Payment Amount *</label>
              <div className="relative mt-1">
                {/* RWF currency prefix - positioned inside the input */}
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 font-medium text-sm select-none">RWF</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.payment_amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_amount: e.target.value })}
                  min="0.01"
                  max={paymentLiability.balance ?? (paymentLiability.liability_amount - (paymentLiability.amount_paid || 0))}
                  required
                  placeholder="Enter amount"
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-12 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="text-gray-500">
                  Balance: <strong className="font-semibold text-amber-600">{formatCurrency(paymentLiability.balance ?? (paymentLiability.liability_amount - (paymentLiability.amount_paid || 0)))}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  Min: <strong className="font-semibold text-gray-700">0.01</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  Max: <strong className="font-semibold text-gray-700">{formatCurrency(paymentLiability.balance ?? (paymentLiability.liability_amount - (paymentLiability.amount_paid || 0)))}</strong>
                </span>
              </div>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows="2" value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Optional payment details" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <HiOutlineCheckCircle className="w-4 h-4" /> Record Payment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedRecord(null); }} title="Liability Details" size="lg">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Date Reported</label>
                <p className="font-medium">{new Date(selectedRecord.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Type</label>
                <div>{typeBadge(selectedRecord.liability_type)}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                <div>{statusBadge(selectedRecord.status)}</div>
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
                <label className="text-xs text-gray-500 uppercase tracking-wide">Phone</label>
                <p className="font-medium">{selectedRecord.borrower_phone || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Quantity</label>
                <p className="font-semibold">{selectedRecord.quantity}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Unit Cost</label>
                <p className="font-mono">{formatCurrency(selectedRecord.unit_cost)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Liability %</label>
                <p className="font-semibold">{selectedRecord.liability_percentage || 50}%</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Replacement Cost</label>
                <p className="font-mono font-semibold text-purple-600">{formatCurrency(selectedRecord.replacement_cost)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Liability Amount</label>
                <p className="font-mono font-semibold text-lg text-red-600">{formatCurrency(selectedRecord.liability_amount)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Amount Paid</label>
                <p className="font-mono font-semibold text-lg text-green-600">{formatCurrency(selectedRecord.amount_paid || 0)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Balance</label>
                <p className="font-mono font-semibold text-lg text-amber-600">
                  {formatCurrency(selectedRecord.balance ?? (selectedRecord.liability_amount - (selectedRecord.amount_paid || 0)))}
                </p>
              </div>
              {selectedRecord.paid_at && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Last Payment</label>
                  <p className="font-medium">{new Date(selectedRecord.paid_at).toLocaleString()}</p>
                </div>
              )}
            </div>
            {selectedRecord.notes && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Notes</label>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3 text-sm">{selectedRecord.notes}</p>
              </div>
            )}
            <div className="border-t pt-4 flex justify-between items-center">
              <button onClick={() => openPaymentHistory(selectedRecord)}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <HiOutlinePrinter className="w-4 h-4" /> Payment History
              </button>
              {selectedRecord.status !== 'paid' && selectedRecord.status !== 'waived' && (
                <div className="flex gap-2">
                  <button onClick={() => { setShowDetail(false); openPaymentModal(selectedRecord); }}
                    className="btn-primary flex items-center gap-2">
                    <HiOutlineCheckCircle className="w-4 h-4" /> Record Payment
                  </button>
                  <button onClick={() => { setShowDetail(false); handleWaiveLiability(selectedRecord); }}
                    className="btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
                    <HiOutlineXCircle className="w-4 h-4" /> Waive Liability
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal isOpen={showPaymentHist} onClose={() => { setShowPaymentHist(false); setPaymentHistory([]); }} title="Payment History" size="md">
        {paymentHistory.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Date</th>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Amount</th>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Notes</th>
                  <th className="px-3 py-2 text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>By</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {paymentHistory.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="px-3 py-2">{new Date(p.paid_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-green-600">
                      {formatCurrency(p.amount || p.payment_amount)}
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate">{p.notes || '-'}</td>
                    <td className="px-3 py-2">{p.created_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-3 py-2 text-xs text-gray-500 uppercase">TOTAL</td>
                  <td className="px-3 py-2 font-mono text-green-600">
                    {formatCurrency(paymentHistory.reduce((s, p) => s + Number(p.amount || p.payment_amount || 0), 0))}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
