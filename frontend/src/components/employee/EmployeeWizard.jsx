import React from 'react';
import { useVerification } from '../../context/VerificationContext';
import { StepWelcome } from './StepWelcome';
import { StepEmpId } from './StepEmpId';
import { StepDetails } from './StepDetails';
import { StepAddress } from './StepAddress';
import { StepResidence } from './StepResidence';
import { StepLocation } from './StepLocation';
import { StepSelfie } from './StepSelfie';
import { StepHousePhoto } from './StepHousePhoto';
import { StepDoorSelfie } from './StepDoorSelfie';
import { StepStreetPhoto } from './StepStreetPhoto';
import { StepLandmarkPhoto } from './StepLandmarkPhoto';
import { StepAddressProof } from './StepAddressProof';
import { StepJointSelfie } from './StepJointSelfie';
import { StepDeclarationReview } from './StepDeclarationReview';
import { StepSuccess } from './StepSuccess';
import { LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

export function EmployeeWizard() {
  const { step, employee } = useVerification();

  // Wizard Step Labels (Step 2 to 13 correspond to actual verification steps 1 to 12)
  const stepLabels = {
    2: 'Confirm Details',
    3: 'Confirm Address',
    4: 'Residence Details',
    5: 'Live Location',
    6: 'Nearby Landmark',
    7: 'Street Board',
    8: 'Full Building',
    9: 'Door Number Selfie',
    10: 'Live Selfie',
    11: 'Address Proof',
    12: 'TL & Employee Joint Selfie',
    13: 'Review & Submit'
  };

  const currentStepNum = step >= 2 && step <= 13 ? step - 1 : 0;
  const totalSteps = 12;
  const progressPercent = currentStepNum > 0 ? (currentStepNum / totalSteps) * 100 : 0;

  return (
    <div className="emp-verify-container">
      {/* Header */}
      <header className="emp-header">
        <div className="emp-brand">
          <div className="emp-brand-logo">C</div>
          <div>
            <div className="emp-brand-title">COLLMAN SERVICES</div>
            <div className="emp-brand-sub">Address Verification (BGV)</div>
          </div>
        </div>

        <Link
          to="/admin/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#FFFFFF',
            textDecoration: 'none',
            padding: '7px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(15, 255, 23, 0.45)',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          <LogIn size={15} color="#0FFF17" strokeWidth={2.4} />
          <span>HR Login</span>
        </Link>
      </header>

      {/* Main Form Body */}
      <main className="emp-body">
        {/* Progress Bar (Visible from Step 2 to 13) */}
        {step >= 2 && step <= 13 && (
          <div className="emp-progress-bar-container">
            <div className="emp-progress-meta">
              <span>Step {currentStepNum} of {totalSteps}: {stepLabels[step]}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="emp-progress-track">
              <div
                className="emp-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Verifying Employee Badge Banner for Team Leader */}
        {step >= 2 && step <= 13 && employee && (
          <div
            style={{
              backgroundColor: '#F8FAFC',
              border: '1.5px solid #CBD5E1',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #86EFAC'
                }}
              >
                VERIFYING EMPLOYEE
              </span>
              <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.96rem' }}>
                {employee.employeeName || employee.name || employee.full_name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>EMP ID:</span>
              <span style={{ fontWeight: 800, color: 'var(--emp-subtitle-color)', fontFamily: 'monospace' }}>
                {employee.employeeId || employee.id}
              </span>
            </div>
          </div>
        )}

        {/* Step Router */}
        {step === 0 && <StepWelcome />}
        {step === 1 && <StepEmpId />}
        {step === 2 && <StepDetails />}
        {step === 3 && <StepAddress />}
        {step === 4 && <StepResidence />}
        {step === 5 && <StepLocation />}
        {step === 6 && <StepLandmarkPhoto />}
        {step === 7 && <StepStreetPhoto />}
        {step === 8 && <StepHousePhoto />}
        {step === 9 && <StepDoorSelfie />}
        {step === 10 && <StepSelfie />}
        {step === 11 && <StepAddressProof />}
        {step === 12 && <StepJointSelfie />}
        {step === 13 && <StepDeclarationReview />}
        {step === 14 && <StepSuccess />}
      </main>
    </div>
  );
}
