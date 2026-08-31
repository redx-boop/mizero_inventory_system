import { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import { toastSuccess, toastError } from '../utils/toastUtils.jsx';
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineOfficeBuilding, HiOutlinePhone, HiOutlineMail,
  HiOutlineLocationMarker, HiOutlineIdentification,
} from 'react-icons/hi';

const SUPPLIER_TYPES = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'donor', label: 'Donor' },
  { value: 'school_garden', label: 'School Garden' },
  { value: 'consignment', label: 'Consignment' },
  { value: 'other', label: 'Other' },
];

const initialForm = {
  name: '', contact_person: '', email: '', phone: '',
  address: '', city: '', supplier_type: 'vendor',
  tax_id: '', payment_terms: '', notes: '',
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ supplier_type: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, [pagination.page, search, filters]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 20 };
      if (search) params.search = search;
      if (filters.supplier_type) params.supplier_type = filters.supplier_type;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/suppliers', { params });
      setSuppliers(data.suppliers);
      setPagination({ page: data.pagination.page, pages: data.pagination.pages });
    } catch {
      toastError('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name || !form.name.trim()) {
      newErrors.name = 'Supplier name is required';
    }
    if (!form.email || !form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Invalid email format';
    }
    if (!form.phone || !form.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (form.phone.trim().length < 6) {
      newErrors.phone = 'Phone must be at least 6 characters';
    }
    if (!form.tax_id || !form.tax_id.trim()) {
      newErrors.tax_id = 'Tax ID is required';
    }
    if (!form.address || !form.address.trim()) {
      newErrors.address = 'Address is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, form);
        toastSuccess('Supplier updated');
      } else {
        await api.post('/suppliers', form);
        toastSuccess('Supplier created');
      }
      setShowModal(false);
      setEditing(null);
      setForm(initialForm);
      setErrors({});
      fetchSuppliers();
    } catch (error) {
      const serverErrors = error.response?.data?.errors;
      if (serverErrors) {
        if (Array.isArray(serverErrors)) {
          // Express-validator format: [{ field: 'email', message: 'Email is required' }]
          const fieldErrors = {};
          serverErrors.forEach(err => {
            if (err.field && err.message) {
              fieldErrors[err.field] = err.message;
            }
          });
          setErrors(fieldErrors);
        } else if (typeof serverErrors === 'object') {
          // Controller format: { email: 'Email is required' }
          const fieldErrors = {};
          Object.entries(serverErrors).forEach(([key, val]) => {
            fieldErrors[key] = typeof val === 'string' ? val : val.message || val;
          });
          setErrors(fieldErrors);
        }
      } else {
        toastError(error.response?.data?.message || 'Failed to save supplier');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Focus first invalid field when errors change
  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstEl = document.querySelector(`[name="${errorKeys[0]}"]`);
      if (firstEl) firstEl.focus();
    }
  }, [errors]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toastSuccess('Supplier deleted');
      fetchSuppliers();
    } catch (error) {
      toastError(error.response?.data?.message || 'Failed to delete supplier');
    }
  };

  const handleEdit = (supplier) => {
    setEditing(supplier);
    setErrors({});
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      supplier_type: supplier.supplier_type || 'vendor',
      tax_id: supplier.tax_id || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || '',
    });
    setShowModal(true);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, className: 'font-medium',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
            <HiOutlineOfficeBuilding className="w-4 h-4" />
          </div>
          <div>
            <span className="font-medium">{val}</span>
            {row.supplier_type && (
              <span className="ml-2 text-xs text-gray-400">({row.supplier_type.replace(/_/g, ' ')})</span>
            )}
          </div>
        </div>
      )
    },
    { key: 'contact_person', label: 'Contact', sortable: true, hideOnMobile: true,
      render: (v) => v || '-'
    },
    { key: 'email', label: 'Email', hideOnMobile: true,
      render: (v) => v ? (
        <a href={`mailto:${v}`} className="text-blue-600 hover:underline text-xs font-mono">{v}</a>
      ) : '-'
    },
    { key: 'phone', label: 'Phone', hideOnMobile: true,
      render: (v) => v || '-'
    },
    { key: 'city', label: 'City', hideOnMobile: true,
      render: (v) => v || '-'
    },
    { key: 'status', label: 'Status',
      render: (v) => (
        <span className={v === 'active' ? 'badge-success' : 'badge-danger'}>
          {v}
        </span>
      )
    },
    { key: 'stock_in_count', label: 'Stock-In', sortable: true, hideOnMobile: true,
      render: (v) => v || 0
    },
    { key: 'actions', label: '', className: 'text-right w-24',
      render: (_, row) => (
        <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleEdit(row)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
            <HiOutlinePencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Delete">
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        </div>
      )
    },
  ];

  const quickFilters = [
    { label: 'All', active: !filters.supplier_type && !filters.status, onClick: () => setFilters({ supplier_type: '', status: '' }) },
    { label: 'Active', active: filters.status === 'active', onClick: () => setFilters({ ...filters, status: filters.status === 'active' ? '' : 'active' }) },
    { label: 'Vendors', active: filters.supplier_type === 'vendor', onClick: () => setFilters({ ...filters, supplier_type: filters.supplier_type === 'vendor' ? '' : 'vendor' }) },
    { label: 'Donors', active: filters.supplier_type === 'donor', onClick: () => setFilters({ ...filters, supplier_type: filters.supplier_type === 'donor' ? '' : 'donor' }) },
  ];

  const dataTableFilters = [
    { key: 'type', label: 'All Types', value: filters.supplier_type, onChange: (v) => setFilters({ ...filters, supplier_type: v }), options: SUPPLIER_TYPES.map(t => ({ value: t.value, label: t.label })) },
    { key: 'status', label: 'All Status', value: filters.status, onChange: (v) => setFilters({ ...filters, status: v }), options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Suppliers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your vendors, donors, and other suppliers.</p>
        </div>
        <div className="flex gap-2">
<button onClick={() => { setEditing(null); setForm(initialForm); setErrors({}); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
            <HiOutlinePlus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, contact, email, phone, or city..."
        filters={[]}
        quickFilters={quickFilters}
        loading={loading}
      />

      <DataTable
        columns={columns}
        data={suppliers}
        page={pagination.page}
        pages={pagination.pages}
        onPageChange={(p) => setPagination({ ...pagination, page: p })}
        loading={loading}
        filters={dataTableFilters}
        emptyMessage="No suppliers found"
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Add New Supplier'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Supplier Name *</label>
              <input name="name" className={`form-input${errors.name ? ' border-red-500' : ''}`} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: '' }); }} required />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="form-label">Contact Person</label>
              <div className="relative">
                <HiOutlineIdentification className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input className="form-input-with-icon" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="Full name" />
              </div>
            </div>
            <div>
              <label className="form-label">Supplier Type</label>
              <select className="form-input" value={form.supplier_type} onChange={(e) => setForm({ ...form, supplier_type: e.target.value })}>
                {SUPPLIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Email *</label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input name="email" type="email" className={`form-input-with-icon${errors.email ? ' border-red-500' : ''}`} value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: '' }); }} placeholder="supplier@example.com" required />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="form-label">Phone *</label>
              <div className="relative">
                <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input name="phone" className={`form-input-with-icon${errors.phone ? ' border-red-500' : ''}`} value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: '' }); }} placeholder="+250 788 000 000" required />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Kigali" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Address *</label>
              <div className="relative">
                <HiOutlineLocationMarker className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input name="address" className={`form-input-with-icon${errors.address ? ' border-red-500' : ''}`} value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); if (errors.address) setErrors({ ...errors, address: '' }); }} placeholder="Street, building, etc." required />
              </div>
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
            </div>
            <div>
              <label className="form-label">Tax ID / Registration *</label>
              <input name="tax_id" className={`form-input${errors.tax_id ? ' border-red-500' : ''}`} value={form.tax_id} onChange={(e) => { setForm({ ...form, tax_id: e.target.value }); if (errors.tax_id) setErrors({ ...errors, tax_id: '' }); }} required />
              {errors.tax_id && <p className="text-red-500 text-xs mt-1">{errors.tax_id}</p>}
            </div>
            <div>
              <label className="form-label">Payment Terms</label>
              <input className="form-input" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="Net 30" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
