import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { ArrowLeft } from 'lucide-react';
import mizeroLogo from '../assets/logo/mizerologo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success('Login successful');
      if (data.must_change_password || data.user?.must_change_password) {
        navigate('/force-password-change');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
      // Shake animation trigger — brief class toggle on the card
      const card = document.getElementById('login-card');
      if (card) {
        card.classList.remove('animate-slide-up');
        // Force reflow
        void card.offsetWidth;
        card.classList.add('animate-head-shake');
        setTimeout(() => card.classList.remove('animate-head-shake'), 500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Decorative background gradient orbs (dark-mode aware) */}
      <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-[0.08] dark:opacity-[0.05] pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[35%] h-[35%] rounded-full opacity-[0.06] dark:opacity-[0.04] pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--secondary) 0%, transparent 70%)' }} />

      <div className="w-full max-w-md relative">
        {/* Back to Home */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium transition-all duration-200 group text-[var(--text-muted)] hover:text-[var(--primary)]"
        >
          <ArrowLeft className="w-4 h-4 transition-all duration-200 group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </Link>

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <Link
            to="/"
            className="inline-block transition-all duration-200 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9EFF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg"
            aria-label="Go to home page"
          >
            <img
              src={mizeroLogo}
              alt="Mizero Inventory Hub"
              className="h-16 w-auto object-contain mx-auto mb-4 pointer-events-none transition-all duration-200"
              style={{
                filter: 'drop-shadow(0 2px 6px rgba(139, 158, 255, 0.2))',
              }}
            />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Mizero Hub
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Inventory Management System
          </p>
        </div>

        {/* Login Card */}
        <div
          id="login-card"
          className="card p-8 animate-slide-up"
          style={{ boxShadow: 'var(--shadow-xl)' }}
        >
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Sign In</h2>

          {/* Inline Error — slides down with animation */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            error ? 'max-h-20 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'
          }`}>
            <div className="flex items-start gap-2.5 p-3 rounded-lg text-sm font-medium animate-slide-down"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <HiOutlineExclamationCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input focus-ring"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                placeholder="Enter your email"
                autoComplete="email"
                autoFocus
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input focus-ring"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className={`btn-primary w-full py-3 flex items-center justify-center gap-2.5 text-base font-semibold transition-all duration-200 ${
                loading ? 'opacity-80 cursor-wait' : 'hover:translate-y-[-1px]'
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider with decoration */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-disabled)' }}>secure login</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6 animate-fade-in" style={{ color: 'var(--text-disabled)' }}>
          Mizero Inventory Hub v1.0
        </p>
      </div>
    </div>
  );
}
