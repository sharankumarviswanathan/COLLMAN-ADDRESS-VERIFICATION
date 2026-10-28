import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  async function checkCurrentUser() {
    const token = localStorage.getItem('collman_admin_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.auth.me();
      setUser(data.user);
    } catch (err) {
      localStorage.removeItem('collman_admin_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const data = await api.auth.login(username, password);
    localStorage.setItem('collman_admin_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('collman_admin_token');
    setUser(null);
  }

  function checkPermissionMatch(userPerms, permKey) {
    if (userPerms.includes(permKey)) return true;

    // Backward-compatibility umbrella mappings & granular aliases
    if (permKey === 'approve_cases' || permKey === 'reject_cases') {
      if (userPerms.includes('make_decision')) return true;
    }
    if (permKey === 'make_decision') {
      if (userPerms.includes('approve_cases') || userPerms.includes('reject_cases')) return true;
    }
    if (permKey === 'upload_employees') {
      if (userPerms.includes('bulk_upload')) return true;
    }
    if (permKey === 'bulk_upload') {
      if (userPerms.includes('upload_employees')) return true;
    }
    if (['create_user', 'edit_user', 'activate_user', 'deactivate_user', 'delete_user'].includes(permKey)) {
      if (userPerms.includes('manage_users')) return true;
    }
    if (permKey === 'manage_users') {
      if (userPerms.includes('create_user') || userPerms.includes('edit_user')) return true;
    }
    if (['create_masters', 'edit_masters', 'delete_masters', 'manage_settings'].includes(permKey)) {
      if (userPerms.includes('manage_masters')) return true;
    }
    if (permKey === 'manage_masters') {
      if (userPerms.includes('create_masters') || userPerms.includes('edit_masters') || userPerms.includes('manage_settings')) return true;
    }
    if (permKey === 'manage_permissions' || permKey === 'manage_roles') {
      if (userPerms.includes('manage_roles') || userPerms.includes('manage_permissions')) return true;
    }
    if (permKey === 'download_case_report') {
      if (userPerms.includes('download_reports')) return true;
    }
    if (['export_dashboard', 'export_employees', 'export_queue', 'export_reports', 'export_audit_logs'].includes(permKey)) {
      if (userPerms.includes('download_reports')) return true;
    }
    return false;
  }

  function hasPermission(permKey) {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    if (!Array.isArray(user.permissions)) return false;
    return checkPermissionMatch(user.permissions, permKey);
  }

  function hasAnyPermission(...permKeys) {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    if (!Array.isArray(user.permissions)) return false;
    return permKeys.some((k) => checkPermissionMatch(user.permissions, k));
  }

  const isTeamLeader = Boolean(
    user &&
    user.role !== 'Super Admin' &&
    (user.role?.toLowerCase() === 'team leader' || user.role?.toLowerCase().includes('team lead') || user.role?.toLowerCase() === 'tl')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        checkCurrentUser,
        refreshUser: checkCurrentUser,
        hasPermission,
        hasAnyPermission,
        isTeamLeader
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
