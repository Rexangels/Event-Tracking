
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import ReportEventPage from './pages/ReportEventPage';
import LoginPage from './pages/LoginPage';
import PublicReportPage from './pages/PublicReportPage';
import OfficerDashboard from './pages/OfficerDashboard';
import ReportDetailPage from './pages/ReportDetailPage';
import FormVersionHistoryPage from './pages/FormVersionHistoryPage';
import { authService, UserRole } from './services/authService';


const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactElement; allowedRoles?: UserRole[] }) => {
  const isAuthenticated = authService.isAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !authService.hasAnyRole(allowedRoles)) {
    return <Navigate to={authService.getDefaultRoute()} replace />;
  }

  return children;
};

const RootRedirect = () => <Navigate to={authService.isAuthenticated() ? authService.getDefaultRoute() : '/inehss'} replace />;

const LoginRoute = () => authService.isAuthenticated()
  ? <Navigate to={authService.getDefaultRoute()} replace />
  : <LoginPage />;

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* INEHSS Public Portal - No auth required */}
        <Route path="/inehss" element={<PublicReportPage />} />
        <Route path="/inehss/report" element={<PublicReportPage />} />

        {/* INEHSS Officer Portal - Auth required */}
        <Route
          path="/inehss/officer"
          element={
            <ProtectedRoute allowedRoles={['officer', 'admin', 'supervisor']}>
              <OfficerDashboard
                authToken={authService.getToken() || ''}
                userName={authService.getUser()?.username || 'Officer'}
              />
            </ProtectedRoute>
          }
        />

        {/* INEHSS Report Detail - Auth required */}
        <Route
          path="/inehss/reports/:reportId"
          element={
            <ProtectedRoute>
              <ReportDetailPage />
            </ProtectedRoute>
          }
        />

        {/* INEHSS Form Version History - Auth required */}
        <Route
          path="/inehss/forms/:formId/history"
          element={
            <ProtectedRoute>
              <FormVersionHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Public Reporting Channel */}
        <Route path="/report" element={<ReportEventPage />} />

        {/* Authentication */}
        <Route path="/login" element={<LoginRoute />} />

        {/* Secure Admin Grid */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'analyst']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
};

export default App;
