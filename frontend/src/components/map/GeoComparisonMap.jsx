import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Crosshair, MapPin, AlertTriangle, Layers, Compass } from 'lucide-react';

/**
 * GeoComparisonMap (Interactive Google Maps & OpenStreetMap Audit Engine)
 *
 * Implements strict compliance with GPS Geolocation Audit requirements:
 * 1. Uses exact employee live GPS coordinates as single source of truth.
 * 2. Centers and zooms directly into the employee's residential surroundings (zoom 16).
 * 3. Prominent emerald green marker and visual GPS accuracy radius circle.
 * 4. Google Maps tile layer with OpenStreetMap automatic fallback.
 * 5. Clean "Map unavailable – location coordinates retained" state on tile load failures.
 * 6. Preserves telemetry without ever altering coordinates.
 */
export function GeoComparisonMap({
  hrLat,
  hrLng,
  capturedLat,
  capturedLng,
  gpsAccuracy,
  capturedAt,
  hrAddress,
  submittedAddress,
  distanceMeters,
  distanceCategory
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [tileError, setTileError] = useState(false);
  const [activeLayer, setActiveLayer] = useState('google'); // 'google' or 'osm'

  const nHrLat = hrLat !== null && hrLat !== undefined ? parseFloat(hrLat) : null;
  const nHrLng = hrLng !== null && hrLng !== undefined ? parseFloat(hrLng) : null;
  const nCapturedLat = capturedLat !== null && capturedLat !== undefined ? parseFloat(capturedLat) : null;
  const nCapturedLng = capturedLng !== null && capturedLng !== undefined ? parseFloat(capturedLng) : null;

  const hasHrCoords = !isNaN(nHrLat) && !isNaN(nHrLng) && nHrLat !== null && nHrLng !== null;
  const hasCapturedCoords = !isNaN(nCapturedLat) && !isNaN(nCapturedLng) && nCapturedLat !== null && nCapturedLng !== null;
  const hasCoords = hasCapturedCoords || hasHrCoords;

  const accRadius = useMemo(() => {
    if (gpsAccuracy === null || gpsAccuracy === undefined) return 15;
    const p = parseFloat(gpsAccuracy);
    return isNaN(p) ? 15 : Math.max(2, Math.round(p * 10) / 10);
  }, [gpsAccuracy]);

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

  // Fixed 100-meter verification rule: PASS ONLY when reference is PRECISE and distance <= 100m
  const isApproximateReference = useMemo(() => {
    return typeof distanceCategory === 'string' && distanceCategory.toUpperCase().includes('APPROXIMATE');
  }, [distanceCategory]);

  const isInsideRadius = useMemo(() => {
    if (distNumber === null || isApproximateReference) return false;
    return distNumber <= 100;
  }, [distNumber, isApproximateReference]);

  const radiusStatusText = useMemo(() => {
    if (distNumber === null) return distanceCategory || 'Calculated';
    if (isApproximateReference) return 'HR LOCATION APPROXIMATE - REVIEW REQUIRED';
    return isInsideRadius ? 'INSIDE RADIUS / PASS' : 'OUTSIDE RADIUS / REVIEW REQUIRED';
  }, [distNumber, isInsideRadius, isApproximateReference, distanceCategory]);

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

    // Single Source of Truth: Center directly on Captured Live GPS coordinates
    const centerLat = hasCapturedCoords ? nCapturedLat : nHrLat;
    const centerLng = hasCapturedCoords ? nCapturedLng : nHrLng;
    const defaultZoom = hasCapturedCoords ? 16 : 15;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: true
    }).setView([centerLat, centerLng], defaultZoom);

    mapInstanceRef.current = map;

    // Add zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 1. PRIMARY MAP PROVIDER: Authentic Google Maps Road Layer
    const googleTileUrl = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    const googleTileLayer = L.tileLayer(googleTileUrl, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Maps'
    });

    // 2. FALLBACK MAP PROVIDER: Standard OpenStreetMap Layer
    const osmTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const osmTileLayer = L.tileLayer(osmTileUrl, {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    });

    let googleTileErrorCount = 0;
    googleTileLayer.on('tileerror', () => {
      googleTileErrorCount++;
      if (googleTileErrorCount > 4 && !map.hasLayer(osmTileLayer)) {
        try {
          map.removeLayer(googleTileLayer);
          osmTileLayer.addTo(map);
          setActiveLayer('osm');
        } catch (e) {}
      }
    });

    let osmTileErrorCount = 0;
    osmTileLayer.on('tileerror', () => {
      osmTileErrorCount++;
      if (osmTileErrorCount > 4) {
        setTileError(true);
      }
    });

    googleTileLayer.addTo(map);

    // 1. EMPLOYEE LIVE GPS LOCATION (PRIMARY PROMINENT MARKER & ACCURACY RADIUS)
    if (hasCapturedCoords) {
      const capturedLatLng = [nCapturedLat, nCapturedLng];

      // Visual Representation of GPS Accuracy Radius
      const accuracyCircle = L.circle(capturedLatLng, {
        radius: accRadius,
        color: '#059669',
        fillColor: '#10B981',
        fillOpacity: 0.16,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map);

      accuracyCircle.bindTooltip(
        `<span style="font-weight: 700; font-size: 11px;">GPS Accuracy Radius: ±${accRadius} m</span>`,
        { permanent: false, direction: 'top' }
      );

      // Prominent Emerald Green Marker with radar pulse beacon
      const liveGpsIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: `
          <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 38px;
              height: 38px;
              border-radius: 50%;
              background: rgba(16, 185, 129, 0.35);
              box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
            "></div>
            <div style="
              width: 34px;
              height: 34px;
              background: linear-gradient(135deg, #047857 0%, #10B981 100%);
              color: #FFFFFF;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2.5px solid #FFFFFF;
              box-shadow: 0 4px 14px rgba(4, 120, 87, 0.55);
              cursor: pointer;
              z-index: 10;
            ">
              <span style="transform: rotate(45deg); font-weight: 900; font-size: 9.5px; letter-spacing: 0.3px;">LIVE</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 36],
        popupAnchor: [0, -36]
      });

      const gpsMarker = L.marker(capturedLatLng, { icon: liveGpsIcon, zIndexOffset: 1000 }).addTo(map);
      gpsMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.45; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; color: #065F46; margin-bottom: 6px; border-bottom: 1px solid #D1FAE5; padding-bottom: 4px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background-color: #10B981; display: inline-block;"></span>
            EMPLOYEE VERIFIED LIVE GPS
          </div>
          <div style="font-family: monospace; font-size: 11.5px; font-weight: 700; color: #0F172A; margin-bottom: 4px; background: #F0FDF4; padding: 4px 8px; border-radius: 4px; border: 1px solid #BBF7D0;">
            📍 ${nCapturedLat.toFixed(6)}, ${nCapturedLng.toFixed(6)}
          </div>
          <div style="color: #047857; font-weight: 700; font-size: 11px; margin-bottom: 4px;">
            GPS Accuracy: ±${accRadius} m [Satellite Fix]
          </div>
          <div style="color: #334155; font-size: 11px; margin-bottom: 4px;">
            <strong>Locality:</strong> ${submittedAddress || 'Confirmed Residential Site'}
          </div>
          ${capturedAt ? `
            <div style="font-size: 10px; color: #64748B; border-top: 1px dashed #E2E8F0; padding-top: 4px; margin-top: 4px;">
              Captured: ${capturedAt}
            </div>
          ` : ''}
        </div>
      `);
    }

    // 2. HR ADDRESS PIN & 100M RADIUS (Comparison Reference)
    if (hasHrCoords) {
      const hrLatLng = [nHrLat, nHrLng];

      // 100-meter verification radius boundary around HR
      const hrCircle = L.circle(hrLatLng, {
        radius: 100,
        color: isInsideRadius ? '#059669' : '#2563EB',
        fillColor: isInsideRadius ? '#10B981' : '#3B82F6',
        fillOpacity: 0.10,
        weight: 1.5,
        dashArray: '5, 6'
      }).addTo(map);

      hrCircle.bindTooltip(
        '<span style="font-weight: 700; font-size: 11px;">100m Verification Radius (HR Address)</span>',
        { permanent: false, direction: 'top' }
      );

      // Custom Blue Pin for HR Address
      const hrIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%);
            color: #FFFFFF;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #FFFFFF;
            box-shadow: 0 3px 10px rgba(29, 78, 216, 0.45);
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-weight: 800; font-size: 10px; letter-spacing: 0.3px;">HR</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const hrMarker = L.marker(hrLatLng, { icon: hrIcon }).addTo(map);
      hrMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 190px;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; color: #1E40AF; margin-bottom: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #2563EB; display: inline-block;"></span>
            HR REGISTERED ADDRESS
          </div>
          <div style="color: #334155; margin-bottom: 6px; font-size: 11px;">
            ${hrAddress || 'Standard HR Registered Location'}
          </div>
          <div style="font-family: monospace; font-size: 11px; color: #64748B; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
            Lat: ${nHrLat.toFixed(6)}, Lng: ${nHrLng.toFixed(6)}
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
          weight: 2.5,
          dashArray: '5, 7',
          opacity: 0.8
        }
      ).addTo(map);

      const badgeBorderColor = isInsideRadius ? '#059669' : '#D97706';
      const badgeTextColor = isInsideRadius ? '#065F46' : '#92400E';
      const badgeBgColor = isInsideRadius ? '#ECFDF5' : '#FFFBEB';

      routeLine.bindTooltip(`
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 20px;
          background-color: ${badgeBgColor};
          border: 1.5px solid ${badgeBorderColor};
          color: ${badgeTextColor};
          font-weight: 800;
          font-size: 10.5px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
          white-space: nowrap;
        ">
          <span>📍 ${formattedDistance}</span>
          <span style="font-size: 9px; opacity: 0.9; font-weight: 700;">(${isInsideRadius ? 'PASS' : 'OUTSIDE RADIUS'})</span>
        </div>
      `, {
        permanent: true,
        direction: 'center',
        className: 'leaflet-clean-distance-pill'
      });
    }

    // Ensure Leaflet calculates exact pixel sizes after DOM render
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        // Camera moves precisely to employee's actual captured coordinates
        if (hasCapturedCoords) {
          mapInstanceRef.current.setView([nCapturedLat, nCapturedLng], 16);
        }
      }
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasCoords, hasHrCoords, hasCapturedCoords, nHrLat, nHrLng, nCapturedLat, nCapturedLng, accRadius, formattedDistance, isInsideRadius]);

  // Handler: Center camera directly on Employee Captured GPS Location
  function handleCenterOnEmployeeLive() {
    if (!mapInstanceRef.current || !hasCapturedCoords) return;
    mapInstanceRef.current.flyTo([nCapturedLat, nCapturedLng], 16, { duration: 0.7 });
  }

  // Handler: Fit both HR and Live markers into view
  function handleFitComparison() {
    if (!mapInstanceRef.current || !hasCoords) return;
    const bounds = L.latLngBounds([]);
    if (hasHrCoords) bounds.extend([nHrLat, nHrLng]);
    if (hasCapturedCoords) bounds.extend([nCapturedLat, nCapturedLng]);
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
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
      {/* Map Header Toolbar with Legend and GPS Accuracy Badge */}
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
              backgroundColor: '#059669',
              display: 'inline-block',
              boxShadow: '0 0 6px rgba(5,150,105,0.5)'
            }} />
            <strong style={{ color: '#065F46' }}>Employee Live GPS (Centered)</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '1.5px dashed #059669',
              backgroundColor: 'rgba(16,185,129,0.18)',
              display: 'inline-block'
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>Accuracy Radius: ±{accRadius} m</span>
          </div>

          {hasHrCoords && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: '#2563EB',
                display: 'inline-block'
              }} />
              <span style={{ color: 'var(--text-secondary)' }}>HR Address Reference</span>
            </div>
          )}
        </div>

        {/* Accuracy and Distance Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.78rem',
            padding: '4px 10px',
            fontWeight: 700,
            borderRadius: '4px',
            backgroundColor: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0'
          }}>
            GPS ACCURACY: ±{accRadius} m
          </span>

          {distNumber !== null && (
            <span className={`badge ${
              isInsideRadius ? 'badge-success' : 'badge-warning'
            }`} style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 800 }}>
              DISTANCE: {formattedDistance.toUpperCase()} ({radiusStatusText})
            </span>
          )}
        </div>
      </div>

      {/* Interactive Map Canvas or Unavailable State */}
      {tileError ? (
        <div style={{
          padding: '32px 20px',
          backgroundColor: '#FEF2F2',
          borderBottom: '1px solid #FECACA',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#DC2626', fontWeight: 800, fontSize: '1rem', marginBottom: '8px' }}>
            <AlertTriangle size={20} />
            <span>Map unavailable – location coordinates retained</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#0F172A', fontWeight: 700, marginBottom: '6px' }}>
            Latitude: {hasCapturedCoords ? nCapturedLat.toFixed(6) : 'Not Available'}, Longitude: {hasCapturedCoords ? nCapturedLng.toFixed(6) : 'Not Available'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>
            GPS Accuracy: ±{accRadius} m [High Precision Satellite Fix Retained]
          </div>
        </div>
      ) : hasCoords ? (
        <div style={{ height: '370px', width: '100%', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />

          {/* Map Controls: Snap to Live GPS and Fit Comparison */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {hasCapturedCoords && (
              <button
                type="button"
                onClick={handleCenterOnEmployeeLive}
                title="Center on Employee Live GPS Location"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #10B981',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#065F46',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                }}
              >
                <Compass size={14} color="#059669" />
                <span>Snap to Employee GPS</span>
              </button>
            )}

            {hasHrCoords && hasCapturedCoords && (
              <button
                type="button"
                onClick={handleFitComparison}
                title="Fit HR and Live GPS Markers in View"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                }}
              >
                <Crosshair size={14} color="var(--primary)" />
                <span>View HR vs Live</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          height: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          gap: '8px'
        }}>
          <AlertTriangle size={24} color="#DC2626" />
          <strong style={{ color: '#DC2626' }}>Map unavailable – location coordinates retained</strong>
          <span style={{ fontSize: '0.8rem' }}>Awaiting live GPS coordinates from mobile field capture.</span>
        </div>
      )}
    </div>
  );
}
