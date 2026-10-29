import React, { useState } from 'react';
import { api } from '../../api/client';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  FileDown,
  RefreshCw,
  Users,
  Info
} from 'lucide-react';

export function BulkUserUploadModal({ isOpen, onClose, onUploadSuccess, roles = [], branches = [], departments = [] }) {
  const [step, setStep] = useState(1); // 1: Select File & Sample, 2: Column Mapping & Preview, 3: Processing Result
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingSample, setDownloadingSample] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [previewMode, setPreviewMode] = useState('all'); // 'all' or '5'

  // Column Mapping State
  const [mapping, setMapping] = useState({
    full_name: '',
    username: '',
    role: '',
    password: '',
    manager: '',
    branch: '',
    department: ''
  });

  if (!isOpen) return null;

  // Client-side CSV generator fallback for instant download
  function downloadClientCsvSample() {
    const csvContent =
      'Full Name,Employee ID,Portal Role,Initial Password,Manager,Branch,Department\n' +
      'Anand Sharma,COL00101,HR/Admin,Collman@123,Reporting Manager,Chennai Headquarters,Human Resources\n' +
      'Priya Raman,COL00102,BGV Reviewer,Collman@123,Anjali Sharma,Chennai Headquarters,Quality & Operations\n' +
      'Rajesh Kumar,COL00103,Team Leader,Collman@123,SARANGAN,Chennai Headquarters,Operations\n' +
      'Karthik N,COL00104,View Only,Collman@123,Anjali Sharma,Chennai Headquarters,Audit & Compliance\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Collman_User_Bulk_Upload_Sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadSample(format = 'xlsx') {
    setDownloadingSample(true);
    setErrorMsg('');
    try {
      await api.users.downloadSampleTemplate(format);
    } catch (err) {
      console.warn('Backend sample download failed, falling back to client CSV:', err);
      downloadClientCsvSample();
    } finally {
      setDownloadingSample(false);
    }
  }

  async function handleFileSelected(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setLoading(true);
    setErrorMsg('');

    try {
      const parsed = await api.users.parseBulkFile(selected);
      setParsedData(parsed);

      // Auto-detect and map columns
      const autoMap = {
        full_name: '',
        username: '',
        role: '',
        password: '',
        manager: '',
        branch: '',
        department: ''
      };

      const headers = parsed.headers || [];

      headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (lower.includes('fullname') || lower === 'name' || lower.includes('username') && !lower.includes('id')) {
          if (!autoMap.full_name) autoMap.full_name = h;
        } else if (
          lower.includes('empid') ||
          lower.includes('empcode') ||
          lower.includes('employeeid') ||
          lower === 'id' ||
          lower === 'user' ||
          lower === 'username'
        ) {
          if (!autoMap.username) autoMap.username = h;
        } else if (lower.includes('role') || lower.includes('portalrole') || lower.includes('designation')) {
          if (!autoMap.role) autoMap.role = h;
        } else if (lower.includes('pass') || lower.includes('password') || lower.includes('pwd')) {
          if (!autoMap.password) autoMap.password = h;
        } else if (lower.includes('manager') || lower.includes('reporting') || lower.includes('supervisor')) {
          if (!autoMap.manager) autoMap.manager = h;
        } else if (lower.includes('branch') || lower.includes('office') || lower.includes('location')) {
          if (!autoMap.branch) autoMap.branch = h;
        } else if (lower.includes('dept') || lower.includes('department')) {
          if (!autoMap.department) autoMap.department = h;
        }
      });

      setMapping(autoMap);
      setStep(2);
    } catch (err) {
      console.error('File parse error:', err);
      setErrorMsg(err.message || 'Failed to parse uploaded user file.');
    } finally {
      setLoading(false);
    }
  }

  function handleMapChange(field, headerValue) {
    setMapping((prev) => ({ ...prev, [field]: headerValue }));
  }

  async function handleProcessUpload() {
    if (!mapping.full_name || !mapping.username || !mapping.role) {
      setErrorMsg('Please map all mandatory fields: Full Name, Employee ID, and Portal Role.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await api.users.processBulkUpload(parsedData.filePath, mapping);
      setUploadResult(result);
      setStep(3); // Result summary
    } catch (err) {
      console.error('Bulk user upload error:', err);
      setErrorMsg(err.message || 'Failed to process bulk user upload.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep(1);
    setFile(null);
    setParsedData(null);
    setUploadResult(null);
    setErrorMsg('');
    setMapping({
      full_name: '',
      username: '',
      role: '',
      password: '',
      manager: '',
      branch: '',
      department: ''
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{ maxWidth: '820px', width: '94%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(126, 34, 206, 0.15) 100%)',
                color: 'var(--text-accent, #9333EA)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UploadCloud size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Bulk Upload System Users
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Batch create internal user accounts from Excel (.xlsx) or CSV rosters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: 'var(--danger-light)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                color: 'var(--danger-text)',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px'
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Select File & Download Sample */}
          {step === 1 && (
            <div>
              {/* Sample Download Banner */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px 20px',
                  marginBottom: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileDown size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      Need the standard spreadsheet template?
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Includes pre-filled sample rows with all supported fields and roles reference.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownloadSample('xlsx')}
                    disabled={downloadingSample}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    {downloadingSample ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>Sample File (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownloadSample('csv')}
                    disabled={downloadingSample}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Sample File (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '38px 24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card, transparent)',
                  transition: 'border-color 0.2s ease',
                  position: 'relative'
                }}
              >
                <FileSpreadsheet size={48} color="var(--primary-color, #9333EA)" style={{ margin: '0 auto 14px auto', opacity: 0.9 }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Select or Drop User Accounts File
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 20px auto', lineHeight: 1.4 }}>
                  Upload your completed Excel (.xlsx, .xls) or CSV document. Headers are automatically detected and mapped.
                </p>

                <label
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Reading File...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>Choose File to Upload</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={handleFileSelected}
                    disabled={loading}
                  />
                </label>
              </div>

              {/* Template Guidelines */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.02))',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  <Info size={15} color="var(--primary-color)" />
                  <span>Column Guidelines</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '8px' }}>
                  <div><strong>Full Name:</strong> Candidate / employee legal name (Required)</div>
                  <div><strong>Employee ID:</strong> Unique user ID or login code (Required)</div>
                  <div><strong>Portal Role:</strong> Super Admin, HR/Admin, BGV Reviewer, etc. (Required)</div>
                  <div><strong>Initial Password:</strong> Defaults to <code>Collman@123</code> if omitted</div>
                  <div><strong>Manager:</strong> Reporting manager name (Optional)</div>
                  <div><strong>Branch & Dept:</strong> Corporate branch & department (Optional)</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping & Data Preview */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Map Columns to User Fields
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                    File: <strong>{parsedData?.fileName}</strong> • Found <strong>{parsedData?.totalRows}</strong> records
                  </p>
                </div>
                <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                  Step 2 of 3
                </span>
              </div>

              {/* Mapping Select Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.02))',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '20px'
                }}
              >
                {[
                  { field: 'full_name', label: 'Full Name', req: true, placeholder: 'e.g. Anand Sharma' },
                  { field: 'username', label: 'Employee ID', req: true, placeholder: 'e.g. COL00101' },
                  { field: 'role', label: 'Portal Role', req: true, placeholder: 'e.g. HR/Admin' },
                  { field: 'password', label: 'Initial Password', req: false, placeholder: 'Defaults to Collman@123' },
                  { field: 'manager', label: 'Manager', req: false, placeholder: 'e.g. Reporting Manager' },
                  { field: 'branch', label: 'Assigned Branch', req: false, placeholder: 'e.g. Chennai HQ' },
                  { field: 'department', label: 'Department', req: false, placeholder: 'e.g. Human Resources' }
                ].map((col) => (
                  <div key={col.field} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span>{col.label}</span>
                      {col.req && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
                    </label>
                    <select
                      className="form-control form-select"
                      style={{ fontSize: '0.84rem', padding: '7px 10px' }}
                      value={mapping[col.field] || ''}
                      onChange={(e) => handleMapChange(col.field, e.target.value)}
                    >
                      <option value="">-- Do Not Map --</option>
                      {parsedData?.headers?.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Rows Preview with Show All support */}
              {(() => {
                const allRows = parsedData?.allRows || parsedData?.previewRows || parsedData?.sampleRows || [];
                const displayRows = previewMode === 'all' ? allRows : allRows.slice(0, 5);
                const totalCount = parsedData?.totalRows || allRows.length;

                if (allRows.length === 0) return null;

                return (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {previewMode === 'all' ? `All Rows Preview (${displayRows.length} Records):` : 'First 5 Rows Preview:'}
                        </span>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(124, 58, 237, 0.1)',
                          color: 'var(--accent, #7C3AED)'
                        }}>
                          Showing {displayRows.length} of {totalCount} rows
                        </span>
                      </div>

                      <div style={{
                        display: 'inline-flex',
                        padding: '2px',
                        backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.05))',
                        borderRadius: 'var(--radius-sm, 6px)',
                        border: '1px solid var(--border-color)'
                      }}>
                        <button
                          type="button"
                          id="btn-show-all-preview"
                          onClick={() => setPreviewMode('all')}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: previewMode === 'all' ? 'var(--accent, #7C3AED)' : 'transparent',
                            color: previewMode === 'all' ? '#FFFFFF' : 'var(--text-muted)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Show All ({totalCount})
                        </button>
                        <button
                          type="button"
                          id="btn-show-5-preview"
                          onClick={() => setPreviewMode('5')}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: previewMode === '5' ? 'var(--accent, #7C3AED)' : 'transparent',
                            color: previewMode === '5' ? '#FFFFFF' : 'var(--text-muted)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          First 5 Rows
                        </button>
                      </div>
                    </div>

                    <div style={{
                      maxHeight: '380px',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card)'
                    }}>
                      <table className="custom-table" style={{ fontSize: '0.78rem', width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-card)' }}>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '8px 12px', width: '45px' }}>#</th>
                            <th style={{ padding: '8px 12px' }}>Full Name</th>
                            <th style={{ padding: '8px 12px' }}>Employee ID</th>
                            <th style={{ padding: '8px 12px' }}>Portal Role</th>
                            <th style={{ padding: '8px 12px' }}>Password</th>
                            <th style={{ padding: '8px 12px' }}>Manager</th>
                            <th style={{ padding: '8px 12px' }}>Branch</th>
                            <th style={{ padding: '8px 12px' }}>Department</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #E2E8F0)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row[mapping.full_name] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {row[mapping.username] || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.role] || '—'}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                {row[mapping.password] ? '••••••' : '(Default: Collman@123)'}
                              </td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.manager] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.branch] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.department] || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* STEP 3: Result Summary */}
          {step === 3 && uploadResult && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(52, 211, 153, 0.15)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                Bulk User Upload Complete
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 auto 24px auto', maxWidth: '500px' }}>
                {uploadResult.message}
              </p>

              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total In File</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                    {uploadResult.totalRecords}
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ fontSize: '0.76rem', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Accounts Created</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10B981', marginTop: '4px' }}>
                    {uploadResult.validRecords}
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: uploadResult.failedRecords > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: `1px solid ${uploadResult.failedRecords > 0 ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-color)'}` }}>
                  <div style={{ fontSize: '0.76rem', color: uploadResult.failedRecords > 0 ? '#EF4444' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skipped / Duplicates</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: uploadResult.failedRecords > 0 ? '#EF4444' : 'var(--text-main)', marginTop: '4px' }}>
                    {uploadResult.failedRecords}
                  </div>
                </div>
              </div>

              {/* Error list if any rows were skipped */}
              {uploadResult.errors?.length > 0 && (
                <div style={{ textAlign: 'left', marginTop: '20px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#EF4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>Skipped Records Details ({uploadResult.errors.length}):</span>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table className="custom-table" style={{ fontSize: '0.78rem', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 10px' }}>Row</th>
                          <th style={{ padding: '6px 10px' }}>Employee ID</th>
                          <th style={{ padding: '6px 10px' }}>Name</th>
                          <th style={{ padding: '6px 10px' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.errors.map((err, i) => (
                          <tr key={i}>
                            <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{err.row}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{err.id}</td>
                            <td style={{ padding: '6px 10px' }}>{err.name || '—'}</td>
                            <td style={{ padding: '6px 10px', color: '#EF4444' }}>{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', gap: '10px' }}>
          {step === 1 && (
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          )}

          {step === 2 && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} disabled={loading}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button
                id="btn-confirm-bulk-user-upload"
                type="button"
                className="btn btn-primary"
                onClick={handleProcessUpload}
                disabled={loading || !mapping.full_name || !mapping.username || !mapping.role}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Importing Accounts...</span>
                  </>
                ) : (
                  <>
                    <span>Validate & Import Users</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <button
              id="btn-bulk-user-done"
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onUploadSuccess();
                onClose();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '100px', justifyContent: 'center' }}
            >
              <CheckCircle2 size={16} />
              <span>Done</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
