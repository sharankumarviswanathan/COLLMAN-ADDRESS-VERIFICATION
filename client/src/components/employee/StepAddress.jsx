import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { Home, Check, X, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';

export function StepAddress() {
  const { employee, progress, updateProgress, nextStep, prevStep } = useVerification();
  const [isSame, setIsSame] = useState(progress.addressIsSame !== false);
  const [selectedReason, setSelectedReason] = useState(progress.addressDifferenceReason || 'I have shifted to another address');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [newAddressText, setNewAddressText] = useState(
    progress.addressIsSame === false ? progress.submittedAddress : ''
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const reasons = [
    'I have shifted to another address',
    'Address submitted earlier is incorrect',
    'I am temporarily staying at another address',
    'Other'
  ];

  async function handleSave() {
    if (!isSame) {
      if (!newAddressText.trim()) {
        setErrorMsg('Please enter your current residential address.');
        return;
      }
    }

    const finalReason = selectedReason === 'Other' && otherReasonText.trim()
      ? `Other: ${otherReasonText.trim()}`
      : selectedReason;

    setLoading(true);
    setErrorMsg('');

    try {
      await api.verify.saveAddress(
        isSame,
        isSame ? '' : finalReason,
        isSame ? employee.hrAddress : newAddressText.trim()
      );

      updateProgress({
        addressConfirmed: true,
        addressIsSame: isSame,
        addressDifferenceReason: isSame ? '' : finalReason,
        submittedAddress: isSame ? employee.hrAddress : newAddressText.trim()
      });

      nextStep();
    } catch (err) {
      console.error('Save address error:', err);
      setErrorMsg('Failed to save address details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Confirm Your Current Address</h2>
      <p className="emp-step-instruction">
        Please check if the residential address registered with HR is your current residence.
      </p>

      {/* HR Address Box */}
      <div style={{
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
          <Home size={16} />
          <span>Address on HR Record</span>
        </div>
        <div style={{ fontSize: '1.05rem', color: '#1E1B4B', lineHeight: 1.5, fontWeight: 600 }}>
          {employee?.hrAddress || 'Address on record'}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1E1B4B', marginBottom: '12px' }}>
          Is this your current address?
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            type="button"
            className={`btn ${isSame ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '16px', fontSize: '1.1rem' }}
            onClick={() => {
              setIsSame(true);
              setErrorMsg('');
            }}
          >
            <Check size={22} />
            <span>YES</span>
          </button>

          <button
            type="button"
            className={`btn ${!isSame ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '16px', fontSize: '1.1rem' }}
            onClick={() => {
              setIsSame(false);
              setErrorMsg('');
            }}
          >
            <X size={22} />
            <span>NO</span>
          </button>
        </div>
      </div>

      {/* If Address is different */}
      {!isSame && (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          padding: '18px',
          marginBottom: '20px'
        }}>
          <div className="form-group">
            <label className="form-label">
              Why is the address different? <span className="required">*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {reasons.map((r) => (
                <label
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: selectedReason === r ? 'var(--accent-light)' : 'var(--bg-subtle)',
                    border: `1px solid ${selectedReason === r ? 'var(--accent)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: selectedReason === r ? 600 : 400
                  }}
                >
                  <input
                    type="radio"
                    name="diffReason"
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div className="form-group">
              <label className="form-label">Please specify reason</label>
              <input
                type="text"
                className="form-control"
                placeholder="Type your reason..."
                value={otherReasonText}
                onChange={(e) => setOtherReasonText(e.target.value)}
              />
            </div>
          )}

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">
              Your Current / Correct Address <span className="required">*</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Enter Door No, Building, Street, Area, City, State, Pincode"
              value={newAddressText}
              onChange={(e) => setNewAddressText(e.target.value)}
            />
          </div>
        </div>
      )}

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
          id="btn-continue-address"
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
