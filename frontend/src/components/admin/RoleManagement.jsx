import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { soundManager } from '../../lib/soundManager';
import {
  Shield,
  ShieldPlus,
  ShieldCheck,
  KeyRound,
  Sliders,
  Search,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Users,
  Eye,
  PlusCircle,
  FileEdit,
  Download,
  Share2,
  FileSearch,
  CheckCircle,
  XCircle,
  Power,
  Upload,
  UserCheck,
  Settings,
  Lock,
  ScrollText,
  LayoutGrid,
  List,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';

export function RoleManagement() {
  const { user, hasPermission, hasAnyPermission, refreshUser } = useAuth();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState('ALL'); // 'ALL' | 'SYSTEM' | 'CUSTOM'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // --- Create Role Modal ---
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [createRoleForm, setCreateRoleForm] = useState({
    role_name: '',
    role_code: '',
    description: '',
    badge_color: 'primary',
    permissions: []
  });

  // --- Manage Permissions Modal ---
  const [managePermsModalOpen, setManagePermsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [activePerms, setActivePerms] = useState([]);
  const [roleEditForm, setRoleEditForm] = useState({
    role_name: '',
    description: '',
    badge_color: 'primary',
    is_active: 1
  });

  const [permSearch, setPermSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toastMsg, setToastMsg] = useState({ type: '', text: '' });

  // --- Delete Role Confirmation Modal ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [reassignTargetRole, setReassignTargetRole] = useState('');
  const [deleteActionChoice, setDeleteActionChoice] = useState('reassign'); // 'reassign' | 'deactivate'
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  function showToast(text, type = 'success') {
    if (type === 'error') {
      soundManager.alert();
    } else {
      soundManager.success();
    }
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg({ type: '', text: '' }), 4000);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadRoles(), loadUsers()]);
    } catch (err) {
      console.error('Failed to load role directory:', err);
    } finally {
      setLoading(false);
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

  async function loadUsers() {
    try {
      const data = await api.users.list();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  // --- Create Role Handlers ---
  function openCreateRole() {
    setCreateRoleForm({
      role_name: '',
      role_code: '',
      description: '',
      badge_color: 'primary',
      permissions: ['view_dashboard', 'view_queue', 'view_employees', 'view_reports', 'download_reports']
    });
    setPermSearch('');
    setActionFilter('ALL');
    setModalError('');
    setCreateRoleModalOpen(true);
  }

  function toggleCreateRolePerm(key) {
    setCreateRoleForm((prev) => {
      const current = prev.permissions || [];
      const updated = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, permissions: updated };
    });
  }

  function applyPresetToCreate(keys) {
    setCreateRoleForm((prev) => ({
      ...prev,
      permissions: keys
    }));
  }

  async function handleCreateRoleSubmit(e) {
    e.preventDefault();
    setModalError('');

    if (!createRoleForm.role_name.trim()) {
      setModalError('Role name is required.');
      return;
    }

    setModalLoading(true);
    try {
      const res = await api.roles.create(createRoleForm);
      showToast(res.message || `Role '${createRoleForm.role_name}' created successfully.`);
      setCreateRoleModalOpen(false);
      await loadRoles();
    } catch (err) {
      console.error('Create role error:', err);
      setModalError(err.message || 'Failed to create role.');
    } finally {
      setModalLoading(false);
    }
  }

  // --- Manage Permissions Handlers ---
  function openManagePermissions(roleIdentifier) {
    let roleObj = null;
    if (typeof roleIdentifier === 'string') {
      roleObj = roles.find((r) => r.role_name === roleIdentifier);
    } else if (roleIdentifier && typeof roleIdentifier === 'object') {
      roleObj = roleIdentifier;
    }

    if (!roleObj) {
      roleObj = {
        role_name: roleIdentifier,
        role_code: String(roleIdentifier).toUpperCase().replace(/\s+/g, '_'),
        description: '',
        badge_color: 'primary',
        is_system: 0,
        is_active: 1,
        permissions: []
      };
    }

    setSelectedRole(roleObj);
    setActivePerms(roleObj.permissions || []);
    setRoleEditForm({
      role_name: roleObj.role_name || '',
      description: roleObj.description || '',
      badge_color: roleObj.badge_color || 'primary',
      is_active: roleObj.is_active !== undefined ? roleObj.is_active : 1
    });
    setPermSearch('');
    setActionFilter('ALL');
    setModalError('');
    setManagePermsModalOpen(true);
  }

  function toggleManagePerm(key) {
    setActivePerms((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }

  function toggleCategoryPerms(categoryPerms) {
    const keys = categoryPerms.map((p) => p.key);
    const allSelected = keys.every((k) => activePerms.includes(k));

    if (allSelected) {
      setActivePerms((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setActivePerms((prev) => Array.from(new Set([...prev, ...keys])));
    }
  }

  function applyPresetToManage(keys) {
    setActivePerms(keys);
  }

  async function handleSavePermissionsSubmit(e) {
    e.preventDefault();
    if (!selectedRole) return;

    setModalLoading(true);
    setModalError('');

    try {
      const payload = {
        role_name: roleEditForm.role_name.trim(),
        description: roleEditForm.description.trim(),
        badge_color: roleEditForm.badge_color,
        is_active: roleEditForm.is_active,
        permissions: activePerms
      };

      const res = await api.roles.update(selectedRole.id, payload);
      showToast(res.message || `Permissions for '${selectedRole.role_name}' updated successfully.`);
      setManagePermsModalOpen(false);
      await Promise.all([loadRoles(), loadUsers()]);
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }
    } catch (err) {
      console.error('Update permissions error:', err);
      setModalError(err.message || 'Failed to update role permissions.');
    } finally {
      setModalLoading(false);
    }
  }

  function canDeleteRole(role) {
    if (!role) return false;
    if (role.role_name === 'Super Admin' || role.role_code === 'SUPER_ADMIN') return false;
    return user?.role === 'Super Admin' || hasAnyPermission('manage_roles', 'manage_permissions');
  }

  function openDeleteRoleModal(role) {
    if (!role || role.role_name === 'Super Admin' || role.role_code === 'SUPER_ADMIN') return;
    setRoleToDelete(role);
    setDeleteError('');
    setDeleteActionChoice('reassign');

    const availableTargets = roles.filter(
      (r) => r.id !== role.id && r.role_name !== role.role_name && r.is_active === 1
    );
    const defaultTarget =
      availableTargets.find((r) => r.role_name === 'View Only')?.role_name ||
      availableTargets[0]?.role_name ||
      '';
    setReassignTargetRole(defaultTarget);
    setDeleteModalOpen(true);
  }

  function handleDeleteRole(role) {
    openDeleteRoleModal(role);
  }

  async function handleConfirmDelete() {
    if (!roleToDelete) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const roleUsers = users.filter((u) => u.role === roleToDelete.role_name);
      const userCount = roleToDelete.user_count !== undefined ? roleToDelete.user_count : roleUsers.length;

      let payload = {};
      if (userCount > 0) {
        if (deleteActionChoice === 'deactivate') {
          payload = { action: 'deactivate' };
        } else {
          if (!reassignTargetRole) {
            setDeleteError('Please choose a replacement role to reassign active users to.');
            setDeleteLoading(false);
            return;
          }
          payload = { reassign_to: reassignTargetRole };
        }
      }

      const res = await api.roles.delete(roleToDelete.id, payload);
      showToast(res.message || `Role '${roleToDelete.role_name}' updated successfully.`);
      setDeleteModalOpen(false);
      setRoleToDelete(null);
      if (managePermsModalOpen && selectedRole?.id === roleToDelete.id) {
        setManagePermsModalOpen(false);
      }
      await Promise.all([loadRoles(), loadUsers()]);
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }
    } catch (err) {
      console.error('Delete role error:', err);
      setDeleteError(err.message || 'Failed to delete role.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function getRoleBadge(roleName, badgeColor) {
    const r = (roleName || '').toLowerCase();
    const color = (badgeColor || '').toLowerCase();

    // Map theme to CSS class
    let badgeClass = '';
    if (color === 'success' || color === 'green') {
      badgeClass = 'badge badge-success';
    } else if (color === 'warning' || color === 'amber') {
      badgeClass = 'badge badge-warning';
    } else if (color === 'info' || color === 'blue') {
      badgeClass = 'badge badge-primary';
    } else if (color === 'neutral' || color === 'slate') {
      badgeClass = 'badge badge-neutral';
    } else if (color === 'primary' || color === 'purple') {
      badgeClass = 'badge badge-purple';
    }

    // Default fallback if no theme color is set
    if (!badgeClass) {
      if (r.includes('super')) badgeClass = 'badge badge-purple';
      else if (r.includes('hr')) badgeClass = 'badge badge-primary';
      else if (r.includes('team') || r.includes('leader')) badgeClass = 'badge badge-success';
      else if (r.includes('reviewer')) badgeClass = 'badge badge-warning';
      else if (r.includes('view')) badgeClass = 'badge badge-neutral';
      else if (r.includes('manager')) badgeClass = 'badge badge-purple';
      else badgeClass = 'badge badge-info';
    }

    let displayName = roleName || '';
    if (r.includes('super')) displayName = 'Super Admin';
    else if (r.includes('hr')) displayName = 'HR/Admin';
    else if (r.includes('team') || r.includes('leader')) displayName = 'Team Leader';
    else if (r.includes('reviewer')) displayName = 'BGV Reviewer';
    else if (r.includes('view')) displayName = 'View Only';
    else if (r.includes('manager')) displayName = 'Manager';
    else {
      displayName = displayName
        .split(/[_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }

    return (
      <span
        className={badgeClass}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          fontSize: '0.78rem',
          fontWeight: 700
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
        {displayName}
      </span>
    );
  }

  function getActionBadge(action) {
    const act = (action || '').toLowerCase();
    let bg = 'rgba(168, 85, 247, 0.12)';
    let color = '#C084FC';
    let IconComp = KeyRound;

    switch (act) {
      case 'view':
        bg = 'rgba(59, 130, 246, 0.12)';
        color = '#60A5FA';
        IconComp = Eye;
        break;
      case 'create':
        bg = 'rgba(16, 185, 129, 0.12)';
        color = '#34D399';
        IconComp = PlusCircle;
        break;
      case 'edit':
        bg = 'rgba(245, 158, 11, 0.12)';
        color = '#FBBF24';
        IconComp = FileEdit;
        break;
      case 'delete':
        bg = 'rgba(239, 68, 68, 0.12)';
        color = '#F87171';
        IconComp = Trash2;
        break;
      case 'download':
        bg = 'rgba(14, 165, 233, 0.12)';
        color = '#38BDF8';
        IconComp = Download;
        break;
      case 'export':
        bg = 'rgba(20, 184, 166, 0.12)';
        color = '#2DD4BF';
        IconComp = Share2;
        break;
      case 'review':
        bg = 'rgba(217, 70, 239, 0.12)';
        color = '#E879F9';
        IconComp = FileSearch;
        break;
      case 'approve':
        bg = 'rgba(34, 197, 94, 0.14)';
        color = '#4ADE80';
        IconComp = CheckCircle;
        break;
      case 'reject':
        bg = 'rgba(244, 63, 94, 0.14)';
        color = '#FB7185';
        IconComp = XCircle;
        break;
      case 'activate':
        bg = 'rgba(16, 185, 129, 0.12)';
        color = '#34D399';
        IconComp = Power;
        break;
      case 'deactivate':
        bg = 'rgba(100, 116, 139, 0.15)';
        color = '#94A3B8';
        IconComp = Power;
        break;
      case 'upload':
        bg = 'rgba(99, 102, 241, 0.12)';
        color = '#818CF8';
        IconComp = Upload;
        break;
      case 'assign':
        bg = 'rgba(236, 72, 153, 0.12)';
        color = '#F472B6';
        IconComp = UserCheck;
        break;
      case 'manage settings':
        bg = 'rgba(249, 115, 22, 0.12)';
        color = '#FB923C';
        IconComp = Settings;
        break;
      case 'manage permissions':
        bg = 'rgba(168, 85, 247, 0.15)';
        color = '#C084FC';
        IconComp = Lock;
        break;
      case 'view audit logs':
        bg = 'rgba(148, 163, 184, 0.15)';
        color = '#CBD5E1';
        IconComp = ScrollText;
        break;
      default:
        bg = 'rgba(168, 85, 247, 0.12)';
        color = '#C084FC';
        IconComp = KeyRound;
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          backgroundColor: bg,
          color: color,
          border: `1px solid ${color}33`,
          whiteSpace: 'nowrap'
        }}
      >
        <IconComp size={10} />
        <span>{action}</span>
      </span>
    );
  }

  const allAvailableActions = [
    'ALL',
    'View',
    'Create',
    'Edit',
    'Delete',
    'Download',
    'Export',
    'Review',
    'Approve',
    'Reject',
    'Activate',
    'Deactivate',
    'Upload',
    'Assign',
    'Manage Settings',
    'Manage Permissions',
    'View Audit Logs'
  ];

  // Filter roles by search and type
  const filteredRoles = roles.filter((r) => {
    if (roleTypeFilter === 'SYSTEM' && r.is_system !== 1) return false;
    if (roleTypeFilter === 'CUSTOM' && r.is_system === 1) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.role_name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.role_code || '').toLowerCase().includes(q)
    );
  });

  // Calculate stats
  const totalRolesCount = roles.length;
  const systemRolesCount = roles.filter((r) => r.is_system === 1).length;
  const customRolesCount = roles.filter((r) => r.is_system !== 1).length;
  const totalUsersCount = users.length;
  const totalPermissionsCount = permissionsCatalog.reduce(
    (acc, cat) => acc + (cat.permissions ? cat.permissions.length : 0),
    0
  );

  return (
    <div className="admin-content">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md, 10px)',
              background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
              color: 'var(--text-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              boxShadow: '0 0 16px rgba(168, 85, 247, 0.25)'
            }}
          >
            <ShieldCheck size={22} color="var(--accent-purple, #A855F7)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                  fontFamily: 'var(--font-heading)'
                }}
              >
                Configured Role Profiles & Permissions
              </h1>
              <span className="badge badge-secondary">
                {roles.length} Roles • {totalPermissionsCount} Permissions
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
              Configure portal roles, user access levels, and granular action-based permissions across system modules
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAll}
            disabled={loading}
            title="Refresh Roles"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {hasAnyPermission('manage_roles', 'manage_permissions') && (
            <button
              id="btn-add-new-role"
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openCreateRole}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ShieldPlus size={15} />
              <span>+ Add New Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg.text && (
        <div
          style={{
            backgroundColor: toastMsg.type === 'error' ? 'var(--danger-light)' : 'var(--success-light)',
            border: toastMsg.type === 'error' ? '1px solid var(--danger-border)' : '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: toastMsg.type === 'error' ? 'var(--danger-text-strong)' : 'var(--success-text-strong)',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}
        >
          {toastMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* KPI Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(168, 85, 247, 0.12)',
                color: '#A855F7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Shield size={16} />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Configured Roles
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
            {totalRolesCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            System access profiles
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShieldCheck size={16} />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              System Core Roles
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
            {systemRolesCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Built-in protected profiles
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Users size={16} />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assigned Users
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
            {totalUsersCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Active portal credentials
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md, 8px)',
                background: 'var(--warning-light)',
                color: 'var(--warning-text-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <KeyRound size={16} />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Granular Rules
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.15 }}>
            {totalPermissionsCount || 29}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Action-level permission rules
          </div>
        </div>
      </div>

      {/* Filter, Search & View Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search roles by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Type Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className={`btn btn-xs ${roleTypeFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setRoleTypeFilter('ALL')}
              style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '4px' }}
            >
              All Roles ({roles.length})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${roleTypeFilter === 'SYSTEM' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setRoleTypeFilter('SYSTEM')}
              style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '4px' }}
            >
              System Core ({systemRolesCount})
            </button>
            {customRolesCount > 0 && (
              <button
                type="button"
                className={`btn btn-xs ${roleTypeFilter === 'CUSTOM' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRoleTypeFilter('CUSTOM')}
                style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '4px' }}
              >
                Custom ({customRolesCount})
              </button>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '6px' }}>
            Showing <strong>{filteredRoles.length}</strong> of <strong>{roles.length}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`btn btn-xs ${viewMode === 'table' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{ padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem' }}
              title="Table View"
            >
              <List size={14} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`btn btn-xs ${viewMode === 'grid' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{ padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem' }}
              title="Grid View"
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: TABLE VIEW (Standard Enterprise Display) */}
      {viewMode === 'table' && (
        <div className="table-container" style={{ marginBottom: '24px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))' }}>
                  <th style={{ width: '24%', padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Role Profile
                  </th>
                  <th style={{ width: '46%', padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Permissions Configured
                  </th>
                  <th style={{ width: '12%', padding: '10px 14px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Status
                  </th>
                  <th style={{ width: '18%', padding: '10px 14px', textAlign: 'right', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '36px 20px' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <RefreshCw size={22} className="animate-spin" color="var(--primary-color)" />
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Loading role directory...</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No role profiles match your query "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((r) => {
                    const permCount = r.permissions?.length || 0;
                    const isSystem = r.is_system === 1;
                    const isSuper = r.role_name === 'Super Admin' || r.role_code === 'SUPER_ADMIN';

                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {/* 1. ROLE PROFILE */}
                        <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            {getRoleBadge(r.role_name, r.badge_color)}
                            {isSystem ? (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(148, 163, 184, 0.15)',
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  fontWeight: 700
                                }}
                              >
                                System
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  color: 'var(--text-accent)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  fontWeight: 700
                                }}
                              >
                                Custom
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. PERMISSIONS */}
                        <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                          {isSuper ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldCheck size={14} color="var(--accent-purple, #A855F7)" />
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                Full Unrestricted Root Access
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                (All System Modules)
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <Lock size={12} color="var(--accent-purple, #A855F7)" />
                                <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{permCount}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>configured</span>
                              </div>

                              {r.permissions && r.permissions.length > 0 && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  {r.permissions.slice(0, 3).map((p) => (
                                    <span
                                      key={p}
                                      style={{
                                        fontSize: '0.67rem',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-card-subtle, rgba(255,255,255,0.04))',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-muted)',
                                        textTransform: 'capitalize'
                                      }}
                                    >
                                      {p.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                  {r.permissions.length > 3 && (
                                    <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', opacity: 0.85 }}>
                                      +{r.permissions.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3. STATUS */}
                        <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                          <span className={`badge ${r.is_active ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
                            <span className={`badge-dot ${r.is_active ? 'dot-success' : ''}`} />
                            {r.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* 4. ACTIONS */}
                        <td style={{ textAlign: 'right', padding: '9px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {hasAnyPermission('manage_roles', 'manage_permissions') && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openManagePermissions(r)}
                                style={{
                                  fontSize: '0.76rem',
                                  padding: '4px 10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
                                }}
                                title={`Manage permissions for ${r.role_name}`}
                              >
                                <Sliders size={12} color="var(--accent-purple, #A855F7)" />
                                <span>Manage Permissions</span>
                              </button>
                            )}

                            {canDeleteRole(r) ? (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openDeleteRoleModal(r)}
                                style={{
                                  fontSize: '0.76rem',
                                  padding: '4px 10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#EF4444',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)';
                                  e.currentTarget.style.borderColor = '#EF4444';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                                }}
                                title={`Delete role ${r.role_name}`}
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            ) : r.role_name === 'Super Admin' ? (
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: 'var(--text-muted, #94A3B8)',
                                  backgroundColor: 'transparent',
                                  border: '1px solid rgba(148, 163, 184, 0.18)',
                                  borderRadius: '6px',
                                  opacity: 0.5,
                                  cursor: 'not-allowed',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Root Super Admin role cannot be deleted"
                              >
                                <Lock size={11} />
                                <span>Locked</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alternative View: GRID CARDS VIEW */}
      {viewMode === 'grid' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}
        >
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <RefreshCw size={28} className="animate-spin" color="var(--primary-color)" />
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading role profiles...</div>
              </div>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              No role profiles match your query "{searchQuery}".
            </div>
          ) : (
            filteredRoles.map((r) => {
              const roleUsers = users.filter((u) => u.role === r.role_name);
              const userCount = r.user_count !== undefined ? r.user_count : roleUsers.length;
              const permCount = r.permissions?.length || 0;
              const isSystem = r.is_system === 1;

              return (
                <div
                  key={r.id}
                  className="role-registry-card"
                  style={{
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)'
                  }}
                >
                  <div>
                    {/* Top Bar of Card */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getRoleBadge(r.role_name, r.badge_color)}
                        {isSystem && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(148, 163, 184, 0.15)',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              fontWeight: 700
                            }}
                          >
                            System Core
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: r.is_active === 1 ? '#34D399' : '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: r.is_active === 1 ? '#10B981' : '#64748B'
                          }}
                        />
                        {r.is_active === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Description */}
                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        margin: '6px 0 12px',
                        lineHeight: 1.45,
                        minHeight: '2.8em'
                      }}
                    >
                      {r.description || 'Configured system access role profile.'}
                    </p>

                    {/* Stats Meta */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Lock size={13} color="var(--accent-purple, #A855F7)" />
                        <span>
                          <strong style={{ color: 'var(--text-main)' }}>{permCount}</strong> permissions
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Users size={13} color="#3B82F6" />
                        <span>
                          <strong style={{ color: 'var(--text-main)' }}>{userCount}</strong> user(s)
                        </span>
                      </div>
                    </div>

                    {/* Assigned Users Preview if any */}
                    {roleUsers.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Assigned:</span>
                        {roleUsers.slice(0, 3).map((u) => (
                          <span
                            key={u.id}
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'var(--bg-card-subtle)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            {u.full_name?.split(' ')[0] || u.username}
                          </span>
                        ))}
                        {roleUsers.length > 3 && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>+{roleUsers.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-color)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div />

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {hasAnyPermission('manage_roles', 'manage_permissions') && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openManagePermissions(r)}
                          style={{
                            fontSize: '0.78rem',
                            padding: '5px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600
                          }}
                          title={`Manage permissions for ${r.role_name}`}
                        >
                          <Sliders size={13} color="var(--accent-purple, #A855F7)" />
                          <span>Permissions</span>
                        </button>
                      )}

                      {canDeleteRole(r) && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => openDeleteRoleModal(r)}
                          style={{
                            fontSize: '0.78rem',
                            padding: '5px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#EF4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title={`Delete role ${r.role_name}`}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE NEW ROLE MODAL                                    */}
      {/* ======================================================== */}
      {createRoleModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setCreateRoleModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
                    color: 'var(--text-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <ShieldPlus size={20} color="var(--accent-purple, #A855F7)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                    Add New System Role
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Define an access profile with modular permissions
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCreateRoleModalOpen(false)}
                disabled={modalLoading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoleSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {modalError && (
                  <div
                    style={{
                      background: 'var(--danger-light)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      color: 'var(--danger-text)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '16px'
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Role Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Compliance Auditor"
                      value={createRoleForm.role_name}
                      onChange={(e) => setCreateRoleForm({ ...createRoleForm, role_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Role Code (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. COMPLIANCE_AUDITOR"
                      value={createRoleForm.role_code}
                      onChange={(e) => setCreateRoleForm({ ...createRoleForm, role_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Describe role responsibilities and boundaries..."
                    value={createRoleForm.description}
                    onChange={(e) => setCreateRoleForm({ ...createRoleForm, description: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Badge Theme</label>
                  <select
                    className="form-control"
                    value={createRoleForm.badge_color}
                    onChange={(e) => setCreateRoleForm({ ...createRoleForm, badge_color: e.target.value })}
                  >
                    <option value="primary">Purple Accent (Default)</option>
                    <option value="success">Green (Verification / Approver)</option>
                    <option value="warning">Amber (Reviewer / Operations)</option>
                    <option value="info">Blue (Standard Staff)</option>
                    <option value="neutral">Slate (View Only / Guest)</option>
                  </select>
                </div>

                {/* Permissions Picker with Modular Grouping */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Assign Permissions ({createRoleForm.permissions.length} selected)
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        onClick={() => {
                          const allKeys = permissionsCatalog.flatMap((c) => c.permissions.map((p) => p.key));
                          applyPresetToCreate(allKeys);
                        }}
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        onClick={() => applyPresetToCreate([])}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {permissionsCatalog.map((cat) => (
                      <div
                        key={cat.category}
                        style={{
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 14px'
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-accent)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {cat.category}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                          {cat.permissions.map((p) => {
                            const isChecked = createRoleForm.permissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: isChecked ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-card)',
                                  border: `1px solid ${isChecked ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                                  cursor: 'pointer'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCreateRolePerm(p.key)}
                                  style={{ marginTop: '2px' }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {p.name}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateRoleModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {modalLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>{modalLoading ? 'Creating...' : 'Create Role'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MANAGE PERMISSIONS MODAL (GRANULAR, GROUPED BY MODULE)   */}
      {/* ======================================================== */}
      {managePermsModalOpen && selectedRole && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setManagePermsModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
                    color: 'var(--text-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <KeyRound size={20} color="var(--accent-purple, #A855F7)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                      Manage Permissions: {selectedRole.role_name}
                    </h3>
                    {selectedRole.is_system === 1 && (
                      <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                        System Core Role
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {selectedRole.user_count || 0} user(s) currently assigned to this role profile
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setManagePermsModalOpen(false)}
                disabled={modalLoading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePermissionsSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {modalError && (
                  <div
                    style={{
                      background: 'var(--danger-light)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      color: 'var(--danger-text)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '16px'
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Role Details Header Card */}
                <div
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'flex-start' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                        Role Name
                      </label>
                      {selectedRole.is_system === 1 ? (
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
                          {selectedRole.role_name}
                        </div>
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          value={roleEditForm.role_name}
                          onChange={(e) => setRoleEditForm({ ...roleEditForm, role_name: e.target.value })}
                          required
                          style={{ fontSize: '0.88rem', minHeight: '42px', height: '42px', padding: '8px 14px', boxSizing: 'border-box' }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                        Badge Theme
                      </label>
                      <select
                        className="form-control"
                        value={roleEditForm.badge_color}
                        onChange={(e) => setRoleEditForm({ ...roleEditForm, badge_color: e.target.value })}
                        style={{
                          fontSize: '0.88rem',
                          minHeight: '42px',
                          height: '42px',
                          padding: '8px 36px 8px 14px',
                          lineHeight: '1.4',
                          boxSizing: 'border-box',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="primary">Purple Accent (Default)</option>
                        <option value="success">Green (Approver / TL)</option>
                        <option value="warning">Amber (Reviewer / Operations)</option>
                        <option value="info">Blue (Standard Staff)</option>
                        <option value="neutral">Slate (View Only / Guest)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Role Description
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={roleEditForm.description}
                      onChange={(e) => setRoleEditForm({ ...roleEditForm, description: e.target.value })}
                      style={{ fontSize: '0.82rem', resize: 'none' }}
                      placeholder="Add description..."
                    />
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <Search
                      size={15}
                      style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search permissions by keyword (e.g. decision, delete, review)..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      style={{ paddingLeft: '34px', fontSize: '0.85rem', height: '36px' }}
                    />
                  </div>

                  {/* Action Filters Pills Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflowX: 'auto',
                      paddingBottom: '4px',
                      scrollbarWidth: 'thin'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px', whiteSpace: 'nowrap' }}>
                      Filter Action:
                    </span>
                    {allAvailableActions.map((act) => {
                      const isActive = actionFilter.toLowerCase() === act.toLowerCase();
                      return (
                        <button
                          key={act}
                          type="button"
                          onClick={() => setActionFilter(act)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            border: `1px solid ${isActive ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                            background: isActive ? 'var(--accent-purple)' : 'var(--bg-card)',
                            color: isActive ? '#FFFFFF' : 'var(--text-main)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {act}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Presets Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} color="var(--accent-purple, #A855F7)" />
                    <span>Selected: <strong style={{ color: 'var(--text-main)' }}>{activePerms.length}</strong> permissions</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 9px' }}
                      onClick={() => {
                        const allKeys = permissionsCatalog.flatMap((c) => c.permissions.map((p) => p.key));
                        applyPresetToManage(allKeys);
                      }}
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 9px' }}
                      onClick={() => {
                        applyPresetToManage([
                          'view_dashboard',
                          'view_queue',
                          'review_cases',
                          'approve_cases',
                          'reject_cases',
                          'download_case_report'
                        ]);
                      }}
                    >
                      Reviewer Preset
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 9px' }}
                      onClick={() => {
                        applyPresetToManage([
                          'view_dashboard',
                          'view_employees',
                          'view_queue',
                          'review_cases',
                          'approve_cases',
                          'reject_cases',
                          'download_case_report'
                        ]);
                      }}
                    >
                      Team Leader Preset
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 9px' }}
                      onClick={() => {
                        applyPresetToManage([
                          'view_dashboard',
                          'view_employees',
                          'view_queue',
                          'view_reports',
                          'download_reports',
                          'view_masters',
                          'view_audit_logs'
                        ]);
                      }}
                    >
                      Read Only
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 9px', color: 'var(--danger)' }}
                      onClick={() => applyPresetToManage([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Granular Checkboxes Grouped by Module */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {permissionsCatalog.map((cat) => {
                    const filteredItems = cat.permissions.filter((p) => {
                      const matchesAction =
                        actionFilter === 'ALL' ||
                        (p.action || '').toLowerCase() === actionFilter.toLowerCase();

                      if (!matchesAction) return false;
                      if (!permSearch.trim()) return true;

                      const q = permSearch.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.description.toLowerCase().includes(q) ||
                        p.key.toLowerCase().includes(q) ||
                        (p.action || '').toLowerCase().includes(q)
                      );
                    });

                    if (filteredItems.length === 0) return null;

                    const allSelected = filteredItems.every((p) => activePerms.includes(p.key));

                    return (
                      <div
                        key={cat.category}
                        style={{
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '14px 16px',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        {/* Module Category Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              {cat.category}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              ({filteredItems.filter((p) => activePerms.includes(p.key)).length}/{filteredItems.length})
                            </span>
                          </div>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleCategoryPerms(filteredItems)}
                            style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--text-muted)' }}
                          >
                            {allSelected ? 'Deselect Category' : 'Select All'}
                          </button>
                        </div>

                        {/* Individual Checkbox Cards */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                            gap: '10px'
                          }}
                        >
                          {filteredItems.map((p) => {
                            const isChecked = activePerms.includes(p.key);

                            return (
                              <label
                                key={p.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '10px',
                                  padding: '10px 12px',
                                  borderRadius: 'var(--radius-md)',
                                  background: isChecked ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-card)',
                                  border: `1px solid ${isChecked ? 'var(--accent-purple, #A855F7)' : 'var(--border-color)'}`,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleManagePerm(p.key)}
                                  style={{
                                    marginTop: '3px',
                                    accentColor: 'var(--accent-purple, #A855F7)',
                                    cursor: 'pointer'
                                  }}
                                />

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.25 }}>
                                      {p.name}
                                    </span>
                                    {getActionBadge(p.action)}
                                  </div>

                                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 4px', lineHeight: 1.35 }}>
                                    {p.description}
                                  </p>

                                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.8 }}>
                                    {p.key}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {canDeleteRole(selectedRole) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => openDeleteRoleModal(selectedRole)}
                      style={{
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      disabled={modalLoading}
                      title={`Delete role ${selectedRole.role_name}`}
                    >
                      <Trash2 size={13} />
                      <span>Delete Role</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setManagePermsModalOpen(false)}
                    disabled={modalLoading}
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-save-permissions-modal"
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {modalLoading && <RefreshCw size={14} className="animate-spin" />}
                    <span>{modalLoading ? 'Saving...' : 'Save Permissions'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE ROLE CONFIRMATION MODAL                           */}
      {/* ======================================================== */}
      {deleteModalOpen && roleToDelete && (() => {
        const roleUsers = users.filter((u) => u.role === roleToDelete.role_name);
        const userCount = roleToDelete.user_count !== undefined ? roleToDelete.user_count : roleUsers.length;
        const availableTargets = roles.filter(
          (r) => r.id !== roleToDelete.id && r.role_name !== roleToDelete.role_name && r.is_active === 1
        );

        return (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1200,
              padding: '16px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleteLoading) {
                setDeleteModalOpen(false);
              }
            }}
          >
            <div
              className="modal-card"
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--bg-card, #1E293B)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color, #334155)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(239, 68, 68, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main, #F8FAFC)' }}>
                      Delete Role Profile
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)' }}>
                      Permanent role configuration removal
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !deleteLoading && setDeleteModalOpen(false)}
                  disabled={deleteLoading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, #94A3B8)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px' }}>
                {deleteError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--danger-light)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: '8px',
                      color: 'var(--danger-text-strong)',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '16px'
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{deleteError}</span>
                  </div>
                )}

                {/* Role Details Summary */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border-color, #334155)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main, #F8FAFC)' }}>
                      {roleToDelete.role_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', fontFamily: 'monospace' }}>
                      {roleToDelete.role_code}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: userCount > 0 ? '#F59E0B' : '#10B981' }}>
                      {userCount} user(s) assigned
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)' }}>
                      {roleToDelete.permissions?.length || 0} permissions
                    </div>
                  </div>
                </div>

                {/* Scenario 1: Zero users assigned */}
                {userCount === 0 && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-main, #F8FAFC)', lineHeight: 1.5, margin: 0 }}>
                    Are you sure you want to permanently delete the role profile{' '}
                    <strong>"{roleToDelete.role_name}"</strong>? All configured permissions for this role will be removed. This action cannot be undone.
                  </p>
                )}

                {/* Scenario 2: Active users assigned */}
                {userCount > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--warning-light)',
                        border: '1px solid var(--warning-border)',
                        color: 'var(--warning-text-strong)',
                        fontSize: '0.82rem',
                        marginBottom: '16px',
                        lineHeight: 1.45
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={15} />
                        <span>Active Users Assigned</span>
                      </div>
                      <div>
                        There are currently <strong>{userCount} active user(s)</strong> assigned to this role:{' '}
                        <span style={{ color: 'var(--text-main, #F8FAFC)' }}>
                          {roleUsers.map((u) => u.full_name || u.username).slice(0, 4).join(', ')}
                          {roleUsers.length > 4 ? ` and ${roleUsers.length - 4} others` : ''}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main, #F8FAFC)', display: 'block', marginBottom: '8px' }}>
                        How would you like to handle assigned users?
                      </label>

                      {/* Option A: Reassign */}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: deleteActionChoice === 'reassign' ? '1px solid var(--accent-purple, #A855F7)' : '1px solid var(--border-color, #334155)',
                          background: deleteActionChoice === 'reassign' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                          cursor: 'pointer',
                          marginBottom: '8px'
                        }}
                      >
                        <input
                          type="radio"
                          name="deleteUserHandling"
                          value="reassign"
                          checked={deleteActionChoice === 'reassign'}
                          onChange={() => setDeleteActionChoice('reassign')}
                          style={{ marginTop: '3px', accentColor: 'var(--accent-purple, #A855F7)' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main, #F8FAFC)' }}>
                            Reassign users to another role (Recommended)
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                            Migrates all {userCount} assigned users to a replacement role profile and permanently deletes "{roleToDelete.role_name}".
                          </div>

                          {deleteActionChoice === 'reassign' && (
                            <div style={{ marginTop: '10px' }}>
                              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', display: 'block', marginBottom: '4px' }}>
                                Target Replacement Role:
                              </label>
                              <select
                                className="form-input"
                                value={reassignTargetRole}
                                onChange={(e) => setReassignTargetRole(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  fontSize: '0.82rem',
                                  borderRadius: '6px',
                                  background: 'var(--bg-input, #0F172A)',
                                  color: 'var(--text-main, #F8FAFC)',
                                  border: '1px solid var(--border-color, #334155)'
                                }}
                              >
                                {availableTargets.map((t) => (
                                  <option key={t.id} value={t.role_name}>
                                    {t.role_name} ({t.role_code})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </label>

                      {/* Option B: Deactivate */}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: deleteActionChoice === 'deactivate' ? '1px solid var(--accent-purple, #A855F7)' : '1px solid var(--border-color, #334155)',
                          background: deleteActionChoice === 'deactivate' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name="deleteUserHandling"
                          value="deactivate"
                          checked={deleteActionChoice === 'deactivate'}
                          onChange={() => setDeleteActionChoice('deactivate')}
                          style={{ marginTop: '3px', accentColor: 'var(--accent-purple, #A855F7)' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main, #F8FAFC)' }}>
                            Deactivate role instead
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                            Keep existing users on this role, but mark it inactive so it cannot be selected for new users.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border-color, #334155)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteLoading}
                  style={{ padding: '7px 14px' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                  style={{
                    padding: '7px 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    background: deleteActionChoice === 'deactivate' && userCount > 0 ? '#F59E0B' : '#EF4444',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: deleteLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deleteLoading ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  <span>
                    {deleteLoading
                      ? 'Processing...'
                      : userCount > 0 && deleteActionChoice === 'deactivate'
                      ? 'Deactivate Role'
                      : userCount > 0
                      ? 'Reassign & Delete'
                      : 'Delete Role'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
export default RoleManagement;
