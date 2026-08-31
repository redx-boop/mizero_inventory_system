import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ActivityLogs() {
  const { hasRole } = useAuth();

  // 🛡️ Backstop guard — staff should never reach this page
  if (!hasRole('super_admin', 'admin', 'stock_manager')) {
    return <Navigate to="/dashboard" replace />;
  }
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [filters, setFilters] = useState({ module: '', action: '' });

  useEffect(() => { fetchLogs(); }, [pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      const { data } = await api.get('/activity-logs', { params: { page: pagination.page, limit: 50, ...filters } });
      setRecords(data.records);
      setPagination({ page: data.pagination.page, pages: data.pagination.pages });
    } catch { toast.error('Failed to fetch activity logs'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Activity Logs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Audit trail of all system actions and events</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select className="form-input w-40" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
          <option value="">All Modules</option>
          {['auth', 'inventory', 'departments', 'users', 'requests', 'borrowing', 'returns', 'damage_liabilities'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className="form-input w-40" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
          <option value="">All Actions</option>
          {['create', 'update', 'delete', 'login', 'stock_in', 'stock_out', 'adjustment', 'borrow', 'return', 'damage_report', 'loss_report', 'liability_payment', 'liability_waived'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <tr>
                <th className="table-header">Timestamp</th>
                <th className="table-header">User</th>
                <th className="table-header">Action</th>
                <th className="table-header">Module</th>
                <th className="table-header">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {records.map((log) => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="table-cell">{log.user_name || 'System'}</td>
                  <td className="table-cell"><span className="badge-info">{log.action}</span></td>
                  <td className="table-cell">{log.module}</td>
                  <td className="table-cell">{log.description}</td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No activity logs found</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4"><Pagination page={pagination.page} pages={pagination.pages} onPageChange={(p) => setPagination({ ...pagination, page: p })} /></div>
      </div>
    </div>
  );
}
