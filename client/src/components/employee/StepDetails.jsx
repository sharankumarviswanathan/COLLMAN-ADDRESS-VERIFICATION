import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { User, Check, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';

export function StepDetails() {
  const { employee, progress, updateProgress, setStep, nextStep, prevStep } = useVerification();
  const [loading, setLoading] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionRemark, setCorrectionRemark] = useState('');

  if (!employee) {
    return (
      <div className="emp-card" style={{ textAlign: 'center' }}>
        <p>No employee information loaded.</p>
        <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ marginTop: 12 }}>
          Back to ID Entry
        </button>
      </div>
    );
  }

  async function handleConfirm(confirmed = true) {
    setLoading(true);
    try {
      await api.verify.saveDetails(confirmed, correctionRemark);
      updateProgress({
        detailsConfirmed: confirmed,
        detailsCorrectionRemark: correctionRemark
      });
      nextStep();
    } catch (err) {
      console.error('Details confirmation error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Confirm Your Details</h2>
      <p className="emp-step-instruction">
        Please review and verify that the information below matches your Collman Services records.
      </p>

      <div style={{
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
              Employee Name
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1E1B4B' }}>
              {employee.employeeName}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                Employee ID
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5' }}>
                {employee.employeeId}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                Date of Joining
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1E1B4B' }}>
                {employee.dateOfJoining}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                Department
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1E1B4B' }}>
                {employee.department}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                Branch
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1E1B4B' }}>
                {employee.branch}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showCorrectionForm ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: '16px', fontWeight: 700, color: '#1E1B4B', fontSize: '1rem' }}>
            Are these your details?
          </div>

          <div className="emp-actions-bottom">
            <button
              id="btn-confirm-details-yes"
              className="btn btn-primary btn-large"
              onClick={() => handleConfirm(true)}
              disabled={loading}
            >
              <Check size={20} />
              <span>Yes, Continue</span>
            </button>

            <button
              id="btn-confirm-details-no"
              className="btn btn-secondary btn-large"
              onClick={() => setShowCorrectionForm(true)}
              disabled={loading}
            >
              <AlertTriangle size={18} />
              <span>Details Are Incorrect</span>
            </button>
          </div>
        </>
      ) : (
        <div style={{
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginTop: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: 700, marginBottom: '8px' }}>
            <AlertTriangle size={20} />
            <span>Employee Record Correction</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Please contact HR to officially correct your employee details. You can provide a remark below and continue with the address verification.
          </p>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>
              Correction Remark (Optional)
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Spelling error in name, or branch changed recently..."
              value={correctionRemark}
              onChange={(e) => setCorrectionRemark(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => handleConfirm(false)}
              disabled={loading}
            >
              <span>Continue with Verification</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCorrectionForm(false)}
            >
              <span>Back</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
