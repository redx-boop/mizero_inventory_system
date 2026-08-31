import { useAuth } from '../context/AuthContext';
import StaffDashboard from './StaffDashboard';
import AdminDashboard from './AdminDashboard';

export default function Dashboard() {
  const { hasRole } = useAuth();

  // Staff users see a personal dashboard; everyone else sees the full admin dashboard
  if (hasRole('staff')) {
    return <StaffDashboard />;
  }

  return <AdminDashboard />;
}
