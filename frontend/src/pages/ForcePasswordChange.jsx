import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineKey, HiOutlineShieldCheck } from 'react-icons/hi';
import mizeroLogo from '../assets/logo/mizerologo.png';

export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChanging(true);
    try {
      await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });

      toast.success('Password changed successfully. Redirecting to dashboard...');

      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.must_change_password = false;
      localStorage.setItem('user', JSON.stringify(storedUser));

      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={mizeroLogo}
            alt="Mizero Inventory Hub"
            className="h-16 w-auto object-contain mx-auto mb-5"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(139, 158, 255, 0.2))' }}
          />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Change Your Password</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--accent-yellow)' }}>
            You must change your password before accessing the system.
          </p>
        </div>

        {/* Form Card */}
        <div className="card p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
                required
                minLength={8}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                At least 8 characters with 1 uppercase letter, 1 number, and 1 special character
              </p>
            </div>

            <div>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={changing}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-base"
            >
              <HiOutlineKey className="w-4 h-4" />
              {changing ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={handleLogout}
              className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}
            >
              Logout instead
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-disabled)' }}>
          Mizero Inventory Hub — First Login Setup
        </p>
      </div>
    </div>
  );
}
