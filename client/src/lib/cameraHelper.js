/**
 * Camera Stream Helper for Mobile & Desktop Web
 * Handles Front / Back camera switching with graceful fallbacks.
 */

export async function getCameraStream(facingMode = 'environment') {
  const preferredMode = facingMode === 'user' ? 'user' : 'environment';

  // Attempt 1: Exact facingMode with ideal 720p HD resolution
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { exact: preferredMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
  } catch (err1) {
    // Attempt 2: Ideal facingMode with 720p HD
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: preferredMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch (err2) {
      // Attempt 3: Hardware device enumeration (distinguish front vs back camera IDs)
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');

          if (videoDevices.length > 1) {
            let targetDevice = null;
            if (preferredMode === 'user') {
              targetDevice =
                videoDevices.find((d) => /front|user|selfie|face/i.test(d.label)) ||
                videoDevices[0];
            } else {
              targetDevice =
                videoDevices.find((d) => /back|rear|environment/i.test(d.label)) ||
                videoDevices[videoDevices.length - 1];
            }

            if (targetDevice && targetDevice.deviceId) {
              return await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: targetDevice.deviceId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                },
                audio: false
              });
            }
          }
        }
      } catch (err3) {
        console.warn('Device enumeration fallback failed:', err3);
      }

      // Attempt 4: Most permissive basic video constraint
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }
  }
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
