import React, { useState, useRef, useEffect } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { capturePhotoLocation } from '../../lib/photoLocation';
import { validatePhotoInBrowser } from '../../lib/imageValidator';
import { getCameraStream, stopMediaStream } from '../../lib/cameraHelper';
import { ImageValidationFeedback } from './ImageValidationFeedback';
import {
  Landmark,
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

export function StepLandmarkPhoto() {
  const { progress, updateProgress, nextStep, prevStep } = useVerification();
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // default rear camera for landmark
  const [previewImg, setPreviewImg] = useState(progress.landmarkPhotoUrl || null);
  const [photoCoords, setPhotoCoords] = useState(
    progress.landmarkPhotoCoords || (progress.landmarkPhotoLatitude ? {
      latitude: progress.landmarkPhotoLatitude,
      longitude: progress.landmarkPhotoLongitude,
      accuracy: progress.landmarkPhotoAccuracy,
      captureDate: progress.landmarkPhotoCapturedAt ? progress.landmarkPhotoCapturedAt.split('T')[0] : '',
      captureTime: progress.landmarkPhotoCapturedAt ? progress.landmarkPhotoCapturedAt.split('T')[1]?.substring(0, 8) : '',
      capturedAt: progress.landmarkPhotoCapturedAt
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

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Analyze any preview image from scratch
  useEffect(() => {
    if (previewImg && !validationResult && !validating && !cameraActive) {
      setValidating(true);
      validatePhotoInBrowser(previewImg, 'landmark')
        .then((val) => {
          setValidationResult(val);
          if (!val.valid) {
            setErrorMsg(val.error || 'Nearby landmark validation failed. Please retake the photo.');
          }
        })
        .catch(() => {
          setValidationResult({
            valid: false,
            error: 'Photo validation failed. Please retake the photo.',
            checks: {
              clarity: { passed: false, message: 'Check failed' },
              lighting: { passed: false, message: 'Check failed' },
              visibility: { passed: false, message: 'Check failed' },
              content: { passed: false, message: 'Validation error' }
            }
          });
          setErrorMsg('Photo validation failed. Please retake the photo.');
        })
        .finally(() => {
          setValidating(false);
        });
    }
  }, [previewImg, cameraActive]);

  // When cameraActive changes, ensure the video srcObject is attached and playing
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
        'Unable to access camera. Please allow camera permissions in your browser to take a landmark photo.'
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
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Flip horizontally if front-facing user camera for natural mirror selfie
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    stopCamera();
    setPreviewImg(dataUrl);

    // 1. Capture independent live GPS fix at the exact moment landmark photo is snapped
    const loc = await capturePhotoLocation();
    setPhotoCoords(loc);

    // 2. Perform immediate automated validation on snapshot
    setValidating(true);
    setErrorMsg('');
    try {
      const val = await validatePhotoInBrowser(dataUrl, 'landmark');
      setValidationResult(val);
      if (!val.valid) {
        setErrorMsg(val.error || 'Nearby landmark validation failed. Please retake the photo.');
      }
    } catch (vErr) {
      console.warn('Validation error:', vErr);
      const failVal = {
        valid: false,
        error: 'Automated photo validation could not verify this image. Please retake the photo.',
        checks: {
          clarity: { passed: false, message: 'Check failed' },
          lighting: { passed: false, message: 'Check failed' },
          visibility: { passed: false, message: 'Check failed' },
          content: { passed: false, message: 'Validation error' }
        }
      };
      setValidationResult(failVal);
      setErrorMsg(failVal.error);
    } finally {
      setValidating(false);
    }
  }

  async function handleConfirmPhoto() {
    if (!previewImg) return;

    if (!validationResult || !validationResult.valid) {
      setErrorMsg(validationResult?.error || 'Nearby landmark validation failed. Please retake the photo.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.verify.uploadLandmarkPhoto(previewImg, {
        ...(photoCoords || {}),
        clientMetrics: validationResult?.metrics || {}
      });
      updateProgress({
        landmarkPhotoCaptured: true,
        landmarkPhotoUrl: res.photoUrl || previewImg,
        landmarkPhotoCoords: photoCoords,
        landmarkPhotoLatitude: photoCoords?.latitude,
        landmarkPhotoLongitude: photoCoords?.longitude,
        landmarkPhotoAccuracy: photoCoords?.accuracy,
        landmarkPhotoCapturedAt: photoCoords?.capturedAt
      });
      nextStep();
    } catch (err) {
      console.error('Landmark photo save error:', err);
      setErrorMsg(err.message || 'Failed to save landmark photo. Please retake the photo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Take Nearby Landmark Photo</h2>
      <p className="emp-step-instruction">
        Please capture a clear photo of a prominent nearby landmark (e.g. temple, shop, school, park, or public building) close to your residence.
      </p>

      {/* Viewfinder / Preview Frame */}
      <div className="camera-viewfinder-box">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{
            display: cameraActive ? 'block' : 'none',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
          }}
        />

        {/* Camera Switch Status Pill (Top of Viewfinder) */}
        {cameraActive && (
          <button
            type="button"
            className="camera-switch-pill"
            onClick={toggleCamera}
            title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
          >
            <SwitchCamera size={16} />
            <span>{facingMode === 'user' ? 'Front Camera' : 'Back Camera'} (Tap to switch)</span>
          </button>
        )}

        {/* Live Camera Controls */}
        {cameraActive && (
          <div className="camera-controls-bar">
            <button
              id="btn-switch-camera-landmark"
              type="button"
              className="btn-camera-flip"
              onClick={toggleCamera}
              title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
              aria-label="Switch Camera"
            >
              <SwitchCamera size={22} />
            </button>

            <button
              id="btn-snap-landmark"
              type="button"
              className="btn-snap"
              onClick={takeSnapshot}
              title="Capture Landmark Photo"
            >
              <div className="btn-snap-inner" />
            </button>

            <button
              type="button"
              className="btn-camera-close"
              onClick={stopCamera}
              title="Close Camera"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Static Preview Mode if snapshot or upload taken */}
        {!cameraActive && previewImg && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img
              src={previewImg}
              alt="Landmark Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                color: '#FFFFFF',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              Landmark Captured
            </div>
          </div>
        )}

        {/* Empty State */}
        {!cameraActive && !previewImg && (
          <div style={{ textAlign: 'center', color: '#94A3B8', padding: '24px' }}>
            <Landmark size={56} style={{ margin: '0 auto 12px auto', opacity: 0.85 }} />
            <p style={{ fontSize: '0.92rem', color: '#CBD5E1' }}>Tap below to open camera & take landmark photo</p>
          </div>
        )}
      </div>

      {/* Real-Time Automated Quality & Content Validation Feedback */}
      <ImageValidationFeedback
        validating={validating}
        validationResult={validationResult}
        photoTitle="Nearby Landmark"
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
              <span>Nearby Landmark Coordinates</span>
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
            id="btn-open-camera-landmark"
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => startCamera('environment')}
          >
            <Camera size={20} />
            <span>Open Camera & Take Landmark Photo</span>
          </button>
        </div>
      )}

      {/* Preview Confirmation Controls */}
      {previewImg && !cameraActive && (
        <div style={{ marginBottom: '16px' }}>
          {validationResult && !validationResult.valid ? (
            <button
              id="btn-retake-landmark-only"
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
                startCamera('environment');
              }}
              disabled={loading}
            >
              <RefreshCw size={20} />
              <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>RETAKE PHOTO</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="btn-use-landmark"
                type="button"
                className="btn btn-success btn-large"
                style={{
                  flex: 1,
                  opacity: (previewImg && validationResult?.valid && !validating) ? 1 : 0.5,
                  cursor: (previewImg && validationResult?.valid && !validating) ? 'pointer' : 'not-allowed'
                }}
                onClick={handleConfirmPhoto}
                disabled={!previewImg || !validationResult?.valid || validating || loading}
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
                  startCamera('environment');
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

      {errorMsg && (
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
