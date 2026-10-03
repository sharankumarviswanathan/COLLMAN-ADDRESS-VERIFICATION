import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { UserPlus, UserCog, Check, X, Shield, Lock, Mail, Building, Briefcase, RefreshCw, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

export function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'BGV Reviewer',
    branch: 'Chennai Headquarters',
    department: 'Quality & Compliance'
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.users.list();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.users.create(formData);
      setSuccessMsg(`User ${formData.username} created successfully.`);
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg('');
        setFormData({
          username: '',
          email: '',
          password: '',
          full_name: '',
          role: 'BGV Reviewer',
          branch: 'Chennai Headquarters',
          department: 'Quality & Compliance'
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

  function getRoleBadge(role) {
    switch (role) {
      case 'Super Admin':
        return <span className="badge badge-primary"><span className="badge-dot dot-primary" />Super Admin</span>;
      case 'HR/Admin':
        return <span className="badge badge-info"><span className="badge-dot dot-info" />HR Admin</span>;
      case 'BGV Reviewer':
        return <span className="badge badge-warning"><span className="badge-dot dot-warning" />BGV Reviewer</span>;
      default:
        return <span className="badge badge-secondary">{role}</span>;
    }
  }

  return (
    <div className="admin-content">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.25)',
            border: '1px solid rgba(216, 180, 254, 0.3)'
          }}>
            <UserCog size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                margin: 0,
                fontFamily: 'var(--font-heading)'
              }}>
                User & Access Management
              </h1>
              <span className="badge badge-secondary">
                {users.length} {users.length === 1 ? 'Account' : 'Accounts'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px', margin: 0 }}>
              Provision and manage Super Admins, HR Admins, BGV Reviewers, and View Only access credentials
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={14} />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>User Account</th>
                <th>Email Address</th>
                <th>Role & Permissions</th>
                <th>Assigned Branch</th>
                <th>Department</th>
                <th>Account Status</th>
                <th>Member Since</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <RefreshCw size={24} className="animate-spin" color="var(--primary-color)" />
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading user directory...</div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                    No system users configured. Click "Create New User" to add one.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
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
                      <td>
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
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                              {u.full_name}
                            </div>
                            <div style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)'
                            }}>
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} color="var(--text-muted)" />
                          <span>{u.email}</span>
                        </div>
                      </td>
                      <td>{getRoleBadge(u.role)}</td>
                      <td>
                        {u.branch ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{u.branch}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        {u.department ? (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.department}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-secondary'}`}>
                          <span className={`badge-dot ${u.is_active ? 'dot-success' : ''}`} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {u.created_at?.substring(0, 10)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={`btn ${u.is_active ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                          onClick={() => handleToggleStatus(u)}
                          disabled={actionLoadingId === u.id}
                          style={{ minWidth: '92px', justifyContent: 'center' }}
                        >
                          {actionLoadingId === u.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : u.is_active ? (
                            'Deactivate'
                          ) : (
                            'Activate'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
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
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(216, 180, 254, 0.3)'
                }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-heading)' }}>
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

            <form onSubmit={handleCreateUser}>
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
                    className="form-control"
                    placeholder="e.g. Anand Sharma"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. asharma"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="asharma@collmanservices.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Portal Role *</label>
                    <select
                      className="form-control form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="HR/Admin">HR/Admin</option>
                      <option value="BGV Reviewer">BGV Reviewer</option>
                      <option value="View Only">View Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Password *</label>
                    <input
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
                    <input
                      type="text"
                      className="form-control"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
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
    </div>
  );
}

