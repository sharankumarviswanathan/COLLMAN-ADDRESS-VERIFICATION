/**
 * Camera Stream Helper for Mobile & Desktop Web
 * - Handles Front / Back camera switching with strict adherence to requested facingMode.
 * - Prevents artificial aspect-ratio cropping on mobile Android camera HALs.
 * - Reads genuine hardware zoom capabilities via MediaTrackCapabilities.
 * - Initializes camera stream to its widest supported field of view.
 */

/**
 * Normalizes hardware zoom on devices that support the 'zoom' constraint (e.g. Android Chrome).
 * Resets the active stream track to the camera's widest supported field of view (caps.zoom.min).
 */
export async function resetCameraZoom(stream) {
  if (!stream) return 1.0;
  try {
    const videoTrack = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    if (!videoTrack) return 1.0;

    if (typeof videoTrack.getCapabilities === 'function') {
      const caps = videoTrack.getCapabilities();
      if (caps && caps.zoom) {
        // Start with the widest supported camera field of view
        const minZoom = typeof caps.zoom.min === 'number' ? caps.zoom.min : 1.0;
        if (typeof videoTrack.applyConstraints === 'function') {
          try {
            await videoTrack.applyConstraints({
              advanced: [{ zoom: minZoom }]
            });
          } catch (e) {
            console.debug('Reset camera zoom note:', e);
          }
        }
        return minZoom;
      }
    }
  } catch (err) {
    console.debug('Camera zoom normalization note:', err);
  }
  return 1.0;
}

/**
 * Inspects device track capabilities and returns zoom boundaries & current zoom.
 * Only returns supported: true if caps.zoom exists AND max > min.
 */
export function getCameraZoomCapabilities(stream) {
  if (!stream) return { supported: false };
  try {
    const videoTrack = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    if (!videoTrack || typeof videoTrack.getCapabilities !== 'function') {
      return { supported: false };
    }

    const caps = videoTrack.getCapabilities();
    // Hardware zoom is only genuinely supported if caps.zoom exists AND max > min
    if (
      caps &&
      caps.zoom &&
      typeof caps.zoom.min === 'number' &&
      typeof caps.zoom.max === 'number' &&
      caps.zoom.max > caps.zoom.min
    ) {
      const settings = typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : {};
      return {
        supported: true,
        min: Number(caps.zoom.min),
        max: Number(caps.zoom.max),
        step: Number(caps.zoom.step ?? 0.1),
        current: Number(settings.zoom ?? caps.zoom.min)
      };
    }
  } catch (err) {
    console.debug('Error checking camera zoom capabilities:', err);
  }
  return { supported: false };
}

/**
 * Dynamically applies a user-selected zoom level to the active video track using valid MediaTrackConstraints.
 */
export async function applyCameraZoom(stream, zoomLevel) {
  if (!stream) return false;
  try {
    const videoTrack = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    if (!videoTrack || typeof videoTrack.applyConstraints !== 'function') return false;

    const numZoom = Number(zoomLevel);
    if (isNaN(numZoom)) return false;

    let targetZoom = numZoom;
    if (typeof videoTrack.getCapabilities === 'function') {
      const caps = videoTrack.getCapabilities();
      if (caps && caps.zoom) {
        const minZ = typeof caps.zoom.min === 'number' ? caps.zoom.min : 1.0;
        const maxZ = typeof caps.zoom.max === 'number' ? caps.zoom.max : 1.0;
        // Clamp to device track capability range to avoid OverconstrainedError on Android HALs
        targetZoom = Math.min(Math.max(numZoom, minZ), maxZ);
      }
    }

    await videoTrack.applyConstraints({
      advanced: [{ zoom: targetZoom }]
    });
    return true;
  } catch (err) {
    console.debug('Failed to apply camera zoom:', err);
    return false;
  }
}

/**
 * Requests camera stream optimized for natural, uncropped full mobile display.
 * - Respects facingMode ('environment' for rear, 'user' for front).
 * - Avoids artificial aspect ratio forcing (e.g. 9/16) which causes Android camera HAL to crop sensors.
 * - Starts at the camera's widest supported field of view.
 */
export async function getCameraStream(facingMode = 'environment') {
  const preferredMode = facingMode === 'user' ? 'user' : 'environment';
  let stream = null;

  // Attempt 1: Exact facingMode with standard high-res ideal (no forced aspect ratio)
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { exact: preferredMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
  } catch (exactErr) {
    // Attempt 2: Flexible facingMode
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: preferredMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
    } catch (idealErr) {
      console.debug('Preferred facingMode failed, falling back:', idealErr);
    }
  }

  // Attempt 3: Verify track facingMode; if device opened the opposite camera, query device list
  if (stream && navigator.mediaDevices.enumerateDevices) {
    try {
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings ? track.getSettings() : {};

      if (settings.facingMode && settings.facingMode !== preferredMode) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');

        let match = null;
        if (preferredMode === 'user') {
          match = videoDevices.find((d) => /front|user|selfie|face/i.test(d.label));
        } else {
          match =
            videoDevices.find((d) => /back|rear|environment/i.test(d.label) && !/front|user|selfie|macro|depth|aux/i.test(d.label)) ||
            videoDevices.find((d) => /back|rear|environment/i.test(d.label)) ||
            videoDevices.find((d) => !/front|user|selfie/i.test(d.label));
        }

        if (match && match.deviceId) {
          track.stop();
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: match.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
        }
      }
    } catch (checkErr) {
      console.debug('Device verification fallback note:', checkErr);
    }
  }

  // Attempt 4: General fallback
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: preferredMode } },
        audio: false
      });
    } catch (fErr) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }
  }

  // Start with the widest supported camera field of view
  if (stream) {
    await resetCameraZoom(stream);
  }

  return stream;
}

export function stopMediaStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        // ignore
      }
    });
  } catch (err) {
    console.warn('Error stopping stream tracks:', err);
  }
}
