import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  Sliders,
  Building,
  Building2,
  Check,
  Save,
  Clock,
  Key,
  ShieldAlert,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Layers
} from 'lucide-react';

export function MastersManagement() {
  const [masters, setMasters] = useState({
    branches: [],
    departments: [],
    locations: [],
    docTypes: [],
    failureReasons: [],
    settings: {}
  });

  const [activeTab, setActiveTab] = useState('branches');

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMasters();
  }, []);

  async function loadMasters() {
    setLoading(true);
    try {
      const data = await api.masters.getAll();
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
                color: '#FFFFFF',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-heading)' }}>
                Turnaround Time (TAT) & GPS Thresholds
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                System-wide SLA deadlines and geo-proximity matching rules
              </p>
            </div>
          </div>

          {successMsg && (
            <div style={{
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34D399',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '18px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '16px', marginBottom: '18px' }}>
              <div className="form-group">
                <label className="form-label">Employee Verification TAT (Days)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.employee_tat_days}
                  onChange={(e) => setSettingsForm({ ...settingsForm, employee_tat_days: e.target.value })}
                  min={1}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Days allowed for candidate completion
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">BGV Review TAT (Days)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.bgv_tat_days}
                  onChange={(e) => setSettingsForm({ ...settingsForm, bgv_tat_days: e.target.value })}
                  min={1}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Days allowed for BGV Reviewer
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '16px', marginBottom: '18px' }}>
              <div className="form-group">
                <label className="form-label">GPS Close Proximity (Meters)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.gps_threshold_close_meters}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gps_threshold_close_meters: e.target.value })}
                  min={10}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Auto-verified green threshold (Default: 100m)
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">GPS Nearby Warning (Meters)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settingsForm.gps_threshold_nearby_meters}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gps_threshold_nearby_meters: e.target.value })}
                  min={50}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Flagged for manual review if exceeded (Default: 500m)
                </span>
              </div>
            </div>

            {/* Google Maps Geocoding API Key */}
            <div style={{
              marginBottom: '22px',
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} color="#C084FC" />
                  <span>Google Maps Geocoding API Key</span>
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>PRIMARY PROVIDER</span>
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="AIzaSy... (leave blank to use server environment variable)"
                value={settingsForm.google_maps_api_key}
                onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_api_key: e.target.value })}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.45 }}>
                Used as the <strong>Primary</strong> HR address geocoding provider. When ROOFTOP street_address is returned, coordinates are marked as <strong>PRECISE</strong>. OpenStreetMap / Nominatim acts automatically as the <strong>Fallback</strong> provider.
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              <Save size={16} />
              <span>{savingSettings ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
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
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Master Entity Registry
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Pre-configured enterprise reference data
                </p>
              </div>
            </div>
          </div>

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
              type="button"
              className={`btn btn-sm ${activeTab === 'branches' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('branches')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Branches ({masters.branches?.length || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'departments' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('departments')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Departments ({masters.departments?.length || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'docTypes' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('docTypes')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Doc Types ({masters.docTypes?.length || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'failureReasons' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('failureReasons')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              Failure Reasons ({masters.failureReasons?.length || 0})
            </button>
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
            {activeTab === 'branches' && (
              masters.branches?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No branches recorded.</div>
              ) : (
                masters.branches?.map((b) => (
                  <div
                    key={b.id || b.branch_code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Building size={18} color="#C084FC" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF' }}>
                          {b.branch_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {b.city}, {b.state}
                        </div>
                      </div>
                    </div>
                    <span className="id-chip">
                      {b.branch_code}
                    </span>
                  </div>
                ))
              )
            )}

            {activeTab === 'departments' && (
              masters.departments?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No departments recorded.</div>
              ) : (
                masters.departments?.map((d, idx) => (
                  <div
                    key={d.id || idx}
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
                      <Building2 size={18} color="#C084FC" />
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF' }}>
                        {d.department_name || d.name}
                      </div>
                    </div>
                    {d.department_code && (
                      <span className="badge badge-secondary">{d.department_code}</span>
                    )}
                  </div>
                ))
              )
            )}

            {activeTab === 'docTypes' && (
              masters.docTypes?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No document types recorded.</div>
              ) : (
                masters.docTypes?.map((dt, idx) => (
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
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF' }}>
                          {dt.document_name || dt.name}
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

            {activeTab === 'failureReasons' && (
              masters.failureReasons?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No failure reasons configured.</div>
              ) : (
                masters.failureReasons?.map((fr, idx) => (
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
                      {fr.reason_description || fr.reason_text || fr.name}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
