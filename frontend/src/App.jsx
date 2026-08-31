import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import OfflineIndicator from './components/OfflineIndicator';

// Lazy-loaded pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const StockIn = lazy(() => import('./pages/StockIn'));
const StockOut = lazy(() => import('./pages/StockOut'));
const Adjustments = lazy(() => import('./pages/Adjustments'));
const Borrowings = lazy(() => import('./pages/Borrowings'));
const Returns = lazy(() => import('./pages/Returns'));
const Requests = lazy(() => import('./pages/Requests'));
const Leftovers = lazy(() => import('./pages/Leftovers'));
const DamageLiabilities = lazy(() => import('./pages/DamageLiabilities'));
const Budget = lazy(() => import('./pages/Budget'));
const Reports = lazy(() => import('./pages/Reports'));
const Departments = lazy(() => import('./pages/Departments'));
const Users = lazy(() => import('./pages/Users'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10" style={{ border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)' }} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <MainLayout>{children}</MainLayout>;
}

// Role-protected route — checks authentication first, then role authorization
function RoleRoute({ children, roles }) {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)' }} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.some(role => hasRole(role))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <MainLayout>{children}</MainLayout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)' }} /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PWAUpdatePrompt />
      <OfflineIndicator />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/force-password-change" element={<ProtectedRoute><ForcePasswordChange /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        {/* Role-protected routes: staff users are redirected to dashboard */}
        <Route path="/analytics" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Analytics /></RoleRoute>} />
        {/* Staff can only view inventory (read-only with restricted UI); all other inventory/mutation pages require admin or manager roles */}
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/stock-in" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><StockIn /></RoleRoute>} />
        <Route path="/stock-out" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><StockOut /></RoleRoute>} />
        <Route path="/adjustments" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Adjustments /></RoleRoute>} />
        <Route path="/borrowings" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Borrowings /></RoleRoute>} />
        <Route path="/returns" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Returns /></RoleRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/leftovers" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Leftovers /></RoleRoute>} />
        <Route path="/damage-liabilities" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><DamageLiabilities /></RoleRoute>} />
        <Route path="/budget" element={<RoleRoute roles={['super_admin', 'admin']}><Budget /></RoleRoute>} />
        <Route path="/reports" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Reports /></RoleRoute>} />
        <Route path="/suppliers" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><Suppliers /></RoleRoute>} />
        <Route path="/departments" element={<RoleRoute roles={['super_admin', 'admin']}><Departments /></RoleRoute>} />
        <Route path="/users" element={<RoleRoute roles={['super_admin', 'admin']}><Users /></RoleRoute>} />
        <Route path="/activity-logs" element={<RoleRoute roles={['super_admin', 'admin', 'stock_manager']}><ActivityLogs /></RoleRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
