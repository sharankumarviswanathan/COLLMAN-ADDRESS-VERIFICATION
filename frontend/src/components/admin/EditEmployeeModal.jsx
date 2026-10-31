import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { soundManager } from '../../lib/soundManager';
import {
  X,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Lock,
  MapPin,
  Building,
  User,
  Save,
  Loader2
} from 'lucide-react';

export function EditEmployeeModal({ isOpen, onClose, onUpdated, employee, masters }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    mobileNumber: '',
    reportingManager: '',
    teamLeader: '',
    dateOfJoining: '',
    department: '',
    designation: '',
    branch: '',
    location: '',
    currentAddress: '',
    city: '',
    state: '',
    pincode: '',
    permanentAddress: '',
    permanentPincode: ''
  });

  const [isCustomTl, setIsCustomTl] = useState(false);
  const [isCustomMgr, setIsCustomMgr] = useState(false);
  const [isCustomDesig, setIsCustomDesig] = useState(false);
  const [managerTeamLeaders, setManagerTeamLeaders] = useState([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlError, setTlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function loadTeamLeaders(managerVal) {
    if (!managerVal || managerVal === '__custom__') {
      setManagerTeamLeaders([]);
      return;
    }
    const mgrObj = masters?.managers?.find(
      (m) => m.full_name === managerVal || m.username === managerVal || String(m.id) === String(managerVal)
    );
    const lookupKey = mgrObj?.username || mgrObj?.id || managerVal;
    setTlLoading(true);
    setTlError('');
    try {
      const data = await api.masters.getTeamLeadersByManager(lookupKey);
      setManagerTeamLeaders(Array.isArray(data?.teamLeaders) ? data.teamLeaders : []);
    } catch (err) {
      console.error('Failed to load team leaders for manager:', err);
      setTlError('Failed to load Team Leaders for this Manager');
      setManagerTeamLeaders([]);
    } finally {
      setTlLoading(false);
    }
  }

  function handleManagerChange(managerVal) {
    if (managerVal === '__custom__') {
      setIsCustomMgr(true);
      handleChange('reportingManager', '');
      handleChange('teamLeader', '');
      setManagerTeamLeaders([]);
      return;
    }
    handleChange('reportingManager', managerVal);
    // Requirement 3: When Manager changes, immediately clear previously selected Team Leader
    handleChange('teamLeader', '');
    if (managerVal) {
      loadTeamLeaders(managerVal);
    } else {
      setManagerTeamLeaders([]);
    }
  }

  useEffect(() => {
    if (employee) {
      setFormData({
        employeeId: employee.employee_id || '',
        employeeName: employee.employee_name || '',
        mobileNumber: employee.mobile_number || '',
        reportingManager: employee.reporting_manager || '',
        teamLeader: employee.team_leader || '',
        dateOfJoining: employee.date_of_joining ? employee.date_of_joining.split('T')[0] : '',
        department: employee.department || '',
        designation: employee.designation || '',
        branch: employee.branch || '',
        location: employee.location || '',
        currentAddress: employee.hr_current_address || '',
        city: employee.hr_city || '',
        state: employee.hr_state || '',
        pincode: employee.hr_pincode || '',
        permanentAddress: employee.hr_permanent_address || '',
        permanentPincode: employee.hr_permanent_pincode || ''
      });
      setIsCustomTl(false);
      setIsCustomMgr(false);
      setErrorMsg('');
      setSuccessMsg('');
      if (employee.reporting_manager) {
        loadTeamLeaders(employee.reporting_manager);
      } else {
        setManagerTeamLeaders([]);
      }
    } else if (!isOpen) {
      setManagerTeamLeaders([]);
      setIsCustomMgr(false);
      setIsCustomTl(false);
      setTlError('');
    }
  }, [employee, isOpen]);

  if (!isOpen || !employee) return null;

  // Resolve active locations for currently selected branch
  const selectedBranchObj = masters?.branches?.find(
    (b) => b.branch_name === formData.branch || b.branch_code === formData.branch
  );
  const activeBranchLocations = selectedBranchObj
    ? (masters?.locations || []).filter(
        (l) => l.branch_id === selectedBranchObj.id && l.is_active === 1
      )
    : [];

  function handleBranchChange(newBranchName) {
    handleChange('branch', newBranchName);

    const branchObj = masters?.branches?.find(
      (b) => b.branch_name === newBranchName || b.branch_code === newBranchName
    );

    if (branchObj) {
      const eligibleLocs = (masters?.locations || []).filter(
        (l) => l.branch_id === branchObj.id && l.is_active === 1
      );
      // Requirement 8: If the branch changes, clear the previously selected location if it does not belong to the new branch and reload the correct location options.
      const stillValid = eligibleLocs.some((l) => l.location_name === formData.location);
      if (!stillValid) {
        handleChange('location', eligibleLocs.length > 0 ? eligibleLocs[0].location_name : '');
      }
    } else {
      handleChange('location', '');
    }
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (
      !formData.employeeName.trim() ||
      !formData.mobileNumber.trim() ||
      !formData.dateOfJoining ||
      !formData.department ||
      !formData.branch ||
      !formData.currentAddress.trim() ||
      !formData.city.trim() ||
      !formData.state.trim() ||
      !formData.pincode.trim()
    ) {
      soundManager.alert();
      setErrorMsg('Please fill in all mandatory employee and address fields.');
      return;
    }

    if (formData.reportingManager && formData.teamLeader && !isCustomTl) {
      const isValidTl = managerTeamLeaders.some(
        (tl) => tl.full_name === formData.teamLeader || tl.username === formData.teamLeader
      );
      if (managerTeamLeaders.length > 0 && !isValidTl) {
        soundManager.alert();
        setErrorMsg(`Validation error: Selected Team Leader '${formData.teamLeader}' does not report to Manager '${formData.reportingManager}'.`);
        return;
      }
    }

    // Branch - Location validation
    if (formData.branch && formData.location && activeBranchLocations.length > 0) {
      const isValidLoc = activeBranchLocations.some(
        (l) => l.location_name.toLowerCase().trim() === formData.location.toLowerCase().trim()
      ) || (employee && employee.location === formData.location);
      if (!isValidLoc) {
        soundManager.alert();
        setErrorMsg(`Validation error: Location '${formData.location}' does not belong to branch '${formData.branch}'.`);
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await api.employees.update(employee.employee_id, formData);
      soundManager.confirm();
      setSuccessMsg(`Employee details for ${formData.employeeName} (${employee.employee_id}) saved successfully.`);
      setTimeout(() => {
        if (onUpdated) onUpdated();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Update error:', err);
      soundManager.alert();
      setErrorMsg(err.message || 'Failed to update employee details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Pencil size={18} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Edit Employee Details
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Employee ID: <strong style={{ color: 'var(--primary)' }}>{employee.employee_id}</strong> • Status: {employee.verification_status || 'Not Started'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '18px' }}>
            {errorMsg && (
              <div style={{
                backgroundColor: 'var(--danger-light)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: 'var(--danger)',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                backgroundColor: 'var(--success-light)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: 'var(--success)',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Section 1: Identification & Personal Info */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <User size={16} color="var(--primary)" />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Personal & Contact Information
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Employee ID</span>
                    <Lock size={12} color="var(--text-muted)" title="System identifier is read-only" />
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.employeeId}
                    disabled
                    style={{
                      opacity: 0.75,
                      cursor: 'not-allowed',
                      backgroundColor: 'var(--bg-canvas)'
                    }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Full Name <span className="required">*</span>
                  </label>
                  <input
                    id="input-edit-emp-name"
                    type="text"
                    className="form-control"
                    placeholder="Full Name"
                    value={formData.employeeName}
                    onChange={(e) => handleChange('employeeName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
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

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Manager</label>
                    {masters?.managers && masters.managers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomMgr(!isCustomMgr);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--primary)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {isCustomMgr ? 'Select from list' : 'Custom'}
                      </button>
                    )}
                  </div>
                  {!isCustomMgr && masters?.managers && masters.managers.length > 0 ? (
                    <select
                      id="select-edit-emp-manager"
                      className="form-control form-select"
                      value={formData.reportingManager}
                      onChange={(e) => handleManagerChange(e.target.value)}
                    >
                      <option value="">Select Manager</option>
                      {formData.reportingManager && !masters.managers.some((m) => m.full_name === formData.reportingManager) && (
                        <option value={formData.reportingManager}>{formData.reportingManager}</option>
                      )}
                      {masters.managers.map((m) => (
                        <option key={m.id || m.full_name} value={m.full_name}>
                          {m.full_name}{m.username ? ` (${m.username})` : ''}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter custom name...</option>
                    </select>
                  ) : (
                    <input
                      id="input-edit-emp-manager"
                      type="text"
                      className="form-control"
                      placeholder="Manager Name"
                      value={formData.reportingManager}
                      onChange={(e) => handleManagerChange(e.target.value)}
                    />
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Team Leader</label>
                    <button
                      type="button"
                      disabled={!formData.reportingManager}
                      onClick={() => {
                        setIsCustomTl(!isCustomTl);
                        handleChange('teamLeader', '');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: !formData.reportingManager ? 'var(--text-muted)' : 'var(--primary)',
                        fontSize: '0.72rem',
                        cursor: !formData.reportingManager ? 'not-allowed' : 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {isCustomTl ? 'Select from list' : 'Custom'}
                    </button>
                  </div>
                  {!isCustomTl ? (
                    <select
                      id="select-edit-emp-team-leader"
                      className="form-control form-select"
                      value={formData.teamLeader}
                      disabled={!formData.reportingManager || tlLoading}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomTl(true);
                          handleChange('teamLeader', '');
                        } else {
                          handleChange('teamLeader', e.target.value);
                        }
                      }}
                    >
                      {!formData.reportingManager ? (
                        <option value="">Select Manager First</option>
                      ) : tlLoading ? (
                        <option value="">Loading Team Leaders...</option>
                      ) : managerTeamLeaders.length === 0 ? (
                        <option value="">No Team Leaders available for this Manager</option>
                      ) : (
                        <>
                          <option value="">Select Team Leader</option>
                          {formData.teamLeader && !managerTeamLeaders.some((tl) => tl.full_name === formData.teamLeader) && (
                            <option value={formData.teamLeader}>{formData.teamLeader}</option>
                          )}
                          {managerTeamLeaders.map((tl) => (
                            <option key={tl.id || tl.username} value={tl.full_name}>
                              {tl.full_name} ({tl.username})
                            </option>
                          ))}
                          <option value="__custom__">+ Enter custom name...</option>
                        </>
                      )}
                    </select>
                  ) : (
                    <input
                      id="input-edit-emp-team-leader"
                      type="text"
                      className="form-control"
                      placeholder="Team Leader Name"
                      disabled={!formData.reportingManager}
                      value={formData.teamLeader}
                      onChange={(e) => handleChange('teamLeader', e.target.value)}
                    />
                  )}
                  {tlError && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4 }}>
                      {tlError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Department, Role & Branch */}
            <div style={{ marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Building size={16} color="var(--primary)" />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Organizational Assignment
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
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

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Department <span className="required">*</span>
                  </label>
                  <select
                    className="form-control form-select"
                    value={formData.department}
                    onChange={(e) => handleChange('department', e.target.value)}
                    required
                  >
                    <option value="">Select Department</option>
                    {masters?.departments && !masters.departments.some(d => d.department_name === formData.department) && formData.department && (
                      <option value={formData.department}>{formData.department}</option>
                    )}
                    {masters?.departments?.map((d) => (
                      <option key={d.id} value={d.department_name}>{d.department_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Designation</label>
                    {masters?.designations && masters.designations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomDesig(!isCustomDesig);
                          if (!isCustomDesig) handleChange('designation', '');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--primary)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {isCustomDesig ? 'Select from list' : 'Custom'}
                      </button>
                    )}
                  </div>
                  {!isCustomDesig && masters?.designations && masters.designations.length > 0 ? (
                    <select
                      id="select-edit-emp-designation"
                      className="form-control form-select"
                      value={formData.designation}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomDesig(true);
                          handleChange('designation', '');
                        } else {
                          handleChange('designation', e.target.value);
                        }
                      }}
                    >
                      <option value="">Select Designation</option>
                      {/* Preserve existing employee designation if not present in master list */}
                      {formData.designation && !masters.designations.some(d => d.designation_name === formData.designation) && (
                        <option value={formData.designation}>{formData.designation}</option>
                      )}
                      {masters.designations.map((d) => (
                        <option key={d.id || d.designation_code} value={d.designation_name}>
                          {d.designation_name} {d.designation_code ? `(${d.designation_code})` : ''}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter custom designation...</option>
                    </select>
                  ) : (
                    <input
                      id="input-edit-emp-designation"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Field Operations Executive"
                      value={formData.designation}
                      onChange={(e) => handleChange('designation', e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Branch <span className="required">*</span>
                  </label>
                  <select
                    id="select-edit-emp-branch"
                    className="form-control form-select"
                    value={formData.branch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    required
                  >
                    <option value="">Select Branch</option>
                    {masters?.branches && !masters.branches.some(b => b.branch_name === formData.branch) && formData.branch && (
                      <option value={formData.branch}>{formData.branch}</option>
                    )}
                    {masters?.branches?.map((b) => (
                      <option key={b.id} value={b.branch_name}>
                        {b.branch_name} {b.branch_code ? `(${b.branch_code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Location / Site <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <select
                    id="select-edit-emp-location"
                    className="form-control form-select"
                    value={formData.location}
                    disabled={!formData.branch}
                    onChange={(e) => handleChange('location', e.target.value)}
                  >
                    {!formData.branch ? (
                      <option value="">Select Branch First</option>
                    ) : activeBranchLocations.length === 0 && !formData.location ? (
                      <option value="">None / Main Office (No sub-locations configured)</option>
                    ) : (
                      <>
                        <option value="">Select Location (Optional)</option>
                        {/* Preserve existing employee location if historical/deactivated */}
                        {formData.location && !activeBranchLocations.some((l) => l.location_name === formData.location) && (
                          <option value={formData.location}>{formData.location}</option>
                        )}
                        {activeBranchLocations.map((l) => (
                          <option key={l.id} value={l.location_name}>{l.location_name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: HR Registered Address */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color="var(--primary)" />
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Current Address (HR Official Record)
                  </h4>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Address changes re-enqueue automatic geolocation
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">
                  Full Current Address <span className="required">*</span>
                </label>
                <textarea
                  id="input-edit-emp-address"
                  className="form-control"
                  rows={2}
                  placeholder="Door No, Street, Building, Area, Landmark"
                  value={formData.currentAddress}
                  onChange={(e) => handleChange('currentAddress', e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    City <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    State <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Pincode <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Permanent Address (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Permanent Address if different"
                    value={formData.permanentAddress}
                    onChange={(e) => handleChange('permanentAddress', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Permanent Pincode</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 600001"
                    value={formData.permanentPincode}
                    onChange={(e) => handleChange('permanentPincode', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '14px 20px', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              id="btn-submit-edit-employee"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '130px', justifyContent: 'center' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
