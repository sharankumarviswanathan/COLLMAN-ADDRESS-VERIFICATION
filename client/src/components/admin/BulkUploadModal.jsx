import React, { useState } from 'react';
import { api } from '../../api/client';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, X, Download } from 'lucide-react';

export function BulkUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [step, setStep] = useState(1); // 1: Select File, 2: Column Mapping, 3: Preview & Process, 4: Result
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

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
    hr_current_address: '',
    hr_city: '',
    hr_state: '',
    hr_pincode: '',
    hr_permanent_address: ''
  });

  if (!isOpen) return null;

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
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Bulk Upload Employees</h3>
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

          {/* STEP 1: Select File */}
          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <FileSpreadsheet size={56} color="var(--accent)" style={{ margin: '0 auto 16px auto' }} />
              <h4 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Select Employee Master Spreadsheet</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Upload your Excel (.xlsx, .xls) or CSV file. Flexible column headers are supported with visual mapping.
              </p>

              <label className="btn btn-primary btn-large" style={{ maxWidth: '300px', margin: '0 auto', cursor: 'pointer' }}>
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
                  { field: 'alt_mobile_number', label: 'Alt Mobile', req: false },
                  { field: 'email_id', label: 'Email ID', req: false },
                  { field: 'date_of_joining', label: 'Date of Joining', req: false },
                  { field: 'department', label: 'Department', req: false },
                  { field: 'designation', label: 'Designation', req: false },
                  { field: 'branch', label: 'Branch', req: false },
                  { field: 'location', label: 'Location', req: false },
                  { field: 'reporting_manager', label: 'Reporting Manager', req: false },
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
