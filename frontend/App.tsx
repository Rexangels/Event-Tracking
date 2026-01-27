
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import ReportEventPage from './pages/ReportEventPage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Reporting Channel */}
        <Route path="/report" element={<ReportEventPage />} />

        {/* Secure Admin Grid */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Default Redirect: Secure by default, redirect to admin login (simulated) */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
