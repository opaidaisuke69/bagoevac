import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';

// LGU Admin pages
import LguDashboard from './pages/lgu/Dashboard';
import LguReports from './pages/lgu/Reports';
import LguEvacuees from './pages/lgu/Evacuees';
import LguCenters from './pages/lgu/Centers';
import LguBroadcast from './pages/lgu/Broadcast';
import LguGenerateReports from './pages/lgu/GenerateReports';
import LguBarangayAccounts from './pages/lgu/BarangayAccounts';
import LguRescueMonitor from './pages/lgu/RescueMonitor';

// Barangay Admin pages
import BrgyDashboard from './pages/brgy/Dashboard';
import BrgyRescue from './pages/brgy/Rescue';
import BrgyCenters from './pages/brgy/Centers';
import BrgyEvacuees from './pages/brgy/Evacuees';
import BrgyRescuers from './pages/brgy/Rescuers';
import BrgyChat from './pages/brgy/Chat';

function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const user = useAuthStore((s) => s.user);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* LGU Admin routes */}
      <Route
        path="/lgu"
        element={
          <ProtectedRoute allowedRoles={['LGU_Admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LguDashboard />} />
        <Route path="reports" element={<LguReports />} />
        <Route path="evacuees" element={<LguEvacuees />} />
        <Route path="centers" element={<LguCenters />} />
        <Route path="broadcast" element={<LguBroadcast />} />
        <Route path="accounts" element={<LguBarangayAccounts />} />
        <Route path="generate-reports" element={<LguGenerateReports />} />
        <Route path="rescue-monitor" element={<LguRescueMonitor />} />
      </Route>

      {/* Barangay Admin routes */}
      <Route
        path="/brgy"
        element={
          <ProtectedRoute allowedRoles={['Barangay_Official']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BrgyDashboard />} />
        <Route path="rescue" element={<BrgyRescue />} />
        <Route path="centers" element={<BrgyCenters />} />
        <Route path="evacuees" element={<BrgyEvacuees />} />
        <Route path="rescuers" element={<BrgyRescuers />} />
        <Route path="chat" element={<BrgyChat />} />
      </Route>

      {/* Root redirect based on role */}
      <Route
        path="/"
        element={
          user?.role === 'LGU_Admin'
            ? <Navigate to="/lgu" replace />
            : user?.role === 'Barangay_Official'
            ? <Navigate to="/brgy" replace />
            : <Navigate to="/login" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
