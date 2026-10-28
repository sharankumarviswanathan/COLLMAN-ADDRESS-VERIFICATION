import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import {
  Sliders,
  Building,
  Building2,
  Briefcase,
  Check,
  Save,
  Clock,
  Key,
  ShieldAlert,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
  Pencil,
  Trash2,
  Plus,
  Search,
  X,
  Power,
  AlertCircle,
  MapPin,
  Info,
  Sparkles
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

export function MastersManagement() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [masters, setMasters] = useState({
    branches: [],
    departments: [],
    designations: [],
    locations: [],
    docTypes: [],
    failureReasons: [],
    settings: {}
  });

  const [activeTab, setActiveTab] = useState('branches');
  const [searchQuery, setSearchQuery] = useState('');

  const [settingsForm, setSettingsForm] = useState({
    employee_tat_days: '3',
    bgv_tat_days: '1',
    gps_threshold_close_meters: '100',
    gps_threshold_nearby_meters: '500',
    company_name: 'Collman Services',
    google_maps_api_key: ''
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [registryMsg, setRegistryMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  // --- Branch Modal & Auto-Location State ---
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState({
    branch_code: '',
    branch_name: '',
    city: '',
    state: '',
    is_active: 1
  });
  const [branchLookupLoading, setBranchLookupLoading] = useState(false);
  const [branchLocationSuggestions, setBranchLocationSuggestions] = useState([]);
  const [branchAutoDetected, setBranchAutoDetected] = useState(null);
  const [branchLookupError, setBranchLookupError] = useState('');
  const branchLookupTimeoutRef = useRef(null);

  // --- Branch Locations State (in Branch Modal) ---
  const [branchLocations, setBranchLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [showAddLocationInput, setShowAddLocationInput] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [editingLocationName, setEditingLocationName] = useState('');
  const [locationActionError, setLocationActionError] = useState('');

  // --- Department Modal State ---
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [departmentForm, setDepartmentForm] = useState({
    department_code: '',
    department_name: '',
    is_active: 1
  });

  // --- Designation Modal State ---
  const [designationModalOpen, setDesignationModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState(null);
  const [designationForm, setDesignationForm] = useState({
    designation_code: '',
    designation_name: '',
    description: '',
    is_active: 1
  });

  // --- Delete / Deactivate Confirmation Modal ---
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    type: '', // 'branch' | 'department'
    item: null
  });

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    loadMasters();
  }, []);

  async function loadMasters() {
    setLoading(true);
    try {
      // Include inactive records so admins can view, edit, and toggle them
      const data = await api.masters.getAll({ includeInactive: true });
      setMasters(data);
      if (data.settings) {
        setSettingsForm({
          employee_tat_days: data.settings.employee_tat_days || '3',
          bgv_tat_days: data.settings.bgv_tat_days || '1',
          gps_threshold_close_meters: data.settings.gps_threshold_close_meters || '100',
          gps_threshold_nearby_meters: data.settings.gps_threshold_nearby_meters || '500',
          company_name: data.settings.company_name || 'Collman Services',
          google_maps_api_key: data.settings.google_maps_api_key || ''
        });
      }
    } catch (err) {
      console.error('Failed to load masters:', err);
    } finally {
      setLoading(false);
    }
  }

  function showRegistryAlert(text, type = 'success') {
    setRegistryMsg({ type, text });
    setTimeout(() => setRegistryMsg({ type: '', text: '' }), 4000);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    setSuccessMsg('');

    try {
      await api.masters.updateSettings(settingsForm);
      setSuccessMsg('Settings updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  // --- Branch Handlers ---
  function openCreateBranch() {
    setEditingBranch(null);
    setBranchForm({
      branch_code: '',
      branch_name: '',
      city: '',
      state: '',
      is_active: 1
    });
    setBranchLocations([]);
    setShowAddLocationInput(false);
    setNewLocationName('');
    setEditingLocationId(null);
    setEditingLocationName('');
    setLocationActionError('');
    setBranchLookupLoading(false);
    setBranchLocationSuggestions([]);
    setBranchAutoDetected(null);
    setBranchLookupError('');
    setModalError('');
    setBranchModalOpen(true);
  }

  async function openEditBranch(branch) {
    setEditingBranch(branch);
    setBranchForm({
      branch_code: branch.branch_code || '',
      branch_name: branch.branch_name || '',
      city: branch.city || '',
      state: branch.state || '',
      is_active: branch.is_active !== undefined ? branch.is_active : 1
    });
    // Populate locations belonging to this branch
    const existing = (masters.locations || []).filter((l) => l.branch_id === branch.id);
    setBranchLocations(existing);
    setShowAddLocationInput(false);
    setNewLocationName('');
    setEditingLocationId(null);
    setEditingLocationName('');
    setLocationActionError('');
    setBranchLookupLoading(false);
    setBranchLocationSuggestions([]);
    setBranchAutoDetected(null);
    setBranchLookupError('');
    setModalError('');
    setBranchModalOpen(true);

    try {
      setLocationsLoading(true);
      const res = await api.masters.getBranchLocations(branch.id);
      if (res && res.locations) {
        setBranchLocations(res.locations);
      }
    } catch (err) {
      console.warn('Failed to load branch locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }

  function handleBranchNameChange(newName) {
    setBranchForm((prev) => ({ ...prev, branch_name: newName }));
    setBranchLocationSuggestions([]);
    setBranchLookupError('');

    if (branchLookupTimeoutRef.current) {
      clearTimeout(branchLookupTimeoutRef.current);
    }

    const trimmed = (newName || '').trim();
    if (trimmed.length < 3) {
      setBranchLookupLoading(false);
      setBranchAutoDetected(null);
      return;
    }

    setBranchLookupLoading(true);
    branchLookupTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.masters.lookupLocation(trimmed);
        if (res) {
          if (res.reliableMatch) {
            // Exactly one reliable city/state match found: auto-fill City and State
            setBranchForm((prev) => ({
              ...prev,
              city: res.reliableMatch.city,
              state: res.reliableMatch.state
            }));
            setBranchAutoDetected(res.reliableMatch);
            setBranchLocationSuggestions([]);
            setBranchLookupError('');
          } else if (res.isAmbiguous && Array.isArray(res.matches) && res.matches.length > 1) {
            // Multiple locations matched: ask user to select from suggestions
            setBranchAutoDetected(null);
            setBranchLocationSuggestions(res.matches);
            setBranchLookupError('');
          } else {
            // No reliable match found: do not guess or fill incorrect locations
            setBranchAutoDetected(null);
            setBranchLocationSuggestions([]);
            if (trimmed.length >= 4) {
              setBranchLookupError('Could not automatically identify City and State. Please enter them manually.');
            }
          }
        }
      } catch (err) {
        console.warn('Branch location lookup error:', err);
      } finally {
        setBranchLookupLoading(false);
      }
    }, 350);
  }

  function handleSelectLocationSuggestion(suggestion) {
    setBranchForm((prev) => ({
      ...prev,
      city: suggestion.city,
      state: suggestion.state
    }));
    setBranchAutoDetected(suggestion);
    setBranchLocationSuggestions([]);
    setBranchLookupError('');
  }

  // --- Branch Location Actions (inside Add/Edit Branch Modal) ---
  async function handleAddLocation() {
    setLocationActionError('');
    const trimmed = (newLocationName || '').trim();
    if (!trimmed) {
      setLocationActionError('Please enter a location name.');
      return;
    }

    // Duplicate check under this branch
    const isDup = branchLocations.some(
      (l) => l.location_name.toLowerCase().trim() === trimmed.toLowerCase()
    );
    if (isDup) {
      setLocationActionError(`Location '${trimmed}' already exists under this branch.`);
      return;
    }

    if (editingBranch) {
      // Direct API call if editing existing branch
      try {
        const payload = {
          branch_id: editingBranch.id,
          location_name: trimmed,
          city: branchForm.city.trim() || editingBranch.city,
          state: branchForm.state.trim() || editingBranch.state,
          is_active: 1
        };
        const res = await api.masters.createLocation(payload);
        if (res && res.location) {
          setBranchLocations((prev) => [...prev, res.location]);
          setNewLocationName('');
          setShowAddLocationInput(false);
          await loadMasters();
        }
      } catch (err) {
        setLocationActionError(err.message || 'Failed to add location.');
      }
    } else {
      // Local state if creating a new branch
      setBranchLocations((prev) => [
        ...prev,
        {
          tempId: Date.now(),
          location_name: trimmed,
          city: branchForm.city.trim(),
          state: branchForm.state.trim(),
          is_active: 1
        }
      ]);
      setNewLocationName('');
      setShowAddLocationInput(false);
    }
  }

  async function handleSaveEditedLocation(loc) {
    setLocationActionError('');
    const trimmed = (editingLocationName || '').trim();
    if (!trimmed) {
      setLocationActionError('Location name cannot be empty.');
      return;
    }

    // Duplicate check against other items
    const locKey = loc.id || loc.tempId;
    const isDup = branchLocations.some(
      (l) => (l.id || l.tempId) !== locKey && l.location_name.toLowerCase().trim() === trimmed.toLowerCase()
    );
    if (isDup) {
      setLocationActionError(`Location '${trimmed}' already exists under this branch.`);
      return;
    }

    if (loc.id) {
      try {
        const res = await api.masters.updateLocation(loc.id, {
          location_name: trimmed
        });
        if (res && res.location) {
          setBranchLocations((prev) =>
            prev.map((l) => (l.id === loc.id ? { ...l, location_name: trimmed } : l))
          );
          setEditingLocationId(null);
          setEditingLocationName('');
          await loadMasters();
        }
      } catch (err) {
        setLocationActionError(err.message || 'Failed to update location.');
      }
    } else {
      setBranchLocations((prev) =>
        prev.map((l) => (l.tempId === loc.tempId ? { ...l, location_name: trimmed } : l))
      );
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  }

  async function handleToggleLocationStatus(loc) {
    if (loc.id) {
      try {
        const newStatus = loc.is_active === 1 ? 0 : 1;
        const res = await api.masters.updateLocation(loc.id, {
          is_active: newStatus
        });
        if (res && res.location) {
          setBranchLocations((prev) =>
            prev.map((l) => (l.id === loc.id ? { ...l, is_active: newStatus } : l))
          );
          await loadMasters();
        }
      } catch (err) {
        setLocationActionError(err.message || 'Failed to update location status.');
      }
    } else {
      setBranchLocations((prev) =>
        prev.map((l) =>
          l.tempId === loc.tempId ? { ...l, is_active: l.is_active === 1 ? 0 : 1 } : l
        )
      );
    }
  }

  async function handleRemoveLocation(loc) {
    setLocationActionError('');
    if (!loc.id) {
      // Unsourced temp location: remove immediately from list
      setBranchLocations((prev) => prev.filter((l) => l.tempId !== loc.tempId));
      return;
    }

    if (!window.confirm(`Are you sure you want to remove location '${loc.location_name}' from this branch?`)) {
      return;
    }

    try {
      const res = await api.masters.deleteLocation(loc.id);
      // Immediately remove the location from the branch's list so it can have 0 locations
      setBranchLocations((prev) => prev.filter((l) => l.id !== loc.id));
      showRegistryAlert(res.message || `Location '${loc.location_name}' removed.`);
      await loadMasters();
    } catch (err) {
      setLocationActionError(err.message || 'Failed to remove location.');
    }
  }

  async function handleSaveBranch(e) {
    e.preventDefault();
    setModalError('');

    if (!branchForm.branch_code.trim()) {
      setModalError('Branch code is required.');
      return;
    }
    if (!branchForm.branch_name.trim()) {
      setModalError('Branch name is required.');
      return;
    }
    if (!branchForm.city.trim() || !branchForm.state.trim()) {
      setModalError('City and State are required.');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        branch_code: branchForm.branch_code.trim().toUpperCase(),
        branch_name: branchForm.branch_name.trim(),
        city: branchForm.city.trim(),
        state: branchForm.state.trim(),
        is_active: Number(branchForm.is_active) === 1 ? 1 : 0,
        locations: branchLocations
      };

      if (editingBranch) {
        await api.masters.updateBranch(editingBranch.id, payload);
        showRegistryAlert(`Branch '${payload.branch_name}' updated successfully.`);
      } else {
        await api.masters.createBranch(payload);
        showRegistryAlert(
          branchLocations.length > 0
            ? `Branch '${payload.branch_name}' created successfully with ${branchLocations.length} locations.`
            : `Branch '${payload.branch_name}' created successfully.`
        );
      }

      setBranchModalOpen(false);
      await loadMasters();
    } catch (err) {
      console.error('Save branch error:', err);
      setModalError(err.message || 'Failed to save branch.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleQuickToggleBranchStatus(branch) {
    try {
      const newStatus = branch.is_active ? 0 : 1;
      await api.masters.updateBranch(branch.id, {
        branch_code: branch.branch_code,
        branch_name: branch.branch_name,
        city: branch.city,
        state: branch.state,
        is_active: newStatus
      });
      showRegistryAlert(
        `Branch '${branch.branch_name}' marked as ${newStatus ? 'Active' : 'Inactive'}.`
      );
      await loadMasters();
    } catch (err) {
      alert(err.message || 'Failed to update branch status.');
    }
  }

  // --- Department Handlers ---
  function openCreateDepartment() {
    setEditingDepartment(null);
    setDepartmentForm({
      department_code: '',
      department_name: '',
      is_active: 1
    });
    setModalError('');
    setDepartmentModalOpen(true);
  }

  function openEditDepartment(dept) {
    setEditingDepartment(dept);
    setDepartmentForm({
      department_code: dept.department_code || '',
      department_name: dept.department_name || dept.name || '',
      is_active: dept.is_active !== undefined ? dept.is_active : 1
    });
    setModalError('');
    setDepartmentModalOpen(true);
  }

  async function handleSaveDepartment(e) {
    e.preventDefault();
    setModalError('');

    if (!departmentForm.department_code.trim()) {
      setModalError('Department code is required.');
      return;
    }
    if (!departmentForm.department_name.trim()) {
      setModalError('Department name is required.');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        department_code: departmentForm.department_code.trim().toUpperCase(),
        department_name: departmentForm.department_name.trim(),
        is_active: Number(departmentForm.is_active) === 1 ? 1 : 0
      };

      if (editingDepartment) {
        await api.masters.updateDepartment(editingDepartment.id, payload);
        showRegistryAlert(`Department '${payload.department_name}' updated successfully.`);
      } else {
        await api.masters.createDepartment(payload);
        showRegistryAlert(`Department '${payload.department_name}' created successfully.`);
      }

      setDepartmentModalOpen(false);
      await loadMasters();
    } catch (err) {
      console.error('Save department error:', err);
      setModalError(err.message || 'Failed to save department.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleQuickToggleDeptStatus(dept) {
    try {
      const newStatus = dept.is_active ? 0 : 1;
      await api.masters.updateDepartment(dept.id, {
        department_code: dept.department_code,
        department_name: dept.department_name,
        is_active: newStatus
      });
      showRegistryAlert(
        `Department '${dept.department_name}' marked as ${newStatus ? 'Active' : 'Inactive'}.`
      );
      await loadMasters();
    } catch (err) {
      alert(err.message || 'Failed to update department status.');
    }
  }

  // --- Designation Handlers ---
  function openCreateDesignation() {
    setEditingDesignation(null);
    setDesignationForm({
      designation_code: '',
      designation_name: '',
      description: '',
      is_active: 1
    });
    setModalError('');
    setDesignationModalOpen(true);
  }

  function openEditDesignation(desig) {
    setEditingDesignation(desig);
    setDesignationForm({
      designation_code: desig.designation_code || '',
      designation_name: desig.designation_name || '',
      description: desig.description || '',
      is_active: desig.is_active !== undefined ? desig.is_active : 1
    });
    setModalError('');
    setDesignationModalOpen(true);
  }

  async function handleSaveDesignation(e) {
    e.preventDefault();
    setModalError('');

    if (!designationForm.designation_code.trim()) {
      setModalError('Designation code is required.');
      return;
    }
    if (!designationForm.designation_name.trim()) {
      setModalError('Designation name is required.');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        designation_code: designationForm.designation_code.trim().toUpperCase(),
        designation_name: designationForm.designation_name.trim(),
        description: designationForm.description.trim(),
        is_active: Number(designationForm.is_active) === 1 ? 1 : 0
      };

      if (editingDesignation) {
        await api.masters.updateDesignation(editingDesignation.id, payload);
        showRegistryAlert(`Designation '${payload.designation_name}' updated successfully.`);
      } else {
        await api.masters.createDesignation(payload);
        showRegistryAlert(`Designation '${payload.designation_name}' created successfully.`);
      }

      setDesignationModalOpen(false);
      await loadMasters();
    } catch (err) {
      console.error('Save designation error:', err);
      setModalError(err.message || 'Failed to save designation.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleQuickToggleDesignationStatus(desig) {
    try {
      const newStatus = desig.is_active ? 0 : 1;
      await api.masters.updateDesignation(desig.id, {
        designation_code: desig.designation_code,
        designation_name: desig.designation_name,
        description: desig.description,
        is_active: newStatus
      });
      showRegistryAlert(
        `Designation '${desig.designation_name}' marked as ${newStatus ? 'Active' : 'Inactive'}.`
      );
      await loadMasters();
    } catch (err) {
      alert(err.message || 'Failed to update designation status.');
    }
  }

  // --- Delete Confirmation Handlers ---
  function openDeleteConfirm(type, item) {
    setDeleteConfirmModal({
      isOpen: true,
      type,
      item
    });
    setModalError('');
  }

  async function handleConfirmDelete() {
    const { type, item } = deleteConfirmModal;
    if (!item) return;

    setModalLoading(true);
    try {
      if (type === 'branch') {
        const res = await api.masters.deleteBranch(item.id);
        showRegistryAlert(res.message || `Branch '${item.branch_name}' processed successfully.`);
      } else if (type === 'department') {
        const res = await api.masters.deleteDepartment(item.id);
        showRegistryAlert(res.message || `Department '${item.department_name}' processed successfully.`);
      } else if (type === 'designation') {
        const res = await api.masters.deleteDesignation(item.id);
        showRegistryAlert(res.message || `Designation '${item.designation_name}' processed successfully.`);
      }
      setDeleteConfirmModal({ isOpen: false, type: '', item: null });
      await loadMasters();
    } catch (err) {
      console.error('Delete error:', err);
      setModalError(err.message || 'Failed to delete entity.');
    } finally {
      setModalLoading(false);
    }
  }

  // Filtered entities for current tab
  const q = (searchQuery || '').toLowerCase().trim();

  const filteredBranches = (masters.branches || []).filter((b) => {
    if (!q) return true;
    return (
      (b.branch_name || '').toLowerCase().includes(q) ||
      (b.branch_code || '').toLowerCase().includes(q) ||
      (b.city || '').toLowerCase().includes(q) ||
      (b.state || '').toLowerCase().includes(q)
    );
  });

  const filteredDepartments = (masters.departments || []).filter((d) => {
    if (!q) return true;
    return (
      (d.department_name || d.name || '').toLowerCase().includes(q) ||
      (d.department_code || '').toLowerCase().includes(q)
    );
  });

  const filteredDesignations = (masters.designations || []).filter((d) => {
    if (!q) return true;
    return (
      (d.designation_name || '').toLowerCase().includes(q) ||
      (d.designation_code || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q)
    );
  });

  const filteredDocTypes = (masters.docTypes || []).filter((dt) => {
    if (!q) return true;
    return (dt.type_name || dt.document_name || '').toLowerCase().includes(q);
  });

  const filteredFailureReasons = (masters.failureReasons || []).filter((fr) => {
    if (!q) return true;
    return (fr.reason_title || fr.reason_description || fr.reason_text || '').toLowerCase().includes(q);
  });

  return (
    <div className="admin-content">
      {/* Header */}
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
            <Sliders size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                margin: 0,
                fontFamily: 'var(--font-heading)'
              }}>
                Masters & System Settings
              </h1>
              <span className="badge badge-secondary">
                Configuration Portal
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
              Configure organizational branches, departments, TAT SLA thresholds, and verification failure rules
            </p>
          </div>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadMasters} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '24px' }}>
        {/* TAT & Threshold Settings Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(216, 180, 254, 0.3)'
            }}>
              <Clock size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                TAT & Geofence SLA Rules
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Automated turnaround thresholds and proximity boundaries
              </p>
            </div>
          </div>

          {successMsg && (
            <div style={{
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#34D399',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  Employee TAT (Days)
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.employee_tat_days}
                  onChange={(e) => setSettingsForm({ ...settingsForm, employee_tat_days: e.target.value })}
                  min="1"
                  max="30"
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  BGV Reviewer TAT (Days)
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.bgv_tat_days}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bgv_tat_days: e.target.value })}
                  min="1"
                  max="14"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  GPS Exact Match (Meters)
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.gps_threshold_close_meters}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gps_threshold_close_meters: e.target.value })}
                  min="10"
                  max="500"
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Green auto-verification</span>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  GPS Nearby Boundary (Meters)
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.gps_threshold_nearby_meters}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gps_threshold_nearby_meters: e.target.value })}
                  min="100"
                  max="5000"
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Yellow boundary range</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                Legal Enterprise / Organization Name
              </label>
              <input
                type="text"
                className="form-control"
                value={settingsForm.company_name}
                onChange={(e) => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={13} color="#C084FC" />
                <span>Google Maps / Geocoding API Key</span>
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="AIzaSy... (Leave empty to use OpenStreetMap)"
                value={settingsForm.google_maps_api_key}
                onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_api_key: e.target.value })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Powers rooftop-level geocoding precision for Indian residential addresses
              </span>
            </div>

            {hasPermission('manage_masters') && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingSettings}>
                <Save size={16} />
                <span>{savingSettings ? 'Saving Settings...' : 'Save Configuration'}</span>
              </button>
            )}
          </form>
        </div>

        {/* Master Entity Registry Overview */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(216, 180, 254, 0.3)'
              }}>
                <Layers size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Master Entity Registry
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Pre-configured enterprise reference data
                </p>
              </div>
            </div>
          </div>

          {registryMsg.text && (
            <div style={{
              backgroundColor: registryMsg.type === 'error' ? 'rgba(248, 113, 113, 0.14)' : 'rgba(52, 211, 153, 0.12)',
              border: registryMsg.type === 'error' ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: registryMsg.type === 'error' ? '#F87171' : '#34D399',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              {registryMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{registryMsg.text}</span>
            </div>
          )}

          {/* Segmented Entity Tabs */}
          <div style={{
            display: 'flex',
            gap: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: '16px',
            overflowX: 'auto'
          }}>
            <button
              id="tab-branches"
              type="button"
              className={`btn btn-sm ${activeTab === 'branches' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('branches')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Branches ({masters.branches?.length || 0})
            </button>
            <button
              id="tab-departments"
              type="button"
              className={`btn btn-sm ${activeTab === 'departments' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('departments')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Departments ({masters.departments?.length || 0})
            </button>
            <button
              id="tab-designations"
              type="button"
              className={`btn btn-sm ${activeTab === 'designations' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('designations')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Designations ({masters.designations?.length || 0})
            </button>
            <button
              id="tab-doctypes"
              type="button"
              className={`btn btn-sm ${activeTab === 'docTypes' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('docTypes')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Doc Types ({masters.docTypes?.length || 0})
            </button>
            <button
              id="tab-failure-reasons"
              type="button"
              className={`btn btn-sm ${activeTab === 'failureReasons' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('failureReasons')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Failure Reasons ({masters.failureReasons?.length || 0})
            </button>
          </div>

          {/* Action Row: Search & Add Entity Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '14px'
          }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-control"
                placeholder={
                  activeTab === 'branches'
                    ? 'Search branches by name, city, state, code...'
                    : activeTab === 'departments'
                    ? 'Search departments by name or code...'
                    : activeTab === 'designations'
                    ? 'Search designations by name, code, or description...'
                    : 'Search entity items...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: '34px',
                  paddingLeft: '32px',
                  paddingRight: searchQuery ? '28px' : '10px',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {hasPermission('manage_masters') && activeTab === 'branches' && (
              <button
                id="btn-add-branch"
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openCreateBranch}
                style={{ fontSize: '0.78rem', padding: '6px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Add Branch</span>
              </button>
            )}

            {hasPermission('manage_masters') && activeTab === 'departments' && (
              <button
                id="btn-add-department"
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openCreateDepartment}
                style={{ fontSize: '0.78rem', padding: '6px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Add Department</span>
              </button>
            )}

            {hasPermission('manage_masters') && activeTab === 'designations' && (
              <button
                id="btn-add-designation"
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openCreateDesignation}
                style={{ fontSize: '0.78rem', padding: '6px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Add Designation</span>
              </button>
            )}
          </div>

          {/* Active Tab Content */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flex: 1,
            maxHeight: '440px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {/* BRANCHES TAB */}
            {activeTab === 'branches' && (
              filteredBranches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  {searchQuery ? `No branches match "${searchQuery}".` : 'No branches recorded.'}
                </div>
              ) : (
                filteredBranches.map((b) => (
                  <div
                    key={b.id || b.branch_code}
                    className="branch-registry-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: b.is_active === 0 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: b.is_active === 0 ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
                      opacity: b.is_active === 0 ? 0.72 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Building size={18} color={b.is_active === 0 ? '#94A3B8' : '#C084FC'} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                            {b.branch_name}
                          </span>
                          {b.is_active === 0 && (
                            <span style={{
                              fontSize: '0.68rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-muted)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              fontWeight: 600
                            }}>
                              Inactive
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {b.city}, {b.state}
                        </div>
                        {(() => {
                          const bLocs = (masters.locations || []).filter((l) => l.branch_id === b.id);
                          if (bLocs.length === 0) return null;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <MapPin size={11} color="#C084FC" />
                                {bLocs.length} {bLocs.length === 1 ? 'Location' : 'Locations'}:
                              </span>
                              {bLocs.slice(0, 4).map((loc) => (
                                <span
                                  key={loc.id}
                                  style={{
                                    fontSize: '0.68rem',
                                    backgroundColor: loc.is_active === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(192, 132, 252, 0.1)',
                                    color: loc.is_active === 0 ? 'var(--text-muted)' : '#E9D5FF',
                                    border: loc.is_active === 0 ? '1px dashed rgba(255,255,255,0.1)' : '1px solid rgba(192, 132, 252, 0.25)',
                                    borderRadius: '4px',
                                    padding: '1px 6px'
                                  }}
                                >
                                  {loc.location_name}
                                </span>
                              ))}
                              {bLocs.length > 4 && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>+{bLocs.length - 4} more</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className="id-chip" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                        {b.branch_code}
                      </span>

                      {/* Edit Button */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title={`Edit ${b.branch_name}`}
                        onClick={() => openEditBranch(b)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: '#C084FC',
                          border: '1px solid rgba(192, 132, 252, 0.2)'
                        }}
                      >
                        <Pencil size={13} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>Edit</span>
                      </button>

                      {/* Quick Status / Delete Toggle */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title={b.is_active ? `Deactivate or delete ${b.branch_name}` : `Activate ${b.branch_name}`}
                        onClick={() => b.is_active ? openDeleteConfirm('branch', b) : handleQuickToggleBranchStatus(b)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: b.is_active ? '#F87171' : '#34D399',
                          border: b.is_active ? '1px solid rgba(248, 113, 113, 0.2)' : '1px solid rgba(52, 211, 153, 0.2)'
                        }}
                      >
                        {b.is_active ? <Trash2 size={13} /> : <Power size={13} />}
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* DEPARTMENTS TAB */}
            {activeTab === 'departments' && (
              filteredDepartments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  {searchQuery ? `No departments match "${searchQuery}".` : 'No departments recorded.'}
                </div>
              ) : (
                filteredDepartments.map((d, idx) => (
                  <div
                    key={d.id || idx}
                    className="department-registry-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: d.is_active === 0 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: d.is_active === 0 ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
                      opacity: d.is_active === 0 ? 0.72 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Building2 size={18} color={d.is_active === 0 ? '#94A3B8' : '#C084FC'} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                            {d.department_name || d.name}
                          </span>
                          {d.is_active === 0 && (
                            <span style={{
                              fontSize: '0.68rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-muted)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              fontWeight: 600
                            }}>
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {d.department_code && (
                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                          {d.department_code}
                        </span>
                      )}

                      {/* Edit Button */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title={`Edit ${d.department_name || d.name}`}
                        onClick={() => openEditDepartment(d)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: '#C084FC',
                          border: '1px solid rgba(192, 132, 252, 0.2)'
                        }}
                      >
                        <Pencil size={13} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>Edit</span>
                      </button>

                      {/* Quick Status / Delete Toggle */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title={d.is_active ? `Deactivate or delete ${d.department_name}` : `Activate ${d.department_name}`}
                        onClick={() => d.is_active ? openDeleteConfirm('department', d) : handleQuickToggleDeptStatus(d)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: d.is_active ? '#F87171' : '#34D399',
                          border: d.is_active ? '1px solid rgba(248, 113, 113, 0.2)' : '1px solid rgba(52, 211, 153, 0.2)'
                        }}
                      >
                        {d.is_active ? <Trash2 size={13} /> : <Power size={13} />}
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* DESIGNATIONS TAB */}
            {activeTab === 'designations' && (
              filteredDesignations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  {searchQuery ? `No designations match "${searchQuery}".` : 'No designations recorded.'}
                </div>
              ) : (
                filteredDesignations.map((d, idx) => (
                  <div
                    key={d.id || idx}
                    className="designation-registry-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: d.is_active === 0 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: d.is_active === 0 ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
                      opacity: d.is_active === 0 ? 0.72 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Briefcase size={18} color={d.is_active === 0 ? '#94A3B8' : '#C084FC'} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                            {d.designation_name}
                          </span>
                          {d.is_active === 0 && (
                            <span style={{
                              fontSize: '0.68rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-muted)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              fontWeight: 600
                            }}>
                              Inactive
                            </span>
                          )}
                        </div>
                        {d.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {d.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {d.designation_code && (
                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                          {d.designation_code}
                        </span>
                      )}

                      {/* Edit Button */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title={`Edit ${d.designation_name}`}
                        onClick={() => openEditDesignation(d)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: '#C084FC',
                          border: '1px solid rgba(192, 132, 252, 0.2)'
                        }}
                      >
                        <Pencil size={13} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>Edit</span>
                      </button>

                      {/* Quick Status / Delete Toggle */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title={d.is_active ? `Deactivate or delete ${d.designation_name}` : `Activate ${d.designation_name}`}
                        onClick={() => d.is_active ? openDeleteConfirm('designation', d) : handleQuickToggleDesignationStatus(d)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: d.is_active ? '#F87171' : '#34D399',
                          border: d.is_active ? '1px solid rgba(248, 113, 113, 0.2)' : '1px solid rgba(52, 211, 153, 0.2)'
                        }}
                      >
                        {d.is_active ? <Trash2 size={13} /> : <Power size={13} />}
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* DOC TYPES TAB */}
            {activeTab === 'docTypes' && (
              filteredDocTypes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>No document types recorded.</div>
              ) : (
                filteredDocTypes.map((dt, idx) => (
                  <div
                    key={dt.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileCheck size={18} color="#34D399" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                          {dt.type_name || dt.document_name || dt.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Allowed: PDF, JPG, PNG {dt.max_size_mb ? `(Max ${dt.max_size_mb} MB)` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-success">Accepted Proof</span>
                  </div>
                ))
              )
            )}

            {/* FAILURE REASONS TAB */}
            {activeTab === 'failureReasons' && (
              filteredFailureReasons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>No failure reasons configured.</div>
              ) : (
                filteredFailureReasons.map((fr, idx) => (
                  <div
                    key={fr.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(248, 113, 113, 0.12)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(248, 113, 113, 0.3)'
                    }}
                  >
                    <ShieldAlert size={18} color="#F87171" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.85rem', color: '#FCA5A5', fontWeight: 500 }}>
                      {fr.reason_title || fr.reason_description || fr.reason_text || fr.name}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BRANCH MODAL (CREATE & UPDATE)                           */}
      {/* ======================================================== */}
      {branchModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setBranchModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(192, 132, 252, 0.15)',
                  color: '#C084FC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Building size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                    {editingBranch ? `Edit Branch: ${editingBranch.branch_name}` : 'Add New Enterprise Branch'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {editingBranch ? 'Update branch details and enterprise reference code' : 'Register a new official corporate branch office'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !modalLoading && setBranchModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                disabled={modalLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBranch}>
              <div className="modal-body">
                {modalError && (
                  <div style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#F87171',
                    fontSize: '0.85rem',
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      Branch Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BLR-TP"
                      value={branchForm.branch_code}
                      onChange={(e) => setBranchForm({ ...branchForm, branch_code: e.target.value.toUpperCase() })}
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                      required
                      autoFocus
                    />
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', margin: 0 }}>
                        Branch Full Name *
                      </label>
                      {branchLookupLoading && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent, #7C3AED)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                          <span className="spinner-border spinner-border-sm" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }} />
                          Detecting location...
                        </span>
                      )}
                    </div>
                    <input
                      id="input-branch-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Bangalore Tech Park"
                      value={branchForm.branch_name}
                      onChange={(e) => handleBranchNameChange(e.target.value)}
                      required
                      autoComplete="off"
                    />

                    {/* Ambiguous Location Suggestion Dropdown */}
                    {branchLocationSuggestions.length > 1 && (
                      <div
                        id="location-suggestions-container"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 60,
                          marginTop: '4px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid #F59E0B',
                          borderRadius: 'var(--radius-md, 8px)',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          padding: '6px',
                          maxHeight: '220px',
                          overflowY: 'auto'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 6px 6px 6px',
                          borderBottom: '1px solid var(--border-color, #E2E8F0)',
                          fontSize: '0.74rem',
                          color: '#D97706',
                          fontWeight: 600
                        }}>
                          <MapPin size={13} />
                          <span>Multiple matching locations found. Please select:</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                          {branchLocationSuggestions.map((sug, idx) => (
                            <button
                              key={`${sug.city}-${sug.state}-${idx}`}
                              type="button"
                              onClick={() => handleSelectLocationSuggestion(sug)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 8px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(124, 58, 237, 0.08))')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                <MapPin size={12} color="var(--accent, #7C3AED)" />
                                <span>{sug.city}, {sug.state}</span>
                              </div>
                              {sug.displayName && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {sug.displayName}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reliable Auto-Identified Location Banner */}
                {branchAutoDetected && (
                  <div
                    id="location-detected-banner"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '6px 10px',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.76rem',
                      color: '#059669'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} color="#10B981" />
                      <span>
                        Auto-identified location: <strong>{branchAutoDetected.city}, {branchAutoDetected.state}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Editable manually below</span>
                  </div>
                )}

                {/* Subtle Information Note if No Location Matches */}
                {branchLookupError && (
                  <div
                    id="location-lookup-error-note"
                    style={{
                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '6px 10px',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.74rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <Info size={13} />
                    <span>{branchLookupError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      City *
                    </label>
                    <input
                      id="input-branch-city"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Bangalore"
                      value={branchForm.city}
                      onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      State *
                    </label>
                    <input
                      id="input-branch-state"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Karnataka"
                      value={branchForm.state}
                      onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Status
                  </label>
                  <select
                    className="form-control form-select"
                    value={branchForm.is_active}
                    onChange={(e) => setBranchForm({ ...branchForm, is_active: Number(e.target.value) })}
                  >
                    <option value={1}>Active (Available in dropdowns and filter selectors)</option>
                    <option value={0}>Inactive (Hidden from employee creation and filters)</option>
                  </select>
                </div>

                {editingBranch && (
                  <div style={{
                    backgroundColor: 'rgba(192, 132, 252, 0.08)',
                    border: '1px solid rgba(192, 132, 252, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    color: '#E9D5FF',
                    lineHeight: 1.4
                  }}>
                    💡 <strong>Cascading Synchronization:</strong> Renaming this branch will automatically update all existing employee and user assignment records.
                  </div>
                )}

                {/* DEDICATED LOCATIONS SECTION */}
                <div style={{
                  marginTop: '18px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={16} color="#C084FC" />
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Locations ({branchLocations.length})
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        (Optional)
                      </span>
                      {locationsLoading && (
                        <span className="spinner-border spinner-border-sm" style={{ width: '12px', height: '12px', borderWidth: '1.5px', color: '#C084FC' }} />
                      )}
                    </div>

                    {!showAddLocationInput && (
                      <button
                        id="btn-add-location"
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setShowAddLocationInput(true);
                          setLocationActionError('');
                          setEditingLocationId(null);
                        }}
                        style={{
                          fontSize: '0.74rem',
                          padding: '4px 10px',
                          color: '#C084FC',
                          border: '1px solid rgba(192, 132, 252, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Plus size={14} />
                        <span>Add Location (+)</span>
                      </button>
                    )}
                  </div>

                  {/* Add Location Form / Input */}
                  {showAddLocationInput && (
                    <div style={{
                      backgroundColor: 'rgba(192, 132, 252, 0.06)',
                      border: '1px solid rgba(192, 132, 252, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      marginBottom: '12px'
                    }}>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        Location Name * (e.g. Bangalore Central, Whitefield, Electronic City)
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          id="input-new-location-name"
                          type="text"
                          className="form-control"
                          placeholder="e.g. Whitefield"
                          value={newLocationName}
                          onChange={(e) => {
                            setNewLocationName(e.target.value);
                            setLocationActionError('');
                          }}
                          style={{ fontSize: '0.82rem', height: '34px', flex: 1 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddLocation();
                            }
                          }}
                        />
                        <button
                          id="btn-confirm-add-location"
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleAddLocation}
                          style={{ fontSize: '0.75rem', height: '34px', padding: '0 12px', whiteSpace: 'nowrap' }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowAddLocationInput(false);
                            setNewLocationName('');
                            setLocationActionError('');
                          }}
                          style={{ fontSize: '0.75rem', height: '34px', padding: '0 10px' }}
                        >
                          Cancel
                        </button>
                      </div>
                      {locationActionError && (
                        <div style={{ fontSize: '0.72rem', color: '#F87171', marginTop: '6px' }}>
                          {locationActionError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Locations List */}
                  {branchLocations.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '16px',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed rgba(255, 255, 255, 0.08)'
                    }}>
                      No locations configured for this branch (Locations are optional). Click <strong>Add Location (+)</strong> if you wish to add sub-locations.
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '190px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {branchLocations.map((loc) => {
                        const locKey = loc.id || loc.tempId;
                        const isEditingThis = editingLocationId === locKey;

                        if (isEditingThis) {
                          return (
                            <div
                              key={locKey}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                backgroundColor: 'rgba(192, 132, 252, 0.08)',
                                border: '1px solid rgba(192, 132, 252, 0.3)',
                                borderRadius: 'var(--radius-sm)'
                              }}
                            >
                              <input
                                type="text"
                                className="form-control"
                                value={editingLocationName}
                                onChange={(e) => setEditingLocationName(e.target.value)}
                                style={{ height: '30px', fontSize: '0.8rem', flex: 1 }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditedLocation(loc);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSaveEditedLocation(loc)}
                                style={{ height: '30px', fontSize: '0.72rem', padding: '0 8px' }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingLocationId(null);
                                  setEditingLocationName('');
                                }}
                                style={{ height: '30px', fontSize: '0.72rem', padding: '0 8px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={locKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              backgroundColor: loc.is_active === 0 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.03)',
                              borderRadius: 'var(--radius-sm)',
                              border: loc.is_active === 0 ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
                              opacity: loc.is_active === 0 ? 0.7 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <MapPin size={13} color={loc.is_active === 0 ? '#94A3B8' : '#C084FC'} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {loc.location_name}
                              </span>
                              {loc.is_active === 0 && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  color: 'var(--text-muted)',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase'
                                }}>
                                  Inactive
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {/* Edit Action */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title={`Edit ${loc.location_name}`}
                                onClick={() => {
                                  setEditingLocationId(locKey);
                                  setEditingLocationName(loc.location_name);
                                  setShowAddLocationInput(false);
                                  setLocationActionError('');
                                }}
                                style={{
                                  padding: '4px 6px',
                                  color: '#C084FC',
                                  border: '1px solid rgba(192, 132, 252, 0.2)',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Pencil size={11} />
                                <span>Edit</span>
                              </button>

                              {/* Toggle Active / Inactive */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title={loc.is_active ? 'Deactivate location' : 'Activate location'}
                                onClick={() => handleToggleLocationStatus(loc)}
                                style={{
                                  padding: '4px 6px',
                                  color: loc.is_active ? '#34D399' : '#94A3B8',
                                  border: loc.is_active ? '1px solid rgba(52, 211, 153, 0.2)' : '1px solid rgba(148, 163, 184, 0.2)',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem'
                                }}
                              >
                                <Power size={11} />
                              </button>

                              {/* Remove Action */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title={`Remove ${loc.location_name}`}
                                onClick={() => handleRemoveLocation(loc)}
                                style={{
                                  padding: '4px 6px',
                                  color: '#F87171',
                                  border: '1px solid rgba(248, 113, 113, 0.2)',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Trash2 size={11} />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBranchModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-branch-modal"
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {modalLoading && <RefreshCw size={15} className="animate-spin" />}
                  <span>{modalLoading ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DEPARTMENT MODAL (CREATE & UPDATE)                       */}
      {/* ======================================================== */}
      {departmentModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setDepartmentModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(192, 132, 252, 0.15)',
                  color: '#C084FC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                    {editingDepartment ? `Edit Department: ${editingDepartment.department_name}` : 'Add New Department'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {editingDepartment ? 'Update department code and organizational division name' : 'Register a new functional organizational department'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !modalLoading && setDepartmentModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                disabled={modalLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment}>
              <div className="modal-body">
                {modalError && (
                  <div style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#F87171',
                    fontSize: '0.85rem',
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      Dept Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. OPS"
                      value={departmentForm.department_code}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, department_code: e.target.value.toUpperCase() })}
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      Department Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Operations"
                      value={departmentForm.department_name}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, department_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Status
                  </label>
                  <select
                    className="form-control form-select"
                    value={departmentForm.is_active}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, is_active: Number(e.target.value) })}
                  >
                    <option value={1}>Active (Available in dropdowns and filter selectors)</option>
                    <option value={0}>Inactive (Hidden from employee creation and filters)</option>
                  </select>
                </div>

                {editingDepartment && (
                  <div style={{
                    backgroundColor: 'rgba(192, 132, 252, 0.08)',
                    border: '1px solid rgba(192, 132, 252, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    color: '#E9D5FF',
                    lineHeight: 1.4
                  }}>
                    💡 <strong>Cascading Synchronization:</strong> Renaming this department will automatically update all existing employee and user assignment records.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDepartmentModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-department-modal"
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {modalLoading && <RefreshCw size={15} className="animate-spin" />}
                  <span>{modalLoading ? 'Saving...' : editingDepartment ? 'Update Department' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DESIGNATION MODAL (CREATE & UPDATE)                      */}
      {/* ======================================================== */}
      {designationModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setDesignationModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(192, 132, 252, 0.15)',
                  color: '#C084FC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Briefcase size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                    {editingDesignation ? `Edit Designation: ${editingDesignation.designation_name}` : 'Add New Designation'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {editingDesignation ? 'Update designation code, title, and corporate description' : 'Register a new employee job designation in corporate registry'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !modalLoading && setDesignationModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                disabled={modalLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDesignation}>
              <div className="modal-body">
                {modalError && (
                  <div style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#F87171',
                    fontSize: '0.85rem',
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      Code *
                    </label>
                    <input
                      id="input-designation-code"
                      type="text"
                      className="form-control"
                      placeholder="e.g. FOE"
                      value={designationForm.designation_code}
                      onChange={(e) => setDesignationForm({ ...designationForm, designation_code: e.target.value.toUpperCase() })}
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 600 }}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>
                      Designation Name *
                    </label>
                    <input
                      id="input-designation-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Field Operations Executive"
                      value={designationForm.designation_name}
                      onChange={(e) => setDesignationForm({ ...designationForm, designation_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Description
                  </label>
                  <input
                    id="input-designation-description"
                    type="text"
                    className="form-control"
                    placeholder="e.g. On-ground field verification & operations"
                    value={designationForm.description}
                    onChange={(e) => setDesignationForm({ ...designationForm, description: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Status
                  </label>
                  <select
                    id="select-designation-status"
                    className="form-control form-select"
                    value={designationForm.is_active}
                    onChange={(e) => setDesignationForm({ ...designationForm, is_active: Number(e.target.value) })}
                  >
                    <option value={1}>Active (Available in employee dropdowns and forms)</option>
                    <option value={0}>Inactive (Hidden from new employee creation)</option>
                  </select>
                </div>

                {editingDesignation && (
                  <div style={{
                    backgroundColor: 'rgba(192, 132, 252, 0.08)',
                    border: '1px solid rgba(192, 132, 252, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    color: '#E9D5FF',
                    lineHeight: 1.4
                  }}>
                    💡 <strong>Cascading Synchronization:</strong> Renaming this designation will automatically update all existing employee assignment records.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDesignationModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-designation-modal"
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {modalLoading && <RefreshCw size={15} className="animate-spin" />}
                  <span>{modalLoading ? 'Saving...' : editingDesignation ? 'Update Designation' : 'Create Designation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE / DEACTIVATE CONFIRMATION MODAL                   */}
      {/* ======================================================== */}
      {deleteConfirmModal.isOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setDeleteConfirmModal({ isOpen: false, type: '', item: null }); }}>
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(248, 113, 113, 0.15)',
                  color: '#F87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={18} />
                </div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                  Confirm Removal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !modalLoading && setDeleteConfirmModal({ isOpen: false, type: '', item: null })}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                disabled={modalLoading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {modalError && (
                <div style={{
                  backgroundColor: 'rgba(248, 113, 113, 0.14)',
                  border: '1px solid rgba(248, 113, 113, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#F87171',
                  fontSize: '0.85rem',
                  marginBottom: '16px'
                }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Are you sure you want to remove{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {deleteConfirmModal.type === 'branch'
                    ? deleteConfirmModal.item?.branch_name
                    : deleteConfirmModal.type === 'department'
                    ? deleteConfirmModal.item?.department_name
                    : deleteConfirmModal.item?.designation_name}
                </strong>?
              </p>

              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.4
              }}>
                ℹ️ <strong>Safe Reference Protection:</strong> If any employees or users are currently associated with this {deleteConfirmModal.type}, it will be safely deactivated (hidden from new selections) rather than permanently removed, keeping all audit logs and BGV reports completely intact.
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmModal({ isOpen: false, type: '', item: null })}
                disabled={modalLoading}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                className="btn btn-accent"
                onClick={handleConfirmDelete}
                disabled={modalLoading}
                style={{
                  backgroundColor: '#DC2626',
                  borderColor: '#B91C1C',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {modalLoading && <RefreshCw size={15} className="animate-spin" />}
                <span>{modalLoading ? 'Processing...' : 'Confirm Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
