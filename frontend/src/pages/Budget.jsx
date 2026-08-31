import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

export default function Budget() {
  const { user, getUserDepartments } = useAuth();
  const userDeptIds = getUserDepartments();
  const [budgets, setBudgets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ department_id: '', fiscal_year: new Date().getFullYear(), total_budget: '', description: '' });
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsRes, deptsRes] = await Promise.all([
        api.get('/budgets'),
        api.get('/departments'),
      ]);
      setBudgets(budgetsRes.data);
      if (['super_admin', 'admin'].includes(user?.role)) {
        setDepartments(deptsRes.data);
      } else {
        setDepartments(deptsRes.data.filter(d => userDeptIds.includes(d.id)));
      }

      // Fetch summary
      const summaryRes = await api.get('/budgets/summary');
      setSummary(summaryRes.data);
    } catch (error) {
      // Error handled silently - UI shows fallback state
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/budgets/${editing.id}`, form);
        toast.success('Budget updated');
      } else {
        await api.post('/budgets', form);
        toast.success('Budget created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ department_id: '', fiscal_year: new Date().getFullYear(), total_budget: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save budget');
    }
  };

  const handleEdit = (budget) => {
    setEditing(budget);
    setForm({
      department_id: budget.department_id,
      fiscal_year: budget.fiscal_year,
      total_budget: budget.total_budget,
      description: budget.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      toast.success('Budget deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete budget');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Budget Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage department budgets and track spending against allocations</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ department_id: '', fiscal_year: new Date().getFullYear(), total_budget: '', description: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" />
          Add Budget
        </button>
      </div>

      {/* Budget Summary Card */}
      {summary && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Budget Overview - FY {summary.fiscal_year}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Budget</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-blue)' }}>
                {Number(summary.total_budget).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>RWF</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Used</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-orange)' }}>
                {Number(summary.total_used).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>RWF</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Remaining</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-green)' }}>
                {Number(summary.total_remaining).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>RWF</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(168, 85, 247, 0.08)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Usage Rate</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-purple)' }}>{summary.usage_pct}%</p>
              <div className="mt-2 w-full rounded-full h-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-2 rounded-full" style={{ width: `${Math.min(summary.usage_pct, 100)}%`, backgroundColor: 'var(--accent-purple)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget List */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Department Budgets</h3>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[18%]">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[9%]">Fiscal Year</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[13%]">Total Budget</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[13%]">Amount Used</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[13%]">Remaining</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">Usage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">Description</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[6%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {budgets.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No budgets found. Create one to get started.</td></tr>
              ) : budgets.map((budget) => {
                const usagePct = budget.total_budget > 0 ? ((budget.amount_used / budget.total_budget) * 100).toFixed(1) : 0;
                return (
                  <tr key={budget.id} className="table-row">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap truncate">{budget.department_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{budget.fiscal_year}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right whitespace-nowrap font-mono">{Number(budget.total_budget).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right whitespace-nowrap font-mono">{Number(budget.amount_used).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-mono font-semibold">{Number(budget.amount_remaining).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[90px] bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                              usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(usagePct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${
                          usagePct > 90 ? 'text-red-600' : usagePct > 70 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {usagePct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 truncate">{budget.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleEdit(budget)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors" title="Edit budget">
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(budget.id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors" title="Delete budget">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget Form Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Budget' : 'Add Budget'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Department</label>
            <select className="form-input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required>
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Fiscal Year</label>
            <input type="number" className="form-input" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })} required min={2020} max={2100} />
          </div>
          <div>
            <label className="form-label">Total Budget (RWF)</label>
            <input type="number" step="0.01" className="form-input" value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: e.target.value })} required min={0} />
          </div>
          <div>
            <label className="form-label">Description (Optional)</label>
            <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
