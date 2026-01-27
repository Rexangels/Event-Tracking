
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import ReportEventPage from './pages/ReportEventPage';
import LoginPage from './pages/LoginPage';
import { authService } from './services/authService';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
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
