import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { VerificationProvider } from './context/VerificationContext';
import { EmployeeWizard } from './components/employee/EmployeeWizard';
import { Login } from './components/admin/Login';
import { AdminLayout } from './components/admin/AdminLayout';
import { Dashboard } from './components/admin/Dashboard';
import { EmployeeMaster } from './components/admin/EmployeeMaster';
import { BulkUploadPage } from './components/admin/BulkUploadPage';
import { VerificationQueue } from './components/admin/VerificationQueue';
import { ReverificationView } from './components/admin/ReverificationView';
import { CaseReview } from './components/admin/CaseReview';
import { Reports } from './components/admin/Reports';
import { DownloadArea } from './components/admin/DownloadArea';
import { AuditLogs } from './components/admin/AuditLogs';
import { UserManagement } from './components/admin/UserManagement';
import { MastersManagement } from './components/admin/MastersManagement';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 1. EMPLOYEE SIDE: ONE COMMON ADDRESS VERIFICATION LINK FOR ALL EMPLOYEES */}
          <Route
            path="/"
            element={
              <VerificationProvider>
                <EmployeeWizard />
              </VerificationProvider>
            }
          />
          <Route
            path="/verify"
            element={
              <VerificationProvider>
                <EmployeeWizard />
              </VerificationProvider>
            }
          />

          {/* 2. HR & BGV PORTAL LOGIN */}
          <Route path="/admin/login" element={<Login />} />

          {/* 3. HR & BGV REVIEWER SECURE PORTAL */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<EmployeeMaster />} />
            <Route path="bulk-upload" element={<Navigate to="/admin/employees" replace />} />
            <Route path="queue" element={<VerificationQueue />} />
            <Route path="reverification" element={<ReverificationView />} />
            <Route path="review/:id" element={<CaseReview />} />
            <Route path="reports" element={<Reports />} />
            <Route path="downloads" element={<DownloadArea />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="masters" element={<MastersManagement />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/verify" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
