import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePencil, HiOutlineTrash, HiOutlinePlus, HiOutlineKey, HiOutlineShieldCheck } from 'react-icons/hi';

export default function Users() {
  const { user: currentUser, hasRole } = useAuth();

  // 🛡️ Backstop guard — staff should never reach this page
  if (!hasRole('super_admin', 'admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetUserId, setResetUserId] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role_id: '', department_id: '', department_ids: [] });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => { fetchUsers(); fetchRoles(); fetchDepartments(); }, [pagination.page]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users', { params: { page: pagination.page, limit: 20 } });
      setUsers(data.records);
      setPagination({ page: data.pagination.page, pages: data.pagination.pages });
    } catch { toast.error('Failed to fetch users'); }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await api.get('/users/roles');
      setRoles(data);
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(data);
    } catch {}
  };

  const toggleDepartment = (deptId) => {
    setForm(prev => {
      const ids = prev.department_ids || [];
      return {
        ...prev,
        department_ids: ids.includes(deptId)
          ? ids.filter(id => id !== deptId)
          : [...ids, deptId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, department_ids: form.department_ids };
      if (editing) {
        const { password, ...rest } = payload;
        await api.put(`/users/${editing.id}`, rest);
        toast.success('User updated');
      } else {
        await api.post('/users', payload);
        toast.success('User created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ full_name: '', email: '', password: '', role_id: '', department_id: '', department_ids: [] });
      setUsers([]); // Force refetch
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save user');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deactivated');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleEdit = async (user) => {
    setEditing(user);
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role_id: user.role_id,
      department_id: user.department_id || '',
      department_ids: user.department_ids || (user.department_id ? [user.department_id] : [])
    });
    setShowModal(true);
  };

  const isProtectedSuperAdmin = (user) => {
    return user.role_name === 'super_admin';
  };

  const isSelf = (userId) => {
    return currentUser?.id === userId;
  };

  const handleResetPassword = async () => {
    try {
      await api.put('/auth/reset-password', { user_id: resetUserId, new_password: newPassword });
      toast.success('Password reset');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error) {
      const errData = error.response?.data;
      if (errData?.errors?.length) {
        toast.error(errData.errors[0].message);
      } else {
        toast.error(errData?.message || 'Failed to reset password');
      }
    }
  };

  const statusBadge = (status) => {
    return status === 'active' ? 'badge-success' : 'badge-danger';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage system users, roles, and department assignments</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ full_name: '', email: '', password: '', role_id: '', department_id: '', department_ids: [] }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Department</th>
                <th className="table-header">Status</th>
                <th className="table-header">Last Login</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {users.map((u) => {
                const isSuper = isProtectedSuperAdmin(u);
                return (
                <tr key={u.id} className={`table-row ${isSuper ? 'bg-yellow-50/50 dark:bg-yellow-900/20' : ''}`}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.full_name}</span>
                      {isSuper && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                          <HiOutlineShieldCheck className="w-3 h-3" />
                          Protected System Account
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell">{u.email}</td>
                  <td className="table-cell">
                    <span className={isSuper ? 'badge-warning font-semibold' : 'badge-info'}>
                      {u.role_name?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="table-cell">
                    {isSuper ? (
                      <span className="text-xs text-gray-400 italic">All departments (unrestricted)</span>
                    ) : u.department_names?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">{u.department_names.map(n => <span key={n} className="badge-info text-xs">{n}</span>)}</div>
                    ) : (
                      u.department_name || '-'
                    )}
                  </td>
                  <td className="table-cell">
                    {isSuper ? (
                      <span className="badge-success">active</span>
                    ) : (
                      <span className={statusBadge(u.status)}>{u.status}</span>
                    )}
                  </td>
                  <td className="table-cell text-xs">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                  <td className="table-cell">
                    {isSuper ? (
                      <div className="flex gap-2">
                        {isSelf(u.id) ? (
                          <>
                            <Link to="/profile" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                              <HiOutlinePencil className="w-3 h-3" /> Edit Profile
                            </Link>
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-yellow-700 bg-yellow-50 rounded-lg border border-yellow-200">
                              <HiOutlineShieldCheck className="w-3 h-3" /> Protected
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded cursor-not-allowed" title="Super Admin account is protected">
                            <HiOutlinePencil className="w-3 h-3" /> Protected
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-800" title={isSelf(u.id) ? 'Edit your own profile' : 'Edit user'}>
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setResetUserId(u.id); setShowPasswordModal(true); }} className="text-yellow-600 hover:text-yellow-800" title="Reset Password">
                          <HiOutlineKey className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800" title="Deactivate user">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )})}
              {!users.length && <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No users found</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4"><Pagination page={pagination.page} pages={pagination.pages} onPageChange={(p) => setPagination({ ...pagination, page: p })} /></div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            {!editing && (
              <div>
                <label className="form-label">Password *</label>
                <input type="password" className="form-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={8} />
              </div>
            )}
            <div>
              <label className="form-label">Role *</label>
              <select className="form-input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                <option value="">Select Role</option>
                {roles.filter(r => r.name !== 'super_admin').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">Departments (select all that apply)</label>
              <div className="grid grid-cols-2 gap-2 mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1.5">
                    <input
                      type="checkbox"
                      checked={form.department_ids.includes(d.id)}
                      onChange={() => toggleDepartment(d.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{d.name}</span>
                  </label>
                ))}
                {!departments.length && <p className="text-sm text-gray-400 col-span-2">No departments available</p>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Reset Password">
        <div className="space-y-4">
          <div>
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
            <p className="text-xs text-gray-500 mt-1">Min 8 characters, 1 uppercase, 1 number, 1 special character</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowPasswordModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleResetPassword} className="btn-primary">Reset Password</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
