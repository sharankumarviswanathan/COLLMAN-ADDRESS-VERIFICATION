/**
 * Helper to acquire live GPS coordinates and exact timestamps at the time a photo is captured.
 * Ensures each photo captures its own independent location fix.
 */

export function capturePhotoLocation() {
  return new Promise((resolve) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    
    // Format YYYY-MM-DD
    const captureDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    // Format HH:MM:SS
    const captureTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const capturedAt = now.toISOString();

    if (!navigator.geolocation) {
      resolve({
        latitude: null,
        longitude: null,
        accuracy: null,
        captureDate,
        captureTime,
        capturedAt
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy * 10) / 10,
          captureDate,
          captureTime,
          capturedAt
        });
      },
      (err) => {
        console.warn('Geolocation capture for photo failed/denied:', err);
        resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          captureDate,
          captureTime,
          capturedAt
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 15000
      }
    );
  });
}
