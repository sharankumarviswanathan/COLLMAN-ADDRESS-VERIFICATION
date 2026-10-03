import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { Crosshair, ExternalLink, MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * GeoComparisonMap (100% Leaflet Implementation)
 *
 * Displays both HR registered address marker and live captured employee GPS marker
 * on a high-performance Leaflet OpenStreetMap with:
 * - 100-meter verification radius boundary circle around HR address
 * - Precise distance evaluation (<= 100m PASS, > 100m OUTSIDE RADIUS / REVIEW REQUIRED)
 * - Dashed connecting route line with clean non-overlapping distance badge
 * - Auto-fit camera bounds ensuring both markers & radius are fully in view
 * - Interactive popups with coordinates and address details
 */
export function GeoComparisonMap({
  hrLat,
  hrLng,
  capturedLat,
  capturedLng,
  hrAddress,
  submittedAddress,
  distanceMeters,
  distanceCategory
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const nHrLat = hrLat !== null && hrLat !== undefined ? parseFloat(hrLat) : null;
  const nHrLng = hrLng !== null && hrLng !== undefined ? parseFloat(hrLng) : null;
  const nCapturedLat = capturedLat !== null && capturedLat !== undefined ? parseFloat(capturedLat) : null;
  const nCapturedLng = capturedLng !== null && capturedLng !== undefined ? parseFloat(capturedLng) : null;

  const hasHrCoords = !isNaN(nHrLat) && !isNaN(nHrLng) && nHrLat !== null && nHrLng !== null;
  const hasCapturedCoords = !isNaN(nCapturedLat) && !isNaN(nCapturedLng) && nCapturedLat !== null && nCapturedLng !== null;
  const hasCoords = hasHrCoords || hasCapturedCoords;

  // Numeric distance in meters
  const distNumber = useMemo(() => {
    if (distanceMeters === null || distanceMeters === undefined || isNaN(parseFloat(distanceMeters))) {
      return null;
    }
    return parseFloat(distanceMeters);
  }, [distanceMeters]);

  // Formatted distance
  const formattedDistance = useMemo(() => {
    if (distNumber === null) return 'Calculated';
    return `${Math.round(distNumber)} m`;
  }, [distNumber]);

  // Fixed 100-meter verification rule
  const isInsideRadius = useMemo(() => {
    if (distNumber === null) return false;
    return distNumber <= 100;
  }, [distNumber]);

  const radiusStatusText = useMemo(() => {
    if (distNumber === null) return distanceCategory || 'Calculated';
    return isInsideRadius ? 'INSIDE RADIUS / PASS' : 'OUTSIDE RADIUS / REVIEW REQUIRED';
  }, [distNumber, isInsideRadius, distanceCategory]);

  useEffect(() => {
    if (!mapContainerRef.current || !hasCoords) return;

    // Clean up existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (mapContainerRef.current && mapContainerRef.current._leaflet_id) {
      mapContainerRef.current._leaflet_id = null;
    }

    const initialLat = hasCapturedCoords ? nCapturedLat : nHrLat;
    const initialLng = hasCapturedCoords ? nCapturedLng : nHrLng;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false, // will add custom positioned control
      scrollWheelZoom: true,
      attributionControl: true
    }).setView([initialLat, initialLng], 15);

    mapInstanceRef.current = map;

    // Add zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Standard OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    // 1. HR ADDRESS PIN & 100M RADIUS
    if (hasHrCoords) {
      const hrLatLng = [nHrLat, nHrLng];
      bounds.extend(hrLatLng);

      // 100-meter verification radius circle
      const circle = L.circle(hrLatLng, {
        radius: 100,
        color: isInsideRadius ? '#059669' : '#2563EB',
        fillColor: isInsideRadius ? '#10B981' : '#3B82F6',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '5, 6'
      }).addTo(map);

      // Extend bounds to encompass the entire 100m radius
      bounds.extend(circle.getBounds());

      circle.bindTooltip(
        '<span style="font-weight: 700; font-size: 11px;">100m Verification Boundary</span>',
        { permanent: false, direction: 'top' }
      );

      // Custom Blue Pin for HR Address
      const hrIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%);
            color: #FFFFFF;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 12px rgba(29, 78, 216, 0.45);
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-weight: 800; font-size: 11px; letter-spacing: 0.3px;">HR</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      const hrMarker = L.marker(hrLatLng, { icon: hrIcon }).addTo(map);
      hrMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; color: #1E40AF; margin-bottom: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #2563EB; display: inline-block;"></span>
            HR REGISTERED ADDRESS
          </div>
          <div style="color: #334155; margin-bottom: 6px;">
            ${hrAddress || 'Standard HR Registered Location'}
          </div>
          <div style="font-family: monospace; font-size: 11px; color: #64748B; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
            Lat: ${nHrLat.toFixed(6)}, Lng: ${nHrLng.toFixed(6)}
          </div>
        </div>
      `);
    }

    // 2. EMPLOYEE LIVE LOCATION PIN
    if (hasCapturedCoords) {
      const capturedLatLng = [nCapturedLat, nCapturedLng];
      bounds.extend(capturedLatLng);

      // Custom Green Pin for Live GPS
      const gpsIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #047857 0%, #059669 100%);
            color: #FFFFFF;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.45);
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-weight: 800; font-size: 10px; letter-spacing: 0.2px;">GPS</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      const gpsMarker = L.marker(capturedLatLng, { icon: gpsIcon }).addTo(map);
      gpsMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; color: #065F46; margin-bottom: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #059669; display: inline-block;"></span>
            EMPLOYEE LIVE GPS LOCATION
          </div>
          <div style="color: #334155; margin-bottom: 6px;">
            ${submittedAddress || 'Captured Live GPS Verification Position'}
          </div>
          <div style="font-family: monospace; font-size: 11px; color: #64748B; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
            Lat: ${nCapturedLat.toFixed(6)}, Lng: ${nCapturedLng.toFixed(6)}
          </div>
        </div>
      `);
    }

    // 3. CONNECTING ROUTE LINE & CLEAN MIDPOINT DISTANCE BADGE
    if (hasHrCoords && hasCapturedCoords) {
      const routeLine = L.polyline(
        [
          [nHrLat, nHrLng],
          [nCapturedLat, nCapturedLng]
        ],
        {
          color: isInsideRadius ? '#059669' : '#D97706',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.85
        }
      ).addTo(map);

      // Clean, non-overlapping midpoint tooltip
      const badgeBorderColor = isInsideRadius ? '#059669' : '#D97706';
      const badgeTextColor = isInsideRadius ? '#065F46' : '#92400E';
      const badgeBgColor = isInsideRadius ? '#ECFDF5' : '#FFFBEB';

      routeLine.bindTooltip(`
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          background-color: ${badgeBgColor};
          border: 1.5px solid ${badgeBorderColor};
          color: ${badgeTextColor};
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          white-space: nowrap;
        ">
          <span>📍 ${formattedDistance}</span>
          <span style="font-size: 9.5px; opacity: 0.9; font-weight: 700;">(${isInsideRadius ? 'PASS' : 'OUTSIDE RADIUS'})</span>
        </div>
      `, {
        permanent: true,
        direction: 'center',
        className: 'leaflet-clean-distance-pill'
      });
    }

    // 4. AUTO-FIT CAMERA BOUNDS
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 16
      });
    }

    // Ensure Leaflet calculates exact pixel sizes after DOM render
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasCoords, hasHrCoords, hasCapturedCoords, nHrLat, nHrLng, nCapturedLat, nCapturedLng, formattedDistance, isInsideRadius]);

  // Recenter / Fit Bounds button handler
  function handleRecenter() {
    if (!mapInstanceRef.current || !hasCoords) return;
    const map = mapInstanceRef.current;
    const bounds = L.latLngBounds([]);
    if (hasHrCoords) bounds.extend([nHrLat, nHrLng]);
    if (hasCapturedCoords) bounds.extend([nCapturedLat, nCapturedLng]);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      backgroundColor: '#FFFFFF',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Map Header Toolbar with Legend and Pre-calculated Distance Badge */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#2563EB',
              display: 'inline-block',
              boxShadow: '0 1px 3px rgba(37,99,235,0.4)'
            }} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>HR Address Marker</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px dashed #2563EB',
              backgroundColor: 'rgba(37,99,235,0.15)',
              display: 'inline-block'
            }} />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>100m Radius Limit</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#059669',
              display: 'inline-block',
              boxShadow: '0 1px 3px rgba(5,150,105,0.4)'
            }} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Employee Live Location</span>
          </div>
        </div>

        {distNumber !== null && (
          <span className={`badge ${
            isInsideRadius ? 'badge-success' : 'badge-warning'
          }`} style={{ fontSize: '0.82rem', padding: '5px 12px', fontWeight: 800, letterSpacing: '0.2px' }}>
            DISTANCE: {formattedDistance.toUpperCase()} ({radiusStatusText})
          </span>
        )}
      </div>

      {/* Leaflet Map Canvas */}
      {hasCoords ? (
        <div style={{ height: '360px', width: '100%', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />

          {/* Recenter Button */}
          <button
            type="button"
            onClick={handleRecenter}
            title="Reset Map View & Fit Markers"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1000,
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Crosshair size={18} color="var(--primary)" />
          </button>
        </div>
      ) : (
        <div style={{
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          GPS coordinates not available for map rendering.
        </div>
      )}
    </div>
  );
}
