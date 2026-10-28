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
  Info
} from 'lucide-react';

export function BulkUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [step, setStep] = useState(1); // 1: Select File, 2: Column Mapping, 3: Preview & Process, 4: Result
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingSample, setDownloadingSample] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [previewMode, setPreviewMode] = useState('all'); // 'all' or '5'

  // Column Mapping State
  const [mapping, setMapping] = useState({
    employee_id: '',
    employee_name: '',
    mobile_number: '',
    alt_mobile_number: '',
    email_id: '',
    date_of_joining: '',
    department: '',
    designation: '',
    branch: '',
    location: '',
    reporting_manager: '',
    team_leader: '',
    hr_current_address: '',
    hr_city: '',
    hr_state: '',
    hr_pincode: '',
    hr_permanent_address: ''
  });

  if (!isOpen) return null;

  // Client-side CSV generator fallback for instant download
  function downloadClientCsvSample() {
    const csvContent =
      'Employee ID,Employee Name,Mobile Number,Manager,Team Leader,Date of Joining,Department,Designation,Branch,Location,Full Current Address,City,State,Pincode\n' +
      'COL00120,Venkatesh Raman,9876543210,SARANGAN,Surya,2026-10-22,Operations,Executive,Chennai Headquarters,Chennai Central,"No. 45, Gandhi Street, T. Nagar",Chennai,Tamil Nadu,600017\n' +
      'COL00121,Divya Krishnan,9840123456,Rajesh Sharma,Surya,2026-10-22,Finance & Accounts,Executive,Chennai Headquarters,Chennai South,"Flat 2B, Lakshmi Apartments, Velachery",Chennai,Tamil Nadu,600042\n' +
      'COL00122,Mohan Raj,9123456789,Anjali Sharma,Surya,2026-10-22,Operations,Senior Executive,Chennai Headquarters,Chennai West,"12/3, Anna Nagar 2nd Avenue",Chennai,Tamil Nadu,600040\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Collman_Employee_Bulk_Upload_Sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadSample(format = 'xlsx') {
    setDownloadingSample(true);
    setErrorMsg('');
    try {
      await api.employees.downloadSampleTemplate(format);
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
      const parsed = await api.employees.parseBulkFile(selected);
      setParsedData(parsed);

      // Auto-guess mapping based on common header names
      const autoMap = { ...mapping };
      const headers = parsed.headers || [];

      headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lower.includes('empid') || lower.includes('empcode') || lower === 'id') autoMap.employee_id = h;
        else if (lower.includes('name') || lower.includes('fullname')) autoMap.employee_name = h;
        else if (lower.includes('mobile') || lower.includes('phone') || lower.includes('contact')) autoMap.mobile_number = h;
        else if (lower.includes('altmobile') || lower.includes('alternate')) autoMap.alt_mobile_number = h;
        else if (lower.includes('email') || lower.includes('mail')) autoMap.email_id = h;
        else if (lower.includes('doj') || lower.includes('joining') || lower.includes('dateofjoining')) autoMap.date_of_joining = h;
        else if (lower.includes('dept') || lower.includes('department')) autoMap.department = h;
        else if (lower.includes('desig') || lower.includes('designation') || lower.includes('role')) autoMap.designation = h;
        else if (lower.includes('branch')) autoMap.branch = h;
        else if (lower.includes('loc') || lower.includes('location')) autoMap.location = h;
        else if (lower.includes('manager') || lower.includes('reporting')) autoMap.reporting_manager = h;
        else if (lower.includes('teamleader') || lower.includes('tl') || lower.includes('leader')) autoMap.team_leader = h;
        else if (lower.includes('address') || lower.includes('currentaddress') || lower.includes('street')) autoMap.hr_current_address = h;
        else if (lower.includes('city')) autoMap.hr_city = h;
        else if (lower.includes('state')) autoMap.hr_state = h;
        else if (lower.includes('pin') || lower.includes('pincode') || lower.includes('zip')) autoMap.hr_pincode = h;
        else if (lower.includes('perm') || lower.includes('permanent')) autoMap.hr_permanent_address = h;
      });

      setMapping(autoMap);
      setStep(2);
    } catch (err) {
      console.error('File parse error:', err);
      setErrorMsg(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }

  function handleMapChange(field, headerValue) {
    setMapping((prev) => ({ ...prev, [field]: headerValue }));
  }

  async function handleProcessUpload() {
    if (!mapping.employee_id || !mapping.employee_name || !mapping.mobile_number || !mapping.hr_current_address) {
      setErrorMsg('Please map all mandatory fields: Employee ID, Name, Mobile, and Current Address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await api.employees.processBulkUpload(parsedData.filePath, mapping);
      setUploadResult(result);
      setStep(3); // Result view
    } catch (err) {
      console.error('Bulk upload error:', err);
      setErrorMsg(err.message || 'Failed to process bulk upload.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '820px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={22} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', margin: 0 }}>Bulk Upload Employees</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {errorMsg && (
            <div style={{
              backgroundColor: 'var(--danger-light)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              color: 'var(--danger)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Select File & Download Sample Template */}
          {step === 1 && (
            <div>
              {/* Sample Download Banner */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  marginBottom: '20px',
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
                      Need the standard employee spreadsheet template?
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Includes pre-filled sample rows with all employee master columns and active branches/depts reference.
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
              <div style={{ textAlign: 'center', padding: '30px 20px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                <FileSpreadsheet size={52} color="var(--accent)" style={{ margin: '0 auto 14px auto' }} />
                <h4 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Select Employee Master Spreadsheet</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                  Upload your Excel (.xlsx, .xls) or CSV file. Flexible column headers are supported with visual mapping.
                </p>

                <label className="btn btn-primary btn-large" style={{ maxWidth: '300px', margin: '0 auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <UploadCloud size={20} />
                  <span>{loading ? 'Reading File...' : 'Choose Excel / CSV File'}</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={handleFileSelected}
                    disabled={loading}
                  />
                </label>
              </div>

              {/* Column Guidelines */}
              <div
                style={{
                  marginTop: '18px',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.02))',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  <Info size={15} color="var(--primary)" />
                  <span>Column Guidelines</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '8px' }}>
                  <div><strong>Mandatory:</strong> Employee ID, Name, Mobile Number, Current Address, City, State, Pincode</div>
                  <div><strong>Optional:</strong> Manager, Team Leader, Date of Joining, Department, Designation, Branch, Location</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>Map Columns to Application Fields</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    File: <strong>{parsedData?.fileName}</strong> ({parsedData?.totalRows} data rows)
                  </p>
                </div>
                <span className="badge badge-primary">Step 2 of 3</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                maxHeight: '380px',
                overflowY: 'auto',
                padding: '4px'
              }}>
                {[
                  { field: 'employee_id', label: 'Employee ID', req: true },
                  { field: 'employee_name', label: 'Employee Name', req: true },
                  { field: 'mobile_number', label: 'Mobile Number', req: true },
                  { field: 'reporting_manager', label: 'Manager', req: false },
                  { field: 'team_leader', label: 'Team Leader', req: false },
                  { field: 'date_of_joining', label: 'Date of Joining', req: false },
                  { field: 'department', label: 'Department', req: false },
                  { field: 'designation', label: 'Designation', req: false },
                  { field: 'branch', label: 'Branch', req: false },
                  { field: 'location', label: 'Location', req: false },
                  { field: 'alt_mobile_number', label: 'Alt Mobile', req: false },
                  { field: 'email_id', label: 'Email ID', req: false },
                  { field: 'hr_current_address', label: 'Current Address', req: true },
                  { field: 'hr_city', label: 'City', req: false },
                  { field: 'hr_state', label: 'State', req: false },
                  { field: 'hr_pincode', label: 'Pincode', req: false },
                  { field: 'hr_permanent_address', label: 'Permanent Address', req: false }
                ].map((col) => (
                  <div key={col.field} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.82rem' }}>
                      {col.label} {col.req && <span className="required">*</span>}
                    </label>
                    <select
                      className="form-control form-select"
                      style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                      value={mapping[col.field] || ''}
                      onChange={(e) => handleMapChange(col.field, e.target.value)}
                    >
                      <option value="">-- Do Not Map --</option>
                      {parsedData?.headers?.map((h) => (
                        <option key={h} value={h}>{h}</option>
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
                          id="btn-emp-show-all-preview"
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
                          id="btn-emp-show-5-preview"
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
                      maxHeight: '360px',
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
                            <th style={{ padding: '8px 12px' }}>Employee ID</th>
                            <th style={{ padding: '8px 12px' }}>Name</th>
                            <th style={{ padding: '8px 12px' }}>Mobile</th>
                            <th style={{ padding: '8px 12px' }}>Manager</th>
                            <th style={{ padding: '8px 12px' }}>Team Leader</th>
                            <th style={{ padding: '8px 12px' }}>Department</th>
                            <th style={{ padding: '8px 12px' }}>Branch</th>
                            <th style={{ padding: '8px 12px' }}>City</th>
                            <th style={{ padding: '8px 12px' }}>State</th>
                            <th style={{ padding: '8px 12px' }}>Pincode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #E2E8F0)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{row[mapping.employee_id] || '—'}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row[mapping.employee_name] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.mobile_number] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.reporting_manager] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.team_leader] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.department] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.branch] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.hr_city] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.hr_state] || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>{row[mapping.hr_pincode] || '—'}</td>
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
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <CheckCircle2 size={54} color="var(--success)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.3rem', color: 'var(--success)', marginBottom: '8px' }}>
                Bulk Upload Processed
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                {uploadResult.message}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Records</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{uploadResult.totalRecords}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--success-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Valid Imported</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--success)' }}>{uploadResult.validRecords}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--danger-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Failed Records</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--danger)' }}>{uploadResult.failedRecords}</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--accent-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Success Rate</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {uploadResult.totalRecords > 0 ? Math.round((uploadResult.validRecords / uploadResult.totalRecords) * 100) : 0}%
                  </div>
                </div>
              </div>

              {uploadResult.failedExportFile && (
                <div style={{
                  backgroundColor: 'var(--warning-light)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: 600 }}>
                    <AlertTriangle size={18} />
                    <span>Failed records exported to Download Area: {uploadResult.failedExportFile}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 2 && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep(1)} disabled={loading}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button
                id="btn-process-bulk-upload"
                className="btn btn-primary"
                onClick={handleProcessUpload}
                disabled={loading}
              >
                {loading ? 'Processing Upload...' : 'Validate & Import Records'}
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {step === 3 && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onUploadSuccess();
                onClose();
              }}
            >
              Done
            </button>
          )}

          {step === 1 && (
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
