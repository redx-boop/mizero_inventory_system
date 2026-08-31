import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePencil, HiOutlineTrash, HiOutlinePlus } from 'react-icons/hi';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', manager_id: '' });

  useEffect(() => { fetchDepartments(); fetchUsers(); }, []);

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(data);
    } catch { toast.error('Failed to fetch departments'); }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users', { params: { limit: 1000 } });
      setUsers(data.records || []);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      if (editing) {
        await api.put(`/departments/${editing.id}`, payload);
        toast.success('Department updated');
      } else {
        await api.post('/departments', payload);
        toast.success('Department created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', manager_id: '' });
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save department');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure? This cannot be undone if inventory exists.')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Department deleted');
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleEdit = (dept) => {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description || '', manager_id: dept.manager_id || '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Departments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Organize your institution into departments and assign managers</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', manager_id: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Add Department
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Description</th>
                <th className="table-header">Manager</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {departments.map((d) => (
                <tr key={d.id} className="table-row">
                  <td className="table-cell font-medium">{d.name}</td>
                  <td className="table-cell">{d.description || '-'}</td>
                  <td className="table-cell">{d.manager_name || 'Not assigned'}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(d)} className="text-blue-600 hover:text-blue-800"><HiOutlinePencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(d.id)} className="text-red-600 hover:text-red-800"><HiOutlineTrash className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!departments.length && <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No departments found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Department' : 'Add Department'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Manager</label>
            <select className="form-input" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">No Manager</option>
              {users.filter(u => u.role_name !== 'staff').map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>)}
            </select>
            {users.filter(u => u.role_name === 'staff').length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Staff role users cannot be assigned as managers</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
