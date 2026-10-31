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
  MapPin
} from 'lucide-react';

export function StepSelfie() {
  const { progress, updateProgress, nextStep, prevStep } = useVerification();
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // default rear camera for employee photo
  const [tempSnapshot, setTempSnapshot] = useState(null);
  const [previewImg, setPreviewImg] = useState(progress.selfieUrl || null);
  const [photoCoords, setPhotoCoords] = useState(
    progress.selfieCoords || (progress.selfieLatitude ? {
      latitude: progress.selfieLatitude,
      longitude: progress.selfieLongitude,
      accuracy: progress.selfieAccuracy,
      captureDate: progress.selfieCapturedAt ? progress.selfieCapturedAt.split('T')[0] : '',
      captureTime: progress.selfieCapturedAt ? progress.selfieCapturedAt.split('T')[1]?.substring(0, 8) : '',
      capturedAt: progress.selfieCapturedAt
    } : null)
  );
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

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Analyze any preview image from scratch (unless snapshot is in-flight)
  useEffect(() => {
    let isMounted = true;
    if (previewImg && !validationResult && !validating && !cameraActive && !isCapturingRef.current) {
      setValidating(true);
      setErrorMsg('');
      validatePhotoWithAi(previewImg, 'selfie')
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
            setErrorMsg(safeVal.error || 'Live selfie validation failed. Please retake the photo.');
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

  // When cameraActive changes or tempSnapshot changes, ensure the video srcObject is attached and playing
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

      // Attach immediately to video element
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
        'Unable to access camera. Please allow camera permissions in your browser to capture the employee live photo.'
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
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  }

  async function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;

    isCapturingRef.current = true;
    setErrorMsg('');

    try {
      // 1. Capture independent live GPS fix at the exact moment photo is snapped
      const loc = await capturePhotoLocation();
      setPhotoCoords(loc);

      // 2. Normalize orientation, aspect ratio, mirroring, and EXIF
      const normalized = await normalizeCapturedImage(video, {
        facingMode,
        photoType: 'selfie',
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

  async function handleConfirmPhoto() {
    if (!previewImg || !validationResult || !validationResult.valid || validating) {
      setErrorMsg(validationResult?.error || 'Live selfie validation failed. Please retake the photo.');
      return;
    }

    const currentSignature = validationResult.imageSignature || computeImageSignature(previewImg);

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.verify.uploadSelfie(previewImg, {
        ...(photoCoords || {}),
        imageSignature: currentSignature,
        clientMetrics: validationResult.metrics || {}
      });
      updateProgress({
        selfieCaptured: true,
        selfieUrl: res.photoUrl || previewImg,
        selfieCoords: photoCoords,
        selfieLatitude: photoCoords?.latitude,
        selfieLongitude: photoCoords?.longitude,
        selfieAccuracy: photoCoords?.accuracy,
        selfieCapturedAt: photoCoords?.capturedAt
      });
      nextStep();
    } catch (err) {
      console.error('Selfie save error:', err);
      const serverChecks = err.data?.checks || err.checks;
      const failReport = {
        valid: false,
        error: err.data?.error || err.message || 'Failed to save selfie. Please retake the photo.',
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

  const canProceed = Boolean(previewImg && validationResult && validationResult.valid === true && !validating && !loading);

  return (
    <>
      {/* Full-Screen Camera Overlay (Mobile & Desktop) */}
      <FullscreenCameraModal
        isOpen={cameraActive}
        title="Capture Employee Selfie"
        icon={Camera}
        guidanceText="Frame employee face clearly"
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
      />

      {/* Main Verification Page Card */}
      <div className="emp-card">
        <h2 className="emp-step-title">Capture Employee Live Selfie</h2>
        <p className="emp-step-instruction">
          Capture a clear live photo of the employee for identity verification.
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
          <div><strong>• What to photograph:</strong> Live photo of the employee being verified.</div>
          <div><strong>• Where to stand:</strong> Stand facing the employee at eye level with adequate, even lighting.</div>
          <div><strong>• Requirement:</strong> Employee's full frontal face must be in clear focus, looking at the camera. No face masks, sunglasses, hats, or digital screens.</div>
        </div>

        {/* Static Framed Preview or Empty State */}
        <div className="camera-viewfinder-box" style={{ maxHeight: '360px' }}>
          {previewImg ? (
            <div className="camera-preview-img-wrapper">
              <img
                src={previewImg}
                alt="Selfie Preview"
              />
              <div className="camera-captured-badge">
                Captured Preview
              </div>
            </div>
          ) : (
            <div className="camera-empty-state">
              <Camera size={56} style={{ margin: '0 auto 12px auto', opacity: 0.85 }} />
              <p style={{ fontSize: '0.92rem', color: '#CBD5E1' }}>Tap below to open camera & capture employee selfie</p>
            </div>
          )}
        </div>

      {/* Real-Time Automated Quality & Content Validation Feedback */}
      <ImageValidationFeedback
        validating={validating}
        validationResult={validationResult}
        photoTitle="Live Employee Face"
      />

      {/* Live Location Metadata Box (Captured at exact time of photo) */}
      {!cameraActive && previewImg && (
        <div style={{
          margin: '12px 0 16px 0',
          padding: '12px 14px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.84rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={15} color="var(--accent)" />
              <span>Live Selfie GPS Coordinates</span>
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
                Lat: {photoCoords.latitude.toFixed(6)}, Lng: {photoCoords.longitude.toFixed(6)}
              </span>
              <span style={{ color: '#15803D', fontWeight: 600, fontSize: '0.78rem', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
                GPS Accuracy: ±{photoCoords.accuracy || 5} m
              </span>
            </div>
          ) : (
            <div style={{ color: '#64748B', fontSize: '0.8rem', fontStyle: 'italic' }}>
              Acquiring GPS fix or device location permission restricted.
            </div>
          )}
        </div>
      )}

      {/* Camera Action Buttons (When not active & no preview) */}
      {!cameraActive && !previewImg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <button
            id="btn-open-camera-selfie"
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => startCamera('user')}
          >
            <Camera size={20} />
            <span>Open Camera & Capture Employee Selfie</span>
          </button>
        </div>
      )}

      {/* Preview Confirmation Controls (After snapshot or file upload) */}
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
              <span style={{ fontWeight: 600 }}>Analyzing Photo Quality & Content...</span>
            </button>
          ) : validationResult && !validationResult.valid ? (
            <button
              id="btn-retake-selfie-only"
              type="button"
              className="btn btn-accent btn-large"
              style={{
                width: '100%',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                borderColor: '#B91C1C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onClick={() => {
                setPreviewImg(null);
                setValidationResult(null);
                setErrorMsg('');
                startCamera('user');
              }}
              disabled={loading}
            >
              <RefreshCw size={20} />
              <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>RETAKE PHOTO</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="btn-use-selfie"
                type="button"
                className="btn btn-success btn-large"
                style={{
                  flex: 1,
                  opacity: canProceed ? 1 : 0.5,
                  cursor: canProceed ? 'pointer' : 'not-allowed'
                }}
                onClick={handleConfirmPhoto}
                disabled={!canProceed || loading}
              >
                <CheckCircle2 size={20} />
                <span>{loading ? 'Saving...' : 'Use This Photo'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPreviewImg(null);
                  setValidationResult(null);
                  setErrorMsg('');
                  startCamera('user');
                }}
                disabled={loading}
              >
                <RefreshCw size={18} />
                <span>Retake</span>
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && (!validationResult || validationResult.valid) && (
        <div
          style={{
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--danger)',
            fontSize: '0.88rem',
            marginBottom: '16px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="emp-actions-bottom" style={{ paddingTop: '8px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            stopCamera();
            prevStep();
          }}
          disabled={loading}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>
    </div>
  </>
);
}
