import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { FileBarChart, FileSpreadsheet, Download, Filter, CheckCircle2, ArrowRight } from 'lucide-react';

export function Reports() {
  const [reportType, setReportType] = useState('employee_detailed');
  const [branch, setBranch] = useState('ALL');
  const [department, setDepartment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [masters, setMasters] = useState({ branches: [], departments: [] });
  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    loadMasters();
  }, []);

  async function loadMasters() {
    try {
      const data = await api.masters.getAll();
      setMasters(data);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    setSuccessResult(null);

    try {
      const res = await api.reports.generate({
        reportType,
        branch,
        department,
        status,
        startDate,
        endDate
      });
      setSuccessResult(res);
    } catch (err) {
      console.error('Report error:', err);
      alert('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }

  const reportsCatalog = [
    { id: 'employee_detailed', title: 'Detailed Employee Verification Master Report', desc: 'Complete employee list with original vs verified address, GPS distance, residence info, and BGV decision.' },
    { id: 'branch_summary', title: 'Branch-wise Verification Summary', desc: 'Aggregated verification performance, completed vs pending cases by branch.' },
    { id: 'dept_summary', title: 'Department-wise Verification Summary', desc: 'Aggregated verification breakdown across departments.' },
    { id: 'reviewer_productivity', title: 'BGV Reviewer Productivity Report', desc: 'Assigned, verified, failed and pending cases per BGV Reviewer.' },
    { id: 'tat_report', title: 'TAT & SLA Compliance Report', desc: 'Turnaround compliance tracking, due today cases, and breached cases.' }
  ];

  return (
    <div className="admin-content">
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Reports & Compliance Analytics
          </h1>
          <span className="badge badge-primary" style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            Excel Engine
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
          Generate standardized BGV audit spreadsheets, SLA summaries, and reviewer productivity metrics
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '22px' }}>
        {/* Report Selector Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
            Select Report Template
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reportsCatalog.map((rep) => {
              const isSelected = reportType === rep.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => {
                    setReportType(rep.id);
                    setSuccessResult(null);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? '0 2px 12px var(--shadow-glow)' : 'none'
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-dark)'}`,
                    backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    flexShrink: 0
                  }}>
                    {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? 'var(--text-accent)' : 'var(--text-main)' }}>
                      {rep.title}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.35 }}>
                      {rep.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Parameters & Generate Form */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
            Report Generation Parameters
          </h3>

          <form onSubmit={handleGenerate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Branch Filter</label>
                <select className="form-control form-select" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ height: 38, fontSize: '0.86rem', borderRadius: 'var(--radius-full)' }}>
                  <option value="ALL">All Branches</option>
                  {masters.branches?.map((b) => (
                    <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Department Filter</label>
                <select className="form-control form-select" value={department} onChange={(e) => setDepartment(e.target.value)} style={{ height: 38, fontSize: '0.86rem', borderRadius: 'var(--radius-full)' }}>
                  <option value="ALL">All Departments</option>
                  {masters.departments?.map((d) => (
                    <option key={d.id} value={d.department_name}>{d.department_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', marginBottom: '22px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Verification Status</label>
                <select className="form-control form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38, fontSize: '0.86rem', borderRadius: 'var(--radius-full)' }}>
                  <option value="ALL">All Statuses</option>
                  <option value="Verified">Verified</option>
                  <option value="Pending BGV Review">Pending Review</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Verification Failed">Failed</option>
                  <option value="Reverification Required">Reverify Req.</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>From Date</label>
                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ height: 38, fontSize: '0.86rem', borderRadius: 'var(--radius-full)' }} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>To Date</label>
                <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ height: 38, fontSize: '0.86rem', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>

            {successResult && (
              <div style={{
                backgroundColor: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 size={24} color="#34D399" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#34D399', fontSize: '0.9rem' }}>Report Generated Successfully</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      File: <strong style={{ color: '#FFFFFF' }}>{successResult.fileName}</strong> ({successResult.recordCount} records) saved into Download Area.
                    </div>
                  </div>
                </div>

                <a href="/admin/downloads" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Go to Download Area</span>
                  <ArrowRight size={13} />
                </a>
              </div>
            )}

            <button
              id="btn-generate-excel-report"
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <FileSpreadsheet size={19} />
              <span>{loading ? 'Compiling Excel Report...' : 'Generate & Export Report (Excel)'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
