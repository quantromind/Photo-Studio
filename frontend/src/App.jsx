import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/common/Toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import StudioDashboard from './pages/studio/StudioDashboard';
import OrdersPage from './pages/studio/OrdersPage';
import NewOrderPage from './pages/studio/NewOrderPage';
import RevenueDashboard from './pages/studio/RevenueDashboard';
import CategoriesPage from './pages/studio/CategoriesPage';
import CustomersPage from './pages/studio/CustomersPage';
import StaffPage from './pages/studio/StaffPage';
import PartiesPage from './pages/studio/PartiesPage';
import BalanceLedgerPage from './pages/studio/BalanceLedgerPage';
import StudioSettings from './pages/studio/StudioSettings';
import CommunityPage from './pages/studio/CommunityPage';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import TrackOrder from './pages/customer/TrackOrder';
import OrderDetail from './pages/customer/OrderDetail';
import AlbumPage from './pages/customer/AlbumPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import './styles/index.css';

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner text="Authenticating..." />;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  return children;
};

// Redirect based on role
const RoleRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'superadmin') return <Navigate to="/admin/dashboard" />;
  if (user.role === 'studioadmin') return <Navigate to="/dashboard" />;
  if (user.role === 'staff') return <Navigate to="/orders" />;
  return <Navigate to="/customer/orders" />;
};

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <AuthProvider>
        <Router>
          <ToastContainer />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/track" element={<TrackOrder />} />
            <Route path="/album/:orderId" element={<AlbumPage />} />

            {/* Root redirect */}
            <Route path="/" element={<RoleRedirect />} />

            {/* Studio Admin only routes */}
            <Route element={
              <ProtectedRoute allowedRoles={['studioadmin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/parties" element={<PartiesPage />} />
              <Route path="/ledger" element={<BalanceLedgerPage />} />
            </Route>

            {/* Shared Studio Routes (studioadmin + staff with permissions) */}
            <Route element={
              <ProtectedRoute allowedRoles={['studioadmin', 'staff']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<StudioDashboard />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/new" element={<NewOrderPage />} />
              <Route path="/revenue" element={<RevenueDashboard />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/settings" element={<StudioSettings />} />
              <Route path="/community" element={<CommunityPage />} />
            </Route>

            {/* Super Admin routes */}
            <Route element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
              <Route path="/admin/studios" element={<SuperAdminDashboard />} />
            </Route>

            {/* Customer routes */}
            <Route path="/customer/orders" element={
              <ProtectedRoute allowedRoles={['customer']}>
                <OrderDetail />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
