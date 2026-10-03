import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Menu,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  CheckSquare,
  Sliders,
  LogOut,
  User,
  Search,
  Bell,
  Settings,
  Sparkles,
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  RotateCcw,
  FileBarChart,
  Download,
  ScrollText,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function Navbar({ onMenuToggle, isCollapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const navMenuRef = useRef(null);

  const isSuperAdmin = user?.role === 'Super Admin';
  const isReviewer = ['Super Admin', 'HR/Admin', 'BGV Reviewer'].includes(user?.role);
  const displayName = user?.fullName?.split(' ')[0] || user?.username || 'Admin';

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(event.target)) {
        setNavMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setNavMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function handleSearchSubmit(e) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/admin/employees?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <header className="admin-topbar">
      {/* Left: Menu Popover Trigger & Welcome Greeting */}
      <div className="topbar-left">
        <div style={{ position: 'relative' }} ref={navMenuRef}>
          <button
            id="btn-topbar-nav-menu"
            type="button"
            onClick={() => setNavMenuOpen((prev) => !prev)}
            className={`topbar-circle-btn ${navMenuOpen ? 'active' : ''}`}
            style={{ width: 34, height: 34 }}
            title="Navigation Menu"
            aria-label="Navigation Menu"
            aria-expanded={navMenuOpen}
          >
            <Menu size={17} />
          </button>

          {/* Quick Navigation Dropdown Popover (No full-screen blur, sharp and isolated) */}
          {navMenuOpen && (
            <div className="quick-nav-dropdown-menu">
              <div className="dropdown-nav-header">
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
                  Collman Navigation
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Quick module access
                </div>
              </div>

              <div className="dropdown-nav-body">
                <Link
                  to="/admin/dashboard"
                  className="dropdown-item"
                  onClick={() => setNavMenuOpen(false)}
                >
                  <LayoutDashboard size={15} color="var(--accent-purple)" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/admin/employees"
                  className="dropdown-item"
                  onClick={() => setNavMenuOpen(false)}
                >
                  <Users size={15} color="var(--accent-purple)" />
                  <span>Employee Master</span>
                </Link>

                {isReviewer && (
                  <Link
                    to="/admin/queue"
                    className="dropdown-item"
                    onClick={() => setNavMenuOpen(false)}
                  >
                    <CheckSquare size={15} color="var(--accent-purple)" />
                    <span>Verification Queue</span>
                  </Link>
                )}

                {isReviewer && (
                  <Link
                    to="/admin/reverification"
                    className="dropdown-item"
                    onClick={() => setNavMenuOpen(false)}
                  >
                    <RotateCcw size={15} color="var(--accent-purple)" />
                    <span>Reverification Cases</span>
                  </Link>
                )}

                <Link
                  to="/admin/reports"
                  className="dropdown-item"
                  onClick={() => setNavMenuOpen(false)}
                >
                  <FileBarChart size={15} color="var(--accent-purple)" />
                  <span>Reports & Analytics</span>
                </Link>

                <Link
                  to="/admin/downloads"
                  className="dropdown-item"
                  onClick={() => setNavMenuOpen(false)}
                >
                  <Download size={15} color="var(--accent-purple)" />
                  <span>Download Area</span>
                </Link>

                <Link
                  to="/admin/audit"
                  className="dropdown-item"
                  onClick={() => setNavMenuOpen(false)}
                >
                  <ScrollText size={15} color="var(--accent-purple)" />
                  <span>Audit Logs</span>
                </Link>

                {isSuperAdmin && (
                  <Link
                    to="/admin/users"
                    className="dropdown-item"
                    onClick={() => setNavMenuOpen(false)}
                  >
                    <UserCog size={15} color="var(--accent-purple)" />
                    <span>User Management</span>
                  </Link>
                )}

                {isSuperAdmin && (
                  <Link
                    to="/admin/masters"
                    className="dropdown-item"
                    onClick={() => setNavMenuOpen(false)}
                  >
                    <Sliders size={15} color="var(--accent-purple)" />
                    <span>Masters & Settings</span>
                  </Link>
                )}

                <div className="dropdown-divider" />

                {onToggleCollapse && (
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setNavMenuOpen(false);
                      onToggleCollapse();
                    }}
                  >
                    {isCollapsed ? (
                      <PanelLeftOpen size={15} color="var(--accent-purple)" />
                    ) : (
                      <PanelLeftClose size={15} color="var(--accent-purple)" />
                    )}
                    <span>{isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
                  </button>
                )}

                <a
                  href="/verify"
                  target="_blank"
                  rel="noreferrer"
                  className="dropdown-item"
                  onClick={() => setNavMenuOpen(false)}
                >
                  <ExternalLink size={15} color="var(--accent-purple)" />
                  <span>Employee Portal (/verify)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        <div>
          <h1 className="topbar-brand-title">
            Welcome, {displayName}
          </h1>
          <div className="topbar-subtitle">
            Here's your employee address verification & BGV overview
          </div>
        </div>
      </div>

      {/* Right controls matching reference style: Search pill, Circular icons, Theme Toggle, Profile chip */}
      <div className="topbar-right">
        {/* Search pill: "Ask Collman BGV AI or search employee..." */}
        <div className="topbar-search-pill">
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search Emp ID, candidate, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchSubmit}
          />
        </div>

        {/* Circular Theme Toggle Button (Dark / Light Mode) */}
        <button
          id="btn-theme-toggle"
          type="button"
          className="topbar-circle-btn theme-toggle-btn"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={toggleTheme}
          aria-label="Toggle Color Theme"
        >
          {theme === 'dark' ? (
            <Sun size={17} color="#FBBF24" />
          ) : (
            <Moon size={17} color="#6366F1" />
          )}
        </button>

        {/* Circular Notification Button */}
        <button
          type="button"
          className="topbar-circle-btn"
          title="System Notifications"
          onClick={() => navigate('/admin/audit')}
        >
          <Bell size={16} />
        </button>

        {/* Circular Settings Button */}
        {isSuperAdmin && (
          <button
            type="button"
            className="topbar-circle-btn"
            title="System Settings"
            onClick={() => navigate('/admin/masters')}
          >
            <Settings size={16} />
          </button>
        )}

        {/* Open Common Link Pill */}
        <a
          href="/verify"
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-sm topbar-common-link-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            padding: '6px 12px',
            flexShrink: 0
          }}
          title="Open Common Verification Link"
        >
          <span className="topbar-common-link-text">Common Link</span>
          <ExternalLink size={12} color="var(--accent-purple)" />
        </a>

        {/* User profile dropdown container */}
        <div className="user-dropdown-container" ref={dropdownRef}>
          <button
            type="button"
            className={`user-profile-trigger ${dropdownOpen ? 'active' : ''}`}
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
          >
            <div className="user-avatar-circle">
              {user?.fullName?.charAt(0) || 'U'}
            </div>

            <div className="user-profile-meta" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.2 }}>
              <span className="user-name" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                {user?.fullName}
              </span>
              <span className="user-email" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {user?.email || user?.role}
              </span>
            </div>

            <ChevronDown
              size={13}
              color="var(--text-muted)"
              style={{
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease',
                marginLeft: 2
              }}
            />
          </button>

          {/* Dropdown Menu Popover */}
          {dropdownOpen && (
            <div className="user-dropdown-menu">
              <div className="dropdown-user-header">
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {user?.fullName}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {user?.email || user?.username || 'Collman Administrator'}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.66rem', padding: '2px 8px' }}>
                    {user?.role}
                  </span>
                </div>
              </div>

              <a
                href="/verify"
                target="_blank"
                rel="noreferrer"
                className="dropdown-item"
                onClick={() => setDropdownOpen(false)}
              >
                <ExternalLink size={15} color="var(--accent-purple)" />
                <span>Employee Portal (/verify)</span>
              </a>

              <Link
                to="/admin/queue"
                className="dropdown-item"
                onClick={() => setDropdownOpen(false)}
              >
                <CheckSquare size={15} color="var(--accent-purple)" />
                <span>Verification Queue</span>
              </Link>

              {isSuperAdmin && (
                <Link
                  to="/admin/masters"
                  className="dropdown-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <Sliders size={15} color="var(--accent-purple)" />
                  <span>Masters & Settings</span>
                </Link>
              )}

              {/* Theme Toggle option */}
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  toggleTheme();
                }}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun size={15} color="#FBBF24" />
                    <span style={{ flex: 1 }}>Light Mode</span>
                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Switch</span>
                  </>
                ) : (
                  <>
                    <Moon size={15} color="#6366F1" />
                    <span style={{ flex: 1 }}>Dark Mode</span>
                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Switch</span>
                  </>
                )}
              </button>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item danger"
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

