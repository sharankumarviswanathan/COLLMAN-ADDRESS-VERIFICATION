import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  RotateCcw,
  FileBarChart,
  Download,
  ScrollText,
  UserCog,
  ShieldCheck,
  Sliders,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  X
} from 'lucide-react';

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  isLocked,
  lockMode,
  onToggleCollapse,
  onMouseEnter,
  onMouseLeave
}) {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className={`admin-sidebar ${isOpen ? 'open' : ''} ${isLocked ? 'is-locked' : 'is-unlocked'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Sidebar Header */}
      <div className="admin-sidebar-header">
        <NavLink to="/admin/dashboard" className="sidebar-brand-wrapper" onClick={onClose}>
          <div className="sidebar-logo-emblem">
            C
          </div>
          <div className="sidebar-brand-text">
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.03em', lineHeight: 1.15 }}>
              COLLMAN
            </div>
            <div style={{ fontSize: '0.64rem', color: '#E9D5FF', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '145px' }}>
              Address Verification
            </div>
          </div>
        </NavLink>

        {/* Mobile close button / Desktop lock toggle arrow */}
        {isOpen ? (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onClose}
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            id="btn-sidebar-toggle-arrow"
            type="button"
            className={`sidebar-collapse-btn ${isLocked ? 'is-locked' : ''}`}
            onClick={() => onToggleCollapse?.()}
            title={
              isLocked
                ? (isCollapsed
                    ? 'Sidebar locked collapsed • Click to unlock auto-hover'
                    : 'Sidebar locked expanded • Click to unlock auto-hover')
                : (isCollapsed
                    ? 'Auto-hover active • Click to expand and lock'
                    : 'Auto-hover active • Click to lock expanded')
            }
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {isLocked && <span className="sidebar-lock-dot" />}
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="admin-sidebar-nav">
        {hasPermission('view_dashboard') && (
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Dashboard' : undefined}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </NavLink>
        )}

        {hasPermission('view_employees') && (
          <NavLink
            to="/admin/employees"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Employee Master' : undefined}
          >
            <Users size={19} />
            <span>Employee Master</span>
          </NavLink>
        )}

        {hasAnyPermission('view_queue', 'review_cases') && (
          <NavLink
            to="/admin/queue"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Verification Queue' : undefined}
          >
            <CheckSquare size={19} />
            <span>Verification Queue</span>
          </NavLink>
        )}

        {hasAnyPermission('view_queue', 'review_cases') && (
          <NavLink
            to="/admin/reverification"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Reverification Cases' : undefined}
          >
            <RotateCcw size={19} />
            <span>Reverification Cases</span>
          </NavLink>
        )}

        {hasPermission('view_reports') && (
          <NavLink
            to="/admin/reports"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Reports' : undefined}
          >
            <FileBarChart size={19} />
            <span>Reports</span>
          </NavLink>
        )}

        {hasPermission('download_reports') && (
          <NavLink
            to="/admin/downloads"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Download Area' : undefined}
          >
            <Download size={19} />
            <span>Download Area</span>
          </NavLink>
        )}

        {hasPermission('view_audit_logs') && (
          <NavLink
            to="/admin/audit"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Audit Logs' : undefined}
          >
            <ScrollText size={19} />
            <span>Audit Logs</span>
          </NavLink>
        )}

        {hasAnyPermission('view_users', 'manage_users', 'manage_roles') && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'User Management' : undefined}
          >
            <UserCog size={19} />
            <span>User Management</span>
          </NavLink>
        )}

        {hasAnyPermission('manage_roles', 'manage_permissions', 'view_users') && (
          <NavLink
            to="/admin/roles"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Roles & Permissions' : undefined}
          >
            <ShieldCheck size={19} />
            <span>Roles & Permissions</span>
          </NavLink>
        )}

        {hasAnyPermission('view_masters', 'manage_masters') && (
          <NavLink
            to="/admin/masters"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            title={isCollapsed ? 'Masters & Settings' : undefined}
          >
            <Sliders size={19} />
            <span>Masters & Settings</span>
          </NavLink>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="admin-sidebar-footer">
        {/* Quick Theme Toggle */}
        <button
          type="button"
          className="sidebar-common-link-card"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {theme === 'dark' ? (
              <Sun size={14} color="#FBBF24" />
            ) : (
              <Moon size={14} color="#818CF8" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <span className="sidebar-card-badge" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Toggle
          </span>
        </button>

        <a
          href="/verify"
          target="_blank"
          rel="noreferrer"
          className="sidebar-common-link-card"
          title={isCollapsed ? 'Open Employee Link (/verify)' : undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExternalLink size={14} color="#60A5FA" />
            <span>Common Link (/verify)</span>
          </div>
          <span className="sidebar-card-badge" style={{ fontSize: '0.7rem', color: '#93C5FD' }}>↗</span>
        </a>

        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar" title={user?.fullName || 'User'}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>

          <div className="sidebar-user-info">
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.fullName}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#93C5FD', fontWeight: 600, letterSpacing: '0.04em' }}>
              {user?.role}
            </div>
          </div>

          <button
            onClick={logout}
            className="sidebar-logout-btn"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
