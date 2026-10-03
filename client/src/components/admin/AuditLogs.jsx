import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  ScrollText,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  Clock,
  Terminal,
  Activity,
  Calendar,
  X
} from 'lucide-react';

export function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 25, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadAuditLogs();
  }, [pagination.page, actionFilter]);

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (search.trim()) params.employeeId = search.trim();
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await api.audit.list(params);
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadAuditLogs();
  }

  function handleClearFilters() {
    setSearch('');
    setActionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  async function handleExportAudit() {
    try {
      const res = await api.audit.export();
      alert(`Audit log exported to internal Download Area: ${res.fileName}`);
    } catch (err) {
      console.error('Export audit error:', err);
      alert('Failed to export audit log.');
    }
  }

  function getActionBadge(action) {
    if (!action) return <span className="badge badge-secondary">Event</span>;
    if (action.includes('Failed') || action.includes('Reject') || action.includes('Breached')) {
      return <span className="badge badge-danger"><span className="badge-dot dot-danger" />{action}</span>;
    }
    if (action.includes('Verified') || action.includes('Cleared') || action.includes('Success')) {
      return <span className="badge badge-success"><span className="badge-dot dot-success" />{action}</span>;
    }
    if (action.includes('Reverification') || action.includes('Pending') || action.includes('Warning')) {
      return <span className="badge badge-warning"><span className="badge-dot dot-warning" />{action}</span>;
    }
    return <span className="badge badge-primary"><span className="badge-dot dot-primary" />{action}</span>;
  }

  return (
    <div className="admin-content">
      {/* Page Header */}
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
            <ScrollText size={22} />
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
                System Audit Logs
              </h1>
              <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={12} />
                <span>Immutable Trail</span>
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px', margin: 0 }}>
              Chronological security record of employee verification events, reviewer decisions, and administrative actions
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportAudit}>
            <Download size={14} />
            <span>Export to Download Area</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadAuditLogs} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="modern-filter-bar" style={{ marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <label className="filter-label">Search Audit Logs</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search Emp ID, Reference, or Actor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '36px', height: '38px', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          <div style={{ minWidth: '180px' }}>
            <label className="filter-label">Action Category</label>
            <select
              className="form-control form-select"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ height: '38px', fontSize: '0.875rem' }}
            >
              <option value="ALL">All Actions</option>
              <option value="Login">Login</option>
              <option value="Employee Created">Employee Created</option>
              <option value="Employee ID Validated">Employee ID Validated</option>
              <option value="Verification Submitted">Verification Submitted</option>
              <option value="BGV Decision Made">BGV Decision Made</option>
              <option value="Report Generated">Report Generated</option>
              <option value="Bulk Upload Employees">Bulk Upload</option>
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <label className="filter-label">Date From</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <label className="filter-label">Date To</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary btn-sm" style={{ height: '38px', padding: '0 16px' }}>
              <Search size={14} />
              <span>Filter</span>
            </button>

            {(search || actionFilter !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleClearFilters}
                style={{ height: '38px' }}
                title="Clear all filters"
              >
                <X size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Audit Logs Table */}
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '170px' }}>Timestamp</th>
                <th style={{ width: '130px' }}>Actor Type</th>
                <th>Actor Name</th>
                <th>Action</th>
                <th>Emp ID / Reference</th>
                <th>IP Address</th>
                <th>Event Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <RefreshCw size={24} className="animate-spin" color="var(--primary-color)" />
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading audit records...</div>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <ScrollText size={32} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>No audit records found</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No events match your current filter parameters. Try adjusting the search or date range.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const initials = (log.actor_name || 'Sys')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} color="var(--text-muted)" />
                          <span>{log.created_at?.substring(0, 19).replace('T', ' ')}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          log.actor_type === 'Super Admin' ? 'badge-primary' :
                          log.actor_type === 'Employee' ? 'badge-info' : 'badge-secondary'
                        }`} style={{ fontSize: '0.72rem' }}>
                          {log.actor_type || 'System'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            backgroundColor: '#F1F5F9',
                            color: 'var(--primary-color)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            {log.actor_name}
                          </span>
                        </div>
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td>
                        {log.employee_id || log.case_reference ? (
                          <span style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--primary-color)',
                            backgroundColor: '#F8FAFC',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #E2E8F0'
                          }}>
                            {log.employee_id || log.case_reference}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          backgroundColor: '#F1F5F9',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {log.ip_address || '127.0.0.1'}
                        </span>
                      </td>
                      <td style={{
                        fontSize: '0.825rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '420px',
                        lineHeight: 1.45
                      }}>
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          backgroundColor: '#FCFDFF',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages || 1}</strong>
            {pagination.total > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({pagination.total} records total)</span>}
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
    </div>
  );
}

