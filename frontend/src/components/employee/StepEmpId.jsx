import React, { useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import {
  UserCheck,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  UserX,
  Building,
  KeyRound,
  ArrowLeft
} from 'lucide-react';

export function StepEmpId() {
  const { setStep, setEmployee, setTl, setProgress } = useVerification();

  // Two-stage state: 'TL' -> 'AGENT'
  const [stage, setStage] = useState('TL');
  const [tlInput, setTlInput] = useState('');
  const [validatedTl, setValidatedTl] = useState(null);
  const [agentInput, setAgentInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorBlock, setErrorBlock] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);

  // Stage 1: Validate Team Leader ID
  async function handleValidateTl(e) {
    if (e) e.preventDefault();
    const cleanTl = tlInput.trim();
    if (!cleanTl) {
      setErrorMessage('Please enter the Team Leader Employee ID.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setErrorBlock(null);

    try {
      const res = await api.verify.validateTl(cleanTl);
      if (res && res.valid && res.teamLeader) {
        setValidatedTl(res.teamLeader);
        setTl(res.teamLeader);
        setStage('AGENT');
      } else {
        setErrorMessage('Team Leader ID not found or unauthorized.');
      }
    } catch (err) {
      console.error('TL validation error:', err);
      const msg = err.data?.error || err.message || 'Team Leader validation failed.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  // Switch back to TL entry
  function handleChangeTl() {
    setStage('TL');
    setAgentInput('');
    setErrorMessage('');
    setErrorBlock(null);
  }

  // Stage 2: Validate Agent Employee ID & verify assignment to TL
  async function handleValidateAgent(e) {
    if (e) e.preventDefault();
    const cleanAgent = agentInput.trim();
    if (!cleanAgent) {
      setErrorMessage('Please enter the Agent Employee ID.');
      return;
    }

    if (!validatedTl?.tlId) {
      setErrorMessage('Please validate a Team Leader ID first.');
      setStage('TL');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setErrorBlock(null);
    setStatusNotice(null);

    try {
      const data = await api.verify.validateId({
        tlId: validatedTl.tlId,
        agentId: cleanAgent
      });

      if (data.alreadyVerified) {
        setStatusNotice({
          type: 'verified',
          title: 'Already Verified',
          message: data.message || 'Your address verification has already been completed.',
          name: data.employeeName,
          id: data.employeeId,
          tlName: validatedTl.tlName
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
          id: data.employeeId,
          tlName: validatedTl.tlName
        });
        setLoading(false);
        return;
      }

      // Successful validation
      if (data.token) {
        sessionStorage.setItem('collman_emp_session', data.token);
      }

      setEmployee(data.employee);
      if (data.teamLeader) {
        setTl(data.teamLeader);
      }

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
          jointSelfieCaptured: !!data.progress.jointSelfieCaptured,
          jointSelfieUrl: data.progress.jointSelfiePath,
          jointSelfieCoords: data.progress.jointSelfieLatitude ? {
            latitude: data.progress.jointSelfieLatitude,
            longitude: data.progress.jointSelfieLongitude,
            accuracy: data.progress.jointSelfieAccuracy,
            captureDate: data.progress.jointSelfieCapturedAt?.split('T')[0] || '',
            captureTime: data.progress.jointSelfieCapturedAt?.split('T')[1]?.substring(0, 8) || '',
            capturedAt: data.progress.jointSelfieCapturedAt
          } : null,
          jointSelfieTlId: validatedTl.tlId,
          jointSelfieTlName: validatedTl.tlName,
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
          setStep(Math.min(savedStep + 1, 12));
        } else {
          setStep(2);
        }
      } else {
        setStep(2);
      }
    } catch (err) {
      console.error('Agent validation error:', err);
      const code = err.data?.code;
      const data = err.data;

      if (code === 'AGENT_UNASSIGNED') {
        setErrorBlock({
          type: 'danger',
          title: 'Access Blocked: Agent Unassigned',
          description: data?.error || 'This agent is not assigned to any Team Leader in the system.',
          agentName: data?.agentName,
          agentId: data?.agentId,
          remedy: 'Please contact Operations or HR to assign this employee to an authorized Team Leader.'
        });
      } else if (code === 'AGENT_ASSIGNED_TO_OTHER_TL') {
        setErrorBlock({
          type: 'danger',
          title: 'Access Blocked: Team Leader Mismatch',
          description: data?.error || 'This agent is assigned to a different Team Leader.',
          agentName: data?.agentName,
          agentId: data?.agentId,
          assignedTl: data?.assignedTl,
          currentTl: validatedTl.tlName,
          remedy: `Only the assigned Team Leader (${data?.assignedTl || 'assigned TL'}) can initiate verification for this agent.`
        });
      } else if (err.status === 404 || code === 'AGENT_NOT_FOUND') {
        setErrorBlock({
          type: 'warning',
          title: 'Agent Not Found',
          description: `No active employee record found with ID "${cleanAgent}".`,
          remedy: 'Please verify the Agent Employee ID and try again.'
        });
      } else {
        setErrorMessage(data?.error || err.message || 'Validation failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      {/* Stepper Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: stage === 'TL' ? '#4F46E5' : '#059669',
          backgroundColor: stage === 'TL' ? '#EEF2FF' : '#ECFDF5',
          padding: '4px 10px',
          borderRadius: '999px',
          border: `1px solid ${stage === 'TL' ? '#C7D2FE' : '#A7F3D0'}`
        }}>
          {stage === 'TL' ? <KeyRound size={13} /> : <CheckCircle2 size={13} />}
          <span>1. TL ID</span>
        </div>
        <div style={{ width: '20px', height: '2px', backgroundColor: stage === 'AGENT' ? '#10B981' : '#E2E8F0' }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: stage === 'AGENT' ? '#4F46E5' : '#94A3B8',
          backgroundColor: stage === 'AGENT' ? '#EEF2FF' : '#F1F5F9',
          padding: '4px 10px',
          borderRadius: '999px',
          border: `1px solid ${stage === 'AGENT' ? '#C7D2FE' : '#E2E8F0'}`
        }}>
          <UserCheck size={13} />
          <span>2. Agent ID</span>
        </div>
      </div>

      {/* Main Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          backgroundColor: stage === 'TL' ? '#EEF2FF' : '#F0FDF4',
          color: stage === 'TL' ? '#4F46E5' : '#16A34A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.12)'
        }}>
          {stage === 'TL' ? <ShieldCheck size={30} /> : <UserCheck size={30} />}
        </div>
        <h2 className="emp-step-title" style={{ color: '#1E1B4B', fontWeight: 800 }}>
          {stage === 'TL' ? 'Enter TL Employee ID' : 'Enter Agent Employee ID'}
        </h2>
        <p className="emp-step-instruction" style={{ color: '#475569', fontSize: '0.92rem' }}>
          {stage === 'TL'
            ? 'First, enter the authorized Team Leader (TL) ID to initiate verification.'
            : `Enter the Employee ID of the agent assigned under TL ${validatedTl?.tlName || ''}.`}
        </p>
      </div>

      {/* Verified Status Notice (Already Verified / Under Review) */}
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
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            backgroundColor: statusNotice.type === 'verified' ? '#D1FAE5' : '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            {statusNotice.type === 'verified' ? (
              <CheckCircle2 size={32} color="#059669" />
            ) : (
              <AlertCircle size={32} color="#D97706" />
            )}
          </div>
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
            marginBottom: '18px'
          }}>
            Agent: <span style={{ color: '#4338CA' }}>{statusNotice.name}</span> ({statusNotice.id})
          </div>
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-large"
              onClick={() => {
                setStatusNotice(null);
                setAgentInput('');
              }}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                border: '1.5px solid #CBD5E1',
                fontWeight: 600
              }}
            >
              <RotateCcw size={16} />
              <span>Verify Another Agent</span>
            </button>
          </div>
        </div>
      ) : stage === 'TL' ? (
        /* ================== STAGE 1: TL ID ================== */
        <form onSubmit={handleValidateTl}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="tl-id-input" style={{ fontSize: '0.98rem', fontWeight: 700 }}>
              Team Leader Employee ID
            </label>
            <input
              id="tl-id-input"
              type="text"
              className="form-control"
              placeholder="e.g. 202140"
              value={tlInput}
              onChange={(e) => {
                setTlInput(e.target.value.toUpperCase());
                setErrorMessage('');
                setErrorBlock(null);
              }}
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.08em',
                padding: '14px',
                textTransform: 'uppercase'
              }}
              autoFocus
              disabled={loading}
            />
            <span className="form-hint" style={{ textAlign: 'center' }}>
              Authorized TL Username or Employee ID (e.g. 202140 or 10034)
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
              id="btn-validate-tl"
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading || !tlInput.trim()}
            >
              {loading ? 'Validating TL...' : 'Validate Team Leader'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </div>
        </form>
      ) : (
        /* ================== STAGE 2: AGENT ID ================== */
        <form onSubmit={handleValidateAgent}>
          {/* Active Authorized TL Summary Card */}
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1.5px solid #86EFAC',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#166534', fontWeight: 800, letterSpacing: '0.04em' }}>
                  Authorized Team Leader
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#14532D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {validatedTl?.tlName} <span style={{ fontWeight: 600, color: '#166534', fontSize: '0.85rem' }}>({validatedTl?.tlId})</span>
                </div>
              </div>
            </div>

            <button
              id="btn-change-tl"
              type="button"
              onClick={handleChangeTl}
              disabled={loading}
              style={{
                background: '#FFFFFF',
                border: '1px solid #86EFAC',
                color: '#166534',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <RotateCcw size={12} />
              <span>Change TL</span>
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="agent-id-input" style={{ fontSize: '0.98rem', fontWeight: 700 }}>
              Agent Employee ID
            </label>
            <input
              id="agent-id-input"
              type="text"
              className="form-control"
              placeholder="e.g. COL00101"
              value={agentInput}
              onChange={(e) => {
                setAgentInput(e.target.value.toUpperCase());
                setErrorMessage('');
                setErrorBlock(null);
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

          {/* Structured Error / Block Card */}
          {errorBlock && (
            <div style={{
              backgroundColor: errorBlock.type === 'danger' ? '#FEF2F2' : '#FFFBEB',
              border: `1.5px solid ${errorBlock.type === 'danger' ? '#F87171' : '#FBBF24'}`,
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: errorBlock.type === 'danger' ? '#991B1B' : '#92400E',
                fontWeight: 800,
                fontSize: '0.98rem',
                marginBottom: '6px'
              }}>
                <UserX size={20} />
                <span>{errorBlock.title}</span>
              </div>
              <p style={{
                fontSize: '0.88rem',
                color: errorBlock.type === 'danger' ? '#7F1D1D' : '#78350F',
                marginBottom: '8px',
                lineHeight: 1.5
              }}>
                {errorBlock.description}
              </p>
              {errorBlock.remedy && (
                <div style={{
                  fontSize: '0.82rem',
                  color: errorBlock.type === 'danger' ? '#991B1B' : '#92400E',
                  backgroundColor: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${errorBlock.type === 'danger' ? '#FECACA' : '#FDE68A'}`,
                  fontWeight: 600
                }}>
                  {errorBlock.remedy}
                </div>
              )}
            </div>
          )}

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

          <div className="emp-actions-bottom" style={{ display: 'flex', gap: '10px' }}>
            <button
              id="btn-back-to-tl"
              type="button"
              className="btn btn-secondary"
              onClick={handleChangeTl}
              disabled={loading}
              style={{ width: 'auto', padding: '0 16px' }}
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>

            <button
              id="btn-continue-agent"
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading || !agentInput.trim()}
              style={{ flex: 1 }}
            >
              {loading ? 'Verifying...' : 'Verify Agent & Continue'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
