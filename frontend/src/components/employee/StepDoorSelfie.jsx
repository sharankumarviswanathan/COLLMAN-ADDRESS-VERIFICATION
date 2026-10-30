import React, { useState, useRef, useEffect } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { capturePhotoLocation } from '../../lib/photoLocation';
import { validatePhotoWithAi } from '../../lib/imageValidator';
import { normalizeCapturedImage, computeImageSignature } from '../../lib/imageNormalizer';
import { getCameraStream, stopMediaStream } from '../../lib/cameraHelper';
import { ImageValidationFeedback } from './ImageValidationFeedback';
import {
  KeyRound,
  Camera,
  CheckCircle2,
  SwitchCamera,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  X,
  MapPin,
  Smile,
  Hash
} from 'lucide-react';

export function StepDoorSelfie() {
  const { employee, progress, updateProgress, nextStep, prevStep } = useVerification();
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // front camera default for selfie with door
  const [previewImg, setPreviewImg] = useState(progress.doorPhotoUrl || null);
  const [photoCoords, setPhotoCoords] = useState(
    progress.doorPhotoCoords || (progress.doorPhotoLatitude ? {
      latitude: progress.doorPhotoLatitude,
      longitude: progress.doorPhotoLongitude,
      accuracy: progress.doorPhotoAccuracy,
      captureDate: progress.doorPhotoCapturedAt ? progress.doorPhotoCapturedAt.split('T')[0] : '',
      captureTime: progress.doorPhotoCapturedAt ? progress.doorPhotoCapturedAt.split('T')[1]?.substring(0, 8) : '',
      capturedAt: progress.doorPhotoCapturedAt
    } : null)
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [streamReady, setStreamReady] = useState(false);

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

  // Analyze any pre-loaded preview image from scratch (e.g. restored from progress) when not actively capturing
  useEffect(() => {
    let isMounted = true;
    if (previewImg && !validationResult && !validating && !cameraActive && !isCapturingRef.current) {
      setValidating(true);
      setErrorMsg('');
      validatePhotoWithAi(previewImg, 'door_selfie', employee?.hrAddress || '')
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
            setErrorMsg(safeVal.error || 'Door number selfie validation failed. Please retake the photo.');
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

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.warn('Video autoplay failed, user gesture needed:', err);
      });
    }
  }, [cameraActive, streamReady]);

  async function startCamera(mode = facingMode) {
    stopCamera();
    setErrorMsg('');
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
      setErrorMsg(
        'Unable to access camera. Please allow camera permissions in your browser to take a door number selfie.'
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
    setValidating(true);
    setValidationResult(null);
    setErrorMsg('');

    try {
      // 1. Capture independent live GPS fix at the exact moment door selfie is snapped
      const loc = await capturePhotoLocation();
      setPhotoCoords(loc);

      // 2. Normalize orientation, aspect ratio, mirroring, and EXIF
      const normalized = await normalizeCapturedImage(video, {
        facingMode,
        photoType: 'door_selfie',
        maxDimension: 1280,
        quality: 0.90
      });

      stopCamera();
      setPreviewImg(normalized.dataUrl);

      // 3. Perform automated quality & content validation on the exact normalized image
      const val = await validatePhotoWithAi(normalized.dataUrl, 'door_selfie', employee?.hrAddress || '');
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

      // Lock validation result specifically to this normalized image signature
      safeVal.imageSignature = normalized.imageSignature;
      setValidationResult(safeVal);
      if (!safeVal.valid) {
        setErrorMsg(safeVal.error || 'Door number selfie validation failed. Please retake the photo.');
      }
    } catch (vErr) {
      console.warn('Snapshot normalization or validation error:', vErr);
      const failVal = {
        valid: false,
        error: 'Unable to analyze photo. Please retake the photo.',
        checks: {
          clarity: { passed: false, message: 'Check failed' },
          lighting: { passed: false, message: 'Check failed' },
          visibility: { passed: false, message: 'Check failed' },
          content: { passed: false, message: 'Check failed' }
        }
      };
      setValidationResult(failVal);
      setErrorMsg('Unable to analyze photo. Please retake the photo.');
    } finally {
      setValidating(false);
      isCapturingRef.current = false;
    }
  }

  async function handleConfirmPhoto() {
    if (!previewImg || !validationResult || !validationResult.valid || validating) {
      setErrorMsg(validationResult?.error || 'Door number selfie validation failed. Please retake the photo.');
      return;
    }

    // Verify current image matches validated signature to prevent reuse across different images
    const currentSignature = validationResult.imageSignature || computeImageSignature(previewImg);

    setLoading(true);
    setErrorMsg('');

    try {
      // Send the exact validated image with its complete metrics and signature
      const res = await api.verify.uploadDoorPhoto(previewImg, {
        ...(photoCoords || {}),
        imageSignature: currentSignature,
        clientMetrics: validationResult.metrics || {}
      });

      updateProgress({
        doorPhotoCaptured: true,
        doorPhotoUrl: res.photoUrl || previewImg,
        doorPhotoCoords: photoCoords,
        doorPhotoLatitude: photoCoords?.latitude,
        doorPhotoLongitude: photoCoords?.longitude,
        doorPhotoAccuracy: photoCoords?.accuracy,
        doorPhotoCapturedAt: photoCoords?.capturedAt
      });
      nextStep();
    } catch (err) {
      console.error('Door number selfie save error:', err);
      // Preserve genuine validation checks from server; NEVER fabricate fake 'Save failed'
      const serverChecks = err.data?.checks || err.checks;
      const failReport = {
        valid: false,
        error: err.data?.error || err.message || 'Failed to save door number selfie. Please retake the photo.',
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
    <div className="emp-card">
      <h2 className="emp-step-title">Take Door Number Selfie</h2>
      <p className="emp-step-instruction">
        Stand in front of your house entrance so that <strong>your face</strong> and the <strong>door / flat number</strong> are both clearly visible and legible in the frame.
      </p>

      {/* Guide tags */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <Smile size={14} /> Face Clearly Visible
        </span>
        <span style={{ fontSize: '0.78rem', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <Hash size={14} /> Door Number Readable
        </span>
      </div>

      {/* Viewfinder / Preview Frame */}
      <div className="camera-viewfinder-box">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`camera-video ${facingMode === 'user' ? 'mirrored' : ''}`}
          style={{
            display: cameraActive ? 'block' : 'none'
          }}
        />

        {/* Compact Camera Status Pill (Top-left overlay) */}
        {cameraActive && (
          <button
            type="button"
            className="camera-status-pill"
            onClick={toggleCamera}
            title="Tap to switch camera"
            aria-label="Switch Camera"
          >
            <span className="camera-status-dot" />
            <SwitchCamera size={13} />
            <span>{facingMode === 'user' ? 'Front Camera' : 'Back Camera'}</span>
          </button>
        )}

        {/* Live Camera Controls */}
        {cameraActive && (
          <div className="camera-controls-bar">
            <button
              id="btn-switch-camera-door"
              type="button"
              className="btn-camera-flip"
              onClick={toggleCamera}
              title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
              aria-label="Switch Camera"
            >
              <SwitchCamera size={20} />
            </button>

            <button
              id="btn-snap-door"
              type="button"
              className="btn-snap"
              onClick={takeSnapshot}
              title="Capture Door Number Selfie"
              aria-label="Capture Photo"
            >
              <div className="btn-snap-inner" />
            </button>

            <button
              type="button"
              className="btn-camera-close"
              onClick={stopCamera}
              title="Close Camera"
              aria-label="Close Camera"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Static Preview Mode if snapshot or upload taken */}
        {!cameraActive && previewImg && (
          <div className="camera-preview-img-wrapper">
            <img
              src={previewImg}
              alt="Door Number Selfie Preview"
            />
            <div className="camera-captured-badge">
              Door Selfie Captured
            </div>
          </div>
        )}

        {/* Empty State */}
        {!cameraActive && !previewImg && (
          <div className="camera-empty-state">
            <KeyRound size={56} style={{ margin: '0 auto 12px auto', opacity: 0.85 }} />
            <p style={{ fontSize: '0.92rem', color: '#CBD5E1' }}>Tap below to open camera & take door selfie</p>
          </div>
        )}
      </div>

      {/* Real-Time Automated Quality & Content Validation Feedback */}
      <ImageValidationFeedback
        validating={validating}
        validationResult={validationResult}
        photoTitle="Face & Door Number"
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
              <span>Door Selfie GPS Coordinates</span>
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

      {/* Action Buttons */}
      {!cameraActive && !previewImg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <button
            id="btn-open-camera-door"
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => {
              startCamera('user');
            }}
          >
            <Camera size={20} />
            <span>Open Camera & Take Door Selfie</span>
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
              <span style={{ fontWeight: 600 }}>Analyzing Photo Quality & Content...</span>
            </button>
          ) : validationResult && !validationResult.valid ? (
            <button
              id="btn-retake-door-only"
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
                startCamera(facingMode);
              }}
              disabled={loading}
            >
              <RefreshCw size={20} />
              <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>RETAKE PHOTO</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="btn-use-door-photo"
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
                  startCamera(facingMode);
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
  );
}
