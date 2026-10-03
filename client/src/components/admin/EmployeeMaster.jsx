import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AddEmployeeModal } from './AddEmployeeModal';
import { BulkUploadModal } from './BulkUploadModal';
import {
  Users,
  UserPlus,
  UploadCloud,
  Search,
  Filter,
  Download,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  X,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export function EmployeeMaster() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['Super Admin', 'HR/Admin'].includes(user?.role);

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [masters, setMasters] = useState({ branches: [], departments: [], locations: [], reviewers: [] });

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(searchParams.get('action') === 'add');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedEmpDetail, setSelectedEmpDetail] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [pagination.page, statusFilter, branchFilter, deptFilter]);

  async function loadMasters() {
    try {
      const data = await api.masters.getAll();
      setMasters(data);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  }

  async function loadEmployees() {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (branchFilter !== 'ALL') params.branch = branchFilter;
      if (deptFilter !== 'ALL') params.department = deptFilter;

      const data = await api.employees.list(params);
      setEmployees(data.employees || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadEmployees();
  }

  async function handleViewDetail(empId) {
    try {
      const data = await api.employees.get(empId);
      setSelectedEmpDetail(data);
      setIsDetailDrawerOpen(true);
    } catch (err) {
      console.error('Failed to load employee details:', err);
    }
  }

  async function handleExportMaster() {
    try {
      const res = await api.reports.generate({
        reportType: 'employee_detailed',
        branch: branchFilter,
        department: deptFilter,
        status: statusFilter
      });
      alert(`Master report generated and stored in internal Download Area: ${res.fileName}`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export employee master.');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.employees.delete(deleteTarget.employee_id);
      setDeleteTarget(null);
      loadEmployees();
    } catch (err) {
      console.error('Delete employee error:', err);
      setDeleteError(err.message || 'Failed to delete employee record.');
    } finally {
      setIsDeleting(false);
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--success)' }} />
            Verified
          </span>
        );
      case 'Verification Failed':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
            Failed
          </span>
        );
      case 'Pending BGV Review':
        return (
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
            Pending Review
          </span>
        );
      case 'Reverification Required':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
            Reverify Req.
          </span>
        );
      case 'In Progress':
        return (
          <span className="badge" style={{ backgroundColor: 'var(--cyan-light)', color: 'var(--cyan)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--cyan)' }} />
            In Progress
          </span>
        );
      default:
        return (
          <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-light)' }} />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="admin-content">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Employee Master
            </h1>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--primary-subtle)' }}>
              {pagination.total} Records
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
            HR Master Records for Address & Background Verification Lifecycle
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportMaster}
            style={{ boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} color="var(--text-muted)" />
            <span>Export to Download Area</span>
          </button>

          <button
            id="btn-bulk-upload-employees"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsBulkModalOpen(true)}
            style={{ boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UploadCloud size={15} color="var(--accent)" />
            <span>Bulk Upload (Excel / CSV)</span>
          </button>

          <button
            id="btn-add-employee"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddModalOpen(true)}
            style={{ boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={14} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="table-container" style={{ marginBottom: '20px', padding: '14px 18px', boxShadow: 'var(--shadow-xs)' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by Emp ID, Name, Mobile, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', height: 38, fontSize: '0.86rem' }}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <select
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending BGV Review">Pending Review</option>
              <option value="Verified">Verified</option>
              <option value="Verification Failed">Failed</option>
              <option value="Reverification Required">Reverify Required</option>
            </select>
          </div>

          <div style={{ minWidth: '160px' }}>
            <select
              className="form-control form-select"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Branches</option>
              {masters?.branches?.map((b) => (
                <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '160px' }}>
            <select
              className="form-control form-select"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Departments</option>
              {masters?.departments?.map((d) => (
                <option key={d.id} value={d.department_name}>{d.department_name}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ height: 38, padding: '0 16px' }}>
            <Search size={14} />
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Employees Table */}
      <div className="table-container">
        <div className="table-header-bar">
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--primary)' }}>
            Employee Master Directory
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Page {pagination.page} of {pagination.totalPages || 1}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Candidate / ID</th>
                <th>Contact Information</th>
                <th>Date of Joining</th>
                <th>Department</th>
                <th>Branch</th>
                <th>Verification Status</th>
                <th>TAT Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={22} className="animate-spin" color="var(--accent)" />
                      <span>Loading employee master records...</span>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Users size={32} color="var(--text-light)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <p style={{ fontWeight: 600 }}>No employee records match the filter criteria.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try clearing filters or adding a new employee.</p>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius-sm)',
                          background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
                          border: '1px solid rgba(216, 180, 254, 0.3)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0
                        }}>
                          {emp.employee_name?.charAt(0) || 'E'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.employee_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              color: 'var(--accent)',
                              backgroundColor: 'var(--accent-light)',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}>
                              {emp.employee_id}
                            </span>
                            {emp.designation && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                • {emp.designation}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.84rem', fontWeight: 500 }}>{emp.mobile_number || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email_id || '—'}</div>
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{emp.date_of_joining || '—'}</td>
                    <td style={{ fontSize: '0.84rem', fontWeight: 500 }}>{emp.department || '—'}</td>
                    <td style={{ fontSize: '0.84rem' }}>{emp.branch || '—'}</td>
                    <td>{getStatusBadge(emp.verification_status)}</td>
                    <td>
                      <span className={`badge ${
                        emp.tat_status === 'Within TAT' || emp.tat_status === 'Completed' ? 'badge-success' :
                        emp.tat_status === 'Due Today' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {emp.tat_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewDetail(emp.employee_id)}
                          title="View Candidate Profile"
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        {emp.verification_status === 'Pending BGV Review' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/admin/review/${emp.employee_id}`)}
                            title="Review Case"
                            style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          >
                            <ShieldCheck size={13} />
                            <span>Review</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            id={`btn-delete-emp-${emp.employee_id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setDeleteTarget(emp);
                              setDeleteError('');
                            }}
                            title="Delete Employee Record"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', padding: '5px 10px', fontSize: '0.78rem' }}
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
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
          fontSize: '0.82rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages || 1}</strong> ({pagination.total} total)
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              style={{ padding: '5px 10px' }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              style={{ padding: '5px 10px' }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Details Inspector Modal */}
      {isDetailDrawerOpen && selectedEmpDetail && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                  {selectedEmpDetail.employee.employee_name} ({selectedEmpDetail.employee.employee_id})
                </h3>
                <span className="badge badge-primary">{selectedEmpDetail.employee.verification_status}</span>
              </div>
              <button onClick={() => setIsDetailDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Department</span>
                  <div style={{ fontWeight: 600 }}>{selectedEmpDetail.employee.department}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Designation</span>
                  <div style={{ fontWeight: 600 }}>{selectedEmpDetail.employee.designation}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Branch & Location</span>
                  <div style={{ fontWeight: 600 }}>{selectedEmpDetail.employee.branch} - {selectedEmpDetail.employee.location}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date of Joining</span>
                  <div style={{ fontWeight: 600 }}>{selectedEmpDetail.employee.date_of_joining}</div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  HR Registered Address
                </span>
                <div style={{ fontSize: '0.95rem', marginTop: '4px', lineHeight: 1.4 }}>
                  {selectedEmpDetail.employee.hr_current_address}
                </div>
              </div>

              {selectedEmpDetail.progress?.submitted_address && (
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>
                    Employee Verified Address
                  </span>
                  <div style={{ fontSize: '0.95rem', marginTop: '4px', lineHeight: 1.4, color: 'var(--primary)' }}>
                    {selectedEmpDetail.progress.submitted_address}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--primary)' }}>Verification History Timeline</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedEmpDetail.timeline?.map((t) => (
                  <div key={t.id} style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: '120px' }}>{t.created_at?.substring(0, 16)}</span>
                    <span style={{ fontWeight: 600 }}>{t.action}:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.details}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsDetailDrawerOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={loadEmployees}
        masters={masters}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onUploadSuccess={loadEmployees}
      />

      {/* Delete Confirmation Modal (Admin Only) */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--danger-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <AlertTriangle size={22} />
                <h3 style={{ fontSize: '1.15rem', color: 'var(--danger)', margin: 0 }}>
                  Confirm Employee Deletion
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
                Are you sure you want to permanently delete employee <strong>{deleteTarget.employee_name}</strong> (ID: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{deleteTarget.employee_id}</span>)?
              </p>

              <div style={{
                backgroundColor: 'var(--danger-light)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: '0.8rem',
                color: 'var(--danger)',
                lineHeight: 1.4
              }}>
                <strong>Warning:</strong> This will permanently delete the HR master record, verification cases, submitted GPS data, photo evidence, and audit trail. This action cannot be undone.
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
                id="btn-confirm-delete-employee"
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
