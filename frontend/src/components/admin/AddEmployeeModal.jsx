import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { X, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

export function AddEmployeeModal({ isOpen, onClose, onCreated, masters }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    mobileNumber: '',
    reportingManager: '',
    teamLeader: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    department: 'Operations',
    designation: 'Executive',
    branch: 'Chennai Headquarters',
    location: '',
    currentAddress: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
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

  useEffect(() => {
    if (!isOpen) {
      setManagerTeamLeaders([]);
      setIsCustomMgr(false);
      setIsCustomTl(false);
      setIsCustomDesig(false);
      setTlError('');
    } else {
      if (masters?.designations?.length > 0 && !formData.designation) {
        handleChange('designation', masters.designations[0].designation_name);
      }
      if (formData.branch) {
        const bObj = masters?.branches?.find(
          (b) => b.branch_name === formData.branch || b.branch_code === formData.branch
        );
        if (bObj) {
          const eligibleLocs = (masters?.locations || []).filter(
            (l) => l.branch_id === bObj.id && l.is_active === 1
          );
          if (eligibleLocs.length > 0 && !eligibleLocs.some((l) => l.location_name === formData.location)) {
            handleChange('location', eligibleLocs[0].location_name);
          }
        }
      }
    }
  }, [isOpen, masters?.designations, masters?.branches, masters?.locations]);

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

      if (branchObj.city && (!formData.city || formData.city === 'Chennai')) {
        handleChange('city', branchObj.city);
      }
      if (branchObj.state && (!formData.state || formData.state === 'Tamil Nadu')) {
        handleChange('state', branchObj.state);
      }
    } else {
      handleChange('location', '');
    }
  }

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

    if (formData.reportingManager && formData.teamLeader && !isCustomTl) {
      const isValidTl = managerTeamLeaders.some(
        (tl) => tl.full_name === formData.teamLeader || tl.username === formData.teamLeader
      );
      if (managerTeamLeaders.length > 0 && !isValidTl) {
        setErrorMsg(`Validation error: Selected Team Leader '${formData.teamLeader}' does not report to Manager '${formData.reportingManager}'.`);
        return;
      }
    }

    // Branch - Location validation
    if (formData.branch && formData.location && activeBranchLocations.length > 0) {
      const isValidLoc = activeBranchLocations.some(
        (l) => l.location_name.toLowerCase().trim() === formData.location.toLowerCase().trim()
      );
      if (!isValidLoc) {
        setErrorMsg(`Validation error: Location '${formData.location}' does not belong to branch '${formData.branch}'.`);
        return;
      }
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
                  id="input-emp-mobile"
                  type="tel"
                  className="form-control"
                  placeholder="10 digit mobile"
                  value={formData.mobileNumber}
                  onChange={(e) => handleChange('mobileNumber', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Manager</label>
                  {masters?.managers && masters.managers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMgr(!isCustomMgr);
                        handleChange('reportingManager', '');
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
                    id="select-emp-manager"
                    className="form-control form-select"
                    value={formData.reportingManager}
                    onChange={(e) => handleManagerChange(e.target.value)}
                  >
                    <option value="">Select Manager</option>
                    {masters.managers.map((m) => (
                      <option key={m.id || m.full_name} value={m.full_name}>
                        {m.full_name}{m.username ? ` (${m.username})` : ''}
                      </option>
                    ))}
                    <option value="__custom__">+ Enter custom name...</option>
                  </select>
                ) : (
                  <input
                    id="input-emp-manager"
                    type="text"
                    className="form-control"
                    placeholder="Manager Name"
                    value={formData.reportingManager}
                    onChange={(e) => handleManagerChange(e.target.value)}
                  />
                )}
              </div>

              <div className="form-group">
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
                    id="select-emp-team-leader"
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
                    id="input-emp-team-leader"
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Designation</label>
                  {masters?.designations && masters.designations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomDesig(!isCustomDesig);
                        if (!isCustomDesig) handleChange('designation', '');
                        else handleChange('designation', masters.designations[0]?.designation_name || 'Executive');
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
                    id="select-emp-designation"
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
                    {masters.designations
                      .filter((d) => d.is_active === 1 || d.designation_name === formData.designation)
                      .map((d) => (
                        <option key={d.id || d.designation_code} value={d.designation_name}>
                          {d.designation_name} {d.designation_code ? `(${d.designation_code})` : ''}
                        </option>
                      ))}
                    <option value="__custom__">+ Enter custom designation...</option>
                  </select>
                ) : (
                  <input
                    id="input-emp-designation"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Field Operations Executive"
                    value={formData.designation}
                    onChange={(e) => handleChange('designation', e.target.value)}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <select
                  id="select-emp-branch"
                  className="form-control form-select"
                  value={formData.branch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                >
                  <option value="">Select Branch</option>
                  {masters?.branches?.map((b) => (
                    <option key={b.id} value={b.branch_name}>
                      {b.branch_name} {b.branch_code ? `(${b.branch_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Location <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <select
                  id="select-emp-location"
                  className="form-control form-select"
                  value={formData.location}
                  disabled={!formData.branch}
                  onChange={(e) => handleChange('location', e.target.value)}
                >
                  {!formData.branch ? (
                    <option value="">Select Branch First</option>
                  ) : activeBranchLocations.length === 0 ? (
                    <option value="">None / Main Office (No sub-locations configured)</option>
                  ) : (
                    <>
                      <option value="">Select Location (Optional)</option>
                      {activeBranchLocations.map((l) => (
                        <option key={l.id} value={l.location_name}>{l.location_name}</option>
                      ))}
                    </>
                  )}
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
