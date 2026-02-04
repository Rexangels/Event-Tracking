
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import ReportEventPage from './pages/ReportEventPage';
import LoginPage from './pages/LoginPage';
import PublicReportPage from './pages/PublicReportPage';
import OfficerDashboard from './pages/OfficerDashboard';
import { authService } from './services/authService';


const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const isAuthenticated = authService.isAuthenticated();
  const location = useLocation();
  return isAuthenticated ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
};

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
            <ProtectedRoute>
              <OfficerDashboard
                authToken={authService.getToken() || ''}
                userName={authService.getUser()?.username || 'Officer'}
              />
            </ProtectedRoute>
          }
        />

        {/* Public Reporting Channel */}
        <Route path="/report" element={<ReportEventPage />} />

        {/* Authentication */}
        <Route path="/login" element={<LoginPage />} />

        {/* Secure Admin Grid */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default Redirect: Secure by default, redirect to admin login (simulated) */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
