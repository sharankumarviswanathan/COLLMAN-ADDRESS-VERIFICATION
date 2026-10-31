import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { soundManager } from '../../lib/soundManager';
import { CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, CheckSquare, Square } from 'lucide-react';

export function StepDeclarationReview() {
  const { employee, progress, updateProgress, setStep, setSubmissionResult, nextStep, prevStep } = useVerification();
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
    { id: 11, label: 'Address Proof Uploaded', done: progress.addressProofUploaded },
    { id: 12, label: 'TL & Employee Joint Selfie Captured', done: progress.jointSelfieCaptured }
  ];

  const allCompleted = checklist.every((item) => item.done);

  async function handleFinalSubmit() {
    if (!confirmed) {
      soundManager.alert();
      setErrorMsg('Please accept the Team Leader physical visit declaration to submit the verification.');
      return;
    }

    if (!progress.jointSelfieCaptured) {
      soundManager.alert();
      setErrorMsg('Please complete the mandatory TL & Employee Joint Selfie before final submission.');
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
      soundManager.confirm();
      setSubmissionResult(res);
      setShowConfirmModal(false);
      nextStep(); // moves to step 14 (StepSuccess)
    } catch (err) {
      console.error('Final submit error:', err);
      soundManager.alert();
      setErrorMsg(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Review Verification Evidence</h2>
      <p className="emp-step-instruction">
        As Team Leader, review the completed evidence checklist for this employee residence visit and confirm the verification before final submission.
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--emp-title-color)', marginBottom: '8px', fontSize: '1rem' }}>
          <ShieldCheck size={20} color="var(--emp-subtitle-color)" />
          <span>Team Leader Physical Verification Declaration</span>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
          "I, as the authorized Team Leader, confirm that I have physically visited the employee's residential address, verified the identity of the employee in person, and captured all required GPS location and photo evidence on site. All submitted evidence is genuine and accurate."
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'var(--emp-title-color)' }}>
          <input
            id="checkbox-declaration"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              setErrorMsg('');
            }}
            style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--emp-c2)' }}
          />
          <span>I Confirm Physical Visit &amp; Evidence Accuracy</span>
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
          <div className="modal-content" style={{ maxWidth: '440px', textAlign: 'center', padding: '24px' }}>
            <ShieldCheck size={50} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Confirm Submission</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to submit the address verification evidence for employee <strong>{employee?.employeeName || 'the employee'}</strong> {employee?.employeeId ? `(${employee.employeeId})` : ''}? Once submitted, the case will be forwarded for HR/BGV review.
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
