import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SoundProvider } from './context/SoundContext';
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
import { RoleManagement } from './components/admin/RoleManagement';
import { MastersManagement } from './components/admin/MastersManagement';
import { useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function getDefaultPermittedRoute(hasPermission, hasAnyPermission) {
  if (hasPermission('view_dashboard')) return '/admin/dashboard';
  if (hasPermission('view_employees')) return '/admin/employees';
  if (hasAnyPermission('view_queue', 'review_cases')) return '/admin/queue';
  if (hasPermission('view_reports')) return '/admin/reports';
  if (hasPermission('download_reports')) return '/admin/downloads';
  if (hasPermission('view_audit_logs')) return '/admin/audit';
  if (hasAnyPermission('view_users', 'manage_users', 'manage_roles')) return '/admin/users';
  if (hasAnyPermission('view_masters', 'manage_masters')) return '/admin/masters';
  return '/admin/login';
}

function AdminIndexRedirect() {
  const { hasPermission, hasAnyPermission } = useAuth();
  const target = getDefaultPermittedRoute(hasPermission, hasAnyPermission);
  return <Navigate to={target} replace />;
}

function PermissionRoute({ permission, permissions, children }) {
  const { user, hasPermission, hasAnyPermission, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  const allowed = permission ? hasPermission(permission) : (permissions ? hasAnyPermission(...permissions) : true);
  if (!allowed) {
    const fallback = getDefaultPermittedRoute(hasPermission, hasAnyPermission);
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SoundProvider>
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
            <Route index element={<AdminIndexRedirect />} />
            <Route path="dashboard" element={<PermissionRoute permission="view_dashboard"><Dashboard /></PermissionRoute>} />
            <Route path="employees" element={<PermissionRoute permission="view_employees"><EmployeeMaster /></PermissionRoute>} />
            <Route path="bulk-upload" element={<Navigate to="/admin/employees" replace />} />
            <Route path="queue" element={<PermissionRoute permissions={['view_queue', 'review_cases']}><VerificationQueue /></PermissionRoute>} />
            <Route path="reverification" element={<PermissionRoute permissions={['view_queue', 'review_cases']}><ReverificationView /></PermissionRoute>} />
            <Route path="review/:id" element={<PermissionRoute permissions={['review_cases', 'view_queue']}><CaseReview /></PermissionRoute>} />
            <Route path="reports" element={<PermissionRoute permission="view_reports"><Reports /></PermissionRoute>} />
            <Route path="downloads" element={<PermissionRoute permission="download_reports"><DownloadArea /></PermissionRoute>} />
            <Route path="audit" element={<PermissionRoute permission="view_audit_logs"><AuditLogs /></PermissionRoute>} />
            <Route path="users" element={<PermissionRoute permissions={['view_users', 'manage_users', 'manage_roles']}><UserManagement /></PermissionRoute>} />
            <Route path="roles" element={<PermissionRoute permissions={['manage_roles', 'manage_permissions', 'view_users']}><RoleManagement /></PermissionRoute>} />
            <Route path="masters" element={<PermissionRoute permissions={['view_masters', 'manage_masters']}><MastersManagement /></PermissionRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/verify" replace />} />
        </Routes>
      </BrowserRouter>
          </AuthProvider>
        </SoundProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
