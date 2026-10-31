import React, { useState, useRef, useEffect } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { capturePhotoLocation } from '../../lib/photoLocation';
import { validatePhotoWithAi } from '../../lib/imageValidator';
import { getCameraStream, stopMediaStream, getCameraZoomCapabilities, applyCameraZoom } from '../../lib/cameraHelper';
import { normalizeCapturedImage, computeImageSignature } from '../../lib/imageNormalizer';
import { ImageValidationFeedback } from './ImageValidationFeedback';
import FullscreenCameraModal from './FullscreenCameraModal';
import {
  Camera,
  CheckCircle2,
  SwitchCamera,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  X,
  MapPin,
  Users,
  ShieldCheck,
  UserCheck,
  FileCheck
} from 'lucide-react';

export function StepJointSelfie() {
  const { employee, progress, updateProgress, nextStep, prevStep } = useVerification();
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // front camera default for selfie
  const [tempSnapshot, setTempSnapshot] = useState(null);
  const [previewImg, setPreviewImg] = useState(progress.jointSelfieUrl || null);
  const [photoCoords, setPhotoCoords] = useState(
    progress.jointSelfieCoords || (progress.jointSelfieLatitude ? {
      latitude: progress.jointSelfieLatitude,
      longitude: progress.jointSelfieLongitude,
      accuracy: progress.jointSelfieAccuracy,
      captureDate: progress.jointSelfieCapturedAt ? progress.jointSelfieCapturedAt.split('T')[0] : '',
      captureTime: progress.jointSelfieCapturedAt ? progress.jointSelfieCapturedAt.split('T')[1]?.substring(0, 8) : '',
      capturedAt: progress.jointSelfieCapturedAt
    } : null)
  );

  // Authenticated Team Leader selection / identification
  const [tlList, setTlList] = useState([]);
  const [selectedTlId, setSelectedTlId] = useState(
    progress.jointSelfieTlId || employee?.teamLeader || ''
  );
  const [selectedTlName, setSelectedTlName] = useState(
    progress.jointSelfieTlName || employee?.teamLeader || ''
  );
  const [customTlInput, setCustomTlInput] = useState('');
  const [useCustomTl, setUseCustomTl] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [streamReady, setStreamReady] = useState(false);
  const [zoomCapabilities, setZoomCapabilities] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  async function handleSetZoom(level) {
    setZoomLevel(level);
    if (streamRef.current) {
      await applyCameraZoom(streamRef.current, level);
    }
  }

  // Validation state: always starts as null to force validation from scratch
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isCapturingRef = useRef(false);

  // Load team leaders on mount
  useEffect(() => {
    let isMounted = true;
    api.verify.getTlList()
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.teamLeaders)) {
          setTlList(data.teamLeaders);

          // If no TL selected yet, match with assigned employee.teamLeader
          if (!selectedTlId && employee?.teamLeader) {
            const matched = data.teamLeaders.find(
              (t) => t.full_name?.toLowerCase() === employee.teamLeader.toLowerCase() ||
                     t.username?.toLowerCase() === employee.teamLeader.toLowerCase()
            );
            if (matched) {
              setSelectedTlId(matched.username || String(matched.id));
              setSelectedTlName(matched.full_name);
            } else {
              setSelectedTlName(employee.teamLeader);
              setSelectedTlId(employee.teamLeader);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch team leaders list:', err);
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  // When preview image exists and has not been validated yet, analyze (unless snapshot is in-flight)
  useEffect(() => {
    let isMounted = true;
    if (previewImg && !validationResult && !validating && !cameraActive && !isCapturingRef.current) {
      setValidating(true);
      setErrorMsg('');
      validatePhotoWithAi(previewImg, 'joint_selfie')
        .then((val) => {
          if (!isMounted) return;
          const safeVal = val && typeof val === 'object' ? val : {
            valid: false,
            error: 'Unable to analyze photo. Please retake the photo.',
            checks: {
              clarity: { passed: false, message: 'Check failed' },
              lighting: { passed: false, message: 'Check failed' },
              visibility: { passed: false, message: 'Check failed' },
              content: { passed: false, message: 'Check failed' }
            }
          };
          setValidationResult(safeVal);
          if (!safeVal.valid) {
            setErrorMsg(safeVal.error || 'TL & Employee Joint Selfie validation failed. Please retake the photo.');
          }
        })
        .catch(() => {
          if (!isMounted) return;
          setValidationResult({
            valid: false,
            error: 'Unable to analyze photo. Please retake the photo.',
            checks: {
              clarity: { passed: false, message: 'Check failed' },
              lighting: { passed: false, message: 'Check failed' },
              visibility: { passed: false, message: 'Check failed' },
              content: { passed: false, message: 'Check failed' }
            }
          });
          setErrorMsg('Unable to analyze photo. Please retake the photo.');
        })
        .finally(() => {
          if (isMounted) setValidating(false);
        });
    }
    return () => { isMounted = false; };
  }, [previewImg, cameraActive]);

  // When cameraActive changes or tempSnapshot changes, attach video stream
  useEffect(() => {
    if (cameraActive && !tempSnapshot && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.warn('Video autoplay failed, user gesture needed:', err);
      });
    }
  }, [cameraActive, streamReady, tempSnapshot]);

  async function startCamera(mode = facingMode) {
    stopCamera();
    setErrorMsg('');
    setStreamReady(false);
    setTempSnapshot(null);

    try {
      const stream = await getCameraStream(mode);
      streamRef.current = stream;

      const caps = getCameraZoomCapabilities(stream);
      setZoomCapabilities(caps);
      setZoomLevel(caps?.supported ? caps.min : 1.0);

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
      setErrorMsg(
        'Unable to access live camera. Please allow camera permissions in your browser to capture the joint selfie.'
      );
    }
  }

  function stopCamera() {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setStreamReady(false);
  }

  function toggleCamera() {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  }

  async function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;

    isCapturingRef.current = true;
    setErrorMsg('');

    try {
      // 1. Capture live GPS fix at exact moment photo is snapped
      const loc = await capturePhotoLocation();
      setPhotoCoords(loc);

      // 2. Normalize orientation, aspect ratio, mirroring, and EXIF
      const normalized = await normalizeCapturedImage(video, {
        facingMode,
        photoType: 'joint_selfie',
        maxDimension: 1280,
        quality: 0.90
      });

      // Keep full-screen camera open in review mode with Retake and Use Photo buttons
      setTempSnapshot(normalized);
    } catch (vErr) {
      console.warn('Snapshot normalization or capture error:', vErr);
      setErrorMsg('Unable to capture photo. Please try again.');
    } finally {
      isCapturingRef.current = false;
    }
  }

  function handleRetakeInCamera() {
    setTempSnapshot(null);
    startCamera(facingMode);
  }

  function handleUsePhotoFromCamera() {
    if (!tempSnapshot) return;
    const captured = tempSnapshot;
    stopCamera();
    setCameraActive(false);
    setTempSnapshot(null);
    setValidationResult(null);
    setErrorMsg('');
    setPreviewImg(captured.dataUrl);
  }

  function handleSelectTl(e) {
    const val = e.target.value;
    if (val === 'CUSTOM') {
      setUseCustomTl(true);
      setSelectedTlId('');
      setSelectedTlName('');
    } else {
      setUseCustomTl(false);
      const found = tlList.find((t) => (t.username || String(t.id)) === val);
      if (found) {
        setSelectedTlId(found.username || String(found.id));
        setSelectedTlName(found.full_name);
      } else {
        setSelectedTlId(val);
        setSelectedTlName(val);
      }
    }
  }

  async function handleConfirmPhoto() {
    if (!previewImg || !validationResult || !validationResult.valid || validating) {
      setErrorMsg(validationResult?.error || 'TL & Employee Joint Selfie validation failed. Please retake the photo.');
      return;
    }

    const effectiveTlId = useCustomTl ? customTlInput.trim() : (selectedTlId || selectedTlName || 'TL');
    const effectiveTlName = useCustomTl ? customTlInput.trim() : (selectedTlName || selectedTlId || 'Team Leader');

    if (!effectiveTlId) {
      setErrorMsg('Please select or specify the visiting Team Leader identity.');
      return;
    }

    const currentSignature = validationResult.imageSignature || computeImageSignature(previewImg);

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.verify.uploadJointSelfie(previewImg, {
        ...(photoCoords || {}),
        tlId: effectiveTlId,
        tlName: effectiveTlName,
        imageSignature: currentSignature,
        clientMetrics: validationResult.metrics || {}
      });

      updateProgress({
        jointSelfieCaptured: true,
        jointSelfieUrl: res.photoUrl || previewImg,
        jointSelfieCoords: photoCoords,
        jointSelfieLatitude: photoCoords?.latitude,
        jointSelfieLongitude: photoCoords?.longitude,
        jointSelfieAccuracy: photoCoords?.accuracy,
        jointSelfieCapturedAt: photoCoords?.capturedAt,
        jointSelfieTlId: res.tlId || effectiveTlId,
        jointSelfieTlName: res.tlName || effectiveTlName
      });

      nextStep();
    } catch (err) {
      console.error('Joint selfie save error:', err);
      const serverChecks = err.data?.checks || err.checks;
      const failReport = {
        valid: false,
        error: err.data?.error || err.message || 'Failed to save joint selfie. Please retake the photo.',
        checks: serverChecks || {
          clarity: validationResult?.checks?.clarity || { passed: true, message: 'Verified' },
          lighting: validationResult?.checks?.lighting || { passed: true, message: 'Verified' },
          visibility: validationResult?.checks?.visibility || { passed: true, message: 'Verified' },
          content: { passed: false, message: err.data?.error || err.message || 'Validation error' }
        }
      };
      setValidationResult(failReport);
      setErrorMsg(failReport.error);
    } finally {
      setLoading(false);
    }
  }

  const canProceed = Boolean(
    previewImg &&
    validationResult &&
    validationResult.valid === true &&
    !validating &&
    !loading
  );

  const verificationRef = progress?.caseReference || employee?.caseReference || `AV-${employee?.employeeId || 'COL'}`;

  return (
    <>
      {/* Full-Screen Camera Overlay (Mobile & Desktop) */}
      <FullscreenCameraModal
        isOpen={cameraActive}
        title="Capture Joint Selfie"
        icon={Users}
        guidanceText="Both TL & Employee must be in frame"
        videoRef={videoRef}
        tempSnapshot={tempSnapshot}
        facingMode={facingMode}
        onToggleCamera={toggleCamera}
        onClose={() => {
          stopCamera();
          setTempSnapshot(null);
        }}
        onCapture={takeSnapshot}
        onRetake={handleRetakeInCamera}
        onUsePhoto={handleUsePhotoFromCamera}
        zoomCapabilities={zoomCapabilities}
        zoomLevel={zoomLevel}
        onSetZoom={handleSetZoom}
      >
        {/* Dual-Person Framing Guide Overlay (When Camera is Live) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '70px 10px 90px 10px'
        }}>
          {/* Left Silhouette: Team Leader */}
          <div style={{
            width: '42%',
            height: '75%',
            border: '2px dashed rgba(56, 189, 248, 0.85)',
            borderRadius: '50% 50% 45% 45%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: '16px',
            backgroundColor: 'rgba(56, 189, 248, 0.10)'
          }}>
            <span style={{
              backgroundColor: 'rgba(14, 116, 144, 0.90)',
              color: '#FFFFFF',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '10px',
              letterSpacing: '0.5px'
            }}>
              TEAM LEADER
            </span>
          </div>

          {/* Right Silhouette: Employee */}
          <div style={{
            width: '42%',
            height: '75%',
            border: '2px dashed rgba(16, 185, 129, 0.85)',
            borderRadius: '50% 50% 45% 45%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: '16px',
            backgroundColor: 'rgba(16, 185, 129, 0.10)'
          }}>
            <span style={{
              backgroundColor: 'rgba(6, 78, 59, 0.90)',
              color: '#FFFFFF',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '10px',
              letterSpacing: '0.5px'
            }}>
              EMPLOYEE
            </span>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.65)',
          color: '#FFFFFF',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 5
        }}>
          Both TL & Employee must be in frame
        </div>
      </FullscreenCameraModal>

      {/* Main Verification Page Card */}
      <div className="emp-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 className="emp-step-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={24} color="var(--primary)" />
            <span>TL &amp; Employee Joint Selfie</span>
          </h2>
          <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
            Mandatory Step
          </span>
        </div>

        <p className="emp-step-instruction">
          Capture a live selfie showing both the Team Leader and employee together at the employee's residence.
        </p>

        {/* TL Photo Guidance Box */}
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: '14px',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          color: '#334155'
        }}>
          <div><strong>• What to photograph:</strong> Joint live selfie of the authorized Team Leader and the employee being verified.</div>
          <div><strong>• Where to stand:</strong> Stand together side-by-side at the employee's residential entrance.</div>
          <div><strong>• Requirement:</strong> Both faces must be clearly visible, unobstructed, and looking at the camera. Live camera capture only.</div>
        </div>

        {/* Verification & Identity Context Banner */}
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1.5px solid #E2E8F0',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: '16px',
          fontSize: '0.84rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>VERIFICATION REFERENCE</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                {verificationRef}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>EMPLOYEE DETAILS</div>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>
                {employee?.employeeName} ({employee?.employeeId})
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>AUTHENTICATED TEAM LEADER</div>
              <div style={{ fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <UserCheck size={14} />
                <span>{selectedTlName || employee?.teamLeader || 'Select Team Leader'}</span>
              </div>
            </div>
          </div>

          {/* TL Selection / Switcher if needed */}
          {!cameraActive && !previewImg && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Confirm Visiting Team Leader:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  id="select-team-leader"
                  value={useCustomTl ? 'CUSTOM' : selectedTlId}
                  onChange={handleSelectTl}
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  {employee?.teamLeader && (
                    <option value={employee.teamLeader}>
                      Assigned TL: {employee.teamLeader}
                    </option>
                  )}
                  {tlList.map((tl) => (
                    <option key={tl.id} value={tl.username || String(tl.id)}>
                      {tl.full_name} ({tl.username || 'ID: ' + tl.id}) {tl.branch ? `- ${tl.branch}` : ''}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Enter Other TL ID / Name</option>
                </select>

                {useCustomTl && (
                  <input
                    id="input-custom-tl"
                    type="text"
                    placeholder="Enter TL Employee ID / Full Name"
                    value={customTlInput}
                    onChange={(e) => setCustomTlInput(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.82rem'
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Static Viewfinder / Preview Frame */}
        <div className="camera-viewfinder-box" style={{ minHeight: '340px' }}>
          {previewImg ? (
            <div className="camera-preview-img-wrapper">
              <img
                src={previewImg}
                alt="TL & Employee Joint Selfie Preview"
              />
              <div className="camera-captured-badge" style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
                Captured Joint Selfie
              </div>
            </div>
          ) : (
            <div className="camera-empty-state">
              <Users size={56} style={{ margin: '0 auto 12px auto', opacity: 0.85, color: '#38BDF8' }} />
              <p style={{ fontSize: '0.94rem', color: '#F1F5F9', fontWeight: 600 }}>
                Live Camera Capture Only
              </p>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', maxWidth: '320px', margin: '4px auto 0 auto' }}>
                Both Team Leader and Employee must stand together within the camera frame with both faces clearly visible.
              </p>
            </div>
          )}
        </div>

      {/* Real-Time Automated Quality & Content Validation Feedback */}
      <ImageValidationFeedback
        validating={validating}
        validationResult={validationResult}
        photoTitle="TL & Employee Joint Faces"
      />

      {/* Live Location & Capture Metadata Box */}
      {!cameraActive && previewImg && (
        <div style={{
          margin: '12px 0 16px 0',
          padding: '12px 14px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.84rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={15} color="var(--accent)" />
              <span>Joint Selfie GPS Fix</span>
            </span>
            {photoCoords?.captureTime && (
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
                📅 {photoCoords.captureDate} ⏰ {photoCoords.captureTime}
              </span>
            )}
          </div>

          {photoCoords?.latitude ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0F172A', backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                Lat: {Number(photoCoords.latitude).toFixed(6)}, Lng: {Number(photoCoords.longitude).toFixed(6)}
              </span>
              <span style={{ color: '#15803D', fontWeight: 600, fontSize: '0.78rem', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                GPS Accuracy: ±{photoCoords.accuracy || 5} m
              </span>
              <span style={{ color: '#1E40AF', fontWeight: 600, fontSize: '0.78rem', backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                TL: {selectedTlName || 'Verified TL'}
              </span>
            </div>
          ) : (
            <div style={{ color: '#64748B', fontSize: '0.8rem', fontStyle: 'italic' }}>
              Acquiring GPS fix or device location permission restricted.
            </div>
          )}
        </div>
      )}

      {/* Camera Action Buttons (Live Camera Only - No Gallery Upload) */}
      {!cameraActive && !previewImg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <button
            id="btn-open-camera-joint"
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => startCamera('user')}
          >
            <Camera size={20} />
            <span>Open Camera &amp; Capture Joint Selfie</span>
          </button>
        </div>
      )}

      {/* Preview Confirmation Controls */}
      {previewImg && !cameraActive && (
        <div style={{ marginBottom: '16px' }}>
          {validating ? (
            <button
              type="button"
              className="btn btn-secondary btn-large"
              style={{
                width: '100%',
                opacity: 0.8,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#F0F9FF',
                borderColor: '#BAE6FD',
                color: '#0369A1'
              }}
              disabled
            >
              <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 600 }}>Analyzing Two-Face Visibility &amp; Clarity...</span>
            </button>
          ) : validationResult && !validationResult.valid ? (
            <button
              id="btn-retake-joint-selfie-only"
              type="button"
              className="btn btn-accent btn-large"
              style={{
                width: '100%',
                backgroundColor: '#DC2626',
                borderColor: '#B91C1C',
                color: '#FFFFFF'
              }}
              onClick={() => {
                setPreviewImg(null);
                setValidationResult(null);
                setErrorMsg('');
                startCamera(facingMode);
              }}
            >
              <RefreshCw size={18} />
              <span>Retake Joint Selfie (Both Faces Required)</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setPreviewImg(null);
                  setValidationResult(null);
                  setErrorMsg('');
                  startCamera(facingMode);
                }}
              >
                <RefreshCw size={16} />
                <span>Retake</span>
              </button>

              <button
                id="btn-confirm-joint-selfie"
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleConfirmPhoto}
                disabled={!canProceed}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Saving Verification...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirm &amp; Proceed to Review</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          fontSize: '0.86rem',
          marginBottom: '16px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Step Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={prevStep}
          disabled={cameraActive || loading}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {previewImg && validationResult?.valid && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmPhoto}
            disabled={!canProceed}
          >
            <span>Proceed to Review</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>

      <div style={{
        marginTop: '16px',
        padding: '10px 12px',
        backgroundColor: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.76rem',
        color: '#1E40AF',
        lineHeight: 1.45
      }}>
        <strong>Compliance Notice:</strong> This joint selfie records mutual in-person presence of the Team Leader and the employee at the verified physical address. Complete GPS accuracy, timestamp, and all other physical evidence remain available for HR and BGV audit.
      </div>
    </div>
  </>
);
}
