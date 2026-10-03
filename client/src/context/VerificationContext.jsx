import React, { createContext, useContext, useState, useEffect } from 'react';

const VerificationContext = createContext(null);

export function VerificationProvider({ children }) {
  const [step, setStep] = useState(0); // 0: Welcome, 1: Emp ID entry, 2..9: Steps, 10: Success
  const [employee, setEmployee] = useState(null);
  const [progress, setProgress] = useState({
    detailsConfirmed: false,
    detailsCorrectionRemark: '',
    addressConfirmed: false,
    addressIsSame: true,
    addressDifferenceReason: '',
    submittedAddress: '',
    residenceType: '',
    stayingSinceMonth: '',
    stayingSinceYear: '',
    locationCaptured: false,
    latitude: null,
    longitude: null,
    gpsAccuracy: null,
    distanceFromHrMeters: null,
    distanceCategory: null,
    selfieCaptured: false,
    selfieUrl: null,
    selfieCoords: null,
    housePhotoCaptured: false,
    housePhotoUrl: null,
    housePhotoCoords: null,
    streetPhotoCaptured: false,
    streetPhotoUrl: null,
    streetPhotoCoords: null,
    landmarkPhotoCaptured: false,
    landmarkPhotoUrl: null,
    landmarkPhotoCoords: null,
    doorPhotoCaptured: false,
    doorPhotoUrl: null,
    doorPhotoCoords: null,
    addressProofUploaded: false,
    documentType: '',
    documentOriginalName: '',
    documentUrl: null,
    documentBackOriginalName: '',
    documentBackUrl: null,
    declarationAccepted: false
  });
  const [submissionResult, setSubmissionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Update progress helper
  const updateProgress = (updates) => {
    setProgress((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => Math.max(1, prev - 1));

  const resetSession = () => {
    sessionStorage.removeItem('collman_emp_session');
    setEmployee(null);
    setProgress({
      detailsConfirmed: false,
      detailsCorrectionRemark: '',
      addressConfirmed: false,
      addressIsSame: true,
      addressDifferenceReason: '',
      submittedAddress: '',
      residenceType: '',
      stayingSinceMonth: '',
      stayingSinceYear: '',
      locationCaptured: false,
      latitude: null,
      longitude: null,
      gpsAccuracy: null,
      distanceFromHrMeters: null,
      distanceCategory: null,
      selfieCaptured: false,
      selfieUrl: null,
      selfieCoords: null,
      housePhotoCaptured: false,
      housePhotoUrl: null,
      housePhotoCoords: null,
      streetPhotoCaptured: false,
      streetPhotoUrl: null,
      streetPhotoCoords: null,
      landmarkPhotoCaptured: false,
      landmarkPhotoUrl: null,
      landmarkPhotoCoords: null,
      doorPhotoCaptured: false,
      doorPhotoUrl: null,
      doorPhotoCoords: null,
      addressProofUploaded: false,
      documentType: '',
      documentOriginalName: '',
      documentUrl: null,
      documentBackOriginalName: '',
      documentBackUrl: null,
      declarationAccepted: false
    });
    setSubmissionResult(null);
    setStep(0);
    setError('');
  };

  return (
    <VerificationContext.Provider
      value={{
        step,
        setStep,
        employee,
        setEmployee,
        progress,
        setProgress,
        updateProgress,
        submissionResult,
        setSubmissionResult,
        loading,
        setLoading,
        error,
        setError,
        nextStep,
        prevStep,
        resetSession
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
}
