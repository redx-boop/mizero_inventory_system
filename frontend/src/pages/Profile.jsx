import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineShieldCheck, HiOutlineSave, HiOutlineKey, HiOutlineMail, HiOutlineUser, HiOutlineExclamation, HiOutlineTrash, HiOutlineChevronDown, HiOutlineShieldExclamation } from 'react-icons/hi';

export default function Profile() {
  const { user, login: refreshAuth } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', { full_name: fullName, email });
      // Update localStorage so sidebar reflects changes immediately
      if (data.user) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...currentUser, ...data.user }));
      }
      toast.success(data.message || 'Profile updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';

  // ── DANGER ZONE STATE ──────────────────────────────────
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [resetStep, setResetStep] = useState('start'); // start | warning | password | phrase | confirm | processing
  const [resetPassword, setResetPassword] = useState('');
  const [resetPhrase, setResetPhrase] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  const openDangerZone = () => {
    setDangerZoneOpen(true);
    setResetStep('warning');
    setResetPassword('');
    setResetPhrase('');
    setResetError('');
  };

  const closeDangerZone = () => {
    setDangerZoneOpen(false);
    setResetStep('start');
    setResetPassword('');
    setResetPhrase('');
    setResetError('');
  };

  const handleVerifyPassword = async () => {
    if (!resetPassword.trim()) {
      toast.error('Please enter your password');
      return;
    }
    setIsVerifyingPassword(true);
    setResetError('');
    try {
      await api.post('/admin/verify-password', { password: resetPassword });
      setResetStep('phrase');
    } catch (error) {
      const msg = error.response?.data?.message || 'Password verification failed';
      setResetError(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleResetData = async () => {
    setIsResetting(true);
    setResetError('');
    setResetStep('processing');
    try {
      const { data } = await api.post('/admin/reset-data', {
        password: resetPassword,
        confirmation_phrase: resetPhrase,
        reset_quantities: true
      });
      toast.success(data.message);
      closeDangerZone();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to reset data';
      setResetError(msg);
      toast.error(msg);
      setResetStep('phrase');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>My Profile</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your account settings and security</p>
        </div>
        {isSuperAdmin && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
            <HiOutlineShieldCheck className="w-4 h-4" />
            Protected System Account
          </span>
        )}
      </div>

      {/* Profile Info Section */}        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <HiOutlineUser className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            Account Information
          </h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Protected fields (read-only) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label text-gray-400">Role</label>
              <div className="form-input cursor-not-allowed flex items-center h-10" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                {user?.role?.replace('_', ' ')}
                {isSuperAdmin && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--accent-yellow)' }}>(protected)</span>
                )}
              </div>
            </div>
            <div>
              <label className="form-label text-gray-400">Status</label>
              <div className="form-input cursor-not-allowed flex items-center h-10" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                {user?.status || 'active'}
                {isSuperAdmin && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--accent-yellow)' }}>(protected)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <HiOutlineSave className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Section */}        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <HiOutlineKey className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            Change Password
          </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Min 8 characters, 1 uppercase, 1 number, 1 special character</p>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changingPassword}
              className="btn-primary flex items-center gap-2"
            >
              <HiOutlineKey className="w-4 h-4" />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* ⚠️ DANGER ZONE — Super Admin Only (collapsed by default) */}
      {isSuperAdmin && (
        <div className="card border-2 overflow-hidden" style={{ borderColor: 'var(--accent-red)' }}>
          {/* Collapsible header — click to toggle */}
          <button
            onClick={() => setDangerZoneOpen(!dangerZoneOpen)}
            className="w-full flex items-center justify-between p-4 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10"
            style={{ backgroundColor: dangerZoneOpen ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <HiOutlineShieldExclamation className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-red-800 dark:text-red-400">Danger Zone</h2>
                <p className="text-sm text-red-600 dark:text-red-400/70">
                  {dangerZoneOpen ? 'Click to collapse' : 'Destructive actions — requires multi-factor confirmation'}
                </p>
              </div>
            </div>
            <div className="text-red-400 transition-transform duration-200" style={{ transform: dangerZoneOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <HiOutlineChevronDown className="w-5 h-5" />
            </div>
          </button>

          {/* Collapsible content */}
          {dangerZoneOpen && (
            <div className="px-4 pb-4 space-y-4">
              {/* Multi-step Confirmation Wizard */}
              {resetStep === 'warning' && (
                <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {/* Scrollable warning content */}
                  <div className="max-h-64 overflow-y-auto pr-1 space-y-4">
                    <div className="flex items-start gap-3">
                      <HiOutlineExclamation className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-red-800 dark:text-red-400">Irreversible Action</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          You are about to permanently delete ALL transactional data in the system.
                          This action <strong>cannot be undone</strong>.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-red-700 mb-2">Will Be DELETED:</h4>
                      <ul className="text-sm text-red-600 space-y-1 list-disc list-inside">
                        <li>Stock In / Stock Out records</li>
                        <li>Stock Adjustments</li>
                        <li>Borrowings &amp; Returns</li>
                        <li>Stock Requests &amp; Leftovers</li>
                        <li>Damage &amp; Loss Liabilities (and payments)</li>
                        <li>Budgets, Notifications &amp; Activity Logs</li>
                        <li>Item quantities <strong>reset to 0</strong></li>
                      </ul>
                    </div>

                    <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                      <h4 className="text-sm font-semibold text-green-700 mb-1">✓ Preserved:</h4>
                      <ul className="text-sm text-green-600 space-y-0.5 list-disc list-inside">
                        <li>Item catalog (names, SKUs, categories, images)</li>
                        <li>Users, roles &amp; departments</li>
                        <li>System configuration</li>
                      </ul>
                    </div>

                    <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                      <h4 className="text-sm font-semibold text-orange-700 mb-1">⚠ Requirements:</h4>
                      <ul className="text-sm text-orange-600 space-y-1 list-disc list-inside">
                        <li>You must confirm your <strong>password</strong></li>
                        <li>You must type an exact confirmation phrase</li>
                        <li>This action is logged with your user ID and IP address</li>
                        <li>Max 3 reset attempts per hour</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <button onClick={closeDangerZone} className="btn-secondary text-sm">Cancel</button>
                    <button onClick={() => setResetStep('password')} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                      <HiOutlineShieldCheck className="w-4 h-4" />
                      I Understand — Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Password Confirmation */}
              {resetStep === 'password' && (
                <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div className="flex items-center gap-3">
                    <HiOutlineShieldCheck className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-red-800 dark:text-red-400">Confirm Your Identity</h3>
                      <p className="text-sm text-red-600 mt-1">Enter your current password to proceed.</p>
                    </div>
                  </div>

                  {resetError && (
                    <div className="rounded-lg p-3 text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--accent-red)' }}>
                      <HiOutlineExclamation className="w-4 h-4 shrink-0" />
                      {resetError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-red-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      className="w-full rounded-lg border-2 px-3 py-2.5 text-sm focus:outline-none transition-colors"
                      style={{
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                      value={resetPassword}
                      onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }}
                      placeholder="Enter your password to confirm identity"
                      autoFocus
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent-red)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)'}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <button onClick={closeDangerZone} className="btn-secondary text-sm">Cancel</button>
                    <button onClick={() => setResetStep('start')} className="btn-secondary text-sm">Back</button>
                    <button
                      onClick={handleVerifyPassword}
                      disabled={!resetPassword.trim() || isVerifyingPassword}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isVerifyingPassword ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Verifying...
                        </>
                      ) : (
                        'Verify & Continue'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation Phrase */}
              {resetStep === 'phrase' && (
                <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div className="flex items-center gap-3">
                    <HiOutlineExclamation className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-red-800 dark:text-red-400">Final Confirmation Phrase</h3>
                      <p className="text-sm text-red-600 mt-1">
                        Type <strong>RESET ALL DATA</strong> or <strong>WIPE TRANSACTIONS</strong> to confirm.
                      </p>
                    </div>
                  </div>

                  {resetError && (
                    <div className="rounded-lg p-3 text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--accent-red)' }}>
                      <HiOutlineExclamation className="w-4 h-4 shrink-0" />
                      {resetError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-red-700 mb-1">Confirmation Phrase</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border-2 px-3 py-2.5 text-sm focus:outline-none transition-colors font-mono tracking-wider"
                      style={{
                        borderColor: resetPhrase.toUpperCase() === 'RESET ALL DATA' || resetPhrase.toUpperCase() === 'WIPE TRANSACTIONS'
                          ? 'rgba(34, 197, 94, 0.5)'
                          : 'rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                      value={resetPhrase}
                      onChange={(e) => {
                        setResetPhrase(e.target.value);
                        setResetError('');
                      }}
                      placeholder="Type RESET ALL DATA or WIPE TRANSACTIONS"
                      autoFocus
                    />
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Phrase must match exactly (case-insensitive)
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <button onClick={closeDangerZone} className="btn-secondary text-sm">Cancel</button>
                    <button onClick={() => { setResetStep('password'); setResetError(''); }} className="btn-secondary text-sm">Back</button>
                    <button
                      onClick={() => {
                        const phrase = resetPhrase.trim().toUpperCase();
                        if (phrase !== 'RESET ALL DATA' && phrase !== 'WIPE TRANSACTIONS') {
                          setResetError('Phrase must be exactly "RESET ALL DATA" or "WIPE TRANSACTIONS"');
                          return;
                        }
                        setResetStep('confirm');
                      }}
                      disabled={!resetPhrase.trim()}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      Confirm Phrase
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Final Irreversible Confirmation */}
              {resetStep === 'confirm' && (
                <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '2px solid rgba(239, 68, 68, 0.4)' }}>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                      <HiOutlineExclamation className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-400">FINAL WARNING</h3>
                    <p className="text-sm text-red-600 mt-1">
                      This is the last step. Once confirmed, all transactional data will be permanently deleted.
                    </p>
                  </div>

                  <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-red-700 font-medium">Identity</span>
                      <span className="text-red-600 font-mono text-xs">{user?.full_name} ({user?.email})</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-red-700 font-medium">Confirmation</span>
                      <span className="text-red-600 font-mono text-xs">{resetPhrase.trim().toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-red-700 font-medium">Action</span>
                      <span className="text-red-600 font-semibold text-xs">DELETE ALL TRANSACTIONAL DATA</span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <button onClick={closeDangerZone} className="btn-secondary text-sm">Cancel — Keep Data Safe</button>
                    <button onClick={() => { setResetStep('phrase'); setResetError(''); }} className="btn-secondary text-sm">Back</button>
                    <button
                      onClick={handleResetData}
                      disabled={isResetting}
                      className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-600/30"
                    >
                      {isResetting ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Resetting...
                        </>
                      ) : (
                        <>
                          <HiOutlineTrash className="w-4 h-4" />
                          EXECUTE RESET
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Processing state */}
              {resetStep === 'processing' && (
                <div className="rounded-xl p-8 text-center space-y-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <svg className="animate-spin w-10 h-10 mx-auto text-red-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="font-semibold text-red-700">Resetting all transactional data...</p>
                  <p className="text-sm text-red-500">Please wait — this may take a moment.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
