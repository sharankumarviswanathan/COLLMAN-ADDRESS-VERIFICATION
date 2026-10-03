import React, { useState, useRef, useEffect } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { getCameraStream, stopMediaStream } from '../../lib/cameraHelper';
import { validatePhotoInBrowser } from '../../lib/imageValidator';
import {
  FileText,
  Upload,
  Camera,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  X,
  SwitchCamera,
  Trash2,
  ShieldCheck,
  Check
} from 'lucide-react';

export function StepAddressProof() {
  const { progress, updateProgress, nextStep, prevStep } = useVerification();

  const docTypes = [
    'Aadhaar Card',
    'Driving Licence',
    'Voter ID',
    'Gas Bill',
    'Registered Rental Agreement',
    'Passport'
  ];

  const initialDocType = (progress.documentType && docTypes.includes(progress.documentType))
    ? progress.documentType
    : 'Aadhaar Card';

  const [docType, setDocType] = useState(initialDocType);

  // Front Document State
  const [frontDoc, setFrontDoc] = useState(() => {
    if (progress.addressProofUploaded && progress.documentUrl) {
      const isPdf = Boolean(progress.documentOriginalName && progress.documentOriginalName.toLowerCase().endsWith('.pdf'));
      return {
        file: null,
        dataUrl: progress.documentUrl,
        previewUrl: progress.documentUrl,
        name: progress.documentOriginalName || 'Front_Address_Proof',
        size: null,
        type: isPdf ? 'pdf' : 'image',
        isExisting: true
      };
    }
    return null;
  });

  // Back Document State
  const [backDoc, setBackDoc] = useState(() => {
    if (progress.addressProofUploaded && progress.documentBackUrl) {
      const isPdf = Boolean(progress.documentBackOriginalName && progress.documentBackOriginalName.toLowerCase().endsWith('.pdf'));
      return {
        file: null,
        dataUrl: progress.documentBackUrl,
        previewUrl: progress.documentBackUrl,
        name: progress.documentBackOriginalName || 'Back_Address_Proof',
        size: null,
        type: isPdf ? 'pdf' : 'image',
        isExisting: true
      };
    }
    return null;
  });

  // Validation States
  const [frontValidation, setFrontValidation] = useState(null);
  const [backValidation, setBackValidation] = useState(null);
  const [combinedValidation, setCombinedValidation] = useState(null);
  const [validatingSide, setValidatingSide] = useState(null); // 'front' | 'back' | 'both' | null
  const [validationError, setValidationError] = useState('');

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [activeSide, setActiveSide] = useState(null); // 'front' | 'back'
  const [facingMode, setFacingMode] = useState('environment'); // Default back camera for document scanning
  const [streamReady, setStreamReady] = useState(false);

  // Submission State
  const [loading, setLoading] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputFrontRef = useRef(null);
  const fileInputBackRef = useRef(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.warn('Video autoplay failed:', err);
      });
    }
  }, [cameraActive, streamReady]);

  // If initial existing files exist, validate them automatically
  useEffect(() => {
    if (frontDoc && backDoc && !combinedValidation && !validatingSide) {
      triggerValidation(frontDoc, backDoc, docType);
    }
  }, []);

  async function computeMetrics(docObj) {
    if (!docObj || docObj.type === 'pdf') {
      return { blurScore: 80, brightness: 128, contrast: 60 };
    }
    const src = docObj.previewUrl || docObj.dataUrl;
    if (!src) return { blurScore: 80, brightness: 128, contrast: 60 };

    try {
      const val = await validatePhotoInBrowser(src, 'document');
      return val?.metrics || { blurScore: 80, brightness: 128, contrast: 60 };
    } catch (e) {
      return { blurScore: 80, brightness: 128, contrast: 60 };
    }
  }

  async function triggerValidation(fDoc, bDoc, selectedType) {
    setValidationError('');

    // 1. If only Front is provided
    if (fDoc && !bDoc) {
      setValidatingSide('front');
      try {
        const metrics = await computeMetrics(fDoc);
        const payload = {
          documentType: selectedType,
          side: 'front',
          frontMetrics: metrics
        };
        if (fDoc.file) payload.frontFile = fDoc.file;
        else if (fDoc.dataUrl) payload.frontBase64 = fDoc.dataUrl;

        const res = await api.verify.validateAddressProof(payload);
        setFrontValidation(res);

        if (!res.valid) {
          setValidationError(res.error || 'Front document validation failed.');
        }
      } catch (err) {
        console.error('Front validation error:', err);
        setValidationError(err.message || 'Failed to validate front document.');
      } finally {
        setValidatingSide(null);
      }
      return;
    }

    // 2. If only Back is provided
    if (!fDoc && bDoc) {
      setValidatingSide('back');
      try {
        const metrics = await computeMetrics(bDoc);
        const payload = {
          documentType: selectedType,
          side: 'back',
          backMetrics: metrics
        };
        if (bDoc.file) payload.backFile = bDoc.file;
        else if (bDoc.dataUrl) payload.backBase64 = bDoc.dataUrl;

        const res = await api.verify.validateAddressProof(payload);
        setBackValidation(res);

        if (!res.valid) {
          setValidationError(res.error || 'Back document validation failed.');
        }
      } catch (err) {
        console.error('Back validation error:', err);
        setValidationError(err.message || 'Failed to validate back document.');
      } finally {
        setValidatingSide(null);
      }
      return;
    }

    // 3. Both Front and Back provided -> run combined validation
    if (fDoc && bDoc) {
      setValidatingSide('both');
      try {
        const [fMetrics, bMetrics] = await Promise.all([
          computeMetrics(fDoc),
          computeMetrics(bDoc)
        ]);

        const payload = {
          documentType: selectedType,
          side: 'both',
          frontMetrics: fMetrics,
          backMetrics: bMetrics
        };

        if (fDoc.file) payload.frontFile = fDoc.file;
        else if (fDoc.dataUrl) payload.frontBase64 = fDoc.dataUrl;

        if (bDoc.file) payload.backFile = bDoc.file;
        else if (bDoc.dataUrl) payload.backBase64 = bDoc.dataUrl;

        const res = await api.verify.validateAddressProof(payload);
        setCombinedValidation(res);
        setFrontValidation(res.frontResult ? { valid: !res.error?.includes('Front'), ...res.frontResult } : res);
        setBackValidation(res.backResult ? { valid: !res.error?.includes('Back'), ...res.backResult } : res);

        if (!res.valid) {
          setValidationError(res.error || 'Document validation failed. Please check document quality or type.');
        }
      } catch (err) {
        console.error('Combined validation error:', err);
        setValidationError(err.message || 'Failed to validate address proof document.');
      } finally {
        setValidatingSide(null);
      }
    }
  }

  function handleDocTypeChange(newType) {
    setDocType(newType);
    setCombinedValidation(null);
    setFrontValidation(null);
    setBackValidation(null);
    if (frontDoc || backDoc) {
      triggerValidation(frontDoc, backDoc, newType);
    }
  }

  async function startCameraForSide(side, mode = facingMode) {
    stopCamera();
    setValidationError('');
    setActiveSide(side);
    setStreamReady(false);

    try {
      const stream = await getCameraStream(mode);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((e) => console.warn('Play error:', e));
          setStreamReady(true);
        };
        videoRef.current.play().catch((e) => console.warn('Play error:', e));
      }

      setCameraActive(true);
      setStreamReady(true);
    } catch (err) {
      console.warn('Camera stream failed:', err);
      setCameraActive(false);
      setActiveSide(null);
      setValidationError('Unable to access camera. Please allow camera permissions or upload a file.');
    }
  }

  function stopCamera() {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setActiveSide(null);
    setStreamReady(false);
  }

  function toggleCamera() {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (activeSide) {
      startCameraForSide(activeSide, newMode);
    }
  }

  function takeSnapshot() {
    if (!videoRef.current || !activeSide) return;

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

    const docObj = {
      file: null,
      dataUrl: dataUrl,
      previewUrl: dataUrl,
      name: `${docType.replace(/\s+/g, '_')}_${activeSide.toUpperCase()}_Photo.jpg`,
      size: Math.round((dataUrl.length * 3) / 4),
      type: 'image',
      isExisting: false
    };

    const sideCaptured = activeSide;
    stopCamera();

    if (sideCaptured === 'front') {
      setFrontDoc(docObj);
      triggerValidation(docObj, backDoc, docType);
    } else {
      setBackDoc(docObj);
      triggerValidation(frontDoc, docObj, docType);
    }
  }

  function handleFileSelection(e, side) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setValidationError('File size exceeds 15MB limit. Please upload a smaller file.');
      e.target.value = '';
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const docObj = {
      file: file,
      dataUrl: null,
      previewUrl: isPdf ? null : URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      type: isPdf ? 'pdf' : 'image',
      isExisting: false
    };

    e.target.value = '';

    if (side === 'front') {
      setFrontDoc(docObj);
      triggerValidation(docObj, backDoc, docType);
    } else {
      setBackDoc(docObj);
      triggerValidation(frontDoc, docObj, docType);
    }
  }

  function handleRemoveSide(side) {
    setValidationError('');
    setCombinedValidation(null);
    if (side === 'front') {
      setFrontDoc(null);
      setFrontValidation(null);
      if (backDoc) triggerValidation(null, backDoc, docType);
    } else {
      setBackDoc(null);
      setBackValidation(null);
      if (frontDoc) triggerValidation(frontDoc, null, docType);
    }
  }

  async function handleContinue() {
    if (!docType) {
      setValidationError('Please select an Address Proof document type.');
      return;
    }

    if (!frontDoc) {
      setValidationError('Please provide the FRONT SIDE of the address proof.');
      return;
    }

    if (!backDoc) {
      setValidationError('Please provide the BACK SIDE of the address proof.');
      return;
    }

    if (!combinedValidation || !combinedValidation.valid) {
      setValidationError(combinedValidation?.error || 'Document validation must pass before continuing.');
      return;
    }

    setLoading(true);
    setValidationError('');

    try {
      const payload = {
        documentType: docType
      };

      if (frontDoc.file) {
        payload.frontFile = frontDoc.file;
      } else if (frontDoc.dataUrl) {
        payload.frontBase64 = frontDoc.dataUrl;
      }

      if (backDoc.file) {
        payload.backFile = backDoc.file;
      } else if (backDoc.dataUrl) {
        payload.backBase64 = backDoc.dataUrl;
      }

      const res = await api.verify.uploadDocument(payload);

      updateProgress({
        addressProofUploaded: true,
        documentType: docType,
        documentOriginalName: res.fileName,
        documentUrl: res.fileUrl,
        documentBackOriginalName: res.backFileName,
        documentBackUrl: res.backFileUrl
      });

      nextStep();
    } catch (err) {
      console.error('Document upload error:', err);
      setValidationError(err.message || 'Failed to upload address proof document. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const isCompleteAndValid = Boolean(
    frontDoc &&
    backDoc &&
    combinedValidation?.valid === true &&
    combinedValidation?.qualityPassed === true
  );

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Upload Address Proof</h2>
      <p className="emp-step-instruction">
        Please provide both the <strong>FRONT</strong> and <strong>BACK</strong> sides of your address proof document. The system will automatically verify document quality, detect document type, and read the address in English or Tamil.
      </p>

      {/* 1. Document Type Selector */}
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label" style={{ fontWeight: 700 }}>
          Document Type <span className="required">*</span>
        </label>
        <select
          id="select-document-type"
          className="form-control form-select"
          value={docType}
          onChange={(e) => handleDocTypeChange(e.target.value)}
          disabled={cameraActive || loading || validatingSide}
          style={{ fontSize: '0.96rem' }}
        >
          {docTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputFrontRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelection(e, 'front')}
      />
      <input
        ref={fileInputBackRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelection(e, 'back')}
      />

      {/* 2. Active Camera Viewfinder */}
      {cameraActive && (
        <div style={{
          backgroundColor: '#0F172A',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '22px',
          color: '#FFFFFF',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
              <Camera size={18} color="#38BDF8" />
              <span>Capturing {activeSide === 'front' ? 'FRONT SIDE' : 'BACK SIDE'}</span>
            </div>
            <button
              type="button"
              onClick={stopCamera}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 8px', color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.15)', border: 'none' }}
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
          </div>

          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto 14px auto',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#000000',
            aspectRatio: '4/3'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Document Guide Overlay */}
            <div style={{
              position: 'absolute',
              top: '10%',
              left: '8%',
              right: '8%',
              bottom: '10%',
              border: '2px dashed rgba(56, 189, 248, 0.8)',
              borderRadius: '6px',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)'
            }}>
              <span style={{
                color: '#38BDF8',
                backgroundColor: 'rgba(0,0,0,0.65)',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: 600
              }}>
                Align {activeSide === 'front' ? 'Front' : 'Back'} within frame
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={takeSnapshot}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                fontSize: '1rem',
                fontWeight: 700
              }}
            >
              <Camera size={20} />
              <span>Capture Photo</span>
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#FFFFFF',
                border: 'none'
              }}
              title="Flip camera"
            >
              <SwitchCamera size={18} />
              <span>Flip Camera</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Document Sections: FRONT SIDE & BACK SIDE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
        
        {/* ================= FRONT SIDE SECTION ================= */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: `1px solid ${frontDoc ? (frontValidation?.valid === false ? '#EF4444' : '#10B981') : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                fontWeight: 800,
                fontSize: '0.85rem',
                letterSpacing: '0.05em',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: '#1E293B',
                color: '#FFFFFF'
              }}>
                FRONT SIDE
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                (Front of ID Card / Page 1)
              </span>
            </div>

            {validatingSide === 'front' || validatingSide === 'both' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.78rem',
                color: '#2563EB',
                fontWeight: 600
              }}>
                <RefreshCw size={13} className="spin" />
                <span>Analyzing Quality & OCR...</span>
              </span>
            ) : frontDoc ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: frontValidation?.valid === false ? '#B91C1C' : '#047857',
                backgroundColor: frontValidation?.valid === false ? '#FEF2F2' : '#ECFDF5',
                padding: '3px 8px',
                borderRadius: '12px',
                border: `1px solid ${frontValidation?.valid === false ? '#FCA5A5' : '#A7F3D0'}`
              }}>
                {frontValidation?.valid === false ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                <span>{frontValidation?.valid === false ? 'Validation Failed' : 'Front Ready'}</span>
              </span>
            ) : (
              <span style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600 }}>
                * Required
              </span>
            )}
          </div>

          {!frontDoc ? (
            /* Upload / Camera Options */
            <div style={{
              border: '2px dashed var(--border-dark)',
              borderRadius: 'var(--radius-sm)',
              padding: '18px 14px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC'
            }}>
              <FileText size={36} color="var(--accent)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>
                Upload Front Image/File or Take Photo
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Supports PDF, JPG, JPEG, PNG (Max 15MB)
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputFrontRef.current?.click()}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={15} />
                  <span>Upload Front File</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCameraForSide('front')}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Camera size={15} />
                  <span>Take Front Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Preview Card */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#F8FAFC',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #E2E8F0',
              padding: '12px'
            }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {frontDoc.type === 'image' && (frontDoc.previewUrl || frontDoc.dataUrl) ? (
                  <div style={{
                    width: '90px',
                    height: '68px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '1px solid #CBD5E1',
                    flexShrink: 0,
                    backgroundColor: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={frontDoc.previewUrl || frontDoc.dataUrl}
                      alt="Front Side Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '90px',
                    height: '68px',
                    borderRadius: '4px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    flexShrink: 0
                  }}>
                    <FileText size={26} color="#DC2626" />
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#DC2626' }}>PDF</span>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary)', wordBreak: 'break-word' }}>
                    {frontDoc.name}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {frontDoc.size ? `${(frontDoc.size / (1024 * 1024)).toFixed(2)} MB` : 'Attached'} • {frontDoc.type === 'pdf' ? 'PDF Document' : 'Photo / Image'}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Replace / Retake / Remove */}
              <div style={{
                display: 'flex',
                gap: '8px',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '8px',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={() => fileInputFrontRef.current?.click()}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Upload size={13} />
                  <span>Replace File</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCameraForSide('front')}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Camera size={13} />
                  <span>Retake Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRemoveSide('front')}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', color: '#DC2626', borderColor: '#FCA5A5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Remove Front Side"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= BACK SIDE SECTION ================= */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: `1px solid ${backDoc ? (backValidation?.valid === false ? '#EF4444' : '#10B981') : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                fontWeight: 800,
                fontSize: '0.85rem',
                letterSpacing: '0.05em',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: '#1E293B',
                color: '#FFFFFF'
              }}>
                BACK SIDE
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                (Back of ID Card / Page 2)
              </span>
            </div>

            {validatingSide === 'back' || validatingSide === 'both' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.78rem',
                color: '#2563EB',
                fontWeight: 600
              }}>
                <RefreshCw size={13} className="spin" />
                <span>Analyzing Quality & OCR...</span>
              </span>
            ) : backDoc ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: backValidation?.valid === false ? '#B91C1C' : '#047857',
                backgroundColor: backValidation?.valid === false ? '#FEF2F2' : '#ECFDF5',
                padding: '3px 8px',
                borderRadius: '12px',
                border: `1px solid ${backValidation?.valid === false ? '#FCA5A5' : '#A7F3D0'}`
              }}>
                {backValidation?.valid === false ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                <span>{backValidation?.valid === false ? 'Validation Failed' : 'Back Ready'}</span>
              </span>
            ) : (
              <span style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 600 }}>
                * Required
              </span>
            )}
          </div>

          {!backDoc ? (
            /* Upload / Camera Options */
            <div style={{
              border: '2px dashed var(--border-dark)',
              borderRadius: 'var(--radius-sm)',
              padding: '18px 14px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC'
            }}>
              <FileText size={36} color="var(--accent)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>
                Upload Back Image/File or Take Photo
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Supports PDF, JPG, JPEG, PNG (Max 15MB)
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputBackRef.current?.click()}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={15} />
                  <span>Upload Back File</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCameraForSide('back')}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Camera size={15} />
                  <span>Take Back Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Preview Card */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#F8FAFC',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #E2E8F0',
              padding: '12px'
            }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {backDoc.type === 'image' && (backDoc.previewUrl || backDoc.dataUrl) ? (
                  <div style={{
                    width: '90px',
                    height: '68px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '1px solid #CBD5E1',
                    flexShrink: 0,
                    backgroundColor: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={backDoc.previewUrl || backDoc.dataUrl}
                      alt="Back Side Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '90px',
                    height: '68px',
                    borderRadius: '4px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    flexShrink: 0
                  }}>
                    <FileText size={26} color="#DC2626" />
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#DC2626' }}>PDF</span>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary)', wordBreak: 'break-word' }}>
                    {backDoc.name}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {backDoc.size ? `${(backDoc.size / (1024 * 1024)).toFixed(2)} MB` : 'Attached'} • {backDoc.type === 'pdf' ? 'PDF Document' : 'Photo / Image'}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Replace / Retake / Remove */}
              <div style={{
                display: 'flex',
                gap: '8px',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '8px',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={() => fileInputBackRef.current?.click()}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Upload size={13} />
                  <span>Replace File</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCameraForSide('back')}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Camera size={13} />
                  <span>Retake Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRemoveSide('back')}
                  disabled={cameraActive || loading || validatingSide}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.78rem', color: '#DC2626', borderColor: '#FCA5A5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Remove Back Side"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 4. VALIDATION RESULT AREA */}
      {/* (A) Loading Spinner during analysis */}
      {validatingSide && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#1D4ED8',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '20px'
        }}>
          <RefreshCw size={20} className="spin" />
          <span>
            {validatingSide === 'both'
              ? 'Analyzing Document Quality, English/Tamil OCR & Document Type...'
              : `Analyzing ${validatingSide === 'front' ? 'Front' : 'Back'} side quality & text...`}
          </span>
        </div>
      )}

      {/* (B) Validation Failure Error Box */}
      {validationError && !validatingSide && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          color: '#B91C1C',
          fontSize: '0.9rem',
          lineHeight: 1.45,
          marginBottom: '20px'
        }}>
          <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: '3px' }}>Validation Alert</div>
            <div>{validationError}</div>
          </div>
        </div>
      )}

      {/* (C) Validation PASSED Green Quality Result Box */}
      {combinedValidation && combinedValidation.valid && !validatingSide && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '2px solid #10B981',
          borderRadius: 'var(--radius-md)',
          padding: '18px',
          marginBottom: '22px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 800,
            fontSize: '1.05rem',
            color: '#047857',
            marginBottom: '14px'
          }}>
            <CheckCircle2 size={24} color="#059669" />
            <span>Document Quality Verified & Clear – PASSED</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            padding: '12px 14px',
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #A7F3D0',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700, fontSize: '0.88rem' }}>
              <span style={{ color: '#059669', fontSize: '1.1rem' }}>✓</span>
              <span>Image Clear</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700, fontSize: '0.88rem' }}>
              <span style={{ color: '#059669', fontSize: '1.1rem' }}>✓</span>
              <span>Text Readable</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700, fontSize: '0.88rem' }}>
              <span style={{ color: '#059669', fontSize: '1.1rem' }}>✓</span>
              <span>Correct Document Type</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700, fontSize: '0.88rem' }}>
              <span style={{ color: '#059669', fontSize: '1.1rem' }}>✓</span>
              <span>Front/Back Valid</span>
            </div>
          </div>

          {/* Document Name & Address Extraction & Match Preview */}
          {(combinedValidation.extractedAddress || combinedValidation.extractedName) && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #A7F3D0',
              padding: '12px 14px'
            }}>
              {combinedValidation.extractedName && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#065F46',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px'
                  }}>
                    Document Name:
                  </div>
                  <div style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #E2E8F0',
                    wordBreak: 'break-word'
                  }}>
                    {combinedValidation.extractedName}
                  </div>
                </div>
              )}

              {combinedValidation.extractedAddress && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#065F46',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px'
                  }}>
                    Address in Document:
                  </div>
                  <div style={{
                    fontSize: '0.86rem',
                    fontFamily: 'monospace',
                    color: '#0F172A',
                    lineHeight: 1.45,
                    backgroundColor: '#F8FAFC',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #E2E8F0',
                    wordBreak: 'break-word'
                  }}>
                    {combinedValidation.extractedAddress}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {combinedValidation.nameMatch && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    backgroundColor: (combinedValidation.nameMatch.hrNameMatch === 'MATCH' || combinedValidation.nameMatch.employeeConfirmedNameMatch === 'MATCH') ? '#ECFDF5' : '#FFFBEB',
                    color: (combinedValidation.nameMatch.hrNameMatch === 'MATCH' || combinedValidation.nameMatch.employeeConfirmedNameMatch === 'MATCH') ? '#047857' : '#B45309',
                    border: `1px solid ${(combinedValidation.nameMatch.hrNameMatch === 'MATCH' || combinedValidation.nameMatch.employeeConfirmedNameMatch === 'MATCH') ? '#A7F3D0' : '#FCD34D'}`
                  }}>
                    <span>Name Match:</span>
                    <span>{(combinedValidation.nameMatch.hrNameMatch === 'MATCH' || combinedValidation.nameMatch.employeeConfirmedNameMatch === 'MATCH') ? 'MATCH' : (combinedValidation.nameMatch.hrNameMatch || 'PARTIAL MATCH')}</span>
                  </div>
                )}

                {combinedValidation.addressMatch && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    backgroundColor: (combinedValidation.addressMatch.hrAddressMatch === 'MATCH' || combinedValidation.addressMatch.employeeConfirmedAddressMatch === 'MATCH') ? '#ECFDF5' : '#FFFBEB',
                    color: (combinedValidation.addressMatch.hrAddressMatch === 'MATCH' || combinedValidation.addressMatch.employeeConfirmedAddressMatch === 'MATCH') ? '#047857' : '#B45309',
                    border: `1px solid ${(combinedValidation.addressMatch.hrAddressMatch === 'MATCH' || combinedValidation.addressMatch.employeeConfirmedAddressMatch === 'MATCH') ? '#A7F3D0' : '#FCD34D'}`
                  }}>
                    <span>Address Match:</span>
                    <span>{(combinedValidation.addressMatch.hrAddressMatch === 'MATCH' || combinedValidation.addressMatch.employeeConfirmedAddressMatch === 'MATCH') ? 'MATCH' : 'PARTIAL MATCH'}</span>
                  </div>
                )}

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0'
                }}>
                  <span>Overall Result:</span>
                  <span>{combinedValidation.addressMatch?.overallResult || 'MATCHED'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Bottom Navigation Actions */}
      <div className="emp-actions-bottom">
        <button
          id="btn-continue-doc"
          className="btn btn-primary btn-large"
          onClick={handleContinue}
          disabled={loading || !isCompleteAndValid || Boolean(validatingSide)}
          title={!isCompleteAndValid ? 'Please upload and validate both Front and Back sides to continue' : 'Continue to Declaration'}
        >
          <span>{loading ? 'Saving Document...' : 'Continue'}</span>
          <ArrowRight size={20} />
        </button>

        <button
          className="btn btn-secondary"
          onClick={prevStep}
          disabled={loading || cameraActive}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>
    </div>
  );
}
