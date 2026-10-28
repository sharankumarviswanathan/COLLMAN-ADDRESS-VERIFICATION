import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import {
  UserPlus,
  UserCog,
  Check,
  X,
  Shield,
  Lock,
  Mail,
  Building,
  Briefcase,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Search,
  Square,
  Trash2,
  Pencil,
  Save,
  UploadCloud,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { BulkUserUploadModal } from './BulkUserUploadModal';

export function UserManagement() {
  const { user, hasPermission, hasAnyPermission, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Search, Filter & Pagination State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // --- Create User Modal ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUserModalOpen, setIsBulkUserModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    manager: '',
    password: '',
    full_name: '',
    role: '',
    branch: '',
    department: ''
  });



  // --- Edit User Modal ---
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editUserForm, setEditUserForm] = useState(null);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState('');
  const [editUserSuccess, setEditUserSuccess] = useState('');
  const [masters, setMasters] = useState({ branches: [], departments: [] });


  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [toastMsg, setToastMsg] = useState({ type: '', text: '' });
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // --- Export State ---
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleExportUsers(format = 'xlsx') {
    setShowExportMenu(false);
    setExporting(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (branchFilter !== 'ALL') params.branch = branchFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      await api.users.exportUsers(format, params);
      const exportedCount = hasActiveFilters ? filteredUsers.length : users.length;
      showToast(`User accounts directory exported successfully (${exportedCount} records).`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast(err.message || 'Failed to export user list.', 'error');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function showToast(text, type = 'success') {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg({ type: '', text: '' }), 4000);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadRoles(), loadMasters()]);
    } catch (err) {
      console.error('Failed to load user and role directory:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMasters() {
    try {
      const data = await api.masters.getAll();
      if (data) {
        setMasters(data);
      }
    } catch (err) {
      console.warn('Failed to load masters for users:', err);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.users.list();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function loadRoles() {
    try {
      const data = await api.roles.list();
      setRoles(data.roles || []);
      if (data.systemPermissions) {
        setPermissionsCatalog(data.systemPermissions);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  }

  // --- User Handlers ---
  function openCreateUser() {
    setFormData({
      username: '',
      manager: '',
      password: '',
      full_name: '',
      role: '',
      branch: '',
      department: ''
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.full_name?.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!formData.username?.trim()) {
      setErrorMsg('Employee ID is required.');
      return;
    }
    if (!formData.role) {
      setErrorMsg('Please select a Portal Role.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setErrorMsg('Initial Password must be at least 6 characters.');
      return;
    }

    try {
      await api.users.create({
        ...formData,
        manager: formData.manager && formData.manager.trim() ? formData.manager.trim() : null
      });
      setSuccessMsg(`User account with Employee ID ${formData.username} created successfully.`);
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg('');
        setFormData({
          username: '',
          manager: '',
          password: '',
          full_name: '',
          role: '',
          branch: '',
          department: ''
        });
        loadUsers();
      }, 1000);
    } catch (err) {
      console.error('Create user error:', err);
      setErrorMsg(err.message || 'Failed to create user.');
    }
  }

  async function handleToggleStatus(u) {
    setActionLoadingId(u.id);
    try {
      await api.users.update(u.id, {
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        branch: u.branch,
        department: u.department,
        is_active: !u.is_active
      });
      loadUsers();
    } catch (err) {
      alert('Failed to update user status.');
    } finally {
      setActionLoadingId(null);
    }
  }

  // --- Edit User Handlers ---
  function openEditUser(u) {
    setEditUserForm({
      id: u.id,
      username: u.username,
      full_name: u.full_name || '',
      manager: u.manager || '',
      role: u.role || (roles.length > 0 ? roles[0].role_name : 'BGV Reviewer'),
      branch: u.branch || '',
      department: u.department || '',
      is_active: u.is_active ? 1 : 0,
      newPassword: ''
    });
    setEditUserError('');
    setEditUserSuccess('');
    setEditUserModalOpen(true);
  }

  async function handleEditUserSubmit(e) {
    e.preventDefault();
    if (!editUserForm.full_name.trim() || !editUserForm.role) {
      setEditUserError('Full Name and Role are mandatory.');
      return;
    }
    if (editUserForm.newPassword && editUserForm.newPassword.trim().length < 6) {
      setEditUserError('New password must be at least 6 characters long.');
      return;
    }

    setEditUserLoading(true);
    setEditUserError('');

    try {
      await api.users.update(editUserForm.id, {
        full_name: editUserForm.full_name.trim(),
        manager: editUserForm.manager && editUserForm.manager.trim() ? editUserForm.manager.trim() : null,
        role: editUserForm.role,
        branch: editUserForm.branch || null,
        department: editUserForm.department || null,
        is_active: Boolean(editUserForm.is_active),
        newPassword: editUserForm.newPassword ? editUserForm.newPassword.trim() : undefined
      });
      setEditUserSuccess(`Account for Employee ID ${editUserForm.username} updated successfully.`);
      showToast(`User ${editUserForm.username} updated successfully.`);
      setTimeout(() => {
        setEditUserModalOpen(false);
        setEditUserSuccess('');
        loadUsers();
      }, 900);
    } catch (err) {
      console.error('Update user error:', err);
      setEditUserError(err.message || 'Failed to update user.');
    } finally {
      setEditUserLoading(false);
    }
  }

  // --- User Delete Handler ---
  async function handleDeleteUser(u) {
    if (!u || u.id === user?.id) return;
    if (u.role === 'Super Admin') {
      alert('Super Admin accounts cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user account '${u.username}' (${u.full_name})?`)) return;

    setActionLoadingId(u.id);
    try {
      await api.users.delete(u.id);
      showToast(`User account '${u.username}' deleted successfully.`);
      await loadUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setActionLoadingId(null);
    }
  }

  // --- Badge Helper ---
  function getRoleBadge(roleName) {
    const matchedRole = roles.find((r) => r.role_name === roleName);
    const color = matchedRole?.badge_color;

    if (color === 'primary' || roleName === 'Super Admin') {
      return <span className="badge badge-primary"><span className="badge-dot dot-primary" />{roleName}</span>;
    }
    if (color === 'info' || roleName === 'HR/Admin') {
      return <span className="badge badge-info"><span className="badge-dot dot-info" />{roleName}</span>;
    }
    if (color === 'warning' || roleName === 'BGV Reviewer') {
      return <span className="badge badge-warning"><span className="badge-dot dot-warning" />{roleName}</span>;
    }
    if (color === 'success') {
      return <span className="badge badge-success"><span className="badge-dot dot-success" />{roleName}</span>;
    }
    return <span className="badge badge-secondary"><span className="badge-dot" style={{ backgroundColor: 'var(--text-muted)' }} />{roleName}</span>;
  }

  const distinctBranches = Array.from(
    new Set([
      ...(masters.branches || []).map((b) => b.branch_name || b.name || b.branch_code).filter(Boolean),
      ...users.map((u) => u.branch).filter(Boolean)
    ])
  ).sort();

  const distinctRoles = Array.from(
    new Set([
      ...roles.map((r) => r.role_name).filter(Boolean),
      ...users.map((u) => u.role).filter(Boolean)
    ])
  ).sort();

  const filteredUsers = users.filter((u) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = (u.full_name || '').toLowerCase().includes(q);
      const matchEmpId = (u.username || '').toLowerCase().includes(q);
      const matchManager = (u.manager || '').toLowerCase().includes(q);
      const matchBranch = (u.branch || '').toLowerCase().includes(q);
      const matchDept = (u.department || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchRole = (u.role || '').toLowerCase().includes(q);

      if (!matchName && !matchEmpId && !matchManager && !matchBranch && !matchDept && !matchEmail && !matchRole) {
        return false;
      }
    }

    if (roleFilter !== 'ALL' && u.role !== roleFilter) {
      return false;
    }

    if (branchFilter !== 'ALL' && u.branch !== branchFilter) {
      return false;
    }

    if (statusFilter === 'ACTIVE' && !u.is_active) {
      return false;
    }
    if (statusFilter === 'INACTIVE' && u.is_active) {
      return false;
    }

    return true;
  });

  const hasActiveFilters = searchQuery.trim() !== '' || roleFilter !== 'ALL' || branchFilter !== 'ALL' || statusFilter !== 'ALL';

  function handleClearFilters() {
    setSearchQuery('');
    setRoleFilter('ALL');
    setBranchFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
  }

  const totalFiltered = filteredUsers.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalFiltered / pageSize) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedUsers = pageSize === 'ALL'
    ? filteredUsers
    : filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allPermKeys = permissionsCatalog.flatMap((c) => c.permissions.map((p) => p.key));

  return (
    <div className="admin-content">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
            color: 'var(--text-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.25)',
            border: '1px solid var(--border-color)'
          }}>
            <UserCog size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                margin: 0,
                fontFamily: 'var(--font-heading)'
              }}>
                User & Access Management
              </h1>
              <span className="badge badge-secondary">
                {hasActiveFilters ? `${filteredUsers.length} of ${users.length} Accounts` : `${users.length} Accounts`} • {roles.length} Roles
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
              Provision accounts, assign portal roles, and customize granular enterprise permissions
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadAll} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Export Users Option */}
          <div style={{ position: 'relative' }} ref={exportDropdownRef}>
            <button
              id="btn-export-users"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowExportMenu((prev) => !prev)}
              disabled={exporting || loading || users.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Export complete user accounts directory to Excel or CSV"
            >
              <Download size={14} color="var(--text-muted)" />
              <span>{exporting ? 'Exporting...' : 'Export Users'}</span>
              <ChevronDown size={13} color="var(--text-muted)" />
            </button>

            {showExportMenu && (
              <div
                id="export-users-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
                  zIndex: 50,
                  minWidth: '195px',
                  padding: '4px'
                }}
              >
                <button
                  type="button"
                  id="btn-export-users-excel"
                  onClick={() => handleExportUsers('xlsx')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(124, 58, 237, 0.08))')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileSpreadsheet size={15} color="#10B981" />
                  <span>Export to Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  id="btn-export-users-csv"
                  onClick={() => handleExportUsers('csv')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(124, 58, 237, 0.08))')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Download size={15} color="var(--accent, #7C3AED)" />
                  <span>Export to CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          {/* Bulk Upload Option */}
          {hasAnyPermission('create_user', 'manage_users') && (
            <button
              id="btn-bulk-user-upload"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsBulkUserModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Bulk upload users from spreadsheet with sample template"
            >
              <UploadCloud size={14} />
              <span>Bulk Upload</span>
            </button>
          )}

          {/* Create User Option */}
          {hasAnyPermission('create_user', 'manage_users') && (
            <button className="btn btn-primary btn-sm" onClick={openCreateUser}>
              <UserPlus size={14} />
              <span>Create New User</span>
            </button>
          )}
        </div>
      </div>

      {toastMsg.text && (
        <div style={{
          backgroundColor: toastMsg.type === 'error' ? 'rgba(248, 113, 113, 0.14)' : 'rgba(52, 211, 153, 0.12)',
          border: toastMsg.type === 'error' ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: toastMsg.type === 'error' ? '#F87171' : '#34D399',
          fontSize: '0.85rem',
          marginBottom: '16px'
        }}>
          {toastMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="table-container" style={{
        marginBottom: '16px',
        padding: '14px 18px',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Main Search Input */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              id="input-search-users"
              type="text"
              className="form-control"
              placeholder="Search by name, employee ID, manager, branch, department, role..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '38px', paddingRight: searchQuery ? '36px' : '12px', height: 38, fontSize: '0.86rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div style={{ minWidth: '160px', flex: '0 1 180px' }}>
            <select
              id="select-filter-role"
              className="form-control form-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Roles ({roles.length})</option>
              {distinctRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div style={{ minWidth: '160px', flex: '0 1 180px' }}>
            <select
              id="select-filter-branch"
              className="form-control form-select"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Branches</option>
              {distinctBranches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '140px', flex: '0 1 150px' }}>
            <select
              id="select-filter-status"
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="INACTIVE">Inactive Accounts</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              id="btn-clear-user-filters"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilters}
              style={{
                height: 38,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-secondary)'
              }}
              title="Reset all search queries and filters"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Filter Summary Bar if filters or search are active */}
        {hasActiveFilters && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              Showing <strong>{filteredUsers.length}</strong> matching of <strong>{users.length}</strong> accounts
              {searchQuery && (
                <span> for keyword "<strong>{searchQuery}</strong>"</span>
              )}
              {roleFilter !== 'ALL' && (
                <span> in role <strong>{roleFilter}</strong></span>
              )}
              {branchFilter !== 'ALL' && (
                <span> in <strong>{branchFilter}</strong></span>
              )}
              {statusFilter !== 'ALL' && (
                <span> ({statusFilter.toLowerCase()})</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.82rem'
              }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '980px' }}>
            <thead>
              <tr>
                <th style={{ width: '20%', padding: '12px 14px' }}>User Account</th>
                <th style={{ width: '9%', padding: '12px 14px', textAlign: 'center' }}>Emp ID</th>
                <th style={{ width: '10%', padding: '12px 14px' }}>Manager</th>
                <th style={{ width: '12%', padding: '12px 14px', textAlign: 'center' }}>Role</th>
                <th style={{ width: '13%', padding: '12px 14px' }}>Assigned Branch</th>
                <th style={{ width: '11%', padding: '12px 14px' }}>Department</th>
                <th style={{ width: '10%', padding: '12px 14px', textAlign: 'center' }}>Account Status</th>
                <th style={{ width: '9%', padding: '12px 14px', textAlign: 'center' }}>Member Since</th>
                <th style={{ width: '16%', padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <RefreshCw size={24} className="animate-spin" color="var(--primary-color)" />
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading user directory...</div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                    No system users configured. Click "Create New User" to add one.
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-subtle, #F1F5F9)',
                        color: 'var(--text-muted, #94A3B8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Search size={22} />
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.98rem' }}>
                        No matching accounts found
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '380px', lineHeight: 1.4 }}>
                        No user accounts matched your current search and filter criteria. Try adjusting your search term or clearing filters.
                      </div>
                      {hasActiveFilters && (
                        <button
                          id="btn-reset-empty-search"
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleClearFilters}
                          style={{ marginTop: '6px' }}
                        >
                          <RotateCcw size={13} />
                          <span>Reset Search & Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const initials = (u.full_name || u.username || 'U')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const isReviewer = u.role === 'BGV Reviewer';
                  const isSuper = u.role === 'Super Admin';
                  const avatarBg = isSuper ? '#EDE9FE' : isReviewer ? '#FEF3C7' : '#EFF6FF';
                  const avatarColor = isSuper ? '#6D28D9' : isReviewer ? '#B45309' : 'var(--primary-color)';

                  return (
                    <tr key={u.id}>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            backgroundColor: avatarBg,
                            color: avatarColor,
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                            {u.full_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            backgroundColor: 'var(--bg-subtle)',
                            border: '1px solid var(--border-color)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            letterSpacing: '0.02em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {u.username}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.875rem', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                        <span style={{ fontWeight: 500, color: u.manager ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                          {u.manager || '—'}
                        </span>
                      </td>

                      {/* ROLE COLUMN */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getRoleBadge(u.role)}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        {u.branch ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{u.branch}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        {u.department ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.department}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-secondary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span className={`badge-dot ${u.is_active ? 'dot-success' : ''}`} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {u.created_at?.substring(0, 10)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          {hasAnyPermission('edit_user', 'manage_users') && (
                            <button
                              id={`btn-edit-user-${u.id}`}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditUser(u)}
                              title={`Edit account details for ${u.full_name}`}
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--primary)',
                                borderColor: 'var(--border-color)'
                              }}
                            >
                              <Pencil size={12} />
                              <span>Edit</span>
                            </button>
                          )}

                          {hasAnyPermission('activate_user', 'deactivate_user', 'manage_users') && (
                            <button
                              className={`btn ${u.is_active ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                              onClick={() => handleToggleStatus(u)}
                              disabled={actionLoadingId === u.id}
                              style={{ minWidth: '92px', justifyContent: 'center', padding: '5px 10px', fontSize: '0.78rem' }}
                            >
                              {actionLoadingId === u.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : u.is_active ? (
                                'Deactivate'
                              ) : (
                                'Activate'
                              )}
                            </button>
                          )}

                          {hasAnyPermission('delete_user', 'manage_users') && u.role !== 'Super Admin' && u.id !== user?.id && (
                            <button
                              id={`btn-delete-user-${u.id}`}
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDeleteUser(u)}
                              disabled={actionLoadingId === u.id}
                              title={`Delete user account ${u.username}`}
                              style={{ color: '#EF4444', padding: '5px 8px', fontSize: '0.78rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary Footer */}
        {!loading && filteredUsers.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card, #ffffff)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div>
                Showing{' '}
                <strong>
                  {pageSize === 'ALL'
                    ? `1–${filteredUsers.length}`
                    : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredUsers.length)}`}
                </strong>{' '}
                of <strong>{filteredUsers.length}</strong> {filteredUsers.length === 1 ? 'account' : 'accounts'}
                {filteredUsers.length !== users.length && ` (filtered from ${users.length} total)`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Per page:</span>
                <select
                  id="select-user-page-size"
                  className="form-control form-select"
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  style={{ height: 28, padding: '2px 8px', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="ALL">All ({filteredUsers.length})</option>
                </select>
              </div>
            </div>

            {pageSize !== 'ALL' && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  id="btn-user-prev-page"
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ padding: '4px 8px', height: 30, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <div style={{ padding: '0 8px', fontSize: '0.82rem', fontWeight: 600 }}>
                  Page {safePage} of {totalPages}
                </div>

                <button
                  id="btn-user-next-page"
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ padding: '4px 8px', height: 30, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* CREATE SYSTEM USER MODAL                                 */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
                  color: 'var(--text-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  <UserPlus size={18} color="var(--accent-purple, #A855F7)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                    Create System User
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Add credentials and assign portal roles
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} autoComplete="off">
              {/* Hidden fake fields to absorb browser credential autofill */}
              <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
              <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" />

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {errorMsg && (
                  <div style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.12)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    color: '#FCA5A5',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle2 size={16} />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    name="new_user_fullname"
                    autoComplete="off"
                    className="form-control"
                    placeholder="e.g. Anand Sharma"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Employee ID *</label>
                    <input
                      id="input-create-user-empid"
                      name="new_user_employee_id"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      type="text"
                      className="form-control"
                      placeholder="e.g. COL00101"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Manager</label>
                    <input
                      id="input-create-user-manager"
                      name="new_user_manager"
                      autoComplete="off"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Reporting Manager"
                      value={formData.manager}
                      onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Portal Role *</label>
                    <select
                      id="select-create-user-role"
                      name="new_user_role"
                      className="form-control form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      <option value="">Select Portal Role</option>
                      {roles.length === 0 ? (
                        <>
                          <option value="Super Admin">Super Admin</option>
                          <option value="HR/Admin">HR/Admin</option>
                          <option value="BGV Reviewer">BGV Reviewer</option>
                          <option value="View Only">View Only</option>
                        </>
                      ) : (
                        roles
                          .filter((r) => r.is_active !== 0)
                          .map((r) => (
                            <option key={r.id} value={r.role_name}>
                              {r.role_name}
                            </option>
                          ))
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Password *</label>
                    <input
                      id="input-create-user-password"
                      name="new_user_password"
                      autoComplete="new-password"
                      type="password"
                      className="form-control"
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Branch</label>
                    <select
                      id="select-create-user-branch"
                      name="new_user_branch"
                      className="form-control form-select"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    >
                      <option value="">Select Branch</option>
                      {masters?.branches && !masters.branches.some(b => b.branch_name === formData.branch) && formData.branch && (
                        <option value={formData.branch}>{formData.branch}</option>
                      )}
                      {masters?.branches?.map((b) => (
                        <option key={b.id} value={b.branch_name}>
                          {b.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      id="select-create-user-department"
                      name="new_user_department"
                      className="form-control form-select"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    >
                      <option value="">Select Department</option>
                      {masters?.departments && !masters.departments.some(d => d.department_name === formData.department) && formData.department && (
                        <option value={formData.department}>{formData.department}</option>
                      )}
                      {masters?.departments?.map((d) => (
                        <option key={d.id} value={d.department_name}>
                          {d.department_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <UserPlus size={14} />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT USER ACCOUNT MODAL                                  */}
      {/* ======================================================== */}
      {editUserModalOpen && editUserForm && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !editUserLoading) setEditUserModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  <UserCog size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                    Edit User Account
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Modify credentials, role, and department assignment for Employee ID: <strong style={{ color: 'var(--primary)' }}>{editUserForm.username}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !editUserLoading && setEditUserModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                disabled={editUserLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {editUserError && (
                  <div style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    color: '#F87171',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{editUserError}</span>
                  </div>
                )}

                {editUserSuccess && (
                  <div style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{editUserSuccess}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Full Name *</label>
                    <input
                      id="input-edit-user-fullname"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Anand Sharma"
                      value={editUserForm.full_name}
                      onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Employee ID</span>
                      <Lock size={12} color="var(--text-muted)" title="Employee ID cannot be altered" />
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editUserForm.username}
                      disabled
                      style={{ opacity: 0.75, cursor: 'not-allowed', backgroundColor: 'var(--bg-canvas)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Manager</label>
                    <input
                      id="input-edit-user-manager"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Reporting Manager"
                      value={editUserForm.manager}
                      onChange={(e) => setEditUserForm({ ...editUserForm, manager: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Portal Role *</label>
                    <select
                      id="select-edit-user-role"
                      className="form-control form-select"
                      value={editUserForm.role}
                      onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    >
                      {roles.length === 0 ? (
                        <>
                          <option value="Super Admin">Super Admin</option>
                          <option value="HR/Admin">HR/Admin</option>
                          <option value="BGV Reviewer">BGV Reviewer</option>
                          <option value="View Only">View Only</option>
                        </>
                      ) : (
                        roles
                          .filter((r) => r.is_active !== 0)
                          .map((r) => (
                            <option key={r.id} value={r.role_name}>
                              {r.role_name}
                            </option>
                          ))
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Assigned Branch</label>
                    <select
                      className="form-control form-select"
                      value={editUserForm.branch}
                      onChange={(e) => setEditUserForm({ ...editUserForm, branch: e.target.value })}
                    >
                      <option value="">Select Branch</option>
                      {masters?.branches && !masters.branches.some(b => b.branch_name === editUserForm.branch) && editUserForm.branch && (
                        <option value={editUserForm.branch}>{editUserForm.branch}</option>
                      )}
                      {masters?.branches?.map((b) => (
                        <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Department</label>
                    <select
                      className="form-control form-select"
                      value={editUserForm.department}
                      onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                    >
                      <option value="">Select Department</option>
                      {masters?.departments && !masters.departments.some(d => d.department_name === editUserForm.department) && editUserForm.department && (
                        <option value={editUserForm.department}>{editUserForm.department}</option>
                      )}
                      {masters?.departments?.map((d) => (
                        <option key={d.id} value={d.department_name}>{d.department_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Account Status</label>
                    <select
                      className="form-control form-select"
                      value={editUserForm.is_active}
                      onChange={(e) => setEditUserForm({ ...editUserForm, is_active: parseInt(e.target.value, 10) })}
                    >
                      <option value={1}>Active (Can log in)</option>
                      <option value={0}>Inactive (Access blocked)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Reset Password (Optional)</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Leave blank to keep unchanged"
                      value={editUserForm.newPassword}
                      onChange={(e) => setEditUserForm({ ...editUserForm, newPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '14px 20px', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditUserModalOpen(false)}
                  disabled={editUserLoading}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-user"
                  type="submit"
                  className="btn btn-primary"
                  disabled={editUserLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {editUserLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk User Upload Modal */}
      <BulkUserUploadModal
        isOpen={isBulkUserModalOpen}
        onClose={() => setIsBulkUserModalOpen(false)}
        onUploadSuccess={loadAll}
        roles={roles}
        branches={masters?.branches || []}
        departments={masters?.departments || []}
      />
    </div>
  );
}
