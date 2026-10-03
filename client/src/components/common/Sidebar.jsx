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
  Sliders,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  X
} from 'lucide-react';

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isSuperAdmin = user?.role === 'Super Admin';
  const isReviewer = ['Super Admin', 'HR/Admin', 'BGV Reviewer'].includes(user?.role);

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Sidebar Header */}
      <div className="admin-sidebar-header">
        <NavLink to="/admin/dashboard" className="sidebar-brand-wrapper" onClick={onClose}>
          <div className="sidebar-logo-emblem">
            C
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.03em', lineHeight: 1.15 }}>
                COLLMAN
              </div>
              <div style={{ fontSize: '0.64rem', color: '#E9D5FF', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '145px' }}>
                Address Verification
              </div>
            </div>
          )}
        </NavLink>

        {/* Mobile close button */}
        {isOpen ? (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onClose}
            title="Close navigation"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="admin-sidebar-nav">
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          title={isCollapsed ? 'Dashboard' : undefined}
        >
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/admin/employees"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          title={isCollapsed ? 'Employee Master' : undefined}
        >
          <Users size={19} />
          <span>Employee Master</span>
        </NavLink>

        {isReviewer && (
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

        {isReviewer && (
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

        <NavLink
          to="/admin/reports"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          title={isCollapsed ? 'Reports' : undefined}
        >
          <FileBarChart size={19} />
          <span>Reports</span>
        </NavLink>

        <NavLink
          to="/admin/downloads"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          title={isCollapsed ? 'Download Area' : undefined}
        >
          <Download size={19} />
          <span>Download Area</span>
        </NavLink>

        <NavLink
          to="/admin/audit"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          title={isCollapsed ? 'Audit Logs' : undefined}
        >
          <ScrollText size={19} />
          <span>Audit Logs</span>
        </NavLink>

        {isSuperAdmin && (
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

        {isSuperAdmin && (
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
          {!isCollapsed && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Toggle
            </span>
          )}
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
          {!isCollapsed && <span style={{ fontSize: '0.7rem', color: '#93C5FD' }}>↗</span>}
        </a>

        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar" title={user?.fullName || 'User'}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>

          {!isCollapsed && (
            <div className="sidebar-user-info">
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.fullName}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#93C5FD', fontWeight: 600, letterSpacing: '0.04em' }}>
                {user?.role}
              </div>
            </div>
          )}

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
