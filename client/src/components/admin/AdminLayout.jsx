import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../common/Sidebar';
import { Navbar } from '../common/Navbar';

export function AdminLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('collman_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  function toggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('collman_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08080C'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#C084FC',
            animation: 'spin 0.8s linear infinite',
            boxShadow: '0 0 20px rgba(192, 132, 252, 0.4)'
          }} />
          <p style={{ color: '#E9D5FF', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.02em' }}>
            Loading Collman BGV Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-viewport">
      <div className={`dashboard-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile drawer backdrop */}
        {sidebarOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="admin-main">
          <Navbar
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
            onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          />
          <Outlet />
        </div>
      </div>
    </div>
  );
}

