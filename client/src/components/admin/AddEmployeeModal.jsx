import React, { useState } from 'react';
import { api } from '../../api/client';
import { X, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

export function AddEmployeeModal({ isOpen, onClose, onCreated, masters }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    mobileNumber: '',
    altMobileNumber: '',
    emailId: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    department: 'Operations',
    designation: 'Executive',
    branch: 'Chennai Headquarters',
    location: 'Chennai Central',
    reportingManager: '',
    currentAddress: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    permanentAddress: '',
    permanentPincode: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.employeeId.trim() || !formData.employeeName.trim() || !formData.mobileNumber.trim() || !formData.currentAddress.trim()) {
      setErrorMsg('Please fill in all mandatory fields.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.employees.create({
        ...formData,
        employeeId: formData.employeeId.trim().toUpperCase()
      });

      setSuccessMsg(`Employee ${formData.employeeName} (${formData.employeeId.toUpperCase()}) created successfully.`);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Create error:', err);
      setErrorMsg(err.message || 'Failed to create employee.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '750px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Add New Employee</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                backgroundColor: 'var(--success-light)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                color: 'var(--success)',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  Employee ID <span className="required">*</span>
                </label>
                <input
                  id="input-emp-id"
                  type="text"
                  className="form-control"
                  placeholder="e.g. COL00120"
                  value={formData.employeeId}
                  onChange={(e) => handleChange('employeeId', e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Employee Name <span className="required">*</span>
                </label>
                <input
                  id="input-emp-name"
                  type="text"
                  className="form-control"
                  placeholder="Full Name"
                  value={formData.employeeName}
                  onChange={(e) => handleChange('employeeName', e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  Mobile Number <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="10 digit mobile"
                  value={formData.mobileNumber}
                  onChange={(e) => handleChange('mobileNumber', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alt Mobile</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="Optional"
                  value={formData.altMobileNumber}
                  onChange={(e) => handleChange('altMobileNumber', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Email ID <span className="required">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@collman.com"
                  value={formData.emailId}
                  onChange={(e) => handleChange('emailId', e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">
                  Date of Joining <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.dateOfJoining}
                  onChange={(e) => handleChange('dateOfJoining', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-control form-select"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                >
                  {masters?.departments?.map((d) => (
                    <option key={d.id} value={d.department_name}>{d.department_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.designation}
                  onChange={(e) => handleChange('designation', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <select
                  className="form-control form-select"
                  value={formData.branch}
                  onChange={(e) => handleChange('branch', e.target.value)}
                >
                  {masters?.branches?.map((b) => (
                    <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <select
                  className="form-control form-select"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                >
                  {masters?.locations?.map((l) => (
                    <option key={l.id} value={l.location_name}>{l.location_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address Section */}
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>
                Current Address (HR Record)
              </h4>

              <div className="form-group">
                <label className="form-label">
                  Full Current Address <span className="required">*</span>
                </label>
                <textarea
                  id="input-emp-address"
                  className="form-control"
                  rows={2}
                  placeholder="Door No, Street, Building, Area"
                  value={formData.currentAddress}
                  onChange={(e) => handleChange('currentAddress', e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">City <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pincode <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button id="btn-submit-add-employee" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
