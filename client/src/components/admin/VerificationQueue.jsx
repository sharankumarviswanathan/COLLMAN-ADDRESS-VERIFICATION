import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  CheckSquare,
  Search,
  Filter,
  UserCheck,
  ShieldCheck,
  Clock,
  MapPin,
  Camera,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

export function VerificationQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = ['Super Admin', 'HR/Admin'].includes(user?.role);

  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [masters, setMasters] = useState({ branches: [], departments: [], reviewers: [] });

  // Delete State (Admin Only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteEmployeeAlso, setDeleteEmployeeAlso] = useState(false);

  // Filters
  const [currentTab, setCurrentTab] = useState(searchParams.get('status') || 'ALL');
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedReviewer, setSelectedReviewer] = useState('ALL');
  const [selectedTatStatus, setSelectedTatStatus] = useState(searchParams.get('tatStatus') || 'ALL');

  // Multi selection for bulk assignment
  const [selectedCaseRefs, setSelectedCaseRefs] = useState([]);
  const [assignReviewerId, setAssignReviewerId] = useState('');

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadQueue();
  }, [pagination.page, currentTab, selectedBranch, selectedReviewer, selectedTatStatus]);

  async function loadMasters() {
    try {
      const data = await api.masters.getAll();
      setMasters(data);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  }

  async function loadQueue() {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (currentTab !== 'ALL') params.status = currentTab;
      if (search.trim()) params.search = search.trim();
      if (selectedBranch !== 'ALL') params.branch = selectedBranch;
      if (selectedReviewer !== 'ALL') params.reviewerId = selectedReviewer;
      if (selectedTatStatus !== 'ALL') params.tatStatus = selectedTatStatus;

      const data = await api.queue.list(params);
      setCases(data.items || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Queue load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadQueue();
  }

  async function handleAssignSelected() {
    if (!assignReviewerId || selectedCaseRefs.length === 0) return;

    try {
      await api.queue.assign(selectedCaseRefs, [], assignReviewerId);
      alert(`Assigned ${selectedCaseRefs.length} case(s) successfully.`);
      setSelectedCaseRefs([]);
      loadQueue();
    } catch (err) {
      console.error('Assign error:', err);
      alert('Failed to assign cases.');
    }
  }

  const toggleSelectCase = (ref) => {
    setSelectedCaseRefs((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]
    );
  };

  async function handleConfirmDeleteCase() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.queue.delete(deleteTarget.case_reference || deleteTarget.employee_id, deleteEmployeeAlso);
      setDeleteTarget(null);
      loadQueue();
    } catch (err) {
      console.error('Delete case error:', err);
      setDeleteError(err.message || 'Failed to delete case.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="admin-content">
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
              BGV Verification Queue
            </h1>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--primary-subtle)' }}>
              {pagination.total} Cases
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
            Submitted employee cases awaiting review, evidence validation, and final compliance decision
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadQueue}
            disabled={loading}
            style={{ boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Modern Segmented Status Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        padding: '4px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        marginBottom: '18px',
        width: 'fit-content',
        maxWidth: '100%',
        boxShadow: 'var(--shadow-xs)'
      }}>
        {[
          { id: 'ALL', label: 'All Cases' },
          { id: 'Pending BGV Review', label: 'Pending Review' },
          { id: 'In Progress', label: 'In Progress' },
          { id: 'Reverification Required', label: 'Reverification' },
          { id: 'Verified', label: 'Verified' },
          { id: 'Verification Failed', label: 'Failed' }
        ].map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 16px',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
              }}
              onClick={() => {
                setCurrentTab(tab.id);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="table-container" style={{ marginBottom: '20px', padding: '14px 18px', boxShadow: 'var(--shadow-xs)' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search Emp ID, Name, Reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', height: 38, fontSize: '0.86rem' }}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <select
              className="form-control form-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Branches</option>
              {masters?.branches?.map((b) => (
                <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '150px' }}>
            <select
              className="form-control form-select"
              value={selectedReviewer}
              onChange={(e) => setSelectedReviewer(e.target.value)}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Reviewers</option>
              {masters?.reviewers?.map((r) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <select
              className="form-control form-select"
              value={selectedTatStatus}
              onChange={(e) => setSelectedTatStatus(e.target.value)}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All TAT Statuses</option>
              <option value="Within TAT">Within TAT</option>
              <option value="Due Today">Due Today</option>
              <option value="TAT Breached">TAT Breached</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ height: 38, padding: '0 16px' }}>
            <Search size={14} />
            <span>Search</span>
          </button>
        </form>

        {/* Bulk Assign Bar */}
        {selectedCaseRefs.length > 0 && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(192, 132, 252, 0.1)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(192, 132, 252, 0.25)'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>
              ✓ {selectedCaseRefs.length} case(s) selected:
            </span>

            <select
              className="form-control form-select"
              style={{ maxWidth: '220px', padding: '6px 10px', fontSize: '0.85rem', height: 34 }}
              value={assignReviewerId}
              onChange={(e) => setAssignReviewerId(e.target.value)}
            >
              <option value="">-- Assign to Reviewer --</option>
              {masters?.reviewers?.map((r) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>

            <button
              className="btn btn-accent btn-sm"
              onClick={handleAssignSelected}
              disabled={!assignReviewerId}
              style={{ height: 34, padding: '0 14px' }}
            >
              Assign Selected
            </button>
          </div>
        )}
      </div>

      {/* Queue Table */}
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedCaseRefs.length === cases.length && cases.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCaseRefs(cases.map((c) => c.case_reference).filter(Boolean));
                      } else {
                        setSelectedCaseRefs([]);
                      }
                    }}
                  />
                </th>
                <th>Reference / Emp ID</th>
                <th>Employee Name</th>
                <th>Branch & Dept</th>
                <th>Submission Date</th>
                <th>GPS Status</th>
                <th>Photos</th>
                <th>Proof Doc</th>
                <th>Status</th>
                <th>Reviewer</th>
                <th>TAT</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Loading verification queue...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No cases in queue for selected criteria.
                  </td>
                </tr>
              ) : (
                cases.map((item) => (
                  <tr key={item.employee_id}>
                    <td>
                      {item.case_reference && (
                        <input
                          type="checkbox"
                          checked={selectedCaseRefs.includes(item.case_reference)}
                          onChange={() => toggleSelectCase(item.case_reference)}
                        />
                      )}
                    </td>
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
                          {item.case_reference || 'Not Generated'}
                        </span>
                        <div style={{ fontSize: '0.76rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                          {item.employee_id}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--radius-sm)',
                          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.78rem',
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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.submission_date ? item.submission_date.substring(0, 16) : 'Pending Submission'}
                      </div>
                    </td>
                    <td>
                      {item.location_captured ? (
                        <div>
                          <span className={`badge ${
                            (item.distance_category?.includes('PASS') || item.distance_category?.includes('INSIDE')) ? 'badge-success' : 'badge-warning'
                          }`} style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
                            {item.distance_from_hr_meters !== null && item.distance_from_hr_meters !== undefined
                              ? `${Math.round(parseFloat(item.distance_from_hr_meters))}m`
                              : 'GPS OK'}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                            {item.distance_category?.includes('PASS') || item.distance_category?.includes('INSIDE')
                              ? 'PASS (≤100m)'
                              : item.distance_category?.includes('APPROXIMATE')
                              ? 'HR APPROXIMATE'
                              : item.distance_from_hr_meters !== null
                              ? 'REVIEW (>100m)'
                              : (item.distance_category || 'Pending')}
                          </div>
                        </div>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <span title="Nearby Landmark Photo" className={`badge ${item.landmark_photo_captured ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                          L
                        </span>
                        <span title="Street Board Photo" className={`badge ${item.street_photo_captured ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                          B
                        </span>
                        <span title="Full Building Photo" className={`badge ${item.house_photo_captured ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                          H
                        </span>
                        <span title="Door Number Selfie" className={`badge ${item.door_photo_captured ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                          D
                        </span>
                        <span title="Live Selfie" className={`badge ${item.selfie_captured ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '1px 5px', fontSize: '0.68rem' }}>
                          S
                        </span>
                      </div>
                    </td>
                    <td>
                      {item.address_proof_uploaded ? (
                        <span className="badge badge-success" style={{ textTransform: 'none', fontSize: '0.72rem' }}>
                          {item.document_type || 'Uploaded'}
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        item.verification_status === 'Verified' ? 'badge-success' :
                        item.verification_status === 'Verification Failed' ? 'badge-danger' :
                        item.verification_status === 'Pending BGV Review' ? 'badge-warning' : 'badge-primary'
                      }`} style={{ fontSize: '0.72rem' }}>
                        {item.verification_status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {item.assigned_reviewer_name || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.tat_status === 'Within TAT' || item.tat_status === 'Completed' ? 'badge-success' :
                        item.tat_status === 'Due Today' ? 'badge-warning' : 'badge-danger'
                      }`} style={{ fontSize: '0.72rem' }}>
                        {item.tat_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/admin/review/${item.employee_id}`)}
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        >
                          <ShieldCheck size={13} />
                          <span>Review Case</span>
                        </button>

                        {isAdmin && (
                          <button
                            id={`btn-delete-queue-case-${item.employee_id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setDeleteTarget(item);
                              setDeleteError('');
                              setDeleteEmployeeAlso(false);
                            }}
                            title="Delete Case from Queue"
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

        {/* Pagination Bar */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Case Confirmation Modal (Admin Only) */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--danger-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={22} />
                <h3 style={{ fontSize: '1.15rem', color: 'var(--danger)', margin: 0 }}>
                  Delete Verification Case
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
                Are you sure you want to delete the verification case for:
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
                      If unchecked, the case will be removed and the employee's status will reset to "Not Started" so they can begin again.
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
                <strong>Warning:</strong> This will permanently delete the verification submission data, photo evidence, and case records.
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
                id="btn-confirm-delete-case"
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
