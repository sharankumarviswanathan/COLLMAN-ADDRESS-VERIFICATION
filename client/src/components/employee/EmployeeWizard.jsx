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
import { StepDeclarationReview } from './StepDeclarationReview';
import { StepSuccess } from './StepSuccess';
import { ShieldCheck, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

export function EmployeeWizard() {
  const { step, employee } = useVerification();

  // Wizard Step Labels (Step 2 to 12 correspond to actual verification steps 1 to 11)
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
    12: 'Review & Submit'
  };

  const currentStepNum = step >= 2 && step <= 12 ? step - 1 : 0;
  const totalSteps = 11;
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
            gap: '4px',
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.85)',
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255,255,255,0.1)'
          }}
        >
          <LogIn size={14} />
          <span>HR Login</span>
        </Link>
      </header>

      {/* Main Form Body */}
      <main className="emp-body">
        {/* Progress Bar (Visible from Step 2 to 12) */}
        {step >= 2 && step <= 12 && (
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
        {step === 12 && <StepDeclarationReview />}
        {step === 13 && <StepSuccess />}
      </main>
    </div>
  );
}
