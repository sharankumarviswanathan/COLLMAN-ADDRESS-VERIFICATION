import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { Building, Calendar, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';

export function StepResidence() {
  const { progress, updateProgress, nextStep, prevStep } = useVerification();
  const [residenceType, setResidenceType] = useState(progress.residenceType || 'Own House');
  const [month, setMonth] = useState(progress.stayingSinceMonth || 'January');
  const [year, setYear] = useState(progress.stayingSinceYear || '2024');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const residenceTypes = [
    'Own House',
    'Rented House',
    'PG',
    'Hostel',
    'Company Accommodation',
    "Relative's House",
    'Other'
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

  async function handleSave() {
    if (!residenceType || !month || !year) {
      setErrorMsg('Please select residence type and staying since date.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await api.verify.saveResidence(residenceType, month, year);
      updateProgress({
        residenceType,
        stayingSinceMonth: month,
        stayingSinceYear: year
      });
      nextStep();
    } catch (err) {
      console.error('Residence save error:', err);
      setErrorMsg('Failed to save residence details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Residence Details</h2>
      <p className="emp-step-instruction">
        Please specify your accommodation type and how long you have been residing here.
      </p>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building size={16} color="var(--accent)" />
          <span>Residence Type <span className="required">*</span></span>
        </label>
        <select
          id="select-residence-type"
          className="form-control form-select"
          value={residenceType}
          onChange={(e) => setResidenceType(e.target.value)}
          style={{ fontSize: '1rem', padding: '12px' }}
        >
          {residenceTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: '24px' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} color="var(--accent)" />
          <span>Staying Since <span className="required">*</span></span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Month
            </span>
            <select
              id="select-staying-month"
              className="form-control form-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Year
            </span>
            <select
              id="select-staying-year"
              className="form-control form-select"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--danger)',
          fontSize: '0.88rem',
          marginBottom: '16px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="emp-actions-bottom">
        <button
          id="btn-continue-residence"
          className="btn btn-primary btn-large"
          onClick={handleSave}
          disabled={loading}
        >
          <span>Continue</span>
          <ArrowRight size={20} />
        </button>

        <button
          className="btn btn-secondary"
          onClick={prevStep}
          disabled={loading}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>
    </div>
  );
}
