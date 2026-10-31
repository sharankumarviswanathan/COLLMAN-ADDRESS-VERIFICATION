import React, { useState, useEffect } from 'react';
import { SwitchCamera, X, RefreshCw, Check, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Universal Full-Screen Mobile & Desktop Camera Modal
 * - Fills the full mobile viewport cleanly without excessive zoom or unnecessary black space.
 * - Dynamically adapts between 'cover' (edge-to-edge full mobile screen) and 'contain' (complete uncropped sensor).
 * - Provides interactive Zoom controls (0.6x, 1x, 2x, 3x, +/-) on supported Android Chrome devices.
 * - Large, touch-friendly shutter and action buttons.
 */
export default function FullscreenCameraModal({
  isOpen,
  title,
  icon: Icon,
  guidanceText,
  videoRef,
  tempSnapshot,
  facingMode = 'environment',
  onToggleCamera,
  onClose,
  onCapture,
  onRetake,
  onUsePhoto,
  zoomCapabilities = null,
  zoomLevel = 1.0,
  onSetZoom,
  children
}) {
  const [fitMode, setFitMode] = useState('contain'); // default 'contain' to preserve natural uncropped sensor view
  const [isPortraitStream, setIsPortraitStream] = useState(true);

  // When video loads metadata, detect orientation of incoming video stream
  const handleLoadedMetadata = () => {
    if (videoRef?.current) {
      const v = videoRef.current;
      const vWidth = v.videoWidth || 0;
      const vHeight = v.videoHeight || 0;
      const streamIsPortrait = vHeight >= vWidth;
      setIsPortraitStream(streamIsPortrait);
    }
  };

  const toggleFitMode = () => {
    setFitMode((prev) => (prev === 'cover' ? 'contain' : 'cover'));
  };

  if (!isOpen) return null;

  return (
    <div className="fullscreen-camera-overlay" id="fullscreen-camera-modal">
      {/* Top Bar with Title, Mode Toggle, Switch & Close */}
      <div className="fullscreen-camera-topbar">
        <div className="fullscreen-camera-title">
          {Icon && <Icon size={20} color="#38BDF8" />}
          <span>{tempSnapshot ? `Review: ${title}` : title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Fit / Full Viewport Toggle */}
          <button
            type="button"
            className="fullscreen-camera-pill-btn"
            onClick={toggleFitMode}
            title={fitMode === 'contain' ? 'Switch to Full Screen (Edge-to-edge)' : 'Switch to Fit (Complete sensor frame)'}
          >
            {fitMode === 'contain' ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            <span>{fitMode === 'contain' ? 'Full' : 'Fit'}</span>
          </button>

          {/* Camera Flip Button in Top Bar (Non-overlapping static flex child) */}
          {!tempSnapshot && onToggleCamera && (
            <button
              type="button"
              className="fullscreen-camera-pill-btn"
              onClick={onToggleCamera}
              title="Switch Front / Back Camera"
            >
              <SwitchCamera size={13} />
              <span>{facingMode === 'user' ? 'Front' : 'Back'}</span>
            </button>
          )}

          {/* Close Camera Button */}
          <button
            type="button"
            className="fullscreen-camera-close-btn"
            onClick={onClose}
            title="Close Camera"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Viewport: Live Stream or Captured Review Photo */}
      <div className="fullscreen-camera-viewport">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className={`fullscreen-camera-video ${fitMode === 'contain' ? 'fit-contain' : 'fill-cover'} ${facingMode === 'user' ? 'mirrored' : ''}`}
          style={{ display: !tempSnapshot ? 'block' : 'none' }}
        />

        {tempSnapshot && (
          <img
            src={tempSnapshot.dataUrl}
            alt="Captured Photo Preview"
            className={`fullscreen-camera-preview-img ${fitMode === 'contain' ? 'fit-contain' : 'fill-cover'}`}
          />
        )}

        {/* Custom Overlay (e.g. Dual Person Silhouette) */}
        {!tempSnapshot && children}

        {/* Standard Guidance Badge */}
        {!tempSnapshot && guidanceText && !children && (
          <div className="fullscreen-camera-guidance-badge">
            {guidanceText}
          </div>
        )}
      </div>

      {/* Bottom Bar: Live Camera Shutter & Zoom OR Review Retake & Use Controls */}
      <div className="fullscreen-camera-bottombar">
        {!tempSnapshot ? (
          <>
            {/* Real-time Hardware Zoom Controls: Only render presets physically supported by device */}
            {zoomCapabilities?.supported && zoomCapabilities.max > zoomCapabilities.min && onSetZoom && (
              <div className="fullscreen-camera-zoom-bar">
                {/* 0.5x or 0.6x Ultra-Wide: only if hardware zoom goes down to <= 0.65 */}
                {zoomCapabilities.min <= 0.65 && (
                  <button
                    type="button"
                    id="btn-zoom-wide"
                    className={`zoom-preset-btn ${Math.abs(zoomLevel - zoomCapabilities.min) < 0.12 ? 'active' : ''}`}
                    onClick={() => onSetZoom(zoomCapabilities.min)}
                    title={`${zoomCapabilities.min <= 0.55 ? '0.5x' : `${zoomCapabilities.min}x`} Ultra-Wide View`}
                  >
                    {zoomCapabilities.min <= 0.55 ? '0.5x' : `${zoomCapabilities.min}x`}
                  </button>
                )}

                {/* 1x Standard View: only if 1.0 is within supported min and max */}
                {zoomCapabilities.min <= 1.0 && zoomCapabilities.max >= 1.0 && (
                  <button
                    type="button"
                    id="btn-zoom-1"
                    className={`zoom-preset-btn ${Math.abs(zoomLevel - 1.0) < 0.15 ? 'active' : ''}`}
                    onClick={() => onSetZoom(1.0)}
                    title="1x Natural View"
                  >
                    1x
                  </button>
                )}

                {/* 2x Telephoto: only if supported by hardware */}
                {zoomCapabilities.max >= 2.0 && (
                  <button
                    type="button"
                    id="btn-zoom-2"
                    className={`zoom-preset-btn ${Math.abs(zoomLevel - 2.0) < 0.2 ? 'active' : ''}`}
                    onClick={() => onSetZoom(2.0)}
                    title="2x Zoom"
                  >
                    2x
                  </button>
                )}

                {/* 3x Zoom: only if supported by hardware */}
                {zoomCapabilities.max >= 3.0 && (
                  <button
                    type="button"
                    id="btn-zoom-3"
                    className={`zoom-preset-btn ${Math.abs(zoomLevel - 3.0) < 0.25 ? 'active' : ''}`}
                    onClick={() => onSetZoom(3.0)}
                    title="3x Zoom"
                  >
                    3x
                  </button>
                )}

                {/* Zoom out fine-step */}
                {zoomLevel > zoomCapabilities.min && (
                  <button
                    type="button"
                    className="zoom-step-btn"
                    onClick={() => onSetZoom(Math.max(zoomCapabilities.min, Number((zoomLevel - (zoomCapabilities.step || 0.2)).toFixed(1))))}
                    title="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                )}

                {/* Zoom in fine-step */}
                {zoomLevel < zoomCapabilities.max && (
                  <button
                    type="button"
                    className="zoom-step-btn"
                    onClick={() => onSetZoom(Math.min(zoomCapabilities.max, Number((zoomLevel + (zoomCapabilities.step || 0.2)).toFixed(1))))}
                    title="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Shutter Controls Row */}
            <div className="fullscreen-camera-controls-row">
              {/* Flip Camera */}
              {onToggleCamera ? (
                <button
                  type="button"
                  className="btn-camera-flip"
                  onClick={onToggleCamera}
                  title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
                >
                  <SwitchCamera size={24} />
                </button>
              ) : (
                <div style={{ width: 48 }} />
              )}

              {/* Large Shutter Button */}
              <button
                type="button"
                className="btn-snap"
                onClick={onCapture}
                title="Capture Photo"
              >
                <div className="btn-snap-inner" />
              </button>

              {/* Close Camera */}
              <button
                type="button"
                className="btn-camera-close"
                onClick={onClose}
                title="Close Camera"
              >
                <X size={24} />
              </button>
            </div>
          </>
        ) : (
          /* Captured Photo Review Actions */
          <div className="fullscreen-review-actions">
            <button
              type="button"
              className="btn-camera-retake"
              onClick={onRetake}
            >
              <RefreshCw size={18} />
              <span>Retake</span>
            </button>

            <button
              type="button"
              className="btn-camera-use"
              onClick={onUsePhoto}
            >
              <Check size={20} />
              <span>Use Photo ✓</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
