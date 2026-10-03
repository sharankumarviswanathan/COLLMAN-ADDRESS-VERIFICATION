import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  RotateCcw,
  Search,
  ShieldCheck,
  RefreshCw,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

export function ReverificationView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['Super Admin', 'HR/Admin'].includes(user?.role);

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete State (Admin Only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteEmployeeAlso, setDeleteEmployeeAlso] = useState(false);

  useEffect(() => {
    loadReverificationCases();
  }, []);

  async function loadReverificationCases() {
    setLoading(true);
    try {
      const data = await api.queue.list({
        status: 'Reverification Required',
        search: search.trim()
      });
      setCases(data.items || []);
    } catch (err) {
      console.error('Reverification load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDeleteCase() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.queue.delete(
        deleteTarget.case_reference || deleteTarget.employee_id,
        deleteEmployeeAlso
      );
      setDeleteTarget(null);
      loadReverificationCases();
    } catch (err) {
      console.error('Delete reverification case error:', err);
      setDeleteError(err.message || 'Failed to delete case.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="admin-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Reverification Cases
            </h1>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              backgroundColor: 'var(--warning-light)',
              color: 'var(--warning-text-strong)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--warning-border)',
              display: 'inline-flex',
              alignItems: 'center',
              letterSpacing: '0.01em'
            }}>
              Attempt 2
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
            Cases reopened for secondary employee verification attempt through the common link
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadReverificationCases}
          disabled={loading}
          style={{ boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        backgroundColor: 'var(--warning-light)',
        border: '1px solid var(--warning-border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.86rem',
        boxShadow: 'var(--shadow-xs)'
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <RotateCcw size={17} style={{ color: 'var(--warning-text-strong)' }} />
        </div>
        <div style={{ lineHeight: 1.55 }}>
          <strong style={{
            color: 'var(--warning-text-strong)',
            fontWeight: 700,
            marginRight: '6px',
            fontSize: '0.88rem'
          }}>
            Reverification Protocol:
          </strong>
          <span style={{ color: 'var(--text-main)', opacity: 0.92, fontWeight: 500 }}>
            Reopened cases allow employees to submit corrected photos and updated documents using the same common verification link. Previous submission audit trails and rejection reasons are preserved.
          </span>
        </div>
      </div>

      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Reference / Emp ID</th>
                <th>Candidate Profile</th>
                <th>Branch & Department</th>
                <th>Current Attempt</th>
                <th>Status</th>
                <th>Assigned Reviewer</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={22} className="animate-spin" color="var(--warning)" />
                      <span>Loading reverification cases...</span>
                    </div>
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <RotateCcw size={32} color="var(--text-light)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <p style={{ fontWeight: 600 }}>No cases currently marked for reverification.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Cases flagged with rejection remarks will appear here for Attempt 2.</p>
                  </td>
                </tr>
              ) : (
                cases.map((item) => (
                  <tr key={item.employee_id}>
                    <td>
                      <div>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          color: 'var(--primary)',
                          backgroundColor: 'var(--bg-subtle)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          display: 'inline-block'
                        }}>
                          {item.case_reference || 'Ref Pending'}
                        </span>
                        <div style={{ fontSize: '0.76rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                          {item.employee_id}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-sm)',
                          background: 'linear-gradient(135deg, var(--warning-light) 0%, rgba(245, 158, 11, 0.15) 100%)',
                          border: '1px solid var(--warning-border)',
                          color: 'var(--warning-text-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          flexShrink: 0
                        }}>
                          {item.employee_name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>{item.employee_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DOJ: {item.date_of_joining || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{item.branch || '—'}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.department || '—'}</div>
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <RotateCcw size={10} />
                        Attempt #{item.current_attempt_number || 2}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>{item.verification_status}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {item.assigned_reviewer_name || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/admin/review/${item.employee_id}`)}
                          style={{ padding: '5px 11px', fontSize: '0.78rem' }}
                        >
                          <ShieldCheck size={13} />
                          <span>Inspect Case</span>
                        </button>

                        {isAdmin && (
                          <button
                            id={`btn-delete-reverify-case-${item.employee_id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setDeleteTarget(item);
                              setDeleteError('');
                              setDeleteEmployeeAlso(false);
                            }}
                            title="Delete Reverification Case"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', padding: '5px 9px', fontSize: '0.78rem' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Reverification Case Confirmation Modal (Admin Only) */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--danger-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={22} />
                <h3 style={{ fontSize: '1.15rem', color: 'var(--danger)', margin: 0 }}>
                  Delete Reverification Case
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setDeleteTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {deleteError && (
                <div style={{
                  backgroundColor: 'var(--danger-light)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '14px'
                }}>
                  {deleteError}
                </div>
              )}

              <p style={{ fontSize: '0.92rem', lineHeight: 1.5, color: 'var(--text-main)', marginBottom: '12px' }}>
                Are you sure you want to delete this reverification case for:
                <br />
                <strong>{deleteTarget.employee_name}</strong> (Emp ID: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{deleteTarget.employee_id}</span>, Ref: <strong>{deleteTarget.case_reference || 'N/A'}</strong>)?
              </p>

              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                marginBottom: '14px'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={deleteEmployeeAlso}
                    onChange={(e) => setDeleteEmployeeAlso(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong>Also permanently delete employee record from Employee Master</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      If unchecked, the case will be deleted and the employee's status will reset to "Not Started".
                    </div>
                  </div>
                </label>
              </div>

              <div style={{
                backgroundColor: 'var(--danger-light)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: '0.8rem',
                color: 'var(--danger)',
                lineHeight: 1.4
              }}>
                <strong>Warning:</strong> This will delete all attempt records and evidence for this reverification case.
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-reverify-case"
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteCase}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Deleting...' : (deleteEmployeeAlso ? 'Delete Case & Employee' : 'Delete Case Only')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
