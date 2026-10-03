import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, CheckSquare, Square } from 'lucide-react';

export function StepDeclarationReview() {
  const { progress, updateProgress, setStep, setSubmissionResult, nextStep, prevStep } = useVerification();
  const [confirmed, setConfirmed] = useState(progress.declarationAccepted || false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const checklist = [
    { id: 2, label: 'Employee Details Confirmed', done: progress.detailsConfirmed },
    { id: 3, label: 'Address Confirmed', done: progress.addressConfirmed },
    { id: 4, label: 'Residence Details Completed', done: !!progress.residenceType },
    { id: 5, label: 'Location Captured', done: progress.locationCaptured },
    { id: 6, label: 'Nearby Landmark Photo Captured', done: progress.landmarkPhotoCaptured },
    { id: 7, label: 'Street Board Photo Captured', done: progress.streetPhotoCaptured },
    { id: 8, label: 'Full Building Photo Captured', done: progress.housePhotoCaptured },
    { id: 9, label: 'Door Number Selfie Captured', done: progress.doorPhotoCaptured },
    { id: 10, label: 'Live Selfie Captured', done: progress.selfieCaptured },
    { id: 11, label: 'Address Proof Uploaded', done: progress.addressProofUploaded }
  ];

  const allCompleted = checklist.every((item) => item.done);

  async function handleFinalSubmit() {
    if (!confirmed) {
      setErrorMsg('Please accept the declaration to submit your verification.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Save declaration
      await api.verify.saveDeclaration(true);
      updateProgress({ declarationAccepted: true });

      // 2. Final Submit
      const res = await api.verify.submit();
      setSubmissionResult(res);
      setShowConfirmModal(false);
      nextStep(); // moves to step 10 (StepSuccess)
    } catch (err) {
      console.error('Final submit error:', err);
      setErrorMsg(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Review Your Verification</h2>
      <p className="emp-step-instruction">
        Please review your verification checklist and accept the declaration before final submission.
      </p>

      {/* Checklist */}
      <ul className="review-checklist">
        {checklist.map((item) => (
          <li key={item.id} className={`review-checklist-item ${item.done ? 'completed' : ''}`} style={{
            backgroundColor: item.done ? '#ECFDF5' : '#F8FAFC',
            border: `1.5px solid ${item.done ? '#A7F3D0' : '#E2E8F0'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div className="review-checklist-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {item.done ? (
                <CheckCircle2 size={20} color="#059669" />
              ) : (
                <AlertCircle size={20} color="#D97706" />
              )}
              <span style={{ color: item.done ? '#065F46' : '#64748B', fontWeight: item.done ? 600 : 500, fontSize: '0.9rem' }}>
                {item.label}
              </span>
            </div>

            {item.done ? (
              <span className="badge badge-success" style={{ backgroundColor: '#D1FAE5', color: '#065F46', fontWeight: 700, padding: '4px 10px' }}>
                Done
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ color: '#B45309', borderColor: '#FCD34D', backgroundColor: '#FFFBEB', fontWeight: 600 }}
                onClick={() => setStep(item.id)}
              >
                Complete
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Declaration Card */}
      <div style={{
        backgroundColor: '#F8FAFC',
        border: '1.5px solid #E2E8F0',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        margin: '18px 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#1E1B4B', marginBottom: '8px', fontSize: '1rem' }}>
          <ShieldCheck size={20} color="#4F46E5" />
          <span>Employee Declaration</span>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
          "I confirm that the information, location, photographs and documents submitted by me for employee address verification are accurate to the best of my knowledge."
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: '#1E1B4B' }}>
          <input
            id="checkbox-declaration"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              setErrorMsg('');
            }}
            style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#4F46E5' }}
          />
          <span>I Confirm and Agree</span>
        </label>
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
          id="btn-submit-verification"
          className="btn btn-success btn-large"
          onClick={() => {
            if (!allCompleted) {
              setErrorMsg('Please complete all steps in the checklist before submitting.');
              return;
            }
            if (!confirmed) {
              setErrorMsg('Please accept the declaration before submitting.');
              return;
            }
            setShowConfirmModal(true);
          }}
          disabled={!allCompleted || !confirmed || loading}
        >
          <span>Submit Verification</span>
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center', padding: '24px' }}>
            <ShieldCheck size={50} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Confirm Submission</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to submit your address verification to Collman Services?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                id="btn-confirm-final-submit"
                className="btn btn-primary btn-large"
                onClick={handleFinalSubmit}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Yes, Submit Verification'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
