import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { UserCheck, AlertCircle, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';

export function StepEmpId() {
  const { setStep, setEmployee, setProgress, updateProgress, setError } = useVerification();
  const [empIdInput, setEmpIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusNotice, setStatusNotice] = useState(null);

  async function handleValidate(e) {
    if (e) e.preventDefault();

    const cleanInput = empIdInput.trim();
    if (!cleanInput) {
      setErrorMessage('Please enter your Employee ID to continue.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setStatusNotice(null);

    try {
      const data = await api.verify.validateId(cleanInput);

      if (data.alreadyVerified) {
        setStatusNotice({
          type: 'verified',
          title: 'Already Verified',
          message: data.message || 'Your address verification has already been completed.',
          name: data.employeeName,
          id: data.employeeId
        });
        setLoading(false);
        return;
      }

      if (data.alreadySubmitted) {
        setStatusNotice({
          type: 'submitted',
          title: 'Verification Under Review',
          message: data.message || 'Your address verification has already been submitted and is under review.',
          name: data.employeeName,
          id: data.employeeId
        });
        setLoading(false);
        return;
      }

      // Successful validation
      if (data.token) {
        sessionStorage.setItem('collman_emp_session', data.token);
      }

      setEmployee(data.employee);

      if (data.progress) {
        setProgress({
          detailsConfirmed: !!data.progress.detailsConfirmed,
          detailsCorrectionRemark: data.progress.detailsCorrectionRemark || '',
          addressConfirmed: !!data.progress.addressConfirmed,
          addressIsSame: data.progress.addressIsSame !== false,
          addressDifferenceReason: data.progress.addressDifferenceReason || '',
          submittedAddress: data.progress.submittedAddress || data.employee.hrAddress,
          residenceType: data.progress.residenceType || '',
          stayingSinceMonth: data.progress.stayingSinceMonth || '',
          stayingSinceYear: data.progress.stayingSinceYear || '',
          locationCaptured: !!data.progress.locationCaptured,
          latitude: data.progress.latitude,
          longitude: data.progress.longitude,
          gpsAccuracy: data.progress.gpsAccuracy,
          distanceFromHrMeters: data.progress.distanceFromHrMeters,
          distanceCategory: data.progress.distanceCategory,
          selfieCaptured: !!data.progress.selfieCaptured,
          selfieUrl: data.progress.selfiePath,
          selfieCoords: data.progress.selfieLatitude ? {
            latitude: data.progress.selfieLatitude,
            longitude: data.progress.selfieLongitude,
            accuracy: data.progress.selfieAccuracy,
            captureDate: data.progress.selfieCapturedAt?.split('T')[0] || '',
            captureTime: data.progress.selfieCapturedAt?.split('T')[1]?.substring(0, 8) || '',
            capturedAt: data.progress.selfieCapturedAt
          } : null,
          housePhotoCaptured: !!data.progress.housePhotoCaptured,
          housePhotoUrl: data.progress.housePhotoPath,
          housePhotoCoords: data.progress.housePhotoLatitude ? {
            latitude: data.progress.housePhotoLatitude,
            longitude: data.progress.housePhotoLongitude,
            accuracy: data.progress.housePhotoAccuracy,
            captureDate: data.progress.housePhotoCapturedAt?.split('T')[0] || '',
            captureTime: data.progress.housePhotoCapturedAt?.split('T')[1]?.substring(0, 8) || '',
            capturedAt: data.progress.housePhotoCapturedAt
          } : null,
          streetPhotoCaptured: !!data.progress.streetPhotoCaptured,
          streetPhotoUrl: data.progress.streetPhotoPath,
          streetPhotoCoords: data.progress.streetPhotoLatitude ? {
            latitude: data.progress.streetPhotoLatitude,
            longitude: data.progress.streetPhotoLongitude,
            accuracy: data.progress.streetPhotoAccuracy,
            captureDate: data.progress.streetPhotoCapturedAt?.split('T')[0] || '',
            captureTime: data.progress.streetPhotoCapturedAt?.split('T')[1]?.substring(0, 8) || '',
            capturedAt: data.progress.streetPhotoCapturedAt
          } : null,
          landmarkPhotoCaptured: !!data.progress.landmarkPhotoCaptured,
          landmarkPhotoUrl: data.progress.landmarkPhotoPath,
          landmarkPhotoCoords: data.progress.landmarkPhotoLatitude ? {
            latitude: data.progress.landmarkPhotoLatitude,
            longitude: data.progress.landmarkPhotoLongitude,
            accuracy: data.progress.landmarkPhotoAccuracy,
            captureDate: data.progress.landmarkPhotoCapturedAt?.split('T')[0] || '',
            captureTime: data.progress.landmarkPhotoCapturedAt?.split('T')[1]?.substring(0, 8) || '',
            capturedAt: data.progress.landmarkPhotoCapturedAt
          } : null,
          doorPhotoCaptured: !!data.progress.doorPhotoCaptured,
          doorPhotoUrl: data.progress.doorPhotoPath,
          doorPhotoCoords: data.progress.doorPhotoLatitude ? {
            latitude: data.progress.doorPhotoLatitude,
            longitude: data.progress.doorPhotoLongitude,
            accuracy: data.progress.doorPhotoAccuracy,
            captureDate: data.progress.doorPhotoCapturedAt?.split('T')[0] || '',
            captureTime: data.progress.doorPhotoCapturedAt?.split('T')[1]?.substring(0, 8) || '',
            capturedAt: data.progress.doorPhotoCapturedAt
          } : null,
          addressProofUploaded: !!data.progress.addressProofUploaded,
          documentType: data.progress.documentType || '',
          documentOriginalName: data.progress.documentOriginalName || '',
          documentUrl: data.progress.documentUrl,
          documentBackOriginalName: data.progress.documentBackOriginalName || '',
          documentBackUrl: data.progress.documentBackUrl,
          declarationAccepted: !!data.progress.declarationAccepted
        });

        // Auto-resume from next incomplete step
        const savedStep = data.progress.currentStep;
        if (savedStep && savedStep > 1 && savedStep < 13) {
          // If In Progress, resume where they left off
          setStep(Math.min(savedStep + 1, 12));
        } else {
          setStep(2);
        }
      } else {
        setStep(2);
      }
    } catch (err) {
      console.error('Validation error:', err);
      // Clean non-technical error
      setErrorMessage(
        err.message && err.message.includes('not found')
          ? 'Employee ID not found. Please check your Employee ID and try again.'
          : (err.message || 'Something went wrong. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#EEF2FF',
          color: '#4F46E5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto'
        }}>
          <UserCheck size={28} />
        </div>
        <h2 className="emp-step-title" style={{ color: '#1E1B4B', fontWeight: 800 }}>Enter Your Employee ID</h2>
        <p className="emp-step-instruction" style={{ color: '#475569', fontSize: '0.95rem' }}>
          Please enter the Employee ID provided by Collman Services.
        </p>
      </div>

      {statusNotice ? (
        <div style={{
          backgroundColor: statusNotice.type === 'verified' ? '#ECFDF5' : '#FFFBEB',
          border: `1.5px solid ${statusNotice.type === 'verified' ? '#10B981' : '#F59E0B'}`,
          borderRadius: 'var(--radius-md)',
          padding: '24px 20px',
          textAlign: 'center',
          marginBottom: '20px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)'
        }}>
          {statusNotice.type === 'verified' ? (
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: '#D1FAE5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto'
            }}>
              <CheckCircle2 size={32} color="#059669" />
            </div>
          ) : (
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto'
            }}>
              <AlertCircle size={32} color="#D97706" />
            </div>
          )}
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: statusNotice.type === 'verified' ? '#065F46' : '#92400E',
            marginBottom: '8px'
          }}>
            {statusNotice.title}
          </h3>
          <p style={{
            fontSize: '0.95rem',
            color: statusNotice.type === 'verified' ? '#047857' : '#B45309',
            fontWeight: 500,
            marginBottom: '14px',
            lineHeight: 1.5
          }}>
            {statusNotice.message}
          </p>
          <div style={{
            display: 'inline-block',
            fontSize: '0.88rem',
            fontWeight: 700,
            color: '#1E1B4B',
            backgroundColor: '#FFFFFF',
            border: `1px solid ${statusNotice.type === 'verified' ? '#A7F3D0' : '#FDE68A'}`,
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            marginBottom: '18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            Employee: <span style={{ color: '#4338CA' }}>{statusNotice.name}</span> ({statusNotice.id})
          </div>
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-large"
              onClick={() => {
                setStatusNotice(null);
                setEmpIdInput('');
              }}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                border: '1.5px solid #CBD5E1',
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
              }}
            >
              <RotateCcw size={16} />
              <span>Enter Different ID</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleValidate}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="employee-id-input" style={{ fontSize: '1rem' }}>
              Employee ID
            </label>
            <input
              id="employee-id-input"
              type="text"
              className="form-control"
              placeholder="e.g. COL00101"
              value={empIdInput}
              onChange={(e) => {
                setEmpIdInput(e.target.value.toUpperCase());
                setErrorMessage('');
              }}
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.1em',
                padding: '14px',
                textTransform: 'uppercase'
              }}
              autoFocus
              disabled={loading}
            />
            <span className="form-hint" style={{ textAlign: 'center' }}>
              Example format: COL00125
            </span>
          </div>

          {errorMessage && (
            <div style={{
              backgroundColor: 'var(--danger-light)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--danger)',
              fontSize: '0.9rem',
              marginBottom: '20px'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <div className="emp-actions-bottom">
            <button
              id="btn-continue-empid"
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading || !empIdInput.trim()}
            >
              {loading ? 'Validating ID...' : 'Continue'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
