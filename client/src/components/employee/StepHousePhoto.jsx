import React, { useState, useRef, useEffect } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { capturePhotoLocation } from '../../lib/photoLocation';
import { validatePhotoInBrowser } from '../../lib/imageValidator';
import { getCameraStream, stopMediaStream } from '../../lib/cameraHelper';
import { ImageValidationFeedback } from './ImageValidationFeedback';
import {
  Home,
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

export function StepHousePhoto() {
  const { progress, updateProgress, nextStep, prevStep } = useVerification();
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // default rear camera for house
  const [previewImg, setPreviewImg] = useState(progress.housePhotoUrl || null);
  const [photoCoords, setPhotoCoords] = useState(
    progress.housePhotoCoords || (progress.housePhotoLatitude ? {
      latitude: progress.housePhotoLatitude,
      longitude: progress.housePhotoLongitude,
      accuracy: progress.housePhotoAccuracy,
      captureDate: progress.housePhotoCapturedAt ? progress.housePhotoCapturedAt.split('T')[0] : '',
      captureTime: progress.housePhotoCapturedAt ? progress.housePhotoCapturedAt.split('T')[1]?.substring(0, 8) : '',
      capturedAt: progress.housePhotoCapturedAt
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
      validatePhotoInBrowser(previewImg, 'building')
        .then((val) => {
          setValidationResult(val);
          if (!val.valid) {
            setErrorMsg(val.error || 'Full building validation failed. Please retake the photo.');
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
        'Unable to access camera. Please allow camera permissions in your browser to take a full building photo.'
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

    // 1. Capture independent live GPS fix at the exact moment house photo is snapped
    const loc = await capturePhotoLocation();
    setPhotoCoords(loc);

    // 2. Perform immediate automated validation on snapshot
    setValidating(true);
    setErrorMsg('');
    try {
      const val = await validatePhotoInBrowser(dataUrl, 'building');
      setValidationResult(val);
      if (!val.valid) {
        setErrorMsg(val.error || 'Full building validation failed. Please retake the photo.');
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
      setErrorMsg(validationResult?.error || 'Full building validation failed. Please retake the photo.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.verify.uploadHousePhoto(previewImg, {
        ...(photoCoords || {}),
        clientMetrics: validationResult?.metrics || {}
      });
      updateProgress({
        housePhotoCaptured: true,
        housePhotoUrl: res.photoUrl || previewImg,
        housePhotoCoords: photoCoords,
        housePhotoLatitude: photoCoords?.latitude,
        housePhotoLongitude: photoCoords?.longitude,
        housePhotoAccuracy: photoCoords?.accuracy,
        housePhotoCapturedAt: photoCoords?.capturedAt
      });
      nextStep();
    } catch (err) {
      console.error('House photo save error:', err);
      setErrorMsg(err.message || 'Failed to save house photo. Please retake the photo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Take Full Building Photo</h2>
      <p className="emp-step-instruction">
        Please capture a clear photo showing the <strong>complete building / house structure</strong> from the outside.
      </p>

      {/* Viewfinder / Preview */}
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

        {/* Live Controls */}
        {cameraActive && (
          <div className="camera-controls-bar">
            <button
              id="btn-switch-camera-house"
              type="button"
              className="btn-camera-flip"
              onClick={toggleCamera}
              title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
              aria-label="Switch Camera"
            >
              <SwitchCamera size={20} />
            </button>

            <button
              id="btn-snap-house"
              type="button"
              className="btn-snap"
              onClick={takeSnapshot}
              title="Capture Photo"
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

        {/* Captured Preview */}
        {!cameraActive && previewImg && (
          <div className="camera-preview-img-wrapper">
            <img
              src={previewImg}
              alt="House Photo Preview"
            />
            <div className="camera-captured-badge">
              Full Building Captured
            </div>
          </div>
        )}

        {/* Empty State */}
        {!cameraActive && !previewImg && (
          <div className="camera-empty-state">
            <Home size={56} style={{ margin: '0 auto 12px auto', opacity: 0.85 }} />
            <p style={{ fontSize: '0.92rem', color: '#CBD5E1' }}>Tap below to open camera & take full building photo</p>
          </div>
        )}
      </div>

      {/* Real-Time Automated Quality & Content Validation Feedback */}
      <ImageValidationFeedback
        validating={validating}
        validationResult={validationResult}
        photoTitle="Full Building"
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
              <span>Full Building Coordinates</span>
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
            id="btn-open-camera-house"
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => startCamera('environment')}
          >
            <Camera size={20} />
            <span>Open Camera & Take Full Building Photo</span>
          </button>
        </div>
      )}

      {/* Preview Confirmation Controls */}
      {previewImg && !cameraActive && (
        <div style={{ marginBottom: '16px' }}>
          {validationResult && !validationResult.valid ? (
            <button
              id="btn-retake-house-only"
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
                id="btn-use-house-photo"
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
